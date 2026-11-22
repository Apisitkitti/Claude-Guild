import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { MAX_HEARTS, xpNeed } from "@/lib/office/engine";

import { emp, ev, fixedRandom, newOffice, seat, sid, stubStorage, tick } from "./helpers";

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
  stubStorage();
  fixedRandom(0.5); // xp 2 per hit, gold 2 per kill, no crit
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const pre = (id: string, tool: string, tid?: string) =>
  ev(id, "PreToolUse", { tool_name: tool, ...(tid ? { tool_use_id: tid } : {}) });
const post = (id: string, tool: string, tid?: string) =>
  ev(id, "PostToolUse", { tool_name: tool, ...(tid ? { tool_use_id: tid } : {}) });
const fail = (id: string, tool: string, tid?: string) =>
  ev(id, "PostToolUseFailure", { tool_name: tool, ...(tid ? { tool_use_id: tid } : {}) });

describe("monsters", () => {
  it("a seated adventurer has a monster with full HP", () => {
    const office = newOffice();
    const employee = seat(office, sid());
    expect(employee.monHp).toBe(employee.monHpMax);
    expect(employee.monHpMax).toBeGreaterThan(0);
    expect(employee.monDead).toBe(false);
  });

  it("a successful tool does 1 damage (heavy tools 2) and gives xp", () => {
    const office = newOffice();
    const id = sid();
    const employee = seat(office, id);
    employee.monHp = employee.monHpMax = 10;
    office.event(post(id, "Read"));
    expect(employee.monHp).toBe(9);
    expect(employee.xp).toBe(2);
    office.event(post(id, "Edit"));
    expect(employee.monHp).toBe(7);
    office.event(post(id, "Bash"));
    expect(employee.monHp).toBe(5);
  });

  it("a crit doubles damage", () => {
    const office = newOffice();
    const id = sid();
    const employee = seat(office, id);
    employee.monHp = employee.monHpMax = 10;
    fixedRandom(0.05);
    office.event(post(id, "Read"));
    expect(employee.monHp).toBe(8);
  });

  it("killing the monster: kill/gold/treasury/xp, then it respawns with fresh HP", () => {
    const office = newOffice();
    const id = sid();
    const employee = seat(office, id);
    employee.monHp = 1;
    office.event(post(id, "Read"));
    expect(employee.monDead).toBe(true);
    expect(employee.monLoot).toBe(true);
    expect(employee.kills).toBe(1);
    expect(employee.gold).toBe(2);
    expect(office.treasury).toBe(2);
    expect(employee.xp).toBe(2 + 5);
    const count = employee.monN;
    tick(office, 1);
    expect(employee.monDead).toBe(true);
    tick(office, 2);
    expect(employee.monDead).toBe(false);
    expect(employee.monHp).toBe(employee.monHpMax);
    expect(employee.monN).toBe(count + 1);
  });

  it("no damage while the monster is dead or just spawned (<0.3s)", () => {
    const office = newOffice();
    const id = sid();
    const employee = seat(office, id);
    employee.monHp = 1;
    office.event(post(id, "Read"));
    const kills = employee.kills;
    office.event(post(id, "Read")); // still dead
    expect(employee.kills).toBe(kills);
    tick(office, 2.05); // respawn happens at ~2.0s; still inside the 0.3s grace
    expect(employee.monDead).toBe(false);
    const hp = employee.monHp;
    office.event(post(id, "Read"));
    expect(employee.monHp).toBe(hp);
  });

  it("monster death does not happen when the adventurer left", () => {
    const office = newOffice();
    const id = sid();
    const employee = seat(office, id);
    office.event(ev(id, "SessionEnd"));
    expect(employee.monDead).toBe(true);
    expect(employee.monRespawnAt).toBe(Infinity);
    tick(office, 5);
    expect(employee.monDead).toBe(true);
  });
});

describe("failure hearts", () => {
  it("each failure costs a heart, floored at 0", () => {
    const office = newOffice();
    const id = sid();
    const employee = seat(office, id);
    expect(employee.hearts).toBe(MAX_HEARTS);
    for (let i = 1; i <= MAX_HEARTS + 2; i++) {
      office.event(fail(id, "Bash"));
      expect(employee.hearts).toBe(Math.max(0, MAX_HEARTS - i));
    }
    expect(employee.hurtUntil).toBeGreaterThan(office.clock);
  });

  it("failure does no damage and gives no xp", () => {
    const office = newOffice();
    const id = sid();
    const employee = seat(office, id);
    const hp = employee.monHp;
    office.event(fail(id, "Bash"));
    expect(employee.monHp).toBe(hp);
    expect(employee.xp).toBe(0);
    expect(employee.toolCalls).toBe(1);
  });

  it("Stop refills hearts", () => {
    const office = newOffice();
    const id = sid();
    const employee = seat(office, id);
    office.event(fail(id, "Bash"));
    office.event(fail(id, "Bash"));
    expect(employee.hearts).toBe(1);
    office.event(ev(id, "Stop"));
    expect(employee.hearts).toBe(MAX_HEARTS);
  });

  it("hearts also refill at the tavern (queued Stop path)", () => {
    const office = newOffice();
    const id = sid();
    const employee = seat(office, id);
    office.event(ev(id, "Stop"));
    employee.hearts = 1;
    for (let i = 0; i < 400 && employee.state !== "DRINK"; i++) tick(office, 0.1);
    expect(employee.hearts).toBe(MAX_HEARTS);
  });

  it("a failure counts as a tool call for the quest banner (>=3)", () => {
    const office = newOffice();
    const id = sid();
    seat(office, id);
    for (let i = 0; i < 3; i++) office.event(post(id, "Read"));
    office.event(ev(id, "Stop"));
    expect(office.banners.some((banner) => banner.kind === "quest")).toBe(true);
  });

  it("failure of the boss tool: boss leaves (no loot) and costs a heart", () => {
    const office = newOffice();
    const id = sid();
    const employee = seat(office, id);
    office.event(pre(id, "Bash", "t1"));
    tick(office, 31);
    expect(employee.boss).not.toBeNull();
    office.event(fail(id, "Bash", "t1"));
    expect(employee.boss).toBeNull();
    expect(employee.monLoot).toBe(false);
    expect(employee.hearts).toBe(MAX_HEARTS - 1);
    expect(employee.kills).toBe(0);
  });
});

describe("boss", () => {
  it("does not appear before 30s", () => {
    const office = newOffice();
    const id = sid();
    const employee = seat(office, id);
    office.event(pre(id, "Bash", "t1"));
    tick(office, 29);
    expect(employee.boss).toBeNull();
    expect(employee.pending.size).toBe(1);
  });

  it("PreToolUse pending > 30s after being seated spawns a boss + banner", () => {
    const office = newOffice();
    const id = sid();
    const employee = seat(office, id);
    office.event(pre(id, "Bash", "t1"));
    tick(office, 31);
    expect(employee.boss).not.toBeNull();
    expect(office.banners.some((banner) => banner.kind === "boss")).toBe(true);
    expect(office.statusOf(employee)).toContain("boss");
  });

  it("PostToolUse kills the boss: +10 gold, +1 kill, +25 xp (multi-level), respawn later", () => {
    const office = newOffice();
    const id = sid();
    const employee = seat(office, id);
    office.event(pre(id, "Bash", "t1"));
    tick(office, 31);
    office.event(post(id, "Bash", "t1"));
    expect(employee.boss).toBeNull();
    expect(employee.kills).toBe(1);
    expect(employee.gold).toBe(10);
    expect(office.treasury).toBe(10);
    expect(employee.monLoot).toBe(true);
    // 25 xp from lv1 (10) then lv2 (15) -> lv3 with 0 left
    expect(employee.lv).toBe(3);
    expect(employee.xp).toBe(0);
    expect(employee.pending.size).toBe(0);
    tick(office, 4);
    expect(employee.monDead).toBe(false);
    expect(employee.boss).toBeNull();
  });

  it("boss that started while a boss is up does not respawn another", () => {
    const office = newOffice();
    const id = sid();
    const employee = seat(office, id);
    office.event(pre(id, "Bash", "t1"));
    tick(office, 31);
    const at = employee.bossAt;
    tick(office, 20);
    expect(employee.bossAt).toBe(at);
  });

  it("Esc + new prompt (UserPromptSubmit) clears pending and the boss: no ghost boss", () => {
    const office = newOffice();
    const id = sid();
    const employee = seat(office, id);
    office.event(pre(id, "Bash", "t1"));
    tick(office, 31);
    expect(employee.boss).not.toBeNull();
    office.event(ev(id, "UserPromptSubmit"));
    expect(employee.boss).toBeNull();
    expect(employee.pending.size).toBe(0);
    expect(employee.monLoot).toBe(false);
    expect(employee.kills).toBe(0);
    tick(office, 60);
    expect(employee.boss).toBeNull();
    expect(employee.monDead).toBe(false);
  });

  it("Esc then prompt BEFORE 30s also leaves no boss later", () => {
    const office = newOffice();
    const id = sid();
    const employee = seat(office, id);
    office.event(pre(id, "Bash", "t1"));
    tick(office, 20);
    office.event(ev(id, "UserPromptSubmit"));
    tick(office, 60);
    expect(employee.boss).toBeNull();
  });

  it("Stop clears pending and sends the boss away without loot", () => {
    const office = newOffice();
    const id = sid();
    const employee = seat(office, id);
    office.event(pre(id, "Bash", "t1"));
    tick(office, 31);
    office.event(ev(id, "Stop"));
    expect(employee.boss).toBeNull();
    expect(employee.pending.size).toBe(0);
    expect(employee.monLoot).toBe(false);
    expect(employee.gold).toBe(0);
  });

  it.each(["Agent", "Task", "Workflow", "AskUserQuestion", "ExitPlanMode", "EnterPlanMode"])(
    "%s is never pending, so never a boss",
    (tool) => {
      const office = newOffice();
      const id = sid();
      const employee = seat(office, id);
      office.event(pre(id, tool, "t1"));
      expect(employee.pending.size).toBe(0);
      tick(office, 120);
      expect(employee.boss).toBeNull();
    },
  );

  it("Post for an Agent tool doesn't drop another tool's pending entry", () => {
    const office = newOffice();
    const id = sid();
    const employee = seat(office, id);
    office.event(pre(id, "Bash", "t1"));
    office.event(pre(id, "Agent", "t2"));
    office.event(post(id, "Agent", "t2"));
    expect(employee.pending.has("t1")).toBe(true);
  });

  it("a raised hand (permission wait) is not a boss fight, even after 100s", () => {
    const office = newOffice();
    const id = sid();
    const employee = seat(office, id);
    office.event(pre(id, "Bash", "t1"));
    office.event(ev(id, "PermissionRequest", { tool_name: "Bash" }));
    tick(office, 100);
    expect(employee.boss).toBeNull();
    expect(employee.act).toBe("handup");
  });

  it("after the permission is granted, the 30s clock starts over", () => {
    const office = newOffice();
    const id = sid();
    const employee = seat(office, id);
    office.event(pre(id, "Bash", "t1"));
    office.event(ev(id, "PermissionRequest", { tool_name: "Bash" }));
    tick(office, 100);
    office.event(pre(id, "Bash", "t1")); // tool resumes
    tick(office, 20);
    expect(employee.boss).toBeNull();
    tick(office, 15);
    expect(employee.boss).not.toBeNull();
  });

  it("handup notification (permission_prompt) doesn't count either", () => {
    const office = newOffice();
    const id = sid();
    const employee = seat(office, id);
    office.event(pre(id, "Edit", "t1"));
    office.event(ev(id, "Notification", { notification_type: "permission_prompt" }));
    tick(office, 90);
    expect(employee.boss).toBeNull();
  });

  it("parallel tools: pending tracked per id, boss measured from the oldest", () => {
    const office = newOffice();
    const id = sid();
    const employee = seat(office, id);
    office.event(pre(id, "Bash", "a"));
    tick(office, 20);
    office.event(pre(id, "Bash", "b"));
    expect(employee.pending.size).toBe(2);
    office.event(post(id, "Bash", "a"));
    expect(employee.pending.size).toBe(1);
    expect(employee.pending.has("b")).toBe(true);
    tick(office, 15);
    expect(employee.boss).toBeNull(); // b is only 15s old
    tick(office, 20);
    expect(employee.boss).not.toBeNull();
  });

  it("parallel tools: both finishing empties pending", () => {
    const office = newOffice();
    const id = sid();
    const employee = seat(office, id);
    office.event(pre(id, "Read", "a"));
    office.event(pre(id, "Read", "b"));
    office.event(post(id, "Read", "b"));
    office.event(post(id, "Read", "a"));
    expect(employee.pending.size).toBe(0);
  });

  it("keyless Pre/Post pair up (oldest synthetic key first)", () => {
    const office = newOffice();
    const id = sid();
    const employee = seat(office, id);
    office.event(pre(id, "Read"));
    office.event(pre(id, "Read"));
    expect(employee.pending.size).toBe(2);
    office.event(post(id, "Read"));
    expect(employee.pending.size).toBe(1);
    office.event(post(id, "Read"));
    expect(employee.pending.size).toBe(0);
  });

  it("pending is capped at 16", () => {
    const office = newOffice();
    const id = sid();
    const employee = seat(office, id);
    for (let i = 0; i < 30; i++) office.event(pre(id, "Read", "t" + i));
    expect(employee.pending.size).toBe(16);
    expect(employee.pending.has("t29")).toBe(true);
    expect(employee.pending.has("t0")).toBe(false);
  });

  it("an orphan boss killed when pending finished via the hit credits only once", () => {
    const office = newOffice();
    const id = sid();
    const employee = seat(office, id);
    office.event(pre(id, "Bash", "t1"));
    tick(office, 31);
    office.event(post(id, "Bash", "t1"));
    office.event(post(id, "Bash", "t1")); // duplicate Post: ordinary hit on the (dead) monster
    expect(employee.kills).toBe(1);
  });

  it("idle timeout is blocked while a tool is pending, so boss fights are not abandoned", () => {
    const office = newOffice();
    const id = sid();
    const employee = seat(office, id);
    office.event(pre(id, "Bash", "t1"));
    tick(office, 700, 1);
    expect(employee.state).toBe("SEATED");
  });

  it("no boss for campers (no desk/monster)", () => {
    const office = newOffice();
    const ids = Array.from({ length: 9 }, () => sid());
    for (const i of ids) office.event(ev(i, "SessionStart"));
    tick(office, 40);
    const camper = emp(office, ids[8]);
    office.event(pre(camper.id, "Bash", "t1"));
    tick(office, 60);
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
    const office = newOffice();
    const id = sid();
    const employee = seat(office, id);
    employee.xp = 9;
    employee.monHp = employee.monHpMax = 99;
    office.event(post(id, "Read"));
    expect(employee.lv).toBe(2);
    expect(employee.xp).toBe(1);
    expect(office.flash).toBeGreaterThan(0);
    expect(employee.lvlTo).toBe(2);
  });

  it("a big gain levels up several times in one go", () => {
    const office = newOffice();
    const id = sid();
    const employee = seat(office, id);
    employee.xp = 9;
    office.event(pre(id, "Bash", "t1"));
    tick(office, 31);
    office.event(post(id, "Bash", "t1")); // +25
    expect(employee.lv).toBe(3);
    expect(employee.xp).toBe(9 + 25 - 10 - 15);
  });

  it("xp roll range is 1..3 per hit", () => {
    const office = newOffice();
    const id = sid();
    const employee = seat(office, id);
    employee.monHp = employee.monHpMax = 99;
    fixedRandom(0);
    office.event(post(id, "Read"));
    expect(employee.xp).toBe(1);
    fixedRandom(0.99);
    office.event(post(id, "Read"));
    expect(employee.xp).toBe(1 + 3);
  });
});
