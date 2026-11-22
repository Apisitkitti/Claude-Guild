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

function earn(o: Office, id: string) {
  const e = emp(o, id);
  e.monHp = 1;
  o.event(ev(id, "PostToolUse", { tool_name: "Read" }));
  return e;
}

describe("persistence", () => {
  it("works with no localStorage at all", () => {
    vi.stubGlobal("localStorage", undefined);
    const o = newOffice();
    const id = sid();
    seat(o, id);
    earn(o, id);
    expect(() => tick(o, 5)).not.toThrow();
  });

  it("survives corrupt storage", () => {
    stubStorage({ [PROGRESS_KEY]: "{not json" });
    const o = newOffice();
    expect(o.treasury).toBe(0);
  });

  it("saves progress (throttled, via update) and a fresh Office restores it", () => {
    const { ls, m } = stubStorage();
    const o = newOffice();
    const id = sid();
    seat(o, id);
    const e = earn(o, id);
    tick(o, 3);
    expect(ls.setItem).toHaveBeenCalled();
    const j = JSON.parse(m.get(PROGRESS_KEY)!);
    expect(j.treasury).toBe(o.treasury);
    expect(j.sessions[id]).toMatchObject({ xp: e.xp, lv: e.lv, gold: e.gold, kills: e.kills });

    const o2 = newOffice();
    expect(o2.treasury).toBe(o.treasury);
    o2.event(ev(id, "SessionStart"));
    const r = emp(o2, id);
    expect([r.xp, r.lv, r.gold, r.kills]).toEqual([e.xp, e.lv, e.gold, e.kills]);
  });

  it("writes are throttled to once per 2s of real time", () => {
    const { ls } = stubStorage();
    const o = newOffice();
    const id = sid();
    seat(o, id);
    tick(o, 3);
    earn(o, id);
    o.update(0.1);
    expect(ls.setItem).toHaveBeenCalledTimes(1);
    ls.setItem.mockClear();
    earn(o, id);
    o.update(0.1);
    expect(ls.setItem).not.toHaveBeenCalled();
    tick(o, 2.2);
    expect(ls.setItem).toHaveBeenCalledTimes(1);
  });

  it("does not write when nothing changed", () => {
    const { ls } = stubStorage();
    const o = newOffice();
    seat(o, sid());
    tick(o, 10);
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
    const o = newOffice();
    o.event(ev(old, "SessionStart"));
    o.event(ev(fresh, "SessionStart"));
    expect(emp(o, old).lv).toBe(1);
    expect(emp(o, fresh).lv).toBe(5);
    seat(o, fresh);
    earn(o, fresh);
    tick(o, 3);
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
    const o = newOffice();
    o.event(ev(id, "SessionStart"));
    const e = emp(o, id);
    expect([e.xp, e.lv, e.gold, e.kills]).toEqual([0, 1, 0, 2]);
    expect(o.treasury).toBe(0);
  });

  it("a thrown setItem (quota) is swallowed", () => {
    const { ls } = stubStorage();
    ls.setItem.mockImplementation(() => {
      throw new Error("quota");
    });
    const o = newOffice();
    const id = sid();
    seat(o, id);
    earn(o, id);
    expect(() => tick(o, 3)).not.toThrow();
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
    const o = newOffice();
    expect(o.treasury).toBe(42);
    o.attachSim(sim());
    expect(o.treasury).toBe(0);
    seat(o, id);
    const e = emp(o, id);
    expect(e.lv).toBe(1); // saved progress ignored in demo
    earn(o, id);
    e.xp = 9999;
    tick(o, 10);
    expect(ls.setItem).not.toHaveBeenCalled();
  });

  it("calls the sim every update and exposes addSession", () => {
    stubStorage();
    const o = newOffice();
    const s = sim();
    o.attachSim(s);
    tick(o, 0.5, 0.1);
    expect(s.update).toHaveBeenCalledTimes(5);
    o.addSession();
    expect(s.addSession).toHaveBeenCalled();
  });

  it("flushes pending real progress when entering demo, then leaving demo reloads it", () => {
    const { m } = stubStorage();
    const o = newOffice();
    const id = sid();
    seat(o, id);
    earn(o, id);
    const real = o.treasury;
    expect(real).toBeGreaterThan(0);
    o.attachSim(sim());
    expect(JSON.parse(m.get(PROGRESS_KEY)!).treasury).toBe(real);
    o.attachSim(null);
    expect(o.treasury).toBe(real);
  });

  it("demo treasury gains are not written even on stop-like forced saves", () => {
    const { ls } = stubStorage();
    const o = newOffice();
    o.attachSim(sim());
    const id = sid();
    seat(o, id);
    earn(o, id);
    expect(o.treasury).toBeGreaterThan(0);
    tick(o, 5);
    expect(ls.setItem).not.toHaveBeenCalled();
    o.attachSim(null);
    expect(ls.setItem).not.toHaveBeenCalled();
    expect(o.treasury).toBe(0);
  });
});

describe("misc", () => {
  it("pause freezes the sim clock; speed scales it", () => {
    stubStorage();
    const o = newOffice();
    o.setPaused(true);
    o.update(1);
    expect(o.clock).toBe(0);
    o.setPaused(false);
    o.setSpeed(4);
    o.update(0.5);
    expect(o.clock).toBeCloseTo(2);
  });

  it("clear() empties employees and tombstones", () => {
    stubStorage();
    const o = new Office(makeCanvas());
    const id = sid();
    seat(o, id);
    o.event(ev(id, "SessionEnd"));
    o.clear();
    expect(o.employees.size).toBe(0);
    o.event(ev(id, "PreToolUse", { tool_name: "Read" }));
    expect(o.employees.has(id)).toBe(true);
  });

  it("subscribe emits views to listeners and can unsubscribe", () => {
    stubStorage();
    const o = newOffice();
    const cb = vi.fn();
    const un = o.subscribe(cb);
    expect(cb).toHaveBeenCalledTimes(1);
    un();
    o.clear();
    expect(cb).toHaveBeenCalledTimes(1);
  });
});
