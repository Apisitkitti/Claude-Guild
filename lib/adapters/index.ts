import { normalizeCodex } from "@/lib/adapters/codex";
import { normalizeCopilot } from "@/lib/adapters/copilot";
import { normalizeCursor } from "@/lib/adapters/cursor";
import type { AgentSource, NormalizeHints, NormalizedEvent, RawEvent } from "@/lib/adapters/types";

export { AGENT_SOURCES, SESSION_SUFFIX, isAgentSource } from "@/lib/adapters/types";
export type { AgentSource, NormalizeHints, NormalizedEvent, RawEvent } from "@/lib/adapters/types";

/**
 * Guess the sender when `?source=` is absent. Only unambiguous shapes are claimed; everything else is Claude Code.
 * Cursor: `conversation_id`. Copilot camelCase: `sessionId` and no `session_id`.
 */
export const detectSource = (raw: RawEvent): AgentSource => {
  if (typeof raw.conversation_id === "string") return "cursor";
  if (typeof raw.sessionId === "string" && raw.session_id === undefined) return "copilot";
  return "claude";
};

/** Convert a hook payload from `source` to a Claude Code-shaped event; null = not something the office uses. */
export const normalizeEvent = (
  raw: RawEvent,
  source: AgentSource,
  hints: NormalizeHints = {},
): NormalizedEvent | null => {
  switch (source) {
    case "codex":
      return normalizeCodex(raw, hints);
    case "copilot":
      return normalizeCopilot(raw, hints);
    case "cursor":
      return normalizeCursor(raw, hints);
    case "claude":
      return raw as NormalizedEvent; // unchanged behaviour
  }
};
