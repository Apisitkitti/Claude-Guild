import {
  BASE36,
  FNV_OFFSET_BASIS,
  FNV_PRIME,
  HEX_BYTE_DIGITS,
  HEX_RADIX,
  MINUTES_PER_HOUR,
  MS_PER_MINUTE,
} from "@/lib/constants";
// Receipt Ledger: "did this session actually get something done?". Server-side tracker that turns hook events into one
// small receipt per TURN (UserPromptSubmit -> Stop) counting OUTCOMES, not activity:
//   files changed (unique Edit/Write/MultiEdit/NotebookEdit that succeeded), tests recovered (a test runner that was
//   red and later ran green), commits (git commit that succeeded), tasks done (TaskUpdate/TodoWrite -> completed).
// Pure + injectable `now` (like AttentionTracker). Closed receipts outlive dropSession (TTL 2h, cap 30) so they are
// still there when the user comes back to the desk. Privacy: only counters and short hashes are kept, in memory only;
// no command text, no file names, no commit subjects. Hooks are async: the numbers are "as the hooks reported".

// ---- tuning knobs ----
/** wrapper prefixes (env, sudo, ...) stripped when finding a command's runner */
const RUNNER_PREFIX_MAX_STRIPS = 8;
/** TodoWrite items read per call */
const MAX_TODOS = 200;
/** owners whose todo-done counters are remembered */
const MAX_TODO_OWNERS = 20;
/** a closed receipt is dropped by sweep (and hidden from rows) after this */
export const RECEIPT_TTL_MS = 2 * MINUTES_PER_HOUR * MS_PER_MINUTE;
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

export const EDIT_TOOLS = new Set(["Edit", "Write", "MultiEdit", "NotebookEdit"]);

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
  [key: string]: unknown;
};

// ---- command analysis (exported for tests) ----
export const fnv = (text: string): string => {
  let hash = FNV_OFFSET_BASIS;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, FNV_PRIME) >>> 0;
  }
  return hash.toString(HEX_RADIX).padStart(HEX_BYTE_DIGITS, "0");
};

const HEREDOC_START = /<<-?[ \t]*(['"]?)([A-Za-z_]\w*)\1[^\n]{0,200}\n/g;
const HEREDOC_BODY_MAX = 20_000;
const HEREDOC_MAX_STARTS = 50;

/** remove heredoc bodies (`<<'EOF' ... EOF`). Bounded: <= 50 starts, body <= 20k chars, unterminated delimiters remembered. */
const stripHeredocs = (command: string): string => {
  let out = "";
  let last = 0;
  const missing = new Set<string>();
  HEREDOC_START.lastIndex = 0;
  let match: RegExpExecArray | null;
  for (let starts = 0; starts < HEREDOC_MAX_STARTS && (match = HEREDOC_START.exec(command)); starts++) {
    const delim = match[2];
    if (missing.has(delim)) continue;
    const bodyStart = match.index + match[0].length;
    const limit = Math.min(command.length, bodyStart + HEREDOC_BODY_MAX);
    let pos = bodyStart;
    let end = -1;
    while (pos <= limit) {
      let nl = command.indexOf("\n", pos);
      if (nl < 0 || nl > limit) nl = command.length;
      if (command.slice(pos, nl).trim() === delim) {
        end = nl;
        break;
      }
      if (nl >= command.length) break;
      pos = nl + 1;
    }
    if (end < 0) {
      missing.add(delim);
      continue;
    }
    out += command.slice(last, match.index);
    last = end;
    HEREDOC_START.lastIndex = end;
  }
  return out + command.slice(last);
};

/** replace quoted strings by empty quotes (so a `;` or `|` inside a message does not look like a shell operator) */
const stripQuotes = (command: string): string => {
  let out = "";
  for (let i = 0; i < command.length; i++) {
    const char = command[i];
    if (char === "\\") {
      out += command[i + 1] === "\n" ? " " : "_";
      i++;
    } else if (char === "'") {
      const end = command.indexOf("'", i + 1);
      out += "''";
      if (end < 0) break;
      i = end;
    } else if (char === '"') {
      let end = i + 1;
      while (end < command.length && command[end] !== '"') end += command[end] === "\\" ? 2 : 1;
      out += '""';
      if (end >= command.length) break;
      i = end;
    } else out += char;
  }
  return out;
};

/**
 * Is the exit code of this command trustworthy as "the last thing it ran"? Only plain `a && b && c` chains are:
 * a pipe (`npm test | tail`), `;`, `||` (`|| true`), a newline, or a background `&` all hide / replace the exit code.
 * `segments` are the `&&`-separated parts with quoted text emptied.
 */
export const commandShape = (cmd: string): { ok: boolean; segments: string[] } => {
  let shell = stripQuotes(stripHeredocs(cmd));
  shell = shell.replace(/\d*[<>]&\d*-?/g, " ").replace(/&>>?/g, " ");
  if (/[|;\n`]/.test(shell) || /(?<!&)&(?!&)/.test(shell) || shell.includes("$(")) return { ok: false, segments: [] };
  return {
    ok: true,
    segments: shell
      .split("&&")
      .map((part) => part.trim())
      .filter(Boolean),
  };
};

const PREFIX =
  /^(?:[A-Za-z_]\w*=\S*|time|sudo|nohup|exec|command|env|timeout\s+\d+\S*|npx(?:\s+(?:-y|--yes|--no-install))*|pnpm\s+(?:exec|dlx)|yarn\s+dlx|bunx|npm\s+exec(?:\s+--)?|(?:poetry|uv|pipenv|pdm|hatch)\s+run|bundle\s+exec)\s+/;
const RUNNERS: [string, RegExp][] = [
  // vitest / jest / mocha and `npm|pnpm|yarn|bun [run] test[:x]` share one runner: red with one, green with the other = recovered
  ["node-test", /^(?:\S*\/)?(?:vitest|jest|mocha)(?![\w-])/],
  [
    "node-test",
    /^(?:npm|pnpm|yarn|bun)(?:\s+(?:-C|--prefix|--filter|-F|--cwd|--workspace|-w)(?:=|\s+)\S+)*(?:\s+run)?\s+(?:test|t)(?::[\w:-]+)?(?![\w-])/,
  ],
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
export const runnerOf = (segment: string): string | null => {
  let command = segment.trim();
  for (let i = 0; i < RUNNER_PREFIX_MAX_STRIPS; i++) {
    const prefix = PREFIX.exec(command);
    if (!prefix) break;
    command = command.slice(prefix[0].length);
  }
  for (const [name, re] of RUNNERS) if (re.test(command)) return name;
  return null;
};

const GIT_COMMIT = /^(?:[A-Za-z_]\w*=\S*\s+)*git(?:\s+(?:-[A-Za-z]\s+\S+|--[\w-]+(?:=\S+)?))*\s+commit(?![-\w])/;

/** "commit" | "amend" when some part of a trustworthy && chain is `git commit` (success of the whole chain implies the commit ran) */
export const commitKind = (segments: string[]): "commit" | "amend" | null => {
  for (const seg of segments)
    if (GIT_COMMIT.test(seg))
      return /(?:^|\s)--dry-run(?![\w-])/.test(seg) ? null : /(?:^|\s)--amend(?![\w-])/.test(seg) ? "amend" : "commit";
  return null;
};

export const str = (value: unknown): string => (typeof value === "string" ? value : "");
export const obj = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};

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
  /** the turn ended in a StopFailure (API error / usage limit): never labelled done */
  interrupted: boolean;
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

const outcomes = (receipt: Receipt) =>
  receipt.files.size + receipt.recovered + receipt.commits + receipt.amends + receipt.tasks;

export const projectOf = (cwd: string): string => {
  const segments = cwd.split("/").filter(Boolean);
  const name = segments[segments.length - 1] ?? "";
  return (name.length > PROJECT_CHARS ? name.slice(0, PROJECT_CHARS - 1) + "…" : name) || "unknown";
};

export class ReceiptTracker {
  private sessions = new Map<string, SessionState>();
  private closed: Receipt[] = []; // oldest first
  private seq = 0;
  /** ids stay unique across server restarts / store rebuilds (the client remembers ids it has seen) */
  private nonce = Date.now().toString(BASE36);

  private state(sid: string, now: number): SessionState {
    let state = this.sessions.get(sid);
    if (state)
      this.sessions.delete(sid); // re-insert = most recently used
    else
      state = {
        sid,
        cwd: "",
        open: null,
        lastClosed: null,
        runners: new Map(),
        ids: [],
        todoDone: new Map(),
        taskIds: new Set(),
        touched: now,
      };
    this.sessions.set(sid, state);
    if (this.sessions.size > MAX_SESSIONS) {
      const oldest = this.sessions.keys().next().value as string;
      this.dropSession(oldest, now);
    }
    return state;
  }

  private redNow(state: SessionState): boolean {
    for (const status of state.runners.values()) if (status === "red") return true;
    return false;
  }

  /** red only if a runner that failed in THIS turn is still red; red from an earlier turn is just a note */
  private judge(state: SessionState, receipt: Receipt): void {
    let red = false;
    for (const runnerKey of receipt.failed) if (state.runners.get(runnerKey) === "red") red = true;
    receipt.red = red;
    receipt.staleRed = !red && this.redNow(state);
  }

  private list(receipt: Receipt): void {
    if (receipt.listed) return;
    receipt.listed = true;
    this.closed.push(receipt);
    while (this.closed.length > MAX_CLOSED) this.closed.shift();
  }

  private openNew(state: SessionState, now: number): Receipt {
    const receipt: Receipt = {
      id: `${this.nonce}-${++this.seq}`,
      sid: state.sid,
      project: projectOf(state.cwd),
      openedAt: now,
      closedAt: 0,
      files: new Set(),
      recovered: 0,
      commits: 0,
      amends: 0,
      tasks: 0,
      squire: 0,
      calls: 0,
      failed: new Set(),
      red: false,
      staleRed: false,
      interrupted: false,
      listed: false,
    };
    state.open = receipt;
    state.lastClosed = null;
    return receipt;
  }

  /** close the open receipt; it is kept only if the turn did something (`needOutcome`: only if it produced an outcome) */
  private close(state: SessionState, now: number, needOutcome = false): void {
    const receipt = state.open;
    state.open = null;
    if (!receipt || (needOutcome && (receipt.calls === 0 || outcomes(receipt) === 0))) return;
    receipt.closedAt = now;
    if (state.cwd) receipt.project = projectOf(state.cwd);
    this.judge(state, receipt);
    state.lastClosed = receipt;
    // async hooks: Stop may beat the turn's PostToolUse. An empty turn is held back and listed only if a late event lands on it.
    if (receipt.calls > 0) this.list(receipt);
  }

  /** Feed a (secret-redacted) hook event. Command text is analysed and thrown away. */
  ingest(raw: ReceiptEvent, now: number): void {
    const sid = str(raw.session_id);
    const name = str(raw.hook_event_name);
    if (!sid || !name) return;
    const agent = str(raw.agent_id);
    if (name === "UserPromptSubmit" || name === "Stop" || name === "StopFailure") {
      if (agent) return; // only the main agent starts / finishes a turn
      const state = this.state(sid, now);
      state.touched = now;
      if (str(raw.cwd)) state.cwd = str(raw.cwd);
      if (name === "StopFailure" && state.open) state.open.interrupted = true;
      this.close(state, now);
      if (name === "UserPromptSubmit") {
        state.lastClosed = null;
        this.openNew(state, now);
      }
      return;
    }
    if (name !== "PostToolUse" && name !== "PostToolUseFailure") return;
    const tool = str(raw.tool_name);
    if (!tool) return;
    const failed = name === "PostToolUseFailure";
    if (failed && raw.is_interrupt === true) return;
    const state = this.state(sid, now);
    state.touched = now;
    if (str(raw.cwd)) state.cwd = str(raw.cwd);
    const id = str(raw.tool_use_id);
    if (id) {
      if (state.ids.includes(id)) return;
      state.ids.push(id);
      if (state.ids.length > MAX_IDS) state.ids.shift();
    }
    // which receipt does this land on: the open turn, a turn that closed a moment ago (late async hook), or a new one
    let receipt = state.open;
    if (!receipt)
      receipt =
        state.lastClosed && now - state.lastClosed.closedAt <= LATE_GRACE_MS
          ? state.lastClosed
          : this.openNew(state, now);
    receipt.calls++;
    if (receipt.closedAt) this.list(receipt); // late event landed on a closed turn
    const input = obj(raw.tool_input);
    const squireInc = agent ? 1 : 0;

    if (EDIT_TOOLS.has(tool)) {
      if (failed) return;
      const file = str(input.file_path) || str(input.notebook_path);
      if (file && receipt.files.size < MAX_FILES) {
        const fileHash = fnv(file);
        if (!receipt.files.has(fileHash)) {
          receipt.files.add(fileHash);
          receipt.squire += squireInc;
        }
      }
    } else if (tool === "Bash") {
      const cmd = str(input.command);
      if (cmd) this.bash(state, receipt, cmd, failed, squireInc, input.run_in_background === true);
    } else if (!failed && tool === "TaskUpdate") {
      if (str(input.status) === "completed") {
        const tid = str(input.taskId) || str(input.task_id) || str(input.id);
        if (!tid || !state.taskIds.has(tid)) {
          if (tid) {
            state.taskIds.add(tid);
            if (state.taskIds.size > MAX_TASK_IDS) state.taskIds.delete(state.taskIds.values().next().value as string);
          }
          receipt.tasks++;
          receipt.squire += squireInc;
        }
      }
    } else if (!failed && tool === "TodoWrite") {
      const todos = Array.isArray(input.todos) ? input.todos.slice(0, MAX_TODOS) : [];
      let done = 0;
      for (const todo of todos) if (obj(todo).status === "completed") done++;
      const who = agent || "main";
      const delta = Math.max(0, done - (state.todoDone.get(who) ?? 0));
      state.todoDone.delete(who);
      state.todoDone.set(who, done);
      if (state.todoDone.size > MAX_TODO_OWNERS) state.todoDone.delete(state.todoDone.keys().next().value as string);
      receipt.tasks += delta;
      if (delta) receipt.squire += squireInc;
    }
    if (receipt.closedAt) this.judge(state, receipt); // late event that landed on a closed receipt
  }

  private bash(
    state: SessionState,
    receipt: Receipt,
    cmd: string,
    failed: boolean,
    squireInc: number,
    background: boolean,
  ): void {
    if (background) return; // "success" only means the process launched
    const shape = commandShape(cmd);
    if (!shape.ok || !shape.segments.length) return; // exit code is not (only) the command's: count nothing
    if (!failed) {
      const kind = commitKind(shape.segments);
      if (kind === "commit") {
        receipt.commits++;
        receipt.squire += squireInc;
      } else if (kind === "amend") {
        receipt.amends++;
        receipt.squire += squireInc;
      }
    }
    const runner = runnerOf(shape.segments[shape.segments.length - 1]);
    if (!runner) return; // the test must be the LAST part of the chain: only then does a failure / success speak for it
    const key = state.cwd + "\0" + runner;
    const prev = state.runners.get(key);
    state.runners.delete(key);
    if (failed) {
      state.runners.set(key, "red");
      receipt.failed.add(key);
    } else {
      state.runners.set(key, "green");
      if (prev === "red") {
        receipt.recovered++;
        receipt.squire += squireInc;
      }
    }
    while (state.runners.size > MAX_RUNNERS) state.runners.delete(state.runners.keys().next().value as string);
  }

  /** closed receipts (counts only), newest first */
  rows(now: number): ReceiptRow[] {
    const out: ReceiptRow[] = [];
    for (let i = this.closed.length - 1; i >= 0; i--) {
      const receipt = this.closed[i];
      if (now - receipt.closedAt > RECEIPT_TTL_MS) continue;
      const outcomeCount = outcomes(receipt);
      out.push({
        id: receipt.id,
        sid: receipt.sid,
        project: receipt.project,
        closedAt: receipt.closedAt,
        files: receipt.files.size,
        recovered: receipt.recovered,
        commits: receipt.commits,
        amends: receipt.amends,
        tasks: receipt.tasks,
        squire: receipt.squire,
        calls: receipt.calls,
        verdict: receipt.red ? "red" : outcomeCount > 0 && !receipt.interrupted ? "done" : "none",
        staleRed: receipt.staleRed,
      });
    }
    out.sort((first, second) => second.closedAt - first.closedAt);
    return out;
  }

  /** drop expired receipts and long-idle session state; true iff a visible receipt was removed */
  sweep(now: number): boolean {
    const before = this.closed.length;
    this.closed = this.closed.filter((receipt) => now - receipt.closedAt <= RECEIPT_TTL_MS);
    for (const [sid, state] of this.sessions) if (now - state.touched > RECEIPT_TTL_MS) this.dropSession(sid, now);
    return this.closed.length !== before;
  }

  /**
   * The session is gone. Its closed receipts stay (TTL 2h); a turn still open is kept only if it produced something
   * (e.g. SessionEnd with no Stop), otherwise it is dropped with the session.
   */
  dropSession(sid: string, now: number): void {
    const state = this.sessions.get(sid);
    if (!state) return;
    this.close(state, now, true);
    this.sessions.delete(sid);
  }

  /** test/diagnostic: sizes of internal maps */
  size(): { sessions: number; closed: number; open: number } {
    let open = 0;
    for (const state of this.sessions.values()) if (state.open) open++;
    return { sessions: this.sessions.size, closed: this.closed.length, open };
  }
}
