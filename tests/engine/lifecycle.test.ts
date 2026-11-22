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
    const o = newOffice();
    o.event(null as never);
    o.event({});
    o.event({ hook_event_name: "SessionStart" });
    expect(o.employees.size).toBe(0);
  });

  it("SessionStart enters through the door then sits at a desk", () => {
    const o = newOffice();
    const id = sid();
    o.event(ev(id, "SessionStart", { cwd: "/a/b/myproj" }));
    const e = emp(o, id);
    expect(e.state).toBe("ENTERING");
    expect(e.project).toBe("myproj");
    expect(e.deskIdx).toBe(0);
    seat(o, id);
    expect(e.state).toBe("SEATED");
    expect(e.monPos).not.toBeNull();
  });

  it("a duplicate SessionStart for a seated session is a no-op", () => {
    const o = newOffice();
    const id = sid();
    const e = seat(o, id);
    o.event(ev(id, "SessionStart"));
    expect(o.employees.size).toBe(1);
    expect(e.state).toBe("SEATED");
  });

  it("SessionEnd walks out and removes the employee, freeing the desk", () => {
    const o = newOffice();
    const id = sid();
    seat(o, id);
    o.event(ev(id, "SessionEnd", { reason: "other" }));
    expect(emp(o, id).state).toBe("LEAVING");
    expect(emp(o, id).deskIdx).toBe(-1);
    tick(o, 30);
    expect(o.employees.has(id)).toBe(false);
  });

  it("duplicate SessionEnd is harmless", () => {
    const o = newOffice();
    const id = sid();
    seat(o, id);
    o.event(ev(id, "SessionEnd"));
    o.event(ev(id, "SessionEnd"));
    tick(o, 30);
    o.event(ev(id, "SessionEnd")); // after removal too
    expect(o.employees.size).toBe(0);
  });

  it("SessionEnd for a never-seen session does not spawn anyone", () => {
    const o = newOffice();
    o.event(ev(sid(), "SessionEnd"));
    expect(o.employees.size).toBe(0);
  });

  it("tombstone: late events after SessionEnd are dropped for 30s, then accepted", () => {
    const o = newOffice();
    const id = sid();
    seat(o, id);
    o.event(ev(id, "SessionEnd"));
    tick(o, 30);
    o.event(ev(id, "PreToolUse", { tool_name: "Read" }));
    expect(o.employees.has(id)).toBe(false);
    vi.setSystemTime(Date.now() + 31_000);
    o.event(ev(id, "PreToolUse", { tool_name: "Read" }));
    expect(o.employees.has(id)).toBe(true);
  });

  it("SessionStart clears the tombstone immediately", () => {
    const o = newOffice();
    const id = sid();
    seat(o, id);
    o.event(ev(id, "SessionEnd"));
    tick(o, 30);
    o.event(ev(id, "SessionStart"));
    expect(o.employees.has(id)).toBe(true);
  });

  it("resume while walking out: SessionStart turns them around and they re-enter", () => {
    const o = newOffice();
    const id = sid();
    seat(o, id);
    o.event(ev(id, "SessionEnd"));
    tick(o, 0.2);
    expect(emp(o, id).state).toBe("LEAVING");
    o.event(ev(id, "SessionStart"));
    expect(emp(o, id).returning).toBe(true);
    tick(o, 40);
    const e = emp(o, id);
    expect(e.state).toBe("SEATED");
    expect(e.deskIdx).toBeGreaterThanOrEqual(0);
  });

  it("a non-start event for a leaving session (not tombstoned) also flags return", () => {
    const o = newOffice();
    const id = sid();
    seat(o, id);
    // idle timeout leaves without a tombstone
    for (let i = 0; i < 700 && !o.employees.has(id) === false && emp(o, id).state !== "LEAVING"; i++) tick(o, 1, 1);
    expect(emp(o, id).state).toBe("LEAVING");
    o.event(ev(id, "UserPromptSubmit"));
    expect(emp(o, id).returning).toBe(true);
  });

  it("idle for ~10 minutes sends the adventurer home", () => {
    const o = newOffice();
    const id = sid();
    seat(o, id);
    const e = emp(o, id);
    e.lastEventAt = o.clock;
    tick(o, 590, 1);
    expect(e.state).toBe("SEATED");
    tick(o, 20, 1);
    expect(e.state).toBe("LEAVING");
  });

  it("waiting on a permission prompt is never idle", () => {
    const o = newOffice();
    const id = sid();
    seat(o, id);
    o.event(ev(id, "PermissionRequest", { tool_name: "Bash" }));
    tick(o, 700, 1);
    expect(emp(o, id).state).toBe("SEATED");
    expect(emp(o, id).act).toBe("handup");
  });

  it("events before the adventurer is seated are queued and replayed (cap 5)", () => {
    const o = newOffice();
    const id = sid();
    o.event(ev(id, "SessionStart"));
    for (let i = 0; i < 8; i++) o.event(ev(id, "PreToolUse", { tool_name: "Read", tool_use_id: "t" + i }));
    expect(emp(o, id).queue.length).toBe(5);
    seat(o, id);
    expect(emp(o, id).act).toBe("reading");
    expect(emp(o, id).queue.length).toBe(0);
  });

  it("maps tools to acts", () => {
    const o = newOffice();
    const id = sid();
    const e = seat(o, id);
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
      o.event(ev(id, "PreToolUse", { tool_name: tool, tool_use_id: "k" + tool }));
      expect(e.act).toBe(act);
      o.event(ev(id, "PostToolUse", { tool_name: tool, tool_use_id: "k" + tool }));
      expect(e.act).toBe("thinking");
    }
  });

  it("permission Notification raises a hand; idle_prompt sets the idle note", () => {
    const o = newOffice();
    const id = sid();
    const e = seat(o, id);
    o.event(ev(id, "Notification", { notification_type: "permission_prompt" }));
    expect(e.act).toBe("handup");
    expect(o.getView().roster[0].act).toBe("handup");
    o.event(ev(id, "PreToolUse", { tool_name: "Read" }));
    expect(e.act).toBe("reading");
    o.event(ev(id, "Notification", { notification_type: "idle_prompt" }));
    expect(e.note).toBe("idle");
    o.event(ev(id, "Notification", { message: "Claude needs your permission to use Bash" }));
    expect(e.act).toBe("handup");
  });

  it("log: PostToolUse is not logged, newest first, capped at 100", () => {
    const o = newOffice();
    const id = sid();
    seat(o, id);
    o.event(ev(id, "PreToolUse", { tool_name: "Read", tool_input: { file_path: "/x/y/foo.ts" } }));
    o.event(ev(id, "PostToolUse", { tool_name: "Read" }));
    const v = o.getView();
    expect(v.log[0].detail).toBe("foo.ts");
    expect(v.log.some((l) => l.kind === "PostToolUse")).toBe(false);
    for (let i = 0; i < 150; i++) o.event(ev(id, "UserPromptSubmit"));
    expect(o.getView().log.length).toBe(100);
  });
});

describe("Stop -> tavern -> back", () => {
  it("stretches, walks to the tavern, drinks, and returns seated", () => {
    const o = newOffice();
    const id = sid();
    const e = seat(o, id);
    o.event(ev(id, "Stop"));
    expect(e.state).toBe("STRETCH");
    tick(o, 1.3);
    expect(e.state).toBe("TO_COFFEE");
    const seen = new Set<string>();
    for (let i = 0; i < 400 && e.state !== "SEATED"; i++) {
      tick(o, 0.1);
      seen.add(e.state);
    }
    expect(seen.has("DRINK")).toBe(true);
    expect(seen.has("FROM_COFFEE")).toBe(true);
    expect(e.state).toBe("SEATED");
  });

  it("an event during STRETCH snaps back to seated and applies it", () => {
    const o = newOffice();
    const id = sid();
    const e = seat(o, id);
    o.event(ev(id, "Stop"));
    o.event(ev(id, "PreToolUse", { tool_name: "Bash" }));
    expect(e.state).toBe("SEATED");
    expect(e.act).toBe("bash");
  });

  it.each([
    ["TO_COFFEE", 1.5],
    ["DRINK", null],
  ] as const)("an event during %s turns around and is applied on return", (st, t) => {
    const o = newOffice();
    const id = sid();
    const e = seat(o, id);
    o.event(ev(id, "Stop"));
    if (t) tick(o, t);
    else for (let i = 0; i < 400 && e.state !== "DRINK"; i++) tick(o, 0.1);
    expect(e.state).toBe(st);
    o.event(ev(id, "PreToolUse", { tool_name: "Edit" }));
    expect(e.state).toBe("FROM_COFFEE");
    expect(e.queue.length).toBe(1);
    for (let i = 0; i < 400 && e.state !== "SEATED"; i++) tick(o, 0.1);
    expect(e.state).toBe("SEATED");
    expect(e.act).toBe("typing");
  });

  it("Stop on a seated session with several queued events only goes for coffee after the last", () => {
    const o = newOffice();
    const id = sid();
    o.event(ev(id, "SessionStart"));
    o.event(ev(id, "Stop"));
    o.event(ev(id, "Stop"));
    for (let i = 0; i < 400 && emp(o, id).state === "ENTERING"; i++) tick(o, 0.1);
    expect(emp(o, id).state).toBe("STRETCH");
  });
});

describe("overflow beyond 8 desks", () => {
  function fill(o: ReturnType<typeof newOffice>, n: number) {
    const ids = Array.from({ length: n }, () => sid());
    for (const id of ids) o.event(ev(id, "SessionStart"));
    tick(o, 40);
    return ids;
  }

  it("the 9th and 10th go to camp slots 0 and 1", () => {
    const o = newOffice();
    const ids = fill(o, DESK_COUNT + 2);
    const desks = ids.map((i) => emp(o, i).deskIdx);
    expect(desks.slice(0, DESK_COUNT)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    expect(desks.slice(DESK_COUNT)).toEqual([-1, -1]);
    expect(emp(o, ids[8]).slot).toBe(0);
    expect(emp(o, ids[9]).slot).toBe(1);
    expect(emp(o, ids[8]).monPos).toBeNull();
    expect(emp(o, ids[8]).state).toBe("SEATED");
  });

  it("camp members never fight (no monster damage, but xp)", () => {
    const o = newOffice();
    const ids = fill(o, DESK_COUNT + 1);
    const camp = emp(o, ids[8]);
    o.event(ev(camp.id, "PreToolUse", { tool_name: "Bash", tool_use_id: "a" }));
    o.event(ev(camp.id, "PostToolUse", { tool_name: "Bash", tool_use_id: "a" }));
    expect(camp.kills).toBe(0);
    expect(camp.xp).toBe(2);
  });

  it("when a desk frees, the longest-waiting camper is promoted to it", () => {
    const o = newOffice();
    const ids = fill(o, DESK_COUNT + 2);
    o.event(ev(ids[3], "SessionEnd"));
    tick(o, 0.1);
    const a = emp(o, ids[8]);
    const b = emp(o, ids[9]);
    expect(a.deskIdx).toBe(3);
    expect(a.slot).toBe(-1);
    expect(a.state).toBe("FROM_COFFEE");
    expect(b.deskIdx).toBe(-1);
    tick(o, 30);
    expect(a.state).toBe("SEATED");
    expect(a.monPos).not.toBeNull();
    expect(b.deskIdx).toBe(-1);
  });

  it("a promoted camper's in-flight tools are cleared (no ghost boss)", () => {
    const o = newOffice();
    const ids = fill(o, DESK_COUNT + 1);
    const a = emp(o, ids[8]);
    o.event(ev(a.id, "PreToolUse", { tool_name: "Bash", tool_use_id: "z" }));
    o.event(ev(ids[0], "SessionEnd"));
    tick(o, 60);
    expect(a.boss).toBeNull();
    expect(a.pending.size).toBe(0);
  });

  it("two campers get promoted as two desks free", () => {
    const o = newOffice();
    const ids = fill(o, DESK_COUNT + 2);
    o.event(ev(ids[0], "SessionEnd"));
    o.event(ev(ids[1], "SessionEnd"));
    tick(o, 5);
    expect(emp(o, ids[8]).deskIdx).toBe(0);
    expect(emp(o, ids[9]).deskIdx).toBe(1);
  });

  it("new arrival after promotion takes the freed camp-or-desk slot without collisions", () => {
    const o = newOffice();
    const ids = fill(o, DESK_COUNT + 1);
    o.event(ev(ids[2], "SessionEnd"));
    tick(o, 40);
    const extra = sid();
    o.event(ev(extra, "SessionStart"));
    tick(o, 40);
    const desks = [...o.employees.values()].map((e) => e.deskIdx).filter((d) => d >= 0);
    expect(new Set(desks).size).toBe(desks.length);
    expect(emp(o, extra).deskIdx).toBe(-1);
  });
});

describe("snapshot reconcile", () => {
  it("restores the permission wait (handup) from snapshot.waiting after a reload", () => {
    const o = newOffice();
    const a = sid(),
      b = sid();
    o.loadSnapshot({
      sessions: [
        { session_id: a, cwd: "/p/one", waiting: true },
        { session_id: b, cwd: "/p/two" },
      ],
    });
    expect(emp(o, a).act).toBe("handup");
    expect(emp(o, b).act).not.toBe("handup");
    expect(o.waitingIds()).toContain(a);
  });

  it("spawns snapshot sessions already seated, with their squires", () => {
    const o = newOffice();
    const a = sid(),
      b = sid();
    o.loadSnapshot({
      sessions: [
        { session_id: a, cwd: "/p/one", interns: ["ag1", "ag2"] },
        { session_id: b, cwd: "/p/two" },
      ],
    });
    expect(emp(o, a).state).toBe("SEATED");
    expect(emp(o, a).interns.size).toBe(2);
    expect(emp(o, b).project).toBe("two");
  });

  it("repeating a snapshot does not double count gold/kills/treasury", () => {
    stubStorage({ "guild.progress.v1": JSON.stringify({ sessions: {}, treasury: 50 }) });
    const o = newOffice();
    const a = sid();
    o.loadSnapshot({ sessions: [{ session_id: a, cwd: "/p" }] });
    tick(o, 1);
    const e = emp(o, a);
    e.monHp = 1;
    o.event(ev(a, "PostToolUse", { tool_name: "Read" }));
    const gold = e.gold,
      kills = e.kills,
      tr = o.treasury;
    expect(kills).toBe(1);
    expect(tr).toBe(50 + gold);
    for (let i = 0; i < 3; i++) o.loadSnapshot({ sessions: [{ session_id: a, cwd: "/p" }] });
    expect(e.gold).toBe(gold);
    expect(e.kills).toBe(kills);
    expect(o.treasury).toBe(tr);
  });

  it("restoring saved progress on spawn does not add to the treasury", () => {
    const a = sid();
    stubStorage({
      "guild.progress.v1": JSON.stringify({
        sessions: { [a]: { xp: 3, lv: 4, gold: 77, kills: 9, seen: Date.now() } },
        treasury: 100,
      }),
    });
    const o = newOffice();
    o.loadSnapshot({ sessions: [{ session_id: a }] });
    expect(emp(o, a).gold).toBe(77);
    expect(o.treasury).toBe(100);
  });

  it("sessions missing from the snapshot leave; sessions present are kept", () => {
    const o = newOffice();
    const a = sid(),
      b = sid();
    o.loadSnapshot({ sessions: [{ session_id: a }, { session_id: b }] });
    o.loadSnapshot({ sessions: [{ session_id: a }] });
    expect(emp(o, b).state).toBe("LEAVING");
    expect(emp(o, b).returning).toBe(false);
    expect(emp(o, a).state).toBe("SEATED");
    tick(o, 30);
    expect(o.employees.has(b)).toBe(false);
  });

  it("a snapshot revives a leaving session and clears its tombstone", () => {
    const o = newOffice();
    const a = sid();
    seat(o, a);
    o.event(ev(a, "SessionEnd"));
    o.loadSnapshot({ sessions: [{ session_id: a }] });
    expect(emp(o, a).returning).toBe(true);
    o.event(ev(a, "PreToolUse", { tool_name: "Read" })); // tombstone cleared
    tick(o, 40);
    expect(emp(o, a).state).toBe("SEATED");
  });

  it("reconciles squires to the snapshot's list", () => {
    const o = newOffice();
    const a = sid();
    o.loadSnapshot({ sessions: [{ session_id: a, interns: ["x", "y"] }] });
    o.loadSnapshot({ sessions: [{ session_id: a, interns: ["y", "z"] }] });
    expect([...emp(o, a).interns.keys()].sort()).toEqual(["y", "z"]);
  });

  it("seeds the log from snapshot events only when the log is empty", () => {
    const o = newOffice();
    const a = sid();
    const events = [ev(a, "UserPromptSubmit"), ev(a, "Stop")];
    o.loadSnapshot({ sessions: [{ session_id: a }], events });
    expect(o.getView().log.length).toBe(2);
    o.loadSnapshot({ sessions: [{ session_id: a }], events });
    expect(o.getView().log.length).toBe(2);
  });
});
