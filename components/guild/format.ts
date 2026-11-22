import { MINUTES_PER_HOUR, MS_PER_SECOND, SECONDS_PER_MINUTE, TOKENS_PER_K, TOKENS_PER_M } from "@/lib/constants";
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
  Clash: "⚔️",
  PermissionRequest: "❗",
  SessionStart: "📜",
  SessionEnd: "🏰",
  PreCompact: "🗜️",
  UserPromptSubmit: "💬",
  Stop: "⏹️",
  ใบเสร็จ: "📜",
};
export const iconFor = (kind: string) => EVT_ICON[kind] ?? (kind.startsWith("mcp__") ? "🔌" : "•");

const pad2 = (n: number) => String(n).padStart(2, "0");
export const hms = (t: number) => {
  const d = new Date(t);
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
};

export function ageText(since: number, now: number): string {
  const s = Math.max(0, Math.round((now - since) / MS_PER_SECOND));
  if (s < SECONDS_PER_MINUTE) return `รอ ${s} วินาที`;
  const m = Math.floor(s / SECONDS_PER_MINUTE);
  return m < MINUTES_PER_HOUR
    ? `รอ ${m} นาที`
    : `รอ ${Math.floor(m / MINUTES_PER_HOUR)} ชม. ${m % MINUTES_PER_HOUR} นาที`;
}

export function agoText(at: number, now: number): string {
  const s = Math.max(0, Math.round((now - at) / MS_PER_SECOND));
  if (s < SECONDS_PER_MINUTE) return `เมื่อ ${s} วินาทีที่แล้ว`;
  const m = Math.floor(s / SECONDS_PER_MINUTE);
  return m < MINUTES_PER_HOUR
    ? `เมื่อ ${m} นาทีที่แล้ว`
    : `เมื่อ ${Math.floor(m / MINUTES_PER_HOUR)} ชม. ${m % MINUTES_PER_HOUR} นาทีที่แล้ว`;
}
