import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  PATRON_FRAMES,
  PATRON_H,
  PATRON_KINDS,
  PATRON_POSES,
  PATRON_W,
  patronSprite,
} from "@/lib/office/patronSprites";
import {
  CAT_FRAMES,
  CAT_H,
  CAT_W,
  DOG_FRAMES,
  DOG_H,
  DOG_W,
  MOUSE_FRAMES,
  MOUSE_H,
  MOUSE_W,
  catSprite,
  dogSprite,
  mouseSprite,
  type CatPose,
  type DogPose,
} from "@/lib/office/petSprites";

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
const signature = (sprite: HTMLCanvasElement): string => [...cellsOf(sprite).entries()].join("|");
const diff = (spriteA: HTMLCanvasElement, spriteB: HTMLCanvasElement): number => {
  const cellsA = cellsOf(spriteA),
    cellsB = cellsOf(spriteB);
  let count = 0;
  for (const key of new Set([...cellsA.keys(), ...cellsB.keys()])) if (cellsA.get(key) !== cellsB.get(key)) count++;
  return count;
};
const HEX = /^#[0-9a-f]{6}$/;
const MIN_PET_CELLS = 25;
const MIN_PATRON_CELLS = 150;
const MIN_KIND_DIFF = 60;

const expectOpaque = (sprite: HTMLCanvasElement) => {
  for (const color of cellsOf(sprite).values()) expect(color).toMatch(HEX);
};
const frames = (count: number) => Array.from({ length: count }, (_, i) => i);

describe("hall pets", () => {
  beforeEach(() => {
    vi.stubGlobal("document", { createElement: () => fakeCanvas() });
  });
  afterEach(() => vi.unstubAllGlobals());

  it("cat poses: right size, opaque hex, drawn and animated", () => {
    for (const pose of Object.keys(CAT_FRAMES) as CatPose[]) {
      const sprites = frames(CAT_FRAMES[pose]).map((frame) => catSprite(pose, frame));
      for (const sprite of sprites) {
        expect(sprite.width).toBe(CAT_W);
        expect(sprite.height).toBe(CAT_H);
        expect(cellsOf(sprite).size).toBeGreaterThan(MIN_PET_CELLS);
        expectOpaque(sprite);
      }
      expect(new Set(sprites.map(signature)).size).toBe(sprites.length);
    }
  });

  it("cat poses look different from each other", () => {
    const poses = Object.keys(CAT_FRAMES) as CatPose[];
    for (const first of poses)
      for (const second of poses)
        if (first < second) expect(diff(catSprite(first, 0), catSprite(second, 0))).toBeGreaterThan(5);
  });

  it("dog and mouse", () => {
    for (const pose of Object.keys(DOG_FRAMES) as DogPose[]) {
      for (const frame of frames(DOG_FRAMES[pose])) {
        const sprite = dogSprite(pose, frame);
        expect([sprite.width, sprite.height]).toEqual([DOG_W, DOG_H]);
        expect(cellsOf(sprite).size).toBeGreaterThan(MIN_PET_CELLS);
        expectOpaque(sprite);
      }
      expect(diff(dogSprite(pose, 0), dogSprite(pose, 1))).toBeGreaterThan(0);
    }
    expect(diff(dogSprite("sleep", 0), dogSprite("wag", 0))).toBeGreaterThan(MIN_PET_CELLS);
    for (const frame of frames(MOUSE_FRAMES)) {
      const sprite = mouseSprite(frame);
      expect([sprite.width, sprite.height]).toEqual([MOUSE_W, MOUSE_H]);
      expectOpaque(sprite);
    }
    expect(diff(mouseSprite(0), mouseSprite(1))).toBeGreaterThan(0);
  });

  it("caches and wraps frames (negative and NaN too)", () => {
    expect(catSprite("walk", 0)).toBe(catSprite("walk", 2));
    expect(catSprite("nap", -1)).toBe(catSprite("nap", 1));
    expect(dogSprite("wag", Number.NaN)).toBe(dogSprite("wag", 0));
    expect(mouseSprite(3)).toBe(mouseSprite(1));
  });
});

describe("hall regulars", () => {
  beforeEach(() => {
    vi.stubGlobal("document", { createElement: () => fakeCanvas() });
  });
  afterEach(() => vi.unstubAllGlobals());

  it("every kind / pose / frame is 16x24, opaque hex and well drawn", () => {
    for (const kind of PATRON_KINDS) {
      for (const pose of PATRON_POSES) {
        for (const frame of frames(PATRON_FRAMES)) {
          const sprite = patronSprite(kind, pose, frame);
          expect([sprite.width, sprite.height]).toEqual([PATRON_W, PATRON_H]);
          expect(cellsOf(sprite).size).toBeGreaterThan(MIN_PATRON_CELLS);
          expectOpaque(sprite);
        }
      }
    }
  });

  it("poses and frames differ, characters are distinct designs, caching works", () => {
    for (const kind of PATRON_KINDS) {
      const poses = PATRON_POSES.map((pose) => patronSprite(kind, pose, 0));
      expect(new Set(poses.map(signature)).size).toBe(PATRON_POSES.length);
      expect(diff(patronSprite(kind, "idle", 0), patronSprite(kind, "idle", 1))).toBeGreaterThan(0);
    }
    for (const first of PATRON_KINDS)
      for (const second of PATRON_KINDS)
        if (first < second)
          expect(diff(patronSprite(first, "idle", 0), patronSprite(second, "idle", 0))).toBeGreaterThan(MIN_KIND_DIFF);
    expect(patronSprite("dwarf", "sip", 0)).toBe(patronSprite("dwarf", "sip", 2));
    expect(patronSprite("merchant", "toast", -1)).toBe(patronSprite("merchant", "toast", 1));
  });
});
