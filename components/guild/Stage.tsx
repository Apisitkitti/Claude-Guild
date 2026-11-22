import type { RefObject } from "react";

import { H, W } from "@/lib/office/layout";
import { m } from "@/paraglide/messages";

import type { OfficeRef } from "./types";

export function Stage({
  canvasRef,
  stageRef,
  scale,
  officeRef,
}: {
  canvasRef: RefObject<HTMLCanvasElement | null>;
  stageRef: RefObject<HTMLDivElement | null>;
  scale: number;
  officeRef: OfficeRef;
}) {
  const toLogical = (ev: React.MouseEvent<HTMLCanvasElement>) => {
    const c = ev.currentTarget;
    const r = c.getBoundingClientRect();
    return {
      x: ((ev.clientX - r.left - c.clientLeft) * W) / c.clientWidth,
      y: ((ev.clientY - r.top - c.clientTop) * H) / c.clientHeight,
    };
  };
  return (
    <div className="stage" ref={stageRef}>
      <div className="frame">
        <canvas
          ref={canvasRef}
          role="img"
          aria-label={m.stage_label()}
          style={{ width: W * scale, height: H * scale }}
          onMouseMove={(ev) => {
            const p = toLogical(ev);
            officeRef.current?.setHover(officeRef.current.hit(p.x, p.y));
          }}
          onMouseLeave={() => officeRef.current?.setHover(null)}
        />
      </div>
    </div>
  );
}
