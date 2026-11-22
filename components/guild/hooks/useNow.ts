import { useEffect, useState } from "react";

/** Wall-clock ms that ticks every 10s (0 until the first tick) so age labels stay fresh. */
export function useNow() {
  const [nowMs, setNowMs] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 10000);
    const first = setTimeout(() => setNowMs(Date.now()), 0);
    return () => { clearInterval(id); clearTimeout(first); };
  }, []);
  return nowMs;
}
