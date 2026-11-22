import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ADV_CLASSES, type AdvClass, type Look } from "@/lib/office/palette";
import { charSprite, internSprite, type Pose } from "@/lib/office/sprites";

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

/** how many of the 16x24 pixels are painted differently in the two sprites */
const diff = (spriteA: HTMLCanvasElement, spriteB: HTMLCanvasElement): number => {
  const cellsA = cellsOf(spriteA),
    cellsB = cellsOf(spriteB);
  let count = 0;
  for (const key of new Set([...cellsA.keys(), ...cellsB.keys()])) if (cellsA.get(key) !== cellsB.get(key)) count++;
  return count;
};

const lookOf = (cls: AdvClass): Look => ({ hair: "#8b5e3c", shirt: "#4a6fa5", skin: "#e8c9a0", cls });
const POSES: Pose[] = ["idle", "walk", "attack", "cast", "read", "write", "hand_up", "hurt", "drink", "cheer", "rest"];
/** every class must differ from every other by at least this many pixels (of ~200 painted) */
const MIN_DIFF = 60;
/** poses where the character stands on its feet (rest sits, but still lands on row 23) */
const STANDING: Pose[] = POSES.filter((pose) => pose !== "rest");
/** an outline pixel is dark; any fill colour has a brighter channel than this */
const DARK = 90;
/** hand colour: gloves for armoured / leather classes, bare skin for robed ones */
const GLOVE: Record<AdvClass, string> = {
  warrior: "#eef3fa",
  mage: "#e8c9a0",
  rogue: "#2a2530",
  cleric: "#e8c9a0",
  ranger: "#5c3d28",
};

describe("class sprites", () => {
  beforeEach(() => {
    vi.stubGlobal("document", { createElement: () => fakeCanvas() });
  });
  afterEach(() => vi.unstubAllGlobals());

  it("draws every class in every pose on a 16x24 grid with opaque colours", () => {
    for (const cls of ADV_CLASSES) {
      for (const pose of POSES) {
        for (const frame of [0, 1, 2, 3]) {
          const sprite = charSprite(lookOf(cls), pose, frame);
          expect(sprite.width).toBe(16);
          expect(sprite.height).toBe(24);
          const cells = cellsOf(sprite);
          expect(cells.size).toBeGreaterThan(40);
          for (const color of cells.values()) expect(color).toMatch(/^#[0-9a-f]{6}$/);
        }
      }
    }
  });

  it("keeps the feet on row 23 and nothing but the dark outline on row 0 (same anchor for every class)", () => {
    for (const cls of ADV_CLASSES) {
      for (const pose of STANDING) {
        for (const frame of [0, 1, 2, 3]) {
          const cells = cellsOf(charSprite(lookOf(cls), pose, frame));
          const rows = [...cells.keys()].map((key) => Number(key.split(",")[1]));
          expect(Math.max(...rows), `${cls} ${pose} ${frame} feet`).toBe(23);
          for (const [key, color] of cells) {
            if (!key.endsWith(",0") || pose !== "idle") continue;
            const value = parseInt(color.slice(1), 16);
            const brightest = Math.max(value >>> 16, (value >>> 8) & 255, value & 255);
            expect(brightest, `${cls} ${pose} ${frame} top row ${key}`).toBeLessThan(DARK);
          }
        }
      }
    }
  });

  it("holds the weapon hand where the duel code expects it", () => {
    const handOf = (cls: AdvClass, pose: Pose, frame: number, spot: string) =>
      cellsOf(charSprite(lookOf(cls), pose, frame)).get(spot);
    for (const cls of ADV_CLASSES) {
      expect(handOf(cls, "idle", 0, "12,15"), `${cls} idle`).toBe(GLOVE[cls]);
      expect(handOf(cls, "attack", 0, cls === "ranger" ? "11,13" : "12,10"), `${cls} wind-up`).toBe(GLOVE[cls]);
      expect(handOf(cls, "attack", 1, cls === "ranger" ? "11,13" : "11,14"), `${cls} strike`).toBe(GLOVE[cls]);
    }
  });

  it.each(["idle", "walk", "attack", "drink"] as Pose[])("each class looks different from the others (%s)", (pose) => {
    for (const clsA of ADV_CLASSES) {
      for (const clsB of ADV_CLASSES) {
        if (clsA >= clsB) continue;
        expect(
          diff(charSprite(lookOf(clsA), pose, 0), charSprite(lookOf(clsB), pose, 0)),
          `${clsA} vs ${clsB}`,
        ).toBeGreaterThan(MIN_DIFF);
      }
    }
  });

  it("the same class stays recognisable across looks (hair / shirt / skin only recolour)", () => {
    const other: Look = { hair: "#d95763", shirt: "#5fa55a", skin: "#b9805a", cls: "mage" };
    const same = diff(charSprite(lookOf("mage"), "idle", 0), charSprite(other, "idle", 0));
    const across = diff(charSprite(lookOf("mage"), "idle", 0), charSprite(lookOf("rogue"), "idle", 0));
    expect(same).toBeLessThan(across);
    expect(across).toBeGreaterThan(MIN_DIFF);
  });

  it("the squire is its own small design, not a warrior clone", () => {
    for (const pose of ["idle", "walk", "attack", "read", "hand_up"] as const) {
      const squire = internSprite(pose, 0);
      expect(squire.width).toBe(12);
      expect(squire.height).toBe(18);
      expect(cellsOf(squire).size).toBeGreaterThan(30);
    }
  });
});
