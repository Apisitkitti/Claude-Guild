import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  LORD_ATTACK_FROM,
  LORD_FRAMES,
  LORD_H,
  LORD_RISE_FRAMES,
  LORD_RISE_H,
  LORD_RISE_W,
  LORD_SEATED_FRAMES,
  LORD_SEATED_H,
  LORD_SEATED_W,
  LORD_W,
  THRONE_H,
  THRONE_SEAT_DX,
  THRONE_SEAT_DY,
  THRONE_W,
  lordRiseSprite,
  lordSeatedSprite,
  lordSprite,
  throneSprite,
} from "@/lib/office/dungeonLordSprite";
import { luma } from "@/lib/office/sprites";

/** a fake canvas that records every pixel it is asked to paint */
const fakeCanvas = () => {
  const ops: { x: number; y: number; color: string }[] = [];
  const ctx = {
    fillStyle: "",
    fillRect: (x: number, y: number) => {
      ops.push({ x, y, color: String(ctx.fillStyle) });
    },
  };
  return { width: 0, height: 0, ops, getContext: () => ctx };
};
const opsOf = (sprite: HTMLCanvasElement) =>
  (sprite as unknown as { ops: { x: number; y: number; color: string }[] }).ops;
const pixelsOf = (sprite: HTMLCanvasElement): string =>
  opsOf(sprite)
    .map((op) => `${op.x},${op.y},${op.color}`)
    .join("|");
const shapeOf = (sprite: HTMLCanvasElement): string =>
  opsOf(sprite)
    .map((op) => `${op.x},${op.y}`)
    .join("|");
const frames = Array.from({ length: LORD_FRAMES }, (_, i) => i);

describe("Dungeon Lord sprite", () => {
  beforeEach(() => {
    vi.stubGlobal("document", { createElement: () => fakeCanvas() });
  });
  afterEach(() => vi.unstubAllGlobals());

  it("is a 64x64 drawing with four frames (two idle, two attack)", () => {
    expect(LORD_W).toBe(64);
    expect(LORD_H).toBe(64);
    expect(LORD_FRAMES).toBe(4);
    expect(LORD_ATTACK_FROM).toBe(2);
    for (const hurt of [false, true])
      for (const frame of frames) {
        const sprite = lordSprite(frame, hurt);
        expect(sprite.width).toBe(LORD_W);
        expect(sprite.height).toBe(LORD_H);
        expect(opsOf(sprite).length).toBeGreaterThan(900);
      }
  });

  it("is opaque: every pixel a plain #rrggbb colour, never translucent", () => {
    for (const hurt of [false, true])
      for (const frame of frames)
        for (const op of opsOf(lordSprite(frame, hurt))) expect(op.color).toMatch(/^#[0-9a-f]{6}$/i);
  });

  it("stays inside the canvas and leaves the outline rows free of fill", () => {
    for (const frame of frames) {
      const ops = opsOf(lordSprite(frame));
      for (const op of ops) {
        expect(op.x).toBeGreaterThanOrEqual(0);
        expect(op.x).toBeLessThan(LORD_W);
        expect(op.y).toBeGreaterThanOrEqual(0);
        expect(op.y).toBeLessThan(LORD_H);
      }
      // the feet stand near the bottom: plenty of pixels in the last three rows
      expect(ops.filter((op) => op.y >= LORD_H - 3).length).toBeGreaterThan(8);
    }
  });

  it("has a dark closed outline: the top row and the left column hold only dark pixels", () => {
    for (const frame of frames) {
      const ops = opsOf(lordSprite(frame));
      for (const op of ops.filter((cell) => cell.y === 0 || cell.x === 0)) expect(luma(op.color)).toBeLessThan(70);
    }
  });

  it("shows four distinct frames", () => {
    expect(new Set(frames.map((frame) => pixelsOf(lordSprite(frame)))).size).toBe(LORD_FRAMES);
    // the attack pair differs clearly from the idle pair
    const idle = new Set(opsOf(lordSprite(0)).map((op) => `${op.x},${op.y}`));
    const strikeFrame = opsOf(lordSprite(LORD_ATTACK_FROM + 1)).filter((op) => !idle.has(`${op.x},${op.y}`));
    expect(strikeFrame.length).toBeGreaterThan(60);
  });

  it("menaces: glowing red eyes and burning maw, a horn-bone and a blade colour are present", () => {
    const colors = new Set(opsOf(lordSprite(2)).map((op) => op.color));
    expect(colors.has("#ff4a2a")).toBe(true);
    expect(colors.has("#ffd070")).toBe(true);
    expect(colors.has("#e4e0f6")).toBe(true);
  });

  it("hurt keeps the silhouette but lightens the fill, outline stays dark", () => {
    for (const frame of frames) {
      const calm = lordSprite(frame),
        hurt = lordSprite(frame, true);
      expect(shapeOf(hurt)).toBe(shapeOf(calm));
      expect(pixelsOf(hurt)).not.toBe(pixelsOf(calm));
      const total = (sprite: HTMLCanvasElement) => opsOf(sprite).reduce((sum, op) => sum + luma(op.color), 0);
      expect(total(hurt)).toBeGreaterThan(total(calm));
      const rim = opsOf(hurt).filter((op) => op.x === 0 || op.y === 0);
      for (const op of rim) expect(luma(op.color)).toBeLessThan(70);
    }
  });

  it("caches by frame and wraps odd frames", () => {
    expect(lordSprite(1)).toBe(lordSprite(1));
    expect(lordSprite(1 + LORD_FRAMES)).toBe(lordSprite(1));
    expect(lordSprite(-1)).toBe(lordSprite(LORD_FRAMES - 1));
    expect(lordSprite(Number.NaN)).toBe(lordSprite(0));
    expect(lordSprite(1, true)).not.toBe(lordSprite(1, false));
  });

  it("seats and raises the Lord: sizes, frames, opaque, dark outline, distinct from standing", () => {
    const sets: [HTMLCanvasElement[], number, number][] = [
      [[0, 1].map(lordSeatedSprite), LORD_SEATED_W, LORD_SEATED_H],
      [[0, 1].map(lordRiseSprite), LORD_RISE_W, LORD_RISE_H],
    ];
    expect(LORD_SEATED_FRAMES).toBe(2);
    expect(LORD_RISE_FRAMES).toBe(2);
    for (const [sprites, wide, high] of sets) {
      expect(new Set(sprites.map(pixelsOf)).size).toBe(sprites.length);
      for (const sprite of sprites) {
        expect(sprite.width).toBe(wide);
        expect(sprite.height).toBe(high);
        const ops = opsOf(sprite);
        expect(ops.length).toBeGreaterThan(800);
        for (const op of ops) expect(op.color).toMatch(/^#[0-9a-f]{6}$/i);
        for (const op of ops.filter(
          (cell) => cell.y === 0 || cell.x === 0 || cell.y === high - 1 || cell.x === wide - 1,
        ))
          expect(luma(op.color)).toBeLessThan(70);
        expect(ops.filter((op) => op.y >= high - 3).length).toBeGreaterThan(6);
      }
    }
    expect(shapeOf(lordSeatedSprite(0))).not.toBe(shapeOf(lordSprite(0)));
    expect(shapeOf(lordRiseSprite(0))).not.toBe(shapeOf(lordSeatedSprite(0)));
    expect(lordSeatedSprite(2)).toBe(lordSeatedSprite(0));
    expect(lordSeatedSprite(0)).toBe(lordSeatedSprite(0));
    expect(lordRiseSprite(-1)).toBe(lordRiseSprite(1));
  });

  it("builds an opaque throne with a sane seat anchor", () => {
    const throne = throneSprite();
    expect(throne).toBe(throneSprite());
    expect(throne.width).toBe(THRONE_W);
    expect(throne.height).toBe(THRONE_H);
    const ops = opsOf(throne);
    expect(ops.length).toBeGreaterThan(2000);
    for (const op of ops) expect(op.color).toMatch(/^#[0-9a-f]{6}$/i);
    for (const op of ops.filter((cell) => cell.y === 0 || cell.x === 0)) expect(luma(op.color)).toBeLessThan(70);
    expect(THRONE_SEAT_DX).toBe(THRONE_W / 2);
    expect(THRONE_SEAT_DY).toBeGreaterThan(LORD_SEATED_H);
    expect(THRONE_SEAT_DY).toBeLessThan(THRONE_H);
    // the seated Lord fits inside the throne canvas horizontally and is shorter than the back
    expect(THRONE_SEAT_DX - LORD_SEATED_W / 2).toBeGreaterThanOrEqual(0);
    expect(THRONE_SEAT_DX + LORD_SEATED_W / 2).toBeLessThanOrEqual(THRONE_W);
    expect(THRONE_SEAT_DY - LORD_SEATED_H).toBeGreaterThan(0);
    // the seat floor under his feet is painted
    expect(ops.some((op) => op.x === THRONE_SEAT_DX && op.y === THRONE_SEAT_DY - 2)).toBe(true);
  });
});
