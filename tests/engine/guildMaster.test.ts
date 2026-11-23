import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { bossCenterX, BOSS_H, BOSS_W } from "@/lib/office/bossSprites";
import { GM_HIT_ID, RAID_READY_CALLS, type AttentionMsgRow, type Employee } from "@/lib/office/engine";
import {
  CH_H,
  CH_W,
  GUILD_MASTER_HOME,
  guildMasterStand,
  monsterSpot,
  routeGuildMasterHome,
  spotOf,
  squirePoint,
} from "@/lib/office/layout";
import { MON_H, MON_W } from "@/lib/office/monsterSprites";

import { ev, fixedRandom, newOffice, seat, sid, stubStorage, tick } from "./helpers";

type Box = { x0: number; y0: number; x1: number; y1: number };

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

const IDLE_WAIT_S = 22;
const TALK_WAIT_S = 3.5;
const TRIP_LIMIT_S = 90;
const NEAR = 0.5;

const bell = (sessionId: string): AttentionMsgRow => ({
  key: `${sessionId}|loop|x`,
  sid: sessionId,
  kind: "loop",
  since: Date.now(),
});
/** tick until the guild master reaches `phase` (or the limit runs out) */
const until = (office: ReturnType<typeof newOffice>, phase: string, limit = TRIP_LIMIT_S) => {
  for (let elapsed = 0; elapsed < limit && office.guildMaster.phase !== phase; elapsed += 0.05) tick(office, 0.05);
};

describe("guild master", () => {
  it("starts at home and stays there while nobody is seated", () => {
    const office = newOffice();
    expect(office.guildMaster).toMatchObject({ x: GUILD_MASTER_HOME.x, y: GUILD_MASTER_HOME.y, phase: "home" });
    tick(office, IDLE_WAIT_S);
    expect(office.guildMaster.phase).toBe("home");
    expect(office.guildMaster.path).toEqual([]);
  });

  it("visits the adventurer who needs the user before anyone else", () => {
    const office = newOffice();
    const calm = seat(office, sid());
    const needy = seat(office, sid());
    office.setAttention([bell(needy.id)]);
    until(office, "out");
    expect(office.guildMaster.phase).not.toBe("home");
    expect(office.guildMaster.targetId).toBe(needy.id);
    expect(office.guildMaster.alert).toBe(true);
    expect(calm.id).not.toBe(needy.id);
  });

  it("walks beside the target, talks, then returns home", () => {
    const office = newOffice();
    const target = seat(office, sid());
    until(office, "talk");
    const master = office.guildMaster;
    const stand = guildMasterStand(target.deskIdx);
    expect(master.phase).toBe("talk");
    expect(master.alert).toBe(false);
    expect(Math.hypot(master.x - stand.x, master.y - stand.y)).toBeLessThan(NEAR);
    expect(master.x).toBeLessThan(target.x);
    expect(master.face).toBe(1);
    tick(office, TALK_WAIT_S);
    expect(master.phase).toBe("talk");
    until(office, "home");
    expect(master.phase).toBe("home");
    expect(Math.hypot(master.x - GUILD_MASTER_HOME.x, master.y - GUILD_MASTER_HOME.y)).toBeLessThan(NEAR);
    expect(master.targetId).toBe("");
  });

  it("gives up and goes home when the target ends mid-trip", () => {
    const office = newOffice();
    const sessionId = sid();
    seat(office, sessionId);
    until(office, "out");
    tick(office, 1);
    expect(office.guildMaster.phase).toBe("out");
    office.event(ev(sessionId, "SessionEnd"));
    tick(office, 1);
    expect(office.guildMaster.phase).toBe("back");
    expect(office.guildMaster.targetId).toBe("");
    until(office, "home");
    expect(office.guildMaster.phase).toBe("home");
  });

  it("stays at his post with reduced motion", () => {
    const office = newOffice();
    office.reducedMotion = true;
    seat(office, sid());
    tick(office, IDLE_WAIT_S * 2);
    expect(office.guildMaster).toMatchObject({ x: GUILD_MASTER_HOME.x, y: GUILD_MASTER_HOME.y, phase: "home" });
  });

  it("aborts when the target changes desk mid-walk", () => {
    const office = newOffice();
    const target = seat(office, sid());
    until(office, "out");
    tick(office, 1);
    expect(office.guildMaster.phase).toBe("out");
    target.deskIdx += 1;
    tick(office, 0.1);
    expect(office.guildMaster.phase).toBe("back");
    expect(office.guildMaster.targetDesk).toBe(-1);
  });

  it("cancels the visit when someone's boss is still walking out", () => {
    const office = newOffice();
    seat(office, sid());
    const other = seat(office, sid());
    until(office, "out");
    tick(office, 1);
    expect(office.guildMaster.phase).toBe("out");
    other.boss = "ogre" as never;
    other.bossPath = [{ x: 1, y: 1 }];
    tick(office, 0.1);
    expect(office.guildMaster.phase).toBe("back");
  });

  it("does not visit while a duel meeting point is next to the stand point", () => {
    const office = newOffice();
    const fighters: Employee[] = [];
    for (let i = 0; i < 6; i++) fighters.push(seat(office, sid()));
    const visitor = fighters[5];
    expect(visitor.deskIdx).toBe(5);
    const canVisit = (emp: Employee) => (office as unknown as { canVisit: (e: Employee) => boolean }).canVisit(emp);
    expect(canVisit(visitor)).toBe(true);
    office.duels.push({ l: fighters[0].id, r: fighters[1].id } as never);
    expect(canVisit(visitor)).toBe(false);
  });

  it("walks straight home when aborted on the first leg", () => {
    const office = newOffice();
    const sessionId = sid();
    seat(office, sessionId);
    until(office, "out");
    tick(office, 0.5);
    const master = office.guildMaster;
    expect(master.x).toBe(GUILD_MASTER_HOME.x);
    expect(master.y).toBeGreaterThan(GUILD_MASTER_HOME.y);
    office.event(ev(sessionId, "SessionEnd"));
    tick(office, 0.05);
    expect(master.phase).toBe("back");
    expect(master.path).toEqual([{ ...GUILD_MASTER_HOME }]);
    expect(routeGuildMasterHome(master.x, master.y)).toEqual([{ ...GUILD_MASTER_HOME }]);
  });

  it("stand point overlaps no squire, monster, boss or hearts / mana bar box", () => {
    const hits = (boxA: Box, boxB: Box) =>
      boxA.x0 < boxB.x1 && boxB.x0 < boxA.x1 && boxA.y0 < boxB.y1 && boxB.y0 < boxA.y1;
    const around = (x: number, y: number, width: number, height: number, up = 0): Box => ({
      x0: x - width / 2,
      x1: x + width / 2,
      y0: y - height - up,
      y1: y,
    });
    const MON_BAR = 7;
    const HEARTS_AND_MANA = { dx: -8, dy: 4, w: 16, h: 14 };
    for (let desk = 0; desk < 8; desk++) {
      const stand = guildMasterStand(desk);
      const master = around(stand.x, stand.y, CH_W, CH_H);
      const spot = spotOf(desk);
      const solids: Box[] = [
        around(spot.x, spot.y, CH_W, CH_H),
        around(squirePoint(desk, 0).x, squirePoint(desk, 0).y, CH_W, CH_H),
        around(squirePoint(desk, 1).x, squirePoint(desk, 1).y, CH_W, CH_H),
        around(monsterSpot(desk).x, monsterSpot(desk).y, MON_W, MON_H, MON_BAR),
        around(bossCenterX(monsterSpot(desk).x), monsterSpot(desk).y, BOSS_W, BOSS_H, MON_BAR),
        {
          x0: spot.x + HEARTS_AND_MANA.dx,
          x1: spot.x + HEARTS_AND_MANA.dx + HEARTS_AND_MANA.w,
          y0: spot.y + HEARTS_AND_MANA.dy,
          y1: spot.y + HEARTS_AND_MANA.dy + HEARTS_AND_MANA.h,
        },
      ];
      // a normal monster in the previous column (a boss there is blocked by canVisit instead)
      if (desk % 4 > 0) {
        const prev = monsterSpot(desk - 1);
        solids.push(around(prev.x, prev.y, MON_W, MON_H, MON_BAR));
      }
      for (const solid of solids) expect(hits(master, solid)).toBe(false);
    }
  });
});

/** let any calm patrol finish and keep him home until something urgent happens */
const calmDown = (office: ReturnType<typeof newOffice>) => {
  until(office, "home");
  office.guildMaster.until = office.clock + 1000;
};
const permission = (id: string) => ev(id, "Notification", { notification_type: "permission_prompt" } as never);
const asked = (sessionId: string): AttentionMsgRow => ({
  key: `${sessionId}|asked|x`,
  sid: sessionId,
  kind: "asked",
  since: Date.now(),
  tail: "which branch?",
});
const bells = (office: ReturnType<typeof newOffice>) => office.sfxQueue.filter((cue) => cue === "bell").length;

describe("guild master triage", () => {
  it("orders the report permission > question > loop > stuck > idle, oldest first", () => {
    const office = newOffice();
    const [perm, loop, ask, stuck, idle] = [sid(), sid(), sid(), sid(), sid()];
    seat(office, idle);
    tick(office, 310);
    for (const id of [perm, loop, ask, stuck]) seat(office, id);
    office.event(ev(stuck, "PreToolUse", { tool_name: "Bash", tool_use_id: "t1" } as never));
    tick(office, 95);
    office.event(permission(perm));
    office.setAttention([bell(loop), asked(ask)]);
    const rows = office.guildMasterReport();
    expect(rows.map((row) => row.reason)).toEqual(["permission", "question", "loop", "stuck", "idle"]);
    expect(rows.map((row) => row.id)).toEqual([perm, ask, loop, stuck, idle]);
    expect(rows[1].detail).toBe("which branch?");
    expect(rows[3].detail).toBe("Bash");
    expect(rows[3].since).toBeLessThan(office.clock);
  });

  it("sorts rows of one reason oldest first", () => {
    const office = newOffice();
    const [first, second] = [sid(), sid()];
    seat(office, first);
    seat(office, second);
    office.event(permission(second));
    tick(office, 3);
    office.event(permission(first));
    const rows = office.guildMasterReport();
    expect(rows.map((row) => row.id)).toEqual([second, first]);
  });

  it("dates a queue row from when it appeared, not from when he first read it", () => {
    const office = newOffice();
    const loopId = sid();
    seat(office, loopId);
    tick(office, 30);
    office.setAttention([{ ...bell(loopId), since: Date.now() - 15_000 }]);
    const [row] = office.guildMasterReport();
    expect(office.clock - row.since).toBeCloseTo(15, 0);
  });

  it("walks to the most urgent session first and shows its reason", () => {
    const office = newOffice();
    const [loopId, permId] = [sid(), sid()];
    seat(office, loopId);
    seat(office, permId);
    calmDown(office);
    office.setAttention([bell(loopId)]);
    office.event(permission(permId));
    until(office, "out");
    expect(office.guildMaster.targetId).toBe(permId);
    expect(office.gmTarget()).toBe(permId);
    until(office, "talk");
    expect(office.guildMaster.icon).toBe("permission");
    expect(office.guildMaster.reason).toBe("permission");
  });

  it("points at the dungeon gate for a raider instead of visiting", () => {
    const office = newOffice();
    const raider = seat(office, sid());
    calmDown(office);
    raider.raidIn = true;
    office.setAttention([bell(raider.id)]);
    until(office, "out");
    expect(office.guildMaster.mission).toBe("gate");
    until(office, "talk");
    expect(office.guildMaster.x).toBeGreaterThan(300);
  });

  it("hit() returns the guild master id on the guild scene and select ignores it", () => {
    const office = newOffice();
    const master = office.guildMaster;
    expect(office.hit(master.x, master.y - 5)).toBe(GM_HIT_ID);
    office.select(GM_HIT_ID);
    expect(office.selectedId).toBeNull();
    office.setScene("dungeon");
    expect(office.hit(master.x, master.y - 5)).not.toBe(GM_HIT_ID);
  });

  it("dispatcher: talks to a raid-ready adventurer, then escorts it to the gate", () => {
    const office = newOffice();
    const hero = seat(office, sid());
    calmDown(office);
    tick(office, 3);
    hero.raidCalls = RAID_READY_CALLS;
    tick(office, 0.1);
    expect(office.guildMaster.mission).toBe("dispatch");
    expect(hero.state).toBe("SEATED");
    until(office, "talk");
    expect(office.guildMaster.icon).toBe("sword");
    for (let i = 0; i < 400 && office.guildMaster.phase !== "escort"; i++) tick(office, 0.05);
    expect(office.guildMaster.phase).toBe("escort");
    expect(hero.state).toBe("TO_RAID");
    until(office, "home");
    expect(office.guildMaster.phase).toBe("home");
    expect(office.guildMaster.mission).toBe("none");
  });

  it("dispatcher: raid proceeds without escort when he is busy", () => {
    const office = newOffice();
    const hero = seat(office, sid());
    const other = seat(office, sid());
    calmDown(office);
    office.event(permission(other.id));
    tick(office, 3);
    hero.raidCalls = RAID_READY_CALLS;
    tick(office, 0.1);
    expect(hero.state).toBe("TO_RAID");
  });

  it("rings the door bell after 120 s of waiting, repeats every 20 s and stops when resolved", () => {
    const office = newOffice();
    const waiting = seat(office, sid());
    office.event(permission(waiting.id));
    tick(office, 100);
    expect(office.gmBellRinging).toBe(false);
    tick(office, 25);
    until(office, "talk", 60);
    for (let i = 0; i < 400 && !office.gmBellRinging; i++) tick(office, 0.05);
    expect(office.gmBellRinging).toBe(true);
    expect(office.guildMaster.mission).toBe("door");
    expect(office.guildMaster.icon).toBe("bell");
    const before = bells(office);
    tick(office, 41);
    expect(bells(office)).toBeGreaterThanOrEqual(before + 2);
    office.event(ev(waiting.id, "UserPromptSubmit"));
    tick(office, 1);
    expect(office.gmBellRinging).toBe(false);
    until(office, "home");
    expect(office.guildMaster.phase).toBe("home");
  });

  it("reduced motion: icon bubble above his post, static bell, no walking", () => {
    const office = newOffice();
    office.reducedMotion = true;
    const waiting = seat(office, sid());
    office.event(permission(waiting.id));
    tick(office, 1);
    expect(office.guildMaster.icon).toBe("permission");
    expect(office.guildMaster.phase).toBe("home");
    tick(office, 125);
    expect(office.guildMaster.icon).toBe("bell");
    expect(office.gmBellRinging).toBe(true);
    expect(office.guildMaster).toMatchObject({ x: GUILD_MASTER_HOME.x, y: GUILD_MASTER_HOME.y });
    office.event(ev(waiting.id, "UserPromptSubmit"));
    tick(office, 1);
    expect(office.gmBellRinging).toBe(false);
    expect(office.guildMaster.icon).toBeNull();
  });
});
