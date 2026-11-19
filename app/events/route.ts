import { authorize } from "@/lib/guildAuth";
import { readLimited } from "@/lib/http";
import { addEvent, MCP_PREFIX } from "@/lib/store";

const MAX_BODY = 1024 * 1024; // bytes

export async function POST(req: Request) {
  const access = authorize(req);
  if (!access.ok) return new Response("forbidden", { status: 403 });
  // Requiring application/json forces a CORS preflight for cross-origin browser requests (which we never allow).
  if (!req.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    return new Response("content-type must be application/json", { status: 415 });
  }
  const text = await readLimited(req, MAX_BODY);
  if (text === null) return new Response("payload too large", { status: 413 });
  let evt: unknown;
  try {
    evt = JSON.parse(text);
  } catch {
    return new Response("bad json", { status: 400 });
  }
  if (!evt || typeof evt !== "object" || Array.isArray(evt)) {
    return new Response("bad json", { status: 400 });
  }
  // MCP members exist only through the MCP tools: a remote caller must not forge or hijack them via hooks.
  if (access.remote && String((evt as Record<string, unknown>).session_id ?? "").startsWith(MCP_PREFIX)) return new Response("forbidden", { status: 403 });
  addEvent(evt as Record<string, unknown>);
  return new Response(null, { status: 204 });
}
