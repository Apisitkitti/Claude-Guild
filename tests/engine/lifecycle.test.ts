import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DESK_COUNT } from "@/lib/office/layout";

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

describe("lifecycle", () => {
  it("ignores junk events", () => {
    const office = newOffice();
    office.event(null as never);
    office.event({});
    office.event({ hook_event_name: "SessionStart" });
    expect(office.employees.size).toBe(0);
  });

  it("SessionStart enters through the door then sits at a desk", () => {
    const office = newOffice();
    const id = sid();
    office.event(ev(id, "SessionStart", { cwd: "/a/b/myproj" }));
    const employee = emp(office, id);
    expect(employee.state).toBe("ENTERING");
    expect(employee.project).toBe("myproj");
    expect(employee.deskIdx).toBe(0);
    seat(office, id);
    expect(employee.state).toBe("SEATED");
    expect(employee.monPos).not.toBeNull();
  });

  it("a duplicate SessionStart for a seated session is a no-op", () => {
    const office = newOffice();
    const id = sid();
    const employee = seat(office, id);
    office.event(ev(id, "SessionStart"));
    expect(office.employees.size).toBe(1);
    expect(employee.state).toBe("SEATED");
  });

  it("SessionEnd walks out and removes the employee, freeing the desk", () => {
    const office = newOffice();
    const id = sid();
    seat(office, id);
    office.event(ev(id, "SessionEnd", { reason: "other" }));
    expect(emp(office, id).state).toBe("LEAVING");
    expect(emp(office, id).deskIdx).toBe(-1);
    tick(office, 30);
    expect(office.employees.has(id)).toBe(false);
  });

  it("duplicate SessionEnd is harmless", () => {
    const office = newOffice();
    const id = sid();
    seat(office, id);
    office.event(ev(id, "SessionEnd"));
    office.event(ev(id, "SessionEnd"));
    tick(office, 30);
    office.event(ev(id, "SessionEnd")); // after removal too
    expect(office.employees.size).toBe(0);
  });

  it("SessionEnd for a never-seen session does not spawn anyone", () => {
    const office = newOffice();
    office.event(ev(sid(), "SessionEnd"));
    expect(office.employees.size).toBe(0);
  });

  it("tombstone: late events after SessionEnd are dropped for 30s, then accepted", () => {
    const office = newOffice();
    const id = sid();
    seat(office, id);
    office.event(ev(id, "SessionEnd"));
    tick(office, 30);
    office.event(ev(id, "PreToolUse", { tool_name: "Read" }));
    expect(office.employees.has(id)).toBe(false);
    vi.setSystemTime(Date.now() + 31_000);
    office.event(ev(id, "PreToolUse", { tool_name: "Read" }));
    expect(office.employees.has(id)).toBe(true);
  });

  it("SessionStart clears the tombstone immediately", () => {
    const office = newOffice();
    const id = sid();
    seat(office, id);
    office.event(ev(id, "SessionEnd"));
    tick(office, 30);
    office.event(ev(id, "SessionStart"));
    expect(office.employees.has(id)).toBe(true);
  });

  it("resume while walking out: SessionStart turns them around and they re-enter", () => {
    const office = newOffice();
    const id = sid();
    seat(office, id);
    office.event(ev(id, "SessionEnd"));
    tick(office, 0.2);
    expect(emp(office, id).state).toBe("LEAVING");
    office.event(ev(id, "SessionStart"));
    expect(emp(office, id).returning).toBe(true);
    tick(office, 40);
    const employee = emp(office, id);
    expect(employee.state).toBe("SEATED");
    expect(employee.deskIdx).toBeGreaterThanOrEqual(0);
  });

  it("a non-start event for a leaving session (not tombstoned) also flags return", () => {
    const office = newOffice();
    const id = sid();
    seat(office, id);
    // idle timeout leaves without a tombstone
    for (let i = 0; i < 700 && !office.employees.has(id) === false && emp(office, id).state !== "LEAVING"; i++)
      tick(office, 1, 1);
    expect(emp(office, id).state).toBe("LEAVING");
    office.event(ev(id, "UserPromptSubmit"));
    expect(emp(office, id).returning).toBe(true);
  });

  it("idle for ~10 minutes sends the adventurer home", () => {
    const office = newOffice();
    const id = sid();
    seat(office, id);
    const employee = emp(office, id);
    employee.lastEventAt = office.clock;
    tick(office, 590, 1);
    expect(employee.state).toBe("SEATED");
    tick(office, 20, 1);
    expect(employee.state).toBe("LEAVING");
  });

  it("waiting on a permission prompt is never idle", () => {
    const office = newOffice();
    const id = sid();
    seat(office, id);
    office.event(ev(id, "PermissionRequest", { tool_name: "Bash" }));
    tick(office, 700, 1);
    expect(emp(office, id).state).toBe("SEATED");
    expect(emp(office, id).act).toBe("handup");
  });

  it("events before the adventurer is seated are queued and replayed (cap 5)", () => {
    const office = newOffice();
    const id = sid();
    office.event(ev(id, "SessionStart"));
    for (let i = 0; i < 8; i++) office.event(ev(id, "PreToolUse", { tool_name: "Read", tool_use_id: "t" + i }));
    expect(emp(office, id).queue.length).toBe(5);
    seat(office, id);
    expect(emp(office, id).act).toBe("reading");
    expect(emp(office, id).queue.length).toBe(0);
  });

  it("maps tools to acts", () => {
    const office = newOffice();
    const id = sid();
    const employee = seat(office, id);
    const cases: [string, string][] = [
      ["Read", "reading"],
      ["Grep", "reading"],
      ["Edit", "typing"],
      ["Bash", "bash"],
      ["WebSearch", "phone"],
      ["mcp__x__y", "mcp"],
      ["TodoWrite", "sticky"],
      ["Whatever", "typing"],
    ];
    for (const [tool, act] of cases) {
      office.event(ev(id, "PreToolUse", { tool_name: tool, tool_use_id: "k" + tool }));
      expect(employee.act).toBe(act);
      office.event(ev(id, "PostToolUse", { tool_name: tool, tool_use_id: "k" + tool }));
      expect(employee.act).toBe("thinking");
    }
  });

  it("permission Notification raises a hand; idle_prompt sets the idle note", () => {
    const office = newOffice();
    const id = sid();
    const employee = seat(office, id);
    office.event(ev(id, "Notification", { notification_type: "permission_prompt" }));
    expect(employee.act).toBe("handup");
    expect(office.getView().roster[0].act).toBe("handup");
    office.event(ev(id, "PreToolUse", { tool_name: "Read" }));
    expect(employee.act).toBe("reading");
    office.event(ev(id, "Notification", { notification_type: "idle_prompt" }));
    expect(employee.note).toBe("idle");
    office.event(ev(id, "Notification", { message: "Claude needs your permission to use Bash" }));
    expect(employee.act).toBe("handup");
  });

  it("log: PostToolUse is not logged, newest first, capped at 100", () => {
    const office = newOffice();
    const id = sid();
    seat(office, id);
    office.event(ev(id, "PreToolUse", { tool_name: "Read", tool_input: { file_path: "/x/y/foo.ts" } }));
    office.event(ev(id, "PostToolUse", { tool_name: "Read" }));
    const view = office.getView();
    expect(view.log[0].detail).toBe("foo.ts");
    expect(view.log.some((entry) => entry.kind === "PostToolUse")).toBe(false);
    for (let i = 0; i < 150; i++) office.event(ev(id, "UserPromptSubmit"));
    expect(office.getView().log.length).toBe(100);
  });
});

describe("Stop -> tavern -> back", () => {
  it("stretches, walks to the tavern, drinks, and returns seated", () => {
    const office = newOffice();
    const id = sid();
    const employee = seat(office, id);
    office.event(ev(id, "Stop"));
    expect(employee.state).toBe("STRETCH");
    tick(office, 1.3);
    expect(employee.state).toBe("TO_COFFEE");
    const seen = new Set<string>();
    for (let i = 0; i < 400 && employee.state !== "SEATED"; i++) {
      tick(office, 0.1);
      seen.add(employee.state);
    }
    expect(seen.has("DRINK")).toBe(true);
    expect(seen.has("FROM_COFFEE")).toBe(true);
    expect(employee.state).toBe("SEATED");
  });

  it("an event during STRETCH snaps back to seated and applies it", () => {
    const office = newOffice();
    const id = sid();
    const employee = seat(office, id);
    office.event(ev(id, "Stop"));
    office.event(ev(id, "PreToolUse", { tool_name: "Bash" }));
    expect(employee.state).toBe("SEATED");
    expect(employee.act).toBe("bash");
  });

  it.each([
    ["TO_COFFEE", 1.5],
    ["DRINK", null],
  ] as const)("an event during %s turns around and is applied on return", (st, target) => {
    const office = newOffice();
    const id = sid();
    const employee = seat(office, id);
    office.event(ev(id, "Stop"));
    if (target) tick(office, target);
    else for (let i = 0; i < 400 && employee.state !== "DRINK"; i++) tick(office, 0.1);
    expect(employee.state).toBe(st);
    office.event(ev(id, "PreToolUse", { tool_name: "Edit" }));
    expect(employee.state).toBe("FROM_COFFEE");
    expect(employee.queue.length).toBe(1);
    for (let i = 0; i < 400 && employee.state !== "SEATED"; i++) tick(office, 0.1);
    expect(employee.state).toBe("SEATED");
    expect(employee.act).toBe("typing");
  });

  it("Stop on a seated session with several queued events only goes for coffee after the last", () => {
    const office = newOffice();
    const id = sid();
    office.event(ev(id, "SessionStart"));
    office.event(ev(id, "Stop"));
    office.event(ev(id, "Stop"));
    for (let i = 0; i < 400 && emp(office, id).state === "ENTERING"; i++) tick(office, 0.1);
    expect(emp(office, id).state).toBe("STRETCH");
  });
});

describe("overflow beyond 8 desks", () => {
  const fill = (office: ReturnType<typeof newOffice>, count: number) => {
    const ids = Array.from({ length: count }, () => sid());
    for (const id of ids) office.event(ev(id, "SessionStart"));
    tick(office, 40);
    return ids;
  };

  it("the 9th and 10th go to camp slots 0 and 1", () => {
    const office = newOffice();
    const ids = fill(office, DESK_COUNT + 2);
    const desks = ids.map((i) => emp(office, i).deskIdx);
    expect(desks.slice(0, DESK_COUNT)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    expect(desks.slice(DESK_COUNT)).toEqual([-1, -1]);
    expect(emp(office, ids[8]).slot).toBe(0);
    expect(emp(office, ids[9]).slot).toBe(1);
    expect(emp(office, ids[8]).monPos).toBeNull();
    expect(emp(office, ids[8]).state).toBe("SEATED");
  });

  it("raiders have no field monster (xp only; their foe lives in the dungeon)", () => {
    const office = newOffice();
    const ids = fill(office, DESK_COUNT + 1);
    const camp = emp(office, ids[8]);
    office.event(ev(camp.id, "PreToolUse", { tool_name: "Bash", tool_use_id: "a" }));
    office.event(ev(camp.id, "PostToolUse", { tool_name: "Bash", tool_use_id: "a" }));
    expect(camp.monPos).toBeNull();
    expect(camp.xp).toBe(2);
  });

  it("when a desk frees, the longest-waiting camper is promoted to it", () => {
    const office = newOffice();
    const ids = fill(office, DESK_COUNT + 2);
    office.event(ev(ids[3], "SessionEnd"));
    tick(office, 0.1);
    const employeeA = emp(office, ids[8]);
    const employeeB = emp(office, ids[9]);
    expect(employeeA.deskIdx).toBe(3);
    expect(employeeA.slot).toBe(-1);
    expect(employeeA.state).toBe("FROM_COFFEE");
    expect(employeeB.deskIdx).toBe(-1);
    tick(office, 30);
    expect(employeeA.state).toBe("SEATED");
    expect(employeeA.monPos).not.toBeNull();
    expect(employeeB.deskIdx).toBe(-1);
  });

  it("a promoted camper's in-flight tools are cleared (no ghost boss)", () => {
    const office = newOffice();
    const ids = fill(office, DESK_COUNT + 1);
    const employeeA = emp(office, ids[8]);
    office.event(ev(employeeA.id, "PreToolUse", { tool_name: "Bash", tool_use_id: "z" }));
    office.event(ev(ids[0], "SessionEnd"));
    tick(office, 60);
    expect(employeeA.boss).toBeNull();
    expect(employeeA.pending.size).toBe(0);
  });

  it("two campers get promoted as two desks free", () => {
    const office = newOffice();
    const ids = fill(office, DESK_COUNT + 2);
    office.event(ev(ids[0], "SessionEnd"));
    office.event(ev(ids[1], "SessionEnd"));
    tick(office, 5);
    expect(emp(office, ids[8]).deskIdx).toBe(0);
    expect(emp(office, ids[9]).deskIdx).toBe(1);
  });

  it("new arrival after promotion takes the freed camp-or-desk slot without collisions", () => {
    const office = newOffice();
    const ids = fill(office, DESK_COUNT + 1);
    office.event(ev(ids[2], "SessionEnd"));
    tick(office, 40);
    const extra = sid();
    office.event(ev(extra, "SessionStart"));
    tick(office, 40);
    const desks = [...office.employees.values()].map((employee) => employee.deskIdx).filter((desk) => desk >= 0);
    expect(new Set(desks).size).toBe(desks.length);
    expect(emp(office, extra).deskIdx).toBe(-1);
  });
});

describe("snapshot reconcile", () => {
  it("restores the permission wait (handup) from snapshot.waiting after a reload", () => {
    const office = newOffice();
    const sessionA = sid(),
      sessionB = sid();
    office.loadSnapshot({
      sessions: [
        { session_id: sessionA, cwd: "/p/one", waiting: true },
        { session_id: sessionB, cwd: "/p/two" },
      ],
    });
    expect(emp(office, sessionA).act).toBe("handup");
    expect(emp(office, sessionB).act).not.toBe("handup");
    expect(office.waitingIds()).toContain(sessionA);
  });

  it("spawns snapshot sessions already seated, with their squires", () => {
    const office = newOffice();
    const sessionA = sid(),
      sessionB = sid();
    office.loadSnapshot({
      sessions: [
        { session_id: sessionA, cwd: "/p/one", interns: ["ag1", "ag2"] },
        { session_id: sessionB, cwd: "/p/two" },
      ],
    });
    expect(emp(office, sessionA).state).toBe("SEATED");
    expect(emp(office, sessionA).interns.size).toBe(2);
    expect(emp(office, sessionB).project).toBe("two");
  });

  it("repeating a snapshot does not double count gold/kills/treasury", () => {
    stubStorage({ "guild.progress.v1": JSON.stringify({ sessions: {}, treasury: 50 }) });
    const office = newOffice();
    const sessionA = sid();
    office.loadSnapshot({ sessions: [{ session_id: sessionA, cwd: "/p" }] });
    tick(office, 1);
    const employee = emp(office, sessionA);
    employee.monHp = 1;
    office.event(ev(sessionA, "PostToolUse", { tool_name: "Read" }));
    const gold = employee.gold,
      kills = employee.kills,
      tr = office.treasury;
    expect(kills).toBe(1);
    expect(tr).toBe(50 + gold);
    for (let i = 0; i < 3; i++) office.loadSnapshot({ sessions: [{ session_id: sessionA, cwd: "/p" }] });
    expect(employee.gold).toBe(gold);
    expect(employee.kills).toBe(kills);
    expect(office.treasury).toBe(tr);
  });

  it("restoring saved progress on spawn does not add to the treasury", () => {
    const sessionA = sid();
    stubStorage({
      "guild.progress.v1": JSON.stringify({
        sessions: { [sessionA]: { xp: 3, lv: 4, gold: 77, kills: 9, seen: Date.now() } },
        treasury: 100,
      }),
    });
    const office = newOffice();
    office.loadSnapshot({ sessions: [{ session_id: sessionA }] });
    expect(emp(office, sessionA).gold).toBe(77);
    expect(office.treasury).toBe(100);
  });

  it("sessions missing from the snapshot leave; sessions present are kept", () => {
    const office = newOffice();
    const sessionA = sid(),
      sessionB = sid();
    office.loadSnapshot({ sessions: [{ session_id: sessionA }, { session_id: sessionB }] });
    office.loadSnapshot({ sessions: [{ session_id: sessionA }] });
    expect(emp(office, sessionB).state).toBe("LEAVING");
    expect(emp(office, sessionB).returning).toBe(false);
    expect(emp(office, sessionA).state).toBe("SEATED");
    tick(office, 30);
    expect(office.employees.has(sessionB)).toBe(false);
  });

  it("a snapshot revives a leaving session and clears its tombstone", () => {
    const office = newOffice();
    const sessionA = sid();
    seat(office, sessionA);
    office.event(ev(sessionA, "SessionEnd"));
    office.loadSnapshot({ sessions: [{ session_id: sessionA }] });
    expect(emp(office, sessionA).returning).toBe(true);
    office.event(ev(sessionA, "PreToolUse", { tool_name: "Read" })); // tombstone cleared
    tick(office, 40);
    expect(emp(office, sessionA).state).toBe("SEATED");
  });

  it("reconciles squires to the snapshot's list", () => {
    const office = newOffice();
    const sessionA = sid();
    office.loadSnapshot({ sessions: [{ session_id: sessionA, interns: ["x", "y"] }] });
    office.loadSnapshot({ sessions: [{ session_id: sessionA, interns: ["y", "z"] }] });
    expect([...emp(office, sessionA).interns.keys()].sort()).toEqual(["y", "z"]);
  });

  it("seeds the log from snapshot events only when the log is empty", () => {
    const office = newOffice();
    const sessionA = sid();
    const events = [ev(sessionA, "UserPromptSubmit"), ev(sessionA, "Stop")];
    office.loadSnapshot({ sessions: [{ session_id: sessionA }], events });
    expect(office.getView().log.length).toBe(2);
    office.loadSnapshot({ sessions: [{ session_id: sessionA }], events });
    expect(office.getView().log.length).toBe(2);
  });
});
