import type { RefObject } from "react";

import { WORLD_H, WORLD_W } from "@/lib/office/layout";
import { m } from "@/paraglide/messages";

import type { OfficeRef } from "./types";

export const Stage = ({
  canvasRef,
  stageRef,
  scale,
  officeRef,
}: {
  canvasRef: RefObject<HTMLCanvasElement | null>;
  stageRef: RefObject<HTMLDivElement | null>;
  scale: number;
  officeRef: OfficeRef;
}) => {
  const toLogical = (ev: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = ev.currentTarget;
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((ev.clientX - rect.left - canvas.clientLeft) * WORLD_W) / canvas.clientWidth,
      y: ((ev.clientY - rect.top - canvas.clientTop) * WORLD_H) / canvas.clientHeight,
    };
  };
  return (
    <div className="stage" ref={stageRef}>
      <div className="frame">
        <canvas
          ref={canvasRef}
          role="img"
          aria-label={m.stage_label()}
          style={{ width: WORLD_W * scale, height: WORLD_H * scale }}
          onMouseMove={(ev) => {
            const point = toLogical(ev);
            officeRef.current?.setHover(officeRef.current.hit(point.x, point.y));
          }}
          onMouseLeave={() => officeRef.current?.setHover(null)}
        />
      </div>
    </div>
  );
};
