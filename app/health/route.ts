import { connection } from "next/server";

import { MS_PER_SECOND } from "@/lib/constants";
import { store } from "@/lib/store";

export async function GET() {
  await connection(); // opt out of prerendering
  return Response.json({
    ok: true,
    sessions: store.sessions.size,
    clients: store.clients.size,
    uptime: Math.round((Date.now() - store.startedAt) / MS_PER_SECOND),
  });
}
