import { describe, expect, it } from "vitest";

import {
  ATTACKS,
  ATTACK_GAP_S,
  CRIT_FLASH_S,
  DODGE_HOP_PX,
  ENRAGED_GAP_S,
  INTRO_S,
  LORD_DEATH_REDUCED_S,
  LORD_DEATH_S,
  LORD_HITSTOP_S,
  LORD_HP_BASE,
  LORD_HP_PER_EXTRA,
  METEOR_MAX,
  MINION_MAX,
  MINIONS_PER_SUMMON,
  TAUNTS,
  THRONE_DARK_S,
  clearMinion,
  crackProgress,
  deathLength,
  dodgeLift,
  freshLord,
  growPool,
  hash01,
  introLight,
  kneelProgress,
  liveMinions,
  lordClock,
  lordMaxHp,
  nextAttackGap,
  pickAttack,
  planMeteors,
  raiseMinions,
  resetFight,
  stopAttacks,
  throneDarkness,
} from "@/lib/office/lordFight";
import { measurePixelText } from "@/lib/office/pixelFont";

describe("Lord hp scaling", () => {
  it("a lone raider faces the base pool, every extra raider adds a fixed amount", () => {
    expect(lordMaxHp(0)).toBe(LORD_HP_BASE);
    expect(lordMaxHp(1)).toBe(LORD_HP_BASE);
    expect(lordMaxHp(2)).toBe(LORD_HP_BASE + LORD_HP_PER_EXTRA);
    expect(lordMaxHp(5)).toBe(LORD_HP_BASE + 4 * LORD_HP_PER_EXTRA);
  });

  it("the pool only grows, and damage already dealt stays dealt", () => {
    const lord = freshLord();
    expect(growPool(lord, 1)).toBe(true);
    expect(lord.maxHp).toBe(lordMaxHp(1));
    lord.hp = 0.5; // 30 of 60 dealt
    expect(growPool(lord, 2)).toBe(true);
    expect(lord.maxHp).toBe(lordMaxHp(2));
    expect(lord.hp).toBeCloseTo(1 - 30 / lordMaxHp(2), 9);
    expect(growPool(lord, 1)).toBe(false); // a raider leaving does not shrink it
    expect(lord.maxHp).toBe(lordMaxHp(2));
    resetFight(lord);
    expect(lord.maxHp).toBe(LORD_HP_BASE);
    expect(lord.peak).toBe(0);
  });
});

describe("attack scheduler", () => {
  it("never repeats the previous attack and covers every kind", () => {
    for (let prev = -1; prev < ATTACKS.length; prev++) {
      const seen = new Set<number>();
      for (let step = 0; step < 40; step++) {
        const kind = pickAttack(prev, step / 40);
        expect(kind).toBeGreaterThanOrEqual(0);
        expect(kind).toBeLessThan(ATTACKS.length);
        expect(kind).not.toBe(prev);
        seen.add(kind);
      }
      expect(seen.size).toBe(prev < 0 ? ATTACKS.length : ATTACKS.length - 1);
    }
  });

  it("is deterministic and the enraged cadence is faster", () => {
    expect(pickAttack(-1, 0.5)).toBe(pickAttack(-1, 0.5));
    expect(nextAttackGap(false, 0.5)).toBeCloseTo(ATTACK_GAP_S, 9);
    expect(nextAttackGap(true, 0.5)).toBeCloseTo(ENRAGED_GAP_S, 9);
    expect(nextAttackGap(true, 0)).toBeLessThan(nextAttackGap(false, 1));
  });

  it("meteor markers avoid the raiders' feet and are all different", () => {
    const lord = freshLord();
    lord.atk.count = 3;
    const taken = { x: 150, y: 120 };
    planMeteors(lord, 10, 6, (x, y, radius) => Math.abs(x - taken.x) < radius && Math.abs(y - taken.y) < radius);
    const on = lord.meteors.filter((meteor) => meteor.on);
    expect(on.length).toBeGreaterThan(2);
    expect(on.length).toBeLessThanOrEqual(METEOR_MAX);
    for (const meteor of on) {
      expect(Math.abs(meteor.x - taken.x) < 18 && Math.abs(meteor.y - taken.y) < 18).toBe(false);
      expect(meteor.at).toBeGreaterThan(10);
    }
    expect(new Set(on.map((meteor) => `${meteor.x},${meteor.y}`)).size).toBe(on.length);
  });

  it("hash01 is a stable 0..1 hash", () => {
    expect(hash01(7)).toBe(hash01(7));
    for (let seed = 0; seed < 50; seed++) {
      expect(hash01(seed)).toBeGreaterThanOrEqual(0);
      expect(hash01(seed)).toBeLessThan(1);
    }
  });
});

describe("minions", () => {
  it("a summon raises a few, hits clear the oldest first, and the pool never overflows", () => {
    const lord = freshLord();
    expect(raiseMinions(lord, 1, 200, 100)).toBe(MINIONS_PER_SUMMON);
    expect(liveMinions(lord)).toBe(MINIONS_PER_SUMMON);
    raiseMinions(lord, 5, 200, 100);
    expect(lord.minions.filter((minion) => minion.on).length).toBeLessThanOrEqual(MINION_MAX);
    const first = clearMinion(lord, 6);
    expect(first?.bornAt).toBe(1);
    expect(liveMinions(lord)).toBe(MINION_MAX - 1);
    stopAttacks(lord);
    expect(liveMinions(lord)).toBe(0);
    expect(clearMinion(lord, 7)).toBeNull();
  });
});

describe("intro, hit feel and death timing", () => {
  it("every taunt and the enrage banner are fully drawable in the pixel font", () => {
    for (const text of [...TAUNTS, "ENRAGED!"]) expect(measurePixelText(text)).toBe(text.length * 4 - 1);
  });

  it("the intro dims the braziers and restores them", () => {
    expect(introLight(-1)).toBe(1);
    expect(introLight(INTRO_S + 1)).toBe(1);
    expect(introLight(0.9)).toBeLessThan(0.1);
    expect(introLight(INTRO_S - 0.05)).toBeGreaterThan(0.9);
  });

  it("hit-stop freezes the Lord's own clock for a beat only", () => {
    const lord = freshLord();
    lord.hsAt = 10;
    lord.hsUntil = 10 + LORD_HITSTOP_S;
    expect(lordClock(lord, 10.03)).toBe(10);
    expect(lordClock(lord, 10.2)).toBe(10.2);
    expect(CRIT_FLASH_S).toBeGreaterThan(LORD_HITSTOP_S);
  });

  it("death is a 2.5 s sequence (a short beat under reduced motion), then the throne goes dark", () => {
    expect(deathLength(false)).toBe(LORD_DEATH_S);
    expect(deathLength(true)).toBe(LORD_DEATH_REDUCED_S);
    expect(LORD_DEATH_S).toBeCloseTo(2.5, 9);
    expect(crackProgress(0, false)).toBe(0);
    expect(crackProgress(1.2, false)).toBeGreaterThan(0.3);
    expect(crackProgress(LORD_DEATH_S, false)).toBe(1);
    expect(crackProgress(0.01, true)).toBe(1); // static under reduced motion
    expect(kneelProgress(0.1, false)).toBeLessThan(1);
    expect(kneelProgress(0.1, true)).toBe(1);
    const lord = freshLord();
    lord.hp = 0;
    expect(throneDarkness(lord, 5)).toBe(0); // the burst has not happened
    lord.finaleAt = 4;
    expect(throneDarkness(lord, 4)).toBe(0);
    expect(throneDarkness(lord, 4 + THRONE_DARK_S / 2)).toBeCloseTo(0.5, 6);
    expect(throneDarkness(lord, 99)).toBe(1);
    lord.hp = 1; // risen again
    expect(throneDarkness(lord, 99)).toBe(0);
  });

  it("raiders hop on a hit, and never under reduced motion", () => {
    expect(dodgeLift(10.19, 10, false)).toBe(DODGE_HOP_PX);
    expect(dodgeLift(11, 10, false)).toBe(0);
    expect(dodgeLift(9, 10, false)).toBe(0);
    expect(dodgeLift(10.19, 10, true)).toBe(0);
  });
});
