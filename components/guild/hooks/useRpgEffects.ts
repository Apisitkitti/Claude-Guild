import { useEffect, useRef, useState } from "react";

import type { RosterRow } from "@/lib/office/engine";

import { isNum } from "../format";
import type { RpgRow } from "../types";

const LV_FLASH_MS = 1200;
const BUMP_MS = 400;

/** Level-up flash per roster card (brief CSS class toggle). */
export const useRosterFlash = (roster: RosterRow[]) => {
  const [lvFlash, setLvFlash] = useState<Record<string, boolean>>({});
  const prevLv = useRef<Map<string, number>>(new Map());
  useEffect(() => {
    const up: string[] = [];
    const seen = new Set<string>();
    for (const row of roster) {
      const level = (row as RpgRow).level;
      seen.add(row.id);
      if (!isNum(level)) continue;
      const old = prevLv.current.get(row.id);
      if (old !== undefined && level > old) up.push(row.id);
      prevLv.current.set(row.id, level);
    }
    for (const id of [...prevLv.current.keys()]) if (!seen.has(id)) prevLv.current.delete(id);
    if (!up.length) return;
    const timer = setTimeout(() => {
      setLvFlash((current) => {
        const next = { ...current };
        for (const id of up) next[id] = true;
        return next;
      });
      setTimeout(
        () =>
          setLvFlash((current) => {
            const next = { ...current };
            for (const id of up) delete next[id];
            return next;
          }),
        LV_FLASH_MS,
      );
    }, 0);
    return () => clearTimeout(timer);
  }, [roster]);
  return lvFlash;
};

/** Treasury bump: true briefly whenever the guild treasury grows. */
export const useTreasuryBump = (treasury: number | undefined) => {
  const [bump, setBump] = useState(false);
  const prevTreasury = useRef<number | undefined>(undefined);
  useEffect(() => {
    const old = prevTreasury.current;
    prevTreasury.current = treasury;
    if (!isNum(treasury) || old === undefined || treasury <= old) return;
    const showTimer = setTimeout(() => setBump(true), 0);
    const hideTimer = setTimeout(() => setBump(false), BUMP_MS);
    return () => {
      clearTimeout(showTimer);
      clearTimeout(hideTimer);
    };
  }, [treasury]);
  return bump;
};
