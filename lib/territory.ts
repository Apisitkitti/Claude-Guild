import path from "node:path";

import { MS_PER_MINUTE } from "@/lib/constants";

// Territory Clash: tracks which top-level session "holds" (recently edited) which files, and reports
// overlaps (>=2 sessions hold the same file) and clashes (an edit failed on a file someone else holds /
// just touched). Pure + injectable `now` so it is easy to test. Hooks are async: this can warn, not block.

/** `failer` (clash only): sid whose edit failed (the loser of the clash). With several failers, the most recent one. */
export type TerritoryConflict = {
  file: string;
  sids: string[];
  level: "overlap" | "clash";
  since: number;
  failer?: string;
};
export type TerritoryMsg = { claims: { sid: string; files: string[] }[]; conflicts: TerritoryConflict[] };

export type TerritoryEvent = {
  session_id?: string;
  hook_event_name?: string;
  cwd?: string;
  agent_id?: string;
  tool_name?: string;
  tool_input?: Record<string, unknown>;
};

/** trailing path segments shown for a file */
const PATH_TAIL_SEGMENTS = 2;
const CLAIM_TTL_MINUTES = 10;
export const CLAIM_TTL_MS = CLAIM_TTL_MINUTES * MS_PER_MINUTE;
export const RECENT_MS = 2 * MS_PER_MINUTE;
const CLASH_TTL_MINUTES = 10;
export const CLASH_TTL_MS = CLASH_TTL_MINUTES * MS_PER_MINUTE;
export const MAX_CLAIMS_PER_SESSION = 50;
export const MAX_CLAIMS_TOTAL = 2000;
export const MAX_RECENT = 2000;

const EDIT_TOOLS = new Set(["Edit", "Write", "MultiEdit", "NotebookEdit"]);
const IGNORED_SEGMENTS = new Set(["node_modules", ".git", ".next"]);
const IGNORED_PREFIXES = ["/tmp/", "/private/tmp/", "/var/folders/", "/private/var/folders/"];

type Claim = { file: string; display: string; lastTouch: number };
type Clash = { file: string; display: string; failer: string; sids: string[]; since: number };

/** Absolute normalized path of an edit target, or null when not trackable. */
export const resolveTarget = (cwd: string | undefined, target: unknown): string | null => {
  if (typeof target !== "string" || !target) return null;
  const abs = path.normalize(path.resolve(cwd || "/", target));
  if (IGNORED_PREFIXES.some((prefix) => abs.startsWith(prefix))) return null;
  if (abs.split("/").some((segment) => IGNORED_SEGMENTS.has(segment))) return null;
  return abs;
};

/** Display path: relative to cwd if under it, otherwise the last two segments. Never absolute. */
export const displayPath = (abs: string, cwd: string | undefined): string => {
  if (cwd) {
    const root = path.normalize(path.resolve("/", cwd)).replace(/\/+$/, "");
    if (root && abs.startsWith(root + "/")) return abs.slice(root.length + 1);
  }
  const segments = abs.split("/").filter(Boolean);
  return segments.slice(-PATH_TAIL_SEGMENTS).join("/");
};

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
    if (!evt.agent_id && (name === "Stop" || name === "StopFailure" || name === "SessionEnd")) {
      this.expire(now);
      this.claims.delete(sid);
      return this.refresh(now);
    }
    const isEdit = typeof evt.tool_name === "string" && EDIT_TOOLS.has(evt.tool_name);
    if (!isEdit) return false;
    if (name !== "PreToolUse" && name !== "PostToolUse" && name !== "PostToolUseFailure") return false;
    const toolInput = evt.tool_input ?? {};
    const file = resolveTarget(evt.cwd, toolInput.file_path ?? toolInput.notebook_path);
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

  /** Forget a session entirely (ended / stale). */
  dropSession(sid: string, now: number): boolean {
    this.claims.delete(sid);
    for (const [file, times] of this.recent) {
      if (times.delete(sid)) this.recentCount--;
      if (times.size === 0) this.recent.delete(file);
    }
    for (const [key, clash] of this.clashes)
      if (clash.failer === sid || clash.sids.includes(sid)) this.clashes.delete(key);
    return this.refresh(now);
  }

  private touch(sid: string, file: string, cwd: string | undefined, now: number) {
    let mine = this.claims.get(sid);
    if (!mine) this.claims.set(sid, (mine = new Map()));
    mine.set(file, { file, display: displayPath(file, cwd), lastTouch: now });
    if (mine.size > MAX_CLAIMS_PER_SESSION) {
      let oldest: string | null = null;
      for (const [claimFile, claim] of mine)
        if (claimFile !== file && (oldest === null || claim.lastTouch < mine.get(oldest)!.lastTouch))
          oldest = claimFile;
      if (oldest) mine.delete(oldest);
    }
    let total = 0;
    for (const sessionClaims of this.claims.values()) total += sessionClaims.size;
    while (total > MAX_CLAIMS_TOTAL) {
      let oldestSid: string | null = null;
      let oldestFile: string | null = null;
      let oldestTouch = Infinity;
      for (const [claimSid, sessionClaims] of this.claims)
        for (const [claimFile, claim] of sessionClaims)
          if (!(claimSid === sid && claimFile === file) && claim.lastTouch < oldestTouch) {
            oldestSid = claimSid;
            oldestFile = claimFile;
            oldestTouch = claim.lastTouch;
          }
      if (oldestSid === null || oldestFile === null) break;
      const sessionClaims = this.claims.get(oldestSid)!;
      sessionClaims.delete(oldestFile);
      if (sessionClaims.size === 0) this.claims.delete(oldestSid);
      total--;
    }
    let touches = this.recent.get(file);
    if (!touches) this.recent.set(file, (touches = new Map()));
    if (!touches.has(sid)) this.recentCount++;
    touches.set(sid, now);
    if (this.recentCount > MAX_RECENT) this.pruneRecent(now);
  }

  private pruneRecent(now: number) {
    for (const [file, touches] of this.recent) {
      for (const [touchSid, touchedAt] of touches)
        if (now - touchedAt >= RECENT_MS) {
          touches.delete(touchSid);
          this.recentCount--;
        }
      if (touches.size === 0) this.recent.delete(file);
    }
    while (this.recentCount > MAX_RECENT) {
      let oldestFile: string | null = null;
      let oldestSid: string | null = null;
      let oldestTouch = Infinity;
      for (const [file, touches] of this.recent)
        for (const [touchSid, touchedAt] of touches)
          if (touchedAt < oldestTouch) {
            oldestFile = file;
            oldestSid = touchSid;
            oldestTouch = touchedAt;
          }
      if (oldestFile === null || oldestSid === null) break;
      const touches = this.recent.get(oldestFile)!;
      touches.delete(oldestSid);
      this.recentCount--;
      if (touches.size === 0) this.recent.delete(oldestFile);
    }
  }

  private fail(sid: string, file: string, cwd: string | undefined, now: number) {
    const others = new Set<string>();
    for (const [claimSid, sessionClaims] of this.claims)
      if (claimSid !== sid && sessionClaims.has(file)) others.add(claimSid);
    const touches = this.recent.get(file);
    if (touches)
      for (const [touchSid, touchedAt] of touches)
        if (touchSid !== sid && now - touchedAt < RECENT_MS) others.add(touchSid);
    if (others.size === 0) return; // failing on a file nobody else touched is not a clash (also: same session never clashes)
    const key = `${file}\0${sid}`;
    const sids = [sid, ...others].sort();
    const existing = this.clashes.get(key);
    // Repeated failures keep the original `since` so the client doesn't re-alert; the sid set may grow.
    this.clashes.set(key, {
      file,
      display: displayPath(file, cwd),
      failer: sid,
      sids: existing ? [...new Set([...existing.sids, ...sids])].sort() : sids,
      since: existing?.since ?? now,
    });
  }

  /**
   * Clash lifetime (chosen rule): a clash entry (file + failing session B) ends when
   *  - B successfully edits that file (PostToolUse), or
   *  - 10 min after it began, or
   *  - none of the other involved sessions holds a claim on the file any more AND >= 2 min have passed.
   * It also ends when an involved session is dropped.
   */
  private expire(now: number) {
    for (const [sid, sessionClaims] of this.claims) {
      for (const [file, claim] of sessionClaims) if (now - claim.lastTouch >= CLAIM_TTL_MS) sessionClaims.delete(file);
      if (sessionClaims.size === 0) this.claims.delete(sid);
    }
    for (const [file, touches] of this.recent) {
      for (const [touchSid, touchedAt] of touches)
        if (now - touchedAt >= RECENT_MS) {
          touches.delete(touchSid);
          this.recentCount--;
        }
      if (touches.size === 0) this.recent.delete(file);
    }
    for (const [key, clash] of this.clashes) {
      const age = now - clash.since;
      const othersHold = clash.sids.some((other) => other !== clash.failer && this.claims.get(other)?.has(clash.file));
      if (age >= CLASH_TTL_MS || (!othersHold && age >= RECENT_MS)) this.clashes.delete(key);
    }
  }

  private build(now: number): TerritoryMsg {
    const claims: TerritoryMsg["claims"] = [];
    const holders = new Map<string, string[]>();
    const display = new Map<string, string>();
    for (const sid of [...this.claims.keys()].sort()) {
      const sessionClaims = this.claims.get(sid)!;
      if (sessionClaims.size === 0) continue;
      const sorted = [...sessionClaims.values()].sort(
        (first, second) => second.lastTouch - first.lastTouch || (first.file < second.file ? -1 : 1),
      );
      claims.push({ sid, files: sorted.slice(0, MAX_CLAIMS_PER_SESSION).map((claim) => claim.display) });
      for (const claim of sessionClaims.values()) {
        const fileHolders = holders.get(claim.file);
        if (fileHolders) fileHolders.push(sid);
        else holders.set(claim.file, [sid]);
        if (!display.has(claim.file)) display.set(claim.file, claim.display);
      }
    }
    const clashByFile = new Map<string, Clash[]>();
    for (const clash of this.clashes.values()) {
      const fileClashes = clashByFile.get(clash.file);
      if (fileClashes) fileClashes.push(clash);
      else clashByFile.set(clash.file, [clash]);
      if (!display.has(clash.file)) display.set(clash.file, clash.display);
    }
    // Overlap start time: when a file first reached >=2 holders; reset when it drops below 2.
    for (const [file, fileHolders] of holders)
      if (fileHolders.length >= 2 && !this.overlapSince.has(file)) this.overlapSince.set(file, now);
    for (const file of [...this.overlapSince.keys()])
      if ((holders.get(file)?.length ?? 0) < 2) this.overlapSince.delete(file);

    const conflicts: TerritoryConflict[] = [];
    for (const file of new Set([...holders.keys(), ...clashByFile.keys()])) {
      const fileHolders = holders.get(file) ?? [];
      const fileClashes = clashByFile.get(file);
      if (fileClashes) {
        const sids = [...new Set([...fileHolders, ...fileClashes.flatMap((clash) => clash.sids)])].sort();
        let top = fileClashes[0];
        for (const clash of fileClashes)
          if (clash.since > top.since || (clash.since === top.since && clash.failer < top.failer)) top = clash;
        conflicts.push({
          file: display.get(file)!,
          sids,
          level: "clash",
          since: Math.max(...fileClashes.map((clash) => clash.since)),
          failer: top.failer,
        });
      } else if (fileHolders.length >= 2) {
        conflicts.push({
          file: display.get(file)!,
          sids: [...fileHolders].sort(),
          level: "overlap",
          since: this.overlapSince.get(file)!,
        });
      }
    }
    conflicts.sort(
      (first, second) =>
        (first.level === second.level ? 0 : first.level === "clash" ? -1 : 1) ||
        second.since - first.since ||
        (first.file < second.file ? -1 : 1),
    );
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
