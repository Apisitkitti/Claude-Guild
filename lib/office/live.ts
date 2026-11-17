import type { HookEvt, SnapshotMsg } from "./engine";

export interface LiveHandlers {
  onSnapshot(s: SnapshotMsg): void;
  onEvent(e: HookEvt): void;
  onStatus(s: "open" | "error"): void;
}

export function connectLive(h: LiveHandlers): { close(): void } {
  let es: EventSource | null = null;
  let closed = false;
  let delay = 1000;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const open = () => {
    if (closed) return;
    const src = new EventSource("/events/stream");
    es = src;
    src.onopen = () => { delay = 1000; h.onStatus("open"); };
    src.onerror = () => {
      h.onStatus("error");
      if (src.readyState === 2) { // CLOSED: browser gave up, retry manually with backoff
        src.close();
        if (es === src) es = null;
        if (!closed) { timer = setTimeout(open, delay); delay = Math.min(10000, delay * 2); }
      }
    };
    src.addEventListener("snapshot", (ev) => {
      try { h.onSnapshot(JSON.parse((ev as MessageEvent).data)); } catch { /* ignore bad frame */ }
    });
    src.onmessage = (ev) => {
      try { h.onEvent(JSON.parse(ev.data)); } catch { /* ignore bad frame */ }
    };
  };
  open();
  return { close: () => { closed = true; clearTimeout(timer); es?.close(); es = null; } };
}
