import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ev, newOffice, seat, sid, stubStorage, tick } from "./helpers";

beforeEach(() => {
  vi.useFakeTimers();
  stubStorage();
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("context (mana)", () => {
  it("setContext shows in roster and frac", () => {
    const office = newOffice();
    const sessionA = sid();
    seat(office, sessionA);
    office.setContext(sessionA, 250000, 1000000, true);
    expect(office.ctxFrac(sessionA)).toBeCloseTo(0.25);
    const row = office.getView().roster[0];
    expect([row.ctxUsed, row.ctxLimit, row.ctxGuessed]).toEqual([250000, 1000000, true]);
  });

  it("null resets; unknown means no fields", () => {
    const office = newOffice();
    const sessionA = sid();
    seat(office, sessionA);
    office.setContext(sessionA, 10, 100);
    office.setContext(sessionA, null, null, false);
    expect(office.ctxFrac(sessionA)).toBeNull();
    const row = office.getView().roster[0];
    expect(row.ctxUsed).toBeUndefined();
  });

  it("rejects garbage and clamps >100%", () => {
    const office = newOffice();
    const sessionA = sid();
    seat(office, sessionA);
    office.setContext(sessionA, 5, 0);
    expect(office.ctxFrac(sessionA)).toBeNull();
    office.setContext(sessionA, 300, 100);
    expect(office.ctxFrac(sessionA)).toBe(1);
  });

  it("survives leave and re-enter", () => {
    const office = newOffice();
    const sessionA = sid();
    seat(office, sessionA);
    office.setContext(sessionA, 50, 100);
    office.event(ev(sessionA, "SessionEnd"));
    tick(office, 0.5);
    expect(office.ctxFrac(sessionA)).toBeCloseTo(0.5);
  });

  it("snapshot context applies, null resets, undefined keeps", () => {
    const office = newOffice();
    const sessionA = sid();
    office.loadSnapshot({
      sessions: [{ session_id: sessionA, cwd: "/w/p", context: { used: 20, limit: 100, limitGuessed: false } }],
    });
    expect(office.ctxFrac(sessionA)).toBeCloseTo(0.2);
    office.loadSnapshot({ sessions: [{ session_id: sessionA, cwd: "/w/p" }] });
    expect(office.ctxFrac(sessionA)).toBeCloseTo(0.2);
    office.loadSnapshot({ sessions: [{ session_id: sessionA, cwd: "/w/p", context: null }] });
    expect(office.ctxFrac(sessionA)).toBeNull();
  });

  it("roster re-emits only when rounded percent changes", () => {
    const office = newOffice();
    const sessionA = sid();
    seat(office, sessionA);
    office.setContext(sessionA, 500, 1000);
    const cb = vi.fn();
    office.subscribe(cb);
    cb.mockClear();
    office.setContext(sessionA, 501, 1000); // still 50%
    office.publish();
    expect(cb).not.toHaveBeenCalled();
    office.setContext(sessionA, 600, 1000);
    office.publish();
    expect(cb).toHaveBeenCalledTimes(1);
  });
});

describe("session filter", () => {
  it("query hides non-matching from roster and hit-test, counts hidden", () => {
    const office = newOffice();
    const sessionA = sid(),
      sessionB = sid();
    seat(office, sessionA, { cwd: "/w/Alpha-App" });
    seat(office, sessionB, { cwd: "/w/beta" });
    office.setFilter({ query: "ALPHA" });
    const view = office.getView();
    expect(view.roster.map((row) => row.id)).toEqual([sessionA]);
    expect(view.hiddenCount).toBe(1);
    const eb = office.employees.get(sessionB)!;
    expect(office.hit(eb.x, eb.y - 2)).toBeNull();
    office.setFilter({ query: "" });
    expect(office.getView().roster).toHaveLength(2);
    expect(office.getView().hiddenCount).toBe(0);
  });

  it("hideStray hides sessions without SessionStart and < 3 events", () => {
    const office = newOffice();
    const sessionA = sid(),
      session = sid();
    seat(office, sessionA);
    office.event(ev(session, "UserPromptSubmit"));
    office.setFilter({ hideStray: true });
    expect(office.getView().roster.map((row) => row.id)).toEqual([sessionA]);
    office.event(ev(session, "Stop"));
    office.event(ev(session, "Stop"));
    expect(office.getView().roster).toHaveLength(2);
  });

  it("hideStray never hides a snapshot-listed session with few events", () => {
    const office = newOffice();
    const sessionA = sid();
    office.loadSnapshot({ sessions: [{ session_id: sessionA, cwd: "/w/p" }], events: [] });
    office.setFilter({ hideStray: true });
    expect(office.getView().roster.map((row) => row.id)).toEqual([sessionA]);
    expect(office.employees.get(sessionA)!.evCount).toBeLessThan(3);
  });

  it("hideStray never hides a session waiting on the user", () => {
    const office = newOffice();
    const session = sid();
    office.event(ev(session, "UserPromptSubmit"));
    tick(office, 60);
    office.event(ev(session, "Notification", { notification_type: "permission_prompt" }));
    office.setFilter({ hideStray: true });
    expect(office.employees.get(session)!.evCount).toBeLessThan(3);
    expect(office.employees.get(session)!.act).toBe("handup");
    expect(office.getView().roster.map((row) => row.id)).toEqual([session]);
  });

  it("waitingIds / view.waiting include sessions hidden by the filter", () => {
    const office = newOffice();
    const sessionA = sid();
    seat(office, sessionA, { cwd: "/w/zzz" });
    office.event(ev(sessionA, "Notification", { notification_type: "permission_prompt" }));
    office.setFilter({ query: "nomatch" });
    expect(office.getView().roster).toHaveLength(0);
    expect(office.waitingIds()).toEqual([sessionA]);
    const view = office.getView();
    expect(view.waiting!.map((row) => [row.id, row.hidden])).toEqual([[sessionA, true]]);
    expect(view.hiddenIds).toEqual([sessionA]);
  });

  it("hidden employees keep updating", () => {
    const office = newOffice();
    const sessionA = sid();
    seat(office, sessionA, { cwd: "/w/zzz" });
    office.setFilter({ query: "nomatch" });
    office.event(ev(sessionA, "UserPromptSubmit"));
    office.event(ev(sessionA, "PreToolUse", { tool_name: "Edit", tool_input: { file_path: "/w/zzz/a.ts" } }));
    expect(office.employees.get(sessionA)!.act).toBe("typing");
    office.setFilter({ query: "" });
    expect(office.getView().roster[0].act).toBe("typing");
  });

  it("filtering drops hover/selection of hidden", () => {
    const office = newOffice();
    const sessionA = sid();
    seat(office, sessionA, { cwd: "/w/x" });
    office.select(sessionA);
    office.setHover(sessionA);
    office.setFilter({ query: "y" });
    expect(office.selectedId).toBeNull();
    expect(office.hoverId).toBeNull();
  });
});
