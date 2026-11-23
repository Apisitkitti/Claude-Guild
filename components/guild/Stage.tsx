import { useCallback, useEffect, useRef, useState, type RefObject } from "react";

import type { DungeonStats } from "@/lib/office/dungeon";
import { DUNGEON_FLOORS } from "@/lib/office/dungeonScene";
import { GM_HIT_ID, type QuestView } from "@/lib/office/engine";
import { BOARD_HIT, DUNGEON_HIT, LORD_PIP, VIEW_W, VIEW_X0, WORLD_H } from "@/lib/office/layout";
import { m } from "@/paraglide/messages";

import { DungeonCard } from "./DungeonCard";
import { QuestBoardCard } from "./QuestBoardCard";
import type { OfficeRef } from "./types";

/** canvas border (see `.frame canvas` in globals.css): the overlay's origin is inside it */
const CANVAS_BORDER = 3;
const CARD_GAP = 4;
const FLOORS = Array.from({ length: DUNGEON_FLOORS }, (_, i) => i + 1);
const FLOOR_NAMES = [m.dungeon_floor_name_1, m.dungeon_floor_name_2, m.dungeon_floor_name_3];
/** caption of a floor while nobody raids anywhere in the dungeon */
const FLOOR_QUIET = [m.dungeon_floor_quiet_1, m.dungeon_floor_quiet_2, m.dungeon_floor_quiet_3];

export const Stage = ({
  canvasRef,
  stageRef,
  scale,
  officeRef,
  dungeon,
  quests,
  viewScene,
  viewFloor,
  onOpenReport,
}: {
  canvasRef: RefObject<HTMLCanvasElement | null>;
  stageRef: RefObject<HTMLDivElement | null>;
  scale: number;
  officeRef: OfficeRef;
  dungeon: DungeonStats;
  /** Quest Board: every session's todo list */
  quests: QuestView[];
  /** the engine's scene from the view snapshot: selecting a raider (or a field adventurer) switches it from outside */
  viewScene: "guild" | "dungeon";
  /** the dungeon floor on screen (1..3), mirrored from the engine */
  viewFloor: number;
  /** the Guild Master was clicked on the canvas: open his report */
  onOpenReport: () => void;
}) => {
  const [open, setOpen] = useState(false);
  const [hover, setHover] = useState(false);
  const [boardOpen, setBoardOpen] = useState(false);
  /** pointer position (box-relative px) while hovering the Guild Master, else null */
  const [gmTip, setGmTip] = useState<{ x: number; y: number } | null>(null);
  /** screen-reader text, set once when the dungeon scene is entered (the visible caption is not a live region) */
  const [entered, setEntered] = useState("");
  const boxRef = useRef<HTMLDivElement>(null);
  const captionRef = useRef("");
  const gateRef = useRef<HTMLButtonElement>(null);
  const boardRef = useRef<HTMLButtonElement>(null);
  const backRef = useRef<HTMLButtonElement>(null);
  /** the scene the focus was last moved for: focus follows only a real switch, not the first render */
  const focusedScene = useRef<"guild" | "dungeon">("guild");
  const gateTop = DUNGEON_HIT.y * scale + CANVAS_BORDER;
  const scene = viewScene; // the engine owns the scene; the view snapshot mirrors it (selection can change it too)
  const inDungeon = scene === "dungeon";
  const floorCount = dungeon.floorRaiders[viewFloor - 1] ?? 0;
  const floorName = FLOOR_NAMES[viewFloor - 1]?.() ?? "";
  const caption =
    floorCount > 0
      ? m.dungeon_floor_caption({ floor: viewFloor, name: floorName, count: floorCount })
      : dungeon.raidersShown > 0
        ? m.dungeon_floor_caption_empty({ floor: viewFloor, name: floorName })
        : (FLOOR_QUIET[viewFloor - 1] ?? m.dungeon_floor_quiet_1)({ floor: viewFloor, name: floorName });
  const toLogical = (ev: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = ev.currentTarget;
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((ev.clientX - rect.left - canvas.clientLeft) * VIEW_W) / canvas.clientWidth + VIEW_X0,
      y: ((ev.clientY - rect.top - canvas.clientTop) * WORLD_H) / canvas.clientHeight,
    };
  };
  const closeBoard = useCallback(() => {
    setBoardOpen(false);
    boardRef.current?.focus({ preventScroll: true });
  }, []);
  const closeCard = () => {
    setOpen(false);
    gateRef.current?.focus({ preventScroll: true });
  };
  const enterDungeon = () => {
    officeRef.current?.setScene("dungeon");
    setOpen(false);
    setHover(false);
  };
  const watchLord = () => {
    officeRef.current?.setScene("dungeon");
    officeRef.current?.setDungeonFloor(DUNGEON_FLOORS);
    setOpen(false);
    setHover(false);
  };
  const pickFloor = (floor: number) => officeRef.current?.setDungeonFloor(floor);
  const backToGuild = () => {
    officeRef.current?.setScene("guild");
  };
  useEffect(() => {
    captionRef.current = caption;
  }, [caption]);
  useEffect(() => {
    setEntered(inDungeon ? captionRef.current : "");
  }, [inDungeon]);
  useEffect(() => {
    // the button that was pressed unmounts with its scene: hand the focus to the way back (or to the gate again).
    // Only when the focus was lost with it (or is still on the stage): a Live/Demo switch keeps it on the header.
    if (focusedScene.current === scene) return;
    focusedScene.current = scene;
    const active = document.activeElement;
    if (active && active !== document.body && !boxRef.current?.contains(active)) return;
    (inDungeon ? backRef : gateRef).current?.focus({ preventScroll: true });
  }, [scene, inDungeon]);
  useEffect(() => {
    if (!inDungeon) return;
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key !== "Escape" || ev.defaultPrevented) return;
      const target = ev.target as HTMLElement | null;
      if (target && (target.closest("input, textarea, select") || target.isContentEditable)) return;
      officeRef.current?.setScene("guild");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [inDungeon, officeRef]);
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
            style={{ width: VIEW_W * scale, height: WORLD_H * scale, cursor: gmTip ? "pointer" : undefined }}
            onMouseMove={(ev) => {
              const point = toLogical(ev);
              const hitId = officeRef.current?.hit(point.x, point.y) ?? null;
              if (hitId === GM_HIT_ID) {
                const box = boxRef.current?.getBoundingClientRect();
                officeRef.current?.setHover(null);
                setGmTip({ x: ev.clientX - (box?.left ?? 0), y: ev.clientY - (box?.top ?? 0) });
                return;
              }
              setGmTip(null);
              officeRef.current?.setHover(hitId);
            }}
            onMouseLeave={() => {
              setGmTip(null);
              officeRef.current?.setHover(null);
            }}
            onClick={(ev) => {
              const point = toLogical(ev);
              if (officeRef.current?.hit(point.x, point.y) !== GM_HIT_ID) return;
              setGmTip(null);
              onOpenReport();
            }}
          />
          {gmTip && (
            <div className="gm-tip" role="tooltip" style={{ left: gmTip.x, top: gmTip.y }}>
              {m.gm_report_hover()}
            </div>
          )}
          {inDungeon && (
            <>
              <button type="button" ref={backRef} className="dungeonback" onClick={backToGuild}>
                <span aria-hidden="true">⬅</span> {m.dungeon_back()}
              </button>
              <p className="dungeoncap">{caption}</p>
              <div className="floortabs" role="group" aria-label={m.dungeon_floor_tabs_label()}>
                {FLOORS.map((floor) => (
                  <button
                    key={floor}
                    type="button"
                    className={floor === viewFloor ? "floortab floortab--on" : "floortab"}
                    aria-pressed={floor === viewFloor}
                    title={m.dungeon_floor_tab_title({
                      floor,
                      name: FLOOR_NAMES[floor - 1](),
                      count: dungeon.floorRaiders[floor - 1] ?? 0,
                    })}
                    onClick={() => pickFloor(floor)}
                  >
                    {m.dungeon_floor_tab({ floor, count: dungeon.floorRaiders[floor - 1] ?? 0 })}
                  </button>
                ))}
              </div>
              <p className="sr-only" role="status" aria-live="polite">
                {entered}
              </p>
            </>
          )}
          {!inDungeon && (
            <button
              type="button"
              ref={gateRef}
              className="gatehit"
              aria-label={m.dungeon_gate_label()}
              title={m.dungeon_gate_label()}
              aria-expanded={open}
              style={{
                left: (DUNGEON_HIT.x - VIEW_X0) * scale + CANVAS_BORDER,
                top: gateTop,
                width: DUNGEON_HIT.w * scale,
                height: DUNGEON_HIT.h * scale,
              }}
              onClick={() => {
                setBoardOpen(false);
                setOpen((was) => !was);
              }}
              onDoubleClick={enterDungeon}
              onMouseEnter={() => setHover(true)}
              onMouseLeave={() => setHover(false)}
              onFocus={() => setHover(true)}
              onBlur={() => setHover(false)}
            />
          )}
          {!inDungeon && dungeon.lordFight && (
            <button
              type="button"
              className="gatehit"
              aria-label={m.dungeon_lord_pip_label()}
              title={m.dungeon_lord_pip_label()}
              style={{
                left: (LORD_PIP.x - VIEW_X0) * scale + CANVAS_BORDER,
                top: LORD_PIP.y * scale + CANVAS_BORDER,
                width: LORD_PIP.w * scale,
                height: LORD_PIP.h * scale,
              }}
              onClick={watchLord}
            />
          )}
          {!inDungeon && (
            <button
              type="button"
              ref={boardRef}
              className="gatehit"
              aria-label={m.quest_board_hit_label()}
              title={m.quest_board_hit_label()}
              aria-expanded={boardOpen}
              style={{
                left: (BOARD_HIT.x - VIEW_X0) * scale + CANVAS_BORDER,
                top: BOARD_HIT.y * scale + CANVAS_BORDER,
                width: BOARD_HIT.w * scale,
                height: BOARD_HIT.h * scale,
              }}
              onClick={() => {
                setOpen(false);
                setBoardOpen((was) => !was);
              }}
            />
          )}
          {boardOpen && !inDungeon && (
            <QuestBoardCard
              quests={quests}
              left={(BOARD_HIT.x + BOARD_HIT.w - VIEW_X0) * scale + CANVAS_BORDER + CARD_GAP}
              top={BOARD_HIT.y * scale + CANVAS_BORDER}
              anchorRef={boardRef}
              onClose={closeBoard}
            />
          )}
          {open && !inDungeon && (
            <DungeonCard
              stats={dungeon}
              officeRef={officeRef}
              top={gateTop + DUNGEON_HIT.h * scale + CARD_GAP}
              onClose={closeCard}
              onEnter={enterDungeon}
            />
          )}
        </div>
      </div>
    </div>
  );
};
