import { useCallback, useEffect, useRef } from "react";

import { nextAttentionId, type AttentionRow } from "@/lib/office/engine";

/** `N` jumps to the next adventurer in the attention queue; `G` opens the Guild Master's report. Returns `jumpTo` for click handlers (keeps the cursor in sync). */
export const useKeyboardNav = (
  attention: AttentionRow[],
  selectedId: string | null,
  revealSelect: (id: string) => void,
  onOpenReport: () => void,
) => {
  const lastN = useRef<string | null>(null);
  const attentionRef = useRef<AttentionRow[]>([]);
  const selectedRef = useRef<string | null>(null);
  useEffect(() => {
    attentionRef.current = attention;
    selectedRef.current = selectedId;
  }, [attention, selectedId]);
  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      // ev.code too: on a Thai layout the physical N / G keys type Thai letters
      const isNext = ev.key === "n" || ev.key === "N" || ev.code === "KeyN";
      const isReport = ev.key === "g" || ev.key === "G" || ev.code === "KeyG";
      if (!isNext && !isReport) return;
      if (ev.ctrlKey || ev.metaKey || ev.altKey || ev.defaultPrevented || ev.isComposing || ev.repeat) return;
      const target = ev.target as HTMLElement | null;
      if (target && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))) return;
      // a modal (Chronicle, the report) owns the keyboard; the non-modal gate / board popovers do not
      if (document.querySelector('[role="dialog"][aria-modal="true"]')) return;
      if (isReport) {
        ev.preventDefault();
        onOpenReport();
        return;
      }
      const rows = attentionRef.current;
      const id = nextAttentionId(rows, selectedRef.current ?? lastN.current);
      if (!id) return;
      lastN.current = id;
      revealSelect(id);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [revealSelect, onOpenReport]);
  return useCallback(
    (sid: string) => {
      lastN.current = sid;
      revealSelect(sid);
    },
    [revealSelect],
  );
};
