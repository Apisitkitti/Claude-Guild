import { useEffect, useRef, useState, type RefObject } from "react";

import type { DungeonStats } from "@/lib/office/dungeon";
import { DUNGEON_HIT, WORLD_H, WORLD_W } from "@/lib/office/layout";
import { m } from "@/paraglide/messages";

import { DungeonCard } from "./DungeonCard";
import type { OfficeRef } from "./types";

/** canvas border (see `.frame canvas` in globals.css): the overlay's origin is inside it */
const CANVAS_BORDER = 3;
const CARD_GAP = 4;

export const Stage = ({
  canvasRef,
  stageRef,
  scale,
  officeRef,
  dungeon,
}: {
  canvasRef: RefObject<HTMLCanvasElement | null>;
  stageRef: RefObject<HTMLDivElement | null>;
  scale: number;
  officeRef: OfficeRef;
  dungeon: DungeonStats;
}) => {
  const [open, setOpen] = useState(false);
  const [hover, setHover] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const gateRef = useRef<HTMLButtonElement>(null);
  const gateTop = DUNGEON_HIT.y * scale + CANVAS_BORDER;
  const toLogical = (ev: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = ev.currentTarget;
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((ev.clientX - rect.left - canvas.clientLeft) * WORLD_W) / canvas.clientWidth,
      y: ((ev.clientY - rect.top - canvas.clientTop) * WORLD_H) / canvas.clientHeight,
    };
  };
  const closeCard = () => {
    setOpen(false);
    gateRef.current?.focus({ preventScroll: true });
  };
  useEffect(() => {
    officeRef.current?.setGateLit(open || hover);
  }, [open, hover, officeRef, dungeon.since]); // `since` changes when the engine is cleared (Live/Demo switch)
  useEffect(() => {
    if (!open) return;
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === "Escape") {
        setOpen(false);
        gateRef.current?.focus({ preventScroll: true });
      }
    };
    const onDown = (ev: MouseEvent) => {
      const target = ev.target as Node;
      if (gateRef.current?.contains(target) || boxRef.current?.querySelector(".dcard")?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onDown);
    };
  }, [open]);
  return (
    <div className="stage" ref={stageRef}>
      <div className="frame">
        <div className="stagebox" ref={boxRef}>
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
          <button
            type="button"
            ref={gateRef}
            className="gatehit"
            aria-label={m.dungeon_gate_label()}
            title={m.dungeon_gate_label()}
            aria-expanded={open}
            style={{
              left: DUNGEON_HIT.x * scale + CANVAS_BORDER,
              top: gateTop,
              width: DUNGEON_HIT.w * scale,
              height: DUNGEON_HIT.h * scale,
            }}
            onClick={() => setOpen((was) => !was)}
            onMouseEnter={() => setHover(true)}
            onMouseLeave={() => setHover(false)}
            onFocus={() => setHover(true)}
            onBlur={() => setHover(false)}
          />
          {open && (
            <DungeonCard
              stats={dungeon}
              officeRef={officeRef}
              top={gateTop + DUNGEON_HIT.h * scale + CARD_GAP}
              onClose={closeCard}
            />
          )}
        </div>
      </div>
    </div>
  );
};
