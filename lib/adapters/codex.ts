import type { NormalizeHints, NormalizedEvent, RawEvent } from "@/lib/adapters/types";
import { build, obj, own, pick, safeCopy, str } from "@/lib/adapters/util";

// OpenAI Codex CLI: hooks.json, payload already Claude-like (session_id, cwd, hook_event_name, tool_name, tool_input...).

/** events with the same name and meaning as Claude Code's */
const SAME = new Set([
  "SessionStart",
  "SessionEnd",
  "UserPromptSubmit",
  "PreToolUse",
  "PermissionRequest",
  "PostToolUse",
  "PreCompact",
  "SubagentStart",
  "SubagentStop",
  "Stop",
]);
/** the turn was cut short: closest Claude event is Stop */
const RENAMED: Record<string, string> = { Interrupt: "Stop" };

const PATCH_FILE = /^\*\*\* (?:Update|Add|Delete) File: (.+)$/m;

/** apply_patch carries a patch text; surface the first file as an Edit so territory / receipts see the change. */
const patchFile = (toolInput: unknown): string => {
  const input = obj(toolInput);
  const text = typeof toolInput === "string" ? toolInput : str(input.command) || str(input.input) || str(input.patch);
  return PATCH_FILE.exec(text)?.[1]?.trim() ?? "";
};

const failureOf = (toolName: string, response: unknown): string | null => {
  if (toolName !== "Bash") return null;
  const res = obj(response);
  const code = res.exit_code ?? res.exitCode;
  if (typeof code !== "number" || code === 0) return null;
  return pick(res, "stderr", "output", "stdout") || `Exit code ${code}`;
};

export const normalizeCodex = (raw: RawEvent, hints: NormalizeHints = {}): NormalizedEvent | null => {
  const name = str(raw.hook_event_name) || str(hints.event);
  const renamed = own(RENAMED, name);
  const mapped = renamed ?? name;
  if (!SAME.has(mapped) && !renamed) return null;
  let eventName = mapped;
  let toolName = str(raw.tool_name);
  let toolInput: unknown = obj(raw.tool_input);
  let error: string | undefined;
  if (toolName === "apply_patch") {
    const file = patchFile(raw.tool_input);
    toolName = "Edit";
    toolInput = file ? { file_path: file } : {};
  }
  if (eventName === "PostToolUse") {
    const failure = failureOf(toolName, raw.tool_response);
    if (failure !== null) {
      eventName = "PostToolUseFailure";
      error = failure;
    }
  }
  return build("codex", str(raw.session_id), eventName, {
    cwd: raw.cwd,
    source: raw.source,
    trigger: raw.trigger,
    prompt: raw.prompt,
    tool_name: toolName,
    tool_use_id: raw.tool_use_id,
    tool_input: toolName ? safeCopy(obj(toolInput)) : undefined,
    tool_response: raw.tool_response,
    error,
    agent_id: raw.agent_id,
    agent_type: raw.agent_type,
    last_assistant_message: raw.last_assistant_message,
  });
};
