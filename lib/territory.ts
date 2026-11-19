import path from "node:path";

// Territory Clash: tracks which top-level session "holds" (recently edited) which files, and reports
// overlaps (>=2 sessions hold the same file) and clashes (an edit failed on a file someone else holds /
// just touched). Pure + injectable `now` so it is easy to test. Hooks are async: this can warn, not block.

/** `failer` (clash only): sid whose edit failed (the loser of the clash). With several failers, the most recent one. */
export type TerritoryConflict = { file: string; sids: string[]; level: "overlap" | "clash"; since: number; failer?: string };
export type TerritoryMsg = { claims: { sid: string; files: string[] }[]; conflicts: TerritoryConflict[] };

export type TerritoryEvent = {
  session_id?: string;
  hook_event_name?: string;
  cwd?: string;
  agent_id?: string;
  tool_name?: string;
  tool_input?: Record<string, unknown>;
};

export const CLAIM_TTL_MS = 10 * 60 * 1000;
export const RECENT_MS = 2 * 60 * 1000;
export const CLASH_TTL_MS = 10 * 60 * 1000;
export const MAX_CLAIMS_PER_SESSION = 50;
export const MAX_CLAIMS_TOTAL = 2000;
export const MAX_RECENT = 2000;

const EDIT_TOOLS = new Set(["Edit", "Write", "MultiEdit", "NotebookEdit"]);
const IGNORED_SEGMENTS = new Set(["node_modules", ".git", ".next"]);
const IGNORED_PREFIXES = ["/tmp/", "/private/tmp/", "/var/folders/", "/private/var/folders/"];

type Claim = { file: string; display: string; lastTouch: number };
type Clash = { file: string; display: string; failer: string; sids: string[]; since: number };

/** Absolute normalized path of an edit target, or null when not trackable. */
export function resolveTarget(cwd: string | undefined, p: unknown): string | null {
  if (typeof p !== "string" || !p) return null;
  const abs = path.normalize(path.resolve(cwd || "/", p));
  if (IGNORED_PREFIXES.some((x) => abs.startsWith(x))) return null;
  if (abs.split("/").some((seg) => IGNORED_SEGMENTS.has(seg))) return null;
  return abs;
}

/** Display path: relative to cwd if under it, otherwise the last two segments. Never absolute. */
export function displayPath(abs: string, cwd: string | undefined): string {
  if (cwd) {
    const root = path.normalize(path.resolve("/", cwd)).replace(/\/+$/, "");
    if (root && abs.startsWith(root + "/")) return abs.slice(root.length + 1);
  }
  const segs = abs.split("/").filter(Boolean);
  return segs.slice(-2).join("/");
}

export class TerritoryTracker {
  private claims = new Map<string, Map<string, Claim>>(); // sid -> file -> claim
  private recent = new Map<string, Map<string, number>>(); // file -> sid -> last touch (survives release, 2 min)
  private recentCount = 0;
  private clashes = new Map<string, Clash>(); // `${file}\0${failer}`
  private overlapSince = new Map<string, number>();
  private msg: TerritoryMsg = { claims: [], conflicts: [] };
  private json = JSON.stringify(this.msg);

  snapshot(): TerritoryMsg {
    return this.msg;
  }

  /** Feed a hook event. Returns true iff the emitted TerritoryMsg changed. */
  onEvent(evt: TerritoryEvent, now: number): boolean {
    const sid = evt.session_id;
    const name = evt.hook_event_name;
    if (!sid || !name) return false;
    // Squires/subagents (agent_id set) count as their parent session_id, but never release it.
    if (!evt.agent_id && (name === "Stop" || name === "SessionEnd")) {
      this.expire(now);
      this.claims.delete(sid);
      return this.refresh(now);
    }
    const isEdit = typeof evt.tool_name === "string" && EDIT_TOOLS.has(evt.tool_name);
    if (!isEdit) return false;
    if (name !== "PreToolUse" && name !== "PostToolUse" && name !== "PostToolUseFailure") return false;
    const ti = evt.tool_input ?? {};
    const file = resolveTarget(evt.cwd, ti.file_path ?? ti.notebook_path);
    if (!file) return false;
    this.expire(now);
    if (name === "PostToolUseFailure") {
      this.fail(sid, file, evt.cwd, now);
    } else {
      // Only PreToolUse creates a claim; async PostToolUse may arrive after Stop and must not resurrect one.
      if (name === "PreToolUse" || this.claims.get(sid)?.has(file)) this.touch(sid, file, evt.cwd, now);
      // Clash rule: a later successful edit of F by the failing session clears its clash for F.
      if (name === "PostToolUse") this.clashes.delete(`${file}\0${sid}`);
    }
    return this.refresh(now);
  }

  /** Expire stale claims/recents/clashes. Returns true iff the message changed. */
  sweep(now: number): boolean {
    this.expire(now);
    return this.refresh(now);
  }

  /** Release a session's claims: all of them, or just the given absolute files. */
  releaseFiles(sid: string, files: string[] | undefined, now: number): boolean {
    const m = this.claims.get(sid);
    if (m) {
      if (!files) this.claims.delete(sid);
      else {
        for (const f of files) m.delete(f);
        if (m.size === 0) this.claims.delete(sid);
      }
    }
    return this.refresh(now);
  }

  /** Who holds (claim) or recently touched an absolute file. */
  holdersOf(file: string, now: number): { sid: string; kind: "claim" | "recent"; at: number }[] {
    const out: { sid: string; kind: "claim" | "recent"; at: number }[] = [];
    const seen = new Set<string>();
    for (const [sid, m] of this.claims) {
      const c = m.get(file);
      if (c && now - c.lastTouch < CLAIM_TTL_MS) {
        out.push({ sid, kind: "claim", at: c.lastTouch });
        seen.add(sid);
      }
    }
    const r = this.recent.get(file);
    if (r) for (const [sid, t] of r) if (!seen.has(sid) && now - t < RECENT_MS) out.push({ sid, kind: "recent", at: t });
    return out;
  }

  /** Forget a session entirely (ended / stale). */
  dropSession(sid: string, now: number): boolean {
    this.claims.delete(sid);
    for (const [file, m] of this.recent) {
      if (m.delete(sid)) this.recentCount--;
      if (m.size === 0) this.recent.delete(file);
    }
    for (const [k, c] of this.clashes) if (c.failer === sid || c.sids.includes(sid)) this.clashes.delete(k);
    return this.refresh(now);
  }

  private touch(sid: string, file: string, cwd: string | undefined, now: number) {
    let mine = this.claims.get(sid);
    if (!mine) this.claims.set(sid, (mine = new Map()));
    mine.set(file, { file, display: displayPath(file, cwd), lastTouch: now });
    if (mine.size > MAX_CLAIMS_PER_SESSION) {
      let oldest: string | null = null;
      for (const [f, c] of mine) if (f !== file && (oldest === null || c.lastTouch < mine.get(oldest)!.lastTouch)) oldest = f;
      if (oldest) mine.delete(oldest);
    }
    let total = 0;
    for (const m of this.claims.values()) total += m.size;
    while (total > MAX_CLAIMS_TOTAL) {
      let os: string | null = null;
      let of: string | null = null;
      let ot = Infinity;
      for (const [s, m] of this.claims) for (const [f, c] of m) if (!(s === sid && f === file) && c.lastTouch < ot) {
          os = s;
          of = f;
          ot = c.lastTouch;
        }
      if (os === null || of === null) break;
      const m = this.claims.get(os)!;
      m.delete(of);
      if (m.size === 0) this.claims.delete(os);
      total--;
    }
    let r = this.recent.get(file);
    if (!r) this.recent.set(file, (r = new Map()));
    if (!r.has(sid)) this.recentCount++;
    r.set(sid, now);
    if (this.recentCount > MAX_RECENT) this.pruneRecent(now);
  }

  private pruneRecent(now: number) {
    for (const [file, m] of this.recent) {
      for (const [s, t] of m) if (now - t >= RECENT_MS) {
          m.delete(s);
          this.recentCount--;
        }
      if (m.size === 0) this.recent.delete(file);
    }
    while (this.recentCount > MAX_RECENT) {
      let of: string | null = null;
      let os: string | null = null;
      let ot = Infinity;
      for (const [f, m] of this.recent) for (const [s, t] of m) if (t < ot) {
          of = f;
          os = s;
          ot = t;
        }
      if (of === null || os === null) break;
      const m = this.recent.get(of)!;
      m.delete(os);
      this.recentCount--;
      if (m.size === 0) this.recent.delete(of);
    }
  }

  private fail(sid: string, file: string, cwd: string | undefined, now: number) {
    const others = new Set<string>();
    for (const [s, m] of this.claims) if (s !== sid && m.has(file)) others.add(s);
    const r = this.recent.get(file);
    if (r) for (const [s, t] of r) if (s !== sid && now - t < RECENT_MS) others.add(s);
    if (others.size === 0) return; // failing on a file nobody else touched is not a clash (also: same session never clashes)
    const key = `${file}\0${sid}`;
    const sids = [sid, ...others].sort();
    const existing = this.clashes.get(key);
    // Repeated failures keep the original `since` so the client doesn't re-alert; the sid set may grow.
    this.clashes.set(key, { file, display: displayPath(file, cwd), failer: sid, sids: existing ? [...new Set([...existing.sids, ...sids])].sort() : sids, since: existing?.since ?? now });
  }

  /**
   * Clash lifetime (chosen rule): a clash entry (file + failing session B) ends when
   *  - B successfully edits that file (PostToolUse), or
   *  - 10 min after it began, or
   *  - none of the other involved sessions holds a claim on the file any more AND >= 2 min have passed.
   * It also ends when an involved session is dropped.
   */
  private expire(now: number) {
    for (const [sid, m] of this.claims) {
      for (const [f, c] of m) if (now - c.lastTouch >= CLAIM_TTL_MS) m.delete(f);
      if (m.size === 0) this.claims.delete(sid);
    }
    for (const [file, m] of this.recent) {
      for (const [s, t] of m) if (now - t >= RECENT_MS) {
          m.delete(s);
          this.recentCount--;
        }
      if (m.size === 0) this.recent.delete(file);
    }
    for (const [k, c] of this.clashes) {
      const age = now - c.since;
      const othersHold = c.sids.some((s) => s !== c.failer && this.claims.get(s)?.has(c.file));
      if (age >= CLASH_TTL_MS || (!othersHold && age >= RECENT_MS)) this.clashes.delete(k);
    }
  }

  private build(now: number): TerritoryMsg {
    const claims: TerritoryMsg["claims"] = [];
    const holders = new Map<string, string[]>();
    const display = new Map<string, string>();
    for (const sid of [...this.claims.keys()].sort()) {
      const m = this.claims.get(sid)!;
      if (m.size === 0) continue;
      const sorted = [...m.values()].sort((a, b) => b.lastTouch - a.lastTouch || (a.file < b.file ? -1 : 1));
      claims.push({ sid, files: sorted.slice(0, MAX_CLAIMS_PER_SESSION).map((c) => c.display) });
      for (const c of m.values()) {
        const h = holders.get(c.file);
        if (h) h.push(sid);
        else holders.set(c.file, [sid]);
        if (!display.has(c.file)) display.set(c.file, c.display);
      }
    }
    const clashByFile = new Map<string, Clash[]>();
    for (const c of this.clashes.values()) {
      const l = clashByFile.get(c.file);
      if (l) l.push(c);
      else clashByFile.set(c.file, [c]);
      if (!display.has(c.file)) display.set(c.file, c.display);
    }
    // Overlap start time: when a file first reached >=2 holders; reset when it drops below 2.
    for (const [f, h] of holders) if (h.length >= 2 && !this.overlapSince.has(f)) this.overlapSince.set(f, now);
    for (const f of [...this.overlapSince.keys()]) if ((holders.get(f)?.length ?? 0) < 2) this.overlapSince.delete(f);

    const conflicts: TerritoryConflict[] = [];
    for (const file of new Set([...holders.keys(), ...clashByFile.keys()])) {
      const h = holders.get(file) ?? [];
      const cl = clashByFile.get(file);
      if (cl) {
        const sids = [...new Set([...h, ...cl.flatMap((c) => c.sids)])].sort();
        let top = cl[0];
        for (const c of cl) if (c.since > top.since || (c.since === top.since && c.failer < top.failer)) top = c;
        conflicts.push({ file: display.get(file)!, sids, level: "clash", since: Math.max(...cl.map((c) => c.since)), failer: top.failer });
      } else if (h.length >= 2) {
        conflicts.push({ file: display.get(file)!, sids: [...h].sort(), level: "overlap", since: this.overlapSince.get(file)! });
      }
    }
    conflicts.sort((a, b) => (a.level === b.level ? 0 : a.level === "clash" ? -1 : 1) || b.since - a.since || (a.file < b.file ? -1 : 1));
    return { claims, conflicts };
  }

  private refresh(now: number): boolean {
    const next = this.build(now);
    const json = JSON.stringify(next);
    if (json === this.json) return false;
    this.msg = next;
    this.json = json;
    return true;
  }
}
