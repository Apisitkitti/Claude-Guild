import { useCallback, useEffect, useState } from "react";

export const readJson = (key: string): Record<string, boolean> => {
  try {
    const value = JSON.parse(localStorage.getItem(key) ?? "{}");
    return value && typeof value === "object" ? value : {};
  } catch {
    return {};
  }
};
export const writeJson = (key: string, value: Record<string, boolean>) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {}
};

/** Boolean flag map persisted in localStorage (restored after mount to stay hydration-safe). */
export const usePersistedFlags = (key: string) => {
  const [flags, setFlags] = useState<Record<string, boolean>>({});
  const toggle = useCallback(
    (id: string) => {
      setFlags((current) => {
        const next = { ...current, [id]: !current[id] };
        writeJson(key, next);
        return next;
      });
    },
    [key],
  );
  useEffect(() => {
    queueMicrotask(() => setFlags(readJson(key)));
  }, [key]);
  return [flags, toggle] as const;
};
