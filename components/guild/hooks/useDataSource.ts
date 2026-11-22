import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type RefObject } from "react";

import { MS_PER_SECOND } from "@/lib/constants";
import { connectLive } from "@/lib/office/live";
import { Simulator } from "@/lib/office/sim";

import type { Conn, Mode, OfficeRef } from "../types";

const FALLBACK_ERROR_SECONDS = 3;
const FALLBACK_PENDING_SECONDS = 8;

const noopSub = () => () => {};
const forcedDemoNow = () => new URLSearchParams(window.location.search).has("demo");

/** Live/Demo mode state plus the effect that wires the engine to the SSE stream or the simulator. */
export function useDataSource(officeRef: OfficeRef, mounted: boolean, prevClashRef: RefObject<Set<string> | null>) {
  const speedRef = useRef(1);
  const forcedDemo = useSyncExternalStore(noopSub, forcedDemoNow, () => false);
  const [chosen, setChosen] = useState<Mode | null>(null);
  const [conn, setConn] = useState<Conn>("connecting");
  const [note, setNote] = useState("");
  const [speed, setSpeed] = useState(1);
  const [paused, setPaused] = useState(false);

  const mode: Mode = chosen ?? (forcedDemo ? "demo" : "live");

  const switchMode = (m: Mode) => {
    if (m === mode) return;
    setNote("");
    setConn("connecting");
    setPaused(false);
    officeRef.current?.setPaused(false);
    setChosen(m);
  };
  const togglePause = () => {
    const p = !paused;
    setPaused(p);
    officeRef.current?.setPaused(p);
  };
  const setSpeedBoth = useCallback(
    (n: number) => {
      setSpeed(n);
      speedRef.current = n;
      officeRef.current?.setSpeed(n);
    },
    [officeRef],
  );

  useEffect(() => {
    const o = officeRef.current;
    if (!o || !mounted) return;
    o.clear();
    prevClashRef.current = null;
    if (mode === "demo") {
      o.setSpeed(speedRef.current);
      o.attachSim(new Simulator(o));
      return () => o.attachSim(null);
    }
    o.setSpeed(1);
    let opened = false;
    let errored = false;
    const live = connectLive({
      onSnapshot: (s) => {
        o.loadSnapshot(s);
        // baseline for clash notifications: whatever the first snapshot already contains
        if (prevClashRef.current === null)
          prevClashRef.current = new Set(
            o
              .conflictRows()
              .filter((c) => c.level === "clash")
              .map((c) => c.key),
          );
      },
      onEvent: (e) => o.event(e),
      onTerritory: (m) => o.setTerritory(m),
      onAttention: (rows) => o.setAttention(rows),
      onReceipts: (rows) => o.setReceipts(rows),
      onContext: (m) => {
        if (m && typeof m.session_id === "string") o.setContext(m.session_id, m.used, m.limit, !!m.limitGuessed);
      },
      onStatus: (s) => {
        if (s === "open") {
          opened = true;
          setConn("connected");
        } else {
          errored = true;
          setConn(opened ? "reconnecting" : "connecting");
        }
      },
    });
    const fallback = () => {
      if (opened) return;
      live.close();
      setNote("เชื่อมต่อ /events/stream ไม่ได้ — สลับเป็น Demo");
      setChosen("demo");
    };
    // fall back on error after FALLBACK_ERROR_SECONDS; if the first request is still pending, wait longer (dev compile)
    const t1 = setTimeout(() => {
      if (errored) fallback();
    }, FALLBACK_ERROR_SECONDS * MS_PER_SECOND);
    const t2 = setTimeout(fallback, FALLBACK_PENDING_SECONDS * MS_PER_SECOND);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      live.close();
      prevClashRef.current = null;
    };
  }, [mode, mounted, officeRef, prevClashRef]);

  return { mode, conn, note, speed, paused, switchMode, togglePause, setSpeed: setSpeedBoth };
}
