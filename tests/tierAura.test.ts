import { describe, expect, it } from "vitest";

import { GEAR_TIER_LEVELS, type GearTier } from "@/lib/office/gearTier";
import { ADV_CLASSES, type AdvClass } from "@/lib/office/palette";
import type { Pose } from "@/lib/office/sprites";
import {
  ORBIT_SPARKS,
  TRAIL_COUNT,
  drawCrest,
  drawGroundMark,
  drawTierBack,
  orbitX,
  orbitY,
  trailAge,
  trailX,
  trailY,
} from "@/lib/office/tierAura";
import {
  TIER_OLD_GEAR_S,
  TIER_UP_S,
  capeFrame,
  clampMessageX,
  clampMessageY,
  crestOrigin,
  crestVisible,
  overlayFor,
  shownTier,
  showsBigWeapon,
  tierMessage,
  tierUpAge,
  tierUpPhase,
  wingFrame,
} from "@/lib/office/tierAuraLogic";

const recorder = () => {
  const ops: { color: string; x: number; y: number; w: number; h: number }[] = [];
  const ctx = {
    fillStyle: "",
    fillRect: (x: number, y: number, width: number, height: number) =>
      ops.push({ color: String(ctx.fillStyle), x, y, w: width, h: height }),
  };
  return { ctx: ctx as unknown as CanvasRenderingContext2D, ops };
};
const TIERS: GearTier[] = [0, 1, 2, 3, 4];
const BLOCKERS = { limitSign: false, bubble: false, hovered: false, selected: false, tierUp: false, lunging: false };
const back = (cls: AdvClass, tier: GearTier, time: number, still: boolean, facing = 1, pose: Pose = "idle") => {
  const rec = recorder();
  drawTierBack(rec.ctx, cls, tier, pose, 40, 40, facing, time, still);
  return rec;
};

describe("overlayFor", () => {
  it("adds more at every tier", () => {
    for (const cls of ADV_CLASSES) {
      expect(overlayFor(cls, 0)).toMatchObject({
        weapon: false,
        cape: false,
        back: null,
        ground: "none",
        crest: false,
      });
      expect(overlayFor(cls, 1).crest).toBe(true);
      expect(overlayFor(cls, 2)).toMatchObject({ weapon: true, pads: true, cape: false, back: null });
      expect(overlayFor(cls, 3)).toMatchObject({ cape: true, ground: "elite", back: null, sparkles: false });
      expect(overlayFor(cls, 4)).toMatchObject({ cape: true, ground: "legend", sparkles: true, trail: true });
    }
  });

  it("gives each class its own legend back piece", () => {
    const picks = Object.fromEntries(ADV_CLASSES.map((cls) => [cls, overlayFor(cls, 4).back]));
    expect(picks).toEqual({ warrior: "wings", cleric: "wings", mage: "runes", rogue: "daggers", ranger: "antlers" });
  });

  it("returns the same table entry every call (no per-frame allocation)", () => {
    expect(overlayFor("mage", 4)).toBe(overlayFor("mage", 4));
  });

  it("skips the big weapon where it would float (seated / slumped)", () => {
    expect(showsBigWeapon("idle")).toBe(true);
    expect(showsBigWeapon("rest")).toBe(false);
  });
});

describe("old gear during a tier-up", () => {
  it("shows the previous tier for the first 0.6s and every overlay follows it", () => {
    const early = tierUpPhase(0.1, false);
    expect(shownTier(4, early)).toBe(3);
    expect(shownTier(1, early)).toBe(0);
    expect(shownTier(0, early)).toBe(0);
    expect(shownTier(4, tierUpPhase(TIER_OLD_GEAR_S + 0.01, false))).toBe(4);
    expect(shownTier(4, tierUpPhase(null, false))).toBe(4);
    // the overlays chosen for the shown tier are the previous tier's: no wings / orbit yet
    expect(overlayFor("warrior", shownTier(4, early)).back).toBeNull();
    expect(back("warrior", shownTier(4, early), 0, true).ops.length).toBeLessThan(
      back("warrior", 4, 0, true).ops.length,
    );
  });
});

describe("reduced motion", () => {
  it("returns static frames", () => {
    for (const time of [0, 0.37, 5.2, 99]) {
      expect(capeFrame(time, true)).toBe(0);
      expect(wingFrame(time, true)).toBe(0);
      for (let i = 0; i < ORBIT_SPARKS; i++) {
        expect(orbitX(i, time, true)).toBe(orbitX(i, 0, true));
        expect(orbitY(i, time, true)).toBe(orbitY(i, 0, true));
      }
      for (let i = 0; i < TRAIL_COUNT; i++) expect(trailAge(i, time, true)).toBe(-1);
    }
    expect(tierUpPhase(0.5, true)).toMatchObject({ rise: 0, pillar: 0, ring: null, oldGear: false, active: true });
  });

  it("flutters the cape through three frames when motion is on", () => {
    const frames = new Set([0, 0.1, 0.25, 0.45, 0.7, 1.1].map((time) => capeFrame(time, false)));
    expect(frames).toEqual(new Set([0, 1, 2]));
  });

  it("draws identical pixels at any time when still", () => {
    for (const cls of ADV_CLASSES) {
      expect(back(cls, 4, 7.3, true).ops).toEqual(back(cls, 4, 0, true).ops);
      const first = recorder(),
        second = recorder();
      drawGroundMark(first.ctx, 4, 48, 64, 0, true);
      drawGroundMark(second.ctx, 4, 48, 64, 7.3, true);
      expect(second.ops).toEqual(first.ops);
    }
  });

  it("holds the tier message still: no rise, and the message top is clamped inside the canvas", () => {
    expect(clampMessageY(-20)).toBe(1);
    expect(clampMessageY(30.4)).toBe(30);
  });
});

describe("drawing", () => {
  it("is opaque #rrggbb only and grows with the tier", () => {
    for (const cls of ADV_CLASSES) {
      const counts = TIERS.map((tier) => {
        const { ops } = back(cls, tier, 1.1, false);
        for (const op of ops) expect(op.color).toMatch(/^#[0-9a-f]{6}$/);
        return ops.length;
      });
      expect(counts[0]).toBe(0);
      expect(counts[2]).toBeGreaterThan(counts[0]);
      expect(counts[3]).toBeGreaterThan(counts[2]);
      expect(counts[4]).toBeGreaterThan(counts[3]);
    }
  });

  it("mirrors with the facing", () => {
    const right = back("warrior", 2, 0, true, 1),
      left = back("warrior", 2, 0, true, -1);
    expect(Math.max(...right.ops.map((op) => op.x + op.w))).toBeGreaterThan(40 + 16);
    expect(Math.min(...left.ops.map((op) => op.x))).toBeLessThan(40);
  });

  it("keeps the sparkles outside the 16x24 body box", () => {
    for (let time = 0; time < 10; time += 0.13)
      for (let i = 0; i < ORBIT_SPARKS; i++) {
        const lx = orbitX(i, time, false),
          ly = orbitY(i, time, false);
        expect(lx >= 0 && lx < 16 && ly >= 0 && ly < 24, `${lx},${ly} at ${time}`).toBe(false);
      }
  });

  it("paints ground marks only for elite and legend, and a bigger one for legend", () => {
    const sizes = TIERS.map((tier) => {
      const { ctx, ops } = recorder();
      drawGroundMark(ctx, tier, 50, 50, 0, false);
      return ops.length;
    });
    expect(sizes.slice(0, 3)).toEqual([0, 0, 0]);
    expect(sizes[3]).toBeGreaterThan(0);
    expect(sizes[4]).toBeGreaterThan(sizes[3]);
  });

  it("leaves a short spark trail behind the facing, only when motion is on", () => {
    const alive = Array.from({ length: TRAIL_COUNT }, (_, i) => trailAge(i, 0.3, false)).filter((age) => age >= 0);
    expect(alive.length).toBeGreaterThanOrEqual(3);
    for (const age of alive) {
      expect(trailX(100, 1, age)).toBeLessThan(100);
      expect(trailX(100, -1, age)).toBeGreaterThan(100);
      expect(trailY(100, 0, age)).toBeLessThan(100);
    }
  });
});

describe("crest", () => {
  it("shows for tier 1+ and hides under the sign, bubbles, tag, arrow, tier banner and lunges", () => {
    expect(crestVisible(0, BLOCKERS)).toBe(false);
    for (const tier of [1, 2, 3, 4] as GearTier[]) expect(crestVisible(tier, BLOCKERS)).toBe(true);
    for (const key of Object.keys(BLOCKERS) as (keyof typeof BLOCKERS)[])
      expect(crestVisible(4, { ...BLOCKERS, [key]: true }), key).toBe(false);
  });

  it("floats right above the head and stays put under reduced motion", () => {
    const still = crestOrigin(100, 80, 3.3, true);
    expect(crestOrigin(100, 80, 0, true)).toEqual(still);
    expect(still.y + 5).toBeLessThanOrEqual(80 - 24);
    expect(still.y + 5).toBeGreaterThanOrEqual(80 - 24 - 5);
  });

  it("travels with a dodge hop", () => {
    const flat = crestOrigin(100, 80, 0, true, 0);
    expect(crestOrigin(100, 80, 0, true, 7).y).toBe(flat.y - 7);
  });

  it("draws opaque pixels for every tier", () => {
    for (const tier of [1, 2, 3, 4] as GearTier[]) {
      const { ctx, ops } = recorder();
      drawCrest(ctx, tier, 10, 10);
      expect(ops.length).toBeGreaterThan(5);
      for (const op of ops) expect(op.color).toMatch(/^#[0-9a-f]{6}$/);
    }
  });
});

describe("tier-up", () => {
  const emp = { lvlAt: 10, lvlTo: 20, tierUpAt: -99 };

  it("falls back to the level-up stamp only when the level crosses a tier", () => {
    expect(tierUpAge(emp, 10.5)).toBeCloseTo(0.5);
    expect(tierUpAge({ ...emp, lvlTo: 19 }, 10.5)).toBeNull();
    expect(tierUpAge({ lvlAt: 10, lvlTo: GEAR_TIER_LEVELS[1] }, 10.5)).toBeCloseTo(0.5);
  });

  it("prefers the engine's tierUpAt and ends after two seconds", () => {
    const stamped = { lvlAt: 0, lvlTo: 7, tierUpAt: 50 };
    expect(tierUpAge(stamped, 51)).toBeCloseTo(1);
    expect(tierUpAge(stamped, 50 + TIER_UP_S + 0.01)).toBeNull();
    expect(tierUpAge(stamped, 49)).toBeNull();
  });

  it("wears the old gear for 0.6s, then pops with a ring, rises, and settles", () => {
    expect(tierUpPhase(0.1, false).oldGear).toBe(true);
    expect(tierUpPhase(TIER_OLD_GEAR_S + 0.01, false).oldGear).toBe(false);
    expect(tierUpPhase(0.3, false).ring).toBeNull();
    expect(tierUpPhase(0.9, false).ring).not.toBeNull();
    const rises = [0, 0.2, 0.8, 1.9].map((age) => tierUpPhase(age, false).rise);
    expect(Math.max(...rises)).toBeGreaterThanOrEqual(4);
    expect(Math.max(...rises)).toBeLessThanOrEqual(6);
    expect(rises[0]).toBe(0);
    expect(tierUpPhase(TIER_UP_S, false).active).toBe(false);
    expect(tierUpPhase(null, false).active).toBe(false);
  });
});

describe("overhead message", () => {
  it("is one stack: the tier name over the level", () => {
    expect(tierMessage(20)).toEqual({ title: "LEGEND!", sub: "LV.20" });
    expect(tierMessage(15).title).toBe("ELITE!");
    expect(tierMessage(10).sub).toBe("LV.10");
  });

  it("clamps inside the field on both edges", () => {
    const width = 30;
    const left = clampMessageX(0, width, 1, 400);
    const right = clampMessageX(9999, width, 1, 400);
    expect(left - width / 2).toBeGreaterThanOrEqual(1);
    expect(right + width / 2).toBeLessThanOrEqual(400);
    expect(clampMessageX(200, width, 1, 400)).toBe(200);
  });
});
