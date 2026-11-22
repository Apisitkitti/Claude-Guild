// Adapters that turn hook payloads from other AI coding agents into the Claude Code hook shape the store expects.
// Field names are based on each tool's public hook docs (2026-11) and have NOT been tested against the real tools.

export const AGENT_SOURCES = ["claude", "codex", "copilot", "cursor"] as const;
export type AgentSource = (typeof AGENT_SOURCES)[number];

export type RawEvent = Record<string, unknown>;

/** Claude Code-shaped event. `agent_source` is absent on Claude's own events (passthrough). */
export type NormalizedEvent = RawEvent & {
  session_id: string;
  hook_event_name: string;
  agent_source?: AgentSource;
};

/** Hints taken from the request (query string) when the payload itself does not say. */
export type NormalizeHints = { event?: string | null };

/**
 * Appended to the native session id so ids from different tools never collide. A SUFFIX (not a prefix) because the UI
 * tags a session with the first characters of its id (`#abc`), which must stay distinct between sessions.
 */
export const SESSION_SUFFIX = { codex: "-cx", copilot: "-cp", cursor: "-cu" } as const;

export const isAgentSource = (value: unknown): value is AgentSource =>
  typeof value === "string" && (AGENT_SOURCES as readonly string[]).includes(value);
