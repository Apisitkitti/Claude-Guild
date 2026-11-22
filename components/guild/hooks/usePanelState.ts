import { useCallback, useEffect, useState, type RefObject } from "react";

/** Side-panel collapsed flag, persisted in localStorage. */
export function usePanelCollapsed() {
  const [collapsed, setCollapsed] = useState(false);
  useEffect(() => {
    queueMicrotask(() => {
      try { if (localStorage.getItem("office.panelCollapsed") === "1") setCollapsed(true); } catch {}
    });
  }, []);
  const toggleCollapsed = useCallback(() => {
    setCollapsed((c) => {
      try { localStorage.setItem("office.panelCollapsed", c ? "0" : "1"); } catch {}
      return !c;
    });
  }, []);
  return [collapsed, toggleCollapsed] as const;
}

export function useFullscreen(appRef: RefObject<HTMLElement | null>) {
  const [full, setFull] = useState(false);
  useEffect(() => {
    const onFs = () => setFull(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);
  const toggleFull = useCallback(() => {
    try {
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
      else appRef.current?.requestFullscreen().catch(() => {});
    } catch {}
  }, [appRef]);
  return [full, toggleFull] as const;
}
