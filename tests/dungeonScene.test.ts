import { afterEach, describe, expect, it, vi } from "vitest";

import {
  DUNGEON_IDLERS,
  DUNGEON_SPOTS,
  drawDungeonBack,
  drawDungeonFront,
  dungeonMonsterPoint,
  dungeonSpotIndex,
  dungeonSpotOf,
} from "@/lib/office/dungeonScene";
import { MON_DX, VIEW_W, VIEW_X0, WORLD_H } from "@/lib/office/layout";

const CHAR_HALF_W = 8;
const CHAR_H = 24;
const MON_HALF_W = 10;
const MON_H = 20;

/** a 2d context that accepts every call and records the colours and rects it was asked to fill */
const mockCtx = () => {
  const fills: { color: string; x: number; y: number; width: number; height: number }[] = [];
  const state: Record<string, unknown> = { fillStyle: "", globalAlpha: 1 };
  const ctx = new Proxy(state, {
    get: (target, key: string) => {
      if (key in target) return target[key];
      if (key === "fillRect")
        return (x: number, y: number, width: number, height: number) =>
          fills.push({ color: String(target.fillStyle), x, y, width, height });
      if (key === "measureText") return () => ({ width: 10 });
      return () => undefined;
    },
    set: (target, key: string, value) => {
      target[key] = value;
      return true;
    },
  });
  return { ctx: ctx as unknown as CanvasRenderingContext2D, fills };
};

afterEach(() => vi.unstubAllGlobals());

describe("dungeon spots", () => {
  it("offers at least 16 raider spots", () => {
    expect(DUNGEON_SPOTS.length).toBeGreaterThanOrEqual(16);
  });

  it("keeps every raider and its foe (22px to the right) inside the canvas", () => {
    for (const spot of DUNGEON_SPOTS) {
      const foe = dungeonMonsterPoint(spot);
      expect(foe.x - spot.x).toBe(MON_DX);
      expect(spot.x - CHAR_HALF_W).toBeGreaterThanOrEqual(VIEW_X0);
      expect(foe.x + MON_HALF_W).toBeLessThanOrEqual(VIEW_X0 + VIEW_W);
      expect(spot.y - CHAR_H).toBeGreaterThan(0);
      expect(spot.y).toBeLessThan(WORLD_H);
    }
  });

  it("never overlaps one raider-plus-foe box with another", () => {
    const boxes = DUNGEON_SPOTS.map((spot) => {
      const foe = dungeonMonsterPoint(spot);
      return { x0: spot.x - CHAR_HALF_W, x1: foe.x + MON_HALF_W, y0: spot.y - Math.max(CHAR_H, MON_H), y1: spot.y };
    });
    for (let i = 0; i < boxes.length; i++) {
      for (let j = i + 1; j < boxes.length; j++) {
        const first = boxes[i],
          second = boxes[j];
        const apart = first.x1 <= second.x0 || second.x1 <= first.x0 || first.y1 <= second.y0 || second.y1 <= first.y0;
        expect(apart, `spot ${i} overlaps spot ${j}`).toBe(true);
      }
    }
  });

  it("has no duplicate positions and spreads over several chambers", () => {
    expect(new Set(DUNGEON_SPOTS.map((spot) => `${spot.x},${spot.y}`)).size).toBe(DUNGEON_SPOTS.length);
    expect(new Set(DUNGEON_SPOTS.map((spot) => spot.x)).size).toBeGreaterThanOrEqual(6);
  });

  it("spreads the first slots over the guard hall, slime vault and lava lair", () => {
    const chamber = (x: number) => (x < 90 ? 0 : x < 238 ? 1 : 2);
    expect(new Set(DUNGEON_SPOTS.slice(0, 3).map((spot) => chamber(spot.x))).size).toBe(3);
    expect(dungeonSpotIndex(1)).toBe(1);
    expect(dungeonSpotOf(1)).toEqual(DUNGEON_SPOTS[1]);
  });

  it("keeps the sleeping monsters on the floor", () => {
    for (const idler of DUNGEON_IDLERS) {
      expect(idler.x - MON_HALF_W).toBeGreaterThanOrEqual(VIEW_X0);
      expect(idler.x + MON_HALF_W).toBeLessThanOrEqual(VIEW_X0 + VIEW_W);
      expect(idler.y).toBeLessThan(WORLD_H);
    }
  });
});

describe("dungeon drawing", () => {
  it("draws back and front without a canvas cache (no document)", () => {
    const { ctx, fills } = mockCtx();
    for (const still of [false, true]) {
      for (const time of [0, 0.37, 5.2, 123.4]) {
        drawDungeonBack(ctx, time, still);
        drawDungeonFront(ctx, time, still);
      }
    }
    expect(fills.length).toBeGreaterThan(500);
  });

  it("draws through cached layers when a document exists", () => {
    const { ctx } = mockCtx();
    const layerCtx = mockCtx().ctx;
    vi.stubGlobal("document", { createElement: () => ({ width: 0, height: 0, getContext: () => layerCtx }) });
    expect(() => {
      drawDungeonBack(ctx, 1, false);
      drawDungeonFront(ctx, 1, false);
    }).not.toThrow();
  });

  it("is static under reduced motion and never fills outside the canvas", () => {
    const first = mockCtx(),
      second = mockCtx();
    drawDungeonBack(first.ctx, 1, true);
    drawDungeonFront(first.ctx, 1, true);
    drawDungeonBack(second.ctx, 9.9, true);
    drawDungeonFront(second.ctx, 9.9, true);
    expect(second.fills).toEqual(first.fills);
  });

  it("paints the front only along the top and the sides, never across the middle of the floor", () => {
    const { ctx, fills } = mockCtx();
    drawDungeonFront(ctx, 0, true);
    const EDGE = 3;
    const MAX_TOP = 30;
    const BOTTOM = WORLD_H - 3;
    for (const fill of fills) {
      const side = fill.x < VIEW_X0 + EDGE || fill.x + fill.width > VIEW_X0 + VIEW_W - EDGE;
      const top = fill.y + fill.height <= MAX_TOP;
      const bottom = fill.y >= BOTTOM;
      expect(side || top || bottom, JSON.stringify(fill)).toBe(true);
    }
  });
});
