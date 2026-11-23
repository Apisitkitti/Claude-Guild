import type { NormalizeHints, NormalizedEvent, RawEvent } from "@/lib/adapters/types";
import { build, normalizeInput, obj, own, pick, str } from "@/lib/adapters/util";

// Cursor: camelCase events, conversation_id as session id, workspace_roots instead of cwd.

/** events that map 1:1 */
const SIMPLE: Record<string, string> = {
  sessionStart: "SessionStart",
  sessionEnd: "SessionEnd",
  beforeSubmitPrompt: "UserPromptSubmit",
  preToolUse: "PreToolUse",
  postToolUse: "PostToolUse",
  postToolUseFailure: "PostToolUseFailure",
  subagentStart: "SubagentStart",
  subagentStop: "SubagentStop",
  stop: "Stop",
  preCompact: "PreCompact",
};

/** Cursor tool name (lower-cased) -> Claude Code tool name */
const TOOLS: Record<string, string> = {
  shell: "Bash",
  run_terminal_cmd: "Bash",
  read: "Read",
  read_file: "Read",
  write: "Write",
  edit: "Edit",
  strreplace: "Edit",
  str_replace: "Edit",
  search_replace: "Edit",
  edit_file: "Edit",
  grep: "Grep",
  glob: "Glob",
  task: "Task",
};

const MCP_PREFIX = /^mcp[:_]\s*/i;
const DEFAULT_MCP_SERVER = "cursor";

const mcpName = (server: string, tool: string): string => `mcp__${server || DEFAULT_MCP_SERVER}__${tool}`;

const toolOf = (raw: RawEvent): string => {
  const given = str(raw.tool_name);
  if (!given) return "";
  if (MCP_PREFIX.test(given)) return mcpName(str(raw.mcp_server_name), given.replace(MCP_PREFIX, ""));
  return own(TOOLS, given.toLowerCase()) ?? given;
};

const cwdOf = (raw: RawEvent): string => {
  const roots = raw.workspace_roots;
  const first = Array.isArray(roots) ? str(roots[0]) : "";
  return str(raw.cwd) || first;
};

type Shape = { event: string; tool?: string; input?: RawEvent; error?: string };

/** Per-event mapping; null = event we do not use. */
const shapeOf = (name: string, raw: RawEvent): Shape | null => {
  const simple = own(SIMPLE, name);
  if (simple) {
    const tool = toolOf(raw);
    const input = tool ? normalizeInput(raw.tool_input) : undefined;
    const error = name === "postToolUseFailure" ? str(raw.error_message) || str(raw.failure_type) : undefined;
    return { event: simple, tool, input, error };
  }
  switch (name) {
    case "beforeShellExecution":
    case "afterShellExecution":
      return {
        event: name === "beforeShellExecution" ? "PreToolUse" : "PostToolUse",
        tool: "Bash",
        input: { command: raw.command },
      };
    case "beforeMCPExecution":
    case "afterMCPExecution":
      return {
        event: name === "beforeMCPExecution" ? "PreToolUse" : "PostToolUse",
        tool: mcpName(str(raw.mcp_server_name), str(raw.tool_name)),
        input: normalizeInput(raw.tool_input),
      };
    case "beforeReadFile":
      return { event: "PreToolUse", tool: "Read", input: { file_path: raw.file_path } };
    case "afterFileEdit": {
      const edits = Array.isArray(raw.edits) ? raw.edits : [];
      const first = obj(edits[0]);
      return {
        event: "PostToolUse",
        tool: "Edit",
        input: { file_path: raw.file_path, old_string: first.old_string, new_string: first.new_string },
      };
    }
    default:
      return null;
  }
};

/**
 * Any unique id Cursor gives (subagent_id on start; tool_call_id). subagentStop may carry neither: then type +
 * generation_id keeps each stop distinct (a bare type would make the engine ignore later stops of the same type).
 * Such a stop cannot match its start, so the intern is not removed by id.
 */
const subagentId = (raw: RawEvent): string => {
  const unique = pick(raw, "subagent_id", "tool_call_id");
  if (unique) return unique;
  const type = str(raw.subagent_type);
  const generation = str(raw.generation_id);
  return type && generation ? `${type}:${generation}` : type;
};

export const normalizeCursor = (raw: RawEvent, hints: NormalizeHints = {}): NormalizedEvent | null => {
  const name = str(raw.hook_event_name) || str(hints.event);
  const shape = shapeOf(name, raw);
  if (!shape) return null;
  const isSubagent = shape.event === "SubagentStart" || shape.event === "SubagentStop";
  return build("cursor", pick(raw, "conversation_id", "session_id"), shape.event, {
    cwd: cwdOf(raw),
    model: raw.model,
    prompt: raw.prompt,
    trigger: raw.trigger,
    tool_name: shape.tool,
    tool_use_id: raw.tool_use_id,
    tool_input: shape.input,
    error: shape.error,
    agent_id: isSubagent ? subagentId(raw) : undefined,
    agent_type: isSubagent ? raw.subagent_type : undefined,
    last_assistant_message: shape.event === "SubagentStop" ? raw.summary : undefined,
  });
};
