import { useCallback, useEffect, useRef } from "react";
import { nextAttentionId, type AttentionRow } from "@/lib/office/engine";

/** `N` jumps to the next adventurer in the attention queue. Returns `jumpTo` for click handlers (keeps the cursor in sync). */
export function useKeyboardNav(attention: AttentionRow[], selectedId: string | null, revealSelect: (id: string) => void) {
  const lastN = useRef<string | null>(null);
  const attentionRef = useRef<AttentionRow[]>([]);
  const selectedRef = useRef<string | null>(null);
  useEffect(() => { attentionRef.current = attention; selectedRef.current = selectedId; }, [attention, selectedId]);
  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      if ((ev.key !== "n" && ev.key !== "N") || ev.ctrlKey || ev.metaKey || ev.altKey || ev.defaultPrevented) return;
      const t = ev.target as HTMLElement | null;
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
      const rows = attentionRef.current;
      const id = nextAttentionId(rows, selectedRef.current ?? lastN.current);
      if (!id) return;
      lastN.current = id;
      revealSelect(id);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [revealSelect]);
  return useCallback((sid: string) => { lastN.current = sid; revealSelect(sid); }, [revealSelect]);
}
