/**
 * Which AI an adventurer belongs to: the agent tool (claude / codex / copilot / cursor) plus the model it runs.
 * Pure helpers shared by the roster badge, the canvas plate and the tests.
 */
export type AiSource = "claude" | "codex" | "copilot" | "cursor";

export const AI_SOURCES: readonly AiSource[] = ["claude", "codex", "copilot", "cursor"];

export interface AiInfo {
  source: AiSource;
  /** raw model id as the tool reported it (null = unknown) */
  model: string | null;
  /** display name, e.g. "Opus 5.5" or "Codex · gpt-5-codex" */
  label: string;
  /** uppercase ASCII form for the pixel font, e.g. "OPUS 5.5" */
  short: string;
}

const TOOL_NAME: Record<AiSource, string> = {
  claude: "Claude",
  codex: "Codex",
  copilot: "Copilot",
  cursor: "Cursor",
};
/** fixed accent per tool (warm orange, teal, violet, light neutral); all light enough for dark ink text on top */
const ACCENT: Record<AiSource, string> = {
  claude: "#e8864a",
  codex: "#3fc3a8",
  copilot: "#a58bf0",
  cursor: "#e6e6ee",
};
/** text colour that reads on every accent above */
export const AI_ACCENT_INK = "#1b1410";

const CLAUDE_FAMILIES = ["opus", "sonnet", "haiku", "fable"];
/** a model id longer than this is cut (with an ellipsis) in the label */
const MODEL_MAX = 18;
const SHORT_MAX = 12;
const DATE_DIGITS = 8;
const VERSION_DIGITS_MAX = 2;

const capitalize = (word: string) => word.charAt(0).toUpperCase() + word.slice(1);
const trimTo = (text: string, max: number) => (text.length > max ? `${text.slice(0, max - 1)}…` : text);

export const aiAccent = (source: AiSource): string => ACCENT[source] ?? ACCENT.claude;

export const isAiSource = (value: unknown): value is AiSource => AI_SOURCES.includes(value as AiSource);

/** "claude-opus-5-5" -> { family: "opus", version: "5.5" }; null when the id is not a known Claude family */
const parseClaude = (model: string): { family: string; version: string } | null => {
  const tokens = model
    .toLowerCase()
    .replace(/\[.*?\]/g, "")
    .split(/[-_\s.]+/)
    .filter(Boolean);
  const family = tokens.find((token) => CLAUDE_FAMILIES.includes(token));
  if (!family) return null;
  const numbers = tokens.filter(
    (token) => /^\d+$/.test(token) && token.length <= VERSION_DIGITS_MAX && token.length !== DATE_DIGITS,
  );
  return { family, version: numbers.join(".") };
};

/** "Opus 5.5", "Codex", "Codex · gpt-5-codex" */
export const aiLabel = (source: AiSource, model: string | null | undefined): string => {
  const raw = (model ?? "").trim();
  if (!raw) return TOOL_NAME[source] ?? capitalize(String(source));
  if (source === "claude") {
    const parsed = parseClaude(raw);
    if (parsed) return parsed.version ? `${capitalize(parsed.family)} ${parsed.version}` : capitalize(parsed.family);
    return trimTo(raw, MODEL_MAX);
  }
  return `${TOOL_NAME[source] ?? capitalize(String(source))} · ${trimTo(raw, MODEL_MAX)}`;
};

/** uppercase ASCII for the canvas font: "OPUS 5.5", "SONNET 4.5", "CODEX" (non-Claude tools show the tool name only) */
export const aiShort = (source: AiSource, model: string | null | undefined): string => {
  const raw = (model ?? "").trim();
  if (source === "claude" && raw) {
    const parsed = parseClaude(raw);
    if (parsed) return `${parsed.family.toUpperCase()}${parsed.version ? ` ${parsed.version}` : ""}`;
  }
  return (TOOL_NAME[source] ?? String(source))
    .toUpperCase()
    .replace(/[^A-Z0-9 .]/g, "")
    .slice(0, SHORT_MAX);
};

export const aiInfo = (source: AiSource, model: string | null | undefined): AiInfo => ({
  source,
  model: model?.trim() ? model.trim() : null,
  label: aiLabel(source, model),
  short: aiShort(source, model),
});
