import { afterEach, describe, expect, it, vi } from "vitest";

import {
  DUNGEON_FLOORS,
  DUNGEON_IDLERS,
  DUNGEON_SPOTS,
  drawDungeonBack,
  drawDungeonFront,
  dungeonLordPoint,
  dungeonMonsterPoint,
  dungeonSpotIndex,
  dungeonSpotOf,
  dungeonSpotsOf,
  dungeonStairsPoint,
  LORD_SPOTS,
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

describe("dungeon floors", () => {
  it("has three floors, B1 and B2 sharing the hall spots and B3 ringing the Lord", () => {
    expect(DUNGEON_FLOORS).toBe(3);
    expect(dungeonSpotsOf(1)).toBe(DUNGEON_SPOTS);
    expect(dungeonSpotsOf(2)).toBe(DUNGEON_SPOTS);
    expect(dungeonSpotsOf(3)).toBe(LORD_SPOTS);
    expect(dungeonSpotOf(4, 2)).toEqual(DUNGEON_SPOTS[4]);
    expect(dungeonSpotOf(4, 3)).toEqual(LORD_SPOTS[4]);
    expect(dungeonSpotOf(999, 3)).toEqual(LORD_SPOTS[LORD_SPOTS.length - 1]);
  });

  it("offers as many floor 3 spots as the other floors, all distinct and inside the canvas", () => {
    expect(LORD_SPOTS.length).toBe(DUNGEON_SPOTS.length);
    expect(new Set(LORD_SPOTS.map((spot) => `${spot.x},${spot.y}`)).size).toBe(LORD_SPOTS.length);
    for (const spot of LORD_SPOTS) {
      expect(spot.x - CHAR_HALF_W).toBeGreaterThanOrEqual(VIEW_X0);
      expect(spot.x + CHAR_HALF_W).toBeLessThanOrEqual(VIEW_X0 + VIEW_W);
      expect(spot.y - CHAR_H).toBeGreaterThan(0);
      expect(spot.y).toBeLessThan(WORLD_H);
    }
  });

  it("keeps floor 3 raiders to the left of the Lord, never inside its 48px body, spread over three rings", () => {
    const lord = dungeonLordPoint();
    const LORD_HALF_W = 24;
    for (const spot of LORD_SPOTS) expect(spot.x + CHAR_HALF_W).toBeLessThanOrEqual(lord.x - LORD_HALF_W + 4);
    expect(new Set(LORD_SPOTS.map((spot) => spot.x)).size).toBeGreaterThan(8);
    // the first slots surround it: some above and some below its feet line
    const first = LORD_SPOTS.slice(0, 8);
    expect(first.some((spot) => spot.y < lord.y)).toBe(true);
    expect(first.some((spot) => spot.y > lord.y)).toBe(true);
  });

  it("puts the stairs down in the bottom-left corner, inside the canvas", () => {
    const stairs = dungeonStairsPoint(1);
    expect(stairs.x).toBeGreaterThanOrEqual(VIEW_X0);
    expect(stairs.y).toBeLessThan(WORLD_H);
  });

  it("draws every floor with its own art, with and without a canvas cache", () => {
    const sums: string[] = [];
    for (const floor of [1, 2, 3]) {
      const { ctx, fills } = mockCtx();
      drawDungeonBack(ctx, 1, true, floor);
      expect(fills.length).toBeGreaterThan(500);
      sums.push(fills.map((fill) => `${fill.color}${fill.x}${fill.y}`).join(""));
    }
    expect(new Set(sums).size).toBe(DUNGEON_FLOORS);
    const layerCtx = mockCtx().ctx;
    vi.stubGlobal("document", { createElement: () => ({ width: 0, height: 0, getContext: () => layerCtx }) });
    const { ctx } = mockCtx();
    expect(() => {
      for (const floor of [1, 2, 3, 0, 7]) drawDungeonBack(ctx, 2, false, floor);
    }).not.toThrow();
  });

  it("B2 paints water and ghost lantern colours, B3 paints lava and the throne, B1 neither", () => {
    const colorsOf = (floor: number) => {
      const { ctx, fills } = mockCtx();
      drawDungeonBack(ctx, 1, true, floor);
      return new Set(fills.map((fill) => fill.color));
    };
    expect(colorsOf(2).has("#9ff5ee")).toBe(true); // ghost lantern flame
    expect(colorsOf(2).has("#2f9aa0")).toBe(true); // flooded channel
    expect(colorsOf(1).has("#9ff5ee")).toBe(false);
    expect(colorsOf(3).has("#ffe14a")).toBe(true); // lava falls
    expect(colorsOf(3).has("#8a7cc0")).toBe(true); // throne obsidian
    expect(colorsOf(1).has("#8a7cc0")).toBe(false);
  });

  it("every floor is static under reduced motion", () => {
    for (const floor of [1, 2, 3]) {
      const first = mockCtx(),
        second = mockCtx();
      drawDungeonBack(first.ctx, 1, true, floor);
      drawDungeonBack(second.ctx, 9.9, true, floor);
      expect(second.fills).toEqual(first.fills);
    }
  });
});
