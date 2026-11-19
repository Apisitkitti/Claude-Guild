import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { guard } from "@/lib/guildAuth";
import { readLimited } from "@/lib/http";
import { claim, guildJoin, guildLeave, guildStatus, release, schemas, shout, whoHolds, type ToolResult } from "@/lib/mcp/tools";

const MAX_BODY = 256 * 1024; // bytes

// Stateless Streamable HTTP MCP endpoint: a fresh server + transport per request.

const wrap = (fn: (i: unknown) => ToolResult) => async (input: unknown) => {
  const r = fn(input);
  return { content: [{ type: "text" as const, text: r.text }], isError: !r.ok };
};

function buildServer(): McpServer {
  const server = new McpServer({ name: "claude-guild", version: "1.0.0" });
  server.registerTool("guild_join", { description: "Join the team guild so teammates see you and can coordinate with you. Call once at the start of a session with a short unique handle.", inputSchema: schemas.guild_join }, wrap(guildJoin));
  server.registerTool("guild_status", { description: "See who is in the guild, what they are doing, which files are claimed, and any conflicts.", inputSchema: schemas.guild_status }, wrap(() => guildStatus()));
  server.registerTool("who_holds", { description: "Check which teammates are editing or recently touched a file. Call BEFORE editing any shared file.", inputSchema: schemas.who_holds }, wrap(whoHolds));
  server.registerTool("claim", { description: "Claim files you are about to edit so teammates are warned. Reports conflicts with other holders. Release when done.", inputSchema: schemas.claim }, wrap(claim));
  server.registerTool("release", { description: "Release your file claims (all, or only the given files) when you finish editing.", inputSchema: schemas.release }, wrap(release));
  server.registerTool("shout", { description: "Show a short message (max 140 chars) to the whole guild, e.g. 'refactoring auth, avoid lib/auth'.", inputSchema: schemas.shout }, wrap(shout));
  server.registerTool("guild_leave", { description: "Leave the guild when your session is finished.", inputSchema: schemas.guild_leave }, wrap(guildLeave));
  return server;
}

export async function POST(req: Request) {
  const denied = guard(req);
  if (denied) return denied;
  const text = await readLimited(req, MAX_BODY);
  if (text === null) return new Response("payload too large", { status: 413 });
  const server = buildServer();
  const transport = new WebStandardStreamableHTTPServerTransport({ enableJsonResponse: true });
  await server.connect(transport);
  try {
    // the body was consumed by readLimited: hand the transport the already-read text
    const headers = new Headers(req.headers);
    headers.delete("content-length");
    return await transport.handleRequest(new Request(req.url, { method: "POST", headers, body: text }));
  } finally {
    // Response is fully buffered in JSON mode; release resources.
    void transport.close();
    void server.close();
  }
}

const notAllowed = (req: Request) => {
  const denied = guard(req);
  if (denied) return denied;
  return Response.json({ jsonrpc: "2.0", error: { code: -32000, message: "Method not allowed (stateless server)" }, id: null }, { status: 405, headers: { Allow: "POST" } });
};
export const GET = notAllowed;
export const DELETE = notAllowed;
