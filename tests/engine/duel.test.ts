import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { TerritoryMsg } from "@/lib/office/engine";
import { emp, ev, newOffice, seat, sid, stubStorage, tick } from "./helpers";

beforeEach(() => { vi.useFakeTimers(); stubStorage(); });
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

const msg = (a: string, b: string, level: "overlap" | "clash", file = "src/a.ts"): TerritoryMsg => ({
  claims: [{ sid: a, files: [file, "x.ts"] }, { sid: b, files: [file] }],
  conflicts: [{ file, sids: [a, b], level, since: 1 }],
});

function two() {
  const o = newOffice(); const a = sid(), b = sid();
  seat(o, a, { cwd: "/w/alpha" });
  seat(o, b, { cwd: "/w/beta" });
  return { o, a, b };
}

describe("territory duel", () => {
  it("starts on a NEW clash: both walk (DUEL), fight, then return to SEATED at their spots", () => {
    const { o, a, b } = two();
    const sa = { x: emp(o, a).x, y: emp(o, a).y }, sb = { x: emp(o, b).x, y: emp(o, b).y };
    o.setTerritory(msg(a, b, "overlap"));
    expect(o.duels).toHaveLength(0); // overlap alone never duels
    o.setTerritory(msg(a, b, "clash"));
    expect(o.duels).toHaveLength(1);
    expect(emp(o, a).state).toBe("DUEL");
    expect(emp(o, b).state).toBe("DUEL");
    expect(o.getView().roster.find((r) => r.id === a)).toBeTruthy();
    tick(o, 2.5);
    expect(o.duels[0].phase).toBe("fight");
    expect(emp(o, a).facing * emp(o, b).facing).toBe(-1);
    tick(o, 5.5);
    tick(o, 5);
    expect(o.duels).toHaveLength(0);
    for (const [id, p] of [[a, sa], [b, sb]] as const) {
      const e = emp(o, id);
      expect(e.state).toBe("SEATED");
      expect(e.duel).toBeNull();
      expect([e.x, e.y]).toEqual([p.x, p.y]);
    }
  });

  it("events during a walking duel are applied immediately (state only), none dropped, no walking", () => {
    const { o, a, b } = two();
    o.setTerritory(msg(a, b, "clash"));
    tick(o, 1);
    o.event(ev(a, "UserPromptSubmit"));
    for (let i = 0; i < 4; i++) {
      o.event(ev(a, "PreToolUse", { tool_name: "Edit", tool_input: { file_path: "/w/alpha/x.ts" }, tool_use_id: "t" + i }));
      o.event(ev(a, "PostToolUse", { tool_name: "Edit", tool_use_id: "t" + i }));
    }
    o.event(ev(a, "PreToolUse", { tool_name: "Edit", tool_input: { file_path: "/w/alpha/x.ts" }, tool_use_id: "last" }));
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

  it("Stop during a duel: finishes the duel, then goes to the tavern", () => {
    const { o, a, b } = two();
    o.setTerritory(msg(a, b, "clash"));
    tick(o, 1);
    o.event(ev(b, "Stop"));
    expect(emp(o, b).state).toBe("DUEL");
    expect(emp(o, b).coffeeAfter).toBe(true);
    const seen = new Set<string>();
    for (let i = 0; i < 400; i++) { o.update(0.05); seen.add(emp(o, b).state); }
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
    const d = o.duels[0];
    const winnerId = d.winner === 0 ? d.l : d.r;
    expect(winnerId).toBe(a);
  });

  it("server `failer` decides the winner even when the territory message arrives BEFORE the failure event", () => {
    for (const loser of [0, 1]) {
      const { o, a, b } = two();
      const m = msg(a, b, "clash");
      m.conflicts[0].failer = loser === 0 ? a : b;
      o.setTerritory(m); // no PostToolUseFailure seen yet
      o.event(ev(loser === 0 ? a : b, "PostToolUseFailure", { tool_name: "Edit", tool_input: { file_path: "/w/x/a.ts" } })); // arrives after
      const d = o.duels[0];
      expect(d.failer).toBe(loser === 0 ? a : b);
      expect(d.winner === 0 ? d.l : d.r).toBe(loser === 0 ? b : a);
      tick(o, 3.5);
      expect(d.winner === 0 ? d.l : d.r).toBe(loser === 0 ? b : a);
    }
  });

  it("without a server failer, a failure seen during the fight still decides the winner at the flourish", () => {
    const { o, a, b } = two();
    o.setTerritory(msg(a, b, "clash"));
    const d = o.duels[0];
    const early = d.winner === 0 ? d.l : d.r;
    o.event(ev(early, "PostToolUseFailure", { tool_name: "Edit", tool_input: { file_path: "/w/x/a.ts" } }));
    tick(o, 2.8 + 3.6);
    expect(d.flourished).toBe(true);
    expect(d.winner === 0 ? d.l : d.r).not.toBe(early);
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
    const o = newOffice();
    const ids = [sid(), sid(), sid(), sid(), sid(), sid()];
    for (const id of ids) seat(o, id);
    o.setTerritory({ claims: [], conflicts: [
      { file: "a.ts", sids: [ids[0], ids[1]], level: "clash", since: 1 },
      { file: "b.ts", sids: [ids[2], ids[3]], level: "clash", since: 1 },
      { file: "c.ts", sids: [ids[4], ids[5]], level: "clash", since: 1 },
    ] });
    expect(o.duels).toHaveLength(2);
    const inDuel = o.duels.flatMap((d) => [d.l, d.r]);
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
    const o = newOffice(); const a = sid(), b = sid();
    seat(o, a);
    o.event(ev(b, "SessionStart")); // b is still walking in
    expect(emp(o, b).state).toBe("ENTERING");
    o.setTerritory(msg(a, b, "clash"));
    expect(o.duels).toHaveLength(0);
    expect(emp(o, a).state).toBe("SEATED");
    o.setTerritory({ claims: [], conflicts: [] }); // the clash ends before b sits down: it never duels afterwards
    tick(o, 20);
    expect(o.duels).toHaveLength(0);
    // a drinking adventurer does not duel either
    const c = sid(); seat(o, c);
    emp(o, c).state = "DRINK";
    o.setTerritory({ claims: [], conflicts: [{ file: "z.ts", sids: [a, c], level: "clash", since: 1 }] });
    expect(o.duels).toHaveLength(0);
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
    emp(o, b).x = emp(o, a).x + 3; emp(o, b).y = emp(o, a).y;
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
    const priv = o as unknown as { duelAt: Map<string, number>; glareAt: Map<string, number>; editFailAt: Map<string, number> };
    expect(priv.duelAt.size).toBe(1);
    o.event(ev(a, "SessionEnd"));
    tick(o, 20);
    expect(priv.duelAt.size).toBe(0);
    expect(priv.glareAt.size).toBe(0);
  });

  it("camp (overflow) adventurers duel in place, without walking", () => {
    const o = newOffice();
    const ids = Array.from({ length: 10 }, () => sid());
    for (const id of ids) seat(o, id);
    const camp = ids.map((id) => emp(o, id)).filter((e) => e.deskIdx < 0);
    expect(camp.length).toBeGreaterThanOrEqual(2);
    const [p, q] = camp;
    o.setTerritory({ claims: [], conflicts: [{ file: "q.ts", sids: [p.id, q.id], level: "clash", since: 1 }] });
    expect(o.duels).toHaveLength(1);
    expect(o.duels[0].walk).toBe(false);
    expect(p.state).toBe("SEATED");
    tick(o, 6);
    expect(o.duels).toHaveLength(0);
  });
});

describe("territory duel: second pair after an older clash", () => {
  it("a second clash (cleric/ranger) duels while the older clash (mage/cleric) is still re-sent", () => {
    const o = newOffice();
    const cwd = "/Users/demo/realm";
    const other = sid(), mage = sid("m"), cleric = sid("c"), ranger = sid("r");
    seat(o, other, { cwd });
    seat(o, mage, { cwd }); seat(o, cleric, { cwd }); seat(o, ranger, { cwd });
    emp(o, mage).look.cls = "mage"; emp(o, cleric).look.cls = "cleric"; emp(o, ranger).look.cls = "ranger";
    const tool = (id: string, name: string, file: string, tid: string, extra: Record<string, unknown> = {}) =>
      ev(id, name, { cwd, tool_name: name === "PostToolUseFailure" ? "Edit" : id === ranger ? "Write" : "Edit", tool_input: { file_path: file }, tool_use_id: tid, ...extra });
    const f1 = "/Users/demo/realm/src/spells.ts", f2 = "/Users/demo/realm/src/arrows.ts";
    const c1 = { file: "src/spells.ts", sids: [mage, cleric], level: "clash" as const, since: 1, failer: mage };
    const claims = [{ sid: mage, files: [f1] }, { sid: cleric, files: [f1, f2] }, { sid: ranger, files: [f2] }];

    o.event(tool(cleric, "PreToolUse", f1, "g1"));
    o.setTerritory({ claims, conflicts: [{ ...c1, level: "overlap", failer: undefined }] });
    o.event(tool(mage, "PreToolUse", f1, "m1"));
    o.setTerritory({ claims, conflicts: [c1] });
    o.event(tool(mage, "PostToolUseFailure", f1, "m1"));
    expect(o.duels).toHaveLength(1);
    tick(o, 20);
    expect(o.duels).toHaveLength(0);
    expect(emp(o, cleric).state).toBe("SEATED");

    const ov2 = { file: "src/arrows.ts", sids: [ranger, cleric], level: "overlap" as const, since: 2 };
    o.event(tool(ranger, "PreToolUse", f2, "a1"));
    o.setTerritory({ claims, conflicts: [c1, ov2] });
    o.event(tool(cleric, "PreToolUse", f2, "h2"));
    const cl2 = { ...ov2, level: "clash" as const, failer: cleric };
    o.setTerritory({ claims, conflicts: [c1, cl2] });
    o.event(tool(cleric, "PostToolUseFailure", f2, "h2"));
    expect(o.duels).toHaveLength(1);
    expect(emp(o, cleric).state).toBe("DUEL");
    expect(emp(o, ranger).state).toBe("DUEL");
    expect(o.duels[0].winner).toBe(emp(o, o.duels[0].l).id === cleric ? 1 : 0);
  });

  it("a clash while a participant is still walking in duels as soon as both are seated; an older clash re-sent does not retrigger", () => {
    const o = newOffice();
    const cwd = "/Users/demo/realm";
    const other = sid(), mage = sid("m"), cleric = sid("c"), ranger = sid("r");
    seat(o, other, { cwd }); seat(o, mage, { cwd }); seat(o, cleric, { cwd });
    const c1 = { file: "src/spells.ts", sids: [mage, cleric], level: "clash" as const, since: 1, failer: mage };
    const claims = [{ sid: mage, files: ["src/spells.ts"] }, { sid: cleric, files: ["src/spells.ts", "src/arrows.ts"] }];
    o.setTerritory({ claims, conflicts: [c1] });
    tick(o, 20);
    expect(o.duels).toHaveLength(0);
    // the ranger has only just arrived (still ENTERING) when its clash with the cleric is reported
    o.event(ev(ranger, "SessionStart", { cwd }));
    o.event(ev(ranger, "PreToolUse", { cwd, tool_name: "Write", tool_input: { file_path: cwd + "/src/arrows.ts" }, tool_use_id: "a1" }));
    const c2 = { file: "src/arrows.ts", sids: [cleric, ranger], level: "clash" as const, since: 2, failer: cleric };
    o.setTerritory({ claims, conflicts: [c2, c1] });
    o.event(ev(cleric, "PreToolUse", { cwd, tool_name: "Edit", tool_input: { file_path: cwd + "/src/arrows.ts" }, tool_use_id: "h2" }));
    o.event(ev(cleric, "PostToolUseFailure", { cwd, tool_name: "Edit", tool_input: { file_path: cwd + "/src/arrows.ts" }, tool_use_id: "h2" }));
    expect(emp(o, ranger).state).toBe("ENTERING");
    expect(o.duels).toHaveLength(0);
    for (let i = 0; i < 400 && emp(o, ranger).state !== "SEATED"; i++) { o.setTerritory({ claims, conflicts: [c2, c1] }); tick(o, 0.1); if (o.duels.length) break; }
    tick(o, 0.2);
    expect(o.duels).toHaveLength(1);
    expect([o.duels[0].l, o.duels[0].r].sort()).toEqual([cleric, ranger].sort());
    expect(emp(o, mage).state).toBe("SEATED"); // the old mage/cleric clash never retriggers
    tick(o, 20);
    expect(o.duels).toHaveLength(0);
    o.setTerritory({ claims, conflicts: [c2, c1] });
    tick(o, 1);
    expect(o.duels).toHaveLength(0); // same pair is on cooldown, nobody else re-duels
  });
});
