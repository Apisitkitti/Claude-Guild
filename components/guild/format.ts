import { MINUTES_PER_HOUR, MS_PER_SECOND, SECONDS_PER_MINUTE, TOKENS_PER_K, TOKENS_PER_M } from "@/lib/constants";
import { KIND_CLASH, KIND_RECEIPT } from "@/lib/office/engine";
import { m } from "@/paraglide/messages";

export const isNum = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n);

export const fmtTok = (n: number) =>
  n >= TOKENS_PER_M
    ? `${+(n / TOKENS_PER_M).toFixed(1)}M`
    : n >= TOKENS_PER_K
      ? `${Math.round(n / TOKENS_PER_K)}k`
      : String(n);

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
};
export const iconFor = (kind: string) => EVT_ICON[kind] ?? (kind.startsWith("mcp__") ? "🔌" : "•");

const pad2 = (n: number) => String(n).padStart(2, "0");
export const hms = (t: number) => {
  const d = new Date(t);
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
};

/** a duration split into the largest fitting unit(s) */
function parts(ms: number) {
  const s = Math.max(0, Math.round(ms / MS_PER_SECOND));
  const min = Math.floor(s / SECONDS_PER_MINUTE);
  return { s, min, h: Math.floor(min / MINUTES_PER_HOUR), restMin: min % MINUTES_PER_HOUR };
}

export function ageText(since: number, now: number): string {
  const { s, min, h, restMin } = parts(now - since);
  if (s < SECONDS_PER_MINUTE) return m.age_wait_seconds({ s });
  return min < MINUTES_PER_HOUR ? m.age_wait_minutes({ min }) : m.age_wait_hours({ h, min: restMin });
}

export function agoText(at: number, now: number): string {
  const { s, min, h, restMin } = parts(now - at);
  if (s < SECONDS_PER_MINUTE) return m.age_ago_seconds({ s });
  return min < MINUTES_PER_HOUR ? m.age_ago_minutes({ min }) : m.age_ago_hours({ h, min: restMin });
}

/** quest-log label of an event kind: the two guild-made kinds are worded, hook/tool names stay as they are */
export function kindLabel(kind: string): string {
  return kind === KIND_RECEIPT ? m.log_kind_receipt() : kind === KIND_CLASH ? m.log_kind_clash() : kind;
}
