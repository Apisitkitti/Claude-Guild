import { useCallback, useEffect, useMemo, useState } from "react";

import type { ReceiptRow } from "@/lib/office/engine";

const STORAGE_KEY = "guild.receiptsCleared";
/** more than the server ever keeps (30 closed receipts), so a dismissed id never comes back */
const MAX_DISMISSED_IDS = 60;

interface Cleared {
  /** receipts closed at or before this time are hidden ("ล้างทั้งหมด") */
  before: number;
  /** individually dismissed receipt ids (✕) */
  ids: string[];
}

const EMPTY: Cleared = { before: 0, ids: [] };

function readCleared(): Cleared {
  try {
    const v = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null");
    if (!v || typeof v !== "object") return EMPTY;
    const before = typeof v.before === "number" && Number.isFinite(v.before) ? v.before : 0;
    const ids = Array.isArray(v.ids) ? v.ids.filter((x: unknown): x is string => typeof x === "string") : [];
    return { before, ids: ids.slice(-MAX_DISMISSED_IDS) };
  } catch {
    return EMPTY;
  }
}

function writeCleared(v: Cleared) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(v));
  } catch {}
}

/**
 * Receipts the viewer has cleared, kept in this browser only (the server copy is untouched and still expires after 2 h).
 * Restored after mount to stay hydration-safe.
 */
export function useReceiptDismissals(rows: ReceiptRow[]) {
  const [cleared, setCleared] = useState<Cleared>(EMPTY);

  const visible = useMemo(() => {
    const ids = new Set(cleared.ids);
    return rows.filter((r) => r.closedAt > cleared.before && !ids.has(r.id));
  }, [rows, cleared]);

  const update = useCallback((next: (c: Cleared) => Cleared) => {
    setCleared((c) => {
      const n = next(c);
      writeCleared(n);
      return n;
    });
  }, []);
  const dismiss = useCallback(
    (id: string) =>
      update((c) => ({ before: c.before, ids: [...c.ids.filter((x) => x !== id), id].slice(-MAX_DISMISSED_IDS) })),
    [update],
  );
  const clearAll = useCallback(() => {
    const newest = rows.reduce((m, r) => Math.max(m, r.closedAt), 0);
    update((c) => ({ before: Math.max(c.before, newest), ids: [] }));
  }, [rows, update]);

  useEffect(() => {
    queueMicrotask(() => setCleared(readCleared()));
  }, []);

  return { visible, dismiss, clearAll };
}
