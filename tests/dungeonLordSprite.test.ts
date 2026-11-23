import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { LORD_ATTACK_FROM, LORD_FRAMES, LORD_H, LORD_W, lordSprite } from "@/lib/office/dungeonLordSprite";
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

  it("is a 48x48 drawing with four frames (two idle, two attack)", () => {
    expect(LORD_W).toBe(48);
    expect(LORD_H).toBe(48);
    expect(LORD_FRAMES).toBe(4);
    expect(LORD_ATTACK_FROM).toBe(2);
    for (const hurt of [false, true])
      for (const frame of frames) {
        const sprite = lordSprite(frame, hurt);
        expect(sprite.width).toBe(LORD_W);
        expect(sprite.height).toBe(LORD_H);
        expect(opsOf(sprite).length).toBeGreaterThan(500);
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
    expect(colors.has("#efe6c8")).toBe(true);
    expect(colors.has("#e6edf7")).toBe(true);
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
});
