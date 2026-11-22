import { useEffect, useState } from "react";

import type { OfficeRef } from "../types";

const MAX_QUERY_CHARS = 80;

export type SessionFilter = {
  filterQuery: string;
  fStray: boolean;
  saveFilter: (query: string, hideStray: boolean) => void;
};

/** Session filter: restore once, push to the engine, persist. */
export const useSessionFilter = (officeRef: OfficeRef, mounted: boolean) => {
  const [filterQuery, setFilterQuery] = useState("");
  const [fStray, setFStray] = useState(false);
  const saveFilter = (query: string, hideStray: boolean) => {
    setFilterQuery(query);
    setFStray(hideStray);
    try {
      localStorage.setItem("guild.filter", JSON.stringify({ query, hideStray }));
    } catch {}
  };
  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        const stored = JSON.parse(localStorage.getItem("guild.filter") ?? "null");
        if (stored && typeof stored === "object") {
          if (typeof stored.query === "string") setFilterQuery(stored.query.slice(0, MAX_QUERY_CHARS));
          if (stored.hideStray === true) setFStray(true);
        }
      } catch {}
    }, 0);
    return () => clearTimeout(timer);
  }, []);
  useEffect(() => {
    officeRef.current?.setFilter({ query: filterQuery, hideStray: fStray });
  }, [filterQuery, fStray, mounted, officeRef]);
  return { filterQuery, fStray, setFilterQuery, saveFilter };
};
