import type { ChronicleSnapshot } from "@/lib/chronicle";
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
  onSessionMeta?(m: { session_id: string; source?: string; model?: string | null; rateLimit?: unknown }): void;
  onTerritory?(m: TerritoryMsg): void;
  onAttention?(rows: AttentionMsgRow[]): void;
  onReceipts?(rows: ReceiptMsgRow[]): void;
  onChronicle?(chronicle: ChronicleSnapshot): void;
  onQuests?(rows: unknown): void;
  onStatus(s: "open" | "error"): void;
}

export const connectLive = (handlers: LiveHandlers): { close(): void } => {
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
      handlers.onStatus("open");
    };
    src.onerror = () => {
      handlers.onStatus("error");
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
        handlers.onSnapshot(JSON.parse((ev as MessageEvent).data));
      } catch {
        /* ignore bad frame */
      }
    });
    src.addEventListener("context", (ev) => {
      try {
        handlers.onContext?.(JSON.parse((ev as MessageEvent).data));
      } catch {
        /* ignore bad frame */
      }
    });
    src.addEventListener("session_meta", (ev) => {
      try {
        handlers.onSessionMeta?.(JSON.parse((ev as MessageEvent).data));
      } catch {
        /* ignore bad frame */
      }
    });
    src.addEventListener("territory", (ev) => {
      try {
        handlers.onTerritory?.(JSON.parse((ev as MessageEvent).data));
      } catch {
        /* ignore bad frame */
      }
    });
    src.addEventListener("attention", (ev) => {
      try {
        handlers.onAttention?.(JSON.parse((ev as MessageEvent).data));
      } catch {
        /* ignore bad frame */
      }
    });
    src.addEventListener("receipts", (ev) => {
      try {
        handlers.onReceipts?.(JSON.parse((ev as MessageEvent).data));
      } catch {
        /* ignore bad frame */
      }
    });
    src.addEventListener("chronicle", (ev) => {
      try {
        handlers.onChronicle?.(JSON.parse((ev as MessageEvent).data));
      } catch {
        /* ignore bad frame */
      }
    });
    src.addEventListener("quests", (ev) => {
      try {
        handlers.onQuests?.(JSON.parse((ev as MessageEvent).data));
      } catch {
        /* ignore bad frame */
      }
    });
    src.onmessage = (ev) => {
      try {
        handlers.onEvent(JSON.parse(ev.data));
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
};
