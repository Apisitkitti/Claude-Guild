import type { AgentSource, NormalizedEvent, RawEvent } from "@/lib/adapters/types";
import { SESSION_SUFFIX } from "@/lib/adapters/types";

/** Own-property lookup only: `constructor`, `toString`, `__proto__` ... must never resolve to inherited members. */
export const own = <T>(table: Record<string, T>, key: string): T | undefined =>
  Object.hasOwn(table, key) ? table[key] : undefined;

const UNSAFE_KEYS = new Set(["__proto__", "constructor", "prototype"]);

/** Shallow copy without prototype-polluting keys. */
export const safeCopy = (value: RawEvent): RawEvent => {
  const out: RawEvent = {};
  for (const [key, item] of Object.entries(value)) if (!UNSAFE_KEYS.has(key)) out[key] = item;
  return out;
};

export const str = (value: unknown): string => (typeof value === "string" ? value : "");

/** Object view of a value; a JSON string holding an object is parsed (some tools send tool args as a string). */
export const obj = (value: unknown): RawEvent => {
  if (value && typeof value === "object" && !Array.isArray(value)) return value as RawEvent;
  if (typeof value === "string" && value.trimStart().startsWith("{")) {
    try {
      const parsed: unknown = JSON.parse(value);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed as RawEvent;
    } catch {}
  }
  return {};
};

/** First non-empty string among the given keys. */
export const pick = (raw: RawEvent, ...keys: string[]): string => {
  for (const key of keys) {
    const value = str(raw[key]);
    if (value) return value;
  }
  return "";
};

const INPUT_RENAMES: Record<string, string> = {
  path: "file_path",
  filePath: "file_path",
  target_file: "file_path",
  old_str: "old_string",
  new_str: "new_string",
  file_text: "content",
};

/** tool_input with other tools' field names renamed to Claude Code's (file_path, old_string, new_string, content). */
export const normalizeInput = (value: unknown): RawEvent => {
  const input = obj(value);
  const out: RawEvent = {};
  for (const [key, item] of Object.entries(safeCopy(input))) {
    const renamed = own(INPUT_RENAMES, key);
    if (renamed && input[renamed] === undefined) out[renamed] = item;
    else out[key] = item;
  }
  return out;
};

/** Final event: native session id gets the source suffix, undefined fields are dropped, agent_source is set. */
export const build = (
  source: Exclude<AgentSource, "claude">,
  nativeSessionId: string,
  hookEventName: string,
  fields: RawEvent,
): NormalizedEvent | null => {
  if (!nativeSessionId || !hookEventName) return null;
  const out: RawEvent = {};
  for (const [key, value] of Object.entries(safeCopy(fields)))
    if (value !== undefined && value !== "") out[key] = value;
  return {
    ...out,
    session_id: nativeSessionId + SESSION_SUFFIX[source],
    hook_event_name: hookEventName,
    agent_source: source,
  };
};
