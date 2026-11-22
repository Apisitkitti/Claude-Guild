import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { BOSS_DX, BOSS_FRAMES, BOSS_H, BOSS_W, bossCenterX, bossSprite } from "@/lib/office/bossSprites";
import {
  CH_H,
  CH_W,
  DESK_COUNT,
  GATE_MOUTH,
  GRID_COLS,
  WORLD_W,
  monsterSpot,
  routeBoss,
  spotOf,
  type Pt,
} from "@/lib/office/layout";
import { BOSS_KINDS } from "@/lib/office/palette";

/** a fake canvas that records every pixel it is asked to paint */
const fakeCanvas = () => {
  const ops: string[] = [];
  const ctx = {
    fillStyle: "",
    fillRect: (x: number, y: number) => {
      ops.push(`${x},${y},${ctx.fillStyle}`);
    },
  };
  return { width: 0, height: 0, ops, getContext: () => ctx };
};
const opsOf = (sprite: HTMLCanvasElement): string[] => (sprite as unknown as { ops: string[] }).ops;
const pixelsOf = (sprite: HTMLCanvasElement): string => opsOf(sprite).join("|");
const frames = [0, 1, 2, 3];

describe("boss sprites", () => {
  beforeEach(() => {
    vi.stubGlobal("document", { createElement: () => fakeCanvas() });
  });
  afterEach(() => vi.unstubAllGlobals());

  it("has three boss kinds", () => {
    expect([...BOSS_KINDS].sort()).toEqual(["dragon", "lich", "ogre"]);
  });

  it("builds every kind, frame and hurt variant at the shared size", () => {
    for (const kind of BOSS_KINDS)
      for (const hurt of [false, true])
        for (const frame of frames) {
          const sprite = bossSprite(kind, frame, hurt);
          expect(sprite.width).toBe(BOSS_W);
          expect(sprite.height).toBe(BOSS_H);
          expect(opsOf(sprite).length).toBeGreaterThan(150);
        }
    expect(BOSS_FRAMES).toBe(frames.length);
  });

  it("caches sprites and wraps frame numbers", () => {
    for (const kind of BOSS_KINDS) {
      expect(bossSprite(kind, 1, false)).toBe(bossSprite(kind, 5, false));
      expect(bossSprite(kind, 0, true)).toBe(bossSprite(kind, -4, true));
    }
  });

  it("animates: every frame is different", () => {
    for (const kind of BOSS_KINDS)
      expect(new Set(frames.map((frame) => pixelsOf(bossSprite(kind, frame, false)))).size).toBe(4);
  });

  it("kinds have different silhouettes", () => {
    expect(new Set(BOSS_KINDS.map((kind) => pixelsOf(bossSprite(kind, 0, false)))).size).toBe(BOSS_KINDS.length);
  });

  it("hurt frame differs, is lighter and fully opaque", () => {
    const brightness = (sprite: HTMLCanvasElement) => {
      const colors = opsOf(sprite).map((op) => op.split(",")[2]);
      return (
        colors.reduce((sum, color) => sum + parseInt(color.slice(1, 3), 16) + parseInt(color.slice(3, 5), 16), 0) /
        colors.length
      );
    };
    for (const kind of BOSS_KINDS)
      for (const frame of frames) {
        const normal = bossSprite(kind, frame, false);
        const hurt = bossSprite(kind, frame, true);
        expect(pixelsOf(hurt)).not.toBe(pixelsOf(normal));
        expect(brightness(hurt)).toBeGreaterThan(brightness(normal));
        for (const op of opsOf(hurt)) expect(op.split(",")[2]).toMatch(/^#[0-9a-f]{6}$/);
      }
  });

  it("plants its feet on the bottom row and keeps the border for the outline", () => {
    for (const kind of BOSS_KINDS) {
      const feet = opsOf(bossSprite(kind, 0, false)).filter((op) => op.split(",")[1] === String(BOSS_H - 1));
      expect(feet.length).toBeGreaterThan(3);
    }
  });
});

describe("boss placement", () => {
  const BOSS_HALF = BOSS_W / 2;
  const walked = (desk: number) => {
    const out: Pt[] = [];
    let at: Pt = { ...GATE_MOUTH };
    for (const next of routeBoss(desk)) {
      const steps = Math.ceil(Math.hypot(next.x - at.x, next.y - at.y));
      for (let i = 1; i <= steps; i++)
        out.push({ x: at.x + ((next.x - at.x) * i) / steps, y: at.y + ((next.y - at.y) * i) / steps });
      at = next;
    }
    return out;
  };

  it("never draws a boss past the right edge of the world", () => {
    for (let desk = 0; desk < DESK_COUNT; desk++)
      for (const point of walked(desk)) {
        expect(bossCenterX(point.x) + BOSS_HALF).toBeLessThanOrEqual(WORLD_W);
        expect(bossCenterX(point.x) - BOSS_HALF).toBeGreaterThanOrEqual(0);
      }
    expect(bossCenterX(100)).toBe(100 + BOSS_DX);
    expect(bossCenterX(WORLD_W)).toBe(WORLD_W - BOSS_HALF);
  });

  it("walks the bank and road without touching any other fight spot's adventurer or monster", () => {
    for (let desk = 0; desk < DESK_COUNT; desk++)
      for (const point of walked(desk)) {
        const left = bossCenterX(point.x) - BOSS_HALF,
          right = bossCenterX(point.x) + BOSS_HALF;
        for (let other = 0; other < DESK_COUNT; other++) {
          if (other === desk) continue;
          const spot = spotOf(other);
          const monster = monsterSpot(other);
          // adventurer box, then the monster box (20px wide, 20 tall, plus its HP bar)
          const boxes = [
            { x0: spot.x - CH_W / 2, x1: spot.x + CH_W / 2, y0: spot.y - CH_H, y1: spot.y },
            { x0: monster.x - 10, x1: monster.x + 10, y0: monster.y - 26, y1: monster.y },
          ];
          for (const box of boxes) {
            const overlaps = right > box.x0 && left < box.x1 && point.y > box.y0 && point.y - BOSS_H < box.y1;
            expect(overlaps, `desk ${desk} at ${point.x},${point.y} vs desk ${other}`).toBe(false);
          }
        }
      }
  });

  it("stops with a clear gap from its own adventurer (except where the world edge squeezes it)", () => {
    for (let desk = 0; desk < DESK_COUNT; desk++) {
      const spot = spotOf(desk);
      const left = bossCenterX(monsterSpot(desk).x) - BOSS_HALF;
      expect(left - (spot.x + CH_W / 2)).toBeGreaterThanOrEqual(desk % GRID_COLS === GRID_COLS - 1 ? -6 : 8);
    }
  });

  it("a hurt boss keeps its outline dark", () => {
    const outlineAt = (sprite: HTMLCanvasElement) =>
      new Map(
        opsOf(sprite).map((op) => {
          const [x, y, color] = op.split(",");
          return [`${x},${y}`, 0.3 * parseInt(color.slice(1, 3), 16) + 0.59 * parseInt(color.slice(3, 5), 16)] as const;
        }),
      );
    for (const kind of BOSS_KINDS)
      for (const frame of frames) {
        const normal = outlineAt(bossSprite(kind, frame, false));
        const hurt = outlineAt(bossSprite(kind, frame, true));
        for (const [at, value] of normal) if (value < 30) expect(hurt.get(at)).toBeLessThan(40);
      }
  });
});
