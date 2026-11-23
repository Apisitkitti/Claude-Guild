import { describe, expect, it } from "vitest";

import {
  CARD_TABLE,
  CAT_HIDE,
  CAT_NAP,
  CAT_NODES,
  DOG_POS,
  HALL_BLOCKS,
  HallLife,
  MOUSE_HOLE_A,
  MOUSE_HOLE_B,
  PATRON_SPOTS,
  PLANT_SPOTS,
  WINDOW,
  inRect,
  windowSky,
  type HallInput,
} from "@/lib/office/hallLife";
import {
  DOOR,
  DOOR_IN,
  GUILD_MASTER_HOME,
  TAVERN_OVERFLOW,
  routeChefServe,
  routeGuildMaster,
  routeIn,
  routeLeave,
  routeToFeast,
  routeToTavernSpot,
  type Pt,
} from "@/lib/office/layout";

/** deterministic rng (mulberry32) */
const seeded = (seed: number) => {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
};

const DAY: HallInput = { dt: 0.1, hour: 13, reduced: false, bossOut: false, busy: true, walkers: [] };
const STEP = 0.1;
const run = (hall: HallLife, seconds: number, input: Partial<HallInput> = {}, each?: () => void) => {
  const steps = Math.round(seconds / STEP);
  for (let i = 0; i < steps; i++) {
    hall.update({ ...DAY, ...input });
    each?.();
  }
};

/** distance from a point to a segment */
const segmentDistance = (point: Pt, from: Pt, to: Pt): number => {
  const dx = to.x - from.x,
    dy = to.y - from.y;
  const lengthSq = dx * dx + dy * dy;
  const k = lengthSq ? Math.max(0, Math.min(1, ((point.x - from.x) * dx + (point.y - from.y) * dy) / lengthSq)) : 0;
  return Math.hypot(point.x - (from.x + k * dx), point.y - (from.y + k * dy));
};
const ROUTES: Pt[][] = [
  routeIn(0, 0),
  routeIn(5, 0),
  routeLeave(100, 124),
  routeLeave(-40, 60),
  routeToTavernSpot(0, 0, TAVERN_OVERFLOW),
  [GUILD_MASTER_HOME, ...routeGuildMaster(0)],
  [GUILD_MASTER_HOME, ...routeGuildMaster(5)],
  [DOOR, DOOR_IN],
  routeChefServe(),
  ...Array.from({ length: 8 }, (_, seat) => routeToFeast(0, 0, seat)),
];
const LANE_CLEARANCE = 12;

describe("hall layout", () => {
  it("every standing spot is clear of furniture", () => {
    const spots = [
      ...PATRON_SPOTS.map((spot) => ({ x: spot.x, y: spot.y })),
      DOG_POS,
      MOUSE_HOLE_A,
      MOUSE_HOLE_B,
      ...CAT_NODES,
      ...PLANT_SPOTS,
    ];
    for (const spot of spots) for (const block of HALL_BLOCKS) expect(inRect(spot, block)).toBe(false);
  });

  it("regulars and the dog keep off every walk route", () => {
    for (const spot of PATRON_SPOTS) {
      const feet = { x: spot.x, y: spot.y };
      for (const route of ROUTES)
        for (let i = 1; i < route.length; i++)
          expect(segmentDistance(feet, route[i - 1], route[i])).toBeGreaterThanOrEqual(LANE_CLEARANCE);
    }
    for (const route of ROUTES)
      for (let i = 1; i < route.length; i++)
        expect(segmentDistance(DOG_POS, route[i - 1], route[i])).toBeGreaterThanOrEqual(LANE_CLEARANCE - 2);
    expect(inRect({ x: PATRON_SPOTS[1].x, y: PATRON_SPOTS[1].y }, CARD_TABLE)).toBe(false);
  });

  it("every leg of the cat's node line is clear of furniture", () => {
    const sample = 2;
    for (let i = 1; i < CAT_NODES.length; i++) {
      const from = CAT_NODES[i - 1],
        to = CAT_NODES[i];
      const length = Math.hypot(to.x - from.x, to.y - from.y);
      for (let dist = 0; dist <= length; dist += sample) {
        const k = dist / length;
        const point = { x: from.x + (to.x - from.x) * k, y: from.y + (to.y - from.y) * k };
        for (const block of HALL_BLOCKS) expect(inRect(point, block)).toBe(false);
      }
    }
  });

  it("the window sky is dark at night and bright at noon", () => {
    expect(windowSky(23)[0]).toBe("#0b1030");
    expect(windowSky(12)[0]).toBe("#59b0ee");
    expect(WINDOW.w).toBeGreaterThan(0);
  });
});

describe("hall life", () => {
  it("is deterministic for a seed", () => {
    const first = new HallLife(seeded(7)),
      second = new HallLife(seeded(7));
    run(first, 300);
    run(second, 300);
    expect(JSON.stringify([first.cat, first.mouse, first.patrons])).toBe(
      JSON.stringify([second.cat, second.mouse, second.patrons]),
    );
  });

  it("the cat and mouse never stand inside furniture over ten simulated minutes", () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const hall = new HallLife(seeded(seed));
      run(hall, 600, {}, () => {
        for (const block of HALL_BLOCKS) {
          expect(inRect(hall.cat, block)).toBe(false);
          if (hall.mouse.visible) expect(inRect(hall.mouse, block)).toBe(false);
        }
      });
    }
  });

  it("the cat naps, wanders, and sometimes chases the mouse", () => {
    const modes = new Set<string>();
    for (const seed of [11, 12, 13, 14, 15, 16]) {
      const hall = new HallLife(seeded(seed));
      run(hall, 900, {}, () => modes.add(hall.cat.mode));
    }
    expect(modes.has("nap")).toBe(true);
    expect(modes.has("walk")).toBe(true);
    expect(modes.has("chase")).toBe(true);
  });

  it("patrons sip now and then, raise their mugs on a toast and settle again", () => {
    const hall = new HallLife(seeded(3));
    const poses = new Set<string>();
    run(hall, 120, {}, () => hall.patrons.forEach((patron) => poses.add(patron.pose)));
    expect(poses.has("sip")).toBe(true);
    hall.toast();
    run(hall, 0.2);
    expect(hall.patrons[0].pose).toBe("toast");
    run(hall, 5);
    expect(hall.patrons.every((patron) => patron.pose !== "toast")).toBe(true);
  });

  it("a boss outside startles the regulars, sends the cat to hide, and everyone calms down afterwards", () => {
    const hall = new HallLife(seeded(9));
    run(hall, 5);
    run(hall, 25, { bossOut: true });
    expect(hall.patrons.every((patron) => patron.pose === "alert")).toBe(true);
    expect(hall.cat.mode).toBe("scared");
    expect(hall.cat.node).toBe(CAT_HIDE);
    expect(hall.dog.awake).toBe(true);
    run(hall, 8);
    expect(hall.patrons.every((patron) => patron.pose !== "alert")).toBe(true);
    expect(hall.cat.mode).not.toBe("scared");
  });

  it("a quiet night: candles burn low and the cat sleeps at the hearth; a busy night keeps them lit", () => {
    const hall = new HallLife(seeded(5));
    run(hall, 120, { hour: 23, busy: false });
    expect(hall.quiet).toBe(true);
    expect(hall.candle).toBeLessThan(0.5);
    expect(hall.cat.mode).toBe("nap");
    expect(hall.cat.node).toBe(CAT_NAP);
    expect(hall.cat.asleep).toBe(true);
    const busy = new HallLife(seeded(5));
    run(busy, 120, { hour: 23, busy: true });
    expect(busy.quiet).toBe(false);
    expect(busy.candle).toBe(1);
    const day = new HallLife(seeded(5));
    run(day, 120, { hour: 13, busy: false });
    expect(day.quiet).toBe(false);
  });

  it("the dog wakes and wags when someone walks by, then dozes off again", () => {
    const hall = new HallLife(seeded(2));
    run(hall, 1);
    expect(hall.dog.awake).toBe(false);
    run(hall, 0.5, { walkers: [{ x: DOG_POS.x + 12, y: DOG_POS.y + 8 }] });
    expect(hall.dog.awake).toBe(true);
    run(hall, 4, { walkers: [{ x: 200, y: 100 }] });
    expect(hall.dog.awake).toBe(false);
  });

  it("reduced motion: static poses, the cat stays curled up, no mouse", () => {
    const hall = new HallLife(seeded(4));
    const before = JSON.stringify([hall.cat.x, hall.cat.y]);
    run(hall, 200, { reduced: true, walkers: [{ x: DOG_POS.x, y: DOG_POS.y }] }, () => {
      expect(hall.mouse.visible).toBe(false);
      expect(hall.patrons.every((patron) => patron.pose === "idle")).toBe(true);
      expect(hall.dog.awake).toBe(false);
      expect(hall.cat.mode).toBe("nap");
    });
    expect(JSON.stringify([hall.cat.x, hall.cat.y])).toBe(before);
  });

  it("reset puts everything back", () => {
    const hall = new HallLife(seeded(6));
    run(hall, 60, { bossOut: true });
    hall.reset();
    expect(hall.cat.mode).toBe("nap");
    expect(hall.patrons.every((patron) => patron.pose === "idle")).toBe(true);
    expect(hall.candle).toBe(1);
  });
});
