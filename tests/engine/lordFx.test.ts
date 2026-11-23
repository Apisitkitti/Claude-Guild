import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DUNGEON_FLOORS } from "@/lib/office/dungeonScene";
import { type Employee } from "@/lib/office/engine";
import { DESK_COUNT } from "@/lib/office/layout";
import { LORD_DEATH_S } from "@/lib/office/lordFight";
import {
  drawCritOutline,
  drawEyeFlare,
  drawLordAura,
  drawLordBlaze,
  drawLordDeath,
  drawLordFloorFx,
  drawMeteor,
  drawMinion,
  drawSlashes,
  drawTaunt,
} from "@/lib/office/lordFx";
import { drawScene } from "@/lib/office/render";

import { emp, ev, fixedRandom, newOffice, sid, stubStorage, tick } from "./helpers";

/** a drawing context that accepts everything and remembers every opacity it was set to and every rect */
const recorder = () => {
  const alphas: number[] = [];
  const rects: { x: number; y: number; w: number; h: number; fill: string }[] = [];
  const store: Record<string, unknown> = { globalAlpha: 1, fillStyle: "#000" };
  const ctx = new Proxy(store, {
    get: (target, key: string) => {
      if (key === "fillRect")
        return (x: number, y: number, width: number, height: number) =>
          rects.push({ x, y, w: width, h: height, fill: String(target.fillStyle) });
      if (key === "createRadialGradient" || key === "createLinearGradient")
        return () => ({ addColorStop: () => undefined });
      if (key === "measureText") return () => ({ width: 40 });
      if (key in target) return target[key];
      return () => undefined;
    },
    set: (target, key: string, value) => {
      if (key === "globalAlpha") alphas.push(value as number);
      target[key] = value;
      return true;
    },
  }) as unknown as CanvasRenderingContext2D;
  return { ctx, alphas, rects };
};
const fakeCanvas = () => ({
  width: 0,
  height: 0,
  getContext: () => recorder().ctx,
});

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
  stubStorage();
  fixedRandom(0.5);
  vi.stubGlobal("document", { createElement: () => fakeCanvas() });
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const lordFight = (raiders = 2) => {
  const office = newOffice();
  const ids = Array.from({ length: DESK_COUNT + raiders }, () => sid());
  for (const id of ids) office.event(ev(id, "SessionStart"));
  tick(office, 60);
  const fighters: Employee[] = ids.slice(DESK_COUNT).map((id) => emp(office, id));
  for (const raider of fighters) {
    raider.floor = DUNGEON_FLOORS;
    raider.raid = null;
  }
  tick(office, 2);
  office.setScene("dungeon");
  office.setDungeonFloor(DUNGEON_FLOORS);
  return { office, fighters };
};

describe("Dungeon Lord fight drawing", () => {
  it("the whole scene draws through a fight (every attack, the enrage, the death) without throwing", () => {
    const { office, fighters } = lordFight(3);
    const { ctx } = recorder();
    const hit = () => {
      const key = sid("t");
      office.event(ev(fighters[0].id, "PreToolUse", { tool_name: "Bash", tool_use_id: key }));
      office.event(ev(fighters[0].id, "PostToolUse", { tool_name: "Bash", tool_use_id: key }));
    };
    const seen = new Set<number>();
    let calls = 0;
    vi.spyOn(Math, "random").mockImplementation(() => (calls++ * 0.37) % 1); // varied, but the same every run
    for (let step = 0; step < 900; step++) {
      tick(office, 0.1);
      if (step % 12 === 0 && office.lord.hp > 0) hit();
      if (office.lord.atk.kind >= 0) seen.add(office.lord.atk.kind);
      drawScene(ctx, office);
    }
    expect(office.lord.slain).toBeGreaterThan(0);
    expect(seen.size).toBeGreaterThanOrEqual(3);
    // the guild scene with the live inset, and the reduced-motion variants
    office.setScene("guild");
    office.lord.hp = 0.4;
    office.lord.enragedAt = office.clock;
    drawScene(ctx, office);
    office.reducedMotion = true;
    office.setScene("dungeon");
    for (let step = 0; step < 40; step++) {
      tick(office, 0.25);
      drawScene(ctx, office);
    }
  });

  it("the Lord's effects never draw translucent", () => {
    const { office } = lordFight(2);
    const lord = office.lord;
    const { ctx, alphas, rects } = recorder();
    lord.enragedAt = 1;
    lord.introAt = office.clock - 0.5;
    lord.atk.count = 2;
    for (let kind = 0; kind < 4; kind++) {
      Object.assign(lord.atk, {
        kind,
        startAt: 10,
        hitAt: 10.9,
        endAt: 13,
        tx: 150,
        ty: 120,
        landed: false,
        targetId: "",
      });
      for (const meteor of lord.meteors)
        Object.assign(meteor, { on: kind === 3, x: 180, y: 130, at: 11.2, landed: false });
      for (const time of [10.2, 10.7, 11.0, 11.3, 12.5]) {
        drawLordFloorFx(ctx, office, time, false);
        drawLordFloorFx(ctx, office, time, true);
      }
    }
    for (const minion of lord.minions) Object.assign(minion, { on: true, x: 220, y: 130, bornAt: 10, clearedAt: -99 });
    for (const time of [10.1, 10.4, 11, 12]) drawMinion(ctx, lord.minions[0], time, false, 0);
    lord.minions[0].clearedAt = 11;
    drawMinion(ctx, lord.minions[0], 11.1, false, 0);
    drawMeteor(ctx, lord.meteors[0], 11.1, false);
    drawLordAura(ctx, 260, 120, 3, false);
    drawLordBlaze(ctx, 260, 120, 3, false);
    drawEyeFlare(ctx, 250, 80, 262, 80, 3, false);
    lord.slashes.forEach((slash, index) =>
      Object.assign(slash, { at: 5 - index * 0.01, shape: index % 3, crit: index % 2 === 0 }),
    );
    drawSlashes(ctx, lord, 5.05, 262, 120);
    drawTaunt(ctx, lord, lord.introAt + 1, 240, 64, 1);
    lord.hp = 0;
    lord.deadAt = 20;
    for (const time of [20.1, 20.6, 21.5, 22.2, 22.4]) drawLordDeath(ctx, office, time, false, 262, 120);
    drawCritOutline(ctx, document.createElement("canvas") as HTMLCanvasElement, 10, 10);
    expect(rects.length).toBeGreaterThan(300);
    expect(alphas.filter((alpha) => alpha < 1)).toEqual([]);
  });

  it("reduced motion draws the attack warnings static (identical at any time)", () => {
    const { office } = lordFight(1);
    const lord = office.lord;
    Object.assign(lord.atk, { kind: 1, startAt: 10, hitAt: 10.9, endAt: 12, tx: 150, ty: 120, landed: false });
    const first = recorder(),
      second = recorder();
    drawLordFloorFx(first.ctx, office, 10.1, true);
    drawLordFloorFx(second.ctx, office, 10.6, true);
    expect(first.rects.length).toBeGreaterThan(5);
    expect(second.rects).toEqual(first.rects);
    // while the live version marches
    const moving = recorder();
    drawLordFloorFx(moving.ctx, office, 10.15, false);
    expect(moving.rects).not.toEqual(first.rects);
  });

  it("the death sequence draws nothing before the hit or after the burst", () => {
    const { office } = lordFight(1);
    const lord = office.lord;
    lord.hp = 0;
    lord.deadAt = 20;
    const before = recorder();
    drawLordDeath(before.ctx, office, 19, false, 262, 120);
    expect(before.rects).toHaveLength(0);
    const during = recorder();
    drawLordDeath(during.ctx, office, 21.5, false, 262, 120);
    expect(during.rects.length).toBeGreaterThan(20); // the cracks of light
    lord.finaleAt = 20 + LORD_DEATH_S;
    const after = recorder();
    drawLordDeath(after.ctx, office, 23, false, 262, 120);
    expect(after.rects).toHaveLength(0);
  });
});
