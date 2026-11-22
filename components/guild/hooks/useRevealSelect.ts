import { useCallback } from "react";

import type { OfficeRef } from "../types";

/** Select an adventurer; if the query filter hides it, relax the filter first (also used by notification clicks). */
export function useRevealSelect(officeRef: OfficeRef, setFq: (q: string) => void) {
  return useCallback(
    (id: string) => {
      const off = officeRef.current;
      if (!off) return;
      if (off.isHidden(off.employees.get(id))) {
        setFq("");
        off.setFilter({ query: "" });
        try {
          localStorage.setItem("guild.filter", JSON.stringify({ query: "", hideStray: off.getFilter().hideStray }));
        } catch {}
      }
      off.select(id);
    },
    [officeRef, setFq],
  );
}
