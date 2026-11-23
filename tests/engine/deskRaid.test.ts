import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  LORD_HP,
  RAID_IDLE_S,
  RAID_LINGER_S,
  RAID_READY_CALLS,
  RAID_READY_S,
  RAID_FLOOR_KILLS,
} from "@/lib/office/engine";
import { GATE_MOUTH, routeFromDungeon, routeToDungeon, spotOf } from "@/lib/office/layout";
import { LORD_DEATH_S } from "@/lib/office/lordFight";

import { ev, fixedRandom, newOffice, seat, sid, stubStorage, tick } from "./helpers";

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

const call = (office: ReturnType<typeof newOffice>, id: string, tool = "Read") => {
  const key = sid("t");
  office.event(ev(id, "PreToolUse", { tool_name: tool, tool_use_id: key }));
  office.event(ev(id, "PostToolUse", { tool_name: tool, tool_use_id: key }));
};

/** work until the session is seated inside the dungeon */
const raidNow = (office: ReturnType<typeof newOffice>, id: string) => {
  for (let i = 0; i < RAID_READY_CALLS; i++) call(office, id);
  tick(office, 1);
  tick(office, 30);
};

describe("heavy-work raid", () => {
  it("routes are mirror images and end at the gate / the spot", () => {
    const there = routeToDungeon(5);
    expect(there[there.length - 1]).toEqual(GATE_MOUTH);
    const back = routeFromDungeon(5);
    expect(back[back.length - 1]).toEqual(spotOf(5));
    expect(there[0]).not.toEqual(spotOf(5)); // excludes the start
  });

  it("a session with enough tool calls walks into the dungeon and keeps its battle spot reserved", () => {
    const office = newOffice();
    const id = sid();
    const worker = seat(office, id);
    const desk = worker.deskIdx;
    expect(desk).toBeGreaterThanOrEqual(0);
    tick(office, 3);
    for (let i = 0; i < RAID_READY_CALLS - 1; i++) call(office, id);
    tick(office, 1);
    expect(worker.state).toBe("SEATED");
    call(office, id);
    tick(office, 0.2);
    expect(worker.state).toBe("TO_RAID");
    expect(worker.monPos).toBeNull();
    expect(worker.raidSlot).toBeGreaterThanOrEqual(0);
    tick(office, 30);
    expect(worker.state).toBe("SEATED");
    expect(worker.raidIn).toBe(true);
    expect(worker.inDungeon).toBe(true);
    expect(worker.deskIdx).toBe(desk);
    expect(worker.floor).toBe(1);
    expect(worker.raid).not.toBeNull();
    expect({ x: worker.x, y: worker.y }).toEqual(GATE_MOUTH);
    expect(office.dungeonRaiders().map((raider) => raider.id)).toEqual([id]);
    expect(office.getView().dungeon.raiders).toBe(1);
    expect(office.statusOf(worker)).toBeTruthy();
    // a new session cannot take the reserved battle spot or the dungeon spot
    const other = seat(office, sid());
    expect(other.deskIdx).not.toBe(desk);
  });

  it("does not set out while a tool is in flight, a boss is up or too little was done", () => {
    const office = newOffice();
    const id = sid();
    const worker = seat(office, id);
    for (let i = 0; i < RAID_READY_CALLS - 5; i++) call(office, id);
    tick(office, 5);
    expect(worker.state).toBe("SEATED");
    for (let i = 0; i < 10; i++) call(office, id);
    office.event(ev(id, "PreToolUse", { tool_name: "Bash", tool_use_id: "open" }));
    tick(office, 2);
    expect(worker.state).toBe("SEATED"); // a tool is in flight
    office.event(ev(id, "PostToolUse", { tool_name: "Bash", tool_use_id: "open" }));
    tick(office, 1);
    expect(worker.state === "TO_RAID" || worker.raidIn).toBe(true);
  });

  it("a long session with some calls raids on time alone, an idle one does not", () => {
    const office = newOffice();
    const busy = seat(office, sid());
    const lazy = seat(office, sid());
    for (let i = 0; i < 12; i++) call(office, busy.id);
    tick(office, 1);
    expect(busy.state).toBe("SEATED");
    // keep both alive without further calls
    const keepAlive = () => {
      office.event(ev(busy.id, "UserPromptSubmit"));
      office.event(ev(lazy.id, "UserPromptSubmit"));
    };
    for (let elapsed = 0; elapsed < RAID_READY_S + 5; elapsed += 30) {
      keepAlive();
      tick(office, 30);
    }
    expect(busy.state === "TO_RAID" || busy.raidIn).toBe(true);
    expect(lazy.raidIn).toBe(false);
    expect(lazy.state === "TO_RAID").toBe(false);
  });

  it("descends to B3, the Lord falls, the party is cheered and the raider walks home with its loot", () => {
    const office = newOffice();
    const id = sid();
    const worker = seat(office, id);
    const desk = worker.deskIdx;
    raidNow(office, id);
    expect(worker.raidIn).toBe(true);
    let guard = 0;
    while (worker.floor < 3 && guard++ < 80) {
      call(office, id, "Bash");
      tick(office, 2);
    }
    expect(worker.floor).toBe(3);
    expect(guard).toBeLessThan(RAID_FLOOR_KILLS * 12);
    expect(office.banners.some((banner) => banner.kind === "boss")).toBe(true);
    expect(office.lordPip()).toBe(true);
    expect(office.getView().dungeon.lordFight).toBe(true);
    tick(office, 2);
    expect(office.lord.engagedAt).toBeGreaterThanOrEqual(0);
    const goldBefore = worker.gold;
    const bossesBefore = office.getView().dungeon.bosses;
    office.sfxQueue.length = 0;
    const cheers = vi.spyOn(office, "cheers");
    guard = 0;
    while (office.lord.hp > 0 && guard++ < LORD_HP * 2) call(office, id, "Bash");
    expect(office.lord.hp).toBe(0);
    expect(office.lord.slain).toBe(1);
    expect(worker.gold).toBeGreaterThan(goldBefore);
    expect(office.getView().dungeon.bosses).toBe(bossesBefore + 1);
    expect(office.sfxQueue).not.toContain("fanfare"); // the death sequence plays first
    office.sfxQueue.length = 0; // the sound hook drains it between frames
    tick(office, LORD_DEATH_S + 0.1);
    expect(office.sfxQueue).toContain("fanfare");
    expect(office.banners.length).toBeGreaterThan(1);
    expect(cheers).toHaveBeenCalled();
    tick(office, RAID_LINGER_S + 0.5);
    expect(worker.raidIn).toBe(false);
    expect(worker.state).toBe("FROM_RAID");
    expect(worker.inDungeon).toBe(false);
    expect(worker.raid).toBeNull();
    tick(office, 40);
    expect(worker.state).toBe("SEATED");
    expect(worker.deskIdx).toBe(desk);
    expect({ x: worker.x, y: worker.y }).toEqual(spotOf(desk));
    expect(worker.monPos).not.toBeNull(); // a fresh field monster is back
    expect(worker.raidCalls).toBe(0);
    expect(office.dungeonRaiders()).toHaveLength(0);
    // and it does not set straight out again
    tick(office, 5);
    expect(worker.state).toBe("SEATED");
  });

  it("walks home when it needs the user, and when its session goes quiet", () => {
    const office = newOffice();
    const first = seat(office, sid());
    raidNow(office, first.id);
    expect(first.raidIn).toBe(true);
    office.event(ev(first.id, "PermissionRequest"));
    tick(office, 0.2);
    expect(first.raidIn).toBe(false);
    expect(first.state).toBe("FROM_RAID");
    const second = seat(office, sid());
    raidNow(office, second.id);
    expect(second.raidIn).toBe(true);
    tick(office, RAID_IDLE_S + 5);
    expect(second.raidIn).toBe(false);
  });

  it("a handup while walking out turns the walk around", () => {
    const office = newOffice();
    const worker = seat(office, sid());
    for (let i = 0; i < RAID_READY_CALLS; i++) call(office, worker.id);
    // the guild master may talk to the adventurer first (a few seconds at most)
    for (let i = 0; i < 200 && worker.state !== "TO_RAID"; i++) tick(office, 0.05);
    expect(worker.state).toBe("TO_RAID");
    office.event(ev(worker.id, "PermissionRequest"));
    expect(worker.state).toBe("FROM_RAID");
    expect(worker.raidIn).toBe(false);
    tick(office, 30);
    expect(worker.state).toBe("SEATED");
    expect(worker.inDungeon).toBe(false);
  });

  it("leaving mid-raid frees the dungeon spot and the battle spot", () => {
    const office = newOffice();
    const worker = seat(office, sid());
    raidNow(office, worker.id);
    expect(worker.raidIn).toBe(true);
    office.event(ev(worker.id, "SessionEnd"));
    tick(office, 60);
    expect(office.employees.has(worker.id)).toBe(false);
    expect(office.dungeonRaiders()).toHaveLength(0);
  });

  it("a raider hit on floor 3 flashes the Lord, pops a damage number there and drains the bar smoothly", () => {
    const office = newOffice();
    const worker = seat(office, sid());
    raidNow(office, worker.id);
    worker.floor = 3;
    worker.raid = null;
    tick(office, 1);
    const popsBefore = office.popups.length;
    call(office, worker.id, "Bash");
    expect(office.lord.hitAt).toBeGreaterThanOrEqual(0);
    const pop = office.popups[office.popups.length - 1];
    expect(office.popups.length).toBeGreaterThan(popsBefore);
    expect(pop.dungeon).toBe(3);
    expect(pop.text).toMatch(/^-\d+$/);
    expect(office.lord.hp).toBeLessThan(1);
    expect(office.lord.shown).toBe(1); // not yet eased
    tick(office, 0.05);
    expect(office.lord.shown).toBeLessThan(1);
    expect(office.lord.shown).toBeGreaterThan(office.lord.hp);
    tick(office, 2);
    expect(office.lord.shown).toBeCloseTo(office.lord.hp, 1);
  });

  it("the Lord rises when a raider arrives and strikes back now and then (cosmetic)", () => {
    const office = newOffice();
    const worker = seat(office, sid());
    raidNow(office, worker.id);
    worker.floor = 3;
    worker.raid = null;
    expect(office.lord.engagedAt).toBe(-1);
    tick(office, 0.2);
    expect(office.lord.engagedAt).toBeGreaterThanOrEqual(0);
    tick(office, 8);
    expect(office.lord.strikeAt).toBeGreaterThan(0);
    expect(office.lord.strikeId).toBe(worker.id);
    expect(office.lord.hp).toBe(1);
  });
});
