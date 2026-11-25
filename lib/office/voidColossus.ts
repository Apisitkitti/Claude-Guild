/**
 * Phase 3, THE VOID AWAKENS: the colossus IS the Veiled One. The six-winged true form is enlarged (1.5x -> 2x -> 2.5x during the
 * ascend) and looms behind the arena with its chest eye, the core, at (coreX, chest row): the body sways with the core. The
 * sky eye flies into its chest, the floor breaks and every shard but the ones under the raiders falls into the abyss, two giant
 * hands hang from its shoulders on drawn arms and slam raiders, the gaze fires from the chest eye, and when it dies the chest eye
 * cracks, the cracks spread over the whole body and large pieces fall away. Everything is opaque (hard row-span cuts, flat
 * colours, ordered dither); the body and the shards are BACK layer pieces, telegraphs / gaze / shockwaves are floor-pass pieces and
 * the hands and arms sit in the entity pass at the very back (behind every raider). No per-frame allocation: sprites and cut
 * pieces are cached, the rest is rect calls driven by hashes.
 */
import { VIEW_W, VIEW_X0, WORLD_H } from "./layout";
import { VoidGrid, type Ramp, voidColossusSprite } from "./voidBossSprite";
import { VOID_HAND_SINK_S, VOID_HAND_SLAM_S, VOID_ARENA_Y1, voidGazeX, voidHandHome } from "./voidFight";
import type { VoidHand, VoidState } from "./voidTypes";
import {
  ASCEND_DONE,
  COLOSSUS_CHEST_Y,
  COLOSSUS_PAINT_CHEST_X,
  COLOSSUS_PAINT_CHEST_Y,
  COLOSSUS_SCALES,
  COLOSSUS_SHOULDER_DX,
  COLOSSUS_SHOULDER_DY,
  GAZE_LEFT,
  GAZE_RIGHT,
  HAND_H,
  HAND_W,
  ascendBeat,
  colossusPlace,
  corePulse,
  fragmentFall,
  gazeBeamPoint,
  gazeColumn,
  handPlace,
  handWindupS,
  noise2,
  shardDrift,
  shardFallDelay,
  shardFallProgress,
  shardStays,
  type AscendBeat,
  type ColossusPlace,
  type HandPlace,
} from "./voidVisualLogic";

type Ctx = CanvasRenderingContext2D;
const TURN = Math.PI * 2;
const SQUASH = 0.62;
const clamp01 = (tick: number) => Math.min(1, Math.max(0, tick));
const ease = (tick: number) => 1 - (1 - clamp01(tick)) ** 2;
const VOIDC = "#05020b";
const GOLD = "#c8a040";
const GOLD_SH = "#7a5a1a";
const GOLD_HI = "#ffd070";

const rect = (ctx: Ctx, color: string, x: number, y: number, wide: number, high: number) => {
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x), Math.round(y), wide, high);
};
const canvasOf = (wide: number, high: number): { cv: HTMLCanvasElement; c: Ctx } | null => {
  if (typeof document === "undefined") return null;
  const cv = document.createElement("canvas");
  cv.width = wide;
  cv.height = high;
  const context = cv.getContext("2d");
  return context ? { cv, c: context } : null;
};
const disc = (ctx: Ctx, cx: number, cy: number, radius: number, color: string) => {
  for (let row = -radius; row <= radius; row++) {
    const half = Math.round(Math.sqrt(Math.max(0, radius * radius - row * row)));
    rect(ctx, color, cx - half, cy + row, half * 2 + 1, 1);
  }
};
const dots = (ctx: Ctx, cx: number, cy: number, radius: number, color: string, step: number, thick = 1, turn = 0) => {
  for (let angle = turn; angle < turn + TURN; angle += step)
    rect(ctx, color, cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius * SQUASH, thick, thick);
};

// ---- the view the scene hands to the colossus ----------------------------------------------------------------------------------------
export interface ColossusView {
  /** the colossus is shown (phase 3, or its death) */
  on: boolean;
  /** the chest eye (core) centre and the size step (index into COLOSSUS_SCALES) */
  x: number;
  y: number;
  step: number;
  /** the floor's split 0..1 (the broken shards that are not under the raiders fall) */
  split: number;
  /** the sky eye flying into the chest: 0..1 (1 = arrived), its centre and size factor */
  eyeFly: number;
  eyeX: number;
  eyeY: number;
  eyeScale: number;
  /** growth shake in px (0 under reduced motion) */
  shake: number;
  /** the gaze charging 0..1, seconds since a raider's strike */
  charge: number;
  sinceHit: number;
  /** the death: the chest eye cracks (0..1), the body shatters and falls (0..1) */
  dying: boolean;
  deathCrack: number;
  deathShatter: number;
}

const BEAT: AscendBeat = { ...ASCEND_DONE };
/** where the colossus's chest is and how big: the ascend moves and grows it, afterwards it follows the core's x */
export const colossusBodyPlace = (
  state: VoidState,
  time: number,
  still: boolean,
  out: ColossusPlace,
): ColossusPlace => {
  if (state.phase === "phase3" && !still) {
    ascendBeat(time - (state.ascendAt >= 0 ? state.ascendAt : state.phaseAt), BEAT);
    return colossusPlace(BEAT, state.x > 0 ? state.x : state.coreX, state.coreX || state.x, out);
  }
  out.x = state.coreX > 0 ? state.coreX : state.x;
  out.y = COLOSSUS_CHEST_Y;
  out.step = COLOSSUS_SCALES.length - 1;
  return out;
};

// ---- cutting a baked layer into pieces ---------------------------------------------------------------------------------------------
interface Piece {
  cv: HTMLCanvasElement | null;
  /** top-left in layer px, and the centre of the cell */
  x: number;
  y: number;
  cx: number;
  cy: number;
  rnd: number;
}
/** the pixels of a layer that are painted (alpha > 0), or null when the canvas cannot be read (every pixel counts) */
const paintedOf = (layer: HTMLCanvasElement): Uint8Array | null => {
  try {
    const context = layer.getContext("2d");
    const data = context?.getImageData(0, 0, layer.width, layer.height)?.data;
    if (!data || data.length < layer.width * layer.height * 4) return null;
    const out = new Uint8Array(layer.width * layer.height);
    for (let i = 0; i < out.length; i++) out[i] = data[i * 4 + 3] > 0 ? 1 : 0;
    return out;
  } catch {
    return null;
  }
};
/** cut `layer` into the cells of a nearest-seed (Voronoi) split, each cell its own canvas; borders get a dark line + a lit line */
const cutLayer = (
  layer: HTMLCanvasElement,
  seeds: readonly (readonly [number, number])[],
  dark: string,
  lit: string,
): Piece[] => {
  const wide = layer.width,
    high = layer.height;
  const owner = new Uint8Array(wide * high);
  const painted = paintedOf(layer);
  for (let y = 0; y < high; y++)
    for (let x = 0; x < wide; x++) {
      if (painted && !painted[y * wide + x]) {
        owner[y * wide + x] = 255;
        continue;
      }
      let best = 0,
        bestD = Infinity;
      for (let seedIndex = 0; seedIndex < seeds.length; seedIndex++) {
        const dist = (x - seeds[seedIndex][0]) ** 2 + ((y - seeds[seedIndex][1]) * 1.25) ** 2;
        if (dist < bestD) {
          bestD = dist;
          best = seedIndex;
        }
      }
      owner[y * wide + x] = best;
    }
  return seeds.map((seed, index) => {
    let x0 = wide,
      y0 = high,
      x1 = -1,
      y1 = -1;
    for (let y = 0; y < high; y++)
      for (let x = 0; x < wide; x++)
        if (owner[y * wide + x] === index) {
          x0 = Math.min(x0, x);
          y0 = Math.min(y0, y);
          x1 = Math.max(x1, x);
          y1 = Math.max(y1, y);
        }
    if (x1 < 0) return { cv: null, x: 0, y: 0, cx: seed[0], cy: seed[1], rnd: noise2(index, 71) };
    const made = canvasOf(x1 - x0 + 1, y1 - y0 + 1);
    if (made) {
      for (let y = y0; y <= y1; y++) {
        let start = -1;
        for (let x = x0; x <= x1 + 1; x++) {
          const mine = x <= x1 && owner[y * wide + x] === index;
          if (mine && start < 0) start = x;
          if (!mine && start >= 0) {
            made.c.drawImage(layer, start, y, x - start, 1, start - x0, y - y0, x - start, 1);
            start = -1;
          }
        }
      }
      for (let y = y0; y <= y1; y++)
        for (let x = x0; x <= x1; x++) {
          if (owner[y * wide + x] !== index) continue;
          const right = x + 1 < wide ? owner[y * wide + x + 1] : index;
          const below = y + 1 < high ? owner[(y + 1) * wide + x] : index;
          const left = x > 0 ? owner[y * wide + x - 1] : index;
          const above = y > 0 ? owner[(y - 1) * wide + x] : index;
          if (right !== index && right !== 255) rect(made.c, dark, x - x0, y - y0, 1, 1);
          else if (below !== index && below !== 255) rect(made.c, dark, x - x0, y - y0, 1, 1);
          else if ((left !== index && left !== 255) || (above !== index && above !== 255))
            rect(made.c, lit, x - x0, y - y0, 1, 1);
        }
    }
    return { cv: made ? made.cv : null, x: x0, y: y0, cx: seed[0], cy: seed[1], rnd: noise2(index, 71) };
  });
};

const seedGrid = (cols: number, rows: number, x0: number, y0: number, wide: number, high: number, salt: number) => {
  const out: [number, number][] = [];
  for (let row = 0; row < rows; row++)
    for (let col = 0; col < cols; col++)
      out.push([
        Math.round(x0 + ((col + 0.2 + noise2(col + salt, row) * 0.6) / cols) * wide),
        Math.round(y0 + ((row + 0.2 + noise2(row + salt, col + 9) * 0.6) / rows) * high),
      ]);
  return out;
};

// ---- the body ------------------------------------------------------------------------------------------------------------------------------
const BODY_FRAMES = 4;
const bodyOrigin = (view: ColossusView, step: number): { x: number; y: number } => ({
  x: view.x - COLOSSUS_PAINT_CHEST_X * COLOSSUS_SCALES[step],
  y: view.y - COLOSSUS_PAINT_CHEST_Y * COLOSSUS_SCALES[step],
});

let fragments: Piece[] | undefined;
/** the finished body cut into large pieces (they fall into the abyss in the death) */
const bodyFragments = (): Piece[] => {
  if (fragments) return fragments;
  const sprite = voidColossusSprite(COLOSSUS_SCALES.length - 1, 0);
  fragments = cutLayer(sprite, seedGrid(6, 4, 0, 0, sprite.width, sprite.height, 3), VOIDC, GOLD_HI);
  return fragments;
};

// the cracks of the death: lines running from the chest eye over the whole body
const CRACKS = 18;
const CRACK_SEGS = 110;
const CRACK_STEP = 4;
const CRACK_XS = new Int16Array(CRACKS * CRACK_SEGS);
const CRACK_YS = new Int16Array(CRACKS * CRACK_SEGS);
for (let crack = 0; crack < CRACKS; crack++) {
  const heading = (crack / CRACKS) * TURN + noise2(crack, 81) * 0.4;
  let px = 0,
    py = 0;
  for (let i = 0; i < CRACK_SEGS; i++) {
    const wander = (noise2(crack * 17, i) - 0.5) * 1.1;
    px += Math.cos(heading + wander) * CRACK_STEP;
    py += Math.sin(heading + wander) * CRACK_STEP * 0.8;
    CRACK_XS[crack * CRACK_SEGS + i] = Math.round(px);
    CRACK_YS[crack * CRACK_SEGS + i] = Math.round(py);
  }
}
const drawCracks = (ctx: Ctx, cx: number, cy: number, progress: number, time: number, still: boolean) => {
  const shown = Math.floor(CRACK_SEGS * clamp01(progress));
  const flick = still ? 0 : Math.floor(time * 6);
  for (let crack = 0; crack < CRACKS; crack++) {
    const reach = Math.min(shown, Math.floor(CRACK_SEGS * clamp01(progress * 1.4 - (crack % 3) * 0.1)));
    for (let i = 0; i < reach; i++) {
      const at = crack * CRACK_SEGS + i;
      rect(ctx, VOIDC, cx + CRACK_XS[at] - 1, cy + CRACK_YS[at] - 1, 5, 5);
      rect(ctx, (i + flick + crack) % 4 === 0 ? "#ffffff" : GOLD_HI, cx + CRACK_XS[at], cy + CRACK_YS[at], 3, 3);
    }
  }
};

/** the chest eye: a blazing corona around the painted eye that pulses, swells on a strike and gathers light before the gaze */
const drawChest = (ctx: Ctx, view: ColossusView, time: number, still: boolean) => {
  const scale = COLOSSUS_SCALES[view.step] / COLOSSUS_SCALES[COLOSSUS_SCALES.length - 1];
  const beat = still ? 0.5 : (Math.sin(time * 4) + 1) / 2;
  const pulse = still ? 1 : corePulse(view.sinceHit);
  const rays = 24;
  for (let ray = 0; ray < rays; ray++) {
    const angle = (still ? 0 : time * 0.5) + (ray / rays) * TURN;
    const length = (46 + (ray % 2) * 18 + beat * 10) * scale * pulse;
    for (let step = 38 * scale; step < length; step += 3)
      rect(
        ctx,
        step > length - 7 ? GOLD_HI : ray % 2 ? "#ff8a2a" : "#d0381c",
        view.x + Math.cos(angle) * step * 1.25,
        view.y + Math.sin(angle) * step * 0.9,
        3,
        3,
      );
  }
  dots(ctx, view.x, view.y, (58 + beat * 3) * scale * pulse, beat > 0.5 ? "#ffffff" : GOLD_HI, 0.07, 2);
  if (!still && view.sinceHit >= 0 && view.sinceHit < 0.35)
    dots(ctx, view.x, view.y, 40 * scale + view.sinceHit * 220, "#ffffff", 0.05, 3);
  if (view.charge > 0) {
    for (let spoke = 0; spoke < 20; spoke++) {
      const angle = (spoke / 20) * TURN + (still ? 0 : time * 2);
      const radius = (1 - view.charge) * 70 + 8;
      rect(
        ctx,
        spoke % 2 ? "#ffffff" : GOLD_HI,
        view.x + Math.cos(angle) * radius * 1.3,
        view.y + Math.sin(angle) * radius * 0.7,
        3,
        3,
      );
    }
    disc(ctx, view.x, view.y, Math.round(6 + view.charge * 20), view.charge > 0.8 ? "#ffffff" : GOLD_HI);
  }
};

const FADE_H = 56;
let fadeCv: HTMLCanvasElement | null | undefined;
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
/** the robe dissolving into the void below the floor: an opaque dark dither that thickens toward the bottom edge */
const fadeLayer = (): HTMLCanvasElement | null => {
  if (fadeCv !== undefined) return fadeCv;
  const made = canvasOf(VIEW_W, FADE_H);
  if (made)
    for (let y = 0; y < FADE_H; y++)
      for (let x = 0; x < VIEW_W; x++)
        if (BAYER[(y & 3) * 4 + (x & 3)] < (y / FADE_H) * 17) rect(made.c, VOIDC, x, y, 1, 1);
  fadeCv = made ? made.cv : null;
  return fadeCv;
};

// ---- the floor shards ------------------------------------------------------------------------------------------------------------------
let shardCache: { layer: HTMLCanvasElement; pieces: Piece[] } | undefined;
const floorShards = (layer: HTMLCanvasElement): Piece[] => {
  if (shardCache?.layer === layer) return shardCache.pieces;
  const pieces = cutLayer(layer, seedGrid(12, 6, 0, 10, VIEW_W, WORLD_H - 20, 7), VOIDC, "#7a3a1a");
  shardCache = { layer, pieces };
  return pieces;
};
const DRIFT = { x: 0, y: 0 };
/** the phase 2 island, cut along cracks: the shards under the raiders stay (and barely drift), every other one falls into the abyss */
const drawShards = (ctx: Ctx, floorLayer: HTMLCanvasElement | null, split: number, time: number, still: boolean) => {
  if (!floorLayer) return;
  floorShards(floorLayer).forEach((piece, index) => {
    if (!piece.cv) return;
    const wx = piece.cx + VIEW_X0;
    let dx = 0,
      dy = 0;
    if (shardStays(wx, piece.cy)) {
      shardDrift(wx, piece.cy, split, DRIFT);
      dx = DRIFT.x;
      dy =
        DRIFT.y +
        (still ? 0 : Math.round(Math.sin(time * 1.1 + index * 1.7) * Math.min(2, Math.hypot(DRIFT.x, DRIFT.y) * 0.12)));
    } else {
      const fall = shardFallProgress(split, shardFallDelay(wx, piece.cy));
      if (fall <= 0) return;
      dy = fragmentFall(fall, piece.rnd);
      dx = Math.round((piece.rnd - 0.5) * fall * 40);
      if (piece.y + dy > WORLD_H) return;
    }
    ctx.drawImage(piece.cv, Math.round(VIEW_X0 + piece.x + dx), Math.round(piece.y + dy));
  });
};

/**
 * the colossus's back layer, over the sky: the body (or its falling pieces), the chest eye, the dissolve under the floor line and
 * the floor shards. `floorLayer` is the phase 2 island art of the scene.
 */
export const drawColossusBack = (
  ctx: Ctx,
  view: ColossusView,
  time: number,
  still: boolean,
  floorLayer: HTMLCanvasElement | null,
) => {
  if (!view.on) return;
  const shatter = view.deathShatter;
  const jitter = view.shake > 0 && !still ? (Math.floor(time * 30) % 2 ? 1 : -1) * view.shake : 0;
  if (shatter <= 0) {
    const frame = still ? 0 : Math.floor(time * 3) % BODY_FRAMES;
    const sprite = voidColossusSprite(view.step, frame);
    const at = bodyOrigin(view, view.step);
    ctx.drawImage(sprite, Math.round(at.x + jitter), Math.round(at.y));
    if (view.eyeFly >= 1 || !view.dying) drawChest(ctx, view, time, still);
    if (view.dying) drawCracks(ctx, view.x, view.y, view.deathCrack, time, still);
  } else {
    const at = bodyOrigin(view, COLOSSUS_SCALES.length - 1);
    bodyFragments().forEach((piece) => {
      if (!piece.cv) return;
      const fall = fragmentFall(shatter, piece.rnd);
      if (at.y + piece.y + fall > WORLD_H) return;
      ctx.drawImage(
        piece.cv,
        Math.round(at.x + piece.x + (piece.rnd - 0.5) * shatter * 30),
        Math.round(at.y + piece.y + fall),
      );
    });
  }
  const fade = fadeLayer();
  if (fade) ctx.drawImage(fade, VIEW_X0, WORLD_H - FADE_H);
  drawShards(ctx, floorLayer, view.split, time, still);
};

// ---- the hands -----------------------------------------------------------------------------------------------------------------------------
const STONE_R: Ramp = { base: "#2a2150", hi: "#5a4a98", sh: "#1a1438", dk: "#0a0618" };
const BONE_R: Ramp = { base: "#ece4cf", hi: "#fffdf2", sh: "#b9ac8c", dk: "#6a5f48" };
const GOLD_R: Ramp = { base: "#f2c14e", hi: "#fff0a0", sh: "#c28a22", dk: "#7a4a0c" };
const handCache = new Map<string, HTMLCanvasElement>();
/** a giant hand, palm toward the viewer: fingers up (open) or hanging down in claws; the thumb points toward the arena */
const paintHand = (grid: InstanceType<typeof VoidGrid>, claw: boolean, mirror: boolean) => {
  const sign = claw ? 1 : -1;
  const cy = claw ? 32 : 52;
  const flip = (x: number) => (mirror ? HAND_W - 1 - x : x);
  const at = (x: number) => flip(x);
  // wrist and forearm stump
  const wristY = cy - sign * 20;
  grid.limb(at(36), cy, 12, at(36), wristY - sign * 14, 10, STONE_R);
  grid.rect(Math.min(at(26), at(46)), wristY - sign * 6, Math.max(at(26), at(46)), wristY - sign * 3, GOLD_R.sh);
  grid.row(wristY - sign * 6, Math.min(at(26), at(46)), Math.max(at(26), at(46)), GOLD_R.base);
  // palm
  grid.ell(at(36), cy, 19, 16, STONE_R);
  grid.ell(at(36), cy + sign * 2, 8, 6, { base: "#4a1018", hi: "#a02030", sh: "#2a0810", dk: "#14040a" });
  grid.set(at(36), cy + sign * 2, "#ff6a4a");
  // four fingers (three joints each) with claws
  const lens = [26, 32, 30, 22];
  for (let finger = 0; finger < 4; finger++) {
    const fx = 22 + finger * 9;
    const lean = (finger - 1.5) * 2.2;
    const baseY = cy + sign * 12;
    const midY = baseY + sign * lens[finger] * 0.5;
    const tipY = baseY + sign * lens[finger];
    const curl = claw ? -(finger - 1.5) * 1 : (finger - 1.5) * 1.4;
    grid.limb(at(fx), baseY, 4.4, at(fx + lean * 0.6), midY, 3.8, STONE_R);
    grid.limb(at(fx + lean * 0.6), midY, 3.8, at(fx + lean + curl), tipY, 3.0, STONE_R);
    grid.ell(at(fx), baseY - sign * 1, 2.4, 1.6, GOLD_R);
    grid.tri(
      at(fx + lean + curl - 2),
      tipY,
      at(fx + lean + curl + 2),
      tipY,
      at(fx + lean + curl),
      tipY + sign * 9,
      BONE_R.base,
    );
    grid.set(at(fx + lean + curl), tipY + sign * 6, BONE_R.hi);
  }
  // the thumb, toward the arena
  grid.limb(at(19), cy + sign * 6, 4.6, at(8), cy - sign * 2, 4, STONE_R);
  grid.limb(at(8), cy - sign * 2, 4, at(4), cy - sign * 12, 3, STONE_R);
  grid.tri(at(2), cy - sign * 13, at(6), cy - sign * 13, at(3), cy - sign * 21, BONE_R.base);
  // glowing veins across the back
  for (let vein = 0; vein < 3; vein++)
    grid.line(at(26 + vein * 6), cy - sign * 8, at(28 + vein * 5), cy + sign * 4, vein % 2 ? "#ff6a4a" : "#a02030");
};
export const handSprite = (claw: boolean, mirror: boolean): HTMLCanvasElement => {
  const key = `${claw ? 1 : 0}${mirror ? 1 : 0}`;
  const known = handCache.get(key);
  if (known) return known;
  const grid = new VoidGrid(HAND_W, HAND_H);
  grid.dy = claw ? 4 : 2;
  paintHand(grid, claw, mirror);
  grid.outline();
  const canvas = grid.toCanvas();
  handCache.set(key, canvas);
  return canvas;
};
const ARM_COLORS = { dark: "#05020b", base: "#2a2150", hi: "#5a4a98", sh: "#1a1438" };
const SEG_NODES = 12;
const SHOULDER_PLACE: ColossusPlace = { x: 0, y: 0, step: 0 };
/** a thick segmented arm from the shoulder (sx, sy) to the wrist (wx, wy): dark plates with a lit edge and gold joint bands */
const drawArm = (ctx: Ctx, sx: number, sy: number, wx: number, wy: number, side: number) => {
  const ctrlX = (sx + wx) / 2 + side * 22,
    ctrlY = (sy + wy) / 2 + 14;
  for (let node = 0; node <= SEG_NODES; node++) {
    const tick = node / SEG_NODES;
    const inv = 1 - tick;
    const x = inv * inv * sx + 2 * inv * tick * ctrlX + tick * tick * wx;
    const y = inv * inv * sy + 2 * inv * tick * ctrlY + tick * tick * wy;
    const radius = Math.round(11 - tick * 4);
    disc(ctx, Math.round(x), Math.round(y), radius + 1, ARM_COLORS.dark);
    disc(ctx, Math.round(x), Math.round(y), radius, node % 2 ? ARM_COLORS.sh : ARM_COLORS.base);
    disc(ctx, Math.round(x - 2), Math.round(y - 2), Math.max(2, radius - 5), ARM_COLORS.hi);
    if (node % 4 === 2) disc(ctx, Math.round(x), Math.round(y), radius - 1, GOLD_SH);
    if (node % 4 === 2) disc(ctx, Math.round(x - 1), Math.round(y - 1), radius - 3, GOLD);
  }
};

const PLACE: HandPlace = { x: 0, y: 0, claw: false, slam: 0 };
const lastState: string[] = ["", ""];
const HOME = { x: 0, y: 0 };

/** the colossus's hands (entity pass, behind every raider) */
const drawHands = (ctx: Ctx, state: VoidState, time: number, still: boolean) => {
  const body = colossusBodyPlace(state, time, still, SHOULDER_PLACE);
  state.hands.forEach((hand, index) => {
    const home = voidHandHome(hand.side);
    HOME.x = home.x;
    HOME.y = home.y;
    const fromSink = lastState[index] === "sink" && hand.state === "hover";
    if (lastState[index] !== hand.state && lastState[index] !== "") lastState[index] = hand.state;
    else if (lastState[index] === "") lastState[index] = hand.state;
    const place = handPlace(hand, HOME, time, handWindupS(), still, fromSink, PLACE);
    let hx = place.x,
      hy = place.y;
    if (state.phase === "dying") {
      hy += Math.round(clamp01(still ? 0.5 : (time - state.phaseAt - 1.8) / 1.6) * 150);
      hx += still ? 0 : (Math.floor(time * 24) % 2 ? 1 : -1) * 2;
    }
    const sprite = handSprite(place.claw, hand.side < 0);
    const scale = COLOSSUS_SCALES[body.step];
    drawArm(
      ctx,
      body.x + hand.side * COLOSSUS_SHOULDER_DX * scale,
      body.y + COLOSSUS_SHOULDER_DY * scale,
      hx,
      place.claw ? hy - HAND_H / 2 + 8 : hy + HAND_H / 2 - 12,
      hand.side,
    );
    ctx.drawImage(sprite, Math.round(hx - HAND_W / 2), Math.round(hy - HAND_H / 2));
  });
};

/** the hands and their arms: entity pass at the very back */
export const drawColossusEnts = (ctx: Ctx, state: VoidState, time: number, still: boolean) => {
  drawHands(ctx, state, time, still);
};

// ---- the floor pass: hand telegraphs, slam shockwaves, the gaze --------------------------------------------------------------------
const WARN = "#ff3b5a";
const WARN_HI = "#ffb0c0";
const RED_S = "#a0182e";
const VIOLET_S = "#4a2a8a";
/** a striped ellipse of warning (opaque) on the floor at (cx, cy) */
const warnEllipse = (ctx: Ctx, cx: number, cy: number, radius: number, time: number, still: boolean) => {
  const ry = Math.round(radius * SQUASH);
  const slide = still ? 0 : Math.floor(time * 12);
  for (let row = -ry; row <= ry; row++) {
    const half = Math.round(radius * Math.sqrt(1 - (row * row) / (ry * ry + 1)));
    rect(ctx, Math.floor((row + slide) / 3) % 2 === 0 ? RED_S : VIOLET_S, cx - half, cy + row, half * 2 + 1, 1);
  }
  dots(ctx, cx, cy, radius, still || Math.floor(time * 8) % 2 === 0 ? WARN_HI : WARN, 0.08, 2);
};

const drawHandFloor = (ctx: Ctx, hand: VoidHand, state: VoidState, time: number, still: boolean) => {
  const age = time - hand.at;
  if (hand.state === "windup") {
    const grow = still ? 1 : clamp01(age / handWindupS());
    warnEllipse(ctx, hand.x, hand.y, 14 + grow * 22, time, still);
    rect(ctx, WARN_HI, hand.x - 1, hand.y - 1, 3, 3);
  } else if (hand.state === "slam") {
    // the hand's shadow shrinks onto the spot as it falls
    const tick = clamp01(age / VOID_HAND_SLAM_S);
    for (let row = -6; row <= 6; row++) {
      const half = Math.round((36 - tick * 14) * Math.sqrt(1 - (row * row) / 49));
      rect(ctx, "#05020b", hand.x - half, hand.y + row, half * 2, 1);
    }
  }
  if (hand.state === "sink") {
    const wave = still ? 0.2 : Math.max(0, age);
    if (hand.state === "sink") {
      // ground cracks radiating from the crash that fade as the hand sinks
      const keep = still ? 1 : 1 - clamp01(age / VOID_HAND_SINK_S);
      for (let crack = 0; crack < 8; crack++) {
        const angle = (crack / 8) * TURN + noise2(crack, 91) * 0.4;
        const length = Math.round((16 + noise2(crack, 92) * 12) * Math.min(1, 0.4 + wave * 3));
        const shown = Math.round(length * keep);
        for (let step = 3; step < shown; step += 2) {
          rect(ctx, "#05020b", hand.x + Math.cos(angle) * step - 1, hand.y + Math.sin(angle) * step * SQUASH - 1, 3, 3);
          rect(
            ctx,
            step % 4 ? "#ff6a4a" : GOLD_HI,
            hand.x + Math.cos(angle) * step,
            hand.y + Math.sin(angle) * step * SQUASH,
            1,
            1,
          );
        }
      }
      if (!still && age < 0.4) {
        for (let k = 0; k < 3; k++) {
          const radius = (age - k * 0.06) * 160;
          if (radius > 0)
            dots(ctx, hand.x, hand.y, radius, k === 0 ? "#ffffff" : k === 1 ? GOLD_HI : "#d0381c", 0.05, 2);
        }
        if (age < 0.1) disc(ctx, hand.x, hand.y, 16, age < 0.05 ? "#ffffff" : GOLD_HI);
        for (let piece = 0; piece < 12; piece++) {
          const angle = noise2(piece, 93) * TURN;
          const speed = 40 + noise2(piece, 94) * 70;
          rect(
            ctx,
            piece % 3 ? "#4a2536" : "#ff8a2a",
            hand.x + Math.cos(angle) * speed * age,
            hand.y + Math.sin(angle) * speed * age * 0.7 - 30 * age + 160 * age * age,
            3,
            3,
          );
        }
      }
    }
  }
  void state;
};

const BEAM_P = { x: 0, y: 0 };
const CHEST_PLACE: ColossusPlace = { x: 0, y: 0, step: 0 };
const drawGaze = (ctx: Ctx, state: VoidState, time: number, still: boolean) => {
  const attack = state.attack;
  if (!attack || attack.kind !== "gaze" || time >= attack.endAt) return;
  const charging = time < attack.hitAt;
  if (charging) {
    // the whole sweep lane is marked: striped end marks, chevrons running to the right, the start line pulsing
    const hot = still || Math.floor(time * 9) % 2 === 0;
    const lane = hot ? WARN_HI : WARN;
    rect(ctx, lane, GAZE_LEFT - 2, VOID_ARENA_Y1 - 2, GAZE_RIGHT - GAZE_LEFT + 4, 2);
    rect(ctx, lane, GAZE_LEFT - 2, 68, GAZE_RIGHT - GAZE_LEFT + 4, 2);
    for (let x = GAZE_LEFT + 6; x < GAZE_RIGHT - 6; x += 22) {
      const slide = still ? 0 : Math.floor(time * 30) % 22;
      const cx = GAZE_LEFT + 6 + ((x - GAZE_LEFT - 6 + slide) % (GAZE_RIGHT - GAZE_LEFT - 12));
      rect(ctx, lane, cx, VOID_ARENA_Y1 - 6, 2, 2);
      rect(ctx, lane, cx + 2, VOID_ARENA_Y1 - 5, 2, 2);
      rect(ctx, lane, cx, VOID_ARENA_Y1 - 4, 2, 2);
    }
    const start = gazeColumn(GAZE_LEFT);
    for (let y = start.y; y < start.y + start.height; y += 4)
      rect(ctx, y % 8 ? RED_S : VIOLET_S, start.x, y, start.width, 3);
    return;
  }
  const gx = voidGazeX(attack, time, GAZE_LEFT, GAZE_RIGHT);
  const chest = colossusBodyPlace(state, time, still, CHEST_PLACE);
  const trailTo = Math.max(GAZE_LEFT, gx - 4);
  // the scorched trail the beam leaves: embers on the floor
  for (let x = GAZE_LEFT; x < trailTo; x += 3) {
    const fade = (gx - x) / (GAZE_RIGHT - GAZE_LEFT);
    if (noise2(x, 95) > 0.75 - fade * 0.2) continue;
    rect(ctx, fade < 0.25 ? "#ff8a2a" : "#4a1a1a", x, 74 + noise2(x, 96) * (VOID_ARENA_Y1 - 80), 2, 2);
  }
  const col = gazeColumn(gx);
  rect(ctx, "#05020b", col.x - 2, col.y, col.width + 4, col.height);
  rect(ctx, "#d0381c", col.x, col.y, col.width, col.height);
  rect(ctx, "#ff8a2a", col.x + 2, col.y, col.width - 4, col.height);
  rect(ctx, GOLD_HI, col.x + 4, col.y, col.width - 8, col.height);
  rect(ctx, "#ffffff", col.x + 7, col.y, col.width - 14, col.height);
  // the beam from the eye down to the floor column
  for (let seg = 0; seg <= 30; seg++) {
    gazeBeamPoint(chest.x, chest.y, gx, seg / 30, BEAM_P);
    rect(ctx, "#a0182e", BEAM_P.x - 5, BEAM_P.y - 4, 11, 9);
    rect(ctx, "#ff8a2a", BEAM_P.x - 3, BEAM_P.y - 3, 7, 7);
    rect(ctx, "#ffffff", BEAM_P.x - 1, BEAM_P.y - 2, 3, 5);
  }
  disc(ctx, chest.x, chest.y, 12, "#ffffff");
  if (!still)
    for (let k = 0; k < 8; k++)
      rect(
        ctx,
        k % 2 ? GOLD_HI : "#ffffff",
        gx - 14 + noise2(k + Math.floor(time * 30), 97) * 28,
        74 + noise2(k, 98) * 110,
        2,
        2,
      );
};

/** floor-level work of the colossus: hand telegraphs and shockwaves, the gaze (drawn before the characters) */
export const drawColossusFloor = (ctx: Ctx, state: VoidState, time: number, still: boolean) => {
  for (const hand of state.hands) drawHandFloor(ctx, hand, state, time, still);
  drawGaze(ctx, state, time, still);
};

/** the death's final burst around the core: a growing white-gold disc, shock rings and sparks (entity pass: behind raiders) */
export const drawColossusFlash = (ctx: Ctx, state: VoidState, flash: number, time: number, still: boolean) => {
  const chest = colossusBodyPlace(state, time, still, CHEST_PLACE);
  const cx = Math.round(chest.x),
    cy = Math.round(chest.y);
  const radius = 6 + ease(flash) * 70;
  disc(ctx, cx, cy, Math.round(radius), flash > 0.55 ? GOLD_HI : "#ffffff");
  dots(ctx, cx, cy, ease(flash) * 190, "#ffffff", 0.04, 3);
  dots(ctx, cx, cy, ease(flash * 0.8) * 150, GOLD, 0.05, 2);
  if (!still)
    for (let k = 0; k < 48; k++) {
      const angle = noise2(k, 99) * TURN;
      const speed = 60 + noise2(k, 100) * 140;
      rect(
        ctx,
        k % 3 ? GOLD_HI : "#ffffff",
        cx + Math.cos(angle) * speed * flash * 1.4,
        cy + Math.sin(angle) * speed * flash * 1.1 + 30 * flash * flash,
        3,
        3,
      );
    }
  void time;
};
