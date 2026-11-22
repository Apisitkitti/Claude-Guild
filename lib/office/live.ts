import { MS_PER_SECOND } from "@/lib/constants";

/** SSE reconnect backoff: first delay and ceiling */
const RECONNECT_BASE_MS = MS_PER_SECOND;
const RECONNECT_MAX_SECONDS = 10;
const RECONNECT_MAX_MS = RECONNECT_MAX_SECONDS * MS_PER_SECOND;

import type { AttentionMsgRow, HookEvt, ReceiptMsgRow, SnapshotMsg, TerritoryMsg } from "./engine";

export interface LiveHandlers {
  onSnapshot(s: SnapshotMsg): void;
  onEvent(e: HookEvt): void;
  onContext?(m: { session_id: string; used: number | null; limit: number | null; limitGuessed?: boolean }): void;
  onTerritory?(m: TerritoryMsg): void;
  onAttention?(rows: AttentionMsgRow[]): void;
  onReceipts?(rows: ReceiptMsgRow[]): void;
  onStatus(s: "open" | "error"): void;
}

export function connectLive(h: LiveHandlers): { close(): void } {
  let es: EventSource | null = null;
  let closed = false;
  let delay = RECONNECT_BASE_MS;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const open = () => {
    if (closed) return;
    const src = new EventSource("/events/stream");
    es = src;
    src.onopen = () => {
      delay = RECONNECT_BASE_MS;
      h.onStatus("open");
    };
    src.onerror = () => {
      h.onStatus("error");
      if (src.readyState === 2) {
        // CLOSED: browser gave up, retry manually with backoff
        src.close();
        if (es === src) es = null;
        if (!closed) {
          timer = setTimeout(open, delay);
          delay = Math.min(RECONNECT_MAX_MS, delay * 2);
        }
      }
    };
    src.addEventListener("snapshot", (ev) => {
      try {
        h.onSnapshot(JSON.parse((ev as MessageEvent).data));
      } catch {
        /* ignore bad frame */
      }
    });
    src.addEventListener("context", (ev) => {
      try {
        h.onContext?.(JSON.parse((ev as MessageEvent).data));
      } catch {
        /* ignore bad frame */
      }
    });
    src.addEventListener("territory", (ev) => {
      try {
        h.onTerritory?.(JSON.parse((ev as MessageEvent).data));
      } catch {
        /* ignore bad frame */
      }
    });
    src.addEventListener("attention", (ev) => {
      try {
        h.onAttention?.(JSON.parse((ev as MessageEvent).data));
      } catch {
        /* ignore bad frame */
      }
    });
    src.addEventListener("receipts", (ev) => {
      try {
        h.onReceipts?.(JSON.parse((ev as MessageEvent).data));
      } catch {
        /* ignore bad frame */
      }
    });
    src.onmessage = (ev) => {
      try {
        h.onEvent(JSON.parse(ev.data));
      } catch {
        /* ignore bad frame */
      }
    };
  };
  open();
  return {
    close: () => {
      closed = true;
      clearTimeout(timer);
      es?.close();
      es = null;
    },
  };
}
