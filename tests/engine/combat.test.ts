import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MAX_HEARTS, xpNeed } from "@/lib/office/engine";
import { emp, ev, fixedRandom, newOffice, seat, sid, stubStorage, tick } from "./helpers";

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
  stubStorage();
  fixedRandom(0.5); // xp 2 per hit, gold 2 per kill, no crit
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

const pre = (id: string, tool: string, tid?: string) => ev(id, "PreToolUse", { tool_name: tool, ...(tid ? { tool_use_id: tid } : {}) });
const post = (id: string, tool: string, tid?: string) => ev(id, "PostToolUse", { tool_name: tool, ...(tid ? { tool_use_id: tid } : {}) });
const fail = (id: string, tool: string, tid?: string) => ev(id, "PostToolUseFailure", { tool_name: tool, ...(tid ? { tool_use_id: tid } : {}) });

describe("monsters", () => {
  it("a seated adventurer has a monster with full HP", () => {
    const o = newOffice();
    const e = seat(o, sid());
    expect(e.monHp).toBe(e.monHpMax);
    expect(e.monHpMax).toBeGreaterThan(0);
    expect(e.monDead).toBe(false);
  });

  it("a successful tool does 1 damage (heavy tools 2) and gives xp", () => {
    const o = newOffice();
    const id = sid();
    const e = seat(o, id);
    e.monHp = e.monHpMax = 10;
    o.event(post(id, "Read"));
    expect(e.monHp).toBe(9);
    expect(e.xp).toBe(2);
    o.event(post(id, "Edit"));
    expect(e.monHp).toBe(7);
    o.event(post(id, "Bash"));
    expect(e.monHp).toBe(5);
  });

  it("a crit doubles damage", () => {
    const o = newOffice();
    const id = sid();
    const e = seat(o, id);
    e.monHp = e.monHpMax = 10;
    fixedRandom(0.05);
    o.event(post(id, "Read"));
    expect(e.monHp).toBe(8);
  });

  it("killing the monster: kill/gold/treasury/xp, then it respawns with fresh HP", () => {
    const o = newOffice();
    const id = sid();
    const e = seat(o, id);
    e.monHp = 1;
    o.event(post(id, "Read"));
    expect(e.monDead).toBe(true);
    expect(e.monLoot).toBe(true);
    expect(e.kills).toBe(1);
    expect(e.gold).toBe(2);
    expect(o.treasury).toBe(2);
    expect(e.xp).toBe(2 + 5);
    const n = e.monN;
    tick(o, 1);
    expect(e.monDead).toBe(true);
    tick(o, 2);
    expect(e.monDead).toBe(false);
    expect(e.monHp).toBe(e.monHpMax);
    expect(e.monN).toBe(n + 1);
  });

  it("no damage while the monster is dead or just spawned (<0.3s)", () => {
    const o = newOffice();
    const id = sid();
    const e = seat(o, id);
    e.monHp = 1;
    o.event(post(id, "Read"));
    const kills = e.kills;
    o.event(post(id, "Read")); // still dead
    expect(e.kills).toBe(kills);
    tick(o, 2.05); // respawn happens at ~2.0s; still inside the 0.3s grace
    expect(e.monDead).toBe(false);
    const hp = e.monHp;
    o.event(post(id, "Read"));
    expect(e.monHp).toBe(hp);
  });

  it("monster death does not happen when the adventurer left", () => {
    const o = newOffice();
    const id = sid();
    const e = seat(o, id);
    o.event(ev(id, "SessionEnd"));
    expect(e.monDead).toBe(true);
    expect(e.monRespawnAt).toBe(Infinity);
    tick(o, 5);
    expect(e.monDead).toBe(true);
  });
});

describe("failure hearts", () => {
  it("each failure costs a heart, floored at 0", () => {
    const o = newOffice();
    const id = sid();
    const e = seat(o, id);
    expect(e.hearts).toBe(MAX_HEARTS);
    for (let i = 1; i <= MAX_HEARTS + 2; i++) {
      o.event(fail(id, "Bash"));
      expect(e.hearts).toBe(Math.max(0, MAX_HEARTS - i));
    }
    expect(e.hurtUntil).toBeGreaterThan(o.clock);
  });

  it("failure does no damage and gives no xp", () => {
    const o = newOffice();
    const id = sid();
    const e = seat(o, id);
    const hp = e.monHp;
    o.event(fail(id, "Bash"));
    expect(e.monHp).toBe(hp);
    expect(e.xp).toBe(0);
    expect(e.toolCalls).toBe(1);
  });

  it("Stop refills hearts", () => {
    const o = newOffice();
    const id = sid();
    const e = seat(o, id);
    o.event(fail(id, "Bash"));
    o.event(fail(id, "Bash"));
    expect(e.hearts).toBe(1);
    o.event(ev(id, "Stop"));
    expect(e.hearts).toBe(MAX_HEARTS);
  });

  it("hearts also refill at the tavern (queued Stop path)", () => {
    const o = newOffice();
    const id = sid();
    const e = seat(o, id);
    o.event(ev(id, "Stop"));
    e.hearts = 1;
    for (let i = 0; i < 400 && e.state !== "DRINK"; i++) tick(o, 0.1);
    expect(e.hearts).toBe(MAX_HEARTS);
  });

  it("a failure counts as a tool call for the quest banner (>=3)", () => {
    const o = newOffice();
    const id = sid();
    seat(o, id);
    for (let i = 0; i < 3; i++) o.event(post(id, "Read"));
    o.event(ev(id, "Stop"));
    expect(o.banners.some((b) => b.kind === "quest")).toBe(true);
  });

  it("failure of the boss tool: boss leaves (no loot) and costs a heart", () => {
    const o = newOffice();
    const id = sid();
    const e = seat(o, id);
    o.event(pre(id, "Bash", "t1"));
    tick(o, 31);
    expect(e.boss).not.toBeNull();
    o.event(fail(id, "Bash", "t1"));
    expect(e.boss).toBeNull();
    expect(e.monLoot).toBe(false);
    expect(e.hearts).toBe(MAX_HEARTS - 1);
    expect(e.kills).toBe(0);
  });
});

describe("boss", () => {
  it("does not appear before 30s", () => {
    const o = newOffice();
    const id = sid();
    const e = seat(o, id);
    o.event(pre(id, "Bash", "t1"));
    tick(o, 29);
    expect(e.boss).toBeNull();
    expect(e.pending.size).toBe(1);
  });

  it("PreToolUse pending > 30s after being seated spawns a boss + banner", () => {
    const o = newOffice();
    const id = sid();
    const e = seat(o, id);
    o.event(pre(id, "Bash", "t1"));
    tick(o, 31);
    expect(e.boss).not.toBeNull();
    expect(o.banners.some((b) => b.kind === "boss")).toBe(true);
    expect(o.statusOf(e)).toContain("บอส");
  });

  it("PostToolUse kills the boss: +10 gold, +1 kill, +25 xp (multi-level), respawn later", () => {
    const o = newOffice();
    const id = sid();
    const e = seat(o, id);
    o.event(pre(id, "Bash", "t1"));
    tick(o, 31);
    o.event(post(id, "Bash", "t1"));
    expect(e.boss).toBeNull();
    expect(e.kills).toBe(1);
    expect(e.gold).toBe(10);
    expect(o.treasury).toBe(10);
    expect(e.monLoot).toBe(true);
    // 25 xp from lv1 (10) then lv2 (15) -> lv3 with 0 left
    expect(e.lv).toBe(3);
    expect(e.xp).toBe(0);
    expect(e.pending.size).toBe(0);
    tick(o, 4);
    expect(e.monDead).toBe(false);
    expect(e.boss).toBeNull();
  });

  it("boss that started while a boss is up does not respawn another", () => {
    const o = newOffice();
    const id = sid();
    const e = seat(o, id);
    o.event(pre(id, "Bash", "t1"));
    tick(o, 31);
    const at = e.bossAt;
    tick(o, 20);
    expect(e.bossAt).toBe(at);
  });

  it("Esc + new prompt (UserPromptSubmit) clears pending and the boss: no ghost boss", () => {
    const o = newOffice();
    const id = sid();
    const e = seat(o, id);
    o.event(pre(id, "Bash", "t1"));
    tick(o, 31);
    expect(e.boss).not.toBeNull();
    o.event(ev(id, "UserPromptSubmit"));
    expect(e.boss).toBeNull();
    expect(e.pending.size).toBe(0);
    expect(e.monLoot).toBe(false);
    expect(e.kills).toBe(0);
    tick(o, 60);
    expect(e.boss).toBeNull();
    expect(e.monDead).toBe(false);
  });

  it("Esc then prompt BEFORE 30s also leaves no boss later", () => {
    const o = newOffice();
    const id = sid();
    const e = seat(o, id);
    o.event(pre(id, "Bash", "t1"));
    tick(o, 20);
    o.event(ev(id, "UserPromptSubmit"));
    tick(o, 60);
    expect(e.boss).toBeNull();
  });

  it("Stop clears pending and sends the boss away without loot", () => {
    const o = newOffice();
    const id = sid();
    const e = seat(o, id);
    o.event(pre(id, "Bash", "t1"));
    tick(o, 31);
    o.event(ev(id, "Stop"));
    expect(e.boss).toBeNull();
    expect(e.pending.size).toBe(0);
    expect(e.monLoot).toBe(false);
    expect(e.gold).toBe(0);
  });

  it.each(["Agent", "Task", "Workflow", "AskUserQuestion", "ExitPlanMode", "EnterPlanMode"])("%s is never pending, so never a boss", (tool) => {
    const o = newOffice();
    const id = sid();
    const e = seat(o, id);
    o.event(pre(id, tool, "t1"));
    expect(e.pending.size).toBe(0);
    tick(o, 120);
    expect(e.boss).toBeNull();
  });

  it("Post for an Agent tool doesn't drop another tool's pending entry", () => {
    const o = newOffice();
    const id = sid();
    const e = seat(o, id);
    o.event(pre(id, "Bash", "t1"));
    o.event(pre(id, "Agent", "t2"));
    o.event(post(id, "Agent", "t2"));
    expect(e.pending.has("t1")).toBe(true);
  });

  it("a raised hand (permission wait) is not a boss fight, even after 100s", () => {
    const o = newOffice();
    const id = sid();
    const e = seat(o, id);
    o.event(pre(id, "Bash", "t1"));
    o.event(ev(id, "PermissionRequest", { tool_name: "Bash" }));
    tick(o, 100);
    expect(e.boss).toBeNull();
    expect(e.act).toBe("handup");
  });

  it("after the permission is granted, the 30s clock starts over", () => {
    const o = newOffice();
    const id = sid();
    const e = seat(o, id);
    o.event(pre(id, "Bash", "t1"));
    o.event(ev(id, "PermissionRequest", { tool_name: "Bash" }));
    tick(o, 100);
    o.event(pre(id, "Bash", "t1")); // tool resumes
    tick(o, 20);
    expect(e.boss).toBeNull();
    tick(o, 15);
    expect(e.boss).not.toBeNull();
  });

  it("handup notification (permission_prompt) doesn't count either", () => {
    const o = newOffice();
    const id = sid();
    const e = seat(o, id);
    o.event(pre(id, "Edit", "t1"));
    o.event(ev(id, "Notification", { notification_type: "permission_prompt" }));
    tick(o, 90);
    expect(e.boss).toBeNull();
  });

  it("parallel tools: pending tracked per id, boss measured from the oldest", () => {
    const o = newOffice();
    const id = sid();
    const e = seat(o, id);
    o.event(pre(id, "Bash", "a"));
    tick(o, 20);
    o.event(pre(id, "Bash", "b"));
    expect(e.pending.size).toBe(2);
    o.event(post(id, "Bash", "a"));
    expect(e.pending.size).toBe(1);
    expect(e.pending.has("b")).toBe(true);
    tick(o, 15);
    expect(e.boss).toBeNull(); // b is only 15s old
    tick(o, 20);
    expect(e.boss).not.toBeNull();
  });

  it("parallel tools: both finishing empties pending", () => {
    const o = newOffice();
    const id = sid();
    const e = seat(o, id);
    o.event(pre(id, "Read", "a"));
    o.event(pre(id, "Read", "b"));
    o.event(post(id, "Read", "b"));
    o.event(post(id, "Read", "a"));
    expect(e.pending.size).toBe(0);
  });

  it("keyless Pre/Post pair up (oldest synthetic key first)", () => {
    const o = newOffice();
    const id = sid();
    const e = seat(o, id);
    o.event(pre(id, "Read"));
    o.event(pre(id, "Read"));
    expect(e.pending.size).toBe(2);
    o.event(post(id, "Read"));
    expect(e.pending.size).toBe(1);
    o.event(post(id, "Read"));
    expect(e.pending.size).toBe(0);
  });

  it("pending is capped at 16", () => {
    const o = newOffice();
    const id = sid();
    const e = seat(o, id);
    for (let i = 0; i < 30; i++) o.event(pre(id, "Read", "t" + i));
    expect(e.pending.size).toBe(16);
    expect(e.pending.has("t29")).toBe(true);
    expect(e.pending.has("t0")).toBe(false);
  });

  it("an orphan boss killed when pending finished via the hit credits only once", () => {
    const o = newOffice();
    const id = sid();
    const e = seat(o, id);
    o.event(pre(id, "Bash", "t1"));
    tick(o, 31);
    o.event(post(id, "Bash", "t1"));
    o.event(post(id, "Bash", "t1")); // duplicate Post: ordinary hit on the (dead) monster
    expect(e.kills).toBe(1);
  });

  it("idle timeout is blocked while a tool is pending, so boss fights are not abandoned", () => {
    const o = newOffice();
    const id = sid();
    const e = seat(o, id);
    o.event(pre(id, "Bash", "t1"));
    tick(o, 700, 1);
    expect(e.state).toBe("SEATED");
  });

  it("no boss for campers (no desk/monster)", () => {
    const o = newOffice();
    const ids = Array.from({ length: 9 }, () => sid());
    for (const i of ids) o.event(ev(i, "SessionStart"));
    tick(o, 40);
    const camper = emp(o, ids[8]);
    o.event(pre(camper.id, "Bash", "t1"));
    tick(o, 60);
    expect(camper.boss).toBeNull();
  });
});

describe("xp and levels", () => {
  it("xpNeed grows by x1.5", () => {
    expect(xpNeed(1)).toBe(10);
    expect(xpNeed(2)).toBe(15);
    expect(xpNeed(3)).toBe(23);
  });

  it("level-up carries over xp", () => {
    const o = newOffice();
    const id = sid();
    const e = seat(o, id);
    e.xp = 9;
    e.monHp = e.monHpMax = 99;
    o.event(post(id, "Read"));
    expect(e.lv).toBe(2);
    expect(e.xp).toBe(1);
    expect(o.flash).toBeGreaterThan(0);
    expect(e.lvlTo).toBe(2);
  });

  it("a big gain levels up several times in one go", () => {
    const o = newOffice();
    const id = sid();
    const e = seat(o, id);
    e.xp = 9;
    o.event(pre(id, "Bash", "t1"));
    tick(o, 31);
    o.event(post(id, "Bash", "t1")); // +25
    expect(e.lv).toBe(3);
    expect(e.xp).toBe(9 + 25 - 10 - 15);
  });

  it("xp roll range is 1..3 per hit", () => {
    const o = newOffice();
    const id = sid();
    const e = seat(o, id);
    e.monHp = e.monHpMax = 99;
    fixedRandom(0);
    o.event(post(id, "Read"));
    expect(e.xp).toBe(1);
    fixedRandom(0.99);
    o.event(post(id, "Read"));
    expect(e.xp).toBe(1 + 3);
  });
});
