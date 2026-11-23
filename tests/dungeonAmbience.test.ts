import { afterEach, describe, expect, it, vi } from "vitest";

import {
  AMBIENCE_PROPS,
  BRAZIER_POS,
  FRONT_BAND,
  TORCH_POS,
  drawAmbienceBack,
  drawAmbienceFront,
  drawBrazierDim,
  floorTone,
  mixHex,
  wallTone,
} from "@/lib/office/dungeonAmbience";
import {
  DUNGEON_SPOTS,
  LORD_SPOTS,
  drawDungeonBack,
  drawDungeonFront,
  dungeonLordPoint,
  dungeonMonsterPoint,
  dungeonStairsPoint,
} from "@/lib/office/dungeonScene";
import { VIEW_W, VIEW_X0, WORLD_H } from "@/lib/office/layout";

interface Fill {
  color: string;
  x: number;
  y: number;
  width: number;
  height: number;
  alpha: number;
}
const mockCtx = () => {
  const fills: Fill[] = [];
  const state: Record<string, unknown> = { fillStyle: "", globalAlpha: 1 };
  const ctx = new Proxy(state, {
    get: (target, key: string) => {
      if (key in target) return target[key];
      if (key === "fillRect")
        return (x: number, y: number, width: number, height: number) =>
          fills.push({ color: String(target.fillStyle), x, y, width, height, alpha: Number(target.globalAlpha) });
      return () => undefined;
    },
    set: (target, key: string, value) => {
      target[key] = value;
      return true;
    },
  });
  return { ctx: ctx as unknown as CanvasRenderingContext2D, fills };
};
type Box = { x0: number; y0: number; x1: number; y1: number };
const hits = (left: Box, right: Box) =>
  left.x0 < right.x1 && right.x0 < left.x1 && left.y0 < right.y1 && right.y0 < left.y1;
const HEX = /^#[0-9a-f]{6}$/;
const FLOORS = [1, 2, 3];

/** the boxes characters occupy on a floor: raiders (16x24) with their foes (20x20) on B1/B2, the ring and the Lord on B3 */
const characterBoxes = (floor: number): Box[] => {
  if (floor >= 3) {
    const lord = dungeonLordPoint();
    return [
      ...LORD_SPOTS.map((spot) => ({ x0: spot.x - 8, y0: spot.y - 24, x1: spot.x + 8, y1: spot.y })),
      { x0: lord.x - 24, y0: lord.y - 48, x1: lord.x + 24, y1: lord.y },
    ];
  }
  return DUNGEON_SPOTS.flatMap((spot) => {
    const foe = dungeonMonsterPoint(spot);
    return [
      { x0: spot.x - 8, y0: spot.y - 24, x1: spot.x + 8, y1: spot.y },
      { x0: foe.x - 10, y0: foe.y - 20, x1: foe.x + 10, y1: foe.y },
    ];
  });
};

afterEach(() => vi.unstubAllGlobals());

describe("ambience props", () => {
  it("keeps every solid prop off the raider spots, foes, the Lord's area, the stairs and the throne dais", () => {
    const THRONE_DAIS: Box = { x0: 286, y0: 60, x1: VIEW_X0 + VIEW_W, y1: 104 };
    const LORD_ARENA: Box = { x0: 140, y0: 40, x1: 290, y1: 180 };
    const stairs = dungeonStairsPoint(1);
    const STAIRS_DOWN: Box = { x0: VIEW_X0, y0: 186, x1: stairs.x + 40, y1: WORLD_H };
    expect(AMBIENCE_PROPS.length).toBeGreaterThan(10);
    for (const prop of AMBIENCE_PROPS) {
      const box = { x0: prop.x, y0: prop.y, x1: prop.x + prop.w, y1: prop.y + prop.h };
      expect(box.x0, prop.kind).toBeGreaterThanOrEqual(VIEW_X0 - 10);
      expect(box.x1, prop.kind).toBeLessThanOrEqual(VIEW_X0 + VIEW_W + 10);
      expect(box.y1, prop.kind).toBeLessThanOrEqual(WORLD_H);
      for (const body of characterBoxes(prop.floor))
        expect(hits(box, body), `${prop.kind} on B${prop.floor} at ${prop.x},${prop.y}`).toBe(false);
      if (prop.floor === 3) {
        expect(hits(box, THRONE_DAIS), `${prop.kind} on the dais`).toBe(false);
        expect(hits(box, LORD_ARENA), `${prop.kind} in the Lord's arena`).toBe(false);
      } else expect(hits(box, STAIRS_DOWN), `${prop.kind} on the stairs`).toBe(false);
    }
  });
});

describe("ambience lighting", () => {
  it("returns opaque hex colours, deterministic per pixel", () => {
    for (const floor of FLOORS)
      for (const [x, y] of [
        [-80, 70],
        [66, 80],
        [200, 150],
        [380, 210],
      ]) {
        const first = floorTone(floor, x, y, "#2a2b3a");
        expect(first).toMatch(HEX);
        expect(floorTone(floor, x, y, "#2a2b3a")).toBe(first);
        expect(wallTone(floor, x, y % 60, "#2b2d3d")).toMatch(HEX);
      }
  });

  it("lights the floor warm under a torch and darker far from every light", () => {
    const luma = (hex: string) => {
      const value = parseInt(hex.slice(1), 16);
      return ((value >> 16) & 255) * 0.3 + ((value >> 8) & 255) * 0.6 + (value & 255) * 0.1;
    };
    const base = "#2a2b3a";
    const torch = TORCH_POS[1];
    let near = 0,
      far = 0;
    for (let k = 0; k < 12; k++) {
      near += luma(floorTone(1, torch.x + k - 6, 76 + (k % 3), base));
      far += luma(floorTone(1, 40 + k, 206 + (k % 3), base));
    }
    expect(near).toBeGreaterThan(far);
    const lit = floorTone(1, torch.x, 78, base);
    expect(parseInt(lit.slice(1, 3), 16)).toBeGreaterThan(parseInt(base.slice(1, 3), 16)); // redder than plain stone
  });

  it("mixes hex colours", () => {
    expect(mixHex("#000000", "#ffffff", 0.5)).toBe("#808080");
    expect(mixHex("#102030", "#102030", 0.7)).toBe("#102030");
  });

  it("places braziers and torches inside the walls", () => {
    for (const point of [...TORCH_POS, ...BRAZIER_POS]) {
      expect(point.x).toBeGreaterThanOrEqual(VIEW_X0);
      expect(point.x).toBeLessThan(VIEW_X0 + VIEW_W);
      expect(point.y).toBeLessThan(64);
    }
  });
});

describe("ambience drawing", () => {
  it("never paints a translucent pixel in any floor's back layer", () => {
    for (const floor of FLOORS)
      for (const time of [0, 1.3, 7.7]) {
        const { ctx, fills } = mockCtx();
        drawDungeonBack(ctx, time, false, floor);
        for (const fill of fills) expect(fill.alpha, `${fill.color} on B${floor}`).toBe(1);
      }
  });

  it("is deterministic under reduced motion", () => {
    for (const floor of FLOORS) {
      const first = mockCtx(),
        second = mockCtx();
      drawAmbienceBack(first.ctx, 1, true, floor);
      drawAmbienceFront(first.ctx, 1, true, floor);
      drawAmbienceBack(second.ctx, 8.8, true, floor);
      drawAmbienceFront(second.ctx, 8.8, true, floor);
      expect(second.fills).toEqual(first.fills);
      const back = mockCtx(),
        back2 = mockCtx();
      drawDungeonBack(back.ctx, 0.5, true, floor);
      drawDungeonBack(back2.ctx, 12.5, true, floor);
      expect(back2.fills).toEqual(back.fills);
    }
  });

  it("animates in motion mode", () => {
    for (const floor of FLOORS) {
      const first = mockCtx(),
        second = mockCtx();
      drawAmbienceBack(first.ctx, 1, false, floor);
      drawAmbienceBack(second.ctx, 1.4, false, floor);
      expect(JSON.stringify(second.fills)).not.toBe(JSON.stringify(first.fills));
    }
  });

  it("keeps animated front pieces in the top band, opaque, clear of every character", () => {
    for (const floor of FLOORS) {
      const bodies = characterBoxes(floor);
      for (let time = 0; time < 60; time += 1.7) {
        const { ctx, fills } = mockCtx();
        drawAmbienceFront(ctx, time, false, floor);
        for (const fill of fills) {
          expect(fill.alpha).toBe(1);
          expect(fill.y + fill.height, JSON.stringify(fill)).toBeLessThanOrEqual(FRONT_BAND);
          const box = { x0: fill.x, y0: fill.y, x1: fill.x + fill.width, y1: fill.y + fill.height };
          for (const body of bodies) expect(hits(box, body)).toBe(false);
        }
      }
    }
  });

  it("the whole front layer, animated, only touches the top band and the edges, never a character", () => {
    const EDGE = 3;
    for (const floor of FLOORS) {
      const bodies = characterBoxes(floor);
      for (const time of [0, 2.1, 9.4]) {
        const { ctx, fills } = mockCtx();
        drawDungeonFront(ctx, time, false, floor);
        for (const fill of fills) {
          const side = fill.x < VIEW_X0 + EDGE || fill.x + fill.width > VIEW_X0 + VIEW_W - EDGE;
          const top = fill.y + fill.height <= FRONT_BAND;
          const bottom = fill.y >= WORLD_H - EDGE;
          expect(side || top || bottom, `${JSON.stringify(fill)} on B${floor}`).toBe(true);
          const box = { x0: fill.x, y0: fill.y, x1: fill.x + fill.width, y1: fill.y + fill.height };
          if (!side && !bottom) for (const body of bodies) expect(hits(box, body)).toBe(false);
        }
      }
    }
  });

  it("draws a full floor without a canvas and with cached layers", () => {
    for (const floor of FLOORS) {
      const { ctx, fills } = mockCtx();
      drawDungeonBack(ctx, 2, false, floor);
      expect(fills.length).toBeGreaterThan(2000);
      for (const fill of fills) expect(fill.color).toMatch(HEX);
    }
    const layer = mockCtx().ctx;
    vi.stubGlobal("document", { createElement: () => ({ width: 0, height: 0, getContext: () => layer }) });
    const { ctx } = mockCtx();
    expect(() => {
      for (const floor of FLOORS) {
        drawDungeonBack(ctx, 3, false, floor);
        drawDungeonFront(ctx, 3, false, floor);
      }
      for (const dim of [0, 0.3, 0.6, 1]) drawBrazierDim(ctx, dim);
    }).not.toThrow();
  });

  it("brazier dimming draws nothing without a canvas or at zero", () => {
    const { ctx, fills } = mockCtx();
    drawBrazierDim(ctx, 0);
    drawBrazierDim(ctx, 1);
    expect(fills).toHaveLength(0);
  });
});
