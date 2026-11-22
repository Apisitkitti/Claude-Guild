import { useEffect, useRef, useState } from "react";

import type { RosterRow } from "@/lib/office/engine";

import { isNum } from "../format";
import type { RpgRow } from "../types";

const LV_FLASH_MS = 1200;
const BUMP_MS = 400;

/** Level-up flash per roster card (brief CSS class toggle). */
export function useRosterFlash(roster: RosterRow[]) {
  const [lvFlash, setLvFlash] = useState<Record<string, boolean>>({});
  const prevLv = useRef<Map<string, number>>(new Map());
  useEffect(() => {
    const up: string[] = [];
    const seen = new Set<string>();
    for (const r of roster) {
      const lv = (r as RpgRow).level;
      seen.add(r.id);
      if (!isNum(lv)) continue;
      const old = prevLv.current.get(r.id);
      if (old !== undefined && lv > old) up.push(r.id);
      prevLv.current.set(r.id, lv);
    }
    for (const id of [...prevLv.current.keys()]) if (!seen.has(id)) prevLv.current.delete(id);
    if (!up.length) return;
    const t = setTimeout(() => {
      setLvFlash((m) => {
        const n = { ...m };
        for (const id of up) n[id] = true;
        return n;
      });
      setTimeout(
        () =>
          setLvFlash((m) => {
            const n = { ...m };
            for (const id of up) delete n[id];
            return n;
          }),
        LV_FLASH_MS,
      );
    }, 0);
    return () => clearTimeout(t);
  }, [roster]);
  return lvFlash;
}

/** Treasury bump: true briefly whenever the guild treasury grows. */
export function useTreasuryBump(treasury: number | undefined) {
  const [bump, setBump] = useState(false);
  const prevTreasury = useRef<number | undefined>(undefined);
  useEffect(() => {
    const old = prevTreasury.current;
    prevTreasury.current = treasury;
    if (!isNum(treasury) || old === undefined || treasury <= old) return;
    const a = setTimeout(() => setBump(true), 0);
    const b = setTimeout(() => setBump(false), BUMP_MS);
    return () => {
      clearTimeout(a);
      clearTimeout(b);
    };
  }, [treasury]);
  return bump;
}
