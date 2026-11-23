import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { dungeonSpotOf, dungeonStairsPoint, LORD_SPOTS } from "@/lib/office/dungeonScene";
import {
  KIND_LORD,
  LORD_GOLD,
  LORD_HP,
  LORD_KILLS,
  LORD_RESPAWN_S,
  RAID_FLOOR_KILLS,
  RAID_STAIRS_S,
  RAID_TOUGH_B2,
  type Employee,
} from "@/lib/office/engine";
import { DESK_COUNT } from "@/lib/office/layout";
import { MONSTER_KINDS } from "@/lib/office/palette";

import { emp, ev, fixedRandom, newOffice, sid, stubStorage, tick } from "./helpers";

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

const hit = (id: string, tool = "Bash") => {
  const key = sid("t");
  return [
    ev(id, "PreToolUse", { tool_name: tool, tool_use_id: key }),
    ev(id, "PostToolUse", { tool_name: tool, tool_use_id: key }),
  ];
};
const strike = (office: ReturnType<typeof newOffice>, id: string, tool = "Bash") => {
  for (const event of hit(id, tool)) office.event(event);
};

/** a full guild plus `raiders` overflow sessions, all inside the dungeon */
const withRaiders = (raiders: number) => {
  const office = newOffice();
  const ids = Array.from({ length: DESK_COUNT + raiders }, () => sid());
  for (const id of ids) office.event(ev(id, "SessionStart"));
  tick(office, 60);
  return { office, ids, raiderIds: ids.slice(DESK_COUNT) };
};

/** hit until the raider's current foe is dead, then let the next one step up (unless they started the stair walk) */
const killFoe = (office: ReturnType<typeof newOffice>, raider: Employee) => {
  for (let i = 0; i < 40 && raider.raid && raider.raid.hp > 0; i++) strike(office, raider.id);
  expect(raider.raid?.hp ?? 0).toBe(0);
};
const killFloor = (office: ReturnType<typeof newOffice>, raider: Employee) => {
  for (let kill = 0; kill < RAID_FLOOR_KILLS; kill++) {
    killFoe(office, raider);
    if (kill < RAID_FLOOR_KILLS - 1) tick(office, 2); // the next foe steps up
  }
};

/** put a raider straight onto floor 3 (the Lord's hall has no foe of its own) */
const sendToLord = (raider: Employee) => {
  raider.floor = 3;
  raider.floorKills = 0;
  raider.raid = null;
};

describe("dungeon floors: descending", () => {
  it("raiders start on B1 with a normal foe", () => {
    const { office, raiderIds } = withRaiders(1);
    const raider = emp(office, raiderIds[0]);
    expect(raider.floor).toBe(1);
    expect(raider.floorKills).toBe(0);
    expect(raider.stairsAt).toBe(-1);
    expect(raider.raid?.tough).toBe(1);
  });

  it("goes down the stairs after RAID_FLOOR_KILLS kills on a floor", () => {
    const { office, raiderIds } = withRaiders(1);
    const raider = emp(office, raiderIds[0]);
    for (let kill = 0; kill < RAID_FLOOR_KILLS - 1; kill++) {
      killFoe(office, raider);
      tick(office, 2);
      expect(raider.floor).toBe(1);
      expect(raider.stairsAt).toBe(-1);
    }
    killFoe(office, raider);
    expect(raider.floorKills).toBe(RAID_FLOOR_KILLS);
    expect(raider.stairsAt).toBeGreaterThanOrEqual(0);
    expect(raider.floor).toBe(1); // still on B1 while walking to the stairs
  });

  it("walks to the stairs spot, then appears on B2 with a tougher foe", () => {
    const { office, raiderIds } = withRaiders(1);
    const raider = emp(office, raiderIds[0]);
    killFloor(office, raider);
    const spot = dungeonSpotOf(raider.slot, 1);
    expect(office.raiderPoint(raider)).toEqual(spot);
    tick(office, RAID_STAIRS_S / 2);
    const half = office.raiderPoint(raider);
    const stairs = dungeonStairsPoint(1);
    expect(half.x).toBeLessThan(spot.x + 1);
    expect(Math.abs(half.x - stairs.x)).toBeLessThan(Math.abs(spot.x - stairs.x));
    // no fighting on the stairs
    const foeHp = raider.raid?.hp;
    strike(office, raiderIds[0]);
    expect(raider.raid?.hp).toBe(foeHp);
    tick(office, RAID_STAIRS_S);
    expect(raider.floor).toBe(2);
    expect(raider.stairsAt).toBe(-1);
    expect(raider.floorKills).toBe(0);
    expect(raider.raid?.hp).toBe(1);
    expect(raider.raid?.tough).toBe(RAID_TOUGH_B2);
    expect(["skeleton", "goblin", "mushroom"]).toContain(MONSTER_KINDS[raider.raid!.kind]);
    expect(office.raiderPoint(raider)).toEqual(dungeonSpotOf(raider.slot, 2));
  });

  it("a floor 2 foe takes more hits to kill than a floor 1 foe of the same kind", () => {
    const { office, raiderIds } = withRaiders(1);
    const raider = emp(office, raiderIds[0]);
    const count = () => {
      let hits = 0;
      while (raider.raid!.hp > 0 && hits < 100) {
        strike(office, raiderIds[0], "Read");
        hits++;
      }
      return hits;
    };
    raider.raid!.kind = MONSTER_KINDS.indexOf("skeleton");
    const onB1 = count();
    tick(office, 2);
    raider.floor = 2;
    raider.raid = { kind: MONSTER_KINDS.indexOf("skeleton"), hp: 1, hitAt: -99, deadAt: -99, tough: RAID_TOUGH_B2 };
    expect(count()).toBeGreaterThanOrEqual(onB1 * RAID_TOUGH_B2 - 2); // float rounding may cost an extra hit on either floor
  });

  it("B2 leads to B3: no foe of its own down there", () => {
    const { office, raiderIds } = withRaiders(1);
    const raider = emp(office, raiderIds[0]);
    raider.floor = 2;
    raider.raid = { kind: 0, hp: 1, hitAt: -99, deadAt: -99, tough: RAID_TOUGH_B2 };
    killFloor(office, raider);
    tick(office, RAID_STAIRS_S + 0.2);
    expect(raider.floor).toBe(3);
    expect(raider.raid).toBeNull();
    // there is nothing deeper: more hits never start another descent
    strike(office, raiderIds[0]);
    tick(office, 5);
    expect(raider.floor).toBe(3);
    expect(raider.stairsAt).toBe(-1);
  });
});

describe("dungeon floors: spots per floor", () => {
  it("maps the same slot to a different spot on each floor layout", () => {
    expect(dungeonSpotOf(0, 1)).toEqual(dungeonSpotOf(0, 2)); // B1 and B2 share the hall layout
    expect(dungeonSpotOf(0, 3)).toEqual(LORD_SPOTS[0]);
    expect(dungeonSpotOf(0, 3)).not.toEqual(dungeonSpotOf(0, 1));
    expect(dungeonSpotOf(5, 3)).toEqual(LORD_SPOTS[5]);
  });

  it("keeps the slot's spot when a raider changes floor, and follows the floor's own table", () => {
    const { office, raiderIds } = withRaiders(2);
    const raider = emp(office, raiderIds[1]);
    expect(office.raiderPoint(raider)).toEqual(dungeonSpotOf(raider.slot, 1));
    raider.floor = 3;
    expect(office.raiderPoint(raider)).toEqual(LORD_SPOTS[raider.slot]);
  });

  it("dungeonRaiders keeps its slot-then-arrival order whatever the floors", () => {
    const { office, raiderIds } = withRaiders(3);
    emp(office, raiderIds[0]).floor = 3;
    emp(office, raiderIds[2]).floor = 2;
    expect(office.dungeonRaiders().map((raider) => raider.id)).toEqual(raiderIds);
  });

  it("hit-testing only finds raiders on the floor on screen", () => {
    const { office, raiderIds } = withRaiders(2);
    const [first, second] = raiderIds.map((id) => emp(office, id));
    second.floor = 2;
    office.setScene("dungeon");
    office.setDungeonFloor(1);
    const spot = dungeonSpotOf(first.slot, 1);
    const other = dungeonSpotOf(second.slot, 2);
    expect(office.hit(spot.x, spot.y - 2)).toBe(first.id);
    expect(office.hit(other.x, other.y - 2)).toBeNull();
    office.setDungeonFloor(2);
    expect(office.hit(other.x, other.y - 2)).toBe(second.id);
    expect(office.hit(spot.x, spot.y - 2)).toBeNull();
  });
});

describe("dungeon floors: promotion resets the floor", () => {
  it("a raider promoted out of the dungeon starts over on B1", () => {
    const { office, ids } = withRaiders(1);
    const raider = emp(office, ids[DESK_COUNT]);
    raider.floor = 2;
    raider.floorKills = 3;
    office.event(ev(ids[0], "SessionEnd"));
    tick(office, 0.6);
    expect(raider.inDungeon).toBe(false);
    expect(raider.floor).toBe(1);
    expect(raider.floorKills).toBe(0);
    expect(raider.stairsAt).toBe(-1);
    expect(raider.raid).toBeNull();
  });

  it("a raider caught mid stair walk is reset too", () => {
    const { office, ids } = withRaiders(1);
    const raider = emp(office, ids[DESK_COUNT]);
    raider.stairsAt = office.clock;
    office.event(ev(ids[0], "SessionEnd"));
    tick(office, 0.6);
    expect(raider.inDungeon).toBe(false);
    expect(raider.stairsAt).toBe(-1);
  });
});

describe("the Dungeon Lord", () => {
  it("damage from every raider on floor 3 pools into one hp bar", () => {
    const { office, raiderIds } = withRaiders(2);
    const [first, second] = raiderIds.map((id) => emp(office, id));
    sendToLord(first);
    sendToLord(second);
    expect(office.lord.hp).toBe(1);
    strike(office, first.id); // Bash: heavy, 2 damage
    expect(office.lord.hp).toBeCloseTo(1 - 2 / LORD_HP, 6);
    strike(office, second.id, "Read"); // 1 damage
    expect(office.lord.hp).toBeCloseTo(1 - 3 / LORD_HP, 6);
    expect(office.lord.hitAt).toBe(office.clock);
    expect(first.kills).toBe(0); // raiders get kills only when the Lord falls
  });

  it("falls to the pooled hits, rewards everyone on floor 3 and writes a log entry", () => {
    const { office, raiderIds, ids } = withRaiders(3);
    const [first, second, third] = raiderIds.map((id) => emp(office, id));
    sendToLord(first);
    sendToLord(second); // third stays on B1
    const goldBefore = [first.gold, second.gold, third.gold];
    const treasury = office.treasury;
    const bosses = office.dungeonStats().bosses;
    for (let i = 0; i < LORD_HP && office.lord.hp > 0; i++) strike(office, i % 2 ? first.id : second.id, "Read");
    expect(office.lord.hp).toBe(0);
    expect(office.lord.slain).toBe(1);
    expect(first.gold).toBe(goldBefore[0] + LORD_GOLD);
    expect(second.gold).toBe(goldBefore[1] + LORD_GOLD);
    expect(third.gold).toBe(goldBefore[2]);
    expect(first.kills).toBe(LORD_KILLS);
    expect(second.kills).toBe(LORD_KILLS);
    expect(office.treasury).toBe(treasury + LORD_GOLD * 2);
    const stats = office.dungeonStats();
    expect(stats.bosses).toBe(bosses + 1);
    expect(stats.lordAlive).toBe(false);
    expect(stats.lordSlain).toBe(1);
    const entry = office.getView().log.find((row) => row.kind === KIND_LORD);
    expect(entry).toBeDefined();
    expect(entry!.text).toContain("Dungeon Lord");
    expect(ids).toContain(entry!.sid);
    // loot popups fly inside the dungeon scene
    expect(office.popups.some((popup) => popup.dungeon && popup.text === `+${LORD_GOLD}g`)).toBe(true);
  });

  it("stays down (hits do nothing, no second reward) until it rises after LORD_RESPAWN_S", () => {
    const { office, raiderIds } = withRaiders(1);
    const raider = emp(office, raiderIds[0]);
    sendToLord(raider);
    office.lord.hp = 1 / LORD_HP;
    strike(office, raider.id, "Read");
    expect(office.lord.hp).toBe(0);
    const gold = raider.gold;
    strike(office, raider.id);
    expect(raider.gold).toBe(gold);
    expect(office.lord.slain).toBe(1);
    tick(office, LORD_RESPAWN_S - 5);
    expect(office.lord.hp).toBe(0);
    expect(office.dungeonStats().lordAlive).toBe(false);
    tick(office, 6);
    expect(office.lord.hp).toBe(1);
    expect(office.dungeonStats().lordAlive).toBe(true);
    expect(office.lord.slain).toBe(1);
    strike(office, raider.id, "Read");
    expect(office.lord.hp).toBeLessThan(1);
  });

  it("a Live/Demo switch (clear) revives the Lord and forgets the floor", () => {
    const { office } = withRaiders(1);
    office.lord.hp = 0;
    office.lord.slain = 4;
    office.setDungeonFloor(3);
    office.clear();
    expect(office.lord.hp).toBe(1);
    expect(office.lord.slain).toBe(0);
    expect(office.dungeonFloor).toBe(1);
  });
});

describe("the floor on screen", () => {
  it("defaults to B1 and clamps to the three floors", () => {
    const office = newOffice();
    expect(office.dungeonFloor).toBe(1);
    expect(office.getView().dungeonFloor).toBe(1);
    office.setDungeonFloor(3);
    expect(office.dungeonFloor).toBe(3);
    office.setDungeonFloor(9);
    expect(office.dungeonFloor).toBe(3);
    office.setDungeonFloor(-4);
    expect(office.dungeonFloor).toBe(1);
  });

  it("opens on the floor with the most raiders", () => {
    const { office, raiderIds } = withRaiders(3);
    const [first, second, third] = raiderIds.map((id) => emp(office, id));
    first.floor = 3;
    second.floor = 3;
    third.floor = 2;
    expect(office.busiestFloor()).toBe(3);
    office.setScene("dungeon");
    expect(office.dungeonFloor).toBe(3);
    expect(office.getView().dungeonFloor).toBe(3);
  });

  it("opens on B1 when nobody is inside, and a tie goes to the shallower floor", () => {
    const { office, raiderIds } = withRaiders(2);
    expect(office.busiestFloor()).toBe(1);
    emp(office, raiderIds[0]).floor = 2;
    emp(office, raiderIds[1]).floor = 3;
    expect(office.busiestFloor()).toBe(2);
    expect(newOffice().busiestFloor()).toBe(1);
  });

  it("selecting a raider shows their floor", () => {
    const { office, raiderIds } = withRaiders(1);
    emp(office, raiderIds[0]).floor = 2;
    office.select(raiderIds[0]);
    expect(office.scene).toBe("dungeon");
    expect(office.dungeonFloor).toBe(2);
  });

  it("the gate stats count raiders per floor and the filter hides them", () => {
    const { office, raiderIds } = withRaiders(3);
    emp(office, raiderIds[0]).floor = 3;
    emp(office, raiderIds[1]).floor = 3;
    expect(office.dungeonStats().floorRaiders).toEqual([1, 0, 2]);
    expect(office.floorCounts()).toEqual([1, 0, 2]);
    office.setFilter({ query: "no-such-session-xyz", hideStray: false });
    expect(office.dungeonStats().floorRaiders).toEqual([0, 0, 0]);
  });

  it("a floor change is published to subscribers", () => {
    const office = newOffice();
    const seen: number[] = [];
    office.subscribe((view) => seen.push(view.dungeonFloor));
    office.setDungeonFloor(2);
    office.publish();
    expect(seen[seen.length - 1]).toBe(2);
  });
});
