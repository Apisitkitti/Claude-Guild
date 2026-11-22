import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { NPC_H, NPC_W, bardSprite, chefSprite, innkeeperSprite } from "@/lib/office/npcSprites";

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
const pixelsOf = (sprite: HTMLCanvasElement): string => (sprite as unknown as { ops: string[] }).ops.join("|");

describe("npc sprites", () => {
  beforeEach(() => {
    vi.stubGlobal("document", { createElement: () => fakeCanvas() });
  });
  afterEach(() => vi.unstubAllGlobals());

  it("builds 16x24 canvases with painted pixels", () => {
    for (const sprite of [bardSprite(true, 0), bardSprite(false, 0), chefSprite("walk", 0), innkeeperSprite(0)]) {
      expect(sprite.width).toBe(NPC_W);
      expect(sprite.height).toBe(NPC_H);
      expect(pixelsOf(sprite).length).toBeGreaterThan(0);
    }
  });

  it("caches sprites and wraps frame numbers", () => {
    expect(chefSprite("stir", 1)).toBe(chefSprite("stir", 5));
    expect(bardSprite(true, 2)).toBe(bardSprite(true, -2));
  });

  it("animation frames differ", () => {
    const distinct = (sprites: HTMLCanvasElement[]) => new Set(sprites.map(pixelsOf)).size;
    expect(distinct([0, 1, 2, 3].map((frame) => bardSprite(true, frame)))).toBe(4);
    expect(distinct([0, 1].map((frame) => bardSprite(false, frame)))).toBe(2);
    expect(distinct([0, 1, 2, 3].map((frame) => chefSprite("walk", frame)))).toBe(4);
    expect(distinct([0, 1, 2, 3].map((frame) => chefSprite("carry", frame)))).toBe(4);
    expect(distinct([0, 1, 2, 3].map((frame) => chefSprite("stir", frame)))).toBe(4);
    expect(distinct([0, 1, 2, 3].map((frame) => innkeeperSprite(frame)))).toBe(4);
  });

  it("never paints row 0 or column 15 (room for the outline) and a held plate has both feet down", () => {
    const all = [
      ...[true, false].flatMap((playing) => [0, 1, 2, 3].map((frame) => bardSprite(playing, frame))),
      ...(["walk", "carry", "hold", "stir", "idle"] as const).flatMap((pose) =>
        [0, 1, 2, 3].map((frame) => chefSprite(pose, frame)),
      ),
      ...[0, 1, 2, 3].map((frame) => innkeeperSprite(frame)),
    ];
    for (const sprite of all) {
      for (const op of (sprite as unknown as { ops: string[] }).ops) {
        const [x, y, color] = op.split(",");
        if (y !== "0" && Number(x) !== NPC_W - 1) continue;
        // only the dark outline pass may touch the border, never a fill colour
        expect(Math.max(...[1, 3, 5].map((at) => parseInt(color.slice(at, at + 2), 16)))).toBeLessThanOrEqual(0x50);
      }
    }
    // a standing chef holding a plate has the same planted feet as the standing pose, not a lifted stride
    const feet = (sprite: HTMLCanvasElement) =>
      (sprite as unknown as { ops: string[] }).ops.filter((op) => op.split(",")[1] === "22").length;
    expect(feet(chefSprite("hold", 0))).toBe(feet(chefSprite("idle", 0)));
    expect(feet(chefSprite("hold", 0))).toBeGreaterThan(feet(chefSprite("carry", 0)));
  });
});
