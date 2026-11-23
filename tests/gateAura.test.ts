import { readFileSync } from "node:fs";

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  drawGateAuraGround,
  drawGateAuraSky,
  drawGateAuraTop,
  GATE_AURA_BOLT_LANES,
  GATE_AURA_CHAR_COLUMN,
  BASE_TREE_BOXES,
  BASE_TREE_SPOTS,
  GATE_AURA_PROPS,
  GATE_AURA_SAFE_Y,
} from "@/lib/office/gateAura";
import {
  BRIDGE_X,
  WORLD_W,
  DUNGEON,
  GATE_MOUTH,
  GRID_COLS,
  routeBoss,
  routeFromDungeon,
  type Pt,
} from "@/lib/office/layout";

type Fill = { color: string; x: number; y: number; width: number; height: number; alpha: number };
const mockCtx = () => {
  const fills: Fill[] = [];
  const state: Record<string, unknown> = { fillStyle: "", globalAlpha: 1 };
  const images: unknown[][] = [];
  const ctx = new Proxy(state, {
    get: (target, key: string) => {
      if (key in target) return target[key];
      if (key === "fillRect")
        return (x: number, y: number, width: number, height: number) =>
          fills.push({ color: String(target.fillStyle), x, y, width, height, alpha: Number(target.globalAlpha) });
      if (key === "drawImage") return (...args: unknown[]) => images.push(args);
      return () => undefined;
    },
    set: (target, key: string, value) => {
      target[key] = value;
      return true;
    },
  });
  return { ctx: ctx as unknown as CanvasRenderingContext2D, fills, images };
};

afterEach(() => vi.unstubAllGlobals());

const runAll = (time: number, still: boolean, intensity: number) => {
  const mock = mockCtx();
  drawGateAuraSky(mock.ctx, time, still, intensity, 0.5);
  drawGateAuraGround(mock.ctx, time, still, intensity);
  drawGateAuraTop(mock.ctx, time, still, intensity);
  return mock;
};

describe("gate aura drawing", () => {
  it("draws on a context without a document", () => {
    vi.stubGlobal("document", undefined);
    for (const intensity of [0, 0.5, 1]) {
      const { fills } = runAll(3.2, false, intensity);
      expect(fills.length).toBeGreaterThan(50);
    }
  });

  it("caches through offscreen canvases when a document exists", () => {
    const layerCtx = mockCtx().ctx;
    const create = vi.fn(() => ({ width: 0, height: 0, getContext: () => layerCtx }));
    vi.stubGlobal("document", { createElement: create });
    const first = runAll(1, false, 0.3);
    const built = create.mock.calls.length;
    expect(built).toBeGreaterThan(0);
    expect(first.images.length).toBeGreaterThan(0);
    runAll(2, false, 0.3);
    expect(create.mock.calls.length).toBe(built);
  });

  it("is a static, deterministic frame under reduced motion", () => {
    vi.stubGlobal("document", undefined);
    const first = runAll(0, true, 0.6).fills;
    const later = runAll(987.65, true, 0.6).fills;
    expect(later).toEqual(first);
  });

  it("raises its menace with intensity (more eyes, more crows)", () => {
    vi.stubGlobal("document", undefined);
    const calm = mockCtx();
    drawGateAuraGround(calm.ctx, 0, true, 0);
    const angry = mockCtx();
    drawGateAuraGround(angry.ctx, 0, true, 1);
    expect(angry.fills.length).toBeGreaterThan(calm.fills.length);
    const few = mockCtx();
    drawGateAuraTop(few.ctx, 0, true, 0);
    const many = mockCtx();
    drawGateAuraTop(many.ctx, 0, true, 1);
    expect(many.fills.length).toBeGreaterThan(few.fills.length);
  });

  it("never fills the sky layer with translucent colour over the whole screen", () => {
    vi.stubGlobal("document", undefined);
    const mock = mockCtx();
    drawGateAuraSky(mock.ctx, 5, false, 1, 0);
    for (const fill of mock.fills) expect(fill.width * fill.height).toBeLessThan(80 * 40);
  });
});

describe("sky blends into the blue", () => {
  it("fades in with a ragged, non-straight left edge", () => {
    vi.stubGlobal("document", undefined);
    const mock = mockCtx();
    drawGateAuraSky(mock.ctx, 0, true, 0, 0);
    for (const fill of mock.fills) expect(fill.x).toBeGreaterThanOrEqual(236);
    const left = new Map<number, number>();
    for (const fill of mock.fills) {
      if (fill.width !== 1 || fill.height !== 1 || fill.y < 36 || fill.y > 46) continue;
      left.set(fill.y, Math.min(left.get(fill.y) ?? Infinity, fill.x));
    }
    const edges = [...left.values()];
    expect(edges.length).toBeGreaterThan(6);
    expect(new Set(edges).size).toBeGreaterThanOrEqual(4);
    expect(Math.max(...edges) - Math.min(...edges)).toBeGreaterThanOrEqual(6);
    const count = (x0: number, x1: number) =>
      mock.fills.filter((fill) => fill.width === 1 && fill.height === 1 && fill.y >= 36 && fill.x >= x0 && fill.x < x1)
        .length;
    expect(count(236, 248)).toBeLessThan(count(300, 312) / 2);
  });

  it("keeps the cloud mass inside its sky patch", () => {
    vi.stubGlobal("document", undefined);
    for (const intensity of [0, 1]) {
      const mock = mockCtx();
      drawGateAuraSky(mock.ctx, 7, false, intensity, 0.2);
      for (const fill of mock.fills) {
        expect(fill.x).toBeGreaterThanOrEqual(236);
        expect(fill.x + fill.width).toBeLessThanOrEqual(WORLD_W);
        expect(fill.y + fill.height).toBeLessThanOrEqual(52);
        expect(fill.alpha).toBe(1);
      }
    }
  });
});

describe("top layer stays clear of characters", () => {
  const checkFills = (time: number, still: boolean, intensity: number) => {
    vi.stubGlobal("document", undefined);
    const mock = mockCtx();
    drawGateAuraTop(mock.ctx, time, still, intensity);
    for (const fill of mock.fills) {
      const bottom = fill.y + fill.height;
      const clear =
        bottom <= GATE_AURA_SAFE_Y ||
        fill.x + fill.width <= GATE_AURA_CHAR_COLUMN.x0 ||
        fill.x >= GATE_AURA_CHAR_COLUMN.x1;
      expect(clear, `fill at ${fill.x},${fill.y} ${fill.width}x${fill.height} (t=${time})`).toBe(true);
      expect(fill.alpha).toBe(1);
      expect(bottom).toBeLessThanOrEqual(46);
    }
  };

  it("keeps every crow and bolt pixel above the boss column or beside it", () => {
    for (let time = 0; time < 120; time += 0.07) {
      for (const intensity of [0, 0.5, 1]) checkFills(time, false, intensity);
    }
    checkFills(0, true, 1);
  }, 60000);

  it("keeps the bolt lanes outside the boss column", () => {
    for (const lane of GATE_AURA_BOLT_LANES) {
      expect(lane.x1 <= GATE_AURA_CHAR_COLUMN.x0 || lane.x0 >= GATE_AURA_CHAR_COLUMN.x1).toBe(true);
    }
  });

  it("actually strikes lightning when not still", () => {
    vi.stubGlobal("document", undefined);
    const quiet = mockCtx();
    drawGateAuraTop(quiet.ctx, 5, false, 0);
    const strike = mockCtx();
    drawGateAuraTop(strike.ctx, 0.02, false, 0);
    expect(strike.fills.length).toBeGreaterThan(quiet.fills.length);
  });
});

describe("props", () => {
  const BOSS_DRAW_DX = 12;
  const MARGIN = 2;
  const sample = (pts: Pt[]): Pt[] => {
    const out: Pt[] = [];
    for (let i = 1; i < pts.length; i++) {
      const steps = Math.max(1, Math.ceil(Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y)));
      for (let step = 0; step <= steps; step++) {
        out.push({
          x: pts[i - 1].x + ((pts[i].x - pts[i - 1].x) * step) / steps,
          y: pts[i - 1].y + ((pts[i].y - pts[i - 1].y) * step) / steps,
        });
      }
    }
    return out;
  };

  it("sit clear of the boss and raider routes, the bridge and the gate mouth lane", () => {
    const routes: Pt[][] = [];
    for (let desk = 0; desk < GRID_COLS * 2; desk++) {
      routes.push(sample([GATE_MOUTH, ...routeBoss(desk).map((pt) => ({ x: pt.x + BOSS_DRAW_DX, y: pt.y }))]));
      routes.push(sample([GATE_MOUTH, ...routeFromDungeon(desk)]));
    }
    for (const prop of GATE_AURA_PROPS) {
      const box = { x0: prop.x - (prop.w >> 1) - MARGIN, x1: prop.x + (prop.w >> 1) + MARGIN };
      const top = prop.y - prop.h - MARGIN,
        bottom = prop.y + MARGIN;
      for (const route of routes) {
        for (const pt of route) {
          const inside = pt.x >= box.x0 && pt.x <= box.x1 && pt.y >= top && pt.y <= bottom;
          expect(inside, `${prop.kind} at ${prop.x},${prop.y} blocks the route at ${pt.x},${pt.y}`).toBe(false);
        }
      }
      // the bridge column and the lane straight down from the gate stay free
      const clearOfBridge = box.x1 < BRIDGE_X - 9 || box.x0 > BRIDGE_X + 9 || bottom < DUNGEON.y;
      expect(clearOfBridge, `${prop.kind} on the bridge column`).toBe(true);
      expect(prop.y).toBeLessThanOrEqual(71); // bosses walk the row y 75
    }
  });

  it("stay inside the world", () => {
    for (const prop of GATE_AURA_PROPS) {
      expect(prop.x + (prop.w >> 1)).toBeLessThanOrEqual(384);
      expect(prop.y - prop.h).toBeGreaterThan(0);
    }
  });
});

type Box = { x0: number; x1: number; y0: number; y1: number };
describe("clear of the base scene's green trees", () => {
  const overlap = (first: Box, second: Box) =>
    first.x0 < second.x1 && first.x1 > second.x0 && first.y0 < second.y1 && first.y1 > second.y0;

  it("keeps these tree spots in sync with render.ts", () => {
    const source = readFileSync("lib/office/render.ts", "utf8");
    for (const [x, y] of BASE_TREE_SPOTS) expect(source).toContain(`[${x}, ${y}],`);
  });

  it("never overlaps a prop with a base tree", () => {
    for (const prop of GATE_AURA_PROPS) {
      const box = { x0: prop.x - (prop.w >> 1), x1: prop.x + (prop.w >> 1) + 1, y0: prop.y - prop.h, y1: prop.y };
      for (const tree of BASE_TREE_BOXES) expect(overlap(box, tree), `${prop.kind} at ${prop.x},${prop.y}`).toBe(false);
    }
  });

  it("never draws a top-layer pixel (perched or circling crow, bolt) over a base tree", () => {
    vi.stubGlobal("document", undefined);
    for (const [time, still, intensity] of [
      [0, true, 1],
      [3, false, 0],
      [41.5, false, 1],
    ] as const) {
      const mock = mockCtx();
      drawGateAuraTop(mock.ctx, time, still, intensity);
      for (const fill of mock.fills) {
        const box = { x0: fill.x, x1: fill.x + fill.width, y0: fill.y, y1: fill.y + fill.height };
        for (const tree of BASE_TREE_BOXES) expect(overlap(box, tree), `fill ${fill.x},${fill.y}`).toBe(false);
      }
    }
  });

  it("draws the ground layer's props outside the base trees too", () => {
    vi.stubGlobal("document", undefined);
    const mock = mockCtx();
    drawGateAuraGround(mock.ctx, 0, true, 0);
    // mist wisps are translucent and may drift anywhere; every opaque pixel must be clear of the trees
    for (const fill of mock.fills.filter((fill) => fill.alpha === 1 && fill.y >= 30)) {
      const box = { x0: fill.x, x1: fill.x + fill.width, y0: fill.y, y1: fill.y + fill.height };
      for (const tree of BASE_TREE_BOXES) expect(overlap(box, tree), `fill ${fill.x},${fill.y}`).toBe(false);
    }
  });
});
