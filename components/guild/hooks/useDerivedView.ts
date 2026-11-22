import { useMemo } from "react";

import { bellCount, type OfficeView } from "@/lib/office/engine";

import type { Mode } from "../types";

/** Memoised slices of the engine view used by the panel, title and notifications. */
export const useDerivedView = (view: OfficeView, mode: Mode) => {
  const waiting = useMemo(() => (mode === "live" ? (view.waiting ?? []) : []), [view.waiting, mode]);
  const hiddenSet = useMemo(() => new Set(view.hiddenIds ?? []), [view.hiddenIds]);
  const conflicts = useMemo(() => view.conflicts ?? [], [view.conflicts]);
  const clashes = useMemo(
    () => (mode === "live" ? conflicts.filter((conflict) => conflict.level === "clash") : []),
    [conflicts, mode],
  );
  const attention = useMemo(() => view.attention ?? [], [view.attention]);
  const receipts = useMemo(() => view.receipts ?? [], [view.receipts]);
  // permission waits are already counted by the ❗ in the title
  const bellN = useMemo(() => bellCount(attention, false), [attention]);
  return { waiting, hiddenSet, conflicts, clashes, attention, receipts, bellN };
};
