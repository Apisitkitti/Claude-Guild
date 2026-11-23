import { MINUTES_PER_HOUR, MS_PER_MINUTE } from "@/lib/constants";
import { redactSecrets } from "@/lib/redact";

// Quest Board: Claude's own todo list per session. Server-side tracker fed by hook events:
//   TodoWrite  -> tool_input.todos [{content, status, activeForm}] replaces the whole list
//   TaskCreate -> appends one task (ids are assumed sequential "1","2",... as Claude Code numbers them: the tool
//                 response that carries the id is dropped before it reaches us)
//   TaskUpdate -> changes status / text of a task by taskId; status "deleted" removes it
// Only the main agent writes the board (a squire's own scratch list must not replace the session's). All text is
// secret-redacted and capped, in memory only. Pure + injectable `now` (like ReceiptTracker).

// ---- tuning knobs ----
/** sessions with a list kept at once (least recently updated evicted first) */
export const MAX_QUEST_SESSIONS = 12;
/** todos kept per session */
export const MAX_QUEST_ITEMS = 40;
/** chars kept of a todo's text / progress text / project name */
export const QUEST_TEXT_CHARS = 120;
export const QUEST_PROJECT_CHARS = 40;
/** a session that ended keeps its board this long (late async hooks, a glance back at the desk) */
const END_GRACE_MINUTES = 5;
export const QUEST_END_GRACE_MS = END_GRACE_MINUTES * MS_PER_MINUTE;
/** a session that sent nothing for this long loses its board */
export const QUEST_IDLE_TTL_MS = 2 * MINUTES_PER_HOUR * MS_PER_MINUTE;

export type QuestStatus = "pending" | "in_progress" | "completed";
export type QuestItem = {
  text: string;
  status: QuestStatus;
  /** present-tense wording of an in-progress item ("Running tests"), when Claude gave one */
  active?: string;
};
/** one session's list as sent to the client */
export type QuestRow = {
  sid: string;
  project: string;
  updatedAt: number;
  items: QuestItem[];
};

export type QuestEvent = {
  session_id?: unknown;
  hook_event_name?: unknown;
  agent_id?: unknown;
  cwd?: unknown;
  tool_name?: unknown;
  tool_input?: unknown;
  [key: string]: unknown;
};

type TaskItem = QuestItem & {
  tid?: string;
  /** the activeForm as last given, kept while the item is not in progress */
  form?: string;
};
type SessionBoard = {
  sid: string;
  cwd: string;
  items: TaskItem[];
  /** TaskCreate calls seen: the next task id */
  created: number;
  updatedAt: number;
  /** set by SessionEnd: the board is dropped once the grace has passed */
  endedAt: number | null;
};

const str = (value: unknown): string => (typeof value === "string" ? value : "");
const obj = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};

const clean = (value: unknown, limit = QUEST_TEXT_CHARS): string => {
  const text = redactSecrets(str(value)).replace(/\s+/g, " ").trim();
  return text.length > limit ? text.slice(0, limit - 1) + "…" : text;
};

const projectOf = (cwd: string): string => {
  const segments = cwd.split("/").filter(Boolean);
  return clean(segments[segments.length - 1] ?? "", QUEST_PROJECT_CHARS) || "unknown";
};

/** "deleted" and unknown words are not a state of an open board item */
const statusOf = (value: unknown): QuestStatus | null =>
  value === "pending" || value === "in_progress" || value === "completed" ? value : null;

const makeItem = (text: string, status: QuestStatus, activeForm: unknown): TaskItem => {
  const form = clean(activeForm);
  const item: TaskItem =
    form && status === "in_progress" && form !== text ? { text, status, active: form } : { text, status };
  return form ? { ...item, form } : item;
};

export class QuestBoardTracker {
  private sessions = new Map<string, SessionBoard>();

  private board(sid: string, now: number): SessionBoard {
    let board = this.sessions.get(sid);
    if (board)
      this.sessions.delete(sid); // re-insert = most recently used
    else board = { sid, cwd: "", items: [], created: 0, updatedAt: now, endedAt: null };
    this.sessions.set(sid, board);
    while (this.sessions.size > MAX_QUEST_SESSIONS) this.sessions.delete(this.sessions.keys().next().value as string);
    return board;
  }

  /** Feed a (secret-redacted) hook event. Returns true if the board changed. */
  ingest(raw: QuestEvent, now: number): boolean {
    const sid = str(raw.session_id);
    const name = str(raw.hook_event_name);
    if (!sid || name !== "PostToolUse" || str(raw.agent_id)) return false;
    const tool = str(raw.tool_name);
    if (tool !== "TodoWrite" && tool !== "TaskCreate" && tool !== "TaskUpdate") return false;
    const input = obj(raw.tool_input);
    const board = this.board(sid, now);
    board.endedAt = null;
    if (str(raw.cwd)) board.cwd = str(raw.cwd);
    let changed = false;
    if (tool === "TodoWrite") {
      const list = Array.isArray(input.todos) ? input.todos.slice(0, MAX_QUEST_ITEMS) : [];
      const items: TaskItem[] = [];
      for (const entry of list) {
        const todo = obj(entry);
        const text = clean(todo.content) || clean(todo.activeForm);
        if (!text) continue;
        items.push(makeItem(text, statusOf(todo.status) ?? "pending", todo.activeForm));
      }
      board.items = items;
      changed = true;
    } else if (tool === "TaskCreate") {
      const text = clean(input.subject) || clean(input.description) || clean(input.activeForm);
      board.created++;
      if (text && board.items.length < MAX_QUEST_ITEMS) {
        board.items.push({ ...makeItem(text, "pending", input.activeForm), tid: String(board.created) });
        changed = true;
      }
    } else {
      const tid = str(input.taskId) || str(input.task_id) || str(input.id);
      const index = board.items.findIndex((item) => item.tid === tid);
      if (tid && index >= 0) {
        const item = board.items[index];
        if (input.status === "deleted") board.items.splice(index, 1);
        else {
          const text = clean(input.subject) || item.text;
          const status = statusOf(input.status) ?? item.status;
          board.items[index] = { ...makeItem(text, status, input.activeForm || item.form), tid };
        }
        changed = true;
      }
    }
    if (changed) board.updatedAt = now;
    return changed;
  }

  /** the session is gone: its board stays for the grace, then sweep drops it */
  dropSession(sid: string, now: number): void {
    const board = this.sessions.get(sid);
    if (board) board.endedAt = now;
  }

  /** drop ended / idle boards; true iff a visible board went away */
  sweep(now: number): boolean {
    let removed = false;
    for (const [sid, board] of this.sessions) {
      const gone =
        (board.endedAt !== null && now - board.endedAt > QUEST_END_GRACE_MS) ||
        now - board.updatedAt > QUEST_IDLE_TTL_MS;
      if (!gone) continue;
      this.sessions.delete(sid);
      if (board.items.length) removed = true;
    }
    return removed;
  }

  /** boards that have at least one item, most recently updated first */
  rows(): QuestRow[] {
    const out: QuestRow[] = [];
    for (const board of this.sessions.values()) {
      if (!board.items.length) continue;
      out.push({
        sid: board.sid,
        project: projectOf(board.cwd),
        updatedAt: board.updatedAt,
        items: board.items.map(({ text, status, active }) => (active ? { text, status, active } : { text, status })),
      });
    }
    return out.sort((first, second) => second.updatedAt - first.updatedAt);
  }

  size(): number {
    return this.sessions.size;
  }
}
