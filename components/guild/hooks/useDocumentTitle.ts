import { useEffect, useRef } from "react";

/** Tab title badge: 🔔 queue, ❗ waiting, ⚔️ clashes. Restores the original title on unmount. */
export function useDocumentTitle({ waitingN, clashN, bellN }: { waitingN: number; clashN: number; bellN: number }) {
  const baseTitle = useRef<string | null>(null);
  useEffect(() => {
    baseTitle.current = document.title;
    return () => { if (baseTitle.current !== null) document.title = baseTitle.current; };
  }, []);
  useEffect(() => {
    if (baseTitle.current === null) return;
    const parts = [bellN > 0 ? `🔔(${bellN})` : "", waitingN > 0 ? `❗(${waitingN})` : "", clashN > 0 ? `⚔️(${clashN})` : ""].filter(Boolean);
    document.title = parts.length ? `${parts.join(" ")} Claude Guild` : baseTitle.current;
  }, [waitingN, clashN, bellN]);
}
