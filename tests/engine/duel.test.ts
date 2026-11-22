import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { TerritoryMsg } from "@/lib/office/engine";
import {
  DUEL_EXCHANGES,
  DUEL_EX,
  DUEL_FIGHT,
  DUEL_FINAL,
  DUEL_FINAL_AT,
  DUEL_FLOURISH,
  DUEL_FLOURISH_LEN,
  DUEL_IMPACT,
  DUEL_INTRO,
  DUEL_KNOCK,
  DUEL_KNOCK_KO,
  DUEL_DASH,
  DUEL_PIPS,
  duelExchangeAt,
  duelScript,
  newDuelScript,
  type Duel,
} from "@/lib/office/engine";
import { DUEL_HALF, HALL_W, WORLD_W, SPOT_COLS, SPOT_ROWS, duelMidOfDesks } from "@/lib/office/layout";

import { emp, ev, newOffice, seat, sid, stubStorage, tick } from "./helpers";

beforeEach(() => {
  vi.useFakeTimers();
  stubStorage();
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const msg = (sessionA: string, sessionB: string, level: "overlap" | "clash", file = "src/a.ts"): TerritoryMsg => ({
  claims: [
    { sid: sessionA, files: [file, "x.ts"] },
    { sid: sessionB, files: [file] },
  ],
  conflicts: [{ file, sids: [sessionA, sessionB], level, since: 1 }],
});

const two = () => {
  const office = newOffice();
  const sessionA = sid(),
    sessionB = sid();
  seat(office, sessionA, { cwd: "/w/alpha" });
  seat(office, sessionB, { cwd: "/w/beta" });
  return { o: office, a: sessionA, b: sessionB };
};

describe("territory duel", () => {
  it("starts on a NEW clash: both walk (DUEL), fight, then return to SEATED at their spots", () => {
    const { o, a, b } = two();
    const sa = { x: emp(o, a).x, y: emp(o, a).y },
      sb = { x: emp(o, b).x, y: emp(o, b).y };
    o.setTerritory(msg(a, b, "overlap"));
    expect(o.duels).toHaveLength(0); // overlap alone never duels
    o.setTerritory(msg(a, b, "clash"));
    expect(o.duels).toHaveLength(1);
    expect(emp(o, a).state).toBe("DUEL");
    expect(emp(o, b).state).toBe("DUEL");
    expect(o.getView().roster.find((row) => row.id === a)).toBeTruthy();
    tick(o, 2.5);
    expect(o.duels[0].phase).toBe("fight");
    expect(emp(o, a).facing * emp(o, b).facing).toBe(-1);
    tick(o, 5.5);
    tick(o, 5);
    expect(o.duels).toHaveLength(0);
    for (const [id, spot] of [
      [a, sa],
      [b, sb],
    ] as const) {
      const employee = emp(o, id);
      expect(employee.state).toBe("SEATED");
      expect(employee.duel).toBeNull();
      expect([employee.x, employee.y]).toEqual([spot.x, spot.y]);
    }
  });

  it("events during a walking duel are applied immediately (state only), none dropped, no walking", () => {
    const { o, a, b } = two();
    o.setTerritory(msg(a, b, "clash"));
    tick(o, 1);
    o.event(ev(a, "UserPromptSubmit"));
    for (let i = 0; i < 4; i++) {
      o.event(
        ev(a, "PreToolUse", { tool_name: "Edit", tool_input: { file_path: "/w/alpha/x.ts" }, tool_use_id: "t" + i }),
      );
      o.event(ev(a, "PostToolUse", { tool_name: "Edit", tool_use_id: "t" + i }));
    }
    o.event(
      ev(a, "PreToolUse", { tool_name: "Edit", tool_input: { file_path: "/w/alpha/x.ts" }, tool_use_id: "last" }),
    );
    expect(emp(o, a).state).toBe("DUEL");
    expect(emp(o, a).queue).toHaveLength(0);
    expect(emp(o, a).toolCalls).toBe(4);
    expect(emp(o, a).act).toBe("typing");
    expect(emp(o, a).pending.size).toBe(1);
    tick(o, 14);
    expect(emp(o, a).state).toBe("SEATED");
    expect(emp(o, a).act).toBe("typing");
  });

  it("a PermissionRequest during a duel aborts it at once so the hand shows; both walk home", () => {
    const { o, a, b } = two();
    o.setTerritory(msg(a, b, "clash"));
    tick(o, 2.5);
    expect(o.duels[0].phase).toBe("fight");
    o.event(ev(a, "PermissionRequest", { tool_name: "Bash" }));
    expect(emp(o, a).act).toBe("handup");
    o.update(0.05);
    expect(o.duels[0].phase).toBe("back");
    tick(o, 6);
    expect(o.duels).toHaveLength(0);
    expect(emp(o, a).state).toBe("SEATED");
    expect(emp(o, b).state).toBe("SEATED");
    expect(emp(o, a).act).toBe("handup");
  });

  it("a finished duel settles the clash (arena cleared); an aborted one does not; a new clash file shows again", () => {
    const { o, a, b } = two();
    const clash = { file: "src/a.ts", level: "clash" };
    o.setTerritory(msg(a, b, "clash"));
    tick(o, 4);
    expect(o.isSettled(clash)).toBe(false); // mid-fight
    tick(o, 12);
    expect(o.duels).toHaveLength(0);
    expect(o.isSettled(clash)).toBe(true);
    expect(o.conflictRows()).toHaveLength(1); // still listed in the panel, only the field art is cleared
    o.setTerritory(msg(a, b, "clash", "src/b.ts"));
    expect(o.isSettled({ file: "src/b.ts", level: "clash" })).toBe(false);
    expect(o.isSettled(clash)).toBe(false); // pruned once the old clash is gone

    const pair = two();
    pair.o.setTerritory(msg(pair.a, pair.b, "clash"));
    tick(pair.o, 2.5);
    pair.o.event(ev(pair.a, "PermissionRequest", { tool_name: "Bash" }));
    tick(pair.o, 8);
    expect(pair.o.duels).toHaveLength(0);
    expect(pair.o.isSettled(clash)).toBe(false);
  });

  it("Stop during a duel: finishes the duel, then goes to the tavern", () => {
    const { o, a, b } = two();
    o.setTerritory(msg(a, b, "clash"));
    tick(o, 1);
    o.event(ev(b, "Stop"));
    expect(emp(o, b).state).toBe("DUEL");
    expect(emp(o, b).coffeeAfter).toBe(true);
    const seen = new Set<string>();
    for (let i = 0; i < 400; i++) {
      o.update(0.05);
      seen.add(emp(o, b).state);
    }
    expect(seen.has("STRETCH") || seen.has("TO_COFFEE")).toBe(true);
    expect(seen.has("DRINK")).toBe(true);
    expect(o.duels).toHaveLength(0);
  });

  it("duellists keep a clear gap: sprites (16px) never overlap, even mid-lunge", () => {
    const { o, a, b } = two();
    o.setTerritory(msg(a, b, "clash"));
    tick(o, 3);
    expect(o.duels[0].phase).toBe("fight");
    expect(Math.abs(emp(o, a).x - emp(o, b).x)).toBeGreaterThanOrEqual(2 * 16 + 8);
  });

  it("hiding either duellist with the filter stands both down", () => {
    const { o, a, b } = two();
    o.setTerritory(msg(a, b, "clash"));
    tick(o, 3);
    o.setFilter({ query: "alpha" });
    expect(o.isHidden(emp(o, b)) || o.isHidden(emp(o, a))).toBe(true);
    o.update(0.05);
    expect(o.duels[0].phase).toBe("back");
    tick(o, 6);
    expect(o.duels).toHaveLength(0);
    expect(emp(o, a).state).toBe("SEATED");
    expect(emp(o, b).state).toBe("SEATED");
  });

  it("in-flight tools do not age into a boss while dueling", () => {
    const { o, a, b } = two();
    o.event(ev(a, "PreToolUse", { tool_name: "Bash", tool_use_id: "p1" }));
    o.setTerritory(msg(a, b, "clash"));
    for (let i = 0; i < 600 && o.duels.length; i++) o.update(0.05);
    expect(o.duels).toHaveLength(0);
    expect(emp(o, a).state).toBe("SEATED");
    expect(emp(o, a).boss).toBeNull();
    const t0 = emp(o, a).pending.get("p1")!;
    expect(o.clock - t0).toBeLessThan(2); // aged only outside the duel
  });

  it("reduced motion switched on mid-walk ends the walk gracefully", () => {
    const { o, a, b } = two();
    o.setTerritory(msg(a, b, "clash"));
    tick(o, 1);
    o.reducedMotion = true;
    o.update(0.05);
    expect(o.duels[0].phase).toBe("back");
    tick(o, 20);
    expect(o.duels).toHaveLength(0);
    expect(emp(o, a).state).toBe("SEATED");
    expect(emp(o, b).state).toBe("SEATED");
  });

  it("winner is the session whose edit did not fail", () => {
    const { o, a, b } = two();
    o.event(ev(b, "PostToolUseFailure", { tool_name: "Edit", tool_input: { file_path: "/w/beta/a.ts" } }));
    o.setTerritory(msg(a, b, "clash"));
    const duel = o.duels[0];
    const winnerId = duel.winner === 0 ? duel.l : duel.r;
    expect(winnerId).toBe(a);
  });

  it("server `failer` decides the winner even when the territory message arrives BEFORE the failure event", () => {
    for (const loser of [0, 1]) {
      const { o, a, b } = two();
      const message = msg(a, b, "clash");
      message.conflicts[0].failer = loser === 0 ? a : b;
      o.setTerritory(message); // no PostToolUseFailure seen yet
      o.event(
        ev(loser === 0 ? a : b, "PostToolUseFailure", { tool_name: "Edit", tool_input: { file_path: "/w/x/a.ts" } }),
      ); // arrives after
      const duel = o.duels[0];
      expect(duel.failer).toBe(loser === 0 ? a : b);
      expect(duel.winner === 0 ? duel.l : duel.r).toBe(loser === 0 ? b : a);
      tick(o, 3.5);
      expect(duel.winner === 0 ? duel.l : duel.r).toBe(loser === 0 ? b : a);
    }
  });

  it("without a server failer, a failure seen during the fight still decides the winner at the flourish", () => {
    const { o, a, b } = two();
    o.setTerritory(msg(a, b, "clash"));
    const duel = o.duels[0];
    const early = duel.winner === 0 ? duel.l : duel.r;
    o.event(ev(early, "PostToolUseFailure", { tool_name: "Edit", tool_input: { file_path: "/w/x/a.ts" } }));
    tick(o, 2.8 + 7.4);
    expect(duel.flourished).toBe(true);
    expect(duel.winner === 0 ? duel.l : duel.r).not.toBe(early);
  });

  it("rate limit: one duel per pair per 60s", () => {
    const { o, a, b } = two();
    o.setTerritory(msg(a, b, "clash", "f1.ts"));
    expect(o.duels).toHaveLength(1);
    tick(o, 14);
    expect(o.duels).toHaveLength(0);
    o.setTerritory(msg(a, b, "clash", "f2.ts")); // a different file = new clash, same pair, < 60s
    expect(o.duels).toHaveLength(0);
    tick(o, 60);
    o.setTerritory(msg(a, b, "clash", "f3.ts"));
    expect(o.duels).toHaveLength(1);
  });

  it("at most 2 duels at once, and nobody is in two", () => {
    const office = newOffice();
    const ids = [sid(), sid(), sid(), sid(), sid(), sid()];
    for (const id of ids) seat(office, id);
    office.setTerritory({
      claims: [],
      conflicts: [
        { file: "a.ts", sids: [ids[0], ids[1]], level: "clash", since: 1 },
        { file: "b.ts", sids: [ids[2], ids[3]], level: "clash", since: 1 },
        { file: "c.ts", sids: [ids[4], ids[5]], level: "clash", since: 1 },
      ],
    });
    expect(office.duels).toHaveLength(2);
    const inDuel = office.duels.flatMap((duel) => [duel.l, duel.r]);
    expect(new Set(inDuel).size).toBe(4);
  });

  it("reduced motion: no walking, static duel with a VS badge that expires", () => {
    const { o, a, b } = two();
    o.reducedMotion = true;
    const ax = emp(o, a).x;
    o.setTerritory(msg(a, b, "clash"));
    expect(o.duels).toHaveLength(1);
    expect(o.duels[0].still).toBe(true);
    expect(emp(o, a).state).toBe("SEATED");
    tick(o, 2);
    expect(emp(o, a).x).toBe(ax);
    expect(emp(o, a).tempBubble?.e).toBe("💢");
    tick(o, 3);
    expect(o.duels).toHaveLength(0);
  });

  it("skips adventurers that are not seated", () => {
    const office = newOffice();
    const sessionA = sid(),
      sessionB = sid();
    seat(office, sessionA);
    office.event(ev(sessionB, "SessionStart")); // b is still walking in
    expect(emp(office, sessionB).state).toBe("ENTERING");
    office.setTerritory(msg(sessionA, sessionB, "clash"));
    expect(office.duels).toHaveLength(0);
    expect(emp(office, sessionA).state).toBe("SEATED");
    office.setTerritory({ claims: [], conflicts: [] }); // the clash ends before b sits down: it never duels afterwards
    tick(office, 20);
    expect(office.duels).toHaveLength(0);
    // a drinking adventurer does not duel either
    const sessionC = sid();
    seat(office, sessionC);
    emp(office, sessionC).state = "DRINK";
    office.setTerritory({
      claims: [],
      conflicts: [{ file: "z.ts", sids: [sessionA, sessionC], level: "clash", since: 1 }],
    });
    expect(office.duels).toHaveLength(0);
  });

  it("an opponent that leaves mid-duel does not strand the other", () => {
    const { o, a, b } = two();
    o.setTerritory(msg(a, b, "clash"));
    tick(o, 1);
    o.event(ev(b, "SessionEnd"));
    tick(o, 20);
    expect(o.duels).toHaveLength(0);
    expect(emp(o, a).state).toBe("SEATED");
    expect(emp(o, a).duel).toBeNull();
  });

  it("new overlap: glare emote + flag tug, no duel; quiet snapshots do nothing", () => {
    const { o, a, b } = two();
    o.setTerritory(msg(a, b, "overlap"), true);
    expect(emp(o, a).tempBubble?.e).not.toBe("💢");
    o.setTerritory({ claims: [], conflicts: [] });
    o.setTerritory(msg(a, b, "overlap"));
    expect(emp(o, a).tempBubble?.e).toBe("💢");
    expect(emp(o, b).tempBubble?.e).toBe("💢");
    expect(o.tugUntil(a, b)).toBeGreaterThan(o.clock);
    expect(o.duels).toHaveLength(0);
    expect(emp(o, a).state).toBe("SEATED");
  });

  it("two adventurers stacked on the same spot do not duel", () => {
    const { o, a, b } = two();
    emp(o, b).x = emp(o, a).x + 3;
    emp(o, b).y = emp(o, a).y;
    o.setTerritory(msg(a, b, "clash"));
    expect(o.duels).toHaveLength(0);
  });

  it("overlap glare is rate limited per pair; bookkeeping is pruned when an adventurer leaves", () => {
    const { o, a, b } = two();
    o.setTerritory(msg(a, b, "overlap"));
    expect(emp(o, a).tempBubble?.e).toBe("💢");
    emp(o, a).tempBubble = null;
    o.setTerritory({ claims: [], conflicts: [] });
    tick(o, 5);
    o.setTerritory(msg(a, b, "overlap")); // flapped back < 60s later
    expect(emp(o, a).tempBubble?.e).not.toBe("💢");
    o.setTerritory(msg(a, b, "clash", "other.ts"));
    expect(o.duels).toHaveLength(1);
    const priv = o as unknown as {
      duelAt: Map<string, number>;
      glareAt: Map<string, number>;
      editFailAt: Map<string, number>;
    };
    expect(priv.duelAt.size).toBe(1);
    o.event(ev(a, "SessionEnd"));
    tick(o, 20);
    expect(priv.duelAt.size).toBe(0);
    expect(priv.glareAt.size).toBe(0);
  });

  it("raiders inside the dungeon never duel (nothing to draw on the field)", () => {
    const office = newOffice();
    const ids = Array.from({ length: 10 }, () => sid());
    for (const id of ids) seat(office, id);
    const camp = ids.map((id) => emp(office, id)).filter((employee) => employee.deskIdx < 0);
    expect(camp.length).toBeGreaterThanOrEqual(2);
    const [campA, campB] = camp;
    office.setTerritory({
      claims: [],
      conflicts: [{ file: "q.ts", sids: [campA.id, campB.id], level: "clash", since: 1 }],
    });
    expect(campA.inDungeon).toBe(true);
    expect(office.duels).toHaveLength(0);
    expect(campA.state).toBe("SEATED");
  });
});

describe("territory duel: second pair after an older clash", () => {
  it("a second clash (cleric/ranger) duels while the older clash (mage/cleric) is still re-sent", () => {
    const office = newOffice();
    const cwd = "/Users/demo/realm";
    const other = sid(),
      mage = sid("m"),
      cleric = sid("c"),
      ranger = sid("r");
    seat(office, other, { cwd });
    seat(office, mage, { cwd });
    seat(office, cleric, { cwd });
    seat(office, ranger, { cwd });
    emp(office, mage).look.cls = "mage";
    emp(office, cleric).look.cls = "cleric";
    emp(office, ranger).look.cls = "ranger";
    const tool = (id: string, name: string, file: string, tid: string, extra: Record<string, unknown> = {}) =>
      ev(id, name, {
        cwd,
        tool_name: name === "PostToolUseFailure" ? "Edit" : id === ranger ? "Write" : "Edit",
        tool_input: { file_path: file },
        tool_use_id: tid,
        ...extra,
      });
    const f1 = "/Users/demo/realm/src/spells.ts",
      f2 = "/Users/demo/realm/src/arrows.ts";
    const c1 = { file: "src/spells.ts", sids: [mage, cleric], level: "clash" as const, since: 1, failer: mage };
    const claims = [
      { sid: mage, files: [f1] },
      { sid: cleric, files: [f1, f2] },
      { sid: ranger, files: [f2] },
    ];

    office.event(tool(cleric, "PreToolUse", f1, "g1"));
    office.setTerritory({ claims, conflicts: [{ ...c1, level: "overlap", failer: undefined }] });
    office.event(tool(mage, "PreToolUse", f1, "m1"));
    office.setTerritory({ claims, conflicts: [c1] });
    office.event(tool(mage, "PostToolUseFailure", f1, "m1"));
    expect(office.duels).toHaveLength(1);
    tick(office, 20);
    expect(office.duels).toHaveLength(0);
    expect(emp(office, cleric).state).toBe("SEATED");

    const ov2 = { file: "src/arrows.ts", sids: [ranger, cleric], level: "overlap" as const, since: 2 };
    office.event(tool(ranger, "PreToolUse", f2, "a1"));
    office.setTerritory({ claims, conflicts: [c1, ov2] });
    office.event(tool(cleric, "PreToolUse", f2, "h2"));
    const cl2 = { ...ov2, level: "clash" as const, failer: cleric };
    office.setTerritory({ claims, conflicts: [c1, cl2] });
    office.event(tool(cleric, "PostToolUseFailure", f2, "h2"));
    expect(office.duels).toHaveLength(1);
    expect(emp(office, cleric).state).toBe("DUEL");
    expect(emp(office, ranger).state).toBe("DUEL");
    expect(office.duels[0].winner).toBe(emp(office, office.duels[0].l).id === cleric ? 1 : 0);
  });

  it("a clash while a participant is still walking in duels as soon as both are seated; an older clash re-sent does not retrigger", () => {
    const office = newOffice();
    const cwd = "/Users/demo/realm";
    const other = sid(),
      mage = sid("m"),
      cleric = sid("c"),
      ranger = sid("r");
    seat(office, other, { cwd });
    seat(office, mage, { cwd });
    seat(office, cleric, { cwd });
    const c1 = { file: "src/spells.ts", sids: [mage, cleric], level: "clash" as const, since: 1, failer: mage };
    const claims = [
      { sid: mage, files: ["src/spells.ts"] },
      { sid: cleric, files: ["src/spells.ts", "src/arrows.ts"] },
    ];
    office.setTerritory({ claims, conflicts: [c1] });
    tick(office, 20);
    expect(office.duels).toHaveLength(0);
    // the ranger has only just arrived (still ENTERING) when its clash with the cleric is reported
    office.event(ev(ranger, "SessionStart", { cwd }));
    office.event(
      ev(ranger, "PreToolUse", {
        cwd,
        tool_name: "Write",
        tool_input: { file_path: cwd + "/src/arrows.ts" },
        tool_use_id: "a1",
      }),
    );
    const c2 = { file: "src/arrows.ts", sids: [cleric, ranger], level: "clash" as const, since: 2, failer: cleric };
    office.setTerritory({ claims, conflicts: [c2, c1] });
    office.event(
      ev(cleric, "PreToolUse", {
        cwd,
        tool_name: "Edit",
        tool_input: { file_path: cwd + "/src/arrows.ts" },
        tool_use_id: "h2",
      }),
    );
    office.event(
      ev(cleric, "PostToolUseFailure", {
        cwd,
        tool_name: "Edit",
        tool_input: { file_path: cwd + "/src/arrows.ts" },
        tool_use_id: "h2",
      }),
    );
    expect(emp(office, ranger).state).toBe("ENTERING");
    expect(office.duels).toHaveLength(0);
    for (let i = 0; i < 400 && emp(office, ranger).state !== "SEATED"; i++) {
      office.setTerritory({ claims, conflicts: [c2, c1] });
      tick(office, 0.1);
      if (office.duels.length) break;
    }
    tick(office, 0.2);
    expect(office.duels).toHaveLength(1);
    expect([office.duels[0].l, office.duels[0].r].sort()).toEqual([cleric, ranger].sort());
    expect(emp(office, mage).state).toBe("SEATED"); // the old mage/cleric clash never retriggers
    tick(office, 20);
    expect(office.duels).toHaveLength(0);
    office.setTerritory({ claims, conflicts: [c2, c1] });
    tick(office, 1);
    expect(office.duels).toHaveLength(0); // same pair is on cooldown, nobody else re-duels
  });
});

describe("duel choreography", () => {
  const fake = (over: Partial<Duel> = {}): Duel => ({
    l: "a",
    r: "b",
    kind: "sword",
    styleL: "sword",
    styleR: "sword",
    agg: 0,
    walk: true,
    still: false,
    phase: "fight",
    start: 0,
    t0: 0,
    winner: 0,
    failer: null,
    ix: 0,
    iy: 0,
    beat: -1,
    fxm: 0,
    decided: true,
    flourished: false,
    ...over,
  });

  it("timeline constants are consistent", () => {
    expect(DUEL_FINAL_AT).toBeCloseTo(DUEL_INTRO + DUEL_EXCHANGES * DUEL_EX);
    expect(DUEL_FLOURISH).toBeCloseTo(DUEL_FINAL_AT + DUEL_FINAL);
    expect(DUEL_FIGHT).toBeCloseTo(DUEL_FLOURISH + DUEL_FLOURISH_LEN);
    expect(DUEL_FIGHT).toBeGreaterThanOrEqual(8);
    expect(DUEL_FIGHT).toBeLessThanOrEqual(9.5);
    expect(DUEL_HALF).toBeGreaterThanOrEqual(28);
    expect(duelExchangeAt(0)).toBe(-1);
    expect(duelExchangeAt(DUEL_INTRO + 0.01)).toBe(0);
    expect(duelExchangeAt(DUEL_FINAL_AT + 0.01)).toBe(DUEL_EXCHANGES);
    expect(duelExchangeAt(DUEL_FLOURISH)).toBe(5);
  });

  it("hp: the loser ends at 0, the winner keeps pips, for both outcomes and every kind", () => {
    for (const kind of ["sword", "orb", "arrows", "magic_sword", "arrow_sword", "arrow_magic"] as const) {
      for (const winner of [0, 1] as const) {
        const duel = fake({ kind, winner, agg: kind === "sword" || kind === "orb" || kind === "arrows" ? 0 : 1 });
        const sessionA = newDuelScript(),
          sessionB = newDuelScript();
        for (let time = 0; time <= DUEL_FIGHT; time += 0.05) {
          duelScript(duel, 0, time, sessionA);
          duelScript(duel, 1, time, sessionB);
          expect(sessionA.hp).toBeLessThanOrEqual(DUEL_PIPS);
          expect(sessionB.hp).toBeGreaterThanOrEqual(0);
        }
        duelScript(duel, 0, DUEL_FLOURISH + 0.5, sessionA);
        duelScript(duel, 1, DUEL_FLOURISH + 0.5, sessionB);
        const [winnerId, loserId] = winner === 0 ? [sessionA, sessionB] : [sessionB, sessionA];
        expect(loserId.hp).toBe(0);
        expect(winnerId.hp).toBeGreaterThan(0);
        expect(loserId.ko).toBe(true);
        expect(loserId.pose).toBe("hurt");
        expect(winnerId.pose).toBe("cheer");
      }
    }
  });

  it("early exchanges drop both sides evenly (no commitment to the winner)", () => {
    for (const winner of [0, 1] as const) {
      const duel = fake({ kind: "orb", styleL: "magic", styleR: "magic", winner });
      const sessionA = newDuelScript(),
        sessionB = newDuelScript();
      duelScript(duel, 0, DUEL_FINAL_AT - 0.01, sessionA);
      duelScript(duel, 1, DUEL_FINAL_AT - 0.01, sessionB);
      expect(sessionA.hp).toBe(sessionB.hp);
      expect(sessionA.hp).toBeGreaterThan(0);
    }
  });

  it("is deterministic and defenders are knocked back during the recoil", () => {
    const duel = fake();
    const sessionA = newDuelScript(),
      sessionB = newDuelScript(),
      a2 = newDuelScript();
    const time = DUEL_INTRO + DUEL_IMPACT + 0.25; // exchange 0: left attacks right
    duelScript(duel, 0, time, sessionA);
    duelScript(duel, 0, time, a2);
    duelScript(duel, 1, time, sessionB);
    expect(a2).toEqual(sessionA);
    expect(sessionA.atk).toBe(0);
    expect(sessionA.dx).toBeGreaterThan(20); // dashed forward
    expect(sessionB.dx).toBeGreaterThanOrEqual(DUEL_KNOCK - 2); // right defender pushed right (away)
    expect(sessionB.pose).toBe("hurt");
    // final blow: the loser is thrown farther and sinks
    duelScript(duel, 1, DUEL_FINAL_AT + 1.3, sessionB);
    expect(sessionB.dx).toBeGreaterThanOrEqual(11);
    expect(sessionB.dy).toBeGreaterThan(0);
  });

  it("fighters never overlap during the choreography", () => {
    for (const kind of ["sword", "arrow_sword"] as const) {
      const duel = fake({ kind, styleR: kind === "sword" ? "sword" : "arrow", agg: kind === "sword" ? 0 : 1 });
      const sessionA = newDuelScript(),
        sessionB = newDuelScript();
      for (let time = 0; time <= DUEL_FIGHT; time += 0.02) {
        duelScript(duel, 0, time, sessionA);
        duelScript(duel, 1, time, sessionB);
        const sep = 2 * DUEL_HALF + sessionB.dx - sessionA.dx;
        expect(sep).toBeGreaterThanOrEqual(16 + 4);
      }
    }
  });

  it("the loser of a live duel is the failer's side", () => {
    for (const loser of [0, 1]) {
      const { o, a, b } = two();
      const message = msg(a, b, "clash");
      message.conflicts[0].failer = loser === 0 ? a : b;
      o.setTerritory(message);
      const duel = o.duels[0];
      tick(o, 2.8 + DUEL_FINAL_AT + 0.2);
      expect(duel.decided).toBe(true);
      const lid = loser === 0 ? a : b;
      expect(duel.winner === 0 ? duel.r : duel.l).toBe(lid);
      const script = newDuelScript();
      duelScript(duel, duel.winner === 0 ? 1 : 0, DUEL_FLOURISH + 0.1, script);
      expect(script.hp).toBe(0);
    }
  });
});

describe("duel fixes", () => {
  const fk = (over: Partial<Duel> = {}): Duel => ({
    l: "a",
    r: "b",
    kind: "arrow_sword",
    styleL: "sword",
    styleR: "arrow",
    agg: 1,
    walk: true,
    still: false,
    phase: "fight",
    start: 0,
    t0: 0,
    winner: 0,
    failer: null,
    ix: 0,
    iy: 0,
    beat: -1,
    fxm: 0,
    decided: true,
    flourished: false,
    ...over,
  });
  it("the right-hand attacker's script carries the projectile (fly), the defender's does not", () => {
    const duel = fk();
    const time = DUEL_INTRO + DUEL_IMPACT - DUEL_DASH / 2;
    const s0 = duelScript(duel, 0, time, newDuelScript()),
      s1 = duelScript(duel, 1, time, newDuelScript());
    expect(s0.atk).toBe(1);
    expect(s1.fly).toBeGreaterThan(0);
    expect(s1.fly).toBeLessThan(1);
    expect(s0.fly).toBe(-1);
  });

  it("hit-stop freezes the defender's frame", () => {
    const duel = fk({ styleL: "sword", styleR: "sword", kind: "sword", agg: 0 });
    const sessionA = duelScript(duel, 1, DUEL_INTRO + DUEL_IMPACT + 0.01, newDuelScript());
    const sessionB = duelScript(duel, 1, DUEL_INTRO + DUEL_IMPACT + 0.07, newDuelScript());
    expect(sessionA.stop && sessionB.stop).toBe(true);
    expect([sessionA.frame, sessionA.dx]).toEqual([sessionB.frame, sessionB.dx]);
  });

  it("every walking desk pair keeps fighters + K.O. knock-back inside [HALL_W, W]", () => {
    const scratch = { x: 0, y: 0 };
    let counter = 0;
    for (let deskA = 0; deskA < 8; deskA++)
      for (let deskB = deskA + 1; deskB < 8; deskB++) {
        const ax = SPOT_COLS[deskA % 4],
          ay = SPOT_ROWS[(deskA / 4) | 0],
          bx = SPOT_COLS[deskB % 4],
          by = SPOT_ROWS[(deskB / 4) | 0];
        if (Math.hypot(ax - bx, ay - by) > 130) continue;
        duelMidOfDesks(deskA, deskB, scratch);
        counter++;
        expect(scratch.x - DUEL_HALF - DUEL_KNOCK_KO - 8).toBeGreaterThanOrEqual(HALL_W);
        expect(scratch.x + DUEL_HALF + DUEL_KNOCK_KO + 8).toBeLessThanOrEqual(WORLD_W);
      }
    expect(counter).toBeGreaterThan(8);
  });

  it("a bystander in the movement band turns a walking duel into a still one", () => {
    const office = newOffice();
    const sessionA = sid(),
      mid = sid(),
      sessionB = sid();
    seat(office, sessionA);
    seat(office, mid);
    seat(office, sessionB);
    expect([emp(office, sessionA).deskIdx, emp(office, mid).deskIdx, emp(office, sessionB).deskIdx]).toEqual([0, 1, 2]);
    office.setTerritory({
      claims: [],
      conflicts: [{ file: "x.ts", sids: [sessionA, sessionB], level: "clash", since: 1 }],
    });
    expect(office.duels).toHaveLength(1);
    expect(office.duels[0].walk).toBe(false);
    expect(office.duels[0].still).toBe(true);
    expect(emp(office, sessionA).state).toBe("SEATED");
  });
});
