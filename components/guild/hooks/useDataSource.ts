import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type RefObject } from "react";

import { MS_PER_SECOND } from "@/lib/constants";
import { connectLive } from "@/lib/office/live";
import { Simulator } from "@/lib/office/sim";
import { m } from "@/paraglide/messages";

import type { Conn, Mode, OfficeRef } from "../types";

const FALLBACK_ERROR_SECONDS = 3;
const FALLBACK_PENDING_SECONDS = 8;

const noopSub = () => () => {};
const forcedDemoNow = () => new URLSearchParams(window.location.search).has("demo");

/** Live/Demo mode state plus the effect that wires the engine to the SSE stream or the simulator. */
export const useDataSource = (officeRef: OfficeRef, mounted: boolean, prevClashRef: RefObject<Set<string> | null>) => {
  const speedRef = useRef(1);
  const forcedDemo = useSyncExternalStore(noopSub, forcedDemoNow, () => false);
  const [chosen, setChosen] = useState<Mode | null>(null);
  const [conn, setConn] = useState<Conn>("connecting");
  const [note, setNote] = useState("");
  const [speed, setSpeed] = useState(1);
  const [paused, setPaused] = useState(false);

  const mode: Mode = chosen ?? (forcedDemo ? "demo" : "live");

  const switchMode = (next: Mode) => {
    if (next === mode) return;
    setNote("");
    setConn("connecting");
    setPaused(false);
    officeRef.current?.setPaused(false);
    setChosen(next);
  };
  const togglePause = () => {
    const nextPaused = !paused;
    setPaused(nextPaused);
    officeRef.current?.setPaused(nextPaused);
  };
  const setSpeedBoth = useCallback(
    (value: number) => {
      setSpeed(value);
      speedRef.current = value;
      officeRef.current?.setSpeed(value);
    },
    [officeRef],
  );

  useEffect(() => {
    const office = officeRef.current;
    if (!office || !mounted) return;
    office.clear();
    prevClashRef.current = null;
    if (mode === "demo") {
      office.setSpeed(speedRef.current);
      office.attachSim(new Simulator(office));
      return () => office.attachSim(null);
    }
    office.setSpeed(1);
    let opened = false;
    let errored = false;
    const live = connectLive({
      onSnapshot: (snapshot) => {
        office.loadSnapshot(snapshot);
        // baseline for clash notifications: whatever the first snapshot already contains
        if (prevClashRef.current === null)
          prevClashRef.current = new Set(
            office
              .conflictRows()
              .filter((conflict) => conflict.level === "clash")
              .map((conflict) => conflict.key),
          );
      },
      onEvent: (event) => office.event(event),
      onTerritory: (territory) => office.setTerritory(territory),
      onAttention: (rows) => office.setAttention(rows),
      onReceipts: (rows) => office.setReceipts(rows),
      onChronicle: (chronicle) => office.setChronicle(chronicle),
      onQuests: (rows) => office.setQuests(rows),
      onContext: (context) => {
        if (context && typeof context.session_id === "string")
          office.setContext(context.session_id, context.used, context.limit, !!context.limitGuessed);
      },
      onSessionMeta: (meta) => {
        if (meta && typeof meta.session_id === "string") office.setSessionMeta(meta.session_id, meta);
      },
      onStatus: (status) => {
        if (status === "open") {
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
      setNote(m.source_fallback_note());
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
};
