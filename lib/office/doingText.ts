/** "now doing" line of an adventurer: what the main agent's current/last tool is working on */

/** longest "now doing" text shown (roster card and canvas name tag) */
export const DOING_TEXT_MAX = 40;
/** longest tool name kept */
const TOOL_MAX = 24;
/** seconds (game clock) without a tool event after which the line is dropped instead of going stale */
export const DOING_IDLE_S = 60;
const MCP_PREFIX = "mcp__";
const MCP_SEP = "__";
const MCP_MIN_PARTS = 2;
const AGENT_TOOL_NAMES = new Set(["Agent", "Task", "Workflow"]);
const CONTROL_CHARS = /[\u0000-\u001f\u007f-\u009f​-‏‪-‮⁦-⁩]/g;

export interface Doing {
  tool: string;
  detail: string;
  at: number;
}

/** a home directory prefix ("/Users/name/", "/home/name/", "C:\\Users\\name\\") shown as "~/" so on-screen lines don't carry the account name */
const HOME_DIR = /(?:\/users\/|\/home\/|[a-z]:[\\/]users[\\/]|\\users\\|-users-)[^/\\\s]+(?=[/\\]|\s|$)/gi;

/** one line: control chars dropped, whitespace collapsed, cut at `max` with an ellipsis */
export const cleanDoingText = (text: string, max = DOING_TEXT_MAX): string => {
  const flat = text.replace(CONTROL_CHARS, " ").replace(HOME_DIR, "~").replace(/\s+/g, " ").trim();
  return flat.length > max ? flat.slice(0, max - 1).trimEnd() + "…" : flat;
};

/** "Edit engine.ts", "Task: review diff", "mcp linear · get_issue" */
export const formatDoing = (tool: string, detail: string): string => {
  const name = cleanDoingText(tool, TOOL_MAX);
  if (!name) return "";
  if (name.startsWith(MCP_PREFIX)) {
    const parts = name.slice(MCP_PREFIX.length).split(MCP_SEP);
    if (parts.length >= MCP_MIN_PARTS) {
      const [server, ...rest] = parts;
      return cleanDoingText(`mcp ${server} · ${rest.join(MCP_SEP)}`);
    }
  }
  const sep = AGENT_TOOL_NAMES.has(name) && detail.trim() ? ": " : " ";
  return cleanDoingText(`${name}${sep}${detail}`);
};

/** the line to show, or null when nothing was done lately */
export const doingLine = (doing: Doing | null, clock: number, pending = false): string | null => {
  if (!doing || (!pending && clock - doing.at > DOING_IDLE_S)) return null; // a tool still running never goes stale
  return formatDoing(doing.tool, doing.detail) || null;
};
