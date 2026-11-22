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

const readCleared = (): Cleared => {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null");
    if (!stored || typeof stored !== "object") return EMPTY;
    const before = typeof stored.before === "number" && Number.isFinite(stored.before) ? stored.before : 0;
    const ids = Array.isArray(stored.ids) ? stored.ids.filter((x: unknown): x is string => typeof x === "string") : [];
    return { before, ids: ids.slice(-MAX_DISMISSED_IDS) };
  } catch {
    return EMPTY;
  }
};

const writeCleared = (cleared: Cleared) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cleared));
  } catch {}
};

/**
 * Receipts the viewer has cleared, kept in this browser only (the server copy is untouched and still expires after 2 h).
 * Restored after mount to stay hydration-safe.
 */
export const useReceiptDismissals = (rows: ReceiptRow[]) => {
  const [cleared, setCleared] = useState<Cleared>(EMPTY);

  const visible = useMemo(() => {
    const ids = new Set(cleared.ids);
    return rows.filter((row) => row.closedAt > cleared.before && !ids.has(row.id));
  }, [rows, cleared]);

  const update = useCallback((change: (current: Cleared) => Cleared) => {
    setCleared((current) => {
      const next = change(current);
      writeCleared(next);
      return next;
    });
  }, []);
  const dismiss = useCallback(
    (id: string) =>
      update((current) => ({
        before: current.before,
        ids: [...current.ids.filter((other) => other !== id), id].slice(-MAX_DISMISSED_IDS),
      })),
    [update],
  );
  const clearAll = useCallback(() => {
    const newest = rows.reduce((latest, row) => Math.max(latest, row.closedAt), 0);
    update((current) => ({ before: Math.max(current.before, newest), ids: [] }));
  }, [rows, update]);

  useEffect(() => {
    queueMicrotask(() => setCleared(readCleared()));
  }, []);

  return { visible, dismiss, clearAll };
};
