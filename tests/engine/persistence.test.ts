import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Office } from "@/lib/office/engine";

import { PROGRESS_KEY, emp, ev, fixedRandom, makeCanvas, newOffice, seat, sid, stubStorage, tick } from "./helpers";

const DAY = 24 * 3600 * 1000;

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
  fixedRandom(0.5);
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const sim = () => ({ update: vi.fn(), addSession: vi.fn() });

const earn = (office: Office, id: string) => {
  const employee = emp(office, id);
  employee.monHp = 1;
  office.event(ev(id, "PostToolUse", { tool_name: "Read" }));
  return employee;
};

describe("persistence", () => {
  it("works with no localStorage at all", () => {
    vi.stubGlobal("localStorage", undefined);
    const office = newOffice();
    const id = sid();
    seat(office, id);
    earn(office, id);
    expect(() => tick(office, 5)).not.toThrow();
  });

  it("survives corrupt storage", () => {
    stubStorage({ [PROGRESS_KEY]: "{not json" });
    const office = newOffice();
    expect(office.treasury).toBe(0);
  });

  it("saves progress (throttled, via update) and a fresh Office restores it", () => {
    const { ls, m } = stubStorage();
    const office = newOffice();
    const id = sid();
    seat(office, id);
    const employee = earn(office, id);
    tick(office, 3);
    expect(ls.setItem).toHaveBeenCalled();
    const j = JSON.parse(m.get(PROGRESS_KEY)!);
    expect(j.treasury).toBe(office.treasury);
    expect(j.sessions[id]).toMatchObject({
      xp: employee.xp,
      lv: employee.lv,
      gold: employee.gold,
      kills: employee.kills,
    });

    const o2 = newOffice();
    expect(o2.treasury).toBe(office.treasury);
    o2.event(ev(id, "SessionStart"));
    const restored = emp(o2, id);
    expect([restored.xp, restored.lv, restored.gold, restored.kills]).toEqual([
      employee.xp,
      employee.lv,
      employee.gold,
      employee.kills,
    ]);
  });

  it("writes are throttled to once per 2s of real time", () => {
    const { ls } = stubStorage();
    const office = newOffice();
    const id = sid();
    seat(office, id);
    tick(office, 3);
    earn(office, id);
    office.update(0.1);
    expect(ls.setItem).toHaveBeenCalledTimes(1);
    ls.setItem.mockClear();
    earn(office, id);
    office.update(0.1);
    expect(ls.setItem).not.toHaveBeenCalled();
    tick(office, 2.2);
    expect(ls.setItem).toHaveBeenCalledTimes(1);
  });

  it("does not write when nothing changed", () => {
    const { ls } = stubStorage();
    const office = newOffice();
    seat(office, sid());
    tick(office, 10);
    expect(ls.setItem).not.toHaveBeenCalled();
  });

  it("prunes stale (>7d) sessions on load and on save", () => {
    const old = sid("old"),
      fresh = sid("new");
    const { m } = stubStorage({
      [PROGRESS_KEY]: JSON.stringify({
        sessions: {
          [old]: { xp: 1, lv: 9, gold: 1, kills: 1, seen: Date.now() - 8 * DAY },
          [fresh]: { xp: 1, lv: 5, gold: 1, kills: 1, seen: Date.now() - DAY },
        },
        treasury: 5,
      }),
    });
    const office = newOffice();
    office.event(ev(old, "SessionStart"));
    office.event(ev(fresh, "SessionStart"));
    expect(emp(office, old).lv).toBe(1);
    expect(emp(office, fresh).lv).toBe(5);
    seat(office, fresh);
    earn(office, fresh);
    tick(office, 3);
    expect(Object.keys(JSON.parse(m.get(PROGRESS_KEY)!).sessions)).toEqual([fresh]);
  });

  it("sanitises hostile stored values", () => {
    const id = sid();
    stubStorage({
      [PROGRESS_KEY]: JSON.stringify({
        sessions: { [id]: { xp: -5, lv: "x", gold: null, kills: 2, seen: Date.now() } },
        treasury: -3,
      }),
    });
    const office = newOffice();
    office.event(ev(id, "SessionStart"));
    const employee = emp(office, id);
    expect([employee.xp, employee.lv, employee.gold, employee.kills]).toEqual([0, 1, 0, 2]);
    expect(office.treasury).toBe(0);
  });

  it("a thrown setItem (quota) is swallowed", () => {
    const { ls } = stubStorage();
    ls.setItem.mockImplementation(() => {
      throw new Error("quota");
    });
    const office = newOffice();
    const id = sid();
    seat(office, id);
    earn(office, id);
    expect(() => tick(office, 3)).not.toThrow();
  });
});

describe("demo mode (attachSim)", () => {
  it("never writes progress and never restores it", () => {
    const id = sid();
    const { ls } = stubStorage({
      [PROGRESS_KEY]: JSON.stringify({
        sessions: { [id]: { xp: 1, lv: 7, gold: 5, kills: 5, seen: Date.now() } },
        treasury: 42,
      }),
    });
    const office = newOffice();
    expect(office.treasury).toBe(42);
    office.attachSim(sim());
    expect(office.treasury).toBe(0);
    seat(office, id);
    const employee = emp(office, id);
    expect(employee.lv).toBe(1); // saved progress ignored in demo
    earn(office, id);
    employee.xp = 9999;
    tick(office, 10);
    expect(ls.setItem).not.toHaveBeenCalled();
  });

  it("calls the sim every update and exposes addSession", () => {
    stubStorage();
    const office = newOffice();
    const simulator = sim();
    office.attachSim(simulator);
    tick(office, 0.5, 0.1);
    expect(simulator.update).toHaveBeenCalledTimes(5);
    office.addSession();
    expect(simulator.addSession).toHaveBeenCalled();
  });

  it("flushes pending real progress when entering demo, then leaving demo reloads it", () => {
    const { m } = stubStorage();
    const office = newOffice();
    const id = sid();
    seat(office, id);
    earn(office, id);
    const real = office.treasury;
    expect(real).toBeGreaterThan(0);
    office.attachSim(sim());
    expect(JSON.parse(m.get(PROGRESS_KEY)!).treasury).toBe(real);
    office.attachSim(null);
    expect(office.treasury).toBe(real);
  });

  it("demo treasury gains are not written even on stop-like forced saves", () => {
    const { ls } = stubStorage();
    const office = newOffice();
    office.attachSim(sim());
    const id = sid();
    seat(office, id);
    earn(office, id);
    expect(office.treasury).toBeGreaterThan(0);
    tick(office, 5);
    expect(ls.setItem).not.toHaveBeenCalled();
    office.attachSim(null);
    expect(ls.setItem).not.toHaveBeenCalled();
    expect(office.treasury).toBe(0);
  });
});

describe("misc", () => {
  it("pause freezes the sim clock; speed scales it", () => {
    stubStorage();
    const office = newOffice();
    office.setPaused(true);
    office.update(1);
    expect(office.clock).toBe(0);
    office.setPaused(false);
    office.setSpeed(4);
    office.update(0.5);
    expect(office.clock).toBeCloseTo(2);
  });

  it("clear() empties employees and tombstones", () => {
    stubStorage();
    const office = new Office(makeCanvas());
    const id = sid();
    seat(office, id);
    office.event(ev(id, "SessionEnd"));
    office.clear();
    expect(office.employees.size).toBe(0);
    office.event(ev(id, "PreToolUse", { tool_name: "Read" }));
    expect(office.employees.has(id)).toBe(true);
  });

  it("subscribe emits views to listeners and can unsubscribe", () => {
    stubStorage();
    const office = newOffice();
    const cb = vi.fn();
    const un = office.subscribe(cb);
    expect(cb).toHaveBeenCalledTimes(1);
    un();
    office.clear();
    expect(cb).toHaveBeenCalledTimes(1);
  });
});
