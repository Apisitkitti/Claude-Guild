import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { VIEW_W, VIEW_X0, WORLD_H } from "@/lib/office/layout";
import { measurePixelText } from "@/lib/office/pixelFont";
import {
  VOID_DITHER_STEPS,
  VOID_TRUE_H,
  VOID_TRUE_W,
  VOID_H,
  voidBossSprite,
  voidColossusSprite,
  voidFormFrames,
  voidFormSize,
  VOID_FIGURE_SCALE,
  type VoidForm,
} from "@/lib/office/voidBossSprite";
import { colossusBodyPlace, drawColossusEnts, drawColossusFloor, handSprite } from "@/lib/office/voidColossus";
import { VOID_WIPE_S } from "@/lib/office/voidFight";
import {
  voidSpotOf,
  VOID_ARENA_Y1,
  VOID_ARENA_X0,
  VOID_ARENA_X1,
  VOID_ASCEND_S,
  VOID_EYE_SHATTER_S,
  voidGazeX,
} from "@/lib/office/voidFight";
import {
  drawVoidBar,
  drawVoidBoss,
  drawVoidFloorFx,
  drawVoidHits,
  drawVoidImpacts,
  drawVoidMinion,
  drawVoidShatter,
  drawVoidTexts,
  drawVoidWipe,
  voidBackView,
  voidBossPose,
  voidEclipseLevel,
} from "@/lib/office/voidFx";
import { buildVoidBack, buildVoidFront, drawVoidBack, voidVariantOf, type VoidVariant } from "@/lib/office/voidScene";
import { voidIdle, type VoidState } from "@/lib/office/voidTypes";
import {
  BAR_SEGMENTS,
  barLitSegments,
  barPanelWidth,
  bandsOverlap,
  beamZone,
  clipPixelText,
  flinchPx,
  hitNumberAt,
  lerpPoint,
  overlayBands,
  plaqueLayout,
  slashPoint,
  spotZone,
  strikeReach,
  FLINCH_PX,
  knockDx,
  KNOCK_S,
  FLINCH_S,
  HIT_FX_S,
  STRIKE_S,
  captionScale,
  descendLift,
  formOfHp,
  formOfPhase,
  nameLetters,
  phasePips,
  wipeBlockCovered,
  wipeBlockT,
  wipeCoveredCount,
  wipeProgress,
  ASCEND_DONE,
  COLOSSUS_CHEST_Y,
  COLOSSUS_EYE_HALF_H,
  VOID_BOSS_SORT_Y,
  pushbackRadius,
  PUSHBACK_S,
  COLOSSUS_EYE_X,
  COLOSSUS_EYE_Y,
  COLOSSUS_SCALES,
  HAND_REACH,
  HAND_RAISE,
  ascendBeat,
  colossusPlace,
  corePulse,
  deathBeat,
  eyeFlight,
  fragmentFall,
  gazeBeamPoint,
  gazeColumn,
  handPlace,
  shardDrift,
  shardFallDelay,
  shardFallProgress,
  shardStays,
  SHARD_FREE_R,
  SHARD_HOME_X,
  SHARD_HOME_Y,
  type AscendBeat,
} from "@/lib/office/voidVisualLogic";

interface Op {
  x: number;
  y: number;
  w: number;
  h: number;
  color: string;
}
const HEX = /^#[0-9a-f]{6}$/;

/** a recording canvas: every fillRect with the colour in force, every other method ignored */
const fakeCanvas = () => {
  const ops: Op[] = [];
  const styles: unknown[] = [];
  const ctx = new Proxy(
    {
      fillRect: (x: number, y: number, wide: number, high: number) => {
        ops.push({ x, y, w: wide, h: high, color: String((ctx as unknown as { fillStyle: unknown }).fillStyle) });
      },
      createPattern: () => ({}),
    } as Record<string, unknown>,
    {
      set: (target, key, value) => {
        if (key === "fillStyle") styles.push(value);
        if (key === "globalAlpha") styles.push(`alpha:${String(value)}`);
        target[key as string] = value;
        return true;
      },
      get: (target, key) => (key in target ? target[key as string] : () => undefined),
    },
  );
  return { width: 0, height: 0, ops, styles, getContext: () => ctx, ctx };
};
const opsOf = (sprite: HTMLCanvasElement): Op[] => (sprite as unknown as { ops: Op[] }).ops;
const sizeOf = (sprite: HTMLCanvasElement) => ({ width: sprite.width, height: sprite.height });

const stateAt = (phase: VoidState["phase"], phaseAt = 0): VoidState => {
  const state = voidIdle();
  state.phase = phase;
  state.phaseAt = phaseAt;
  state.hp = 100;
  state.maxHp = 100;
  state.shown = 1;
  state.x = 262;
  return state;
};

describe("Veiled One sprites", () => {
  beforeEach(() => vi.stubGlobal("document", { createElement: () => fakeCanvas() }));
  afterEach(() => vi.unstubAllGlobals());

  it("builds every form and frame with opaque hex colours at the form's size", () => {
    for (const form of [1, 2, 3] as VoidForm[])
      for (let frame = 0; frame < voidFormFrames(form); frame++)
        for (const hurt of [false, true]) {
          const sprite = voidBossSprite(form, frame, hurt);
          const ops = opsOf(sprite);
          expect(ops.length).toBeGreaterThan(300);
          for (const op of ops) expect(op.color).toMatch(HEX);
          const size = voidFormSize(form);
          expect(sizeOf(sprite)).toEqual({ width: size.wide, height: size.high });
        }
  });

  it("keeps the true form inside the canvas and its border row dark (the outline closes it)", () => {
    for (let frame = 0; frame < voidFormFrames(3); frame++) {
      const ops = opsOf(voidBossSprite(3, frame));
      for (const op of ops) {
        expect(op.x).toBeGreaterThanOrEqual(0);
        expect(op.y).toBeGreaterThanOrEqual(0);
        expect(op.x).toBeLessThan(voidFormSize(3).wide);
        expect(op.y).toBeLessThan(voidFormSize(3).high);
      }
      const tallest = Math.min(...ops.map((op) => op.y));
      expect(voidFormSize(3).high - tallest).toBeGreaterThan(165); // 1.5x of the painted 128 rows
    }
    expect(voidFormSize(3)).toEqual({ wide: Math.round(VOID_TRUE_W * 1.5), high: Math.round(VOID_TRUE_H * 1.5) });
  });

  it("is taller and bigger in the true form, with distinct frames", () => {
    expect(voidFormSize(3).high).toBeGreaterThan(voidFormSize(1).high);
    expect(VOID_H).toBeGreaterThan(0);
    expect(voidFormSize(1).high).toBe(Math.round(VOID_H * VOID_FIGURE_SCALE)); // the veiled forms tower over the raiders
    for (const form of [1, 2, 3] as VoidForm[]) {
      const keys = new Set<string>();
      for (let frame = 0; frame < voidFormFrames(form); frame++)
        keys.add(
          opsOf(voidBossSprite(form, frame))
            .map((op) => `${op.x},${op.y},${op.color}`)
            .join("|"),
        );
      expect(keys.size).toBe(voidFormFrames(form));
    }
  });

  it("caches, wraps frames and keeps the hurt flash opaque with the same silhouette", () => {
    expect(voidBossSprite(1, 1)).toBe(voidBossSprite(1, 8));
    expect(voidBossSprite(2, -1)).toBe(voidBossSprite(2, 6));
    const plain = opsOf(voidBossSprite(3, 0));
    const hurt = opsOf(voidBossSprite(3, 0, true));
    expect(hurt.length).toBe(plain.length);
    expect(hurt.map((op) => op.color).join()).not.toBe(plain.map((op) => op.color).join());
  });

  it("dissolves by dither (fewer opaque pixels, never alpha) and never turns translucent", () => {
    const whole = opsOf(voidBossSprite(2, 0)).length;
    let last = whole;
    for (let level = 2; level <= VOID_DITHER_STEPS; level += 2) {
      const now = opsOf(voidBossSprite(2, 0, false, level)).length;
      expect(now).toBeLessThan(last);
      last = now;
    }
    expect(opsOf(voidBossSprite(2, 0, false, VOID_DITHER_STEPS)).length).toBe(0);
  });
});

describe("Void Sanctum scene", () => {
  const record = (build: (ctx: CanvasRenderingContext2D) => void) => {
    const canvas = fakeCanvas();
    build(canvas.ctx as unknown as CanvasRenderingContext2D);
    return canvas;
  };

  it("builds the back layer for every phase variant, opaque and different per variant", () => {
    const sums: string[] = [];
    for (const variant of [0, 1, 2] as VoidVariant[]) {
      const canvas = record((ctx) => buildVoidBack(ctx, variant));
      expect(canvas.ops.length).toBeGreaterThan(variant === 2 ? 150 : 2000); // the colossus's back is only the sky: its face and shards are drawn live
      for (const op of canvas.ops) expect(op.color).toMatch(HEX);
      expect(canvas.styles.some((style) => String(style).startsWith("alpha"))).toBe(false);
      sums.push(canvas.ops.map((op) => op.color).join(""));
    }
    expect(sums[0]).not.toBe(sums[2]);
    expect(voidVariantOf("phase2")).toBe(1);
    expect(voidVariantOf("phase3")).toBe(2);
    expect(voidVariantOf("fight")).toBe(0);
  });

  it("keeps the front layer out of the raiders' area (top band and far bottom corners only)", () => {
    for (const variant of [0, 1, 2] as VoidVariant[]) {
      const canvas = record((ctx) => buildVoidFront(ctx, variant));
      expect(canvas.ops.length).toBeGreaterThan(50);
      for (const op of canvas.ops) {
        expect(op.color).toMatch(HEX);
        const top = op.y + op.h <= 30;
        const corner = op.y >= 170 && (op.x + op.w <= VIEW_X0 + 70 || op.x >= VIEW_X0 + VIEW_W - 70);
        expect(top || corner).toBe(true);
      }
    }
  });
});

describe("pixel-block wipe", () => {
  const cols = 40,
    rows = 18;
  it("covers nothing at the ends and every block at the midpoint", () => {
    expect(wipeCoveredCount(0, cols, rows, 28, 8)).toBe(0);
    expect(wipeCoveredCount(1, cols, rows, 28, 8)).toBe(0);
    expect(wipeCoveredCount(0.5, cols, rows, 28, 8)).toBe(cols * rows);
  });
  it("fills outward from the origin and clears in the same order", () => {
    let last = 0;
    for (let step = 1; step <= 10; step++) {
      const now = wipeCoveredCount(step / 20, cols, rows, 28, 8);
      expect(now).toBeGreaterThanOrEqual(last);
      last = now;
    }
    expect(wipeBlockT(28, 8, cols, rows, 28, 8)).toBeLessThan(0.1);
    expect(wipeBlockT(0, 17, cols, rows, 28, 8)).toBeGreaterThan(0.8);
    for (let step = 11; step < 20; step++) {
      const now = wipeCoveredCount(step / 20, cols, rows, 28, 8);
      expect(now).toBeLessThanOrEqual(last);
      last = now;
    }
    expect(wipeBlockCovered(0.7, 0.1)).toBe(false);
    expect(wipeBlockCovered(0.7, 0.9)).toBe(true);
    expect(wipeProgress(VOID_WIPE_S * 2, VOID_WIPE_S)).toBe(1);
  });

  it("draws opaque blocks only, a full cover at the midpoint, and nothing under reduced motion", () => {
    const state = stateAt("transition", 10);
    const mid = fakeCanvas();
    drawVoidWipe(
      mid.ctx as unknown as CanvasRenderingContext2D,
      state,
      10 + VOID_WIPE_S / 2,
      false,
      0,
      0,
      VIEW_W,
      WORLD_H,
      300,
      90,
    );
    const area = mid.ops.reduce((sum, op) => sum + op.w * op.h, 0);
    expect(area).toBeGreaterThanOrEqual(VIEW_W * WORLD_H * 0.97);
    for (const op of mid.ops) expect(op.color).toMatch(HEX);
    const start = fakeCanvas();
    drawVoidWipe(start.ctx as unknown as CanvasRenderingContext2D, state, 10, false, 0, 0, VIEW_W, WORLD_H, 300, 90);
    expect(start.ops.length).toBe(0);
    const still = fakeCanvas();
    drawVoidWipe(
      still.ctx as unknown as CanvasRenderingContext2D,
      state,
      10 + VOID_WIPE_S / 2,
      true,
      0,
      0,
      VIEW_W,
      WORLD_H,
      300,
      90,
    );
    expect(still.ops.length).toBe(0);
  });
});

describe("pure helpers", () => {
  it("lays out the boss bar", () => {
    expect(barLitSegments(1)).toBe(BAR_SEGMENTS);
    expect(barLitSegments(0.5)).toBe(BAR_SEGMENTS / 2);
    expect(barLitSegments(0.001)).toBe(1);
    expect(barLitSegments(0, BAR_SEGMENTS, false)).toBe(0);
    expect(barLitSegments(Number.NaN)).toBe(1);
    expect(barPanelWidth()).toBeGreaterThan(5 * 28 + 22); // wider than the Dungeon Lord's panel
    expect([phasePips("fight"), phasePips("phase2"), phasePips("phase3"), phasePips("none")]).toEqual([1, 2, 3, 0]);
  });
  it("clamps captions to the width", () => {
    const text = "EVERY CALL YOU MAKE FEEDS MY VOID.";
    expect(captionScale(text, 10_000, 3)).toBe(3);
    expect(captionScale(text, 10, 3)).toBe(1);
    const width = 150;
    const scale = captionScale(text, width, 3);
    expect(scale).toBeGreaterThanOrEqual(1);
    expect(captionScale(text, 400, 4)).toBeLessThanOrEqual(4);
  });
  it("picks forms, dying stages and the descent", () => {
    expect([formOfHp(1), formOfHp(0.5), formOfHp(0.1)]).toEqual([1, 3, 3]);
    expect([formOfPhase("fight", 0.9), formOfPhase("phase2", 0.5), formOfPhase("phase3", 0.2)]).toEqual([1, 3, 3]);
    expect(formOfPhase("dying", 0.9)).toBe(3);
    expect(formOfPhase("retreat", 0.5)).toBe(3);
    expect(descendLift(0)).toBeGreaterThan(descendLift(1));
    expect(descendLift(10)).toBe(0);
    expect(nameLetters(0, 14)).toBe(0);
    expect(nameLetters(10, 14)).toBe(14);
  });
});

describe("drawing the fight stays opaque and static under reduced motion", () => {
  beforeEach(() => vi.stubGlobal("document", { createElement: () => fakeCanvas() }));
  afterEach(() => vi.unstubAllGlobals());

  it("never sets alpha or a non-hex colour across the whole sequence", () => {
    const phases: VoidState["phase"][] = [
      "shatter",
      "transition",
      "reveal",
      "fight",
      "phase2",
      "phase3",
      "dying",
      "victory",
      "retreat",
    ];
    for (const still of [false, true])
      for (const phase of phases)
        for (const age of [0.2, 1, 2.2, 3.1]) {
          const state = stateAt(phase, 0);
          state.voice = "KNEEL BEFORE THE VEIL.";
          state.voiceAt = 0;
          state.hp = phase === "phase3" || phase === "dying" ? 20 : 70;
          state.attack = {
            kind: "eclipse",
            at: 0,
            targetX: 160,
            targetY: 130,
            hitAt: 2.6,
            endAt: 4.4,
            landed: false,
            seed: 3,
          };
          state.eyes[0] = { on: true, x: 120, y: 90, bornAt: 0, fireAt: 1, fired: false };
          Object.assign(state, { ascendAt: 0, coreOpenAt: 0, coreX: 160, coreY: 46, dyingEye: phase === "dying" });
          const kinds = ["eclipse", "gaze", "hand"] as const;
          state.attack.kind = kinds[Math.floor(age) % 3];
          if (state.attack.kind !== "eclipse") state.attack.hitAt = 1.2;
          const handStates = ["rise", "hover", "windup", "slam", "sink"] as const;
          state.hands.forEach((hand, index) => {
            hand.state = handStates[(Math.floor(age) + index * 2) % 5];
            hand.at = 0;
            if (index === 0) Object.assign(hand, { x: 150, y: 130 });
          });
          const canvas = fakeCanvas();
          const ctx = canvas.ctx as unknown as CanvasRenderingContext2D;
          drawVoidBack(ctx, age, still, voidBackView(state, age, still));
          drawVoidFloorFx(ctx, state, age, still);
          drawVoidBoss(ctx, state, age, still);
          drawVoidShatter(ctx, state, age, still, 262, 120);
          drawVoidTexts(ctx, state, age, still);
          drawVoidBar(ctx, state, age, still);
          Object.assign(state, {
            lastHitAt: 0,
            lastHitX: 250,
            lastHitY: 80,
            lastHitDmg: 12,
            lastHitCrit: true,
            blockedAt: 0,
            voidImpactAt: 0,
          });
          drawVoidHits(ctx, state, age * 0.3, still, 180, 120, true);
          drawVoidImpacts(ctx, state, age * 0.3, still);
          drawVoidMinion(
            ctx,
            { on: true, x: 200, y: 130, bornAt: 0, clearedAt: age > 2 ? 1.9 : -99, strikeAt: 0 },
            age,
            still,
            1,
          );
          for (const style of canvas.styles) if (typeof style === "string") expect(style).toMatch(HEX); // patterns (dither veils) are objects
        }
  });

  it("holds one pose under reduced motion", () => {
    const state = stateAt("fight", 0);
    const first = voidBossPose(state, 0.1, true).sprite;
    expect(voidBossPose(state, 7.7, true).sprite).toBe(first);
    expect(voidBossPose(stateAt("reveal", 0), 0.1, true).lift).toBe(0);
    expect(voidEclipseLevel(state, 1)).toBe(0);
  });
});

describe("hit, warning and layout helpers", () => {
  it("runs a strike from the raider to the impact and slashes across the body", () => {
    expect(strikeReach(0)).toBe(0);
    expect(strikeReach(STRIKE_S)).toBe(1);
    expect(strikeReach(10)).toBe(1);
    expect(lerpPoint(0, 0, 10, 20, 0.5)).toEqual({ x: 5, y: 10 });
    const start = slashPoint(100, 80, 0, -1);
    const end = slashPoint(100, 80, 1, -1);
    expect(end.y).toBeGreaterThan(start.y);
    expect(Math.hypot(start.x - 100, start.y - 80)).toBeGreaterThan(8);
  });
  it("sizes the damage number (2x, crit 3x), lifts it and flinches the boss briefly", () => {
    expect(hitNumberAt(0.1, false).scale).toBe(2);
    expect(hitNumberAt(0.1, true).scale).toBe(3);
    expect(hitNumberAt(0.5, false).rise).toBeGreaterThan(hitNumberAt(0.1, false).rise);
    expect(hitNumberAt(HIT_FX_S + 0.1, false).shown).toBe(false);
    expect(flinchPx(0.01, 1)).toBe(FLINCH_PX);
    expect(flinchPx(FLINCH_S + 0.01, 1)).toBe(0);
    expect(flinchPx(-1, 1)).toBe(0);
  });
  it("throws a hit raider away from the boss and back to rest", () => {
    expect(knockDx(0, -1)).toBe(0);
    expect(knockDx(KNOCK_S / 2, -1)).toBeLessThan(0);
    expect(knockDx(KNOCK_S / 2, 1)).toBeGreaterThan(0);
    expect(knockDx(KNOCK_S + 0.1, 1)).toBe(0);
    expect(knockDx(-5, 1)).toBe(0);
  });
  it("lays warning zones over the aimed area", () => {
    const beam = beamZone(262, 130, 70, 0);
    expect(beam.x).toBeLessThan(70);
    expect(beam.x + beam.width).toBeLessThan(262);
    expect(beam.height).toBeGreaterThanOrEqual(28);
    const spot = spotZone(120, 90, 0, 1);
    expect(spot.x + spot.width / 2).toBeCloseTo(120, 0);
    expect(spotZone(120, 90, 0, 0.5).width).toBeLessThan(spot.width);
  });
  it("keeps banner, side cards, voice caption and the bar in separate bands", () => {
    const bands = overlayBands();
    expect(bandsOverlap(bands.banner, bands.side)).toBe(false);
    expect(bandsOverlap(bands.banner, bands.voice)).toBe(false);
    expect(bandsOverlap(bands.side, bands.voice)).toBe(false);
    expect(bands.voice.y + bands.voice.height).toBeLessThan(182);
  });
  it("fits the victory plaque and clips long captions", () => {
    const plaque = plaqueLayout("VICTORY", "THE VEILED ONE HAS FALLEN", 200, 4);
    expect(plaque.scale).toBeGreaterThanOrEqual(1);
    expect(plaque.titleX).toBeGreaterThanOrEqual(0);
    expect(plaque.titleX + measurePixelText("VICTORY", plaque.scale)).toBeLessThanOrEqual(plaque.plateW);
    expect(measurePixelText("THE VEILED ONE HAS FALLEN", 1)).toBeLessThanOrEqual(plaque.plateW);
    expect(plaque.plateW).toBeLessThanOrEqual(200);
    expect(plaque.lineY + 5).toBeLessThanOrEqual(plaque.plateH);
    expect(plaqueLayout("VICTORY", "X", 60, 4).scale).toBeLessThan(4);
    const clipped = clipPixelText("DUNGEON B4 THE VOID SANCTUM 1 RAIDING", 80);
    expect(measurePixelText(clipped)).toBeLessThanOrEqual(80);
    expect(clipped.endsWith("...")).toBe(true);
    expect(clipPixelText("B4", 80)).toBe("B4");
  });
});

describe("phase 3: the colossus is the true form, enormous", () => {
  beforeEach(() => vi.stubGlobal("document", { createElement: () => fakeCanvas() }));
  afterEach(() => vi.unstubAllGlobals());

  it("builds the armless colossus at every size: opaque, 2.5x at most, wings across the canvas", () => {
    COLOSSUS_SCALES.forEach((scale, step) => {
      const sprite = voidColossusSprite(step, 0);
      expect(sizeOf(sprite)).toEqual({
        width: Math.round(VOID_TRUE_W * scale),
        height: Math.round(VOID_TRUE_H * scale),
      });
      const ops = opsOf(sprite);
      expect(ops.length).toBeGreaterThan(1000);
      for (const op of ops) expect(op.color).toMatch(HEX);
    });
    const last = COLOSSUS_SCALES.length - 1;
    expect(COLOSSUS_SCALES[last]).toBeGreaterThanOrEqual(2.5);
    const ops = opsOf(voidColossusSprite(last, 0));
    const wide = Math.max(...ops.map((op) => op.x + op.w)) - Math.min(...ops.map((op) => op.x));
    expect(wide).toBeGreaterThan(VIEW_W * 0.7); // the six wings span most of the canvas
    expect(voidColossusSprite(last, 1)).toBe(voidColossusSprite(last, 5)); // cached, frames wrap
    // the dark rim closes the silhouette: nothing is painted on the border row
    expect(ops.some((op) => op.y === 0)).toBe(false);
  });

  it("keeps the chest eye (the core) behind the arena at a row where the head and crown still show", () => {
    const scale = COLOSSUS_SCALES[COLOSSUS_SCALES.length - 1];
    const headTop = COLOSSUS_CHEST_Y - 70 * scale;
    expect(headTop).toBeLessThan(0); // the flames reach past the top: it towers
    expect(COLOSSUS_CHEST_Y - 40 * scale).toBeGreaterThan(0); // but the mask face is on screen
    expect(COLOSSUS_CHEST_Y).toBeLessThan(WORLD_H);
  });

  it("times the ascend: it grows in three steps and the sky eye flies into the chest", () => {
    const beat: AscendBeat = { ...ASCEND_DONE };
    const place = { x: 0, y: 0, step: 0 };
    ascendBeat(0, beat);
    expect(beat).toMatchObject({ rise: 0, merge: 0, split: 0 });
    colossusPlace(beat, 262, 160, place);
    expect(place).toMatchObject({ x: 262, step: 0 });
    const steps = new Set<number>();
    for (let age = 0; age <= VOID_ASCEND_S; age += 0.1)
      steps.add(colossusPlace(ascendBeat(age, beat), 262, 160, place).step);
    expect([...steps].sort()).toEqual([0, 1, 2]);
    ascendBeat(VOID_ASCEND_S * 5, beat);
    colossusPlace(beat, 262, 130, place);
    expect(place).toMatchObject({ x: 130, y: COLOSSUS_CHEST_Y, step: 2 });
    const flight = { x: 0, y: 0, scale: 1 };
    eyeFlight(0, place, flight);
    expect(flight).toEqual({ x: COLOSSUS_EYE_X, y: COLOSSUS_EYE_Y, scale: 1 });
    eyeFlight(1, place, flight);
    expect(flight).toMatchObject({ x: 130, y: COLOSSUS_CHEST_Y });
    expect(flight.scale).toBeLessThan(0.2);
  });

  it("follows the core with its chest, and holds still under reduced motion", () => {
    const state = stateAt("phase3", 0);
    Object.assign(state, { ascendAt: 0, coreX: 120 });
    const place = { x: 0, y: 0, step: 0 };
    colossusBodyPlace(state, 9, false, place);
    expect(place).toMatchObject({ x: 120, y: COLOSSUS_CHEST_Y, step: 2 });
    state.coreX = 200;
    colossusBodyPlace(state, 20, true, place);
    expect(place.x).toBe(200);
  });

  it("lets only the shards under the raiders stay; the rest fall into the abyss", () => {
    expect(shardStays(SHARD_HOME_X, SHARD_HOME_Y)).toBe(true);
    expect(shardStays(-60, 190)).toBe(false);
    expect(shardStays(360, 60)).toBe(false);
    const out = { x: 0, y: 0 };
    shardDrift(SHARD_HOME_X, SHARD_HOME_Y, 1, out);
    expect(Math.hypot(out.x, out.y)).toBeLessThan(1);
    shardDrift(SHARD_HOME_X + SHARD_FREE_R, SHARD_HOME_Y, 1, out);
    expect(Math.hypot(out.x, out.y)).toBeLessThanOrEqual(6);
    // far shards let go later the nearer they are, and are done falling when the split ends
    expect(shardFallDelay(SHARD_HOME_X + 80, SHARD_HOME_Y)).toBeGreaterThan(shardFallDelay(-90, 200));
    expect(shardFallProgress(0, 0.3)).toBe(0);
    expect(shardFallProgress(1, 0.3)).toBe(1);
    expect(fragmentFall(1, 1)).toBeGreaterThan(fragmentFall(0.5, 1));
  });

  it("builds opaque hands (open and claw, both sides)", () => {
    const shapes = new Set<string>();
    for (const claw of [false, true])
      for (const mirror of [false, true]) {
        const sprite = handSprite(claw, mirror);
        expect(sizeOf(sprite)).toEqual({ width: 72, height: 84 });
        const ops = opsOf(sprite);
        expect(ops.length).toBeGreaterThan(300);
        for (const op of ops) expect(op.color).toMatch(HEX);
        shapes.add(ops.map((op) => `${op.x},${op.y}`).join("|"));
      }
    expect(shapes.size).toBe(4);
  });

  it("places the hands for every state and fires the gaze from the chest", () => {
    const home = { x: 78, y: 104 };
    const place = { x: 0, y: 0, claw: false, slam: 0 };
    const hand = { state: "rise" as const, x: 78, y: 104, at: 0 };
    expect(handPlace(hand, home, 0, 1.2, false, false, place).y).toBeGreaterThan(216);
    expect(handPlace(hand, home, 3.2, 1.2, false, false, place).y).toBeCloseTo(104, 0);
    const target = { x: 180, y: 130, at: 0 };
    handPlace({ ...target, state: "windup" }, home, 1.2, 1.2, false, false, place);
    expect(place).toMatchObject({ x: 180, claw: true });
    expect(place.y).toBeCloseTo(130 - HAND_RAISE, 0);
    handPlace({ ...target, state: "slam" }, home, 0.3, 1.2, false, false, place);
    expect(place.y).toBeCloseTo(130 - HAND_REACH, 0);
    expect(place.slam).toBe(1);
    handPlace({ ...target, state: "sink" }, home, 0.7, 1.2, false, false, place);
    expect(place.y).toBeGreaterThan(216 - 100);
    expect(handPlace({ state: "hover", x: 78, y: 104, at: 0 }, home, 5, 1.2, true, false, place).y).toBe(104);
    const attack = { hitAt: 10, endAt: 11.2 } as Parameters<typeof voidGazeX>[0];
    expect(voidGazeX(attack, 10, VOID_ARENA_X0, VOID_ARENA_X1)).toBe(VOID_ARENA_X0);
    expect(voidGazeX(attack, 11.2, VOID_ARENA_X0, VOID_ARENA_X1)).toBeCloseTo(VOID_ARENA_X1, 3);
    const column = gazeColumn(150);
    expect(column.y).toBe(70);
    const point = { x: 0, y: 0 };
    gazeBeamPoint(130, COLOSSUS_CHEST_Y, 150, 0, point);
    expect(point).toEqual({ x: 130, y: COLOSSUS_CHEST_Y });
    gazeBeamPoint(130, COLOSSUS_CHEST_Y, 150, 1, point);
    expect(point.x).toBe(150);
  });

  it("pulses the chest eye and plays the death in order: eye cracks, body shatters, burst", () => {
    expect(corePulse(0)).toBeGreaterThan(1);
    expect(corePulse(5)).toBe(1);
    const beat = { crack: 0, shatter: 0, flash: 0 };
    deathBeat(0.9, beat);
    expect(beat.crack).toBeGreaterThan(0.4);
    expect(beat.shatter).toBe(0);
    deathBeat(VOID_EYE_SHATTER_S + 0.5, beat);
    expect(beat).toMatchObject({ crack: 1, shatter: 1 });
    expect(beat.flash).toBeGreaterThan(0);
    expect(fragmentFall(0, 0.5)).toBe(0);
  });

  it("draws the colossus, arms, hands and floor work opaque and holds still under reduced motion", () => {
    const state = stateAt("phase3", 0);
    Object.assign(state, { ascendAt: 0, coreOpenAt: 0, coreX: 150, coreY: 46 });
    state.hands[0].state = "windup";
    Object.assign(state.hands[0], { x: 190, y: 128, at: 0 });
    state.attack = { kind: "gaze", at: 0, targetX: 70, targetY: 130, hitAt: 1.4, endAt: 2.6, landed: false, seed: 1 };
    const record = (time: number) => {
      const canvas = fakeCanvas();
      const ctx = canvas.ctx as unknown as CanvasRenderingContext2D;
      drawVoidBack(ctx, time, true, voidBackView(state, time, true));
      drawColossusFloor(ctx, state, time, true);
      drawColossusEnts(ctx, state, time, true);
      for (const style of canvas.styles) if (typeof style === "string") expect(style).toMatch(HEX);
      return canvas.ops.map((op) => `${op.x},${op.y},${op.w},${op.h},${op.color}`).join("|");
    };
    expect(record(0.5)).toBe(record(0.5));
    expect(record(0.5)).toBe(record(1.0)); // a static pose: time changes nothing
    expect(record(0.5).length).toBeGreaterThan(0);
  });

  it("maps phases to forms: veiled, then the true form for phases 2 and 3", () => {
    expect(formOfPhase("reveal", 1)).toBe(1);
    expect(formOfPhase("fight", 1)).toBe(1);
    expect(formOfPhase("phase2", 0.5)).toBe(3);
    expect(formOfPhase("phase3", 0.2)).toBe(3);
  });

  it("draws every cinematic behind the raiders and keeps the chest eye clear of the front-edge spots", () => {
    const spot = { x: 0, y: 0 };
    let nearest = Infinity;
    for (let slot = 0; slot < 16; slot++)
      for (const cls of ["warrior", "mage"]) {
        voidSpotOf(slot, cls, spot);
        nearest = Math.min(nearest, spot.y);
      }
    expect(VOID_BOSS_SORT_Y).toBeLessThan(nearest); // the boss ent sorts before every raider
    const scale = COLOSSUS_SCALES[COLOSSUS_SCALES.length - 1];
    const eyeBottom = COLOSSUS_CHEST_Y + COLOSSUS_EYE_HALF_H * scale;
    expect(eyeBottom).toBeLessThan(VOID_ARENA_Y1 - 24); // front-edge raiders' heads stand below the eye
  });

  it("runs the transformation shockwave once", () => {
    expect(pushbackRadius(-1)).toBe(-1);
    expect(pushbackRadius(0.45)).toBeGreaterThan(0);
    expect(pushbackRadius(PUSHBACK_S)).toBe(-1);
  });
});
