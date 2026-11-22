// Receipt Ledger: "did this session actually get something done?". Server-side tracker that turns hook events into one
// small receipt per TURN (UserPromptSubmit -> Stop) counting OUTCOMES, not activity:
//   files changed (unique Edit/Write/MultiEdit/NotebookEdit that succeeded), tests recovered (a test runner that was
//   red and later ran green), commits (git commit that succeeded), tasks done (TaskUpdate/TodoWrite -> completed).
// Pure + injectable `now` (like AttentionTracker). Closed receipts outlive dropSession (TTL 2h, cap 30) so they are
// still there when the user comes back to the desk. Privacy: only counters and short hashes are kept, in memory only;
// no command text, no file names, no commit subjects. Hooks are async: the numbers are "as the hooks reported".

// ---- tuning knobs ----
/** a closed receipt is dropped by sweep (and hidden from rows) after this */
export const RECEIPT_TTL_MS = 2 * 60 * 60 * 1000;
/** closed receipts kept in total (oldest evicted first) */
export const MAX_CLOSED = 30;
/** sessions tracked at once */
export const MAX_SESSIONS = 200;
/** tool_use_ids remembered per session for dedupe */
export const MAX_IDS = 60;
/** unique file hashes counted per receipt */
export const MAX_FILES = 500;
/** test runners remembered per session */
export const MAX_RUNNERS = 8;
/** completed task ids remembered per session */
export const MAX_TASK_IDS = 200;
/** hooks are async: a tool event arriving this soon after Stop still belongs to the receipt that just closed */
export const LATE_GRACE_MS = 5000;
export const PROJECT_CHARS = 40;

const EDIT_TOOLS = new Set(["Edit", "Write", "MultiEdit", "NotebookEdit"]);

export type ReceiptVerdict = "done" | "red" | "none";
/** a closed receipt as sent to the client (counts only) */
export type ReceiptRow = {
  id: string;
  sid: string;
  project: string;
  closedAt: number;
  files: number;
  /** test runners that went red -> green */
  recovered: number;
  commits: number;
  /** `git commit --amend` (kept apart from commits) */
  amends: number;
  tasks: number;
  /** outcomes produced by subagents (squires) of the session, already included in the counts above */
  squire: number;
  /** tool calls in the turn (context only, never a score) */
  calls: number;
  /** red = a test runner was still failing when the turn closed; done = outcomes > 0; none = activity without outcomes */
  verdict: ReceiptVerdict;
  /** a test runner was already red from an EARLIER turn and is still red (this turn did not run it) */
  staleRed: boolean;
};

export type ReceiptEvent = {
  session_id?: unknown;
  hook_event_name?: unknown;
  agent_id?: unknown;
  cwd?: unknown;
  tool_name?: unknown;
  tool_input?: unknown;
  tool_use_id?: unknown;
  is_interrupt?: unknown;
  [k: string]: unknown;
};

// ---- command analysis (exported for tests) ----
function fnv(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}

const HEREDOC_START = /<<-?[ \t]*(['"]?)([A-Za-z_]\w*)\1[^\n]{0,200}\n/g;
const HEREDOC_BODY_MAX = 20_000;
const HEREDOC_MAX_STARTS = 50;

/** remove heredoc bodies (`<<'EOF' ... EOF`). Bounded: <= 50 starts, body <= 20k chars, unterminated delimiters remembered. */
function stripHeredocs(s: string): string {
  let out = "";
  let last = 0;
  const missing = new Set<string>();
  HEREDOC_START.lastIndex = 0;
  let m: RegExpExecArray | null;
  for (let n = 0; n < HEREDOC_MAX_STARTS && (m = HEREDOC_START.exec(s)); n++) {
    const delim = m[2];
    if (missing.has(delim)) continue;
    const bodyStart = m.index + m[0].length;
    const limit = Math.min(s.length, bodyStart + HEREDOC_BODY_MAX);
    let pos = bodyStart;
    let end = -1;
    while (pos <= limit) {
      let nl = s.indexOf("\n", pos);
      if (nl < 0 || nl > limit) nl = s.length;
      if (s.slice(pos, nl).trim() === delim) { end = nl; break; }
      if (nl >= s.length) break;
      pos = nl + 1;
    }
    if (end < 0) { missing.add(delim); continue; }
    out += s.slice(last, m.index);
    last = end;
    HEREDOC_START.lastIndex = end;
  }
  return out + s.slice(last);
}

/** replace quoted strings by empty quotes (so a `;` or `|` inside a message does not look like a shell operator) */
function stripQuotes(s: string): string {
  let out = "";
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === "\\") {
      out += s[i + 1] === "\n" ? " " : "_";
      i++;
    } else if (c === "'") {
      const j = s.indexOf("'", i + 1);
      out += "''";
      if (j < 0) break;
      i = j;
    } else if (c === '"') {
      let j = i + 1;
      while (j < s.length && s[j] !== '"') j += s[j] === "\\" ? 2 : 1;
      out += '""';
      if (j >= s.length) break;
      i = j;
    } else out += c;
  }
  return out;
}

/**
 * Is the exit code of this command trustworthy as "the last thing it ran"? Only plain `a && b && c` chains are:
 * a pipe (`npm test | tail`), `;`, `||` (`|| true`), a newline, or a background `&` all hide / replace the exit code.
 * `segments` are the `&&`-separated parts with quoted text emptied.
 */
export function commandShape(cmd: string): { ok: boolean; segments: string[] } {
  let s = stripQuotes(stripHeredocs(cmd));
  s = s.replace(/\d*[<>]&\d*-?/g, " ").replace(/&>>?/g, " ");
  if (/[|;\n`]/.test(s) || /(?<!&)&(?!&)/.test(s) || s.includes("$(")) return { ok: false, segments: [] };
  return { ok: true, segments: s.split("&&").map((x) => x.trim()).filter(Boolean) };
}

const PREFIX = /^(?:[A-Za-z_]\w*=\S*|time|sudo|nohup|exec|command|env|timeout\s+\d+\S*|npx(?:\s+(?:-y|--yes|--no-install))*|pnpm\s+(?:exec|dlx)|yarn\s+dlx|bunx|npm\s+exec(?:\s+--)?|(?:poetry|uv|pipenv|pdm|hatch)\s+run|bundle\s+exec)\s+/;
const RUNNERS: [string, RegExp][] = [
  // vitest / jest / mocha and `npm|pnpm|yarn|bun [run] test[:x]` share one runner: red with one, green with the other = recovered
  ["node-test", /^(?:\S*\/)?(?:vitest|jest|mocha)(?![\w-])/],
  ["node-test", /^(?:npm|pnpm|yarn|bun)(?:\s+(?:-C|--prefix|--filter|-F|--cwd|--workspace|-w)(?:=|\s+)\S+)*(?:\s+run)?\s+(?:test|t)(?::[\w:-]+)?(?![\w-])/],
  ["node-test", /^yarn\s+(?:vitest|jest|mocha)(?![\w-])/],
  ["playwright", /^(?:\S*\/)?playwright\s+test(?![\w-])/],
  ["pytest", /^(?:(?:python3?|py)\s+-m\s+)?(?:\S*\/)?(?:pytest|py\.test)(?![\w-])/],
  ["go", /^go\s+test(?![\w-])/],
  ["cargo", /^cargo\s+(?:\+\S+\s+)?(?:test|nextest)(?![\w-])/],
  ["rspec", /^rspec(?![\w-])/],
  ["phpunit", /^(?:\S*\/)?phpunit(?![\w-])/],
  ["dotnet", /^dotnet\s+test(?![\w-])/],
  ["deno", /^deno\s+test(?![\w-])/],
  ["maven", /^(?:mvn|\.\/mvnw)\s+(?:[\w:.-]+\s+)*test(?![\w-])/],
  ["gradle", /^(?:gradle|\.\/gradlew)\s+(?:\S+\s+)*test(?![\w-])/],
];

/** which test runner a (single, quote-stripped) command segment starts, or null. `echo vitest` is not one. */
export function runnerOf(segment: string): string | null {
  let r = segment.trim();
  for (let i = 0; i < 8; i++) {
    const m = PREFIX.exec(r);
    if (!m) break;
    r = r.slice(m[0].length);
  }
  for (const [name, re] of RUNNERS) if (re.test(r)) return name;
  return null;
}

const GIT_COMMIT = /^(?:[A-Za-z_]\w*=\S*\s+)*git(?:\s+(?:-[A-Za-z]\s+\S+|--[\w-]+(?:=\S+)?))*\s+commit(?![-\w])/;

/** "commit" | "amend" when some part of a trustworthy && chain is `git commit` (success of the whole chain implies the commit ran) */
export function commitKind(segments: string[]): "commit" | "amend" | null {
  for (const seg of segments) if (GIT_COMMIT.test(seg)) return /(?:^|\s)--dry-run(?![\w-])/.test(seg) ? null : /(?:^|\s)--amend(?![\w-])/.test(seg) ? "amend" : "commit";
  return null;
}

const str = (v: unknown): string => (typeof v === "string" ? v : "");
const obj = (v: unknown): Record<string, unknown> => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {});

type Receipt = {
  id: string;
  sid: string;
  project: string;
  openedAt: number;
  closedAt: number;
  files: Set<string>;
  recovered: number;
  commits: number;
  amends: number;
  tasks: number;
  squire: number;
  calls: number;
  /** runner keys that failed during this turn */
  failed: Set<string>;
  red: boolean;
  staleRed: boolean;
  /** already in `closed` (a turn closed with no calls is held back until a late event lands on it) */
  listed: boolean;
};
type SessionState = {
  sid: string;
  cwd: string;
  open: Receipt | null;
  /** the receipt closed most recently, while late async events may still land on it */
  lastClosed: Receipt | null;
  runners: Map<string, "red" | "green">;
  ids: string[];
  todoDone: Map<string, number>;
  taskIds: Set<string>;
  touched: number;
};

const outcomes = (r: Receipt) => r.files.size + r.recovered + r.commits + r.amends + r.tasks;

function projectOf(cwd: string): string {
  const segs = cwd.split("/").filter(Boolean);
  const p = segs[segs.length - 1] ?? "";
  return (p.length > PROJECT_CHARS ? p.slice(0, PROJECT_CHARS - 1) + "…" : p) || "unknown";
}

export class ReceiptTracker {
  private sessions = new Map<string, SessionState>();
  private closed: Receipt[] = []; // oldest first
  private n = 0;
  /** ids stay unique across server restarts / store rebuilds (the client remembers ids it has seen) */
  private nonce = Date.now().toString(36);

  private state(sid: string, now: number): SessionState {
    let st = this.sessions.get(sid);
    if (st) this.sessions.delete(sid); // re-insert = most recently used
    else st = { sid, cwd: "", open: null, lastClosed: null, runners: new Map(), ids: [], todoDone: new Map(), taskIds: new Set(), touched: now };
    this.sessions.set(sid, st);
    if (this.sessions.size > MAX_SESSIONS) {
      const oldest = this.sessions.keys().next().value as string;
      this.dropSession(oldest, now);
    }
    return st;
  }

  private redNow(st: SessionState): boolean {
    for (const v of st.runners.values()) if (v === "red") return true;
    return false;
  }

  /** red only if a runner that failed in THIS turn is still red; red from an earlier turn is just a note */
  private judge(st: SessionState, r: Receipt): void {
    let red = false;
    for (const k of r.failed) if (st.runners.get(k) === "red") red = true;
    r.red = red;
    r.staleRed = !red && this.redNow(st);
  }

  private list(r: Receipt): void {
    if (r.listed) return;
    r.listed = true;
    this.closed.push(r);
    while (this.closed.length > MAX_CLOSED) this.closed.shift();
  }

  private openNew(st: SessionState, now: number): Receipt {
    const r: Receipt = { id: `${this.nonce}-${++this.n}`, sid: st.sid, project: projectOf(st.cwd), openedAt: now, closedAt: 0, files: new Set(), recovered: 0, commits: 0, amends: 0, tasks: 0, squire: 0, calls: 0, failed: new Set(), red: false, staleRed: false, listed: false };
    st.open = r;
    st.lastClosed = null;
    return r;
  }

  /** close the open receipt; it is kept only if the turn did something (`needOutcome`: only if it produced an outcome) */
  private close(st: SessionState, now: number, needOutcome = false): void {
    const r = st.open;
    st.open = null;
    if (!r || (needOutcome && (r.calls === 0 || outcomes(r) === 0))) return;
    r.closedAt = now;
    if (st.cwd) r.project = projectOf(st.cwd);
    this.judge(st, r);
    st.lastClosed = r;
    // async hooks: Stop may beat the turn's PostToolUse. An empty turn is held back and listed only if a late event lands on it.
    if (r.calls > 0) this.list(r);
  }

  /** Feed a (secret-redacted) hook event. Command text is analysed and thrown away. */
  ingest(raw: ReceiptEvent, now: number): void {
    const sid = str(raw.session_id);
    const name = str(raw.hook_event_name);
    if (!sid || !name) return;
    const agent = str(raw.agent_id);
    if (name === "UserPromptSubmit" || name === "Stop") {
      if (agent) return; // only the main agent starts / finishes a turn
      const st = this.state(sid, now);
      st.touched = now;
      if (str(raw.cwd)) st.cwd = str(raw.cwd);
      this.close(st, now);
      if (name === "UserPromptSubmit") {
        st.lastClosed = null;
        this.openNew(st, now);
      }
      return;
    }
    if (name !== "PostToolUse" && name !== "PostToolUseFailure") return;
    const tool = str(raw.tool_name);
    if (!tool) return;
    const failed = name === "PostToolUseFailure";
    if (failed && raw.is_interrupt === true) return;
    const st = this.state(sid, now);
    st.touched = now;
    if (str(raw.cwd)) st.cwd = str(raw.cwd);
    const id = str(raw.tool_use_id);
    if (id) {
      if (st.ids.includes(id)) return;
      st.ids.push(id);
      if (st.ids.length > MAX_IDS) st.ids.shift();
    }
    // which receipt does this land on: the open turn, a turn that closed a moment ago (late async hook), or a new one
    let r = st.open;
    if (!r) r = st.lastClosed && now - st.lastClosed.closedAt <= LATE_GRACE_MS ? st.lastClosed : this.openNew(st, now);
    r.calls++;
    if (r.closedAt) this.list(r); // late event landed on a closed turn
    const input = obj(raw.tool_input);
    const sq = agent ? 1 : 0;

    if (EDIT_TOOLS.has(tool)) {
      if (failed) return;
      const file = str(input.file_path) || str(input.notebook_path);
      if (file && r.files.size < MAX_FILES) {
        const h = fnv(file);
        if (!r.files.has(h)) {
          r.files.add(h);
          r.squire += sq;
        }
      }
    } else if (tool === "Bash") {
      const cmd = str(input.command);
      if (cmd) this.bash(st, r, cmd, failed, sq, input.run_in_background === true);
    } else if (!failed && tool === "TaskUpdate") {
      if (str(input.status) === "completed") {
        const tid = str(input.taskId) || str(input.task_id) || str(input.id);
        if (!tid || !st.taskIds.has(tid)) {
          if (tid) {
            st.taskIds.add(tid);
            if (st.taskIds.size > MAX_TASK_IDS) st.taskIds.delete(st.taskIds.values().next().value as string);
          }
          r.tasks++;
          r.squire += sq;
        }
      }
    } else if (!failed && tool === "TodoWrite") {
      const todos = Array.isArray(input.todos) ? input.todos.slice(0, 200) : [];
      let done = 0;
      for (const t of todos) if (obj(t).status === "completed") done++;
      const who = agent || "main";
      const delta = Math.max(0, done - (st.todoDone.get(who) ?? 0));
      st.todoDone.delete(who);
      st.todoDone.set(who, done);
      if (st.todoDone.size > 20) st.todoDone.delete(st.todoDone.keys().next().value as string);
      r.tasks += delta;
      if (delta) r.squire += sq;
    }
    if (r.closedAt) this.judge(st, r); // late event that landed on a closed receipt
  }

  private bash(st: SessionState, r: Receipt, cmd: string, failed: boolean, sq: number, background: boolean): void {
    if (background) return; // "success" only means the process launched
    const shape = commandShape(cmd);
    if (!shape.ok || !shape.segments.length) return; // exit code is not (only) the command's: count nothing
    if (!failed) {
      const k = commitKind(shape.segments);
      if (k === "commit") {
        r.commits++;
        r.squire += sq;
      } else if (k === "amend") {
        r.amends++;
        r.squire += sq;
      }
    }
    const runner = runnerOf(shape.segments[shape.segments.length - 1]);
    if (!runner) return; // the test must be the LAST part of the chain: only then does a failure / success speak for it
    const key = st.cwd + "\0" + runner;
    const prev = st.runners.get(key);
    st.runners.delete(key);
    if (failed) {
      st.runners.set(key, "red");
      r.failed.add(key);
    }
    else {
      st.runners.set(key, "green");
      if (prev === "red") {
        r.recovered++;
        r.squire += sq;
      }
    }
    while (st.runners.size > MAX_RUNNERS) st.runners.delete(st.runners.keys().next().value as string);
  }

  /** closed receipts (counts only), newest first */
  rows(now: number): ReceiptRow[] {
    const out: ReceiptRow[] = [];
    for (let i = this.closed.length - 1; i >= 0; i--) {
      const r = this.closed[i];
      if (now - r.closedAt > RECEIPT_TTL_MS) continue;
      const n = outcomes(r);
      out.push({
        id: r.id, sid: r.sid, project: r.project, closedAt: r.closedAt,
        files: r.files.size, recovered: r.recovered, commits: r.commits, amends: r.amends, tasks: r.tasks, squire: r.squire, calls: r.calls,
        verdict: r.red ? "red" : n > 0 ? "done" : "none", staleRed: r.staleRed,
      });
    }
    out.sort((a, b) => b.closedAt - a.closedAt);
    return out;
  }

  /** drop expired receipts and long-idle session state; true iff a visible receipt was removed */
  sweep(now: number): boolean {
    const before = this.closed.length;
    this.closed = this.closed.filter((r) => now - r.closedAt <= RECEIPT_TTL_MS);
    for (const [sid, st] of this.sessions) if (now - st.touched > RECEIPT_TTL_MS) this.dropSession(sid, now);
    return this.closed.length !== before;
  }

  /**
   * The session is gone. Its closed receipts stay (TTL 2h); a turn still open is kept only if it produced something
   * (e.g. SessionEnd with no Stop), otherwise it is dropped with the session.
   */
  dropSession(sid: string, now: number): void {
    const st = this.sessions.get(sid);
    if (!st) return;
    this.close(st, now, true);
    this.sessions.delete(sid);
  }

  /** test/diagnostic: sizes of internal maps */
  size(): { sessions: number; closed: number; open: number } {
    let open = 0;
    for (const st of this.sessions.values()) if (st.open) open++;
    return { sessions: this.sessions.size, closed: this.closed.length, open };
  }
}
