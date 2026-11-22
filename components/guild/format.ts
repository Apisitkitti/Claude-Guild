export const isNum = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n);

export const fmtTok = (n: number) => (n >= 1e6 ? `${+(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${Math.round(n / 1e3)}k` : String(n));

const EVT_ICON: Record<string, string> = {
  Read: "📖", Grep: "🔎", Glob: "🔎", LS: "📂", Edit: "✏️", Write: "✏️", MultiEdit: "✏️", NotebookEdit: "✏️",
  Bash: "💻", WebFetch: "🌐", WebSearch: "🌐", TodoWrite: "📝", TaskCreate: "📝", TaskUpdate: "📝",
  Agent: "🤖", Task: "🤖", Workflow: "🤖", SubagentStart: "🛡️", SubagentStop: "🛡️",
  Notification: "🔔", Clash: "⚔️", PermissionRequest: "❗", SessionStart: "📜", SessionEnd: "🏰", PreCompact: "🗜️", UserPromptSubmit: "💬", Stop: "⏹️", ใบเสร็จ: "📜",
};
export const iconFor = (kind: string) => EVT_ICON[kind] ?? (kind.startsWith("mcp__") ? "🔌" : "•");

const pad2 = (n: number) => String(n).padStart(2, "0");
export const hms = (t: number) => { const d = new Date(t); return `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`; };

export function ageText(since: number, now: number): string {
  const s = Math.max(0, Math.round((now - since) / 1000));
  if (s < 60) return `รอ ${s} วินาที`;
  const m = Math.floor(s / 60);
  return m < 60 ? `รอ ${m} นาที` : `รอ ${Math.floor(m / 60)} ชม. ${m % 60} นาที`;
}

export function agoText(at: number, now: number): string {
  const s = Math.max(0, Math.round((now - at) / 1000));
  if (s < 60) return `เมื่อ ${s} วินาทีที่แล้ว`;
  const m = Math.floor(s / 60);
  return m < 60 ? `เมื่อ ${m} นาทีที่แล้ว` : `เมื่อ ${Math.floor(m / 60)} ชม. ${m % 60} นาทีที่แล้ว`;
}
