import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { emp, ev, fixedRandom, newOffice, seat, sid, stubStorage } from "./helpers";

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
  stubStorage();
  fixedRandom(0.5);
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe("squires (subagents)", () => {
  it("SubagentStart adds a squire, SubagentStop removes it", () => {
    const o = newOffice();
    const id = sid();
    const e = seat(o, id);
    o.event(ev(id, "SubagentStart", { agent_id: "a1", agent_type: "Explore" }));
    expect(e.interns.get("a1")?.label).toBe("Explore");
    expect(o.getView().roster[0].interns).toBe(1);
    o.event(ev(id, "SubagentStop", { agent_id: "a1", agent_type: "Explore" }));
    expect(e.interns.size).toBe(0);
  });

  it("squire tool events drive its act and do not touch the master's act/combat", () => {
    const o = newOffice();
    const id = sid();
    const e = seat(o, id);
    o.event(ev(id, "SubagentStart", { agent_id: "a1", agent_type: "Explore" }));
    o.event(ev(id, "PreToolUse", { agent_id: "a1", tool_name: "Read", tool_input: { file_path: "/x/f.ts" } }));
    const it = e.interns.get("a1")!;
    expect(it.act).toBe("reading");
    expect(it.detail).toBe("f.ts");
    expect(it.count).toBe(1);
    expect(e.act).toBe("thinking");
    expect(e.pending.size).toBe(0);
    o.event(ev(id, "PostToolUse", { agent_id: "a1", tool_name: "Read" }));
    expect(it.act).toBe("idle");
    expect(e.xp).toBe(0);
    o.event(ev(id, "PostToolUseFailure", { agent_id: "a1", tool_name: "Bash" }));
    expect(it.failed).toBe(true);
    expect(e.hearts).toBe(3);
  });

  it("squire permission request raises its hand and flags the roster", () => {
    const o = newOffice();
    const id = sid();
    seat(o, id);
    o.event(ev(id, "SubagentStart", { agent_id: "a1", agent_type: "x" }));
    o.event(ev(id, "PermissionRequest", { agent_id: "a1", tool_name: "Bash" }));
    const row = o.getView().roster[0];
    expect(row.act).toBe("intern_handup");
    expect(row.internList[0].needsYou).toBe(true);
    expect(o.statusOf(emp(o, id))).toContain("สไควร์");
  });

  it("a squire's PreToolUse for an unseen agent creates it", () => {
    const o = newOffice();
    const id = sid();
    const e = seat(o, id);
    o.event(ev(id, "PreToolUse", { agent_id: "ghost", agent_type: "gp", tool_name: "Edit" }));
    expect(e.interns.get("ghost")?.act).toBe("typing");
  });

  it("squire non-Pre events for an unknown agent are ignored", () => {
    const o = newOffice();
    const id = sid();
    const e = seat(o, id);
    o.event(ev(id, "PostToolUse", { agent_id: "nope", tool_name: "Read" }));
    o.event(ev(id, "PermissionRequest", { agent_id: "nope" }));
    expect(e.interns.size).toBe(0);
  });

  it("SubagentStop with an unknown agent_id does not throw or remove others", () => {
    const o = newOffice();
    const id = sid();
    const e = seat(o, id);
    o.event(ev(id, "SubagentStart", { agent_id: "a1" }));
    expect(() => o.event(ev(id, "SubagentStop", { agent_id: "zzz" }))).not.toThrow();
    expect(e.interns.has("a1")).toBe(true);
  });

  it("SubagentStop without agent_id removes the oldest squire", () => {
    const o = newOffice();
    const id = sid();
    const e = seat(o, id);
    o.event(ev(id, "SubagentStart", { agent_id: "a1" }));
    o.event(ev(id, "SubagentStart", { agent_id: "a2" }));
    o.event(ev(id, "SubagentStop"));
    expect([...e.interns.keys()]).toEqual(["a2"]);
    o.event(ev(id, "SubagentStop"));
    o.event(ev(id, "SubagentStop"));
    expect(e.interns.size).toBe(0);
  });

  it("late events from a stopped squire do not resurrect it (30s), until SubagentStart again", () => {
    const o = newOffice();
    const id = sid();
    const e = seat(o, id);
    o.event(ev(id, "SubagentStart", { agent_id: "a1" }));
    o.event(ev(id, "SubagentStop", { agent_id: "a1" }));
    o.event(ev(id, "PreToolUse", { agent_id: "a1", tool_name: "Read" }));
    expect(e.interns.size).toBe(0);
    o.event(ev(id, "SubagentStart", { agent_id: "a1" }));
    o.event(ev(id, "PreToolUse", { agent_id: "a1", tool_name: "Read" }));
    expect(e.interns.get("a1")?.act).toBe("reading");
    o.event(ev(id, "SubagentStop", { agent_id: "a1" }));
    vi.setSystemTime(Date.now() + 31_000);
    o.event(ev(id, "PreToolUse", { agent_id: "a1", tool_name: "Read" }));
    expect(e.interns.size).toBe(1);
  });

  it("a stopped unknown agent id is tombstoned too", () => {
    const o = newOffice();
    const id = sid();
    const e = seat(o, id);
    o.event(ev(id, "SubagentStop", { agent_id: "unk" }));
    o.event(ev(id, "PreToolUse", { agent_id: "unk", tool_name: "Read" }));
    expect(e.interns.size).toBe(0);
  });

  it("squire events do not count toward idleness of nothing but still bump lastEventAt", () => {
    const o = newOffice();
    const id = sid();
    const e = seat(o, id);
    e.lastEventAt = -100;
    o.event(ev(id, "SubagentStart", { agent_id: "a1" }));
    expect(e.lastEventAt).toBe(o.clock);
  });

  it("squires are cleared when the master leaves", () => {
    const o = newOffice();
    const id = sid();
    const e = seat(o, id);
    o.event(ev(id, "SubagentStart", { agent_id: "a1" }));
    o.event(ev(id, "SessionEnd"));
    expect(e.interns.size).toBe(0);
  });

  it("squire events for a session never seen spawn the master", () => {
    const o = newOffice();
    const id = sid();
    o.event(ev(id, "SubagentStart", { agent_id: "a1" }));
    expect(o.employees.has(id)).toBe(true);
    expect(emp(o, id).interns.has("a1")).toBe(true);
  });
});
