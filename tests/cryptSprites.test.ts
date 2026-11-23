import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CRYPT_FRAMES, CRYPT_H, CRYPT_KINDS, CRYPT_W, cryptSprite } from "@/lib/office/cryptSprites";
import { MON_H, MON_W } from "@/lib/office/monsterSprites";

const fakeCanvas = () => {
  const cells = new Map<string, string>();
  const ctx = {
    fillStyle: "",
    fillRect: (x: number, y: number) => {
      cells.set(`${x},${y}`, ctx.fillStyle);
    },
  };
  return { width: 0, height: 0, cells, getContext: () => ctx };
};
const cellsOf = (sprite: HTMLCanvasElement): Map<string, string> =>
  (sprite as unknown as { cells: Map<string, string> }).cells;
const diff = (spriteA: HTMLCanvasElement, spriteB: HTMLCanvasElement): number => {
  const cellsA = cellsOf(spriteA),
    cellsB = cellsOf(spriteB);
  let count = 0;
  for (const key of new Set([...cellsA.keys(), ...cellsB.keys()])) if (cellsA.get(key) !== cellsB.get(key)) count++;
  return count;
};
const HEX = /^#[0-9a-f]{6}$/;
const FRAMES = Array.from({ length: CRYPT_FRAMES }, (_, i) => i);
const lumaOf = (color: string) => {
  const rgb = parseInt(color.slice(1), 16);
  return 0.3 * ((rgb >>> 16) & 255) + 0.59 * ((rgb >>> 8) & 255) + 0.11 * (rgb & 255);
};

describe("crypt sprites", () => {
  beforeEach(() => {
    vi.stubGlobal("document", { createElement: () => fakeCanvas() });
  });
  afterEach(() => vi.unstubAllGlobals());

  it("is four undead, bigger than the B1 monsters, with four frames", () => {
    expect(CRYPT_KINDS).toHaveLength(4);
    expect(CRYPT_FRAMES).toBe(4);
    expect(CRYPT_W).toBeGreaterThan(MON_W);
    expect(CRYPT_H).toBeGreaterThan(MON_H);
  });

  it("builds every kind / frame / hurt on a 24x24 canvas with opaque hex colours only", () => {
    for (const kind of CRYPT_KINDS)
      for (const frame of FRAMES)
        for (const hurt of [false, true]) {
          const sprite = cryptSprite(kind, frame, hurt);
          expect(sprite.width).toBe(CRYPT_W);
          expect(sprite.height).toBe(CRYPT_H);
          const cells = cellsOf(sprite);
          expect(cells.size).toBeGreaterThan(120);
          for (const [key, color] of cells) {
            expect(color).toMatch(HEX);
            const [x, y] = key.split(",").map(Number);
            expect(x).toBeGreaterThanOrEqual(0);
            expect(y).toBeLessThan(CRYPT_H);
          }
        }
  });

  it("is closed by a dark outline: the hurt flash keeps it dark, the last row is outline only", () => {
    for (const kind of CRYPT_KINDS)
      for (const frame of FRAMES) {
        const hurt = cellsOf(cryptSprite(kind, frame, true));
        const dark = [...hurt.values()].filter((color) => lumaOf(color) < 85).length;
        expect(dark).toBeGreaterThan(40);
        for (const [key, color] of hurt) if (key.endsWith(`,${CRYPT_H - 1}`)) expect(lumaOf(color)).toBeLessThan(85);
      }
  });

  it("animates: idle pair and attack pair all differ", () => {
    for (const kind of CRYPT_KINDS)
      for (let lo = 0; lo < CRYPT_FRAMES; lo++)
        for (let hi = lo + 1; hi < CRYPT_FRAMES; hi++)
          expect(diff(cryptSprite(kind, lo, false), cryptSprite(kind, hi, false))).toBeGreaterThan(3);
  });

  it("each kind has its own silhouette", () => {
    for (let lo = 0; lo < CRYPT_KINDS.length; lo++)
      for (let hi = lo + 1; hi < CRYPT_KINDS.length; hi++) {
        const keysA = new Set(cellsOf(cryptSprite(CRYPT_KINDS[lo], 0, false)).keys());
        const keysB = [...cellsOf(cryptSprite(CRYPT_KINDS[hi], 0, false)).keys()];
        expect(keysB.filter((key) => !keysA.has(key)).length).toBeGreaterThan(30);
        expect(diff(cryptSprite(CRYPT_KINDS[lo], 0, false), cryptSprite(CRYPT_KINDS[hi], 0, false))).toBeGreaterThan(
          150,
        );
      }
  });

  it("hurt keeps the same cells but is lighter overall", () => {
    for (const kind of CRYPT_KINDS) {
      const calm = cellsOf(cryptSprite(kind, 0, false)),
        hurt = cellsOf(cryptSprite(kind, 0, true));
      expect([...hurt.keys()].sort()).toEqual([...calm.keys()].sort());
      const sum = (cells: Map<string, string>) =>
        [...cells.values()].reduce((total, color) => total + lumaOf(color), 0);
      expect(sum(hurt)).toBeGreaterThan(sum(calm));
    }
  });

  it("the revenant is bone, iron and verdigris: no skin tones", () => {
    for (const frame of FRAMES) {
      for (const color of cellsOf(cryptSprite("revenant", frame, false)).values()) {
        const rgb = parseInt(color.slice(1), 16);
        const red = (rgb >>> 16) & 255,
          green = (rgb >>> 8) & 255,
          blue = rgb & 255;
        expect(red > 185 && green > 130 && green < 205 && blue > 90 && blue < 175 && red - blue > 55).toBe(false);
      }
    }
  });

  it("caches and wraps frames (negative, NaN, past the end)", () => {
    for (const kind of CRYPT_KINDS) {
      expect(cryptSprite(kind, 1, false)).toBe(cryptSprite(kind, 1, false));
      expect(cryptSprite(kind, 1 + CRYPT_FRAMES, false)).toBe(cryptSprite(kind, 1, false));
      expect(cryptSprite(kind, -1, false)).toBe(cryptSprite(kind, CRYPT_FRAMES - 1, false));
      expect(cryptSprite(kind, NaN, false)).toBe(cryptSprite(kind, 0, false));
    }
  });
});
