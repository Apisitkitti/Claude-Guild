import { useCallback, useEffect, useState, type RefObject } from "react";

/** Side-panel collapsed flag, persisted in localStorage. */
export const usePanelCollapsed = () => {
  const [collapsed, setCollapsed] = useState(false);
  const toggleCollapsed = useCallback(() => {
    setCollapsed((current) => {
      try {
        localStorage.setItem("office.panelCollapsed", current ? "0" : "1");
      } catch {}
      return !current;
    });
  }, []);
  useEffect(() => {
    queueMicrotask(() => {
      try {
        if (localStorage.getItem("office.panelCollapsed") === "1") setCollapsed(true);
      } catch {}
    });
  }, []);
  return [collapsed, toggleCollapsed] as const;
};

export const useFullscreen = (appRef: RefObject<HTMLElement | null>) => {
  const [full, setFull] = useState(false);
  const toggleFull = useCallback(() => {
    try {
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
      else appRef.current?.requestFullscreen().catch(() => {});
    } catch {}
  }, [appRef]);
  useEffect(() => {
    const onFs = () => setFull(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);
  return [full, toggleFull] as const;
};
