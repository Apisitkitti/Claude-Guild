import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { GEAR_TIER_NAMES, gearTier, gearTierName, type GearTier } from "@/lib/office/gearTier";
import { ADV_CLASSES, type AdvClass, type Look } from "@/lib/office/palette";
import { charSprite, type Pose } from "@/lib/office/sprites";

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
const cellsOf = (sprite: HTMLCanvasElement) => (sprite as unknown as { cells: Map<string, string> }).cells;
const diff = (spriteA: HTMLCanvasElement, spriteB: HTMLCanvasElement): number => {
  const cellsA = cellsOf(spriteA),
    cellsB = cellsOf(spriteB);
  let count = 0;
  for (const key of new Set([...cellsA.keys(), ...cellsB.keys()])) if (cellsA.get(key) !== cellsB.get(key)) count++;
  return count;
};

const lookOf = (cls: AdvClass): Look => ({ hair: "#8b5e3c", shirt: "#4a6fa5", skin: "#e8c9a0", cls });
const POSES: Pose[] = ["idle", "walk", "attack", "cast", "read", "write", "hand_up", "hurt", "drink", "cheer", "rest"];
const TIERS: GearTier[] = [0, 1, 2, 3, 4];

describe("gearTier", () => {
  it("maps level boundaries to tiers", () => {
    const expected: [number, GearTier][] = [
      [0, 0],
      [1, 0],
      [4, 0],
      [5, 1],
      [9, 1],
      [10, 2],
      [14, 2],
      [15, 3],
      [19, 3],
      [20, 4],
      [99, 4],
    ];
    for (const [level, tier] of expected) expect(gearTier(level), `Lv${level}`).toBe(tier);
  });

  it("names every tier", () => {
    expect(gearTierName(1)).toBe("novice");
    expect(gearTierName(20)).toBe("legend");
    expect(GEAR_TIER_NAMES).toHaveLength(TIERS.length);
  });
});

describe("charSprite gear tiers", () => {
  beforeEach(() => {
    vi.stubGlobal("document", { createElement: () => fakeCanvas() });
  });
  afterEach(() => vi.unstubAllGlobals());

  it("builds every class x tier x pose x frame at 16x24 with opaque colours and the feet on row 23", () => {
    for (const cls of ADV_CLASSES) {
      for (const tier of TIERS) {
        for (const pose of POSES) {
          for (const frame of [0, 1]) {
            const sprite = charSprite(lookOf(cls), pose, frame, tier);
            expect(sprite.width).toBe(16);
            expect(sprite.height).toBe(24);
            const cells = cellsOf(sprite);
            for (const color of cells.values()) expect(color).toMatch(/^#[0-9a-f]{6}$/);
            if (pose !== "rest") {
              const rows = [...cells.keys()].map((key) => Number(key.split(",")[1]));
              expect(Math.max(...rows), `${cls} t${tier} ${pose} ${frame}`).toBe(23);
            }
          }
        }
      }
    }
  }, 20_000);

  it("tier 0 is the same sprite as the default argument", () => {
    for (const cls of ADV_CLASSES) {
      for (const pose of POSES) {
        expect(charSprite(lookOf(cls), pose, 0, 0)).toBe(charSprite(lookOf(cls), pose, 0));
      }
    }
  });

  it("caches per tier", () => {
    for (const cls of ADV_CLASSES) {
      const sprites = TIERS.map((tier) => charSprite(lookOf(cls), "idle", 0, tier));
      expect(new Set(sprites).size).toBe(TIERS.length);
      for (const tier of TIERS) expect(charSprite(lookOf(cls), "idle", 0, tier)).toBe(sprites[tier]);
    }
  });

  it("every higher tier looks different from the one below it (idle, walk, attack, rest)", () => {
    for (const cls of ADV_CLASSES) {
      for (const pose of ["idle", "walk", "attack", "rest"] as Pose[]) {
        for (const tier of [1, 2, 3, 4] as GearTier[]) {
          const lower = charSprite(lookOf(cls), pose, 0, (tier - 1) as GearTier);
          const upper = charSprite(lookOf(cls), pose, 0, tier);
          expect(diff(lower, upper), `${cls} ${pose} t${tier}`).toBeGreaterThan(3);
        }
      }
    }
  });

  it("keeps nothing but the dark outline on row 0 in idle", () => {
    const dark = 90;
    for (const cls of ADV_CLASSES) {
      for (const tier of TIERS) {
        for (const [key, color] of cellsOf(charSprite(lookOf(cls), "idle", 0, tier))) {
          if (!key.endsWith(",0")) continue;
          const value = parseInt(color.slice(1), 16);
          expect(Math.max(value >>> 16, (value >>> 8) & 255, value & 255), `${cls} t${tier} ${key}`).toBeLessThan(dark);
        }
      }
    }
  });
});
