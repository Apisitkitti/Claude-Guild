import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { MON_FRAMES, MON_H, MON_W, monsterSprite } from "@/lib/office/monsterSprites";
import { MONSTER_KINDS } from "@/lib/office/palette";

/** a fake canvas that records every pixel it is asked to paint */
const fakeCanvas = () => {
  const cells = new Map<string, string>();
  const ctx = {
    fillStyle: "",
    fillRect: (x: number, y: number) => {
      cells.set(`${x},${y}`, ctx.fillStyle);
    },
  };
  return { width: 0, height: 0, cells, getContext: () => ctx };
};
const cellsOf = (sprite: HTMLCanvasElement): Map<string, string> =>
  (sprite as unknown as { cells: Map<string, string> }).cells;
const diff = (spriteA: HTMLCanvasElement, spriteB: HTMLCanvasElement): number => {
  const cellsA = cellsOf(spriteA),
    cellsB = cellsOf(spriteB);
  let count = 0;
  for (const key of new Set([...cellsA.keys(), ...cellsB.keys()])) if (cellsA.get(key) !== cellsB.get(key)) count++;
  return count;
};
const HEX = /^#[0-9a-f]{6}$/;
const FRAMES = Array.from({ length: MON_FRAMES }, (_, i) => i);

describe("monster sprites", () => {
  beforeEach(() => {
    vi.stubGlobal("document", { createElement: () => fakeCanvas() });
  });
  afterEach(() => vi.unstubAllGlobals());

  it("builds every kind / frame / hurt on a 20x20 canvas with fully opaque hex colours", () => {
    for (const kind of MONSTER_KINDS) {
      for (const frame of FRAMES) {
        for (const hurt of [false, true]) {
          const sprite = monsterSprite(kind, frame, hurt);
          expect(sprite.width).toBe(MON_W);
          expect(sprite.height).toBe(MON_H);
          const cells = cellsOf(sprite);
          expect(cells.size).toBeGreaterThan(80);
          for (const color of cells.values()) expect(color).toMatch(HEX);
        }
      }
    }
  });

  it("animates: every idle frame differs from the others", () => {
    for (const kind of MONSTER_KINDS) {
      for (const frame of FRAMES) {
        const next = (frame + 1) % MON_FRAMES;
        expect(diff(monsterSprite(kind, frame, false), monsterSprite(kind, next, false))).toBeGreaterThan(3);
      }
    }
  });

  it("keeps the feet on the ground line and inside the box", () => {
    for (const kind of MONSTER_KINDS) {
      for (const frame of FRAMES) {
        const rows = [...cellsOf(monsterSprite(kind, frame, false)).keys()].map((key) => Number(key.split(",")[1]));
        const bottom = Math.max(...rows);
        expect(bottom).toBeGreaterThanOrEqual(MON_H - 3);
        expect(bottom).toBeLessThan(MON_H);
        expect(Math.min(...rows)).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it("the hurt flash is a distinct, lighter palette over the same silhouette", () => {
    for (const kind of MONSTER_KINDS) {
      const calm = monsterSprite(kind, 0, false),
        hurt = monsterSprite(kind, 0, true);
      expect(diff(calm, hurt)).toBeGreaterThan(20);
      expect([...cellsOf(hurt).keys()].sort()).toEqual([...cellsOf(calm).keys()].sort());
    }
  });

  it("kinds have distinct silhouettes", () => {
    const shapes = MONSTER_KINDS.map((kind) => [...cellsOf(monsterSprite(kind, 0, false)).keys()].sort().join("|"));
    expect(new Set(shapes).size).toBe(MONSTER_KINDS.length);
  });

  it("caches sprites and wraps frame numbers", () => {
    expect(monsterSprite("slime", 1, false)).toBe(monsterSprite("slime", 1 + MON_FRAMES, false));
    expect(monsterSprite("bat", -1, true)).toBe(monsterSprite("bat", MON_FRAMES - 1, true));
    expect(monsterSprite("bat", Number.NaN, false)).toBe(monsterSprite("bat", 0, false));
  });
});
