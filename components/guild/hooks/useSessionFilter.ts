import { useEffect, useState } from "react";
import type { OfficeRef } from "../types";

export type SessionFilter = { fq: string; fStray: boolean; saveFilter: (query: string, hideStray: boolean) => void };

/** Session filter: restore once, push to the engine, persist. */
export function useSessionFilter(officeRef: OfficeRef, mounted: boolean) {
  const [fq, setFq] = useState("");
  const [fStray, setFStray] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => {
      try {
        const j = JSON.parse(localStorage.getItem("guild.filter") ?? "null");
        if (j && typeof j === "object") {
          if (typeof j.query === "string") setFq(j.query.slice(0, 80));
          if (j.hideStray === true) setFStray(true);
        }
      } catch {}
    }, 0);
    return () => clearTimeout(t);
  }, []);
  useEffect(() => {
    officeRef.current?.setFilter({ query: fq, hideStray: fStray });
  }, [fq, fStray, mounted, officeRef]);
  const saveFilter = (query: string, hideStray: boolean) => {
    setFq(query); setFStray(hideStray);
    try { localStorage.setItem("guild.filter", JSON.stringify({ query, hideStray })); } catch {}
  };
  return { fq, fStray, setFq, saveFilter };
}
