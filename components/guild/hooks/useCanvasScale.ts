import { useEffect, useState, type RefObject } from "react";

import { VIEW_W, WORLD_H } from "@/lib/office/layout";

import type { OfficeRef } from "../types";

/** Fits the canvas to the stage and keeps the backing store crisp (scale * devicePixelRatio device padX per logical padX). */
export const useCanvasScale = (stageRef: RefObject<HTMLDivElement | null>, officeRef: OfficeRef) => {
  const [scale, setScale] = useState(2);
  const [dpr, setDpr] = useState(1);
  useEffect(() => {
    // Moving to a monitor with a different DPR doesn't always fire resize, so also watch the resolution query.
    let resolutionQuery: MediaQueryList | null = null;
    const updateDpr = () => {
      const ratioNow = window.devicePixelRatio || 1;
      setDpr(ratioNow);
      resolutionQuery?.removeEventListener("change", updateDpr);
      resolutionQuery = window.matchMedia(`(resolution: ${ratioNow}dppx)`);
      resolutionQuery.addEventListener("change", updateDpr);
    };
    updateDpr();
    window.addEventListener("resize", updateDpr);
    return () => {
      window.removeEventListener("resize", updateDpr);
      resolutionQuery?.removeEventListener("change", updateDpr);
    };
  }, []);
  useEffect(() => {
    officeRef.current?.setPixelScale(scale * dpr);
  }, [scale, dpr, officeRef]);

  // Scale fitting: snap so scale * devicePixelRatio is a whole number of device padX per logical padX
  // (crisp pixel art, but 0.5 steps on retina instead of wasting space with integer-only scale).
  useEffect(() => {
    const calc = () => {
      const stage = stageRef.current;
      if (!stage) return;
      const computed = getComputedStyle(stage);
      const padX = parseFloat(computed.paddingLeft) + parseFloat(computed.paddingRight);
      const padY = parseFloat(computed.paddingTop) + parseFloat(computed.paddingBottom);
      const FRAME = 24; // frame border + padding on both sides
      const availW = stage.clientWidth - padX - FRAME;
      const availH = stage.clientHeight - padY - FRAME;
      const ratio = window.devicePixelRatio || 1;
      const fit = Math.min(availW / VIEW_W, availH / WORLD_H);
      setScale(Math.max(1 / ratio, Math.floor(fit * ratio) / ratio));
    };
    const resizeObserver = new ResizeObserver(calc);
    resizeObserver.observe(stageRef.current!);
    window.addEventListener("resize", calc);
    calc();
    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", calc);
    };
  }, [stageRef]);
  return scale;
};
