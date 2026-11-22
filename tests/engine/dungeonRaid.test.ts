import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { dungeonSpotOf } from "@/lib/office/dungeonScene";
import { DESK_COUNT, GATE_MOUTH, GATE_OUT, seatPoint } from "@/lib/office/layout";

import { emp, ev, fixedRandom, newOffice, seat, sid, stubStorage, tick } from "./helpers";

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

const hit = (id: string, tool = "Bash") => {
  const key = sid("t");
  return [
    ev(id, "PreToolUse", { tool_name: tool, tool_use_id: key }),
    ev(id, "PostToolUse", { tool_name: tool, tool_use_id: key }),
  ];
};

const fillTo = (office: ReturnType<typeof newOffice>, count: number) => {
  const ids = Array.from({ length: count }, () => sid());
  for (const id of ids) office.event(ev(id, "SessionStart"));
  tick(office, 60);
  return ids;
};

describe("dungeon raid", () => {
  it("the gate point is the dungeon mouth", () => {
    expect(GATE_MOUTH).toEqual({ x: 342, y: 49 });
    expect(seatPoint(-1, 3)).toEqual(GATE_MOUTH);
  });

  it("the 9th session walks to the dungeon gate and becomes inDungeon", () => {
    const office = newOffice();
    const ids = fillTo(office, DESK_COUNT);
    const ninth = sid();
    office.event(ev(ninth, "SessionStart"));
    const raider = emp(office, ninth);
    expect(raider.deskIdx).toBe(-1);
    expect(raider.inDungeon).toBe(false);
    const route = [raider.path[raider.path.length - 1], ...raider.path].filter(Boolean);
    expect(route[route.length - 1]).toEqual(GATE_MOUTH);
    expect(raider.path.some((pt) => pt.x === GATE_OUT.x && pt.y === GATE_OUT.y)).toBe(true);
    tick(office, 60);
    expect(raider.state).toBe("SEATED");
    expect(raider.inDungeon).toBe(true);
    expect({ x: raider.x, y: raider.y }).toEqual(GATE_MOUTH);
    expect(raider.raid).not.toBeNull();
    expect(office.dungeonRaiders().map((raiderEmp) => raiderEmp.id)).toEqual([ninth]);
    expect(office.getView().dungeon.raiders).toBe(1);
    for (const id of ids) {
      expect(emp(office, id).inDungeon).toBe(false);
      expect(emp(office, id).raid).toBeNull();
    }
  });

  it("raid foe hp drops on tool calls, then a new kind steps up", () => {
    const office = newOffice();
    fillTo(office, DESK_COUNT);
    const id = sid();
    office.event(ev(id, "SessionStart"));
    tick(office, 60);
    const raider = emp(office, id);
    const first = raider.raid!;
    const kind = first.kind;
    expect(first.hp).toBe(1);
    for (const event of hit(id, "Read")) office.event(event);
    expect(raider.raid!.hp).toBeLessThan(1);
    expect(raider.raid!.hitAt).toBeGreaterThan(-99);
    for (let i = 0; i < 12 && raider.raid!.hp > 0; i++) for (const event of hit(id)) office.event(event);
    expect(raider.raid!.hp).toBe(0);
    expect(raider.raid!.deadAt).toBeGreaterThan(-99);
    expect(raider.kills).toBe(1);
    tick(office, 2);
    expect(raider.raid!.hp).toBe(1);
    expect(raider.raid!.kind).not.toBe(kind);
  });

  it("a freed battle spot sends the longest-waiting raider out of the gate to it", () => {
    const office = newOffice();
    const ids = fillTo(office, DESK_COUNT + 2);
    const [early, late] = [emp(office, ids[8]), emp(office, ids[9])];
    expect(early.inDungeon && late.inDungeon).toBe(true);
    office.event(ev(ids[0], "SessionEnd"));
    tick(office, 0.5);
    tick(office, 0.1);
    expect(early.deskIdx).toBeGreaterThanOrEqual(0);
    expect(early.inDungeon).toBe(false);
    expect(early.raid).toBeNull();
    expect(late.inDungeon).toBe(true);
    expect(early.state === "FROM_COFFEE" || early.state === "SEATED").toBe(true);
    tick(office, 60);
    expect(early.state).toBe("SEATED");
    expect(early.monPos).not.toBeNull();
    expect({ x: early.x, y: early.y }).toEqual(seatPoint(early.deskIdx, -1));
  });

  it("a tavern trip leaves through the gate and comes back to it", () => {
    const office = newOffice();
    fillTo(office, DESK_COUNT);
    const id = sid();
    office.event(ev(id, "SessionStart"));
    tick(office, 60);
    const raider = emp(office, id);
    expect(raider.inDungeon).toBe(true);
    office.event(ev(id, "Stop"));
    const states = new Set<string>();
    let sawOut = false;
    for (let i = 0; i < 2000 && !(states.has("DRINK") && raider.state === "SEATED"); i++) {
      tick(office, 0.1);
      states.add(raider.state);
      if (raider.state !== "SEATED") expect(raider.inDungeon).toBe(false);
      if (raider.state === "TO_COFFEE" && raider.x < GATE_MOUTH.x - 50) sawOut = true;
    }
    expect(states.has("TO_COFFEE")).toBe(true);
    expect(states.has("DRINK")).toBe(true);
    expect(sawOut).toBe(true);
    expect(raider.state).toBe("SEATED");
    expect(raider.inDungeon).toBe(true);
    expect({ x: raider.x, y: raider.y }).toEqual(GATE_MOUTH);
  });

  it("a raider that goes idle leaves from the gate along the bridge, never straight across the field", () => {
    const office = newOffice();
    fillTo(office, DESK_COUNT);
    const id = sid();
    office.event(ev(id, "SessionStart"));
    tick(office, 60);
    const raider = emp(office, id);
    office.event(ev(id, "SessionEnd"));
    raider.lastEventAt = -1e6;
    tick(office, 0.2);
    expect(raider.state).toBe("LEAVING");
    expect(raider.inDungeon).toBe(false);
    expect(raider.path[0].x).toBe(340);
    expect(raider.path.every((pt) => pt.y <= 75 || pt.x <= GATE_OUT.x)).toBe(true);
  });

  it("dungeonRaiders is ordered by slot, then arrival", () => {
    const office = newOffice();
    const ids = fillTo(office, DESK_COUNT + 3);
    expect(office.dungeonRaiders().map((raiderEmp) => raiderEmp.id)).toEqual(ids.slice(DESK_COUNT));
    expect(office.dungeonRaiders().map((raiderEmp) => raiderEmp.slot)).toEqual([0, 1, 2]);
  });

  it("snapshot-seated overflow sessions are inDungeon at once", () => {
    const office = newOffice();
    const ids = Array.from({ length: DESK_COUNT + 1 }, () => sid());
    for (const id of ids) seat(office, id);
    expect(emp(office, ids[DESK_COUNT]).inDungeon).toBe(true);
  });

  it("scene defaults to guild, setScene and a Live/Demo switch (clear) resets it", () => {
    const office = newOffice();
    expect(office.scene).toBe("guild");
    office.setScene("dungeon");
    expect(office.scene).toBe("dungeon");
    office.clear();
    expect(office.scene).toBe("guild");
  });

  it("the guild master never visits a raider", () => {
    const office = newOffice();
    fillTo(office, DESK_COUNT + 1);
    const raider = office.dungeonRaiders()[0];
    expect(raider.deskIdx).toBe(-1);
    expect((office as unknown as { canVisit: (target: unknown) => boolean }).canVisit(raider)).toBe(false);
  });

  it("hit-testing follows the scene: raiders only inside, at their slot's spot", () => {
    const office = newOffice();
    fillTo(office, DESK_COUNT);
    const ninth = sid();
    office.event(ev(ninth, "SessionStart"));
    tick(office, 60);
    const raider = emp(office, ninth);
    expect(raider.inDungeon).toBe(true);
    // on the guild grounds the raider is inside: nothing to hover at the gate mouth
    expect(office.hit(GATE_MOUTH.x, GATE_MOUTH.y - 2)).toBeNull();
    office.setScene("dungeon");
    const spot = dungeonSpotOf(raider.slot);
    expect(office.hit(spot.x, spot.y - 2)).toBe(ninth);
    // field adventurers are not hoverable from inside the dungeon
    const fielder = [...office.employees.values()].find((other) => !other.inDungeon)!;
    expect(office.hit(fielder.x, fielder.y - 2)).not.toBe(fielder.id);
  });

  it("a raider keeps its spot when an earlier raider leaves", () => {
    const office = newOffice();
    fillTo(office, DESK_COUNT);
    const first = sid(),
      second = sid();
    office.event(ev(first, "SessionStart"));
    office.event(ev(second, "SessionStart"));
    tick(office, 60);
    const before = dungeonSpotOf(emp(office, second).slot);
    office.event(ev(first, "SessionEnd"));
    tick(office, 60);
    expect(dungeonSpotOf(emp(office, second).slot)).toEqual(before);
  });

  it("raider effects are dungeon-tagged at the dungeon spot, field effects are not", () => {
    const office = newOffice();
    const ids = fillTo(office, DESK_COUNT);
    const ninth = sid();
    office.event(ev(ninth, "SessionStart"));
    tick(office, 60);
    const raider = emp(office, ninth);
    const spot = dungeonSpotOf(raider.slot);
    const priv = office as unknown as { loseHeart(e: unknown): void; gainXp(e: unknown, n: number): void };
    office.flash = 0;
    for (const particle of office.particles) particle.on = false;
    priv.loseHeart(raider);
    priv.gainXp(raider, 10_000);
    const fx = office.particles.filter((particle) => particle.on);
    expect(fx.length).toBeGreaterThan(0);
    expect(fx.every((particle) => particle.dungeon)).toBe(true);
    expect(fx.every((particle) => Math.abs(particle.x - spot.x) < 40 && Math.abs(particle.y - spot.y) < 40)).toBe(true);
    expect(office.popups.length).toBeGreaterThan(0);
    expect(office.popups.every((popup) => popup.dungeon && Math.abs(popup.x - spot.x) < 20)).toBe(true);
    expect(office.flash).toBe(0);
    // a field adventurer's effects stay on the field
    office.popups.length = 0;
    priv.loseHeart(emp(office, ids[0]));
    expect(office.popups.every((popup) => !popup.dungeon)).toBe(true);
  });

  it("selecting a raider switches to the dungeon, selecting a field adventurer switches back", () => {
    const office = newOffice();
    const ids = fillTo(office, DESK_COUNT);
    const ninth = sid();
    office.event(ev(ninth, "SessionStart"));
    tick(office, 60);
    expect(office.scene).toBe("guild");
    office.select(ninth);
    expect(office.scene).toBe("dungeon");
    expect(office.getView().scene).toBe("dungeon");
    office.select(ids[0]);
    expect(office.scene).toBe("guild");
  });

  it("counts only raiders the session filter lets through", () => {
    const office = newOffice();
    fillTo(office, DESK_COUNT);
    const ninth = sid();
    office.event(ev(ninth, "SessionStart"));
    tick(office, 60);
    expect(office.dungeonStats()).toMatchObject({ raiders: 1, raidersShown: 1 });
    office.setFilter({ query: "no-such-session-xyz", hideStray: false });
    expect(office.dungeonStats()).toMatchObject({ raiders: 1, raidersShown: 0 });
  });
});
