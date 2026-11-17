import { isForeignOrigin, snapshot, subscribe } from "@/lib/store";

export function GET(req: Request) {
  if (isForeignOrigin(req)) return new Response("forbidden", { status: 403 });
  const encoder = new TextEncoder();
  let unsubscribe = () => {};
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (chunk: string) => controller.enqueue(encoder.encode(chunk));
      send(`event: snapshot\ndata: ${JSON.stringify(snapshot())}\n\n`);
      const off = subscribe(send);
      unsubscribe = () => {
        off();
        try {
          controller.close();
        } catch {}
      };
      req.signal.addEventListener("abort", unsubscribe);
    },
    cancel() {
      unsubscribe();
    },
  });
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
