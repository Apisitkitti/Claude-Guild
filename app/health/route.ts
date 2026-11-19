import { connection } from "next/server";
import { guard } from "@/lib/guildAuth";
import { store } from "@/lib/store";

export async function GET(req: Request) {
  const denied = guard(req);
  if (denied) return denied;
  await connection(); // opt out of prerendering
  return Response.json(
    { ok: true, sessions: store.sessions.size, clients: store.clients.size, uptime: Math.round((Date.now() - store.startedAt) / 1000) }
  );
}
