import {
  FNV_OFFSET_BASIS,
  FNV_PRIME,
  HEX_BYTE_DIGITS,
  HEX_RADIX,
  MS_PER_MINUTE,
  MS_PER_SECOND,
  PERCENT,
} from "@/lib/constants";
// Lookout Bell: "who needs me first?". Server-side tracker that turns hook events into a small ordered queue of
// reasons to look at a session: waiting for permission, looping on the same failure, a (guessed) question left for
// the user, context nearly full, finished and awaiting review. Pure + injectable `now` (like TerritoryTracker).
// Hooks are async: this can warn, not block. Privacy: only short tails / hashes are kept, in memory only.

// ---- tuning knobs ----
/** same fingerprint + same normalized error this many times ... */
export const LOOP_MIN_FAILS = 3;
/** ... within this window counts as a loop */
const LOOP_WINDOW_MINUTES = 5;
export const LOOP_WINDOW_MS = LOOP_WINDOW_MINUTES * MS_PER_MINUTE;
/** failures/successes remembered per (session, agent) */
export const RING_SIZE = 12;
/** tool_use_ids remembered per key for dedupe */
export const MAX_IDS_PER_KEY = 40;
/** (session, agent) keys kept in total */
export const MAX_KEYS = 200;
/** a loop with no new failures for this long is dropped by sweep */
const LOOP_STALE_MINUTES = 10;
export const LOOP_STALE_MS = LOOP_STALE_MINUTES * MS_PER_MINUTE;
/** a done / asked row is dropped by sweep after this */
const DONE_STALE_MINUTES = 30;
export const DONE_STALE_MS = DONE_STALE_MINUTES * MS_PER_MINUTE;
/** context fraction at which the context row appears */
export const CTX_PRESSURE = 0.85;
export const MAX_ROWS = 20;
export const MAX_DONE = 100;
/** a permission wait older than this with no new event may already have been granted (no hook fires on grant) */
const PERM_STALE_SECONDS = 90;
export const PERM_STALE_MS = PERM_STALE_SECONDS * MS_PER_SECOND;
export const TAIL_CHARS = 80;
/** stableJson: nesting depth, array items and object keys kept when fingerprinting */
const STABLE_JSON_MAX_DEPTH = 3;
const STABLE_JSON_MAX_ITEMS = 10;
const STABLE_JSON_MAX_KEYS = 20;
/** trailing path segments shown as a target */
const PATH_TAIL_SEGMENTS = 2;
/** chars of stable JSON used as a fingerprint */
const FINGERPRINT_JSON_CHARS = 400;
/** trailing chars of a message scanned for question phrases */
const QUESTION_TAIL_CHARS = 250;
export const TARGET_CHARS = 80;
export const ERROR_CHARS = 120;

const EDIT_TOOLS = new Set(["Edit", "Write", "MultiEdit", "NotebookEdit"]);

export type AttentionKind = "permission" | "loop" | "asked" | "context" | "done";
export type AttentionRow = {
  /** stable identity of this reason (dismissals are per key) */
  key: string;
  sid: string;
  kind: AttentionKind;
  since: number;
  text: string;
  detail?: string;
  /** loop only: message the user can paste into the session */
  copy?: string;
};

const RANK: Record<AttentionKind, number> = { permission: 0, loop: 1, asked: 2, context: 3, done: 4 };
/** a possibly-already-granted permission wait ranks just below loop */
const STALE_PERM_RANK = 1.5;

export type AttentionEvent = {
  session_id?: unknown;
  hook_event_name?: unknown;
  agent_id?: unknown;
  tool_name?: unknown;
  tool_input?: unknown;
  tool_use_id?: unknown;
  error?: unknown;
  is_interrupt?: unknown;
  last_assistant_message?: unknown;
  [k: string]: unknown;
};

// ---- helpers (exported for tests) ----
function fnv(s: string): string {
  let h = FNV_OFFSET_BASIS;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, FNV_PRIME) >>> 0;
  }
  return h.toString(HEX_RADIX).padStart(HEX_BYTE_DIGITS, "0");
}

const TMP_PATH = /(?<=^|[\s'"`(=])(?:\/private)?\/(?:var\/folders|tmp)\/[^\s'"`)]*/g;
/** numbers / durations that stand alone (not part of a word, path, `HEAD~1`, `a1.test.ts`) */
const LONE_DUR = /(?<![\w./~-])\d+(?:\.\d+)?(?:ms|sec(?:onds?)?|s|min|m)(?![\w./-])/gi;
const LONE_NUM = /(?<![\w./~-])\d+(?:\.\d+)?(?![\w./-])/g;
const BARE_EXIT = /^(?:error:\s*)?exit code \d+$/i;
/** longest raw error normalized in full; beyond this keep head + tail */
const ERR_MAX = 8000;
const ISO_TS = /\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})?/g;
const ANSI = /\x1b\[[0-9;]*[A-Za-z]/g;

const squash = (s: string) => s.replace(/\s+/g, " ").trim();
const cut = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1) + "…" : s);

/** command with timestamps, tmp paths and digits stripped, so reruns compare equal */
export function normalizeCommand(cmd: string): string {
  return squash(
    cmd
      .replace(ANSI, "")
      .replace(TMP_PATH, "<tmp>")
      .replace(ISO_TS, "<ts>")
      .replace(LONE_DUR, "<dur>")
      .replace(LONE_NUM, "#"),
  );
}

/** error text with numbers, durations, hex ids and tmp paths stripped */
export function normalizeError(err: string): string {
  const raw = err.length > ERR_MAX ? err.slice(0, ERR_MAX / 2) + "\n" + err.slice(-ERR_MAX / 2) : err;
  return squash(
    raw
      .replace(ANSI, "")
      .replace(TMP_PATH, "<tmp>")
      .replace(ISO_TS, "<ts>")
      .replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, "<id>")
      .replace(/\b0x[0-9a-f]+\b/gi, "<hex>")
      .replace(/\b(?=[0-9a-f]*\d)(?=[0-9a-f]*[a-f])[0-9a-f]{8,}\b/gi, "<hex>")
      .replace(/\d+(?:\.\d+)?\s?(?:ms|sec(?:onds?)?|s|m|min)\b/gi, "<dur>")
      .replace(/\d+/g, "#"),
  ).toLowerCase();
}

/** first informative line of an error: skips blanks and bare "Exit code N" (falls back to it) */
export function errorLine(err: string): string {
  const lines = err.replace(ANSI, "").split("\n").map(squash).filter(Boolean);
  const good = lines.find((l) => !BARE_EXIT.test(l));
  return cut(good ?? lines[0] ?? "", ERROR_CHARS);
}

function stableJson(v: unknown, depth = 0): string {
  if (v === null || typeof v !== "object") return JSON.stringify(v) ?? "null";
  if (depth >= STABLE_JSON_MAX_DEPTH) return "{…}";
  if (Array.isArray(v))
    return (
      "[" +
      v
        .slice(0, STABLE_JSON_MAX_ITEMS)
        .map((x) => stableJson(x, depth + 1))
        .join(",") +
      "]"
    );
  const o = v as Record<string, unknown>;
  return (
    "{" +
    Object.keys(o)
      .sort()
      .slice(0, STABLE_JSON_MAX_KEYS)
      .map((k) => JSON.stringify(k) + ":" + stableJson(o[k], depth + 1))
      .join(",") +
    "}"
  );
}

/** `fp` identifies "the same attempt"; `target` is the short human label (never the full input) */
export function fingerprint(tool: string, input: unknown): { fp: string; target: string } {
  const ti = input && typeof input === "object" ? (input as Record<string, unknown>) : {};
  if (tool === "Bash" && typeof ti.command === "string") {
    return {
      fp: "Bash:" + fnv(normalizeCommand(ti.command)),
      target: cut(squash(ti.command.split("\n")[0]), TARGET_CHARS),
    };
  }
  if (EDIT_TOOLS.has(tool)) {
    const file =
      typeof ti.file_path === "string" ? ti.file_path : typeof ti.notebook_path === "string" ? ti.notebook_path : "";
    const old = typeof ti.old_string === "string" ? ti.old_string : "";
    const segs = file.split("/").filter(Boolean);
    return {
      fp: `${tool}:${fnv(file + "\0" + fnv(old))}`,
      target: cut(segs.slice(-PATH_TAIL_SEGMENTS).join("/") || file, TARGET_CHARS),
    };
  }
  const json = stableJson(ti).slice(0, FINGERPRINT_JSON_CHARS);
  return { fp: `${tool}:${fnv(json)}`, target: cut(json === "{}" ? "" : json, TARGET_CHARS) };
}

const Q_END = /[?？]["'”’)\]`*_\s]*$/;
const TH_END = /(?:ไหม|มั้ย|มั๊ย|หรือเปล่า|หรือไม่)(?:ครับ|คะ|ค่ะ|นะครับ|นะคะ|นะ)?[\s?？!.]*$/;
const TH_POLITE_Q = /(?:ครับ|คะ|ค่ะ)\s*[?？]\s*$/;
const PHRASES = /would you like|should i\b|do you want|let me know/i;

/** guess: does this final message leave a question for the user? */
export function looksAsked(msg: string): boolean {
  const t = msg.trim();
  if (!t) return false;
  return Q_END.test(t) || TH_END.test(t) || TH_POLITE_Q.test(t) || PHRASES.test(t.slice(-QUESTION_TAIL_CHARS));
}

type Rec = { fp: string; ok: boolean; err: string; ts: number }; // err = hash of the normalized error
type Loop = { fp: string; tool: string; target: string; count: number; error: string; since: number; last: number };
type KeyState = { sid: string; agent: string; ring: Rec[]; ids: string[]; loop: Loop | null; touched: number };
type Done = { since: number; asked: boolean; tail?: string };

export class AttentionTracker {
  private keys = new Map<string, KeyState>(); // `${sid}\0${agent ?? "main"}`
  private done = new Map<string, Done>();
  private waiting = new Map<string, number>();
  private ctx = new Map<string, { frac: number; since: number }>();

  private key(sid: string, agent: string): KeyState {
    const k = sid + "\0" + agent;
    let st = this.keys.get(k);
    if (st)
      this.keys.delete(k); // re-insert = most recently used
    else st = { sid, agent, ring: [], ids: [], loop: null, touched: 0 };
    this.keys.set(k, st);
    if (this.keys.size > MAX_KEYS) this.keys.delete(this.keys.keys().next().value as string);
    return st;
  }

  private resetSession(sid: string, agent?: string) {
    for (const [k, st] of this.keys) {
      if (st.sid !== sid) continue;
      if (agent !== undefined && k !== sid + "\0" + agent) continue;
      st.ring = [];
      st.loop = null;
    }
  }

  /** Feed a RAW hook event (before slimming strips tool_response / last_assistant_message). */
  ingest(raw: AttentionEvent, now: number): void {
    const sid = typeof raw.session_id === "string" ? raw.session_id : "";
    const name = typeof raw.hook_event_name === "string" ? raw.hook_event_name : "";
    if (!sid || !name) return;
    const agent = typeof raw.agent_id === "string" && raw.agent_id ? raw.agent_id : "";
    if (name === "UserPromptSubmit") {
      this.resetSession(sid);
      this.done.delete(sid);
      return;
    }
    if (name === "SubagentStop") {
      if (agent) this.keys.delete(sid + "\0" + agent);
      return;
    }
    if (name === "Stop") {
      this.resetSession(sid, agent || "main");
      if (agent) return; // only the main agent "finishes" for the user
      const msg = raw.last_assistant_message;
      const d: Done =
        typeof msg === "string"
          ? {
              since: now,
              asked: looksAsked(msg),
              tail: cut(squash(msg.slice(-TAIL_CHARS * 2)).slice(-TAIL_CHARS), TAIL_CHARS + 1),
            }
          : { since: now, asked: false };
      if (d.tail === "") delete d.tail;
      this.done.delete(sid);
      this.done.set(sid, d);
      if (this.done.size > MAX_DONE) this.done.delete(this.done.keys().next().value as string);
      return;
    }
    if (name !== "PostToolUse" && name !== "PostToolUseFailure") return;
    const tool = typeof raw.tool_name === "string" ? raw.tool_name : "";
    if (!tool) return;
    const failed = name === "PostToolUseFailure";
    if (failed && raw.is_interrupt === true) return;
    const st = this.key(sid, agent || "main");
    st.touched = now;
    const id = typeof raw.tool_use_id === "string" ? raw.tool_use_id : "";
    if (id) {
      if (st.ids.includes(id)) return;
      st.ids.push(id);
      if (st.ids.length > MAX_IDS_PER_KEY) st.ids.shift();
    }
    if (!failed) {
      if (EDIT_TOOLS.has(tool)) {
        st.ring = [];
        st.loop = null;
        return;
      }
      // the same attempt finally succeeded: its earlier failures no longer count
      const { fp } = fingerprint(tool, raw.tool_input);
      st.ring = st.ring.filter((r) => r.fp !== fp);
      if (st.loop && st.loop.fp === fp) st.loop = null;
      return;
    }
    const { fp, target } = fingerprint(tool, raw.tool_input);
    const errRaw = typeof raw.error === "string" ? raw.error : "";
    const err = fnv(normalizeError(errRaw));
    st.ring.push({ fp, ok: false, err, ts: now });
    if (st.ring.length > RING_SIZE) st.ring.shift();
    const same = st.ring.filter((r) => !r.ok && r.fp === fp && r.err === err && now - r.ts <= LOOP_WINDOW_MS);
    if (same.length >= LOOP_MIN_FAILS) {
      st.loop = { fp, tool, target, count: same.length, error: errorLine(errRaw), since: same[0].ts, last: now };
    } else if (st.loop && st.loop.fp === fp) {
      st.loop = null; // same attempt now fails differently / window passed
    }
  }

  /** main agent is blocked on the user since `since` (null = no longer) */
  setWaiting(sid: string, since: number | null): void {
    if (since === null) this.waiting.delete(sid);
    else if (!this.waiting.has(sid)) this.waiting.set(sid, since);
  }

  /** context fraction 0..1 (null = unknown / compacted) */
  setContext(sid: string, frac: number | null, now: number): void {
    if (frac === null || !Number.isFinite(frac) || frac < CTX_PRESSURE) {
      this.ctx.delete(sid);
      return;
    }
    const cur = this.ctx.get(sid);
    this.ctx.set(sid, { frac, since: cur ? cur.since : now });
  }

  queue(now: number): AttentionRow[] {
    const rows: AttentionRow[] = [];
    const rank = new Map<AttentionRow, number>();
    for (const [sid, since] of this.waiting) {
      const stale = now - since >= PERM_STALE_MS;
      const r: AttentionRow = {
        key: `${sid}|permission|${since}`,
        sid,
        kind: "permission",
        since,
        text: stale ? "อาจอนุญาตแล้ว — ตรวจดู" : "รออนุญาตจากคุณ (permission)",
      };
      if (stale) rank.set(r, STALE_PERM_RANK);
      rows.push(r);
    }
    for (const st of this.keys.values()) {
      const l = st.loop;
      if (!l) continue;
      const what = l.target ? `${l.tool} ${l.target}` : l.tool;
      rows.push({
        key: `${st.sid}|loop|${st.agent}|${l.fp}`,
        sid: st.sid,
        kind: "loop",
        since: l.since,
        text: `วนลูป: ${what} ล้มซ้ำ ${l.count} ครั้ง`,
        ...(l.error ? { detail: l.error } : {}),
        copy: `คุณรัน \`${l.target || l.tool}\` แล้วล้มด้วย error เดิม ${l.count} ครั้ง${l.error ? `: ${l.error}` : ""}. หยุดลองซ้ำ อธิบายสาเหตุก่อนแล้วเปลี่ยนวิธี`,
      });
    }
    for (const [sid, d] of this.done) {
      if (d.asked)
        rows.push({
          key: `${sid}|asked|${d.since}`,
          sid,
          kind: "asked",
          since: d.since,
          text: "น่าจะรอคำตอบคุณ (เดา)",
          ...(d.tail ? { detail: d.tail } : {}),
        });
      else rows.push({ key: `${sid}|done|${d.since}`, sid, kind: "done", since: d.since, text: "เสร็จแล้ว รอรีวิว" });
    }
    for (const [sid, c] of this.ctx)
      rows.push({
        key: `${sid}|context`,
        sid,
        kind: "context",
        since: c.since,
        text: `context ใกล้เต็ม ${Math.round(c.frac * PERCENT)}%`,
      });
    const rk = (r: AttentionRow) => rank.get(r) ?? RANK[r.kind];
    rows.sort((a, b) => rk(a) - rk(b) || a.since - b.since || (a.key < b.key ? -1 : 1));
    return rows.slice(0, MAX_ROWS);
  }

  /** drop stale state; true iff something was removed */
  sweep(now: number): boolean {
    let changed = false;
    for (const [sid, d] of this.done)
      if (now - d.since > DONE_STALE_MS) {
        this.done.delete(sid);
        changed = true;
      }
    for (const [k, st] of this.keys) {
      if (st.loop && now - st.loop.last > LOOP_STALE_MS) {
        st.loop = null;
        changed = true;
      }
      if (!st.loop && now - st.touched > LOOP_STALE_MS) this.keys.delete(k);
    }
    return changed;
  }

  dropSession(sid: string): void {
    for (const [k, st] of this.keys) if (st.sid === sid) this.keys.delete(k);
    this.done.delete(sid);
    this.waiting.delete(sid);
    this.ctx.delete(sid);
  }

  /** test/diagnostic: sizes of internal maps */
  size(): { keys: number; done: number; waiting: number; ctx: number } {
    return { keys: this.keys.size, done: this.done.size, waiting: this.waiting.size, ctx: this.ctx.size };
  }
}
