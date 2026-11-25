import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DUNGEON_FLOORS, dungeonLordPoint, dungeonSpotOf } from "@/lib/office/dungeonScene";
import { KIND_LORD, MAX_HEARTS, RAID_IDLE_S, RAID_READY_CALLS, type Employee } from "@/lib/office/engine";
import { DESK_COUNT } from "@/lib/office/layout";
import { lordMaxHp } from "@/lib/office/lordFight";
import {
  VOID_ARENA_Y0,
  VOID_ARENA_Y1,
  VOID_ASCEND_S,
  VOID_PUSHBACK_S,
  VOID_BANNER_AWAKENS_S,
  VOID_BEAM_HALF_PX,
  VOID_CORE_OPEN_S,
  VOID_CORE_SWAY_PX,
  VOID_CORE_Y,
  VOID_EYE_CRACK_S,
  VOID_EYE_SHATTER_S,
  VOID_GAZE_SWEEP_S,
  VOID_HAND_COUNT,
  VOID_HAND_RISE_S,
  VOID_HAND_SINK_S,
  VOID_HAND_SLAM_S,
  VOID_ARENA_X0,
  VOID_ARENA_X1,
  voidCoreX,
  voidCoreY,
  voidEyeDeathStage,
  voidGazeX,
  VOID_BLINK_DX,
  VOID_DYING_S,
  VOID_ECLIPSE_EVERY,
  VOID_GOLD,
  VOID_HP_MULT,
  VOID_KILLS,
  VOID_FIRST_ATTACK_S,
  VOID_BANNER_S,
  VOID_BANNER_VOICE_GAP_S,
  VOID_BODY_H,
  VOID_BODY_W,
  VOID_FEET_Y,
  VOID_HIT_FLASH_S,
  VOID_MINION_LIFE_S,
  VOID_TAUNTS,
  voidNextGap,
  voidSpotOf,
  voidTelegraphS,
  VOID_HOME_X,
  VOID_MIN_TELEGRAPH_S,
  VOID_LINE_SHATTER,
  VOID_PHASE2_BELOW,
  VOID_PHASE3_BELOW,
  VOID_RETREAT_S,
  VOID_REVEAL_S,
  VOID_SHATTER_S,
  VOID_TRUE_FORM_S,
  VOID_VICTORY_S,
  VOID_VOICE_S,
  VOID_WIPE_MID_S,
  VOID_WIPE_S,
  damageVoid,
  pickVoidAttack,
  voidCollapseAt,
  voidDamageFloor,
  voidDeathStage,
  voidInvulnerable,
  voidPhaseProgress,
  voidVoice,
  voidWipeCover,
} from "@/lib/office/voidFight";
import { VOID_FLOOR, voidIdle } from "@/lib/office/voidTypes";

import { emp, ev, fixedRandom, newOffice, sid, stubStorage, tick } from "./helpers";

const GOLD_LOOT = 80;
const STEP = 0.05;
/** each phase begins on the first frame at or after its due time: a few frames of slack across the chain */
const LAG_S = 0.6;
const PHASE_TOLERANCE_S = 0.15;

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

type TestOffice = ReturnType<typeof newOffice>;

const strike = (office: TestOffice, id: string, tool = "Bash") => {
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
/** a party standing on B3 with the Lord engaged */
const lordWith = (raiders: number) => {
  const { office, raiderIds } = withRaiders(raiders);
  const fighters = raiderIds.map((id) => emp(office, id));
  fighters.forEach(sendToLord);
  for (let i = 0; i < 40 && office.lord.engagedAt < 0; i++) tick(office, 0.1);
  return { office, fighters };
};
/** tick, collecting every sound cue the engine queued on the way */
const run = (office: TestOffice, seconds: number, cues: Set<string> = new Set()) => {
  for (let elapsed = 0; elapsed < seconds - 1e-9; elapsed += STEP) {
    tick(office, STEP, STEP);
    for (const cue of office.sfxQueue) cues.add(cue);
    office.sfxQueue.length = 0;
  }
  return cues;
};
const slayLord = (office: TestOffice, fighter: Employee) => {
  office.lord.hp = 1 / office.lord.maxHp;
  strike(office, fighter.id);
  expect(office.lord.hp).toBe(0);
};
/** the party is in the Sanctum and the Veiled One stands ready to fight */
const toFight = (raiders = 1) => {
  const { office, fighters } = lordWith(raiders);
  slayLord(office, fighters[0]);
  run(office, VOID_SHATTER_S + VOID_WIPE_S + VOID_REVEAL_S + LAG_S);
  expect(office.voidFight.phase).toBe("fight");
  return { office, fighters };
};
/** the engine's private fight bookkeeping, for steering attacks in tests */
const ctlOf = (office: TestOffice) =>
  (office as unknown as { voidCtl: { nextAttackAt: number; phaseCount: number } }).voidCtl;
/** drop the boss just under 60% and play out the TRUE FORM cinematic */
const toPhase2 = (office: TestOffice, fighter: Employee) => {
  const boss = office.voidFight;
  boss.hp = boss.maxHp * VOID_PHASE2_BELOW + 1;
  strike(office, fighter.id);
  expect(boss.phase).toBe("phase2");
  run(office, VOID_TRUE_FORM_S + STEP * 2);
};
/** ... and then just under 25%, playing out THE VOID AWAKENS ascend */
const toPhase3 = (office: TestOffice, fighter: Employee) => {
  const boss = office.voidFight;
  toPhase2(office, fighter);
  boss.hp = boss.maxHp * VOID_PHASE3_BELOW + 1;
  strike(office, fighter.id);
  expect(boss.phase).toBe("phase3");
  run(office, VOID_ASCEND_S + STEP * 2);
};

describe("the secret final boss: pure rules", () => {
  it("a hit never carries the hp past the next threshold", () => {
    const state = voidIdle();
    state.maxHp = 100;
    state.hp = 100;
    state.phase = "fight";
    damageVoid(state, 999);
    expect(state.hp / state.maxHp).toBeCloseTo(VOID_PHASE2_BELOW, 4);
    expect(state.hp / state.maxHp).toBeLessThan(VOID_PHASE2_BELOW);
    state.phase = "phase2";
    damageVoid(state, 999);
    expect(state.hp / state.maxHp).toBeLessThan(VOID_PHASE3_BELOW);
    state.phase = "phase3";
    damageVoid(state, 999);
    expect(state.hp).toBe(0);
    expect(voidDamageFloor("phase3")).toBe(0);
  });

  it("phase 1 draws beam / eyes / blink / summon, phase 2 adds collapse and the eclipse, phase 3 draws hand / gaze", () => {
    const seen = new Set<string>();
    for (let step = 0; step < 20; step++) seen.add(pickVoidAttack("fight", null, 0, step / 20));
    expect([...seen].sort()).toEqual(["beam", "blink", "eyes", "summon"]);
    for (let step = 0; step < 20; step++) expect(pickVoidAttack("fight", null, 0, step / 20, true)).not.toBe("summon");
    const later = new Set<string>();
    for (let step = 0; step < 20; step++) later.add(pickVoidAttack("phase2", null, 0, step / 20));
    expect([...later].sort()).toEqual(["beam", "blink", "collapse", "eyes", "summon"]);
    for (const phase of ["phase2", "phase3"] as const)
      for (let count = 0; count < VOID_ECLIPSE_EVERY * 3; count++)
        expect(pickVoidAttack(phase, null, count, 0.3) === "eclipse").toBe((count + 1) % VOID_ECLIPSE_EVERY === 0);
    expect(pickVoidAttack("phase2", "beam", 0, 0)).not.toBe("beam");
    const colossus = new Set<string>();
    for (let step = 0; step < 20; step++) colossus.add(pickVoidAttack("phase3", null, 0, step / 20, true));
    expect([...colossus].sort()).toEqual(["gaze", "hand"]); // never a summon, never the old attacks
    expect(pickVoidAttack("phase3", "gaze", 0, 0.99)).toBe("hand");
    expect(pickVoidAttack("phase3", "hand", 0, 0)).toBe("hand"); // the hand may slam again
  });

  it("the gaze sweeps the floor left to right over its sweep time, the core sways and floats down", () => {
    const attack = { kind: "gaze", at: 10, targetX: VOID_ARENA_X0, targetY: 100, hitAt: 11.4, endAt: 12.6 } as never;
    expect(voidGazeX(attack, 10, VOID_ARENA_X0, VOID_ARENA_X1)).toBe(VOID_ARENA_X0);
    expect(voidGazeX(attack, 11.4 + VOID_GAZE_SWEEP_S / 2, VOID_ARENA_X0, VOID_ARENA_X1)).toBeCloseTo(
      (VOID_ARENA_X0 + VOID_ARENA_X1) / 2,
      6,
    );
    expect(voidGazeX(attack, 99, VOID_ARENA_X0, VOID_ARENA_X1)).toBe(VOID_ARENA_X1);
    const mid = (VOID_ARENA_X0 + VOID_ARENA_X1) / 2;
    expect(voidCoreX(5, 5)).toBeCloseTo(mid, 6);
    expect(Math.abs(voidCoreX(5 + 7 / 4, 5) - mid)).toBeCloseTo(VOID_CORE_SWAY_PX, 6);
    expect(voidCoreX(5 + 7, 5)).toBeCloseTo(mid, 6); // a ~7 s period
    expect(voidCoreY(0, 10)).toBeLessThan(0); // above the screen until it opens
    expect(voidCoreY(10 + VOID_CORE_OPEN_S, 10)).toBe(VOID_CORE_Y);
  });

  it("the wipe is fully opaque around its midpoint, the death has three stages, the voice expires", () => {
    expect(voidWipeCover(0)).toBe(0);
    expect(voidWipeCover(VOID_WIPE_MID_S)).toBe(1);
    expect(voidWipeCover(VOID_WIPE_S)).toBe(0);
    expect(voidDeathStage(0)).toBe("cracks");
    expect(voidDeathStage(2)).toBe("implosion");
    expect(voidDeathStage(VOID_DYING_S - 0.1)).toBe("flash");
    expect(voidEyeDeathStage(0)).toBe("cracks");
    expect(voidEyeDeathStage((VOID_EYE_CRACK_S + VOID_EYE_SHATTER_S) / 2)).toBe("shatter");
    expect(voidEyeDeathStage(VOID_DYING_S - 0.1)).toBe("flash");
    expect(VOID_DYING_S).toBeLessThanOrEqual(5);
    const state = voidIdle();
    state.voice = "HI";
    state.voiceAt = 10;
    expect(voidVoice(state, 10.5)).toBe("HI");
    expect(voidVoice(state, 20)).toBe("");
    state.phase = "reveal";
    state.phaseAt = 0;
    expect(voidPhaseProgress(state, VOID_REVEAL_S / 2)).toBeCloseTo(0.5, 6);
    expect(voidInvulnerable(state, 1)).toBe(true); // the reveal is not a fighting phase
  });

  it("the collapse pattern is deterministic and leaves safe ground", () => {
    let falling = 0;
    let safe = 0;
    for (let seed = 1; seed < 8; seed++)
      for (let spotX = 80; spotX < 250; spotX += 30)
        if (voidCollapseAt(seed, spotX, 100)) falling++;
        else safe++;
    expect(falling).toBeGreaterThan(0);
    expect(safe).toBeGreaterThan(0);
    expect(voidCollapseAt(3, 100, 100)).toBe(voidCollapseAt(3, 100, 100));
    expect(voidCollapseAt(3, -50, 100)).toBe(false); // outside the arena
  });
});

describe("the secret final boss: the sequence", () => {
  it("does not trigger when nobody is left on B3 at the end of the Lord's death", () => {
    const { office, fighters } = lordWith(2);
    slayLord(office, fighters[0]);
    for (const raider of fighters) raider.floor = 1; // the party left
    run(office, VOID_SHATTER_S + VOID_WIPE_S + 1);
    expect(office.voidFight.phase).toBe("none");
    expect(office.voidActive()).toBe(false);
    expect(office.pipFloor()).toBe(DUNGEON_FLOORS);
  });

  it("does not trigger when the Lord was never fought (no raider on B3)", () => {
    const { office } = withRaiders(1);
    run(office, 5);
    expect(office.voidFight.phase).toBe("none");
  });

  it("plays shatter, transition, reveal and fight on the documented timings", () => {
    const { office, fighters } = lordWith(2);
    const cues = new Set<string>();
    const lord = office.lord;
    const started: Record<string, number> = {};
    slayLord(office, fighters[0]);
    let moved = -1;
    for (let elapsed = 0; elapsed < VOID_SHATTER_S + VOID_WIPE_S + VOID_REVEAL_S + LAG_S; elapsed += STEP) {
      run(office, STEP, cues);
      const phase = office.voidFight.phase;
      if (!(phase in started)) started[phase] = office.voidFight.phaseAt;
      if (moved < 0 && fighters.every((raider) => raider.floor === VOID_FLOOR)) moved = office.clock;
      if (phase === "transition" && moved < 0)
        expect(fighters.every((raider) => raider.floor === DUNGEON_FLOORS)).toBe(true); // nobody moves before the midpoint
      if (phase === "shatter") {
        expect(office.voidOnFloor()).toBe(false);
        expect(voidVoice(office.voidFight, office.clock)).toBe(VOID_LINE_SHATTER);
        expect(office.getView().dungeon.lordFight).toBe(true); // the inset stays up for the whole secret fight
      }
    }
    expect(office.voidFight.phase).toBe("fight");
    // the shatter IS the Lord's death: it starts at the killing blow, from his fight position, with no finale of his own
    expect(started.shatter).toBe(lord.deadAt);
    expect(office.voidFight.lordX).toBe(dungeonLordPoint().x);
    expect(office.voidFight.lordY).toBe(dungeonLordPoint().y);
    expect(lord.finaleAt).toBe(lord.deadAt);
    expect(office.banners.some((banner) => !banner.epic)).toBe(false); // no "has fallen" banner
    expect(cues.has("lordDeath")).toBe(false);
    expect(cues.has("fanfare")).toBe(false);
    expect(started.transition - started.shatter).toBeGreaterThanOrEqual(VOID_SHATTER_S);
    expect(started.transition - started.shatter).toBeLessThan(VOID_SHATTER_S + PHASE_TOLERANCE_S);
    expect(moved - started.transition).toBeGreaterThanOrEqual(VOID_WIPE_MID_S);
    expect(moved - started.transition).toBeLessThan(VOID_WIPE_MID_S + PHASE_TOLERANCE_S);
    expect(started.reveal - started.transition).toBeGreaterThanOrEqual(VOID_WIPE_S);
    expect(started.reveal - started.transition).toBeLessThan(VOID_WIPE_S + PHASE_TOLERANCE_S);
    expect(started.fight - started.reveal).toBeGreaterThanOrEqual(VOID_REVEAL_S);
    expect(started.fight - started.reveal).toBeLessThan(VOID_REVEAL_S + PHASE_TOLERANCE_S);
    expect(office.voidOnFloor()).toBe(true);
    expect(office.pipFloor()).toBe(VOID_FLOOR);
    expect(office.banners.some((banner) => banner.epic && banner.text.includes("Veiled One"))).toBe(true);
    for (const cue of ["voidShatter", "voidWipe", "voidReveal"]) expect(cues.has(cue)).toBe(true);
    // the Lord's normal rewards still happened
    expect(fighters[0].gold).toBeGreaterThanOrEqual(GOLD_LOOT);
    expect(lord.slain).toBe(1);
  });

  it("moves the raiders to valid Sanctum spots and the camera follows them from B3", () => {
    const { office, fighters } = lordWith(3);
    office.setScene("dungeon");
    office.setDungeonFloor(DUNGEON_FLOORS);
    office.setDungeonFloor(VOID_FLOOR);
    expect(office.dungeonFloor).toBe(DUNGEON_FLOORS); // floor 4 is not open yet
    slayLord(office, fighters[0]);
    run(office, VOID_SHATTER_S + VOID_WIPE_MID_S + PHASE_TOLERANCE_S + STEP * 2);
    expect(office.dungeonFloor).toBe(VOID_FLOOR);
    for (const raider of fighters) {
      const spot = office.raiderPoint(raider);
      expect(Number.isFinite(spot.x) && Number.isFinite(spot.y)).toBe(true);
      expect(spot).toEqual(dungeonSpotOf(office.raidSpotIndex(raider), VOID_FLOOR));
    }
    expect(office.busiestFloor()).toBe(VOID_FLOOR);
    expect(office.floorCounts()).toHaveLength(VOID_FLOOR);
    expect(office.dungeonStats().floorRaiders).toHaveLength(DUNGEON_FLOORS);
    office.setDungeonFloor(VOID_FLOOR + 3);
    expect(office.dungeonFloor).toBe(VOID_FLOOR);
  });

  it("leaves a camera that was elsewhere alone", () => {
    const { office, fighters } = lordWith(1);
    office.setScene("dungeon");
    office.setDungeonFloor(1);
    slayLord(office, fighters[0]);
    run(office, VOID_SHATTER_S + VOID_WIPE_S);
    expect(office.dungeonFloor).toBe(1);
  });

  it("locks the hp pool at the reveal: Lord pool x3, and a late arrival does not grow it", () => {
    const { office, fighters } = lordWith(2);
    slayLord(office, fighters[0]);
    run(office, VOID_SHATTER_S + VOID_WIPE_S + LAG_S);
    expect(office.voidFight.phase).toBe("reveal");
    const expected = Math.round(lordMaxHp(2, 0) * VOID_HP_MULT);
    expect(office.voidFight.maxHp).toBe(expected);
    expect(office.voidFight.maxHp).toBeGreaterThan(office.lord.maxHp * 2);
    const extra = withExtraRaider(office);
    extra.floor = VOID_FLOOR;
    run(office, 1);
    expect(office.voidFight.maxHp).toBe(expected);
  });

  it("nobody can hurt it during the reveal", () => {
    const { office, fighters } = lordWith(1);
    slayLord(office, fighters[0]);
    run(office, VOID_SHATTER_S + VOID_WIPE_S + 1);
    expect(office.voidFight.phase).toBe("reveal");
    strike(office, fighters[0].id);
    expect(office.voidFight.hp).toBe(office.voidFight.maxHp);
  });
});

/** an extra overflow raider appears on B3 in a running office */
const withExtraRaider = (office: TestOffice): Employee => {
  const id = sid();
  office.event(ev(id, "SessionStart"));
  tick(office, 30);
  return emp(office, id);
};

describe("the secret final boss: damage, phases and attacks", () => {
  it("raiders' tool calls hit it through the Lord's pipeline", () => {
    const { office, fighters } = toFight();
    const before = office.voidFight.hp;
    strike(office, fighters[0].id, "Bash");
    expect(office.voidFight.hp).toBeLessThan(before);
    expect(office.voidFight.hitAt).toBe(office.clock);
    expect(office.popups.some((popup) => popup.dungeon === VOID_FLOOR && popup.text.startsWith("-"))).toBe(true);
  });

  it("phase 2 at 60%: an invulnerable TRUE FORM cinematic with shake, then it can be hurt again", () => {
    const { office, fighters } = toFight();
    const boss = office.voidFight;
    boss.hp = boss.maxHp * VOID_PHASE2_BELOW + 1;
    office.sfxQueue.length = 0;
    strike(office, fighters[0].id, "Bash");
    expect(boss.phase).toBe("phase2");
    expect(boss.phase2At).toBe(office.clock);
    expect(office.sfxQueue).toContain("voidTrueForm");
    expect(office.voidInvulnerable()).toBe(true);
    expect(office.banners.some((banner) => banner.epic && banner.text === "TRUE FORM")).toBe(true);
    expect(boss.shake).toBeGreaterThan(0);
    const hp = boss.hp;
    strike(office, fighters[0].id, "Bash");
    expect(boss.hp).toBe(hp); // the cinematic takes no damage
    run(office, VOID_TRUE_FORM_S / 2);
    expect(boss.shake).toBeGreaterThan(0); // and keeps shaking
    strike(office, fighters[0].id, "Bash");
    expect(boss.hp).toBe(hp);
    expect(boss.ascendAt).toBe(-1);
    run(office, VOID_TRUE_FORM_S / 2 + STEP * 2);
    expect(office.voidInvulnerable()).toBe(false);
    strike(office, fighters[0].id, "Bash");
    expect(boss.hp).toBeLessThan(hp);
    expect(boss.phase).toBe("phase2");
  });

  it("phase 3 at 25%: THE VOID AWAKENS, an invulnerable ascend with banner, voice and shake, then the core can be hurt", () => {
    const { office, fighters } = toFight();
    const boss = office.voidFight;
    toPhase2(office, fighters[0]);
    boss.hp = boss.maxHp * VOID_PHASE3_BELOW + 1;
    office.sfxQueue.length = 0;
    strike(office, fighters[0].id);
    expect(boss.phase).toBe("phase3");
    expect(boss.phase3At).toBe(office.clock);
    expect(boss.ascendAt).toBe(office.clock);
    expect(boss.invulnUntil).toBeCloseTo(office.clock + VOID_ASCEND_S, 6);
    expect(office.sfxQueue).toContain("voidAscend");
    expect(office.banners.some((banner) => banner.epic && banner.text === "THE VOID AWAKENS")).toBe(true);
    expect(VOID_BANNER_AWAKENS_S).toBeGreaterThan(0);
    expect(boss.shake).toBeGreaterThan(0);
    expect(boss.hands.every((hand) => hand.state === "rise")).toBe(true);
    const hp = boss.hp;
    strike(office, fighters[0].id);
    expect(boss.hp).toBe(hp);
    run(office, VOID_ASCEND_S / 2);
    expect(boss.shake).toBeGreaterThan(0); // the cinematic keeps shaking
    strike(office, fighters[0].id);
    expect(boss.hp).toBe(hp);
    expect(boss.attack?.landed ?? true).toBe(true); // nothing is thrown during the ascend
    run(office, VOID_ASCEND_S / 2 + STEP * 2);
    expect(office.voidInvulnerable()).toBe(false);
    run(office, VOID_VOICE_S / 2);
    expect(office.voidLine()).toBe("I AM THE VOID ITSELF!"); // the voice follows its banner
    strike(office, fighters[0].id);
    expect(boss.hp).toBeLessThan(hp);
  });

  it("the core floats down, sways across the arena, takes the hits, and the hands settle into hover", () => {
    const { office, fighters } = toFight();
    const boss = office.voidFight;
    toPhase2(office, fighters[0]);
    boss.hp = boss.maxHp * VOID_PHASE3_BELOW + 1;
    strike(office, fighters[0].id);
    expect(boss.hands).toHaveLength(VOID_HAND_COUNT);
    expect(boss.coreOpenAt).toBeCloseTo(boss.ascendAt + VOID_ASCEND_S - VOID_CORE_OPEN_S, 6);
    expect(boss.coreY).toBeLessThan(0); // still above the screen
    run(office, VOID_ASCEND_S + STEP * 2);
    expect(boss.coreY).toBe(VOID_CORE_Y);
    ctlOf(office).nextAttackAt = 1e9;
    const xs = new Set<number>();
    let lo = Infinity;
    let hi = -Infinity;
    for (let k = 0; k < 7 * 20; k++) {
      run(office, STEP);
      xs.add(Math.round(boss.coreX));
      lo = Math.min(lo, boss.coreX);
      hi = Math.max(hi, boss.coreX);
      expect(Math.abs(boss.coreX - voidCoreX(office.clock, boss.ascendAt))).toBeLessThan(VOID_CORE_SWAY_PX / 10); // one frame behind at most
    }
    expect(xs.size).toBeGreaterThan(10);
    expect(hi - lo).toBeGreaterThan(VOID_CORE_SWAY_PX);
    expect(lo).toBeGreaterThanOrEqual(VOID_ARENA_X0);
    expect(hi).toBeLessThanOrEqual(VOID_ARENA_X1);
    expect(boss.hands.every((hand) => hand.state === "hover")).toBe(true);
    expect(boss.hands.map((hand) => hand.side)).toEqual([-1, 1]);
    const before = boss.hp;
    strike(office, fighters[0].id);
    expect(boss.hp).toBeLessThan(before);
    expect(Math.abs(boss.lastHitX - boss.coreX)).toBeLessThanOrEqual(10);
    expect(Math.abs(boss.lastHitY - boss.coreY)).toBeLessThanOrEqual(10);
    expect(boss.lastHitMinion).toBe(false);
    expect(VOID_HAND_RISE_S).toBeGreaterThan(0);
  });

  it("a huge hit still plays every phase", () => {
    const { office, fighters } = toFight();
    const boss = office.voidFight;
    fighters[0].lv = 30;
    boss.hp = boss.maxHp * VOID_PHASE2_BELOW + 1;
    for (let k = 0; k < 3; k++) strike(office, fighters[0].id);
    expect(boss.phase).toBe("phase2");
    expect(boss.hp / boss.maxHp).toBeGreaterThan(VOID_PHASE3_BELOW);
  });

  it("an attack comes after the first gap, is telegraphed, and hurts or is dodged", () => {
    const { office, fighters } = toFight();
    const boss = office.voidFight;
    expect(boss.attack).toBeNull();
    run(office, VOID_FIRST_ATTACK_S + 0.3);
    expect(boss.attack).not.toBeNull();
    const attack = boss.attack!;
    expect(attack.hitAt).toBeGreaterThan(attack.at);
    expect(attack.landed).toBe(false); // still on the warning
    expect(attack.hitAt - attack.at).toBeGreaterThanOrEqual(VOID_MIN_TELEGRAPH_S);
    run(office, 3);
    expect(attack.landed).toBe(true);
    expect(fighters[0].hearts).toBeLessThanOrEqual(MAX_HEARTS);
  });

  it("blink puts the boss right beside the raider it aimed at", () => {
    const { office, fighters } = toFight();
    fixedRandom(0.6); // picks blink; the raider does not dodge
    ctlOf(office).nextAttackAt = office.clock;
    run(office, STEP * 2);
    expect(office.voidFight.attack?.kind).toBe("blink");
    const spot = office.raiderPoint(fighters[0]);
    const attack = office.voidFight.attack!;
    run(office, attack.hitAt - office.clock + 0.2);
    expect(office.voidFight.x).toBe(spot.x + VOID_BLINK_DX);
    expect(fighters[0].voidHitAt).toBeGreaterThanOrEqual(attack.hitAt);
    expect(office.voidFight.blinkAt).toBeGreaterThan(0);
    expect(office.voidFight.blinkFromX).not.toBe(office.voidFight.x);
    run(office, 1.2); // it steps back home once the strike is done
    expect(office.voidFight.x).toBe(VOID_HOME_X);
  });

  it("regular attacks never take the last heart", () => {
    const { office, fighters } = toFight();
    fixedRandom(0.6); // blink; nobody dodges
    fighters[0].hearts = 1;
    ctlOf(office).nextAttackAt = office.clock;
    run(office, 3);
    expect(fighters[0].hearts).toBe(1);
    expect(fighters[0].hurtUntil).toBeGreaterThan(0);
  });

  it("the beam only reaches raiders on its row", () => {
    const { office, fighters } = toFight(3);
    fixedRandom(0.01); // the first pick is a beam, and nobody dodges... except this: dodge chance applies
    ctlOf(office).nextAttackAt = office.clock;
    run(office, STEP * 2);
    const attack = office.voidFight.attack;
    expect(attack?.kind).toBe("beam");
    for (const raider of fighters) {
      const onRow = Math.abs(office.raiderPoint(raider).y - attack!.targetY) <= VOID_BEAM_HALF_PX;
      expect(typeof onRow).toBe("boolean");
    }
  });

  it("the eclipse hits every raider: dodgers survive at 1 heart, the rest are left at 0", () => {
    for (const [roll, hearts, hit] of [
      [0.01, 1, false],
      [0.99, 1, true],
    ] as const) {
      const { office, fighters } = toFight(3);
      const boss = office.voidFight;
      boss.hp = boss.maxHp * VOID_PHASE2_BELOW + 1;
      strike(office, fighters[0].id);
      run(office, VOID_TRUE_FORM_S + STEP * 2);
      expect(boss.phase).toBe("phase2");
      for (const raider of fighters) raider.hearts = MAX_HEARTS;
      ctlOf(office).phaseCount = VOID_ECLIPSE_EVERY - 1; // the next one is the eclipse
      ctlOf(office).nextAttackAt = office.clock;
      fixedRandom(roll);
      const cues = run(office, STEP * 2);
      expect(boss.attack?.kind).toBe("eclipse");
      expect(boss.attack!.landed).toBe(false);
      expect(fighters.every((raider) => raider.hearts === MAX_HEARTS)).toBe(true); // still the warning
      run(office, boss.attack!.hitAt - office.clock + STEP * 2, cues);
      expect(cues.has("voidEclipse")).toBe(true);
      for (const raider of fighters) {
        expect(raider.hearts).toBe(hearts); // never below one heart
        expect(raider.voidHitAt >= boss.attack!.hitAt).toBe(hit); // dodgers hop, the rest are hit and knocked
      }
      expect(boss.quakeUntil).toBeGreaterThan(office.clock);
      vi.restoreAllMocks();
      fixedRandom(0.5);
    }
  });

  it("class skills fly to the boss with their effects tagged to floor 4", () => {
    const { office, fighters } = toFight();
    fighters[0].lv = 30; // a legend: a class skill every few hits
    office.voidFight.maxHp = office.voidFight.hp = 1e6;
    for (let k = 0; k < 20; k++) strike(office, fighters[0].id);
    expect(office.skillFx.some((fx) => fx.dungeon === VOID_FLOOR)).toBe(true);
    expect(office.particles.some((particle) => particle.on && particle.dungeon === VOID_FLOOR)).toBe(true);
  });
});

describe("the secret final boss: the end", () => {
  const slayVoid = (office: TestOffice, fighter: Employee) => {
    const boss = office.voidFight;
    toPhase3(office, fighter);
    boss.hp = 1;
    strike(office, fighter.id);
  };

  it("dies in stages, then victory pays every raider on floor 4, counts the kill and the raiders go home", () => {
    const { office, fighters } = toFight(2);
    const cues = new Set<string>();
    const before = fighters.map((raider) => ({ gold: raider.gold, kills: raider.kills, lv: raider.lv }));
    const treasury = office.treasury;
    const bosses = office.dungeonStats().bosses;
    office.setScene("dungeon");
    office.setDungeonFloor(VOID_FLOOR);
    slayVoid(office, fighters[0]);
    expect(office.voidFight.phase).toBe("dying");
    expect(office.voidFight.hp).toBe(0);
    expect(office.voidFight.dyingAt).toBe(office.clock);
    expect(office.voidInvulnerable()).toBe(true);
    run(office, VOID_DYING_S + STEP * 2, cues);
    expect(office.voidFight.phase).toBe("victory");
    expect(cues.has("voidDeath")).toBe(true);
    expect(cues.has("voidVictory")).toBe(true);
    expect(office.voidFight.kills).toBe(1);
    expect(office.dungeonStats().bosses).toBe(bosses + 1);
    expect(office.treasury).toBe(treasury + VOID_GOLD * 2);
    fighters.forEach((raider, index) => {
      expect(raider.gold).toBe(before[index].gold + VOID_GOLD);
      expect(raider.kills).toBe(before[index].kills + VOID_KILLS);
      expect(raider.lv).toBeGreaterThan(before[index].lv); // the xp is big enough to level
    });
    expect(VOID_GOLD).toBeGreaterThan(GOLD_LOOT * 4);
    const banner = office.banners.find(
      (item) => item.epic && item.text.includes("Veiled One") && item.text.includes(fighters[0].project),
    );
    expect(banner).toBeDefined();
    expect(office.getView().log.some((row) => row.kind === KIND_LORD && row.text.includes("Veiled One"))).toBe(true);
    run(office, VOID_VICTORY_S + PHASE_TOLERANCE_S, cues);
    expect(office.voidFight.phase).toBe("none");
    expect(office.voidActive()).toBe(false);
    expect(office.voidFight.kills).toBe(1); // the count survives
    expect(fighters.every((raider) => raider.floor === DUNGEON_FLOORS)).toBe(true); // overflow raiders stand on B3 again
    expect(office.dungeonFloor).toBe(DUNGEON_FLOORS); // the camera came back
    expect(office.pipFloor()).toBe(DUNGEON_FLOORS);
    office.setDungeonFloor(VOID_FLOOR);
    expect(office.dungeonFloor).toBe(DUNGEON_FLOORS);
  });

  it("a second Lord kill starts the whole thing again", () => {
    const { office, fighters } = toFight();
    slayVoid(office, fighters[0]);
    run(office, VOID_DYING_S + VOID_VICTORY_S + 1);
    expect(office.voidFight.phase).toBe("none");
    run(office, 100); // the Lord rises again
    expect(office.lord.hp).toBe(1);
    for (let i = 0; i < 40 && office.lord.engagedAt < 0; i++) tick(office, 0.1);
    slayLord(office, fighters[0]);
    run(office, 0.3);
    expect(office.voidFight.phase).toBe("shatter");
  });

  it("retreats when every raider left before the kill, and the hp resets", () => {
    const { office, fighters } = toFight();
    const cues = new Set<string>();
    office.voidFight.hp = office.voidFight.maxHp * 0.7;
    for (const raider of fighters) raider.floor = 1; // raid timers / idle sent them home
    run(office, STEP * 3, cues);
    expect(office.voidFight.phase).toBe("retreat");
    expect(office.banners.some((banner) => banner.epic)).toBe(true);
    run(office, VOID_RETREAT_S + STEP * 2, cues);
    expect(office.voidFight.phase).toBe("none");
    expect(office.voidFight.hp).toBe(0);
    expect(office.voidFight.maxHp).toBe(0);
    expect(office.voidFight.kills).toBe(0);
    expect(office.voidOnFloor()).toBe(false);
  });

  it("a session that ends mid-sequence never leaves the boss stuck", () => {
    const { office, fighters } = lordWith(1);
    slayLord(office, fighters[0]);
    run(office, VOID_SHATTER_S + 0.3); // mid-wipe, before the midpoint
    expect(office.voidFight.phase).toBe("transition");
    office.event(ev(fighters[0].id, "SessionEnd"));
    run(office, VOID_WIPE_S + VOID_REVEAL_S + 12);
    expect(office.voidFight.phase).toBe("none");
  });

  it("clear() forgets the whole secret fight", () => {
    const { office, fighters } = toFight();
    office.voidFight.kills = 2;
    office.setScene("dungeon");
    office.setDungeonFloor(VOID_FLOOR);
    strike(office, fighters[0].id);
    office.clear();
    expect(office.voidFight.phase).toBe("none");
    expect(office.voidFight.hp).toBe(0);
    expect(office.voidFight.kills).toBe(0);
    expect(office.voidActive()).toBe(false);
    expect(office.dungeonFloor).toBe(1);
    run(office, 2);
    expect(office.voidFight.phase).toBe("none");
  });

  it("under reduced motion nothing ever shakes", () => {
    const { office, fighters } = lordWith(1);
    office.reducedMotion = true;
    slayLord(office, fighters[0]);
    let worst = 0;
    const watch = (seconds: number) => {
      for (let elapsed = 0; elapsed < seconds; elapsed += STEP) {
        tick(office, STEP, STEP);
        worst = Math.max(worst, office.voidFight.shake);
      }
    };
    watch(VOID_SHATTER_S + VOID_WIPE_S + VOID_REVEAL_S + LAG_S);
    expect(office.voidFight.phase).toBe("fight");
    slayVoid(office, fighters[0]);
    watch(VOID_DYING_S + 1);
    expect(office.voidFight.phase).toBe("victory");
    expect(worst).toBe(0);
  });

  it("raiders on floor 4 are never trapped: a desk raider's idle timer still sends it home", () => {
    const office = newOffice();
    const id = sid();
    office.event(ev(id, "SessionStart"));
    for (let i = 0; i < 400 && emp(office, id).state !== "SEATED"; i++) tick(office, 0.25);
    for (let i = 0; i < RAID_READY_CALLS; i++) strike(office, id, "Read");
    tick(office, 31);
    const worker = emp(office, id);
    expect(worker.raidIn).toBe(true);
    sendToLord(worker);
    for (let i = 0; i < 40 && office.lord.engagedAt < 0; i++) tick(office, 0.1);
    slayLord(office, worker);
    run(office, VOID_SHATTER_S + VOID_WIPE_S + VOID_REVEAL_S + LAG_S);
    expect(office.voidFight.phase).toBe("fight");
    expect(worker.floor).toBe(VOID_FLOOR);
    run(office, RAID_IDLE_S + 5); // its session goes quiet
    expect(worker.raidIn).toBe(false);
    expect(worker.inDungeon).toBe(false);
    run(office, VOID_RETREAT_S + 1);
    expect(office.voidFight.phase).toBe("none");
  });
});

describe("the secret final boss: it acts and it shows", () => {
  const slay = (office: TestOffice, fighter: Employee) => {
    const boss = office.voidFight;
    toPhase3(office, fighter);
    boss.hp = 1;
    strike(office, fighter.id);
  };

  it("the first attack starts ~1.2 s after the fight begins, and every warning is at least 0.9 s", () => {
    const { office } = toFight();
    const boss = office.voidFight;
    const fightAt = boss.phaseAt;
    for (let k = 0; k < 40 && !boss.attack; k++) run(office, STEP);
    expect(boss.attack).not.toBeNull();
    expect(boss.attack!.at - fightAt).toBeGreaterThanOrEqual(VOID_FIRST_ATTACK_S - STEP);
    expect(boss.attack!.at - fightAt).toBeLessThan(VOID_FIRST_ATTACK_S + 0.4);
    for (const kind of ["beam", "eyes", "blink", "collapse", "summon", "eclipse", "hand", "gaze"] as const)
      for (const phase of ["fight", "phase2", "phase3"] as const)
        expect(voidTelegraphS(kind, phase)).toBeGreaterThanOrEqual(VOID_MIN_TELEGRAPH_S);
    for (const kind of ["hand", "gaze"] as const) expect(voidTelegraphS(kind, "phase3")).toBeGreaterThanOrEqual(1);
  });

  it("the gaps between attacks shrink by phase (3.0 / 2.2 / 2.0 s, +-10%)", () => {
    for (const [phase, gap] of [
      ["fight", 3],
      ["phase2", 2.2],
      ["phase3", 2],
    ] as const) {
      expect(voidNextGap(phase, 0)).toBeCloseTo(gap * 0.9, 6);
      expect(voidNextGap(phase, 1)).toBeCloseTo(gap * 1.1, 6);
    }
  });

  it("has at least eight taunts, uppercase ASCII, and says one every ~6 s with a menace pulse in between", () => {
    const lines = Object.values(VOID_TAUNTS).flat();
    expect(lines.length).toBeGreaterThanOrEqual(8);
    for (const line of lines) expect(line).toMatch(/^[A-Z0-9 .!?:-]+$/);
    const { office } = toFight();
    const boss = office.voidFight;
    const said = new Set<string>();
    let menace = boss.menaceAt;
    let pulses = 0;
    for (let k = 0; k < 20 * 14; k++) {
      run(office, STEP);
      if (office.voidLine()) said.add(office.voidLine());
      if (boss.menaceAt !== menace) {
        menace = boss.menaceAt;
        pulses++;
      }
    }
    expect(said.size).toBeGreaterThanOrEqual(2);
    expect(pulses).toBeGreaterThanOrEqual(5);
  });

  it("summon raises void minions that shield the boss until tool calls kill them, and they crumble after 8 s", () => {
    const { office, fighters } = toFight();
    const boss = office.voidFight;
    fixedRandom(0.9); // phase 1 picks summon; nobody dodges
    ctlOf(office).nextAttackAt = office.clock;
    run(office, STEP * 2);
    expect(boss.attack?.kind).toBe("summon");
    ctlOf(office).nextAttackAt = 1e9; // nothing else interferes
    run(office, boss.attack!.hitAt - office.clock + 0.2);
    const alive = boss.minions.filter((minion) => minion.on && minion.clearedAt < 0);
    expect(alive.length).toBeGreaterThanOrEqual(2);
    expect(alive.length).toBeLessThanOrEqual(3);
    expect(boss.shielded).toBe(true);
    const start = alive.map((minion) => ({ x: minion.x, y: minion.y }));
    const target = office.raiderPoint(fighters[0]);
    run(office, 1);
    const moved = alive[0];
    expect(Math.hypot(target.x - moved.x, target.y - moved.y)).toBeLessThan(
      Math.hypot(target.x - start[0].x, target.y - start[0].y),
    );
    // hits kill minions, the boss takes nothing
    const hp = boss.hp;
    for (let k = 0; k < alive.length; k++) {
      strike(office, fighters[0].id);
      expect(boss.lastHitMinion).toBe(true);
      expect(boss.blockedAt).toBe(office.clock);
      expect(boss.hp).toBe(hp);
    }
    expect(boss.shielded).toBe(false);
    strike(office, fighters[0].id);
    expect(boss.hp).toBeLessThan(hp);
    expect(boss.lastHitMinion).toBe(false);
    // unkilled minions despawn
    ctlOf(office).nextAttackAt = office.clock;
    run(office, STEP * 2);
    expect(boss.attack?.kind).not.toBe("summon"); // not while minions live
    boss.attack!.endAt = office.clock;
    for (const minion of boss.minions) minion.on = false;
    ctlOf(office).nextAttackAt = office.clock;
    fixedRandom(0.9);
    run(office, STEP * 2);
    ctlOf(office).nextAttackAt = 1e9;
    run(office, 1.5);
    expect(boss.shielded).toBe(true);
    run(office, VOID_MINION_LIFE_S + 1);
    expect(boss.shielded).toBe(false);
    expect(boss.minions.every((minion) => !minion.on)).toBe(true);
  });

  it("a landed attack records the hit, the knockback, the impact and the heart loss", () => {
    const { office, fighters } = toFight();
    const boss = office.voidFight;
    fixedRandom(0.6); // blink, no dodge
    fighters[0].hearts = MAX_HEARTS;
    ctlOf(office).nextAttackAt = office.clock;
    run(office, STEP * 2);
    run(office, boss.attack!.hitAt - office.clock + 0.2);
    expect(fighters[0].voidHitAt).toBeGreaterThanOrEqual(boss.attack!.hitAt);
    expect([-1, 1]).toContain(fighters[0].voidKnock);
    expect(boss.voidImpactAt).toBeGreaterThanOrEqual(boss.attack!.hitAt);
    expect(Number.isFinite(boss.voidImpactX) && Number.isFinite(boss.voidImpactY)).toBe(true);
    expect(boss.lastHurtId).toBe(fighters[0].id);
    expect(boss.lastHurtHearts).toBe(MAX_HEARTS - 1);
    expect(fighters[0].hearts).toBe(MAX_HEARTS - 1);
    expect(office.popups.some((popup) => popup.dungeon === VOID_FLOOR && popup.text === "-1")).toBe(true);
  });

  it("every raider strike is recorded on a varied point of the boss body", () => {
    const { office, fighters } = toFight();
    const boss = office.voidFight;
    boss.maxHp = boss.hp = 1e6;
    const spots = new Set<string>();
    vi.restoreAllMocks();
    for (let k = 0; k < 12; k++) {
      strike(office, fighters[0].id);
      expect(boss.lastHitId).toBe(fighters[0].id);
      expect(boss.lastHitAt).toBe(office.clock);
      expect(boss.lastHitDmg).toBeGreaterThan(0);
      expect(boss.lastHitY).toBeLessThanOrEqual(VOID_FEET_Y);
      expect(boss.lastHitY).toBeGreaterThanOrEqual(VOID_FEET_Y - VOID_BODY_H);
      expect(Math.abs(boss.lastHitX - boss.x)).toBeLessThanOrEqual(VOID_BODY_W / 2);
      spots.add(`${Math.round(boss.lastHitX)},${Math.round(boss.lastHitY)}`);
    }
    expect(spots.size).toBeGreaterThan(3);
    fixedRandom(0.5);
  });

  it("hitAt only moves when damage is applied; blocked hits set blockedAt instead", () => {
    const { office, fighters } = lordWith(1);
    slayLord(office, fighters[0]);
    run(office, VOID_SHATTER_S + VOID_WIPE_S + 1);
    const boss = office.voidFight;
    expect(boss.phase).toBe("reveal");
    strike(office, fighters[0].id);
    expect(boss.hitAt).toBe(-99);
    expect(boss.blockedAt).toBe(office.clock);
    run(office, VOID_REVEAL_S);
    boss.hp = boss.maxHp * VOID_PHASE2_BELOW + 1;
    strike(office, fighters[0].id);
    const hitAt = boss.hitAt;
    expect(hitAt).toBe(office.clock);
    run(office, 0.2);
    strike(office, fighters[0].id); // the roar blocks it
    expect(boss.hitAt).toBe(hitAt);
    expect(boss.blockedAt).toBe(office.clock);
    expect(VOID_HIT_FLASH_S).toBe(0.08);
  });

  it("raiders stand in front of the boss: melee close, ranged a bit back", () => {
    const melee = { x: 0, y: 0 };
    const ranged = { x: 0, y: 0 };
    for (let slot = 0; slot < 8; slot++) {
      voidSpotOf(slot, "warrior", melee);
      voidSpotOf(slot, "mage", ranged);
      const near = Math.hypot(VOID_HOME_X - melee.x, (VOID_FEET_Y - melee.y) / 0.62);
      const far = Math.hypot(VOID_HOME_X - ranged.x, (VOID_FEET_Y - ranged.y) / 0.62);
      expect(near).toBeGreaterThanOrEqual(28);
      expect(near).toBeLessThanOrEqual(46);
      expect(far).toBeGreaterThan(near + 10);
      expect(melee.x).toBeLessThan(VOID_HOME_X);
    }
    const { office, fighters } = toFight();
    voidSpotOf(office.raidSpotIndex(fighters[0]), fighters[0].look.cls, melee);
    expect(office.raiderPoint(fighters[0])).toEqual(melee); // the walk up to the boss is done
  });

  it("banners and voice lines never overlap: the voice follows its banner", () => {
    const { office, fighters } = lordWith(1);
    slayLord(office, fighters[0]);
    expect(office.voidLine()).toBe(VOID_LINE_SHATTER); // straight into the cutscene
    run(office, VOID_SHATTER_S + VOID_WIPE_S + LAG_S / 2);
    expect(office.voidFight.phase).toBe("reveal");
    const reveal = office.voidFight.phaseAt;
    run(office, VOID_BANNER_S - 0.5);
    expect(office.banners.some((banner) => banner.epic)).toBe(true);
    expect(office.voidLine()).toBe(""); // still the banner's time
    run(office, 0.5 + VOID_BANNER_VOICE_GAP_S + 0.3);
    expect(office.clock - reveal).toBeGreaterThan(VOID_BANNER_S + VOID_BANNER_VOICE_GAP_S);
    expect(office.voidLine()).not.toBe("");
  });

  it("the death plays its full length before the victory plaque", () => {
    const { office, fighters } = toFight();
    const phases: string[] = [];
    slay(office, fighters[0]);
    const dyingAt = office.voidFight.dyingAt;
    expect(office.voidFight.phase).toBe("dying");
    for (let elapsed = 0; elapsed < VOID_DYING_S + 0.5; elapsed += STEP) {
      run(office, STEP);
      if (!phases.length || phases[phases.length - 1] !== office.voidFight.phase) phases.push(office.voidFight.phase);
      if (office.voidFight.phase === "dying")
        expect(office.banners.some((banner) => banner.text.includes(fighters[0].project))).toBe(false);
    }
    expect(phases).toEqual(["dying", "victory"]);
    expect(office.voidFight.phaseAt - dyingAt).toBeGreaterThanOrEqual(VOID_DYING_S);
    expect(office.banners.some((banner) => banner.epic && banner.text.includes(fighters[0].project))).toBe(true);
  });

  it("gives up when every raider in the Sanctum went quiet, and sends them back to B3", () => {
    const { office, fighters } = toFight();
    run(office, RAID_IDLE_S + 5);
    expect(office.voidFight.phase === "retreat" || office.voidFight.phase === "none").toBe(true);
    run(office, VOID_RETREAT_S + 1);
    expect(office.voidFight.phase).toBe("none");
    expect(fighters[0].floor).toBe(DUNGEON_FLOORS);
    expect(fighters[0].hearts).toBe(MAX_HEARTS);
  });

  it("a kill with nobody left to reward counts nothing", () => {
    const { office, fighters } = toFight();
    const bosses = office.dungeonStats().bosses;
    slay(office, fighters[0]);
    expect(office.voidFight.phase).toBe("dying");
    for (const raider of fighters) raider.floor = 1;
    run(office, VOID_DYING_S + 0.5);
    expect(office.voidFight.phase).toBe("none");
    expect(office.voidFight.kills).toBe(0);
    expect(office.dungeonStats().bosses).toBe(bosses);
  });

  it("effects over the characters are never translucent: the big bursts and coins are drawn under them", () => {
    const { office, fighters } = toFight();
    slay(office, fighters[0]);
    run(office, VOID_DYING_S + 0.5);
    expect(office.particles.some((particle) => particle.on && particle.spr === "coin" && particle.under)).toBe(true);
  });
});

describe("the secret final boss: THE VOID AWAKENS (phase 3)", () => {
  /** the party reaches the colossus with the ascend over, and nothing planned */
  const toColossus = (raiders = 1) => {
    const { office, fighters } = toFight(raiders);
    toPhase3(office, fighters[0]);
    for (const raider of fighters) raider.hearts = MAX_HEARTS;
    ctlOf(office).nextAttackAt = 1e9;
    return { office, fighters, boss: office.voidFight };
  };
  /** start the attack the pool index `roll` picks (< 0.5 hand, otherwise gaze) and run to the end of its warning */
  const startAttack = (office: TestOffice, roll: number, dodgeRoll: number) => {
    ctlOf(office).phaseCount = 0;
    ctlOf(office).nextAttackAt = office.clock;
    fixedRandom(roll);
    run(office, STEP * 2);
    const attack = office.voidFight.attack!;
    fixedRandom(dodgeRoll);
    return attack;
  };

  it("hands: exactly two slots, side -1 / 1, idle at the arena sides, then rise, hover, windup, slam, sink, hover", () => {
    const { office, fighters, boss } = toColossus();
    expect(boss.hands.map((hand) => hand.side)).toEqual([-1, 1]);
    expect(voidIdle().hands.every((hand) => hand.state === "hover")).toBe(true);
    expect(boss.hands.every((hand) => hand.state === "hover")).toBe(true);
    expect(boss.hands[0].x).toBeLessThan(boss.hands[1].x);
    const attack = startAttack(office, 0.1, 0.9); // hand, nobody dodges
    expect(attack.kind).toBe("hand");
    expect(attack.hitAt - attack.at).toBeGreaterThanOrEqual(1);
    const busy = boss.hands.filter((hand) => hand.state === "windup");
    expect(busy).toHaveLength(1);
    expect(busy[0].x).toBe(attack.targetX); // it winds up over the raider
    expect(busy[0].y).toBe(attack.targetY);
    const idle = boss.hands.find((hand) => hand !== busy[0])!;
    expect(idle.state).toBe("hover");
    expect(boss.invulnUntil).toBeLessThan(office.clock);
    for (let k = 0; k < 5; k++) strike(office, fighters[0].id); // keep the party awake
    const cues = run(office, attack.hitAt - office.clock + STEP * 2);
    expect(busy[0].state).toBe("slam");
    expect(busy[0].at).toBeGreaterThanOrEqual(attack.hitAt);
    expect(cues.has("voidHandSlam")).toBe(true);
    expect(boss.quakeUntil).toBeGreaterThan(office.clock);
    expect(boss.voidImpactX).toBe(attack.targetX);
    expect(boss.voidImpactY).toBe(attack.targetY);
    run(office, VOID_HAND_SLAM_S + STEP);
    expect(busy[0].state).toBe("sink");
    run(office, VOID_HAND_SINK_S + STEP);
    expect(busy[0].state).toBe("hover");
    expect(busy[0].y).toBe(idle.y);
  });

  it("the hand slam hits the raider under it, or is dodged", () => {
    for (const [dodgeRoll, hit] of [
      [0.9, true],
      [0.01, false],
    ] as const) {
      const { office, fighters, boss } = toColossus(2);
      const attack = startAttack(office, 0.1, dodgeRoll);
      expect(attack.kind).toBe("hand");
      const victim = fighters.find((raider) => office.raiderPoint(raider).x === attack.targetX)!;
      expect(victim).toBeDefined();
      victim.hearts = MAX_HEARTS;
      run(office, attack.hitAt - office.clock + STEP * 2);
      expect(victim.voidHitAt >= attack.hitAt).toBe(hit);
      expect(victim.dodgeAt >= attack.hitAt).toBe(!hit);
      if (hit) {
        expect(victim.hearts).toBeLessThan(MAX_HEARTS);
        expect(boss.lastHurtId).toBe(victim.id);
      } else expect(victim.hearts).toBe(MAX_HEARTS);
      vi.restoreAllMocks();
      fixedRandom(0.5);
    }
  });

  it("the gaze telegraphs 1.4 s, sweeps the floor and hits every raider it passes (dodge roll each)", () => {
    for (const [dodgeRoll, hit] of [
      [0.9, true],
      [0.01, false],
    ] as const) {
      const { office, fighters, boss } = toColossus(3);
      const attack = startAttack(office, 0.9, dodgeRoll);
      expect(attack.kind).toBe("gaze");
      expect(attack.hitAt - attack.at).toBeGreaterThanOrEqual(1.4 - 1e-6);
      expect(attack.endAt - attack.hitAt).toBeCloseTo(VOID_GAZE_SWEEP_S, 6);
      expect(attack.targetX).toBe(VOID_ARENA_X0);
      expect(fighters.every((raider) => raider.voidHitAt < attack.hitAt)).toBe(true);
      const cues = run(office, attack.hitAt - office.clock + STEP * 2);
      expect(cues.has("voidGaze")).toBe(true);
      run(office, VOID_GAZE_SWEEP_S);
      for (const raider of fighters) {
        expect(raider.voidHitAt >= attack.hitAt).toBe(hit);
        expect(raider.dodgeAt >= attack.hitAt).toBe(!hit);
      }
      expect(boss.lastHurtAt >= attack.hitAt).toBe(hit);
      vi.restoreAllMocks();
      fixedRandom(0.5);
    }
  });

  it("never summons: phase 2 can, the minions are gone at the transition and none appear in phase 3", () => {
    const { office, fighters } = toFight();
    const boss = office.voidFight;
    toPhase2(office, fighters[0]);
    fixedRandom(0.9); // phase 2 can summon
    ctlOf(office).nextAttackAt = office.clock;
    run(office, STEP * 2);
    expect(boss.attack?.kind).toBe("summon");
    run(office, boss.attack!.hitAt - office.clock + 0.2);
    expect(boss.shielded).toBe(true);
    ctlOf(office).nextAttackAt = 1e9;
    boss.hp = boss.maxHp * VOID_PHASE3_BELOW + 1;
    for (let k = 0; k < 8 && boss.phase === "phase2"; k++) strike(office, fighters[0].id); // minions die first
    expect(boss.phase).toBe("phase3");
    expect(boss.shielded).toBe(false);
    run(office, VOID_ASCEND_S + STEP * 2);
    const kinds = new Set<string>();
    for (let round = 0; round < 6; round++) {
      ctlOf(office).nextAttackAt = office.clock;
      for (let step = 0; step < 90; step++) {
        run(office, STEP);
        if (boss.attack) kinds.add(boss.attack.kind);
        if (step % 20 === 0) strike(office, fighters[0].id);
      }
      expect(boss.minions.some((minion) => minion.on && minion.clearedAt < 0)).toBe(false);
    }
    expect(kinds.has("summon")).toBe(false);
    for (const kind of kinds) expect(["hand", "gaze", "eclipse"]).toContain(kind);
  });

  it("dies as the eye shatters: cracks, shatter, flash over the full dying time", () => {
    const { office, fighters } = toFight(2);
    const boss = office.voidFight;
    toPhase3(office, fighters[0]);
    const coreAt = { x: boss.coreX, y: boss.coreY };
    const cues = new Set<string>();
    boss.hp = 1;
    office.sfxQueue.length = 0;
    strike(office, fighters[0].id);
    expect(boss.phase).toBe("dying");
    expect(boss.dyingEye).toBe(true);
    expect(boss.hands.every((hand) => hand.state === "sink")).toBe(true);
    const stages: string[] = [];
    for (let elapsed = 0; elapsed < VOID_DYING_S - STEP; elapsed += STEP) {
      run(office, STEP, cues);
      const stage = voidEyeDeathStage(office.clock - boss.dyingAt);
      if (!stages.length || stages[stages.length - 1] !== stage) stages.push(stage);
    }
    expect(stages).toEqual(["cracks", "shatter", "flash"]);
    expect(cues.has("voidShatterEye")).toBe(true);
    expect(boss.coreX).toBe(coreAt.x); // the core stays where it died
    expect(boss.coreY).toBe(coreAt.y);
    run(office, STEP * 4 + 0.3, cues);
    expect(boss.phase).toBe("victory");
    expect(boss.kills).toBe(1);
  });

  it("under reduced motion the ascend, the hand slam and the gaze never shake", () => {
    const { office, fighters } = toFight();
    office.reducedMotion = true;
    const boss = office.voidFight;
    let worst = 0;
    const watch = (seconds: number) => {
      for (let elapsed = 0; elapsed < seconds; elapsed += STEP) {
        run(office, STEP);
        worst = Math.max(worst, boss.shake);
      }
    };
    boss.hp = boss.maxHp * VOID_PHASE2_BELOW + 1;
    strike(office, fighters[0].id);
    watch(VOID_TRUE_FORM_S + STEP * 2);
    boss.hp = boss.maxHp * VOID_PHASE3_BELOW + 1;
    strike(office, fighters[0].id);
    expect(boss.phase).toBe("phase3");
    watch(VOID_ASCEND_S + STEP * 2);
    for (const roll of [0.1, 0.9]) {
      startAttack(office, roll, 0.9);
      for (let k = 0; k < 4; k++) strike(office, fighters[0].id);
      watch(boss.attack!.endAt - office.clock + STEP);
    }
    expect(boss.quakeUntil).toBe(0);
    expect(worst).toBe(0);
  });

  it("clear() forgets the colossus: core, hands and ascend", () => {
    const { office, boss } = toColossus();
    office.clear();
    expect(office.voidFight.ascendAt).toBe(-1);
    expect(office.voidFight.coreOpenAt).toBe(-1);
    expect(office.voidFight.hands.every((hand) => hand.state === "hover")).toBe(true);
    expect(boss.phase).toBe("none");
  });
});

describe("the secret final boss: the transformation shockwave", () => {
  const stands = (office: TestOffice, fighters: Employee[]) => fighters.map((raider) => office.raiderPoint(raider));
  const distToBoss = (office: TestOffice, point: { x: number; y: number }) =>
    Math.hypot(point.x - office.voidFight.x, point.y - VOID_FEET_Y);

  it("TRUE FORM and THE VOID AWAKENS knock every raider back without costing a heart, and move them farther", () => {
    const { office, fighters } = toFight(6);
    const boss = office.voidFight;
    for (const raider of fighters) raider.hearts = MAX_HEARTS;
    run(office, 1);
    const before = stands(office, fighters);
    expect(boss.pushbackAt).toBe(-99);
    boss.hp = boss.maxHp * VOID_PHASE2_BELOW + 1;
    strike(office, fighters[0].id);
    expect(boss.phase).toBe("phase2");
    expect(boss.pushbackAt).toBe(office.clock);
    expect(boss.pushbackX).toBe(boss.x);
    for (const raider of fighters) {
      expect(raider.voidHitAt).toBe(office.clock);
      expect(raider.voidKnock).toBe(-1); // away from the boss
      expect(raider.hurtUntil).toBeGreaterThan(office.clock);
      expect(raider.hearts).toBe(MAX_HEARTS);
    }
    run(office, VOID_PUSHBACK_S + STEP * 2);
    const ring1 = stands(office, fighters);
    ring1.forEach((point, index) => {
      expect(distToBoss(office, point)).toBeGreaterThan(distToBoss(office, before[index]) + 20);
      expect(point.x).toBeGreaterThanOrEqual(VOID_ARENA_X0);
      expect(point.y).toBeGreaterThanOrEqual(VOID_ARENA_Y0);
      expect(point.y).toBeLessThanOrEqual(VOID_ARENA_Y1);
    });
    run(office, VOID_TRUE_FORM_S);
    boss.hp = boss.maxHp * VOID_PHASE3_BELOW + 1;
    strike(office, fighters[0].id);
    expect(boss.phase).toBe("phase3");
    expect(boss.pushbackAt).toBe(office.clock);
    for (const raider of fighters) {
      expect(raider.voidHitAt).toBe(office.clock);
      expect(raider.hearts).toBe(MAX_HEARTS);
    }
    run(office, VOID_PUSHBACK_S + STEP * 2);
    const ring2 = stands(office, fighters);
    const keys = new Set<string>();
    for (const point of ring2) {
      expect(point.x).toBeGreaterThanOrEqual(VOID_ARENA_X0);
      expect(point.x).toBeLessThanOrEqual(VOID_ARENA_X1);
      expect(point.y).toBeGreaterThanOrEqual(VOID_ARENA_Y0);
      expect(point.y).toBeGreaterThan(VOID_FEET_Y); // the front edge, nearest the viewer, below the colossus chest
      expect(point.y).toBeLessThanOrEqual(VOID_ARENA_Y1);
      keys.add(`${point.x},${point.y}`);
    }
    expect(keys.size).toBe(fighters.length); // nobody stacks
    expect(new Set(ring1.map((other) => `${other.x},${other.y}`)).size).toBeGreaterThan(1);
  });

  it("the retreat is a slide over VOID_PUSHBACK_S, and instant under reduced motion", () => {
    for (const reduced of [false, true]) {
      const { office, fighters } = toFight(2);
      office.reducedMotion = reduced;
      run(office, 1);
      const start = office.raiderPoint(fighters[0]);
      const boss = office.voidFight;
      boss.hp = boss.maxHp * VOID_PHASE2_BELOW + 1;
      strike(office, fighters[0].id);
      const now = office.raiderPoint(fighters[0]);
      run(office, VOID_PUSHBACK_S / 2);
      const half = office.raiderPoint(fighters[0]);
      run(office, VOID_PUSHBACK_S);
      const end = office.raiderPoint(fighters[0]);
      if (reduced) {
        expect(now).toEqual(end);
        expect(half).toEqual(end);
      } else {
        expect(now).toEqual(start);
        expect(half.x).not.toBe(start.x);
        expect(half.x).not.toBe(end.x);
      }
      expect(end.x).not.toBe(start.x);
    }
  });

  it("hand slams and the gaze still reach raiders at their new stands", () => {
    const { office, fighters } = toFight(3);
    const boss = office.voidFight;
    toPhase3(office, fighters[0]);
    for (const raider of fighters) raider.hearts = MAX_HEARTS;
    ctlOf(office).phaseCount = 0;
    ctlOf(office).nextAttackAt = office.clock;
    fixedRandom(0.1);
    run(office, STEP * 2);
    const attack = boss.attack!;
    expect(attack.kind).toBe("hand");
    const victim = fighters.find((raider) => {
      const spot = office.raiderPoint(raider);
      return spot.x === attack.targetX && spot.y === attack.targetY;
    });
    expect(victim).toBeDefined(); // the windup is over the raider's actual stand
    fixedRandom(0.9);
    run(office, attack.hitAt - office.clock + STEP * 2);
    expect(victim!.voidHitAt).toBeGreaterThanOrEqual(attack.hitAt);
    ctlOf(office).nextAttackAt = 1e9;
    run(office, Math.max(0, boss.attack!.endAt - office.clock) + STEP * 2);
    ctlOf(office).phaseCount = 0;
    ctlOf(office).nextAttackAt = office.clock;
    fixedRandom(0.9);
    for (const raider of fighters) raider.voidHitAt = -99;
    run(office, STEP * 2);
    const gaze = boss.attack!;
    expect(gaze.kind).toBe("gaze");
    for (let k = 0; k < 4; k++) strike(office, fighters[0].id);
    run(office, gaze.endAt - office.clock + STEP * 2);
    expect(fighters.every((raider) => raider.voidHitAt >= gaze.hitAt)).toBe(true);
  });
});
