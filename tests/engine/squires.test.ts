import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { emp, ev, fixedRandom, newOffice, seat, sid, stubStorage } from "./helpers";

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

describe("squires (subagents)", () => {
  it("SubagentStart adds a squire, SubagentStop removes it", () => {
    const office = newOffice();
    const id = sid();
    const employee = seat(office, id);
    office.event(ev(id, "SubagentStart", { agent_id: "a1", agent_type: "Explore" }));
    expect(employee.interns.get("a1")?.label).toBe("Explore");
    expect(office.getView().roster[0].interns).toBe(1);
    office.event(ev(id, "SubagentStop", { agent_id: "a1", agent_type: "Explore" }));
    expect(employee.interns.size).toBe(0);
  });

  it("squire tool events drive its act and do not touch the master's act/combat", () => {
    const office = newOffice();
    const id = sid();
    const employee = seat(office, id);
    office.event(ev(id, "SubagentStart", { agent_id: "a1", agent_type: "Explore" }));
    office.event(ev(id, "PreToolUse", { agent_id: "a1", tool_name: "Read", tool_input: { file_path: "/x/f.ts" } }));
    const it = employee.interns.get("a1")!;
    expect(it.act).toBe("reading");
    expect(it.detail).toBe("f.ts");
    expect(it.count).toBe(1);
    expect(employee.act).toBe("thinking");
    expect(employee.pending.size).toBe(0);
    office.event(ev(id, "PostToolUse", { agent_id: "a1", tool_name: "Read" }));
    expect(it.act).toBe("idle");
    expect(employee.xp).toBe(0);
    office.event(ev(id, "PostToolUseFailure", { agent_id: "a1", tool_name: "Bash" }));
    expect(it.failed).toBe(true);
    expect(employee.hearts).toBe(3);
  });

  it("squire permission request raises its hand and flags the roster", () => {
    const office = newOffice();
    const id = sid();
    seat(office, id);
    office.event(ev(id, "SubagentStart", { agent_id: "a1", agent_type: "x" }));
    office.event(ev(id, "PermissionRequest", { agent_id: "a1", tool_name: "Bash" }));
    const row = office.getView().roster[0];
    expect(row.act).toBe("intern_handup");
    expect(row.internList[0].needsYou).toBe(true);
    expect(office.statusOf(emp(office, id))).toContain("squire");
  });

  it("a squire's PreToolUse for an unseen agent creates it", () => {
    const office = newOffice();
    const id = sid();
    const employee = seat(office, id);
    office.event(ev(id, "PreToolUse", { agent_id: "ghost", agent_type: "gp", tool_name: "Edit" }));
    expect(employee.interns.get("ghost")?.act).toBe("typing");
  });

  it("squire non-Pre events for an unknown agent are ignored", () => {
    const office = newOffice();
    const id = sid();
    const employee = seat(office, id);
    office.event(ev(id, "PostToolUse", { agent_id: "nope", tool_name: "Read" }));
    office.event(ev(id, "PermissionRequest", { agent_id: "nope" }));
    expect(employee.interns.size).toBe(0);
  });

  it("SubagentStop with an unknown agent_id does not throw or remove others", () => {
    const office = newOffice();
    const id = sid();
    const employee = seat(office, id);
    office.event(ev(id, "SubagentStart", { agent_id: "a1" }));
    expect(() => office.event(ev(id, "SubagentStop", { agent_id: "zzz" }))).not.toThrow();
    expect(employee.interns.has("a1")).toBe(true);
  });

  it("SubagentStop without agent_id removes the oldest squire", () => {
    const office = newOffice();
    const id = sid();
    const employee = seat(office, id);
    office.event(ev(id, "SubagentStart", { agent_id: "a1" }));
    office.event(ev(id, "SubagentStart", { agent_id: "a2" }));
    office.event(ev(id, "SubagentStop"));
    expect([...employee.interns.keys()]).toEqual(["a2"]);
    office.event(ev(id, "SubagentStop"));
    office.event(ev(id, "SubagentStop"));
    expect(employee.interns.size).toBe(0);
  });

  it("late events from a stopped squire do not resurrect it (30s), until SubagentStart again", () => {
    const office = newOffice();
    const id = sid();
    const employee = seat(office, id);
    office.event(ev(id, "SubagentStart", { agent_id: "a1" }));
    office.event(ev(id, "SubagentStop", { agent_id: "a1" }));
    office.event(ev(id, "PreToolUse", { agent_id: "a1", tool_name: "Read" }));
    expect(employee.interns.size).toBe(0);
    office.event(ev(id, "SubagentStart", { agent_id: "a1" }));
    office.event(ev(id, "PreToolUse", { agent_id: "a1", tool_name: "Read" }));
    expect(employee.interns.get("a1")?.act).toBe("reading");
    office.event(ev(id, "SubagentStop", { agent_id: "a1" }));
    vi.setSystemTime(Date.now() + 31_000);
    office.event(ev(id, "PreToolUse", { agent_id: "a1", tool_name: "Read" }));
    expect(employee.interns.size).toBe(1);
  });

  it("a stopped unknown agent id is tombstoned too", () => {
    const office = newOffice();
    const id = sid();
    const employee = seat(office, id);
    office.event(ev(id, "SubagentStop", { agent_id: "unk" }));
    office.event(ev(id, "PreToolUse", { agent_id: "unk", tool_name: "Read" }));
    expect(employee.interns.size).toBe(0);
  });

  it("squire events do not count toward idleness of nothing but still bump lastEventAt", () => {
    const office = newOffice();
    const id = sid();
    const employee = seat(office, id);
    employee.lastEventAt = -100;
    office.event(ev(id, "SubagentStart", { agent_id: "a1" }));
    expect(employee.lastEventAt).toBe(office.clock);
  });

  it("squires are cleared when the master leaves", () => {
    const office = newOffice();
    const id = sid();
    const employee = seat(office, id);
    office.event(ev(id, "SubagentStart", { agent_id: "a1" }));
    office.event(ev(id, "SessionEnd"));
    expect(employee.interns.size).toBe(0);
  });

  it("squire events for a session never seen spawn the master", () => {
    const office = newOffice();
    const id = sid();
    office.event(ev(id, "SubagentStart", { agent_id: "a1" }));
    expect(office.employees.has(id)).toBe(true);
    expect(emp(office, id).interns.has("a1")).toBe(true);
  });
});
