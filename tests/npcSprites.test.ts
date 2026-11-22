import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { NPC_H, NPC_W, bardSprite, chefSprite, guildMasterSprite, innkeeperSprite } from "@/lib/office/npcSprites";

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

  it("guild master: every pose and frame is 16x24, opaque, hex-only and distinct from the other NPCs", () => {
    const poses = { idle: 2, walk: 4, talk: 4 } as const;
    const all: HTMLCanvasElement[] = [];
    for (const [pose, count] of Object.entries(poses) as [keyof typeof poses, number][]) {
      const frames = Array.from({ length: count }, (_, frame) => guildMasterSprite(pose, frame));
      for (const sprite of frames) {
        expect(sprite.width).toBe(NPC_W);
        expect(sprite.height).toBe(NPC_H);
        const ops = (sprite as unknown as { ops: string[] }).ops;
        expect(ops.length).toBeGreaterThan(100);
        for (const op of ops) expect(op.split(",")[2]).toMatch(/^#[0-9a-f]{6}$/);
        // feet planted on the bottom row
        expect(ops.some((op) => op.split(",")[1] === "23")).toBe(true);
      }
      expect(new Set(frames.map(pixelsOf)).size).toBe(count);
      expect(guildMasterSprite(pose, 0)).toBe(guildMasterSprite(pose, count));
      all.push(...frames);
    }
    expect(pixelsOf(guildMasterSprite("talk", 0))).not.toBe(pixelsOf(guildMasterSprite("idle", 0)));
    const others = [innkeeperSprite(0), bardSprite(false, 0), chefSprite("idle", 0)].map(pixelsOf);
    for (const sprite of all) expect(others).not.toContain(pixelsOf(sprite));
    // a grizzled adventurer, not clergy: iron pauldron, scar and leather jacket, no red robe or gold centre trim
    const master = pixelsOf(guildMasterSprite("idle", 0));
    for (const color of ["#9aa4b2", "#b05a5a", "#8a5430", "#566340"]) expect(master).toContain(color);
    expect(master).not.toContain("#8a2c3c");
    // a woman, not the old bearded keeper: no brown beard on the innkeeper, and a red ribbon in her hair
    expect(pixelsOf(innkeeperSprite(0))).toContain("#d95763");
    expect(pixelsOf(innkeeperSprite(0))).toContain("#7a3b2a");
  });

  it("never paints row 0 or column 15 (room for the outline) and a held plate has both feet down", () => {
    const all = [
      ...[true, false].flatMap((playing) => [0, 1, 2, 3].map((frame) => bardSprite(playing, frame))),
      ...(["walk", "carry", "hold", "stir", "idle"] as const).flatMap((pose) =>
        [0, 1, 2, 3].map((frame) => chefSprite(pose, frame)),
      ),
      ...[0, 1, 2, 3].map((frame) => innkeeperSprite(frame)),
      ...(["idle", "walk", "talk"] as const).flatMap((pose) =>
        [0, 1, 2, 3].map((frame) => guildMasterSprite(pose, frame)),
      ),
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
