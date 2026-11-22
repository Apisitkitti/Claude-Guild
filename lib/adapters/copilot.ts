import type { NormalizeHints, NormalizedEvent, RawEvent } from "@/lib/adapters/types";
import { build, normalizeInput, obj, own, pick, str } from "@/lib/adapters/util";

// GitHub Copilot CLI: camelCase events + camelCase payload (sessionId, toolName, toolArgs, toolResult...) or
// PascalCase events + snake_case payload (session_id, tool_name, tool_input, tool_result...).

/** lower-cased event name -> Claude Code event */
const EVENTS: Record<string, string> = {
  sessionstart: "SessionStart",
  sessionend: "SessionEnd",
  userpromptsubmitted: "UserPromptSubmit",
  userpromptsubmit: "UserPromptSubmit",
  pretooluse: "PreToolUse",
  posttooluse: "PostToolUse",
  posttoolusefailure: "PostToolUseFailure",
  agentstop: "Stop",
  stop: "Stop",
  subagentstart: "SubagentStart",
  subagentstop: "SubagentStop",
  precompact: "PreCompact",
  notification: "Notification",
  permissionrequest: "PermissionRequest",
};

/** Copilot tool name (lower-cased) -> Claude Code tool name; unknown tools keep their name */
const TOOLS: Record<string, string> = {
  bash: "Bash",
  powershell: "Bash",
  shell: "Bash",
  view: "Read",
  read: "Read",
  edit: "Edit",
  str_replace: "Edit",
  str_replace_editor: "Edit",
  create: "Write",
  write: "Write",
  grep: "Grep",
  glob: "Glob",
  task: "Task",
};

const FAILED_RESULTS = new Set(["failure", "error"]);

export const normalizeCopilot = (raw: RawEvent, hints: NormalizeHints = {}): NormalizedEvent | null => {
  const given = str(raw.hook_event_name) || str(hints.event);
  let eventName = own(EVENTS, given.toLowerCase());
  if (!eventName) return null;
  const toolRaw = pick(raw, "tool_name", "toolName");
  const toolName = toolRaw ? (own(TOOLS, toolRaw.toLowerCase()) ?? toolRaw) : "";
  const result = obj(raw.tool_result ?? raw.toolResult);
  const resultType = (str(result.result_type) || str(result.resultType)).toLowerCase();
  let error = raw.error === undefined ? "" : typeof raw.error === "string" ? raw.error : str(obj(raw.error).message);
  if (eventName === "PostToolUse" && FAILED_RESULTS.has(resultType)) {
    eventName = "PostToolUseFailure";
    error = pick(result, "text_result_for_llm", "textResultForLlm") || resultType;
  }
  const isSubagentEvent = eventName === "SubagentStart" || eventName === "SubagentStop";
  // SubagentStart only has the agent NAME while SubagentStop has id + name: key both on the name so the intern is
  // removed again. Tool events inside a subagent carry the id.
  const agentId = isSubagentEvent
    ? pick(raw, "agent_name", "agentName", "agent_id", "agentId")
    : pick(raw, "agent_id", "agentId");
  return build("copilot", pick(raw, "session_id", "sessionId"), eventName, {
    cwd: raw.cwd,
    source: raw.source,
    prompt: raw.prompt,
    trigger: raw.trigger,
    message: raw.message,
    notification_type: raw.notification_type,
    tool_name: toolName,
    tool_input: toolName ? normalizeInput(raw.tool_input ?? raw.toolArgs) : undefined,
    error,
    agent_id: agentId,
    agent_type: pick(raw, "agent_type", "agentType"),
    last_assistant_message: pick(raw, "last_assistant_message", "response"),
  });
};
