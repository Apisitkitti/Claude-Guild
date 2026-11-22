import { useEffect, useState, type RefObject } from "react";
import { H, W } from "@/lib/office/layout";
import type { OfficeRef } from "../types";

/** Fits the canvas to the stage and keeps the backing store crisp (scale * devicePixelRatio device px per logical px). */
export function useCanvasScale(stageRef: RefObject<HTMLDivElement | null>, officeRef: OfficeRef) {
  const [scale, setScale] = useState(2);
  const [dpr, setDpr] = useState(1);
  useEffect(() => {
    // Moving to a monitor with a different DPR doesn't always fire resize, so also watch the resolution query.
    let mq: MediaQueryList | null = null;
    const upd = () => {
      const r = window.devicePixelRatio || 1;
      setDpr(r);
      mq?.removeEventListener("change", upd);
      mq = window.matchMedia(`(resolution: ${r}dppx)`);
      mq.addEventListener("change", upd);
    };
    upd();
    window.addEventListener("resize", upd);
    return () => { window.removeEventListener("resize", upd); mq?.removeEventListener("change", upd); };
  }, []);
  useEffect(() => { officeRef.current?.setPixelScale(scale * dpr); }, [scale, dpr, officeRef]);

  // Scale fitting: snap so scale * devicePixelRatio is a whole number of device px per logical px
  // (crisp pixel art, but 0.5 steps on retina instead of wasting space with integer-only scale).
  useEffect(() => {
    const calc = () => {
      const st = stageRef.current;
      if (!st) return;
      const cs = getComputedStyle(st);
      const px = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight);
      const py = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom);
      const FRAME = 24; // frame border + padding on both sides
      const availW = st.clientWidth - px - FRAME;
      const availH = st.clientHeight - py - FRAME;
      const ratio = window.devicePixelRatio || 1;
      const fit = Math.min(availW / W, availH / H);
      setScale(Math.max(1 / ratio, Math.floor(fit * ratio) / ratio));
    };
    const ro = new ResizeObserver(calc);
    ro.observe(stageRef.current!);
    window.addEventListener("resize", calc);
    calc();
    return () => { ro.disconnect(); window.removeEventListener("resize", calc); };
  }, [stageRef]);
  return scale;
}
