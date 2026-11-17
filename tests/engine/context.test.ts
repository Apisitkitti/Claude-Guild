import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ev, newOffice, seat, sid, stubStorage, tick } from "./helpers";

beforeEach(() => { vi.useFakeTimers(); stubStorage(); });
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe("context (mana)", () => {
  it("setContext shows in roster and frac", () => {
    const o = newOffice(); const a = sid();
    seat(o, a);
    o.setContext(a, 250000, 1000000, true);
    expect(o.ctxFrac(a)).toBeCloseTo(0.25);
    const r = o.getView().roster[0];
    expect([r.ctxUsed, r.ctxLimit, r.ctxGuessed]).toEqual([250000, 1000000, true]);
  });

  it("null resets; unknown means no fields", () => {
    const o = newOffice(); const a = sid();
    seat(o, a);
    o.setContext(a, 10, 100);
    o.setContext(a, null, null, false);
    expect(o.ctxFrac(a)).toBeNull();
    const r = o.getView().roster[0];
    expect(r.ctxUsed).toBeUndefined();
  });

  it("rejects garbage and clamps >100%", () => {
    const o = newOffice(); const a = sid();
    seat(o, a);
    o.setContext(a, 5, 0);
    expect(o.ctxFrac(a)).toBeNull();
    o.setContext(a, 300, 100);
    expect(o.ctxFrac(a)).toBe(1);
  });

  it("survives leave and re-enter", () => {
    const o = newOffice(); const a = sid();
    seat(o, a);
    o.setContext(a, 50, 100);
    o.event(ev(a, "SessionEnd"));
    tick(o, 0.5);
    expect(o.ctxFrac(a)).toBeCloseTo(0.5);
  });

  it("snapshot context applies, null resets, undefined keeps", () => {
    const o = newOffice(); const a = sid();
    o.loadSnapshot({ sessions: [{ session_id: a, cwd: "/w/p", context: { used: 20, limit: 100, limitGuessed: false } }] });
    expect(o.ctxFrac(a)).toBeCloseTo(0.2);
    o.loadSnapshot({ sessions: [{ session_id: a, cwd: "/w/p" }] });
    expect(o.ctxFrac(a)).toBeCloseTo(0.2);
    o.loadSnapshot({ sessions: [{ session_id: a, cwd: "/w/p", context: null }] });
    expect(o.ctxFrac(a)).toBeNull();
  });

  it("roster re-emits only when rounded percent changes", () => {
    const o = newOffice(); const a = sid();
    seat(o, a);
    o.setContext(a, 500, 1000);
    const cb = vi.fn();
    o.subscribe(cb);
    cb.mockClear();
    o.setContext(a, 501, 1000); // still 50%
    o.publish();
    expect(cb).not.toHaveBeenCalled();
    o.setContext(a, 600, 1000);
    o.publish();
    expect(cb).toHaveBeenCalledTimes(1);
  });
});

describe("session filter", () => {
  it("query hides non-matching from roster and hit-test, counts hidden", () => {
    const o = newOffice(); const a = sid(), b = sid();
    seat(o, a, { cwd: "/w/Alpha-App" });
    seat(o, b, { cwd: "/w/beta" });
    o.setFilter({ query: "ALPHA" });
    const v = o.getView();
    expect(v.roster.map((r) => r.id)).toEqual([a]);
    expect(v.hiddenCount).toBe(1);
    const eb = o.employees.get(b)!;
    expect(o.hit(eb.x, eb.y - 2)).toBeNull();
    o.setFilter({ query: "" });
    expect(o.getView().roster).toHaveLength(2);
    expect(o.getView().hiddenCount).toBe(0);
  });

  it("hideStray hides sessions without SessionStart and < 3 events", () => {
    const o = newOffice(); const a = sid(), s = sid();
    seat(o, a);
    o.event(ev(s, "UserPromptSubmit"));
    o.setFilter({ hideStray: true });
    expect(o.getView().roster.map((r) => r.id)).toEqual([a]);
    o.event(ev(s, "Stop")); o.event(ev(s, "Stop"));
    expect(o.getView().roster).toHaveLength(2);
  });

  it("hideStray never hides a snapshot-listed session with few events", () => {
    const o = newOffice(); const a = sid();
    o.loadSnapshot({ sessions: [{ session_id: a, cwd: "/w/p" }], events: [] });
    o.setFilter({ hideStray: true });
    expect(o.getView().roster.map((r) => r.id)).toEqual([a]);
    expect(o.employees.get(a)!.evCount).toBeLessThan(3);
  });

  it("hideStray never hides a session waiting on the user", () => {
    const o = newOffice(); const s = sid();
    o.event(ev(s, "UserPromptSubmit"));
    tick(o, 60);
    o.event(ev(s, "Notification", { notification_type: "permission_prompt" }));
    o.setFilter({ hideStray: true });
    expect(o.employees.get(s)!.evCount).toBeLessThan(3);
    expect(o.employees.get(s)!.act).toBe("handup");
    expect(o.getView().roster.map((r) => r.id)).toEqual([s]);
  });

  it("waitingIds / view.waiting include sessions hidden by the filter", () => {
    const o = newOffice(); const a = sid();
    seat(o, a, { cwd: "/w/zzz" });
    o.event(ev(a, "Notification", { notification_type: "permission_prompt" }));
    o.setFilter({ query: "nomatch" });
    expect(o.getView().roster).toHaveLength(0);
    expect(o.waitingIds()).toEqual([a]);
    const v = o.getView();
    expect(v.waiting!.map((w) => [w.id, w.hidden])).toEqual([[a, true]]);
    expect(v.hiddenIds).toEqual([a]);
  });

  it("hidden employees keep updating", () => {
    const o = newOffice(); const a = sid();
    seat(o, a, { cwd: "/w/zzz" });
    o.setFilter({ query: "nomatch" });
    o.event(ev(a, "UserPromptSubmit"));
    o.event(ev(a, "PreToolUse", { tool_name: "Edit", tool_input: { file_path: "/w/zzz/a.ts" } }));
    expect(o.employees.get(a)!.act).toBe("typing");
    o.setFilter({ query: "" });
    expect(o.getView().roster[0].act).toBe("typing");
  });

  it("filtering drops hover/selection of hidden", () => {
    const o = newOffice(); const a = sid();
    seat(o, a, { cwd: "/w/x" });
    o.select(a); o.setHover(a);
    o.setFilter({ query: "y" });
    expect(o.selectedId).toBeNull();
    expect(o.hoverId).toBeNull();
  });
});
