import { describe, expect, it } from "vitest";

import { GLYPH_H, GLYPH_W, PIXEL_CHARS, drawPixelText, measurePixelText } from "@/lib/office/pixelFont";

const fakeCtx = () => {
  const ops: { x: number; y: number; w: number; h: number; fill: string }[] = [];
  const ctx = {
    fillStyle: "" as string,
    fillRect: (x: number, y: number, width: number, height: number) =>
      ops.push({ x, y, w: width, h: height, fill: ctx.fillStyle }),
  };
  return { ctx, ops };
};

describe("pixel font", () => {
  it("every glyph fits the 3x5 cell and draws only opaque hex rects", () => {
    for (const ch of PIXEL_CHARS) {
      const { ctx, ops } = fakeCtx();
      drawPixelText(ctx, ch, 10, 20, "#ffffff");
      for (const op of ops) {
        expect(op.x).toBeGreaterThanOrEqual(10);
        expect(op.x + op.w).toBeLessThanOrEqual(10 + GLYPH_W);
        expect(op.y).toBeGreaterThanOrEqual(20);
        expect(op.y + op.h).toBeLessThanOrEqual(20 + GLYPH_H);
        expect(op.fill).toBe("#ffffff");
      }
      if (ch !== " ") expect(ops.length).toBeGreaterThan(0);
    }
  });

  it("letters are pairwise distinct", () => {
    const seen = new Set<string>();
    for (const ch of PIXEL_CHARS.replace(" ", "")) {
      const { ctx, ops } = fakeCtx();
      drawPixelText(ctx, ch, 0, 0, "#fff000");
      seen.add(ops.map((op) => `${op.x},${op.y}`).join("|"));
    }
    expect(seen.size).toBe(PIXEL_CHARS.length - 1);
  });

  it("measures 4px per glyph minus the trailing gap, scaled", () => {
    expect(measurePixelText("")).toBe(0);
    expect(measurePixelText("A")).toBe(3);
    expect(measurePixelText("AB")).toBe(7);
    expect(measurePixelText("AB", 2)).toBe(14);
  });

  it("folds lower case and skips unknown characters (Thai, emoji)", () => {
    expect(measurePixelText("dungeon")).toBe(measurePixelText("DUNGEON"));
    expect(measurePixelText("A⚔ก B")).toBe(measurePixelText("A B"));
    const { ctx, ops } = fakeCtx();
    expect(drawPixelText(ctx, "ก⚔", 0, 0, "#ffffff")).toBe(0);
    expect(ops).toHaveLength(0);
  });

  it("shadow is painted first in its own colour; align shifts by the measured width", () => {
    const { ctx, ops } = fakeCtx();
    drawPixelText(ctx, "I", 10, 0, "#ffffff", { shadow: "#000000" });
    expect(ops[0].fill).toBe("#000000");
    expect(ops[ops.length - 1].fill).toBe("#ffffff");
    const right = fakeCtx();
    drawPixelText(right.ctx, "AB", 20, 0, "#ffffff", { align: "right" });
    expect(Math.min(...right.ops.map((op) => op.x))).toBe(13);
    const mid = fakeCtx();
    drawPixelText(mid.ctx, "AB", 20, 0, "#ffffff", { align: "center" });
    expect(Math.min(...mid.ops.map((op) => op.x))).toBe(17);
  });
});
