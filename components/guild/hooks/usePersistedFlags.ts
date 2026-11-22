import { useCallback, useEffect, useState } from "react";

export function readJson(key: string): Record<string, boolean> {
  try { const v = JSON.parse(localStorage.getItem(key) ?? "{}"); return v && typeof v === "object" ? v : {}; } catch { return {}; }
}
export function writeJson(key: string, v: Record<string, boolean>) {
  try { localStorage.setItem(key, JSON.stringify(v)); } catch {}
}

/** Boolean flag map persisted in localStorage (restored after mount to stay hydration-safe). */
export function usePersistedFlags(key: string) {
  const [flags, setFlags] = useState<Record<string, boolean>>({});
  useEffect(() => {
    queueMicrotask(() => setFlags(readJson(key)));
  }, [key]);
  const toggle = useCallback((id: string) => {
    setFlags((m) => { const n = { ...m, [id]: !m[id] }; writeJson(key, n); return n; });
  }, [key]);
  return [flags, toggle] as const;
}
