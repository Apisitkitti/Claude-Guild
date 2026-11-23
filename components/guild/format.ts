import { MINUTES_PER_HOUR, MS_PER_SECOND, SECONDS_PER_MINUTE, TOKENS_PER_K, TOKENS_PER_M } from "@/lib/constants";
import { KIND_CLASH, KIND_LORD, KIND_RECEIPT } from "@/lib/office/engine";
import { m } from "@/paraglide/messages";

export const isNum = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);

export const fmtTok = (tokens: number) =>
  tokens >= TOKENS_PER_M
    ? `${+(tokens / TOKENS_PER_M).toFixed(1)}M`
    : tokens >= TOKENS_PER_K
      ? `${Math.round(tokens / TOKENS_PER_K)}k`
      : String(tokens);

const EVT_ICON: Record<string, string> = {
  Read: "📖",
  Grep: "🔎",
  Glob: "🔎",
  LS: "📂",
  Edit: "✏️",
  Write: "✏️",
  MultiEdit: "✏️",
  NotebookEdit: "✏️",
  Bash: "💻",
  WebFetch: "🌐",
  WebSearch: "🌐",
  TodoWrite: "📝",
  TaskCreate: "📝",
  TaskUpdate: "📝",
  Agent: "🤖",
  Task: "🤖",
  Workflow: "🤖",
  SubagentStart: "🛡️",
  SubagentStop: "🛡️",
  Notification: "🔔",
  [KIND_CLASH]: "⚔️",
  PermissionRequest: "❗",
  SessionStart: "📜",
  SessionEnd: "🏰",
  PreCompact: "🗜️",
  UserPromptSubmit: "💬",
  Stop: "⏹️",
  [KIND_RECEIPT]: "📜",
  [KIND_LORD]: "👑",
};
export const iconFor = (kind: string) => EVT_ICON[kind] ?? (kind.startsWith("mcp__") ? "🔌" : "•");

const pad2 = (value: number) => String(value).padStart(2, "0");
export const hms = (time: number) => {
  const date = new Date(time);
  return `${pad2(date.getHours())}:${pad2(date.getMinutes())}:${pad2(date.getSeconds())}`;
};

/** a duration split into the largest fitting unit(s) */
const parts = (ms: number) => {
  const seconds = Math.max(0, Math.round(ms / MS_PER_SECOND));
  const minutes = Math.floor(seconds / SECONDS_PER_MINUTE);
  return { seconds, minutes, hours: Math.floor(minutes / MINUTES_PER_HOUR), restMinutes: minutes % MINUTES_PER_HOUR };
};

export const ageText = (since: number, now: number): string => {
  const { seconds, minutes, hours, restMinutes } = parts(now - since);
  if (seconds < SECONDS_PER_MINUTE) return m.age_wait_seconds({ s: seconds });
  return minutes < MINUTES_PER_HOUR
    ? m.age_wait_minutes({ min: minutes })
    : m.age_wait_hours({ h: hours, min: restMinutes });
};

export const agoText = (at: number, now: number): string => {
  const { seconds, minutes, hours, restMinutes } = parts(now - at);
  if (seconds < SECONDS_PER_MINUTE) return m.age_ago_seconds({ s: seconds });
  return minutes < MINUTES_PER_HOUR
    ? m.age_ago_minutes({ min: minutes })
    : m.age_ago_hours({ h: hours, min: restMinutes });
};

/** a length of time in seconds as "45s", "3m 05s" or "1h 12m" in the viewer's language */
export const durText = (totalSeconds: number): string => {
  const seconds = Math.max(0, Math.round(totalSeconds));
  const minutes = Math.floor(seconds / SECONDS_PER_MINUTE);
  if (minutes < 1) return m.dungeon_dur_seconds({ s: seconds });
  return minutes < MINUTES_PER_HOUR
    ? m.dungeon_dur_minutes({ min: minutes, s: seconds % SECONDS_PER_MINUTE })
    : m.dungeon_dur_hours({ h: Math.floor(minutes / MINUTES_PER_HOUR), min: minutes % MINUTES_PER_HOUR });
};

/** quest-log label of an event kind: the two guild-made kinds are worded, hook/tool names stay as they are */
export const kindLabel = (kind: string): string => {
  if (kind === KIND_LORD) return m.log_kind_lord();
  return kind === KIND_RECEIPT ? m.log_kind_receipt() : kind === KIND_CLASH ? m.log_kind_clash() : kind;
};
