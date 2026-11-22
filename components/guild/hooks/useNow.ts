import { useEffect, useState } from "react";

import { MS_PER_SECOND } from "@/lib/constants";

const NOW_TICK_SECONDS = 10;

/** Wall-clock ms that ticks every 10s (0 until the first tick) so age labels stay fresh. */
export const useNow = () => {
  const [nowMs, setNowMs] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), NOW_TICK_SECONDS * MS_PER_SECOND);
    const first = setTimeout(() => setNowMs(Date.now()), 0);
    return () => {
      clearInterval(id);
      clearTimeout(first);
    };
  }, []);
  return nowMs;
};
