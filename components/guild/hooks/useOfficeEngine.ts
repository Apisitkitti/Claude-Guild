import { useEffect, useRef, useState, useSyncExternalStore, type RefObject } from "react";

import { EMPTY_VIEW, Office, type OfficeView } from "@/lib/office/engine";

const noopSub = () => () => {};

/** Creates the canvas engine once and mirrors its view into React state. */
export function useOfficeEngine(canvasRef: RefObject<HTMLCanvasElement | null>) {
  const officeRef = useRef<Office | null>(null);
  const mounted = useSyncExternalStore(
    noopSub,
    () => true,
    () => false,
  );
  const [view, setView] = useState<OfficeView>(EMPTY_VIEW);
  useEffect(() => {
    const o = new Office(canvasRef.current!);
    officeRef.current = o;
    o.subscribe(setView);
    o.start();
    return () => {
      o.stop();
      officeRef.current = null;
    };
  }, [canvasRef]);
  return { officeRef, view, mounted };
}
