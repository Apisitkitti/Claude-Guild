import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  CLASS_SKILL,
  MAX_HEARTS,
  TIER_STATS,
  tierStats,
  xpNeed,
  type Employee,
  type SkillKind,
} from "@/lib/office/engine";
import { DESK_COUNT } from "@/lib/office/layout";
import { LORD_HP_BASE, growPool, freshLord, lordMaxHp } from "@/lib/office/lordFight";
import {
  SMITE_CROSS_ARM_GOLD,
  backstabSlash,
  cleaveWave,
  fireballStartX,
  healPlusAt,
  rogueDashDx,
  smiteColumn,
} from "@/lib/office/lordFx";
import type { AdvClass } from "@/lib/office/palette";

import { emp, ev, fixedRandom, newOffice, seat, sid, stubStorage, tick } from "./helpers";

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
  stubStorage();
  fixedRandom(0.5); // no crit at any tier (max chance 0.22), xp 2 per hit
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const post = (id: string, tool = "Read") => ev(id, "PostToolUse", { tool_name: tool, tool_use_id: sid("t") });
const BIG_HP = 100000;

/** a seated field adventurer of this class and level facing a very sturdy monster */
const fielder = (cls: AdvClass, lv: number) => {
  const office = newOffice();
  const id = sid();
  const adventurer = seat(office, id);
  adventurer.look.cls = cls;
  adventurer.lv = lv;
  adventurer.monHp = adventurer.monHpMax = BIG_HP;
  return { office, adventurer, id };
};
const hits = (office: ReturnType<typeof newOffice>, id: string, count: number, tool = "Read") => {
  for (let i = 0; i < count; i++) office.event(post(id, tool));
};
/** damage the field monster took on the next hit */
const nextHit = (office: ReturnType<typeof newOffice>, adventurer: Employee, tool = "Read") => {
  const before = adventurer.monHp;
  office.event(post(adventurer.id, tool));
  return before - adventurer.monHp;
};

describe("tier stats table", () => {
  it("crit 0.10 + 0.03 per tier, flat damage floor(tier/2), skill every 6 (T1-T2) or 4 (T3-T4)", () => {
    expect(TIER_STATS.map((stats) => stats.crit)).toEqual(
      [0.1, 0.13, 0.16, 0.19, 0.22].map((chance) => expect.closeTo(chance, 6)),
    );
    expect(TIER_STATS.map((stats) => stats.bonus)).toEqual([0, 0, 1, 1, 2]);
    expect(TIER_STATS.map((stats) => stats.every)).toEqual([0, 6, 6, 4, 4]);
  });
  it("maps levels onto tiers", () => {
    expect(tierStats(1).every).toBe(0);
    expect(tierStats(4).every).toBe(0);
    expect(tierStats(5).every).toBe(6);
    expect(tierStats(10).bonus).toBe(1);
    expect(tierStats(15).every).toBe(4);
    expect(tierStats(20).bonus).toBe(2);
  });
  it("each class has its own skill", () => {
    expect(new Set(Object.values(CLASS_SKILL)).size).toBe(5);
  });
});

describe("damage and crits per tier", () => {
  it("tier 0 is the old rules: 1 damage (2 heavy), no skill, ever", () => {
    const { office, adventurer, id } = fielder("warrior", 1);
    expect(nextHit(office, adventurer)).toBe(1);
    expect(nextHit(office, adventurer, "Bash")).toBe(2);
    hits(office, id, 30);
    expect(office.skillFx).toHaveLength(0);
    expect(adventurer.skillHits).toBe(0);
  });
  it("tier 0 crit at 0.05 doubles; at 0.12 it does not (chance is 0.10)", () => {
    const { office, adventurer } = fielder("warrior", 4);
    fixedRandom(0.05);
    expect(nextHit(office, adventurer)).toBe(2);
    fixedRandom(0.12);
    expect(nextHit(office, adventurer)).toBe(1);
  });
  it("a higher tier crits more often (0.12 crits at tier 1: chance 0.13)", () => {
    const { office, adventurer } = fielder("warrior", 5);
    fixedRandom(0.12);
    expect(nextHit(office, adventurer)).toBe(2);
  });
  it("flat bonus: T2 +1, T4 +2, added before the crit doubles it", () => {
    const veteran = fielder("warrior", 10);
    expect(nextHit(veteran.office, veteran.adventurer)).toBe(2);
    expect(nextHit(veteran.office, veteran.adventurer, "Bash")).toBe(3);
    const legend = fielder("warrior", 20);
    expect(nextHit(legend.office, legend.adventurer)).toBe(3);
    fixedRandom(0.01);
    expect(nextHit(legend.office, legend.adventurer)).toBe(6);
  });
});

describe("class skills", () => {
  const SKILL_HIT: Record<SkillKind, number> = { cleave: 2, fireball: 2, backstab: 3, smite: 2, volley: 4 };
  const CLASS_OF: Record<SkillKind, AdvClass> = {
    cleave: "warrior",
    fireball: "mage",
    backstab: "rogue",
    smite: "cleric",
    volley: "ranger",
  };

  it("fires on every 6th hit at tier 1-2 and every 4th at tier 3-4", () => {
    for (const [lv, every] of [
      [5, 6],
      [10, 6],
      [15, 4],
      [20, 4],
    ]) {
      const { office, adventurer, id } = fielder("warrior", lv);
      hits(office, id, every - 1);
      expect(office.skillFx).toHaveLength(0);
      hits(office, id, 1);
      expect(office.skillFx.map((fx) => fx.kind)).toEqual(["cleave"]);
      hits(office, id, every);
      expect(office.skillFx).toHaveLength(2);
      expect(adventurer.skillHits).toBe(0);
    }
  });

  for (const skill of Object.keys(SKILL_HIT) as SkillKind[]) {
    it(`${skill} (${CLASS_OF[skill]}): damage on the skill hit, normal damage after`, () => {
      const { office, adventurer, id } = fielder(CLASS_OF[skill], 5);
      hits(office, id, 5);
      expect(nextHit(office, adventurer)).toBe(SKILL_HIT[skill]);
      expect(office.skillFx[0].kind).toBe(skill);
      expect(nextHit(office, adventurer)).toBe(1);
    });
  }

  it("a skill hit also bumps the sound queue with its own cue and is a crit for the rogue", () => {
    const { office, id } = fielder("rogue", 5);
    office.sfxQueue.length = 0;
    hits(office, id, 6);
    expect(office.sfxQueue).toContain("skillStab");
    expect(office.skillFx[0].text).toBe("BACKSTAB!");
  });

  it("the rogue's guaranteed crit is +1 on top of an already doubled hit", () => {
    const { office, adventurer, id } = fielder("rogue", 10);
    hits(office, id, 5);
    fixedRandom(0.01); // crit anyway: (1+1)*2 + 1
    expect(nextHit(office, adventurer)).toBe(5);
    void id;
  });

  it("the warrior's cleave knocks a field monster back further", () => {
    const { office, adventurer, id } = fielder("warrior", 5);
    hits(office, id, 6);
    expect(adventurer.monFarKnockUntil).toBeGreaterThan(office.clock + 0.2);
  });

  it("the rogue dashes (not under reduced motion)", () => {
    const { office, adventurer, id } = fielder("rogue", 5);
    hits(office, id, 6);
    expect(adventurer.dashAt).toBe(office.clock);
    const calm = fielder("rogue", 5);
    calm.office.reducedMotion = true;
    hits(calm.office, calm.id, 6);
    expect(calm.adventurer.dashAt).toBe(-99);
    expect(calm.office.skillFx).toHaveLength(1); // still shown, as static pixels
    void id;
    void adventurer;
  });

  it("the cleric's smite heals one heart, never past the max", () => {
    const hurt = fielder("cleric", 5);
    hurt.adventurer.hearts = 1;
    hits(hurt.office, hurt.id, 6);
    expect(hurt.adventurer.hearts).toBe(2);
    expect(hurt.office.skillFx[0].heal).toBe(true);
    const full = fielder("cleric", 5);
    hits(full.office, full.id, 6);
    expect(full.adventurer.hearts).toBe(MAX_HEARTS);
    expect(full.office.skillFx[0].heal).toBe(false);
    const almost = fielder("cleric", 5);
    almost.adventurer.hearts = MAX_HEARTS - 1;
    hits(almost.office, almost.id, 6);
    hits(almost.office, almost.id, 6);
    expect(almost.adventurer.hearts).toBe(MAX_HEARTS);
  });

  it("the legend tier gets the gold variant", () => {
    const { office, id } = fielder("mage", 20);
    hits(office, id, 4);
    expect(office.skillFx[0].gold).toBe(true);
    const adept = fielder("mage", 5);
    hits(adept.office, adept.id, 6);
    expect(adept.office.skillFx[0].gold).toBe(false);
  });

  it("effects expire", () => {
    const { office, id } = fielder("ranger", 5);
    hits(office, id, 6);
    expect(office.skillFx).toHaveLength(1);
    tick(office, 2);
    expect(office.skillFx).toHaveLength(0);
  });
});

describe("skills in the dungeon", () => {
  const raiderOf = (cls: AdvClass, lv: number) => {
    const office = newOffice();
    const ids = Array.from({ length: DESK_COUNT + 1 }, () => sid());
    for (const id of ids) office.event(ev(id, "SessionStart"));
    tick(office, 60);
    const raider = emp(office, ids[DESK_COUNT]);
    raider.look.cls = cls;
    raider.lv = lv;
    return { office, raider };
  };

  it("a dungeon foe takes double damage from a fireball, and the effect lives on that floor", () => {
    const { office, raider } = raiderOf("mage", 5);
    const foe = raider.raid!;
    foe.hp = 1;
    office.event(post(raider.id));
    const normal = 1 - foe.hp;
    expect(normal).toBeGreaterThan(0);
    foe.hp = 1;
    hits(office, raider.id, 4);
    foe.hp = 1;
    office.event(post(raider.id)); // 6th hit
    expect(1 - foe.hp).toBeCloseTo(normal * 2, 6);
    expect(office.skillFx[0].kind).toBe("fireball");
    expect(office.skillFx[0].dungeon).toBe(raider.floor);
  });

  it("the Lord takes the skill damage too, and its hp pool scales with the raiders' tier", () => {
    const { office, raider } = raiderOf("ranger", 5);
    raider.floor = 3;
    raider.raid = null;
    hits(office, raider.id, 5);
    const max = lordMaxHp(1, 1);
    expect(office.lord.maxHp).toBe(max);
    expect(office.lord.hp).toBeCloseTo(1 - 5 / max, 6);
    office.event(post(raider.id)); // volley: 1 + 3
    expect(office.lord.hp).toBeCloseTo(1 - 9 / max, 6);
    expect(office.skillFx[0].kind).toBe("volley");
  });
});

describe("Lord balance", () => {
  it("a lone novice keeps the old pool; the pool grows with the average tier", () => {
    expect(lordMaxHp(1)).toBe(LORD_HP_BASE);
    expect(lordMaxHp(1, 0)).toBe(LORD_HP_BASE);
    expect(lordMaxHp(1, 4)).toBeGreaterThan(lordMaxHp(1, 2));
    expect(lordMaxHp(1, 2)).toBeGreaterThan(LORD_HP_BASE);
  });
  it("growPool locks the tier factor when the fight starts; later raiders grow it by count only", () => {
    const lord = freshLord();
    expect(growPool(lord, 1, 4)).toBe(true);
    expect(lord.maxHp).toBe(lordMaxHp(1, 4));
    lord.hp = 0.5;
    expect(growPool(lord, 1, 0)).toBe(false);
    expect(growPool(lord, 1, 4)).toBe(false);
    expect(growPool(lord, 2, 0)).toBe(true); // another raider: count grows, the tier factor stays
    expect(lord.maxHp).toBe(lordMaxHp(2, 4));
  });
  it("a raider levelling up mid-fight never makes the Lord's hp left go up", () => {
    const office = newOffice();
    const ids = Array.from({ length: DESK_COUNT + 1 }, () => sid());
    for (const id of ids) office.event(ev(id, "SessionStart"));
    tick(office, 60);
    const raider = emp(office, ids[DESK_COUNT]);
    raider.floor = 3;
    raider.raid = null;
    raider.lv = 4;
    raider.xp = 0;
    let previous = 1;
    let maxHpFirst = 0;
    for (let i = 0; i < 80 && office.lord.hp > 0; i++) {
      office.event(post(raider.id));
      if (i === 0) maxHpFirst = office.lord.maxHp;
      expect(office.lord.hp).toBeLessThanOrEqual(previous);
      previous = office.lord.hp;
    }
    expect(raider.lv).toBeGreaterThanOrEqual(5); // it did level up on the way
    expect(office.lord.maxHp).toBe(maxHpFirst);
  });
});

describe("tier-up celebration", () => {
  const levelUpTo = (lv: number) => {
    const office = newOffice();
    const id = sid();
    const adventurer = seat(office, id);
    adventurer.lv = lv - 1;
    adventurer.xp = xpNeed(lv - 1) - 1;
    adventurer.monHp = adventurer.monHpMax = BIG_HP;
    office.sfxQueue.length = 0;
    office.event(post(id));
    return { office, adventurer };
  };

  it("crossing into Lv5 shows the ADEPT banner, an overhead tier effect and the fanfare cue", () => {
    const { office, adventurer } = levelUpTo(5);
    expect(adventurer.lv).toBe(5);
    expect(office.banners.at(-1)).toMatchObject({ kind: "tier", text: "LV.5 ADEPT!", pixel: true });
    expect(office.skillFx.some((fx) => fx.text === "ADEPT!")).toBe(false); // the look is drawn from tierUpAt
    expect(adventurer.tierUpAt).toBe(office.clock);
    expect(office.sfxQueue).toContain("tierUp");
    expect(office.sfxQueue).toContain("levelUp");
  });
  it("the later tiers get their own names", () => {
    for (const [lv, text] of [
      [10, "VETERAN!"],
      [15, "ELITE!"],
      [20, "LEGEND!"],
    ] as const) {
      const { office } = levelUpTo(lv);
      expect(office.banners.at(-1)?.text).toBe(`LV.${lv} ${text}`);
    }
  });
  it("tierUpAt is stamped on crossing Lv5 / 10 / 15 / 20 only", () => {
    for (const lv of [5, 10, 15, 20]) {
      const { office, adventurer } = levelUpTo(lv);
      expect(adventurer.tierUpAt).toBe(office.clock);
    }
    const fresh = newOffice();
    expect(seat(fresh, sid()).tierUpAt).toBe(-99);
    for (const lv of [2, 4, 6, 11, 16, 21]) expect(levelUpTo(lv).adventurer.tierUpAt).toBe(-99);
  });
  it("an ordinary level-up inside a tier is not a tier-up", () => {
    const { office, adventurer } = levelUpTo(3);
    expect(adventurer.lv).toBe(3);
    expect(office.banners.some((banner) => banner.kind === "tier")).toBe(false);
    expect(office.sfxQueue).not.toContain("tierUp");
  });
  it("no full-screen flash under reduced motion", () => {
    const office = newOffice();
    office.reducedMotion = true;
    const id = sid();
    const adventurer = seat(office, id);
    adventurer.lv = 4;
    adventurer.xp = xpNeed(4) - 1;
    adventurer.monHp = adventurer.monHpMax = BIG_HP;
    office.flash = 0;
    office.event(post(id));
    expect(adventurer.lv).toBe(5);
    expect(adventurer.tierUpAt).toBe(office.clock);
    expect(office.flash).toBeLessThanOrEqual(0.3);
  });
});

describe("demo levels", () => {
  it("demo adventurers cycle through varied levels so every tier shows; live ones start at Lv1", () => {
    const demo = newOffice();
    demo.attachSim({ update: () => {}, addSession: () => {} });
    const levels = [0, 1, 2, 3, 4].map(() => {
      const id = sid();
      demo.event(ev(id, "SessionStart"));
      return emp(demo, id).lv;
    });
    expect(levels).toEqual([3, 7, 12, 17, 22]);
    const live = newOffice();
    const id = sid();
    live.event(ev(id, "SessionStart"));
    expect(emp(live, id).lv).toBe(1);
  });
});

describe("skill impact: hitstop and shake", () => {
  const SKILL_HITSTOP = 0.08;
  const castOnce = (reduced: boolean) => {
    const { office, adventurer, id } = fielder("mage", 5);
    office.reducedMotion = reduced;
    hits(office, id, 5);
    office.trauma = 0;
    office.event(post(id)); // the 6th hit is the skill
    return { office, adventurer };
  };

  it("freezes the caster for 80 ms and shakes the camera", () => {
    const { office, adventurer } = castOnce(false);
    expect(office.skillFx).toHaveLength(1);
    expect(adventurer.hsUntil - office.clock).toBeCloseTo(SKILL_HITSTOP, 6);
    expect(adventurer.hsAt).toBe(office.clock);
    expect(office.trauma).toBeGreaterThanOrEqual(0.3);
  });
  it("the legend tier shakes harder than the adept", () => {
    const adept = castOnce(false);
    const legend = fielder("mage", 20);
    hits(legend.office, legend.id, 3);
    legend.office.trauma = 0;
    legend.office.event(post(legend.id));
    expect(legend.office.trauma).toBeGreaterThan(adept.office.trauma);
  });
  it("no skill hitstop and no shake under reduced motion (the effect still shows)", () => {
    const { office, adventurer } = castOnce(true);
    expect(office.skillFx).toHaveLength(1);
    expect(adventurer.hsUntil - office.clock).toBeLessThan(SKILL_HITSTOP);
    expect(office.trauma).toBe(0);
  });
});

describe("skill name plates", () => {
  it("one plate at a time per adventurer: a newer skill takes the text over", () => {
    const { office, id } = fielder("warrior", 5);
    hits(office, id, 6);
    hits(office, id, 6);
    const mine = office.skillFx.filter((fx) => fx.owner === id);
    expect(mine).toHaveLength(2);
    expect(mine.filter((fx) => !fx.noText)).toHaveLength(1);
    expect(mine[1].noText).toBe(false);
    expect(mine[0].noText).toBe(true);
  });
  it("different adventurers keep their own plates", () => {
    const first = fielder("warrior", 5);
    const other = seat(first.office, sid());
    other.lv = 5;
    other.monHp = other.monHpMax = BIG_HP;
    first.adventurer.monHp = first.adventurer.monHpMax = BIG_HP;
    hits(first.office, first.id, 6);
    hits(first.office, other.id, 6);
    expect(first.office.skillFx.filter((fx) => !fx.noText)).toHaveLength(2);
  });
  it("a skill lasts about a second (1.25 s for the legend)", () => {
    const adept = fielder("ranger", 5);
    hits(adept.office, adept.id, 6);
    expect(adept.office.skillFx[0].dur).toBeCloseTo(1, 6);
    const legend = fielder("ranger", 20);
    hits(legend.office, legend.id, 4);
    expect(legend.office.skillFx[0].dur).toBeCloseTo(1.25, 6);
  });
});

describe("smite column geometry", () => {
  it("starts a short way above the target, never at the top of the field", () => {
    const fx = { x1: 120, y1: 200, gold: false };
    const col = smiteColumn(fx, 0.5, false);
    expect(col.top).toBeGreaterThanOrEqual(fx.y1 - 40);
    expect(col.top).toBeLessThan(fx.y1);
    expect(col.bottom).toBeGreaterThan(fx.y1);
    expect(col.x).toBe(120);
    expect(col.half * 2 + 1).toBeGreaterThanOrEqual(5);
    expect(col.half * 2 + 1).toBeLessThanOrEqual(9);
  });
  it("grows downwards from the top and is clamped to the bounds", () => {
    const fx = { x1: 500, y1: 100, gold: true };
    const early = smiteColumn(fx, 0.02, false);
    const full = smiteColumn(fx, 0.5, false, 0, 384);
    expect(early.top).toBeGreaterThan(full.top);
    expect(full.top).toBeGreaterThanOrEqual(fx.y1 - 45);
    expect(full.x).toBe(384);
  });
});

describe("guild master congratulates a tier-up", () => {
  const IDLE_S = 40;
  const GM_TRIP_S = 90;
  const climb = (office: ReturnType<typeof newOffice>, adventurer: Employee, lv: number) => {
    adventurer.lv = lv - 1;
    adventurer.xp = xpNeed(lv - 1) - 1;
    adventurer.monHp = adventurer.monHpMax = BIG_HP;
    office.event(post(adventurer.id));
  };

  it("walks over and says a class line; a plain level-up gets no visit", () => {
    const office = newOffice();
    const adventurer = seat(office, sid());
    adventurer.look.cls = "mage";
    climb(office, adventurer, 5);
    expect(adventurer.tierUpAt).toBe(office.clock);
    for (let elapsed = 0; elapsed < GM_TRIP_S && office.guildMaster.phase !== "talk"; elapsed += 0.05)
      tick(office, 0.05);
    const master = office.guildMaster;
    expect(master.phase).toBe("talk");
    expect(master.mission).toBe("praise");
    expect(master.targetId).toBe(adventurer.id);
    expect(master.text).toBe("WELL CAST");

    const plain = newOffice();
    const quiet = seat(plain, sid());
    climb(plain, quiet, 3);
    expect(quiet.tierUpAt).toBe(-99);
    tick(plain, IDLE_S);
    expect(plain.guildMaster.mission === "praise").toBe(false);
  });

  it("skips the congratulation while he is on an urgent report", () => {
    const office = newOffice();
    const winner = seat(office, sid());
    const needy = seat(office, sid());
    office.event(ev(needy.id, "Notification", { notification_type: "permission_prompt" } as never));
    climb(office, winner, 5);
    const trips: string[] = [];
    for (let elapsed = 0; elapsed < GM_TRIP_S; elapsed += 0.05) {
      tick(office, 0.05);
      const { mission, targetId } = office.guildMaster;
      const label = mission === "none" ? "" : `${mission}:${targetId}`;
      if (label && trips.at(-1) !== label) trips.push(label);
    }
    const urgentAt = trips.indexOf(`visit:${needy.id}`);
    expect(urgentAt).toBeGreaterThanOrEqual(0);
    // the congratulation only comes after the urgent report was dealt with
    const praiseAt = trips.indexOf(`praise:${winner.id}`);
    if (praiseAt >= 0) expect(praiseAt).toBeGreaterThan(urgentAt);
  });
});

describe("skill effects keep clear of characters", () => {
  const HALF_BODY = 8; // CH_W / 2
  const NEIGHBOUR_EDGE = 52; // the next battle spot's adventurer starts 60 - 8 px along
  const FOE_DX = 22;
  const X0 = 100;
  const SWEEPS = [0, 0.25, 0.5, 0.75, 1];

  for (const gold of [false, true]) {
    for (const dir of [1, -1]) {
      const near = (value: number) => (value - X0) * dir; // distance along the facing direction
      const label = `${gold ? "legend" : "adept"} facing ${dir > 0 ? "right" : "left"}`;
      const x1 = X0 + dir * FOE_DX;
      it(`cleave wave starts past the caster and stops before the neighbour (${label})`, () => {
        for (const sweep of SWEEPS) {
          const wave = cleaveWave(X0, x1, dir, gold, sweep);
          const lo = Math.min(near(wave.left), near(wave.right)),
            hi = Math.max(near(wave.left), near(wave.right));
          expect(lo).toBeGreaterThan(HALF_BODY);
          expect(hi).toBeLessThan(NEIGHBOUR_EDGE);
        }
      });
      it(`backstab slash comes after the dash and its reach stays clear of both bodies (${label})`, () => {
        expect(backstabSlash(x1, gold, 0.2, false)).toBeNull();
        expect(rogueDashDx(0.5, dir)).toBe(0);
        const slash = backstabSlash(x1, gold, 0.7, false)!;
        expect(near(slash.x) - slash.len).toBeGreaterThan(HALF_BODY);
        expect(near(slash.x) + slash.reach).toBeLessThan(NEIGHBOUR_EDGE);
      });
      it(`fireball leaves the caster's side and the heal plus floats beside the head (${label})`, () => {
        const size = gold ? 13 : 9;
        expect(near(fireballStartX(X0, dir, gold)) - size / 2).toBeGreaterThanOrEqual(HALF_BODY);
        for (const age of [0, 0.4, 0.8]) {
          const plus = healPlusAt(X0, 200, dir, age, false);
          expect(Math.abs(plus.x - X0) - 4).toBeGreaterThanOrEqual(HALF_BODY);
          expect(plus.x - X0).toBe(-dir * Math.abs(plus.x - X0));
        }
        expect(near(x1) - SMITE_CROSS_ARM_GOLD).toBeGreaterThan(HALF_BODY);
      });
    }
  }
  it("the rogue dash peaks at 26 px and returns home", () => {
    expect(rogueDashDx(0.225, 1)).toBe(26);
    expect(rogueDashDx(0.45, 1)).toBe(0);
  });
});

describe("a skill hit that also crosses a tier", () => {
  it("keeps its name plate (no tier fx steals it) and stamps tierUpAt", () => {
    const { office, adventurer, id } = fielder("warrior", 9);
    adventurer.skillHits = 5;
    adventurer.xp = xpNeed(9) - 1;
    office.event(post(id));
    expect(adventurer.lv).toBe(10);
    expect(adventurer.tierUpAt).toBe(office.clock);
    expect(office.skillFx).toHaveLength(1);
    expect(office.skillFx[0]).toMatchObject({ kind: "cleave", text: "CLEAVE!", noText: false });
  });
});

describe("praise queue", () => {
  it("an unvisitable entry at the front does not block the next one", () => {
    const office = newOffice();
    const winner = seat(office, sid());
    const away = seat(office, sid());
    for (const person of [winner, away]) {
      person.lv = 4;
      person.xp = xpNeed(4) - 1;
      person.monHp = person.monHpMax = BIG_HP;
      office.event(post(person.id));
    }
    away.raidIn = true; // queued last = first in line, but he cannot be visited
    const maxTrip = 90;
    for (let elapsed = 0; elapsed < maxTrip && office.guildMaster.mission !== "praise"; elapsed += 0.05) {
      away.raidIn = true; // off on a raid: not visitable
      tick(office, 0.05);
    }
    expect(office.guildMaster.mission).toBe("praise");
    expect(office.guildMaster.targetId).toBe(winner.id);
  });
  it("a raider's tier-up is not queued for the guild master", () => {
    const office = newOffice();
    const ids = Array.from({ length: DESK_COUNT + 1 }, () => sid());
    for (const id of ids) office.event(ev(id, "SessionStart"));
    tick(office, 60);
    const raider = emp(office, ids[DESK_COUNT]);
    raider.lv = 4;
    raider.xp = xpNeed(4) - 1;
    office.event(post(raider.id));
    expect(raider.tierUpAt).toBe(office.clock);
    tick(office, 90);
    expect(office.guildMaster.targetId === raider.id && office.guildMaster.mission === "praise").toBe(false);
  });
});
