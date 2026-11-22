import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Employee, Office } from "@/lib/office/engine";
import {
  ALLY_BRIDGE_X,
  BRIDGE_X,
  DESK_COUNT,
  GATE_MOUTH,
  HALL_W,
  WORLD_H,
  WORLD_W,
  monsterSpot,
  routeBoss,
  routeFromAllyGate,
  routeToAllyGate,
  seatPoint,
  ALLY_GATE_MOUTH,
  GATE_OPEN,
  TAVERN_OVERFLOW,
  TAVERN_SPOTS,
  WALL_X0,
  squirePoint,
  type Pt,
} from "@/lib/office/layout";

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

// the stream (y ~ 58..64, banks to ~54..68) is crossed only by the bridge
const WATER_Y0 = 54;
const WATER_Y1 = 68;
const BRIDGE_HALF_W = 7;
const SAMPLE_STEP = 2;
/** every point along a polyline (start + waypoints), sampled every 2px */
const sampleAlong = (start: Pt, path: Pt[]): Pt[] => {
  const out: Pt[] = [start];
  let from = start;
  for (const to of path) {
    const dist = Math.hypot(to.x - from.x, to.y - from.y);
    const steps = Math.max(1, Math.ceil(dist / SAMPLE_STEP));
    for (let i = 1; i <= steps; i++)
      out.push({ x: from.x + ((to.x - from.x) * i) / steps, y: from.y + ((to.y - from.y) * i) / steps });
    from = to;
  }
  return out;
};
const expectDryAndInside = (points: Pt[], bridgeX = BRIDGE_X) => {
  for (const point of points) {
    expect(point.x).toBeGreaterThanOrEqual(HALL_W);
    expect(point.x).toBeLessThanOrEqual(WORLD_W);
    expect(point.y).toBeGreaterThanOrEqual(0);
    expect(point.y).toBeLessThanOrEqual(WORLD_H);
    if (point.y > WATER_Y0 && point.y < WATER_Y1)
      expect(Math.abs(point.x - bridgeX)).toBeLessThanOrEqual(BRIDGE_HALF_W);
  }
};

/** inside the world, and through the hall wall only by its gate opening */
const expectInsideWalls = (points: Pt[]) => {
  for (const point of points) {
    expect(point.x).toBeGreaterThanOrEqual(0);
    expect(point.x).toBeLessThanOrEqual(WORLD_W);
    expect(point.y).toBeGreaterThanOrEqual(0);
    expect(point.y).toBeLessThanOrEqual(WORLD_H);
    if (point.x > WALL_X0 && point.x < HALL_W) {
      expect(point.y).toBeGreaterThanOrEqual(GATE_OPEN.y0);
      expect(point.y).toBeLessThanOrEqual(GATE_OPEN.y1);
    }
  }
};

const pre = (id: string, tool: string, tid: string) => ev(id, "PreToolUse", { tool_name: tool, tool_use_id: tid });
const post = (id: string, tool: string, tid: string) => ev(id, "PostToolUse", { tool_name: tool, tool_use_id: tid });
const dist = (first: Pt, second: Pt) => Math.hypot(first.x - second.x, first.y - second.y);

/** run until the boss exists; returns right after the spawning frame */
const untilBoss = (office: Office, employee: Employee) => {
  for (let i = 0; i < 2000 && !employee.boss; i++) tick(office, 0.05);
  expect(employee.boss).not.toBeNull();
};

describe("dungeon gate: boss emergence", () => {
  it("every boss route starts at the gate, crosses water only on the bridge and ends at the fight spot", () => {
    for (let desk = 0; desk < DESK_COUNT; desk++) {
      const path = routeBoss(desk);
      expect(path[path.length - 1]).toEqual(monsterSpot(desk));
      expectDryAndInside(sampleAlong(GATE_MOUTH, path));
    }
  });

  it("the boss spawns at the gate mouth, walks the route and arrives facing the adventurer", () => {
    const office = newOffice();
    const id = sid();
    const employee = seat(office, id);
    const goal = monsterSpot(employee.deskIdx);
    office.event(pre(id, "Bash", "t1"));
    untilBoss(office, employee);
    expect(dist(employee.monPos!, GATE_MOUTH)).toBeLessThan(1);
    expect(employee.bossPath.length).toBeGreaterThan(0);
    expect(office.bossAlive).toBeGreaterThanOrEqual(0);
    const seen: Pt[] = [];
    for (let i = 0; i < 400 && employee.bossPath.length; i++) {
      tick(office, 0.05);
      seen.push({ ...employee.monPos! });
    }
    expectDryAndInside(seen);
    expect(seen.some((point) => Math.abs(point.x - BRIDGE_X) < 1 && point.y > WATER_Y0 && point.y < WATER_Y1)).toBe(
      true,
    );
    expect(employee.bossPath).toEqual([]);
    expect(employee.monPos).toEqual(goal);
    expect(employee.bossFace).toBe(-1);
    expect(office.bossAlive).toBe(1);
  });

  it("the boss only fights from its spot: it can be defeated mid-walk and the tool result still counts", () => {
    const office = newOffice();
    const id = sid();
    const employee = seat(office, id);
    office.event(pre(id, "Bash", "t1"));
    untilBoss(office, employee);
    tick(office, 0.5);
    expect(employee.bossPath.length).toBeGreaterThan(0);
    office.event(post(id, "Bash", "t1"));
    expect(employee.boss).toBeNull();
    expect(employee.kills).toBe(1);
    tick(office, 0.1);
    expect(office.bossAlive).toBe(0);
  });

  it("reduced motion: no walk, the boss appears in place", () => {
    const office = newOffice();
    office.reducedMotion = true;
    const id = sid();
    const employee = seat(office, id);
    office.event(pre(id, "Bash", "t1"));
    untilBoss(office, employee);
    expect(employee.bossPath).toEqual([]);
    expect(employee.monPos).toEqual(monsterSpot(employee.deskIdx));
    expect(office.bossAlive).toBe(1);
  });

  it("bossAlive follows the boss: down when it leaves", () => {
    const office = newOffice();
    const id = sid();
    const employee = seat(office, id);
    office.event(pre(id, "Bash", "t1"));
    untilBoss(office, employee);
    tick(office, 0.1);
    expect(office.bossAlive).toBe(1);
    office.event(ev(id, "Stop"));
    tick(office, 0.1);
    expect(office.bossAlive).toBe(0);
  });
});

describe("ally gate: squires", () => {
  it("ally gate routes stay on dry ground and reverse each other", () => {
    for (let desk = 0; desk < DESK_COUNT; desk++) {
      for (const slot of [0, 1]) {
        const spot = squirePoint(desk, slot);
        const there = routeToAllyGate(spot.x, spot.y);
        expect(there[there.length - 1]).toEqual(ALLY_GATE_MOUTH);
        expectDryAndInside(sampleAlong(spot, there), ALLY_BRIDGE_X);
        const back = routeFromAllyGate(spot.x, spot.y);
        expect(back[back.length - 1]).toEqual({ x: spot.x, y: spot.y });
        expectDryAndInside(sampleAlong(ALLY_GATE_MOUTH, back), ALLY_BRIDGE_X);
        // the river is crossed on the ally bridge, once going out
        expect(
          sampleAlong(ALLY_GATE_MOUTH, back).some(
            (point) => Math.abs(point.x - ALLY_BRIDGE_X) < 1 && point.y > WATER_Y0 && point.y < WATER_Y1,
          ),
        ).toBe(true);
      }
    }
  });

  it("a squire steps out of the ally gate, walks to its master's spot and stands there", () => {
    const office = newOffice();
    const id = sid();
    const employee = seat(office, id);
    office.event(ev(id, "SubagentStart", { agent_id: "a1", agent_type: "Explore" }));
    const squire = employee.interns.get("a1")!;
    expect(squire.phase).toBe("wait");
    tick(office, 0.05);
    expect(squire.phase).toBe("in");
    expect(dist({ x: squire.x, y: squire.y }, ALLY_GATE_MOUTH)).toBeLessThan(3);
    const spot = squirePoint(employee.deskIdx, 0);
    for (let i = 0; i < 600 && squire.phase === "in"; i++) tick(office, 0.05);
    expect(squire.phase).toBe("here");
    expect({ x: squire.x, y: squire.y }).toEqual(spot);
    // its tool work still drives its act
    office.event(ev(id, "PreToolUse", { agent_id: "a1", agent_type: "Explore", tool_name: "Read" }));
    expect(squire.act).toBe("reading");
  });

  it("SubagentStop sends it back into the ally gate, where it vanishes", () => {
    const office = newOffice();
    const id = sid();
    const employee = seat(office, id);
    office.event(ev(id, "SubagentStart", { agent_id: "a1" }));
    tick(office, 20);
    expect(employee.interns.get("a1")!.phase).toBe("here");
    office.event(ev(id, "SubagentStop", { agent_id: "a1" }));
    expect(employee.interns.size).toBe(0);
    expect(office.getView().roster[0].interns).toBe(0);
    expect(office.leavers.length).toBe(1);
    const leaver = office.leavers[0];
    expect(leaver.path[leaver.path.length - 1]).toEqual(ALLY_GATE_MOUTH);
    const seen: Pt[] = [];
    for (let i = 0; i < 600 && office.leavers.length; i++) {
      tick(office, 0.05);
      seen.push({ x: leaver.x, y: leaver.y });
    }
    expect(office.leavers.length).toBe(0);
    expect(office.allyDoorsUntil).toBeGreaterThan(0);
    expectDryAndInside(seen, ALLY_BRIDGE_X);
    expect(dist(seen[seen.length - 1], ALLY_GATE_MOUTH)).toBeLessThan(1);
  });

  it("a squire that has not left the ally gate yet just disappears on SubagentStop", () => {
    const office = newOffice();
    const id = sid();
    seat(office, id);
    office.event(ev(id, "SubagentStart", { agent_id: "a1" }));
    office.event(ev(id, "SubagentStop", { agent_id: "a1" }));
    expect(office.leavers.length).toBe(0);
  });

  it("a swarm never piles up: staggered exits, a cap on walkers, extras wait inside the ally gate", () => {
    const office = newOffice();
    const id = sid();
    const employee = seat(office, id);
    for (let k = 0; k < 8; k++) office.event(ev(id, "SubagentStart", { agent_id: `a${k}` }));
    expect(employee.interns.size).toBe(8);
    const startedAt: number[] = [];
    const wasWaiting = new Set<string>();
    for (const key of employee.interns.keys()) wasWaiting.add(key);
    for (let i = 0; i < 400; i++) {
      tick(office, 0.05);
      for (const [key, squire] of employee.interns) {
        if (squire.phase !== "wait" && wasWaiting.delete(key)) startedAt.push(office.clock);
      }
    }
    // only the two squire slots are used; the other six wait inside
    expect(startedAt.length).toBe(2);
    expect(startedAt[1] - startedAt[0]).toBeGreaterThanOrEqual(0.69);
    const waiting = [...employee.interns.values()].filter((squire) => squire.phase === "wait");
    expect(waiting.length).toBe(6);
    // when the front squires leave, the next ones step out one by one
    office.event(ev(id, "SubagentStop", { agent_id: "a0" }));
    office.event(ev(id, "SubagentStop", { agent_id: "a1" }));
    tick(office, 0.05);
    const out = [...employee.interns.values()].filter((squire) => squire.phase !== "wait");
    expect(out.length).toBe(1);
  });

  it("reduced motion: squires appear in place and leave without a walk", () => {
    const office = newOffice();
    office.reducedMotion = true;
    const id = sid();
    const employee = seat(office, id);
    office.event(ev(id, "SubagentStart", { agent_id: "a1" }));
    tick(office, 0.1);
    tick(office, 0.1);
    const squire = employee.interns.get("a1")!;
    expect(squire.phase).toBe("here");
    expect({ x: squire.x, y: squire.y }).toEqual(squirePoint(employee.deskIdx, 0));
    office.event(ev(id, "SubagentStop", { agent_id: "a1" }));
    expect(office.leavers.length).toBe(0);
  });

  it("squires follow when their slot shifts (the first one left)", () => {
    const office = newOffice();
    const id = sid();
    const employee = seat(office, id);
    office.event(ev(id, "SubagentStart", { agent_id: "a1" }));
    office.event(ev(id, "SubagentStart", { agent_id: "a2" }));
    tick(office, 25);
    const second = employee.interns.get("a2")!;
    expect({ x: second.x, y: second.y }).toEqual(squirePoint(employee.deskIdx, 1));
    office.event(ev(id, "SubagentStop", { agent_id: "a1" }));
    tick(office, 0.05);
    expect(second.phase).toBe("in");
    tick(office, 5);
    expect({ x: second.x, y: second.y }).toEqual(squirePoint(employee.deskIdx, 0));
  });

  it("when the master leaves, the squires walk home too", () => {
    const office = newOffice();
    const id = sid();
    seat(office, id);
    office.event(ev(id, "SubagentStart", { agent_id: "a1" }));
    tick(office, 20);
    office.event(ev(id, "SessionEnd"));
    expect(office.leavers.length).toBe(1);
  });
});

describe("ally gate: compact trip (PreCompact)", () => {
  it("walks to a tavern spot, has a beer, walks back to the seat; the ally gate stays out of it", () => {
    const office = newOffice();
    const id = sid();
    const employee = seat(office, id);
    const seatSpot = seatPoint(employee.deskIdx, employee.slot);
    office.event(ev(id, "PreCompact", { trigger: "auto" }));
    expect(employee.state).toBe("TO_TAVERN_REST");
    expect(office.statusOf(employee)).toContain("โรงเตี๊ยม");
    expect(TAVERN_SPOTS).toContainEqual(employee.path[employee.path.length - 1]);
    expect(office.getView().roster[0].act).toBe("compact");
    const seen: Pt[] = [];
    for (let i = 0; i < 1200 && employee.state === "TO_TAVERN_REST"; i++) {
      tick(office, 0.05);
      seen.push({ x: employee.x, y: employee.y });
    }
    expect(employee.state).toBe("AT_TAVERN_REST");
    expect(TAVERN_SPOTS).toContainEqual({ x: employee.x, y: employee.y });
    expectInsideWalls(seen);
    expect(office.allyDoorsUntil).toBe(0);
    const arrivedAt = office.clock;
    tick(office, 2.5);
    expect(employee.state).toBe("AT_TAVERN_REST"); // still resting
    for (let i = 0; i < 1200 && employee.state !== "SEATED"; i++) tick(office, 0.05);
    expect(employee.state).toBe("SEATED");
    expect(office.clock - arrivedAt).toBeGreaterThanOrEqual(3);
    expect({ x: employee.x, y: employee.y }).toEqual(seatSpot);
  });

  it("every desk's tavern trip stays inside the walls (through the hall gate only), and the 4th rester stands by the counter", () => {
    const office = newOffice();
    const ids = Array.from({ length: DESK_COUNT }, () => sid());
    const staff = ids.map((id) => seat(office, id));
    for (const id of ids.slice(0, 4)) office.event(ev(id, "PreCompact"));
    expect(staff.slice(0, 4).map((employee) => employee.restSpot)).toEqual([0, 1, 2, -1]);
    expect(staff[3].path[staff[3].path.length - 1]).toEqual(TAVERN_OVERFLOW);
    for (const employee of staff.slice(0, 4))
      expectInsideWalls(sampleAlong({ x: employee.x, y: employee.y }, employee.path));
    for (const id of ids.slice(4)) {
      const employee = emp(office, id);
      office.event(ev(id, "PreCompact"));
      expectInsideWalls(sampleAlong({ x: employee.x, y: employee.y }, employee.path));
    }
  });

  it("the mana bar is never invented: the context stays as reported until a new reading lands, which flashes it", () => {
    const office = newOffice();
    const id = sid();
    const employee = seat(office, id);
    office.setContext(id, 150_000, 200_000);
    office.event(ev(id, "PreCompact"));
    tick(office, 1);
    expect(office.ctxFrac(id)).toBe(0.75);
    expect(employee.compactPending).toBe(true);
    office.setContext(id, 20_000, 200_000);
    expect(office.ctxFrac(id)).toBe(0.1);
    expect(employee.compactPending).toBe(false);
    expect(employee.manaFlashUntil).toBeGreaterThan(office.clock);
  });

  it("an event that arrives mid-trip cuts it short; the adventurer walks back and then handles it", () => {
    const office = newOffice();
    const id = sid();
    const employee = seat(office, id);
    office.event(ev(id, "PreCompact"));
    tick(office, 1);
    expect(employee.state).toBe("TO_TAVERN_REST");
    office.event(pre(id, "Read", "t9"));
    expect(employee.state).toBe("FROM_TAVERN_REST");
    expect(employee.queue.length).toBe(1);
    for (let i = 0; i < 1200 && employee.state !== "SEATED"; i++) tick(office, 0.05);
    expect(employee.state).toBe("SEATED");
    expect(employee.act).toBe("reading");
    expect(employee.queue.length).toBe(0);
  });

  it("a session with a tool in flight (busy) stays at its spot: 🍺 bubble only", () => {
    const office = newOffice();
    const id = sid();
    const employee = seat(office, id);
    office.event(pre(id, "Bash", "t1"));
    office.event(ev(id, "PreCompact"));
    expect(employee.state).toBe("SEATED");
    expect(employee.tempBubble?.e).toBe("🍺");
    tick(office, 1);
    expect(employee.state).toBe("SEATED");
    expect(employee.pending.size).toBe(1);
  });

  it("a boss fight is never interrupted", () => {
    const office = newOffice();
    const id = sid();
    const employee = seat(office, id);
    office.event(pre(id, "Bash", "t1"));
    untilBoss(office, employee);
    office.event(ev(id, "PreCompact"));
    expect(employee.state).toBe("SEATED");
    expect(employee.boss).not.toBeNull();
    expect(employee.tempBubble?.e).toBe("🍺");
  });

  it("someone with a hand up (waiting on you) does not walk away", () => {
    const office = newOffice();
    const id = sid();
    const employee = seat(office, id);
    office.event(ev(id, "PermissionRequest", { tool_name: "Bash" }));
    expect(employee.act).toBe("handup");
    office.event(ev(id, "PreCompact"));
    expect(employee.state).toBe("SEATED");
  });

  it("reduced motion: no walk, just the swirl and bubble", () => {
    const office = newOffice();
    office.reducedMotion = true;
    const id = sid();
    const employee = seat(office, id);
    office.event(ev(id, "PreCompact"));
    expect(employee.state).toBe("SEATED");
    expect(employee.tempBubble?.e).toBe("🍺");
  });

  it("leaving mid-trip still works", () => {
    const office = newOffice();
    const id = sid();
    seat(office, id);
    office.event(ev(id, "PreCompact"));
    tick(office, 1);
    office.event(ev(id, "SessionEnd"));
    for (let i = 0; i < 2000 && office.employees.has(id); i++) tick(office, 0.05);
    expect(office.employees.has(id)).toBe(false);
  });

  it("not seated yet (still entering): the event is queued and the trip starts on sitting", () => {
    const office = newOffice();
    const id = sid();
    office.event(ev(id, "SessionStart"));
    office.event(ev(id, "PreCompact"));
    expect(emp(office, id).state).toBe("ENTERING");
    expect(emp(office, id).queue.at(-1)?.hook_event_name).toBe("PreCompact");
  });
});

describe("dungeon ledger counters", () => {
  it("counts sessions entered / left and who is live", () => {
    const office = newOffice();
    const first = sid(),
      second = sid();
    seat(office, first);
    seat(office, second);
    let stats = office.getView().dungeon;
    expect(stats.entered).toBe(2);
    expect(stats.left).toBe(0);
    expect(stats.live).toBe(2);
    office.event(ev(first, "SessionEnd"));
    stats = office.getView().dungeon;
    expect(stats.left).toBe(1);
    expect(stats.live).toBe(1);
    office.event(ev(first, "SessionEnd")); // not counted twice
    expect(office.getView().dungeon.left).toBe(1);
  });

  it("counts defeated monsters, defeated bosses and the longest boss fight", () => {
    const office = newOffice();
    const id = sid();
    const employee = seat(office, id);
    employee.monHp = 1;
    office.event(post(id, "Read", "r1"));
    expect(office.getView().dungeon.monsters).toBe(1);
    tick(office, 3);
    office.event(pre(id, "Bash", "t1"));
    untilBoss(office, employee);
    tick(office, 12);
    office.event(post(id, "Bash", "t1"));
    const stats = office.getView().dungeon;
    expect(stats.bosses).toBe(1);
    expect(stats.monsters).toBe(1); // a boss is not counted as a monster
    expect(stats.longestBossS).toBeGreaterThanOrEqual(11.9);
    expect(stats.bossesAlive).toBe(0);
  });

  it("a boss that runs away counts toward the longest fight but not as defeated", () => {
    const office = newOffice();
    const id = sid();
    const employee = seat(office, id);
    office.event(pre(id, "Bash", "t1"));
    untilBoss(office, employee);
    tick(office, 4);
    office.event(ev(id, "PostToolUseFailure", { tool_name: "Bash", tool_use_id: "t1" }));
    const stats = office.getView().dungeon;
    expect(stats.bosses).toBe(0);
    expect(stats.longestBossS).toBeGreaterThanOrEqual(3.9);
  });

  it("ranks the three most-used tools, squires' tools included", () => {
    const office = newOffice();
    const id = sid();
    seat(office, id);
    for (const tool of ["Read", "Read", "Read", "Edit", "Edit", "Bash", "Grep"])
      office.event(ev(id, "PreToolUse", { tool_name: tool }));
    office.event(ev(id, "SubagentStart", { agent_id: "a1" }));
    office.event(ev(id, "PreToolUse", { agent_id: "a1", tool_name: "Grep" }));
    office.event(ev(id, "PreToolUse", { agent_id: "a1", tool_name: "Grep" }));
    expect(office.getView().dungeon.topTools).toEqual([
      { tool: "Grep", count: 3 }, // ties: alphabetical
      { tool: "Read", count: 3 },
      { tool: "Edit", count: 2 },
    ]);
  });

  it("adds up the time spent with a hand up (finished waits and the one in progress)", () => {
    const office = newOffice();
    const id = sid();
    seat(office, id);
    office.event(ev(id, "PermissionRequest", { tool_name: "Bash" }));
    tick(office, 10);
    office.event(post(id, "Bash", "t1")); // answered
    expect(office.getView().dungeon.waitS).toBeCloseTo(10, 0);
    office.event(ev(id, "PermissionRequest", { tool_name: "Bash" }));
    tick(office, 5);
    expect(office.getView().dungeon.waitS).toBeCloseTo(15, 0);
    office.event(ev(id, "SessionEnd")); // leaving while waiting closes the wait
    tick(office, 5);
    expect(office.getView().dungeon.waitS).toBeCloseTo(15, 0);
  });

  it("clear() (Live/Demo switch) restarts the count", () => {
    const office = newOffice();
    const id = sid();
    seat(office, id);
    office.event(ev(id, "PreToolUse", { tool_name: "Read" }));
    office.clear();
    const stats = office.getView().dungeon;
    expect(stats.entered).toBe(0);
    expect(stats.topTools).toEqual([]);
    expect(stats.live).toBe(0);
  });

  it("the view signature changes when the counters do (the card re-renders)", () => {
    const office = newOffice();
    const seen: number[] = [];
    office.subscribe((view) => seen.push(view.dungeon.entered));
    seat(office, sid());
    office.publish();
    expect(seen[seen.length - 1]).toBe(1);
  });
});

describe("review fixes", () => {
  const permission = (id: string) => ev(id, "PermissionRequest", { tool_name: "Bash" });

  it("a hand going up during a ally gate walk shows at once and turns the walk around", () => {
    const office = newOffice();
    const id = sid();
    const employee = seat(office, id);
    office.event(ev(id, "PreCompact"));
    tick(office, 1);
    expect(employee.state).toBe("TO_TAVERN_REST");
    office.event(permission(id));
    expect(employee.act).toBe("handup");
    expect(employee.state).toBe("FROM_TAVERN_REST");
    expect(office.waitingIds()).toEqual([id]);
    expect(office.getView().roster[0].act).toBe("handup"); // beats "compact"
    expect(office.statusOf(employee)).not.toContain("โรงเตี๊ยม");
    for (let i = 0; i < 1200 && employee.state !== "SEATED"; i++) tick(office, 0.05);
    expect(employee.state).toBe("SEATED");
    expect(employee.act).toBe("handup");
  });

  it("a permission Notification during the tavern walk also applies at once", () => {
    const office = newOffice();
    const id = sid();
    const employee = seat(office, id);
    office.event(ev(id, "Stop"));
    for (let i = 0; i < 400 && employee.state !== "TO_COFFEE"; i++) tick(office, 0.1);
    expect(employee.state).toBe("TO_COFFEE");
    office.event(ev(id, "Notification", { notification_type: "permission_prompt" }));
    expect(employee.act).toBe("handup");
    expect(employee.state).toBe("FROM_COFFEE");
  });

  it("a snapshot that says the session is waiting cuts the trip", () => {
    const office = newOffice();
    const id = sid();
    const employee = seat(office, id);
    office.event(ev(id, "PreCompact"));
    tick(office, 1);
    office.loadSnapshot({ sessions: [{ session_id: id, waiting: true }] });
    expect(employee.act).toBe("handup");
    expect(employee.state).toBe("FROM_TAVERN_REST");
  });

  it("reduced motion switched on mid-walk snaps boss, squires, leavers and the ally gate trip", () => {
    const office = newOffice();
    const id = sid();
    const employee = seat(office, id);
    office.event(pre(id, "Bash", "t1"));
    untilBoss(office, employee);
    tick(office, 0.5);
    expect(employee.bossPath.length).toBeGreaterThan(0);
    office.event(ev(id, "SubagentStart", { agent_id: "a1" }));
    tick(office, 0.3);
    expect(employee.interns.get("a1")!.phase).toBe("in");
    office.reducedMotion = true;
    tick(office, 0.1);
    expect(employee.bossPath).toEqual([]);
    expect(employee.monPos).toEqual(monsterSpot(employee.deskIdx));
    tick(office, 0.1);
    expect(employee.interns.get("a1")!.phase).toBe("here");

    const other = sid();
    const traveller = seat(office, other);
    office.reducedMotion = false;
    tick(office, 0.1);
    office.event(ev(other, "PreCompact"));
    tick(office, 1);
    expect(traveller.state).toBe("TO_TAVERN_REST");
    office.reducedMotion = true;
    tick(office, 0.1);
    expect(traveller.state).toBe("SEATED");
    expect({ x: traveller.x, y: traveller.y }).toEqual(seatPoint(traveller.deskIdx, traveller.slot));
    expect(office.leavers.length).toBe(0);
  });

  it("a duplicate SubagentStart does not replace the squire", () => {
    const office = newOffice();
    const id = sid();
    const employee = seat(office, id);
    office.event(ev(id, "SubagentStart", { agent_id: "a1" }));
    office.event(ev(id, "PreToolUse", { agent_id: "a1", tool_name: "Read" }));
    office.event(ev(id, "SubagentStart", { agent_id: "a1" }));
    expect(employee.interns.get("a1")!.act).toBe("reading");
    expect(employee.interns.size).toBe(1);
  });

  it("a filtered-out (hidden) master's squires leave without gate effects", () => {
    const office = newOffice();
    const id = sid();
    const employee = seat(office, id);
    office.event(ev(id, "SubagentStart", { agent_id: "a1" }));
    tick(office, 20);
    office.setFilter({ query: "no-such-project" });
    expect(office.isHidden(employee)).toBe(true);
    office.event(ev(id, "SubagentStop", { agent_id: "a1" }));
    expect(office.leavers.length).toBe(0);
  });

  it("waiting on you and boss fights are measured in real seconds, not sim seconds", () => {
    const office = newOffice();
    office.setSpeed(4);
    const id = sid();
    const employee = seat(office, id);
    office.event(permission(id));
    tick(office, 5); // 20 sim seconds
    office.event(post(id, "Bash", "t1"));
    expect(office.getView().dungeon.waitS).toBeCloseTo(5, 0);
    office.event(pre(id, "Bash", "t2"));
    untilBoss(office, employee);
    tick(office, 3);
    office.event(post(id, "Bash", "t2"));
    const longest = office.getView().dungeon.longestBossS;
    expect(longest).toBeGreaterThanOrEqual(2.9);
    expect(longest).toBeLessThan(4);
  });

  it("entered counts live arrivals and re-entries, not sessions found seated in a snapshot", () => {
    const office = newOffice();
    office.loadSnapshot({ sessions: [{ session_id: "snap-1" }, { session_id: "snap-2" }] });
    expect(office.getView().dungeon.entered).toBe(0);
    const id = sid();
    seat(office, id);
    expect(office.getView().dungeon.entered).toBe(1);
    office.event(ev(id, "SessionEnd"));
    expect(office.getView().dungeon.left).toBe(1);
    // an event for a session that is still walking out brings it back in
    office.event(ev(id, "SessionStart"));
    office.event(ev(id, "SessionStart"));
    for (let i = 0; i < 2000 && emp(office, id).state === "LEAVING"; i++) tick(office, 0.05);
    const stats = office.getView().dungeon;
    expect(stats.entered).toBe(2); // first arrival + the re-entry; the two snapshot sessions were never "entered"
    expect(stats.entered - stats.left).toBe(stats.live - 2);
  });
});
