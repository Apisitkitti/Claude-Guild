import { MS_PER_SECOND } from "@/lib/constants";
import { commandShape, commitKind, EDIT_TOOLS, fnv, obj, projectOf, runnerOf, str } from "@/lib/receipts";
// Daily chronicle: "what did the guild get done today / yesterday?". Server-side tracker that aggregates hook events per
// LOCAL calendar day (server time; the day rolls over at midnight, only today + yesterday are kept).
// Outcome parsing (commit / test runner / project name) is shared with lib/receipts.ts. Privacy: only counters, short file
// hashes and the (already secret-redacted) project folder names are kept, in memory only. Hooks are async: numbers are
// "as the hooks reported". Pure + injectable `now` (like ReceiptTracker).

// ---- tuning knobs ----
const HOURS_PER_DAY = 24;
/** tools listed in a day's breakdown */
export const TOP_TOOLS = 8;
/** distinct projects / files / sessions / loops remembered per day */
export const MAX_PROJECTS = 30;
export const MAX_FILES_PER_DAY = 5000;
export const MAX_SESSIONS_PER_DAY = 500;
export const MAX_LOOPS_PER_DAY = 200;
/** per-session runner / id / task bookkeeping */
const MAX_STATE_SESSIONS = 200;
const MAX_IDS = 60;
const MAX_RUNNERS = 8;
const MAX_TASK_IDS = 200;
const MAX_TODOS = 200;
const MAX_TODO_OWNERS = 20;
const DAY_KEY_PAD = 2;
const MONTH_OFFSET = 1;
const THROTTLE_SECONDS = 5;
/** the store sends the chronicle at most this often */
export const CHRONICLE_THROTTLE_MS = THROTTLE_SECONDS * MS_PER_SECOND;

export type ChronicleDay = {
  /** local calendar day, YYYY-MM-DD */
  date: string;
  sessions: number;
  projects: string[];
  prompts: number;
  toolCalls: number;
  tools: { tool: string; count: number }[];
  files: number;
  recovered: number;
  commits: number;
  tasks: number;
  loops: number;
  longestSessionMs: number;
  /** local hour 0-23 with the most activity, null on a quiet day */
  busiestHour: number | null;
};
export type ChronicleSnapshot = { today: ChronicleDay; yesterday: ChronicleDay };

type Day = {
  date: string;
  sessions: Map<string, { first: number; last: number }>;
  projects: Set<string>;
  prompts: number;
  tools: Map<string, number>;
  files: Set<string>;
  recovered: number;
  commits: number;
  tasks: number;
  loops: Set<string>;
  hours: number[];
};
type SessionState = {
  cwd: string;
  runners: Map<string, "red" | "green">;
  ids: string[];
  todoDone: Map<string, number>;
  taskIds: Set<string>;
};

const pad = (value: number): string => String(value).padStart(DAY_KEY_PAD, "0");
/** local calendar day key of a timestamp */
export const dayKey = (time: number): string => {
  const date = new Date(time);
  return `${date.getFullYear()}-${pad(date.getMonth() + MONTH_OFFSET)}-${pad(date.getDate())}`;
};
/** the same local time one calendar day earlier */
const previousDayTime = (time: number): number => {
  const date = new Date(time);
  date.setDate(date.getDate() - 1);
  return date.getTime();
};

const newDay = (date: string): Day => ({
  date,
  sessions: new Map(),
  projects: new Set(),
  prompts: 0,
  tools: new Map(),
  files: new Set(),
  recovered: 0,
  commits: 0,
  tasks: 0,
  loops: new Set(),
  hours: new Array<number>(HOURS_PER_DAY).fill(0),
});

const viewOf = (day: Day): ChronicleDay => {
  let toolCalls = 0;
  for (const count of day.tools.values()) toolCalls += count;
  let longestSessionMs = 0;
  for (const span of day.sessions.values()) longestSessionMs = Math.max(longestSessionMs, span.last - span.first);
  let busiestHour: number | null = null;
  let best = 0;
  day.hours.forEach((count, hour) => {
    if (count > best) {
      best = count;
      busiestHour = hour;
    }
  });
  return {
    date: day.date,
    sessions: day.sessions.size,
    projects: [...day.projects],
    prompts: day.prompts,
    toolCalls,
    tools: [...day.tools.entries()]
      .sort((first, second) => second[1] - first[1] || first[0].localeCompare(second[0]))
      .slice(0, TOP_TOOLS)
      .map(([tool, count]) => ({ tool, count })),
    files: day.files.size,
    recovered: day.recovered,
    commits: day.commits,
    tasks: day.tasks,
    loops: day.loops.size,
    longestSessionMs,
    busiestHour,
  };
};

export type ChronicleEvent = {
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

export class ChronicleTracker {
  private days = new Map<string, Day>();
  private states = new Map<string, SessionState>();

  /** the day bucket of `now`, creating it and dropping days older than yesterday (midnight rollover) */
  private day(now: number): Day {
    const key = dayKey(now);
    let day = this.days.get(key);
    if (!day) {
      day = newDay(key);
      this.days.set(key, day);
      const keep = new Set([key, dayKey(previousDayTime(now))]);
      for (const other of [...this.days.keys()]) if (!keep.has(other)) this.days.delete(other);
    }
    return day;
  }

  private state(sid: string): SessionState {
    let state = this.states.get(sid);
    if (state) this.states.delete(sid);
    else state = { cwd: "", runners: new Map(), ids: [], todoDone: new Map(), taskIds: new Set() };
    this.states.set(sid, state);
    if (this.states.size > MAX_STATE_SESSIONS) this.states.delete(this.states.keys().next().value as string);
    return state;
  }

  private touch(day: Day, sid: string, state: SessionState, now: number): void {
    const span = day.sessions.get(sid);
    if (span) span.last = now;
    else if (day.sessions.size < MAX_SESSIONS_PER_DAY) day.sessions.set(sid, { first: now, last: now });
    if (state.cwd && day.projects.size < MAX_PROJECTS) day.projects.add(projectOf(state.cwd));
    day.hours[new Date(now).getHours()]++;
  }

  /** Feed a (secret-redacted) hook event. Command text is analysed and thrown away. */
  ingest(raw: ChronicleEvent, now: number): void {
    const sid = str(raw.session_id);
    const name = str(raw.hook_event_name);
    if (!sid || !name) return;
    const agent = str(raw.agent_id);
    const day = this.day(now);
    const state = this.state(sid);
    if (str(raw.cwd)) state.cwd = str(raw.cwd);
    if (name === "SessionStart" || name === "Stop" || name === "SessionEnd") {
      if (!agent) this.touch(day, sid, state, now);
      return;
    }
    if (name === "UserPromptSubmit") {
      if (agent) return;
      day.prompts++;
      this.touch(day, sid, state, now);
      return;
    }
    if (name !== "PostToolUse" && name !== "PostToolUseFailure") return;
    const tool = str(raw.tool_name);
    if (!tool) return;
    const failed = name === "PostToolUseFailure";
    if (failed && raw.is_interrupt === true) return;
    const id = str(raw.tool_use_id);
    if (id) {
      if (state.ids.includes(id)) return;
      state.ids.push(id);
      if (state.ids.length > MAX_IDS) state.ids.shift();
    }
    this.touch(day, sid, state, now);
    day.tools.set(tool, (day.tools.get(tool) ?? 0) + 1);
    const input = obj(raw.tool_input);
    if (EDIT_TOOLS.has(tool)) {
      const file = str(input.file_path) || str(input.notebook_path);
      if (!failed && file && day.files.size < MAX_FILES_PER_DAY) day.files.add(fnv(file));
    } else if (tool === "Bash") {
      const cmd = str(input.command);
      if (cmd && input.run_in_background !== true) this.bash(day, state, cmd, failed);
    } else if (!failed && tool === "TaskUpdate") {
      if (str(input.status) !== "completed") return;
      const tid = str(input.taskId) || str(input.task_id) || str(input.id);
      if (tid && state.taskIds.has(tid)) return;
      if (tid) {
        state.taskIds.add(tid);
        if (state.taskIds.size > MAX_TASK_IDS) state.taskIds.delete(state.taskIds.values().next().value as string);
      }
      day.tasks++;
    } else if (!failed && tool === "TodoWrite") {
      const todos = Array.isArray(input.todos) ? input.todos.slice(0, MAX_TODOS) : [];
      let done = 0;
      for (const todo of todos) if (obj(todo).status === "completed") done++;
      const who = agent || "main";
      const delta = Math.max(0, done - (state.todoDone.get(who) ?? 0));
      state.todoDone.delete(who);
      state.todoDone.set(who, done);
      if (state.todoDone.size > MAX_TODO_OWNERS) state.todoDone.delete(state.todoDone.keys().next().value as string);
      day.tasks += delta;
    }
  }

  private bash(day: Day, state: SessionState, cmd: string, failed: boolean): void {
    const shape = commandShape(cmd);
    if (!shape.ok || !shape.segments.length) return;
    if (!failed && commitKind(shape.segments) === "commit") day.commits++;
    const runner = runnerOf(shape.segments[shape.segments.length - 1]);
    if (!runner) return;
    const key = state.cwd + "\0" + runner;
    const prev = state.runners.get(key);
    state.runners.delete(key);
    state.runners.set(key, failed ? "red" : "green");
    if (!failed && prev === "red") day.recovered++;
    while (state.runners.size > MAX_RUNNERS) state.runners.delete(state.runners.keys().next().value as string);
  }

  /** remember loop rows of the Lookout Bell queue (kind "loop") as today's loops; distinct by row key */
  noteLoops(rows: { key: string; kind: string }[], now: number): void {
    const day = this.day(now);
    for (const row of rows) if (row.kind === "loop" && day.loops.size < MAX_LOOPS_PER_DAY) day.loops.add(fnv(row.key));
  }

  /** today + yesterday (yesterday is all zeros when nothing was recorded) */
  view(now: number): ChronicleSnapshot {
    const today = this.day(now);
    const yesterdayKey = dayKey(previousDayTime(now));
    return { today: viewOf(today), yesterday: viewOf(this.days.get(yesterdayKey) ?? newDay(yesterdayKey)) };
  }
}
