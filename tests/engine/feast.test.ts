import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Employee, Office, ReceiptMsgRow } from "@/lib/office/engine";
import {
  CHEF_HOME,
  CHEF_PICKUP,
  CHEF_SERVE,
  DESK_COUNT,
  FEAST_BLOCK,
  FEAST_LANE_X,
  FEAST_SEATS,
  GATE_OPEN,
  HALL_W,
  TAVERN_OVERFLOW,
  VIEW_X0,
  WALL_X0,
  routeChefServe,
  routeLeave,
  routeToBreak,
  seatPoint,
  type Pt,
} from "@/lib/office/layout";

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

const SAMPLE_STEP = 2;
const sampleAlong = (start: Pt, path: Pt[]): Pt[] => {
  const out: Pt[] = [start];
  let from = start;
  for (const to of path) {
    const steps = Math.max(1, Math.ceil(Math.hypot(to.x - from.x, to.y - from.y) / SAMPLE_STEP));
    for (let i = 1; i <= steps; i++)
      out.push({ x: from.x + ((to.x - from.x) * i) / steps, y: from.y + ((to.y - from.y) * i) / steps });
    from = to;
  }
  return out;
};
const insideBlock = (point: Pt) =>
  point.x > FEAST_BLOCK.x &&
  point.x < FEAST_BLOCK.x + FEAST_BLOCK.w &&
  point.y > FEAST_BLOCK.y &&
  point.y < FEAST_BLOCK.y + FEAST_BLOCK.h;
/** inside the hall + wing, and through the east wall only by the gate */
const insideHall = (point: Pt) => {
  if (point.x < VIEW_X0 || point.y < 0) return false;
  return !(point.x > WALL_X0 && point.x < HALL_W && (point.y < GATE_OPEN.y0 || point.y > GATE_OPEN.y1));
};

/** seat `count` sessions and send them all to the long table (a beer break) */
const sendToTable = (office: Office, count: number): Employee[] => {
  const ids = Array.from({ length: count }, () => sid());
  const staff = ids.map((id) => seat(office, id));
  for (const id of ids) office.event(ev(id, "PreCompact"));
  return staff;
};
/** like sendToTable, then wait until all of them sit at the table at the same moment */
const seatDiners = (office: Office, count: number): Employee[] => {
  const staff = sendToTable(office, count);
  for (let i = 0; i < 3000 && !staff.every((employee) => employee.state === "AT_TAVERN_REST"); i++) tick(office, 0.1);
  return staff;
};

let receiptCounter = 0;
const receipt = (sessionId: string, extra: Partial<ReceiptMsgRow> = {}): ReceiptMsgRow => ({
  id: `r-${sessionId}-${receiptCounter++}`,
  sid: sessionId,
  project: "alpha",
  closedAt: Date.now(),
  files: 2,
  recovered: 0,
  commits: 0,
  amends: 0,
  tasks: 0,
  squire: 0,
  calls: 5,
  verdict: "done",
  ...extra,
});
/** open the ledger once (the first call only records what is already there), then add fresh rows */
const FAR_LANE_Y = 78;
const prime = (office: Office) => office.setReceipts([]);

describe("feast table: seats", () => {
  it("has 8 seats, 4 per side, none inside the table block, each reachable by a route that avoids it", () => {
    expect(FEAST_SEATS.length).toBe(8);
    expect(FEAST_SEATS.filter((seatSpot) => seatSpot.far).length).toBe(4);
    for (let i = 0; i < FEAST_SEATS.length; i++) {
      expect(insideBlock(FEAST_SEATS[i])).toBe(false);
      for (let desk = 0; desk < DESK_COUNT; desk++) {
        const route = routeToBreak(desk, 0, i);
        expect(route[0]).toEqual(seatPoint(desk, 0));
        expect(route[route.length - 1]).toEqual({ x: FEAST_SEATS[i].x, y: FEAST_SEATS[i].y });
        for (const point of sampleAlong(route[0], route.slice(1))) {
          expect(insideBlock(point)).toBe(false);
          if (point.x < HALL_W) expect(insideHall(point)).toBe(true);
        }
      }
    }
  });

  it("leaving from any seat walks out by the east lane or the aisle, never across the table", () => {
    for (const seatSpot of FEAST_SEATS) {
      const path = routeLeave(seatSpot.x, seatSpot.y);
      for (const point of sampleAlong({ x: seatSpot.x, y: seatSpot.y }, path)) {
        expect(insideBlock(point)).toBe(false);
        expect(insideHall(point)).toBe(true);
      }
    }
  });

  it("leaving from a far seat steps back to the row behind the seats first, never along the far diners", () => {
    for (const seatSpot of FEAST_SEATS.filter((spot) => spot.far)) {
      const path = routeLeave(seatSpot.x, seatSpot.y);
      expect(path[0]).toEqual({ x: seatSpot.x, y: FAR_LANE_Y });
      for (const point of sampleAlong({ x: seatSpot.x, y: seatSpot.y }, path)) {
        if (point.x >= FEAST_LANE_X) break; // in the lane: past the table
        // west of the lane the only stretch below the lane row is the step off the seat itself
        if (point.x !== seatSpot.x) expect(point.y).toBeLessThanOrEqual(FAR_LANE_Y);
      }
    }
  });

  it("a promotion walk from camp frees the table seat the break held", () => {
    const office = newOffice();
    const [diner] = seatDiners(office, 1);
    expect(diner.restSpot).toBe(0);
    for (let i = 0; i < 3000 && diner.state !== "SEATED"; i++) {
      tick(office, 0.1);
      if (diner.state === "AT_TAVERN_REST") office.event(ev(diner.id, "UserPromptSubmit"));
    }
    expect(diner.state).toBe("SEATED");
    expect(diner.restSpot).toBe(-1);
    const other = seat(office, sid());
    office.event(ev(other.id, "PreCompact"));
    expect(other.restSpot).toBe(0);
  });

  it("a leaver keeps the seat reserved until they have walked out of the wing", () => {
    const office = newOffice();
    const next = seat(office, sid());
    const [diner] = seatDiners(office, 1);
    (office as unknown as { leave: (employee: Employee) => void }).leave(diner);
    expect(diner.state).toBe("LEAVING");
    office.event(ev(next.id, "PreCompact"));
    expect(next.restSpot).toBe(1); // seat 0 is still under the leaver
    for (let i = 0; i < 600 && diner.x < 0; i++) tick(office, 0.05);
    expect(diner.x).toBeGreaterThanOrEqual(0);
    const later = seat(office, sid());
    office.event(ev(later.id, "PreCompact"));
    expect(later.restSpot).toBe(0);
  });

  it("a hidden diner keeps the seat but is not drawn, cheered to, or served", () => {
    const office = newOffice();
    const next = seat(office, sid());
    const [diner] = seatDiners(office, 1);
    expect(office.feastDiners()).toEqual([diner]);
    office.setFilter({ query: "no-such-project" });
    expect(office.feastDiners()).toEqual([]);
    expect(office.dinerSlots[0]).toBeNull();
    expect(diner.restSpot).toBe(0);
    office.event(ev(next.id, "PreCompact"));
    expect(next.restSpot).toBe(1);
  });

  it("a coffee break after Stop sits at a feast seat and gives it back afterwards", () => {
    const office = newOffice();
    const id = sid();
    const employee = seat(office, id);
    office.event(ev(id, "Stop"));
    tick(office, 1.3);
    expect(employee.state).toBe("TO_COFFEE");
    expect(employee.restSpot).toBe(0);
    for (let i = 0; i < 400 && employee.state !== "DRINK"; i++) tick(office, 0.1);
    expect(employee.state).toBe("DRINK");
    expect(office.atFeast(employee)).toBe(true);
    expect(office.statusOf(employee)).toContain("🍖");
    expect({ x: employee.x, y: employee.y }).toEqual({ x: FEAST_SEATS[0].x, y: FEAST_SEATS[0].y });
    expect(employee.facing).toBe(FEAST_SEATS[0].face);
    for (let i = 0; i < 400 && employee.state !== "SEATED"; i++) tick(office, 0.1);
    expect(office.atFeast(employee)).toBe(false);
  });

  it("8 resters fill the 8 distinct seats; the 9th stands by the counter", () => {
    const office = newOffice();
    const staff = sendToTable(office, DESK_COUNT + 1);
    expect(staff.slice(0, DESK_COUNT).map((employee) => employee.restSpot)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    expect(staff[DESK_COUNT].restSpot).toBe(-1);
    expect(staff[DESK_COUNT].path[staff[DESK_COUNT].path.length - 1]).toEqual(TAVERN_OVERFLOW);
    for (let i = 0; i < 3000 && staff[DESK_COUNT].state === "TO_TAVERN_REST"; i++) tick(office, 0.1);
    expect(staff[DESK_COUNT].state).toBe("AT_TAVERN_REST");
    expect({ x: staff[DESK_COUNT].x, y: staff[DESK_COUNT].y }).toEqual(TAVERN_OVERFLOW);
    expect(office.atFeast(staff[DESK_COUNT])).toBe(false); // the overflow one is not at the table
  });

  it("a freed seat is handed to the next one that takes a break", () => {
    const office = newOffice();
    const staff = seatDiners(office, 2);
    const [first, second] = staff;
    expect([first.restSpot, second.restSpot]).toEqual([0, 1]);
    for (let i = 0; i < 3000 && first.state !== "SEATED"; i++) tick(office, 0.1);
    expect(first.state).toBe("SEATED");
    office.event(ev(first.id, "PreCompact"));
    expect(first.restSpot).toBe(0);
  });
});

describe("chef", () => {
  it("serves a plate to a diner: pick up, walk to the table, set it down, walk home", () => {
    const office = newOffice();
    seatDiners(office, 1);
    expect(office.chef.path.length).toBe(0);
    const steps: string[] = [];
    let carried = false;
    for (let i = 0; i < 1200 && !office.dishes[0]; i++) {
      tick(office, 0.1);
      if (office.chef.plate >= 0) carried = true;
      if (office.chef.path.length) steps.push("walk");
    }
    expect(carried).toBe(true);
    expect(office.dishes[0]).not.toBeNull();
    expect(office.chef.plate).toBe(-1);
    expect({ x: office.chef.x, y: office.chef.y }).toEqual(CHEF_SERVE);
    for (let i = 0; i < 400 && office.chef.path.length; i++) tick(office, 0.1);
    expect({ x: office.chef.x, y: office.chef.y }).toEqual(CHEF_HOME);
    expect(routeChefServe().map((point) => point.wait ?? 0)).toEqual([expect.any(Number), 0, expect.any(Number), 0, 0]);
    expect(routeChefServe()[0]).toMatchObject({ x: CHEF_PICKUP.x, y: CHEF_PICKUP.y });
    for (const point of sampleAlong(CHEF_HOME, routeChefServe())) expect(insideBlock(point)).toBe(false);
  });

  it("stays home when nobody sits at the table, and the busier the guild the shorter the wait", () => {
    const office = newOffice();
    const id = sid();
    seat(office, id);
    tick(office, 60);
    expect(office.chef.path.length).toBe(0);
    expect(office.dishes.every((dish) => dish === null)).toBe(true);
    const quiet = office.serveEvery();
    for (let i = 0; i < 30; i++) office.event(ev(id, "PostToolUse", { tool_name: "Read", tool_use_id: `t${i}` }));
    expect(office.recentBusy()).toBeGreaterThanOrEqual(30);
    expect(office.serveEvery()).toBeLessThan(quiet);
    tick(office, 130); // the busy window passes
    expect(office.serveEvery()).toBe(quiet);
  });

  it("a plate is taken away when its diner leaves the table", () => {
    const office = newOffice();
    const [diner] = seatDiners(office, 1);
    for (let i = 0; i < 1200 && !office.dishes[0]; i++) tick(office, 0.1);
    expect(office.dishes[0]).not.toBeNull();
    office.event(ev(diner.id, "UserPromptSubmit")); // moving again: cuts the break short
    tick(office, 0.2);
    expect(office.dishes[0]).toBeNull();
  });
});

describe("cheers", () => {
  it("a fresh done receipt makes everyone at the table raise a mug (with a Cheers! text)", () => {
    const office = newOffice();
    const staff = seatDiners(office, 3);
    prime(office);
    expect(office.cheersAt).toBeLessThan(0);
    office.setReceipts([receipt(staff[0].id)]);
    expect(office.cheersAt).toBe(office.clock);
    expect(office.cheersText).toContain("Cheers");
    for (const employee of staff) expect(employee.cheerUntil).toBeGreaterThan(office.clock);
  });

  it("a receipt with a commit cheers even when its verdict is not done", () => {
    const office = newOffice();
    const [diner] = seatDiners(office, 1);
    prime(office);
    office.setReceipts([receipt(diner.id, { verdict: "none", commits: 1 })]);
    expect(diner.cheerUntil).toBeGreaterThan(office.clock);
  });

  it("a red receipt, an old one, or the first batch do not cheer; nobody at the table means no cheers", () => {
    const office = newOffice();
    const staff = seatDiners(office, 1);
    office.setReceipts([receipt(staff[0].id)]); // first batch: already there when we looked
    expect(office.cheersAt).toBeLessThan(0);
    office.setReceipts([receipt(staff[0].id, { verdict: "red" })]);
    office.setReceipts([receipt(staff[0].id, { closedAt: Date.now() - 600_000 })]);
    expect(staff[0].cheerUntil).toBe(0);
    const empty = newOffice();
    const id = sid();
    seat(empty, id);
    prime(empty);
    empty.setReceipts([receipt(id)]);
    expect(empty.cheersAt).toBeLessThan(0);
  });
});

describe("feast", () => {
  it("two sessions closing done receipts within 60s start a feast; one does not", () => {
    const office = newOffice();
    const staff = seatDiners(office, 2);
    prime(office);
    office.setReceipts([receipt(staff[0].id)]);
    expect(office.feasting()).toBe(false);
    office.setReceipts([receipt(staff[0].id), receipt(staff[0].id)]); // the same session twice: still one
    expect(office.feasting()).toBe(false);
    tick(office, 1);
    office.setReceipts([receipt(staff[1].id)]);
    expect(office.feasting()).toBe(true);
    expect(office.banners.some((banner) => banner.text.includes("🍖"))).toBe(true);
    expect(office.dishes[staff[0].restSpot]).not.toBeNull();
    expect(office.dishes[staff[1].restSpot]).not.toBeNull();
    expect(office.serveEvery()).toBeLessThan(10);
    tick(office, 20);
    expect(office.feasting()).toBe(false);
  });

  it("two done receipts more than 60s apart do not start one, and a feast has a cooldown", () => {
    const office = newOffice();
    const staff = seatDiners(office, 2);
    prime(office);
    office.setReceipts([receipt(staff[0].id)]);
    tick(office, 70);
    office.setReceipts([receipt(staff[1].id)]);
    expect(office.feasting()).toBe(false);
    office.setReceipts([receipt(staff[0].id)]);
    expect(office.feasting()).toBe(true);
    tick(office, 30);
    expect(office.feasting()).toBe(false);
    office.setReceipts([receipt(staff[0].id)]);
    office.setReceipts([receipt(staff[1].id)]);
    expect(office.feasting()).toBe(false); // still cooling down
  });
});

describe("bard", () => {
  it("plays while someone is at the table, and stops when everyone is working again", () => {
    const office = newOffice();
    const id = sid();
    const employee = seat(office, id);
    tick(office, 1);
    expect(office.bardOn).toBe(false);
    office.event(ev(id, "Stop"));
    for (let i = 0; i < 400 && employee.state !== "DRINK"; i++) tick(office, 0.1);
    tick(office, 0.2);
    expect(office.bardOn).toBe(true);
    tick(office, 3);
    expect(office.particles.some((particle) => particle.on && particle.spr?.startsWith("note"))).toBe(true);
    office.event(ev(id, "UserPromptSubmit"));
    for (let i = 0; i < 400 && employee.state !== "SEATED"; i++) tick(office, 0.1);
    tick(office, 0.2);
    expect(office.bardOn).toBe(false);
  });

  it("plays for an adventurer resting at their post", () => {
    const office = newOffice();
    const id = sid();
    const employee = seat(office, id);
    tick(office, 60);
    expect(employee.resting).toBe(true);
    expect(office.bardOn).toBe(true);
  });

  it("the music notes are drawn under the characters (never over them)", () => {
    const office = newOffice();
    seatDiners(office, 1);
    tick(office, 5);
    const notes = office.particles.filter((particle) => particle.on && particle.spr?.startsWith("note"));
    expect(notes.length).toBeGreaterThan(0);
    for (const note of notes) expect(note.under).toBe(true);
  });
});
