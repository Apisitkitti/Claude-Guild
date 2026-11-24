import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DUNGEON_FLOORS } from "@/lib/office/dungeonScene";
import { KIND_LORD, LORD_RESPAWN_S, RAID_STAIRS_S, type Employee } from "@/lib/office/engine";
import { DESK_COUNT } from "@/lib/office/layout";
import {
  ATTACK_BREATH,
  ATTACK_SLAM,
  ATTACK_SUMMON,
  FIRST_ATTACK_S,
  LORD_DEATH_REDUCED_S,
  LORD_DEATH_S,
  LORD_HITSTOP_S,
  MINIONS_PER_SUMMON,
  TAUNTS,
  TELEGRAPH_S,
  liveMinions,
  lordMaxHp,
  nextAttackGap,
  pickAttack,
  throneDarkness,
} from "@/lib/office/lordFight";

import { emp, ev, fixedRandom, newOffice, sid, stubStorage, tick } from "./helpers";

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
  stubStorage();
  fixedRandom(0.5);
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const strike = (office: ReturnType<typeof newOffice>, id: string, tool = "Read") => {
  const key = sid("t");
  office.event(ev(id, "PreToolUse", { tool_name: tool, tool_use_id: key }));
  office.event(ev(id, "PostToolUse", { tool_name: tool, tool_use_id: key }));
};
const withRaiders = (raiders: number) => {
  const office = newOffice();
  const ids = Array.from({ length: DESK_COUNT + raiders }, () => sid());
  for (const id of ids) office.event(ev(id, "SessionStart"));
  tick(office, 60);
  return { office, raiderIds: ids.slice(DESK_COUNT) };
};
const sendToLord = (raider: Employee) => {
  raider.floor = DUNGEON_FLOORS;
  raider.floorKills = 0;
  raider.raid = null;
};
/** tick until the Lord has engaged (risen and stepped down) */
const engage = (office: ReturnType<typeof newOffice>) => {
  for (let i = 0; i < 40 && office.lord.engagedAt < 0; i++) tick(office, 0.1);
  expect(office.lord.engagedAt).toBeGreaterThanOrEqual(0);
};
/** tick until his next special attack starts its telegraph */
const untilAttack = (office: ReturnType<typeof newOffice>) => {
  for (let i = 0; i < 400 && office.lord.atk.kind < 0; i++) tick(office, 0.05);
  expect(office.lord.atk.kind).toBeGreaterThanOrEqual(0);
};
/** tick until the running attack has landed */
const untilLanded = (office: ReturnType<typeof newOffice>) => {
  for (let i = 0; i < 100 && !office.lord.atk.landed; i++) tick(office, 0.05);
  expect(office.lord.atk.landed).toBe(true);
};
const lordWith = (raiders: number) => {
  const { office, raiderIds } = withRaiders(raiders);
  const fighters = raiderIds.map((id) => emp(office, id));
  fighters.forEach(sendToLord);
  engage(office);
  return { office, fighters };
};

describe("the Dungeon Lord boss fight: hp scaling", () => {
  it("each raider who has stood on B3 this fight adds to the pool, and the hits drain that pool", () => {
    const { office, fighters } = lordWith(1);
    expect(office.lord.maxHp).toBe(lordMaxHp(1));
    strike(office, fighters[0].id, "Bash"); // 2 damage
    expect(office.lord.hp).toBeCloseTo(1 - 2 / lordMaxHp(1), 9);
    const dealt = (1 - office.lord.hp) * lordMaxHp(1);
    const second = emp(office, withExtra(office));
    sendToLord(second);
    tick(office, 0.2);
    expect(office.lord.peak).toBe(2);
    expect(office.lord.maxHp).toBe(lordMaxHp(2));
    expect((1 - office.lord.hp) * lordMaxHp(2)).toBeCloseTo(dealt, 6); // the damage dealt stays dealt
  });

  it("the pool resets when the Lord rises again", () => {
    const { office, fighters } = lordWith(2);
    expect(office.lord.maxHp).toBe(lordMaxHp(2));
    office.lord.hp = 1 / lordMaxHp(2);
    strike(office, fighters[0].id);
    expect(office.lord.hp).toBe(0);
    for (const raider of fighters) raider.floor = 1; // the party leaves
    tick(office, LORD_RESPAWN_S + 1);
    expect(office.lord.hp).toBe(1);
    expect(office.lord.maxHp).toBe(lordMaxHp(1));
    expect(office.lord.peak).toBe(0);
    expect(office.lord.enragedAt).toBe(-1);
  });
});

/** a fresh overflow raider appears on B1 (added to a running office) */
const withExtra = (office: ReturnType<typeof newOffice>): string => {
  const id = sid();
  office.event(ev(id, "SessionStart"));
  tick(office, 30);
  return id;
};

describe("the Dungeon Lord boss fight: intro", () => {
  const arrive = (office: ReturnType<typeof newOffice>, raider: Employee) => {
    raider.floor = DUNGEON_FLOORS - 1;
    raider.stairsAt = office.clock;
    tick(office, RAID_STAIRS_S + 0.3);
    expect(raider.floor).toBe(DUNGEON_FLOORS);
  };

  it("the first raider on B3 sets off the intro: a taunt, a banner, the boss sting and a shake", () => {
    const { office, raiderIds } = withRaiders(1);
    const raider = emp(office, raiderIds[0]);
    office.sfxQueue.length = 0;
    arrive(office, raider);
    expect(office.lord.introAt).toBeGreaterThanOrEqual(0);
    expect(TAUNTS).toContain(TAUNTS[office.lord.taunt]);
    expect(office.sfxQueue).toContain("bossAppear");
    expect(office.banners.some((banner) => banner.kind === "boss")).toBe(true);
    expect(office.lord.shake).toBeGreaterThan(0);
    expect(office.lord.intros).toBe(1);
  });

  it("a second raider arriving does not repeat the intro", () => {
    const { office, raiderIds } = withRaiders(2);
    const [first, second] = raiderIds.map((id) => emp(office, id));
    arrive(office, first);
    const introAt = office.lord.introAt;
    tick(office, 3);
    arrive(office, second);
    expect(office.lord.introAt).toBe(introAt);
    expect(office.lord.intros).toBe(1);
  });

  it("under reduced motion the intro never shakes the screen", () => {
    const { office, raiderIds } = withRaiders(1);
    office.reducedMotion = true;
    arrive(office, emp(office, raiderIds[0]));
    expect(office.lord.introAt).toBeGreaterThanOrEqual(0);
    expect(office.lord.shake).toBe(0);
  });
});

describe("the Dungeon Lord boss fight: special attacks", () => {
  it("telegraphs first, lands after TELEGRAPH_S, stays up, then rests before the next (different) one", () => {
    const { office } = lordWith(1);
    const lord = office.lord;
    expect(lord.atk.kind).toBe(-1);
    expect(lord.nextAttackAt).toBeCloseTo(lord.engagedAt + FIRST_ATTACK_S, 6);
    // nothing before the first attack is due
    tick(office, lord.nextAttackAt - office.clock - 0.2);
    expect(lord.atk.kind).toBe(-1);
    untilAttack(office);
    expect(lord.atk.kind).toBe(pickAttack(-1, 0.5)); // fixed random: a deterministic first pick
    const firstKind = lord.atk.kind;
    expect(lord.atk.hitAt - lord.atk.startAt).toBeCloseTo(TELEGRAPH_S, 6);
    expect(lord.atk.landed).toBe(false);
    expect(lord.atk.targetId).not.toBe("");
    tick(office, TELEGRAPH_S - 0.2);
    expect(lord.atk.landed).toBe(false); // still only a warning
    untilLanded(office);
    expect(office.clock - lord.atk.startAt).toBeGreaterThanOrEqual(TELEGRAPH_S - 0.001);
    tick(office, lord.atk.endAt - office.clock + 0.1);
    expect(lord.atk.kind).toBe(-1);
    expect(lord.nextAttackAt - office.clock).toBeGreaterThan(nextAttackGap(false, 0.5) - 0.3);
    untilAttack(office);
    expect(lord.atk.kind).not.toBe(firstKind);
  });

  it("a summon raises skeletons that the raiders' hits clear one by one", () => {
    const { office, fighters } = lordWith(1);
    const lord = office.lord;
    untilAttack(office);
    expect(lord.atk.kind).toBe(ATTACK_SUMMON); // a fixed 0.5 random picks the summon first
    untilLanded(office);
    expect(liveMinions(lord)).toBe(MINIONS_PER_SUMMON);
    const hp = lord.hp;
    strike(office, fighters[0].id);
    expect(liveMinions(lord)).toBe(MINIONS_PER_SUMMON - 1);
    expect(lord.hp).toBeLessThan(hp); // the hit still counts against the Lord
    strike(office, fighters[0].id);
    strike(office, fighters[0].id);
    expect(liveMinions(lord)).toBe(0);
    tick(office, 1);
    expect(lord.minions.every((minion) => !minion.on)).toBe(true);
  });

  it("minions crumble on their own and vanish when the fight ends", () => {
    const { office, fighters } = lordWith(1);
    const lord = office.lord;
    untilAttack(office);
    untilLanded(office);
    expect(lord.atk.kind).toBe(ATTACK_SUMMON);
    expect(liveMinions(lord)).toBe(MINIONS_PER_SUMMON);
    fighters[0].floor = 1; // the raider leaves the Lord's hall
    tick(office, 0.2);
    expect(liveMinions(lord)).toBe(0);
    expect(lord.atk.kind).toBe(-1);
    expect(lord.nextAttackAt).toBe(-1);
  });

  it("the slam sweeps left: raiders it reaches hop, and the one it was aimed at flinches", () => {
    fixedRandom(0); // first pick = slam, target = the first raider
    const { office, fighters } = lordWith(2);
    const lord = office.lord;
    untilAttack(office);
    expect(lord.atk.kind).toBe(ATTACK_SLAM);
    const victim = emp(office, lord.atk.targetId);
    tick(office, TELEGRAPH_S + 2);
    for (const raider of fighters) expect(raider.dodgeAt).toBeGreaterThanOrEqual(lord.atk.hitAt);
    expect(victim.hurtUntil).toBeGreaterThan(lord.atk.hitAt);
    // nobody lost anything
    for (const raider of fighters) expect(raider.hearts).toBeGreaterThan(0);
  });

  it("the fire breath is aimed at one raider and only hops those near its stream", () => {
    fixedRandom(0.3); // pick: breath
    const { office } = lordWith(1);
    const lord = office.lord;
    untilAttack(office);
    expect(lord.atk.kind).toBe(pickAttack(-1, 0.3));
    expect(lord.atk.kind).toBe(ATTACK_BREATH);
    const target = emp(office, lord.atk.targetId);
    expect(lord.atk.tx).toBeCloseTo(office.raiderPoint(target).x, 6);
    tick(office, TELEGRAPH_S + 1);
    expect(target.dodgeAt).toBeGreaterThanOrEqual(lord.atk.hitAt);
  });

  it("no special attacks while nobody is fighting him", () => {
    const { office } = withRaiders(1); // still on B1
    tick(office, 30);
    expect(office.lord.atk.kind).toBe(-1);
    expect(office.lord.nextAttackAt).toBe(-1);
  });
});

describe("the Dungeon Lord boss fight: enrage", () => {
  it("below half hp he enrages once: banner, roar, faster attacks; above half he does not", () => {
    const { office, fighters } = lordWith(1);
    const lord = office.lord;
    lord.hp = 0.6;
    strike(office, fighters[0].id);
    expect(lord.enragedAt).toBe(-1);
    lord.hp = 0.5 + 0.5 / lord.maxHp;
    office.sfxQueue.length = 0;
    strike(office, fighters[0].id); // 1 damage: just under half
    expect(lord.hp).toBeLessThan(0.5);
    expect(lord.enragedAt).toBe(office.clock);
    expect(office.sfxQueue).toContain("lordEnrage");
    const banner = office.banners.find((row) => row.text === "ENRAGED!");
    expect(banner?.pixel).toBe(true);
    const at = lord.enragedAt;
    strike(office, fighters[0].id);
    expect(lord.enragedAt).toBe(at); // only once
    expect(office.banners.filter((row) => row.text === "ENRAGED!")).toHaveLength(1);
  });

  it("an enrage pulls the next attack forward", () => {
    const { office, fighters } = lordWith(1);
    const lord = office.lord;
    lord.nextAttackAt = office.clock + 30;
    lord.hp = 0.5 + 0.5 / lord.maxHp;
    strike(office, fighters[0].id);
    expect(lord.nextAttackAt - office.clock).toBeLessThan(5);
  });
});

describe("the Dungeon Lord boss fight: hit feel", () => {
  it("every hit freezes his animation clock for a beat and queues a slash; crits flag a flash", () => {
    const { office, fighters } = lordWith(1);
    const lord = office.lord;
    strike(office, fighters[0].id);
    expect(lord.hsUntil - lord.hsAt).toBeCloseTo(LORD_HITSTOP_S, 9);
    expect(lord.hsAt).toBe(office.clock);
    expect(lord.slashN).toBe(1);
    expect(lord.critAt).toBe(-99);
    fixedRandom(0); // below CRIT_CHANCE: a crit
    strike(office, fighters[0].id);
    expect(lord.critAt).toBe(office.clock);
    expect(lord.slashes.some((slash) => slash.crit)).toBe(true);
    expect(lord.shake).toBeGreaterThan(0); // a small shake
    const crit = office.popups.find((popup) => popup.scale > 0);
    expect(crit?.scale).toBeGreaterThan(2); // a bigger number
  });

  it("under reduced motion there is no hit-stop and no shake", () => {
    const { office, fighters } = lordWith(1);
    office.reducedMotion = true;
    const lord = office.lord;
    lord.hsUntil = 0;
    fixedRandom(0); // a crit too
    strike(office, fighters[0].id);
    expect(lord.hsUntil).toBe(0);
    expect(lord.shake).toBe(0);
    untilAttack(office);
    untilLanded(office);
    expect(lord.shake).toBe(0); // not even the landing of an attack shakes
  });
});

describe("the Dungeon Lord boss fight: death sequence", () => {
  it("rewards at once, but the burst, the banner and the fanfare wait for the end of the sequence", () => {
    const { office, fighters } = lordWith(1);
    office.voidEnabled = false; // the Lord's own death sequence
    const lord = office.lord;
    lord.hp = 1 / lord.maxHp;
    const gold = fighters[0].gold;
    office.sfxQueue.length = 0;
    const bannersBefore = office.banners.length;
    strike(office, fighters[0].id);
    expect(lord.hp).toBe(0);
    expect(lord.slain).toBe(1);
    expect(fighters[0].gold).toBeGreaterThan(gold);
    expect(lord.deadAt).toBe(office.clock);
    expect(lord.finaleAt).toBe(-1);
    expect(office.sfxQueue).toContain("lordDeath");
    expect(office.sfxQueue).not.toContain("fanfare");
    expect(office.banners.length).toBe(bannersBefore);
    expect(office.getView().log.some((row) => row.kind === KIND_LORD)).toBe(true);
    expect(office.popups.some((popup) => popup.text.endsWith("g") && popup.dungeon)).toBe(false);
    expect(fighters[0].raidDoneAt).toBeCloseTo(lord.deadAt + LORD_DEATH_S, 6);
    tick(office, LORD_DEATH_S - 0.2);
    expect(lord.finaleAt).toBe(-1);
    expect(throneDarkness(lord, office.clock)).toBe(0);
    tick(office, 0.3);
    expect(lord.finaleAt).toBeGreaterThanOrEqual(lord.deadAt + LORD_DEATH_S - 0.06);
    expect(office.sfxQueue).toContain("fanfare");
    expect(office.sfxQueue).toContain("bossDown");
    expect(office.banners.length).toBeGreaterThan(bannersBefore);
    expect(office.popups.some((popup) => popup.text.endsWith("g") && popup.dungeon)).toBe(true);
    expect(office.particles.some((particle) => particle.on && particle.spr === "coin" && particle.y < 0)).toBe(true); // the shower
    tick(office, 1);
    expect(throneDarkness(lord, office.clock)).toBe(1); // dark until he rises
    tick(office, LORD_RESPAWN_S);
    expect(lord.hp).toBe(1);
    expect(lord.finaleAt).toBe(-1);
    expect(throneDarkness(lord, office.clock)).toBe(0);
  });

  it("the raider walks home only after the sequence plus the usual linger", () => {
    const { office, fighters } = lordWith(1);
    office.voidEnabled = false; // the Lord's own death sequence
    const raider = fighters[0];
    raider.raidIn = true;
    raider.raidEnteredAt = office.clock;
    office.lord.hp = 1 / office.lord.maxHp;
    strike(office, raider.id);
    expect(office.lord.hp).toBe(0);
    tick(office, LORD_DEATH_S);
    expect(raider.raidDoneAt).toBeGreaterThanOrEqual(0);
  });

  it("under reduced motion the sequence is a short beat", () => {
    const { office, fighters } = lordWith(1);
    office.voidEnabled = false; // the Lord's own death sequence
    office.reducedMotion = true;
    office.lord.hp = 1 / office.lord.maxHp;
    strike(office, fighters[0].id);
    tick(office, LORD_DEATH_REDUCED_S - 0.1);
    expect(office.lord.finaleAt).toBe(-1);
    tick(office, 0.2);
    expect(office.lord.finaleAt).toBeGreaterThanOrEqual(0);
    expect(office.lord.shake).toBe(0);
  });

  it("a hit on a downed Lord does nothing, and the special attack state is cleared", () => {
    const { office, fighters } = lordWith(1);
    office.voidEnabled = false; // the Lord's own death sequence
    const lord = office.lord;
    untilAttack(office);
    lord.hp = 1 / lord.maxHp;
    strike(office, fighters[0].id);
    expect(lord.atk.kind).toBe(-1);
    expect(liveMinions(lord)).toBe(0);
    const slashes = lord.slashN;
    strike(office, fighters[0].id);
    expect(lord.slashN).toBe(slashes);
  });
});

describe("the Dungeon Lord boss fight: pools", () => {
  it("a whole fight reuses the preallocated pools", () => {
    const { office, fighters } = lordWith(2);
    const lord = office.lord;
    const pools = [lord.minions, lord.meteors, lord.slashes, office.particles];
    const lengths = pools.map((pool) => pool.length);
    for (let i = 0; i < 40; i++) {
      tick(office, 1);
      strike(office, fighters[i % 2].id, i % 3 ? "Read" : "Bash");
    }
    expect(pools.map((pool) => pool.length)).toEqual(lengths);
    expect(pools[0]).toBe(lord.minions);
  });
});
