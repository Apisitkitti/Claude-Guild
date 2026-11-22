import { useEffect, useState } from "react";

import type { OfficeRef } from "../types";

const MAX_QUERY_CHARS = 80;

export type SessionFilter = { fq: string; fStray: boolean; saveFilter: (query: string, hideStray: boolean) => void };

/** Session filter: restore once, push to the engine, persist. */
export function useSessionFilter(officeRef: OfficeRef, mounted: boolean) {
  const [fq, setFq] = useState("");
  const [fStray, setFStray] = useState(false);
  const saveFilter = (query: string, hideStray: boolean) => {
    setFq(query);
    setFStray(hideStray);
    try {
      localStorage.setItem("guild.filter", JSON.stringify({ query, hideStray }));
    } catch {}
  };
  useEffect(() => {
    const t = setTimeout(() => {
      try {
        const j = JSON.parse(localStorage.getItem("guild.filter") ?? "null");
        if (j && typeof j === "object") {
          if (typeof j.query === "string") setFq(j.query.slice(0, MAX_QUERY_CHARS));
          if (j.hideStray === true) setFStray(true);
        }
      } catch {}
    }, 0);
    return () => clearTimeout(t);
  }, []);
  useEffect(() => {
    officeRef.current?.setFilter({ query: fq, hideStray: fStray });
  }, [fq, fStray, mounted, officeRef]);
  return { fq, fStray, setFq, saveFilter };
}
