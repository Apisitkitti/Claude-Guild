import { BYTES_PER_MB } from "@/lib/constants";
import { addEvent, isForeignOrigin } from "@/lib/store";

const MAX_BODY = BYTES_PER_MB; // bytes

const readLimited = async (req: Request, limit: number): Promise<string | null> => {
  const declared = Number(req.headers.get("content-length"));
  if (declared > limit) return null;
  if (!req.body) return "";
  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > limit) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString("utf8");
};

export const POST = async (req: Request) => {
  if (isForeignOrigin(req)) return new Response("forbidden", { status: 403 });
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
  addEvent(evt as Record<string, unknown>);
  return new Response(null, { status: 204 });
};
