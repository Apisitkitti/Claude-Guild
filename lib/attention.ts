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
// Rows carry data only (kind + params); the client words them in the viewer's language.

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
  /** permission only: the wait is old enough that it may already have been granted */
  stale?: true;
  /** loop only: the failing tool, its short target, how many times it failed and the first informative error line */
  tool?: string;
  target?: string;
  count?: number;
  error?: string;
  /** asked only: tail of the final message (the client words the row and builds any text to copy) */
  tail?: string;
  /** context only: percent of the window used */
  pct?: number;
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
  [key: string]: unknown;
};

// ---- helpers (exported for tests) ----
const fnv = (text: string): string => {
  let hash = FNV_OFFSET_BASIS;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, FNV_PRIME) >>> 0;
  }
  return hash.toString(HEX_RADIX).padStart(HEX_BYTE_DIGITS, "0");
};

const TMP_PATH = /(?<=^|[\s'"`(=])(?:\/private)?\/(?:var\/folders|tmp)\/[^\s'"`)]*/g;
/** numbers / durations that stand alone (not part of a word, path, `HEAD~1`, `a1.test.ts`) */
const LONE_DUR = /(?<![\w./~-])\d+(?:\.\d+)?(?:ms|sec(?:onds?)?|s|min|m)(?![\w./-])/gi;
const LONE_NUM = /(?<![\w./~-])\d+(?:\.\d+)?(?![\w./-])/g;
const BARE_EXIT = /^(?:error:\s*)?exit code \d+$/i;
/** longest raw error normalized in full; beyond this keep head + tail */
const ERR_MAX = 8000;
const ISO_TS = /\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})?/g;
const ANSI = /\x1b\[[0-9;]*[A-Za-z]/g;

const squash = (text: string) => text.replace(/\s+/g, " ").trim();
const cut = (text: string, maxChars: number) => (text.length > maxChars ? text.slice(0, maxChars - 1) + "…" : text);

/** command with timestamps, tmp paths and digits stripped, so reruns compare equal */
export const normalizeCommand = (cmd: string): string =>
  squash(
    cmd
      .replace(ANSI, "")
      .replace(TMP_PATH, "<tmp>")
      .replace(ISO_TS, "<ts>")
      .replace(LONE_DUR, "<dur>")
      .replace(LONE_NUM, "#"),
  );

/** error text with numbers, durations, hex ids and tmp paths stripped */
export const normalizeError = (err: string): string => {
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
};

/** first informative line of an error: skips blanks and bare "Exit code N" (falls back to it) */
export const errorLine = (err: string): string => {
  const lines = err.replace(ANSI, "").split("\n").map(squash).filter(Boolean);
  const good = lines.find((line) => !BARE_EXIT.test(line));
  return cut(good ?? lines[0] ?? "", ERROR_CHARS);
};

const stableJson = (value: unknown, depth = 0): string => {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (depth >= STABLE_JSON_MAX_DEPTH) return "{…}";
  if (Array.isArray(value))
    return (
      "[" +
      value
        .slice(0, STABLE_JSON_MAX_ITEMS)
        .map((item) => stableJson(item, depth + 1))
        .join(",") +
      "]"
    );
  const obj = value as Record<string, unknown>;
  return (
    "{" +
    Object.keys(obj)
      .sort()
      .slice(0, STABLE_JSON_MAX_KEYS)
      .map((key) => JSON.stringify(key) + ":" + stableJson(obj[key], depth + 1))
      .join(",") +
    "}"
  );
};

/** `fp` identifies "the same attempt"; `target` is the short human label (never the full input) */
export const fingerprint = (tool: string, input: unknown): { fp: string; target: string } => {
  const toolInput = input && typeof input === "object" ? (input as Record<string, unknown>) : {};
  if (tool === "Bash" && typeof toolInput.command === "string") {
    return {
      fp: "Bash:" + fnv(normalizeCommand(toolInput.command)),
      target: cut(squash(toolInput.command.split("\n")[0]), TARGET_CHARS),
    };
  }
  if (EDIT_TOOLS.has(tool)) {
    const file =
      typeof toolInput.file_path === "string"
        ? toolInput.file_path
        : typeof toolInput.notebook_path === "string"
          ? toolInput.notebook_path
          : "";
    const old = typeof toolInput.old_string === "string" ? toolInput.old_string : "";
    const segments = file.split("/").filter(Boolean);
    return {
      fp: `${tool}:${fnv(file + "\0" + fnv(old))}`,
      target: cut(segments.slice(-PATH_TAIL_SEGMENTS).join("/") || file, TARGET_CHARS),
    };
  }
  const json = stableJson(toolInput).slice(0, FINGERPRINT_JSON_CHARS);
  return { fp: `${tool}:${fnv(json)}`, target: cut(json === "{}" ? "" : json, TARGET_CHARS) };
};

const Q_END = /[?？]["'”’)\]`*_\s]*$/;
const TH_END = /(?:ไหม|มั้ย|มั๊ย|หรือเปล่า|หรือไม่)(?:ครับ|คะ|ค่ะ|นะครับ|นะคะ|นะ)?[\s?？!.]*$/;
const TH_POLITE_Q = /(?:ครับ|คะ|ค่ะ)\s*[?？]\s*$/;
const PHRASES = /would you like|should i\b|do you want|let me know/i;

/** guess: does this final message leave a question for the user? */
export const looksAsked = (msg: string): boolean => {
  const trimmed = msg.trim();
  if (!trimmed) return false;
  return (
    Q_END.test(trimmed) ||
    TH_END.test(trimmed) ||
    TH_POLITE_Q.test(trimmed) ||
    PHRASES.test(trimmed.slice(-QUESTION_TAIL_CHARS))
  );
};

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
    const mapKey = sid + "\0" + agent;
    let state = this.keys.get(mapKey);
    if (state)
      this.keys.delete(mapKey); // re-insert = most recently used
    else state = { sid, agent, ring: [], ids: [], loop: null, touched: 0 };
    this.keys.set(mapKey, state);
    if (this.keys.size > MAX_KEYS) this.keys.delete(this.keys.keys().next().value as string);
    return state;
  }

  private resetSession(sid: string, agent?: string) {
    for (const [mapKey, state] of this.keys) {
      if (state.sid !== sid) continue;
      if (agent !== undefined && mapKey !== sid + "\0" + agent) continue;
      state.ring = [];
      state.loop = null;
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
      const entry: Done =
        typeof msg === "string"
          ? {
              since: now,
              asked: looksAsked(msg),
              tail: cut(squash(msg.slice(-TAIL_CHARS * 2)).slice(-TAIL_CHARS), TAIL_CHARS + 1),
            }
          : { since: now, asked: false };
      if (entry.tail === "") delete entry.tail;
      this.done.delete(sid);
      this.done.set(sid, entry);
      if (this.done.size > MAX_DONE) this.done.delete(this.done.keys().next().value as string);
      return;
    }
    if (name !== "PostToolUse" && name !== "PostToolUseFailure") return;
    const tool = typeof raw.tool_name === "string" ? raw.tool_name : "";
    if (!tool) return;
    const failed = name === "PostToolUseFailure";
    if (failed && raw.is_interrupt === true) return;
    const state = this.key(sid, agent || "main");
    state.touched = now;
    const id = typeof raw.tool_use_id === "string" ? raw.tool_use_id : "";
    if (id) {
      if (state.ids.includes(id)) return;
      state.ids.push(id);
      if (state.ids.length > MAX_IDS_PER_KEY) state.ids.shift();
    }
    if (!failed) {
      if (EDIT_TOOLS.has(tool)) {
        state.ring = [];
        state.loop = null;
        return;
      }
      // the same attempt finally succeeded: its earlier failures no longer count
      const { fp: attemptId } = fingerprint(tool, raw.tool_input);
      state.ring = state.ring.filter((rec) => rec.fp !== attemptId);
      if (state.loop && state.loop.fp === attemptId) state.loop = null;
      return;
    }
    const { fp: attemptId, target } = fingerprint(tool, raw.tool_input);
    const errRaw = typeof raw.error === "string" ? raw.error : "";
    const err = fnv(normalizeError(errRaw));
    state.ring.push({ fp: attemptId, ok: false, err, ts: now });
    if (state.ring.length > RING_SIZE) state.ring.shift();
    const same = state.ring.filter(
      (rec) => !rec.ok && rec.fp === attemptId && rec.err === err && now - rec.ts <= LOOP_WINDOW_MS,
    );
    if (same.length >= LOOP_MIN_FAILS) {
      state.loop = {
        fp: attemptId,
        tool,
        target,
        count: same.length,
        error: errorLine(errRaw),
        since: same[0].ts,
        last: now,
      };
    } else if (state.loop && state.loop.fp === attemptId) {
      state.loop = null; // same attempt now fails differently / window passed
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
    const current = this.ctx.get(sid);
    this.ctx.set(sid, { frac, since: current ? current.since : now });
  }

  queue(now: number): AttentionRow[] {
    const rows: AttentionRow[] = [];
    const rank = new Map<AttentionRow, number>();
    for (const [sid, since] of this.waiting) {
      const stale = now - since >= PERM_STALE_MS;
      const row: AttentionRow = {
        key: `${sid}|permission|${since}`,
        sid,
        kind: "permission",
        since,
        ...(stale ? { stale: true as const } : {}),
      };
      if (stale) rank.set(row, STALE_PERM_RANK);
      rows.push(row);
    }
    for (const state of this.keys.values()) {
      const loop = state.loop;
      if (!loop) continue;
      rows.push({
        key: `${state.sid}|loop|${state.agent}|${loop.fp}`,
        sid: state.sid,
        kind: "loop",
        since: loop.since,
        tool: loop.tool,
        ...(loop.target ? { target: loop.target } : {}),
        count: loop.count,
        ...(loop.error ? { error: loop.error } : {}),
      });
    }
    for (const [sid, entry] of this.done) {
      if (entry.asked)
        rows.push({
          key: `${sid}|asked|${entry.since}`,
          sid,
          kind: "asked",
          since: entry.since,
          ...(entry.tail ? { tail: entry.tail } : {}),
        });
      else rows.push({ key: `${sid}|done|${entry.since}`, sid, kind: "done", since: entry.since });
    }
    for (const [sid, pressure] of this.ctx)
      rows.push({
        key: `${sid}|context`,
        sid,
        kind: "context",
        since: pressure.since,
        pct: Math.round(pressure.frac * PERCENT),
      });
    const rankOf = (row: AttentionRow) => rank.get(row) ?? RANK[row.kind];
    rows.sort(
      (first, second) =>
        rankOf(first) - rankOf(second) || first.since - second.since || (first.key < second.key ? -1 : 1),
    );
    return rows.slice(0, MAX_ROWS);
  }

  /** drop stale state; true iff something was removed */
  sweep(now: number): boolean {
    let changed = false;
    for (const [sid, entry] of this.done)
      if (now - entry.since > DONE_STALE_MS) {
        this.done.delete(sid);
        changed = true;
      }
    for (const [mapKey, state] of this.keys) {
      if (state.loop && now - state.loop.last > LOOP_STALE_MS) {
        state.loop = null;
        changed = true;
      }
      if (!state.loop && now - state.touched > LOOP_STALE_MS) this.keys.delete(mapKey);
    }
    return changed;
  }

  dropSession(sid: string): void {
    for (const [mapKey, state] of this.keys) if (state.sid === sid) this.keys.delete(mapKey);
    this.done.delete(sid);
    this.waiting.delete(sid);
    this.ctx.delete(sid);
  }

  /** test/diagnostic: sizes of internal maps */
  size(): { keys: number; done: number; waiting: number; ctx: number } {
    return { keys: this.keys.size, done: this.done.size, waiting: this.waiting.size, ctx: this.ctx.size };
  }
}
