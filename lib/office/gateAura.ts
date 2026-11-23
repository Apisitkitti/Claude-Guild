import { DUNGEON, WORLD_W } from "./layout";

/**
 * The menace around the dark castle (top-right of the field): a permanent storm-cloud mass over it with now and then
 * a lightning bolt, a blood-red band in the sky behind it, dead trees / pikes / gravestones / brambles on its banks,
 * a purple mist hugging its foot, red eyes blinking in the gate's darkness and crows on its pillars.
 *
 * Three entry points, each for one render layer (see the doc on each). Everything is opaque pixel art except the
 * mist wisps, which are low-alpha and drawn strictly BEFORE any character. `intensity` (0..1) rises while a boss is
 * out: clouds sink, lightning comes faster, eyes burn brighter, more crows circle. `still` freezes everything.
 */
type Ctx = CanvasRenderingContext2D;

const SKY_H = 52;
/** the aura's sky patch: the right third of the sky (it fades in from the left edge by dithering) */
const SKY_X0 = 236;
const SKY_W = WORLD_W - SKY_X0;
/** clouds are painted from this y (above the canvas) so lowering them never opens a gap at the top */
const CLOUD_TOP = -10;
const CLOUD_LOWER = 5;

const rect = (ctx: Ctx, color: string, x: number, y: number, width: number, height: number) => {
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x), Math.round(y), width, height);
};

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));
const lerp = (from: number, to: number, ratio: number) => from + (to - from) * ratio;

// ---- colour helpers ---------------------------------------------------------------------------------------------
const parse = (hex: string): [number, number, number] => [
  parseInt(hex.slice(1, 3), 16),
  parseInt(hex.slice(3, 5), 16),
  parseInt(hex.slice(5, 7), 16),
];
const mixHex = (from: string, to: string, ratio: number): string => {
  const fromRgb = parse(from),
    toRgb = parse(to);
  const channel = (i: number) =>
    Math.round(lerp(fromRgb[i], toRgb[i], clamp01(ratio)))
      .toString(16)
      .padStart(2, "0");
  return `#${channel(0)}${channel(1)}${channel(2)}`;
};

// ---- offscreen cache (with a no-document fallback that draws straight onto the caller's context) ----------------
type Layer = { canvas: HTMLCanvasElement; x0: number; y0: number };
const layers = new Map<string, Layer>();
/** paint `paint` once into an offscreen canvas covering the world rect and blit it; without a DOM paint straight in */
const cachedBlit = (
  ctx: Ctx,
  key: string,
  x0: number,
  y0: number,
  width: number,
  height: number,
  paint: (target: Ctx) => void,
  offsetY = 0,
) => {
  if (typeof document === "undefined") {
    ctx.save();
    ctx.translate(0, offsetY);
    paint(ctx);
    ctx.restore();
    return;
  }
  let layer = layers.get(key);
  if (!layer) {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const target = canvas.getContext("2d");
    if (!target) {
      paint(ctx);
      return;
    }
    target.translate(-x0, -y0);
    paint(target);
    layer = { canvas, x0, y0 };
    layers.set(key, layer);
  }
  ctx.drawImage(layer.canvas, layer.x0, layer.y0 + offsetY);
};

// ---- deterministic noise (integer hash, so every engine agrees) -----------------------------------------------------
const hash = (first: number, second = 0): number => {
  let acc = Math.imul(first | 0, 374761393) + Math.imul(second | 0, 668265263);
  acc = Math.imul(acc ^ (acc >>> 13), 1274126177);
  acc ^= acc >>> 16;
  return (acc >>> 0) / 4294967296;
};
/** smooth 1D value noise in 0..1 */
const vnoise = (pos: number, seed: number): number => {
  const cell = Math.floor(pos),
    frac = pos - cell;
  const smooth = frac * frac * (3 - 2 * frac);
  return lerp(hash(cell, seed), hash(cell + 1, seed), smooth);
};

// ---- the sky band: dark purple at the top bleeding to blood red at the horizon, dithered in from the left ----------
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
const BAND_TOP = "#1c1029";
const BAND_BOT = "#5e1a2c";
/** the horizontal fade-in is this wide, starting from a ragged per-row edge */
const BAND_FADE = 52;

const paintBand = (ctx: Ctx, night: number, intensity: number) => {
  const dark = night * 0.4;
  for (let x = SKY_X0; x < WORLD_W; x++) {
    // ragged top and bottom: the band thins out over ~10px along a noisy line
    const topEdge = 1 + vnoise(x / 5, 3) * 7;
    const botEdge = 3 + vnoise(x / 4, 2) * 9;
    for (let y = 0; y < SKY_H; y++) {
      const edge = SKY_X0 + 4 + vnoise(y / 3.2, 1) * 22 + (hash(y, 7) - 0.5) * 7;
      const hFade = clamp01((x - edge) / BAND_FADE);
      const vFade = clamp01((y - topEdge + 4) / 10) * clamp01((SKY_H - y - botEdge) / 12);
      const base = fadeCurve(hFade) * vFade * (0.6 + 0.4 * (y / SKY_H)) * (0.85 + 0.15 * clamp01((x - 300) / 60));
      const threshold = BAYER[(y & 3) * 4 + (x & 3)] / 16 + (hash(x, y) - 0.5) * 0.3;
      if (threshold >= base) continue;
      const row = mixHex(mixHex(BAND_TOP, BAND_BOT, y / SKY_H), "#08040c", dark);
      rect(ctx, mixHex(row, "#8a1e30", intensity * 0.4), x, y, 1, 1);
    }
  }
};
const fadeCurve = (ratio: number) => ratio * ratio * (3 - 2 * ratio);

// ---- the cloud mass ---------------------------------------------------------------------------------------------
type Puff = { cx: number; cy: number; rx: number; ry: number };
/** back-to-front: the churning mass sits over the castle (x 342) and trails off to the west */
const CLOUD_PUFFS: Puff[] = [
  { cx: 270, cy: 2, rx: 16, ry: 8 },
  { cx: 292, cy: 4, rx: 22, ry: 10 },
  { cx: 318, cy: 5, rx: 26, ry: 11 },
  { cx: 346, cy: 4, rx: 30, ry: 12 },
  { cx: 372, cy: 5, rx: 26, ry: 11 },
  { cx: 384, cy: 6, rx: 20, ry: 10 },
  { cx: 304, cy: 12, rx: 16, ry: 6 },
  { cx: 332, cy: 15, rx: 22, ry: 7 },
  { cx: 358, cy: 14, rx: 20, ry: 7 },
  { cx: 380, cy: 15, rx: 14, ry: 6 },
];
/** small outlying puffs reaching west into the blue sky at varying heights; they drift a little */
const LEAD_PUFFS = [
  { cx: 252, cy: 7, rx: 9, ry: 5, amp: 2, speed: 0.17, phase: 0.6 },
  { cx: 261, cy: 17, rx: 8, ry: 4, amp: 3, speed: 0.21, phase: 2.4 },
  { cx: 247, cy: 22, rx: 6, ry: 3, amp: 2, speed: 0.19, phase: 4.1 },
  { cx: 258, cy: -1, rx: 10, ry: 5, amp: 2, speed: 0.15, phase: 1.3 },
];
/** the churning puffs ride on top of the cached mass: base position, drift amplitude, speed and phase */
const CHURN = Array.from({ length: 8 }, (_, i) => ({
  cx: 276 + i * 15 + (i % 2) * 4,
  cy: 10 + ((i * 5) % 9),
  rx: 9 + (i % 3) * 3,
  ry: 4 + (i % 2),
  amp: 3 + (i % 3),
  speed: 0.22 + (i % 4) * 0.05,
  phase: i * 1.7,
}));

type Tones = { rim: string; body: string; core: string; shade: string; deep: string };
const tonesFor = (night: number, intensity: number, lit: boolean): Tones => {
  if (lit) return { rim: "#e4d6ff", body: "#9a86d6", core: "#7a67b4", shade: "#6a579e", deep: "#443673" };
  const tint = (hex: string) => mixHex(mixHex(hex, "#3a1220", intensity * 0.4), "#050308", night * 0.35);
  return {
    rim: tint("#4c3c62"),
    body: tint("#2e2542"),
    core: tint("#241b36"),
    shade: tint("#201833"),
    deep: tint("#150f22"),
  };
};

type ToneKey = keyof Tones;
const TONE_KEYS: ToneKey[] = ["rim", "body", "core", "shade", "deep"];
/** one pre-shaded vertical run of a cloud shape; x/y are relative to the shape's origin (world coords for the mass) */
type Run = { x: number; y: number; h: number; tone: number };

/** overlapping lumpy ellipses around a puff: bumps all round, bigger on top (billows) and few below */
const lumpsOf = (puff: Puff, seed: number): Puff[] => {
  const out: Puff[] = [puff];
  const count = 5 + Math.round(puff.rx / 8);
  for (let j = 0; j < count; j++) {
    const angle = Math.PI + ((j + hash(seed, j)) / count) * Math.PI * 1.15 - Math.PI * 0.075;
    const size = 2.5 + hash(seed, j + 40) * (puff.ry * 0.45);
    out.push({
      cx: puff.cx + Math.cos(angle) * puff.rx * (0.78 + hash(seed, j + 80) * 0.2),
      cy: puff.cy + Math.sin(angle) * puff.ry * (0.72 + hash(seed, j + 120) * 0.2),
      rx: size * 1.3,
      ry: size,
    });
  }
  // a couple of lower bumps so the underside is not a flat line
  for (let j = 0; j < 2; j++) {
    const size = 2 + hash(seed, j + 160) * 2;
    out.push({
      cx: puff.cx + (hash(seed, j + 200) - 0.5) * puff.rx * 1.3,
      cy: puff.cy + puff.ry * 0.75,
      rx: size * 1.4,
      ry: size,
    });
  }
  return out;
};

/**
 * Rasterise ellipses into shaded column runs: light rim on the top and left edges, darker core in the middle, shade
 * and deep tones on the underside, which is eaten into wisps (ragged dangling strands and gaps).
 */
const buildRuns = (ellipses: Puff[], x0: number, y0: number, width: number, height: number, wisps: boolean): Run[] => {
  const grid = new Uint8Array(width * height);
  const at = (x: number, y: number) => (x < 0 || y < 0 || x >= width || y >= height ? 0 : grid[y * width + x]);
  for (const lump of ellipses) {
    const lx = lump.cx - x0,
      ly = lump.cy - y0;
    for (let y = Math.max(0, Math.floor(ly - lump.ry)); y <= Math.min(height - 1, Math.ceil(ly + lump.ry)); y++) {
      for (let x = Math.max(0, Math.floor(lx - lump.rx)); x <= Math.min(width - 1, Math.ceil(lx + lump.rx)); x++) {
        const dx = (x - lx) / lump.rx,
          dy = (y - ly) / lump.ry;
        if (dx * dx + dy * dy <= 1) grid[y * width + x] = 1;
      }
    }
  }
  if (wisps) {
    for (let x = 0; x < width; x++) {
      let bottom = -1;
      for (let y = height - 1; y >= 0; y--) {
        if (grid[y * width + x]) {
          bottom = y;
          break;
        }
      }
      if (bottom < 0) continue;
      const roll = hash(x + x0, 11);
      if (roll < 0.28) {
        // nibble the underside away
        const bite = 1 + Math.floor(hash(x + x0, 12) * 2.5);
        for (let k = 0; k < bite; k++) if (bottom - k > 1) grid[(bottom - k) * width + x] = 0;
      } else if (roll > 0.55 && at(x, bottom) && bottom + 1 < height) {
        // dangle a wispy strand
        const len = 1 + Math.floor(hash(x + x0, 13) * 6);
        for (let k = 1; k <= len && bottom + k < height; k++) {
          if (hash(x + x0, 14 + k) < 0.25 + 0.1 * k) break;
          grid[(bottom + k) * width + x] = 1;
        }
      }
    }
    // loose rags drifting below the mass
    for (let x = 1; x < width - 4; x++) {
      if (hash(x + x0, 21) > 0.045) continue;
      let bottom = -1;
      for (let y = height - 1; y >= 0; y--) {
        if (grid[y * width + x]) {
          bottom = y;
          break;
        }
      }
      if (bottom < 0 || bottom + 6 >= height) continue;
      const span = 2 + Math.floor(hash(x + x0, 22) * 3);
      for (let k = 0; k < span; k++) grid[(bottom + 5) * width + x + k] = 1;
    }
  }
  const runs: Run[] = [];
  const toneAt = (x: number, y: number): number => {
    if (!at(x, y + 1)) return 4; // deep
    if (!at(x, y - 1) || !at(x - 1, y) || (!at(x - 1, y - 1) && at(x, y - 1) && !at(x - 2, y))) return 0; // rim
    if (!at(x, y + 2) || !at(x + 1, y)) return 3; // shade
    if (at(x - 3, y) && at(x + 3, y) && at(x, y - 3) && at(x, y + 3)) return 2; // core
    return 1;
  };
  for (let x = 0; x < width; x++) {
    let runStart = -1,
      runTone = -1;
    for (let y = 0; y <= height; y++) {
      const tone = y < height && grid[y * width + x] ? toneAt(x, y) : -1;
      if (tone !== runTone) {
        if (runTone >= 0) runs.push({ x: x + x0, y: runStart + y0, h: y - runStart, tone: runTone });
        runStart = y;
        runTone = tone;
      }
    }
  }
  return runs;
};

const paintRuns = (ctx: Ctx, runs: Run[], tones: Tones, ox = 0, oy = 0) => {
  for (const run of runs) {
    const x = run.x + ox;
    if (x < SKY_X0 || x >= WORLD_W) continue;
    rect(ctx, tones[TONE_KEYS[run.tone]], x, run.y + oy, 1, run.h);
  }
};

let massRuns: Run[] | null = null;
const getMassRuns = (): Run[] => {
  if (!massRuns) {
    const ellipses = CLOUD_PUFFS.flatMap((puff, i) => lumpsOf(puff, i + 1));
    massRuns = buildRuns(ellipses, SKY_X0, CLOUD_TOP, SKY_W, SKY_H - CLOUD_TOP, true).filter(
      (run) => run.x >= SKY_X0 && run.x < WORLD_W,
    );
  }
  return massRuns;
};

/** a drifting puff's shape, built around a local origin so it can be shifted by whole pixels each frame */
type Shape = { runs: Run[]; ox: number; oy: number };
const makeShape = (puff: Puff, seed: number, wisps: boolean): Shape => {
  const pad = 4;
  const width = Math.ceil(puff.rx * 2) + pad * 2 + 4,
    height = Math.ceil(puff.ry * 2) + pad * 2 + (wisps ? 8 : 4);
  const cx = Math.round(width / 2),
    cy = pad + Math.ceil(puff.ry) + 2;
  const local: Puff = { cx, cy, rx: puff.rx, ry: puff.ry };
  return { runs: buildRuns(lumpsOf(local, seed), 0, 0, width, height, wisps), ox: cx, oy: cy };
};
let driftShapes: Shape[] | null = null;
/** the drifting puffs in the order getDriftShapes() builds their shapes (built once, not per frame) */
const DRIFT_MOVERS = [...CHURN, ...LEAD_PUFFS];
const getDriftShapes = (): Shape[] => {
  if (!driftShapes) {
    driftShapes = [
      ...CHURN.map((puff, i) => makeShape(puff, 100 + i, true)),
      ...LEAD_PUFFS.map((puff, i) => makeShape(puff, 200 + i, true)),
    ];
  }
  return driftShapes;
};

const paintCloudBase = (ctx: Ctx, tones: Tones) => paintRuns(ctx, getMassRuns(), tones);

// ---- lightning schedule (a pure function of time, so tests and frames agree) ------------------------------------
const LIGHTNING_SLOW = 12;
const LIGHTNING_FAST = 4.5;
const FLASH_LEN = 0.28;
type Flash = { on: boolean; bright: boolean; cycle: number };
const flashAt = (time: number, still: boolean, intensity: number): Flash => {
  if (still) return { on: false, bright: false, cycle: 0 };
  const period = lerp(LIGHTNING_SLOW, LIGHTNING_FAST, clamp01(intensity));
  const cycle = Math.floor(time / period);
  const phase = time - cycle * period;
  const bright = phase < 0.09 || (phase >= 0.15 && phase < 0.24);
  return { on: phase < FLASH_LEN, bright, cycle };
};

const nightLevel = (night: number) => Math.round(clamp01(night) * 4);
const intensityLevel = (intensity: number) => Math.round(clamp01(intensity) * 3);

/**
 * Sky layer: call from `drawSky` AFTER the sky gradient / sun / moon / ordinary clouds and BEFORE the backdrop hills
 * and the castle (it paints inside a clip x 236..384, y 0..52, but every edge inside it is a ragged dither / lumpy silhouette). `night` is the 0..1 night factor.
 */
export const drawGateAuraSky = (ctx: Ctx, time: number, still: boolean, intensity: number, night: number) => {
  const level = intensityLevel(intensity);
  const nightQ = nightLevel(night);
  const calm = nightQ / 4;
  const heat = level / 3;
  const drift = still ? 0 : time;
  ctx.save();
  ctx.beginPath();
  ctx.rect(SKY_X0, 0, SKY_W, SKY_H);
  ctx.clip();
  cachedBlit(ctx, `band|${nightQ}|${level}`, SKY_X0, 0, SKY_W, SKY_H, (target) => paintBand(target, calm, heat));
  const lower = Math.round(clamp01(intensity) * CLOUD_LOWER);
  const flash = flashAt(time, still, intensity);
  const tones = tonesFor(calm, heat, flash.on && flash.bright);
  if (flash.on && flash.bright) {
    // the strike: the whole mass repaints in its lit palette for a few frames (opaque, no flash overlay)
    ctx.save();
    ctx.translate(0, lower);
    paintCloudBase(ctx, tones);
    ctx.restore();
  } else {
    cachedBlit(
      ctx,
      `cloud|${nightQ}|${level}`,
      SKY_X0,
      CLOUD_TOP,
      SKY_W,
      SKY_H - CLOUD_TOP,
      (target) => paintCloudBase(target, tones),
      lower,
    );
  }
  const shapes = getDriftShapes();
  ctx.save();
  ctx.translate(0, lower);
  for (let i = 0; i < DRIFT_MOVERS.length; i++) {
    const puff = DRIFT_MOVERS[i];
    const shape = shapes[i];
    const cx = puff.cx + Math.sin(drift * puff.speed + puff.phase) * puff.amp;
    const cy = puff.cy + Math.cos(drift * puff.speed * 0.8 + puff.phase) * 1.5;
    paintRuns(ctx, shape.runs, tones, Math.round(cx) - shape.ox, Math.round(cy) - shape.oy);
  }
  ctx.restore();
  ctx.restore();
};

// ---- props on the banks (static, cached) ------------------------------------------------------------------------
type PropKind = "tree" | "pike" | "grave" | "cross" | "bramble";
export type AuraProp = { kind: PropKind; x: number; y: number; w: number; h: number };
/** x = centre, y = feet. None sits on the bridge column or on the bank row y 75 bosses and raiders walk (feet stay at y 71 or above). */
export const GATE_AURA_PROPS: AuraProp[] = [
  { kind: "tree", x: 308, y: 51, w: 9, h: 16 },
  { kind: "pike", x: 315, y: 52, w: 5, h: 14 },
  { kind: "pike", x: 371, y: 52, w: 5, h: 14 },
  { kind: "tree", x: 378, y: 51, w: 9, h: 16 },
  { kind: "bramble", x: 356, y: 66, w: 9, h: 6 },
  { kind: "grave", x: 365, y: 62, w: 7, h: 7 },
  { kind: "cross", x: 373, y: 62, w: 7, h: 8 },
  { kind: "grave", x: 381, y: 62, w: 7, h: 7 },
];

/**
 * The base scene's green trees near the castle (render.ts drawWildDecor: [312,78] and [374,84], a 16x20 sprite
 * centred on x with its feet on y). No aura prop or perched crow may overlap these boxes (tests check it, and that
 * render.ts still lists these trees).
 */
export const BASE_TREE_SPOTS: ReadonlyArray<readonly [number, number]> = [
  [312, 78],
  [374, 84],
];
const BASE_TREE_W = 16;
const BASE_TREE_H = 20;
export const BASE_TREE_BOXES = BASE_TREE_SPOTS.map(([x, y]) => ({
  x0: x - BASE_TREE_W / 2,
  x1: x + BASE_TREE_W / 2,
  y0: y - BASE_TREE_H,
  y1: y,
}));

const TREE_DARK = "#150e1b";
const TREE_HI = "#2c2038";
const paintTree = (ctx: Ctx, prop: AuraProp) => {
  const { x, y, h } = prop;
  const flip = x > DUNGEON.x ? 1 : -1;
  rect(ctx, TREE_DARK, x - 1, y - h + 4, 3, h - 4);
  rect(ctx, TREE_HI, x - 1, y - h + 4, 1, h - 4);
  rect(ctx, TREE_DARK, x - 2, y - 2, 5, 2);
  // twisted limbs: a stair of dark pixels climbing outwards, with twigs
  const limb = (startY: number, dir: number, steps: number) => {
    for (let i = 0; i < steps; i++) {
      rect(ctx, TREE_DARK, x + dir * (2 + i * 2) + (dir < 0 ? -1 : 0), startY - i, 2, 2);
      if (i === steps - 1) rect(ctx, TREE_DARK, x + dir * (3 + i * 2), startY - i - 2, 1, 2);
    }
  };
  limb(y - h + 7, -1, 3);
  limb(y - h + 5, 1, 4);
  limb(y - 8, flip, 2);
  rect(ctx, TREE_DARK, x - 2, y - h + 1, 1, 4);
  rect(ctx, TREE_DARK, x + 1, y - h, 1, 3);
};

const STONE = "#4a4658";
const STONE_HI = "#6c6780";
const STONE_OUT = "#17121f";
const paintGrave = (ctx: Ctx, prop: AuraProp) => {
  const { x, y, w, h } = prop;
  const left = x - (w >> 1),
    top = y - h;
  rect(ctx, STONE_OUT, left - 1, top + 2, w + 2, h - 1);
  rect(ctx, STONE_OUT, left + 1, top, w - 2, 1);
  rect(ctx, STONE, left, top + 2, w, h - 2);
  rect(ctx, STONE, left + 1, top + 1, w - 2, 1);
  rect(ctx, STONE_HI, left, top + 2, 1, h - 3);
  rect(ctx, STONE_HI, left + 1, top + 1, w - 3, 1);
  rect(ctx, STONE_OUT, left + 2, top + 4, w - 4, 1);
  rect(ctx, STONE_OUT, left + 3, top + 6, 1, 2);
  rect(ctx, "#2c4a32", left, y - 2, w, 1);
};
const paintCross = (ctx: Ctx, prop: AuraProp) => {
  const { x, y, h } = prop;
  rect(ctx, STONE_OUT, x - 3, y - h + 2, 7, 4);
  rect(ctx, STONE_OUT, x - 2, y - h, 5, h);
  rect(ctx, STONE, x - 1, y - h + 1, 3, h - 1);
  rect(ctx, STONE, x - 2, y - h + 3, 5, 2);
  rect(ctx, STONE_HI, x - 1, y - h + 1, 1, h - 2);
  rect(ctx, STONE_HI, x - 2, y - h + 3, 5, 1);
  rect(ctx, "#2c4a32", x - 2, y - 1, 5, 1);
};
const paintPike = (ctx: Ctx, prop: AuraProp) => {
  const { x, y, h } = prop;
  const pole = "#3a2a22";
  rect(ctx, STONE_OUT, x - 1, y - h + 4, 3, h - 3);
  rect(ctx, pole, x, y - h + 5, 1, h - 4);
  // skull: bone with dark sockets and a jaw
  rect(ctx, STONE_OUT, x - 3, y - h - 1, 7, 7);
  rect(ctx, "#ddd6bf", x - 2, y - h, 5, 4);
  rect(ctx, "#b8b199", x - 2, y - h + 3, 5, 1);
  rect(ctx, "#ddd6bf", x - 1, y - h + 4, 3, 1);
  rect(ctx, "#14101a", x - 2, y - h + 1, 2, 2);
  rect(ctx, "#14101a", x + 1, y - h + 1, 2, 2);
  rect(ctx, "#7a1f2a", x - 1, y - h + 2, 1, 1);
  rect(ctx, "#7a1f2a", x + 1, y - h + 2, 1, 1);
  rect(ctx, "#14101a", x, y - h + 3, 1, 1);
  // pile of stones at the foot
  rect(ctx, STONE_OUT, x - 3, y - 2, 7, 3);
  rect(ctx, STONE, x - 2, y - 2, 5, 2);
};
const BRAMBLE_ART = ["B..B...B.", ".B.BB.B.B", ".BVBBBVB.", "BBRBVBRBB", ".BBVBBBB.", "..B.B.B.."];
const BRAMBLE_COLORS: Record<string, string> = { B: "#2a1c22", V: "#6a4a38", R: "#b02434" };
/** stamp ASCII art (`.` empty) with its left edge at x and its top at y, optionally mirrored */
const stamp = (ctx: Ctx, art: string[], colors: Record<string, string>, x: number, y: number, flip = false) => {
  art.forEach((line, row) => {
    for (let col = 0; col < line.length; col++) {
      const color = colors[line[flip ? line.length - 1 - col : col]];
      if (color) rect(ctx, color, x + col, y + row, 1, 1);
    }
  });
};
const paintBramble = (ctx: Ctx, prop: AuraProp) => {
  stamp(ctx, BRAMBLE_ART, BRAMBLE_COLORS, prop.x - (prop.w >> 1), prop.y - BRAMBLE_ART.length);
};
const PAINTERS: Record<PropKind, (ctx: Ctx, prop: AuraProp) => void> = {
  tree: paintTree,
  pike: paintPike,
  grave: paintGrave,
  cross: paintCross,
  bramble: paintBramble,
};
const PROPS_X0 = 296;
const PROPS_Y0 = 30;
const paintProps = (ctx: Ctx) => {
  for (const prop of GATE_AURA_PROPS) PAINTERS[prop.kind](ctx, prop);
};

// ---- ground mist ------------------------------------------------------------------------------------------------
const MIST_X0 = 296;
const MIST_Y0 = 43;
const MIST_ROWS = 16;
const MIST_COUNT = 16;
const MIST = Array.from({ length: MIST_COUNT }, (_, i) => ({
  x: MIST_X0 + ((i * 29) % 88),
  y: MIST_Y0 + ((i * 7) % MIST_ROWS),
  w: 9 + ((i * 5) % 9),
  speed: 0.18 + (i % 5) * 0.06,
  phase: i * 2.3,
}));

// ---- red eyes in the gate's darkness -----------------------------------------------------------------------------
const EYE_PAIRS = [
  { dx: -3, dy: -17, ph: 0.4, minIntensity: 0 },
  { dx: 3, dy: -11, ph: 2.1, minIntensity: 0.5 },
  { dx: -4, dy: -7, ph: 4.2, minIntensity: 0.85 },
];
const BLINK_PERIOD = 3.6;
const BLINK_LEN = 0.16;

/**
 * Ground layer: call each frame right AFTER the castle gate sprite is drawn and BEFORE any character. Draws the
 * static props (trees, pikes, graves, brambles), the low-alpha mist hugging the castle base and the eyes in the arch.
 */
export const drawGateAuraGround = (ctx: Ctx, time: number, still: boolean, intensity: number) => {
  const heat = clamp01(intensity);
  const now = still ? 0 : time;
  cachedBlit(ctx, "props", PROPS_X0, PROPS_Y0, WORLD_W - PROPS_X0, 50, paintProps);
  // mist wisps
  const alpha = 0.16 + 0.14 * heat;
  const hue = mixHex("#7a58a8", "#a0304a", heat * 0.6);
  for (const wisp of MIST) {
    const dx = Math.sin(now * wisp.speed + wisp.phase) * 6;
    ctx.globalAlpha = alpha;
    rect(ctx, hue, wisp.x + dx, wisp.y, wisp.w, 2);
    ctx.globalAlpha = alpha * 0.7;
    rect(ctx, hue, wisp.x + dx + 3, wisp.y - 1, wisp.w - 6, 1);
  }
  ctx.globalAlpha = 1;
  // eyes
  const glow = mixHex("#b01c26", "#ff4040", heat);
  const halo = mixHex("#3c0a14", "#7a1020", heat);
  for (const pair of EYE_PAIRS) {
    if (heat < pair.minIntensity) continue;
    const closed = !still && (now + pair.ph * 1.7) % BLINK_PERIOD < BLINK_LEN;
    if (closed) continue;
    const ex = DUNGEON.x + pair.dx,
      ey = DUNGEON.y + pair.dy;
    if (heat > 0.4) {
      rect(ctx, halo, ex - 1, ey, 1, 1);
      rect(ctx, halo, ex + 2, ey, 1, 1);
      rect(ctx, halo, ex + 3, ey, 1, 1);
      rect(ctx, halo, ex + 6, ey, 1, 1);
    }
    rect(ctx, glow, ex, ey, 2, 1);
    rect(ctx, glow, ex + 4, ey, 2, 1);
    if (heat > 0.6) {
      rect(ctx, "#ffd0d0", ex, ey, 1, 1);
      rect(ctx, "#ffd0d0", ex + 4, ey, 1, 1);
    }
  }
};

// ---- the top layer: lightning bolt and crows --------------------------------------------------------------------
/**
 * Where the top layer may draw. Characters can stand anywhere south of y 17 inside the boss column (a boss steps out
 * of the gate mouth, 32px tall, drawn x 324..356), so the bolt keeps to two lanes either side of it and circling
 * crows stay in the strip above every boss head.
 */
const CHAR_COLUMN_X0 = 322;
const CHAR_COLUMN_X1 = 360;
/** circling crows never reach below this y (boss heads start at y 17) */
export const GATE_AURA_SAFE_Y = 14;
/** bolt lanes: x ranges (outline included) west and east of the boss column, y limit of the bolt tip */
export const GATE_AURA_BOLT_LANES = [
  { x0: 306, x1: 321 },
  { x0: 361, x1: 380 },
];
const BOLT_TOP = 12;
const BOLT_BOTTOM = 44;
/** perched crows (centre x, feet y): the two broken pillars and the two dead trees; every one is outside the column */
const PERCH = [
  { x: 317, y: 24 },
  { x: 364, y: 34 },
  { x: 308, y: 36 },
  { x: 378, y: 36 },
];
const CROW_BODY = "#0f0b16";

const paintBolt = (ctx: Ctx, flash: Flash) => {
  const lane = GATE_AURA_BOLT_LANES[flash.cycle % GATE_AURA_BOLT_LANES.length];
  const core = "#f6efff",
    edge = "#a98cff";
  const span = lane.x1 - lane.x0 - 4;
  let x = lane.x0 + 2 + ((flash.cycle * 7) % span);
  let y = BOLT_TOP;
  const pick = (i: number) => ((flash.cycle * 31 + i * 17) % 7) - 3;
  for (let i = 0; y < BOLT_BOTTOM; i++) {
    const nextX = Math.min(lane.x0 + 2 + span, Math.max(lane.x0 + 2, x + pick(i)));
    const len = 5 + (i % 3);
    const height = Math.min(len, BOLT_BOTTOM - y);
    const left = Math.min(x, nextX);
    // horizontal kink then the vertical stroke, edge colour first so the core reads on top
    rect(ctx, edge, left - 1, y - 1, Math.abs(nextX - x) + 4, 3);
    rect(ctx, edge, nextX - 1, y, 4, height);
    rect(ctx, core, left, y, Math.abs(nextX - x) + 2, 1);
    rect(ctx, core, nextX, y, 2, height);
    x = nextX;
    y += height;
  }
};

const CROW_COLORS: Record<string, string> = {
  B: CROW_BODY,
  W: "#4a5a7c",
  E: "#e8e8f4",
  K: "#8a7a52",
  L: "#2a2030",
};
/** perched, facing right: head with a 2px beak and a light eye, tail wedge to the left, folded blue-grey wing, legs */
const CROW_PERCHED = ["...BB..", "..BBEKK", ".BBBBB.", "BBWWBB.", "BBWWBB.", ".BBBB..", "..L.L.."];
/** flying, facing right: wings up (a V) and wings down (an inverted V) */
const CROW_FLAP_UP = ["B.....B", "BW...WB", ".BBBBK.", "..BBB.."];
const CROW_FLAP_DOWN = ["..BBBK.", ".BBBBB.", "BW...WB", "B.....B"];

/** `faceRight` mirrors the art; x is the centre and y the feet (perched) or the body (flying) */
const paintCrow = (ctx: Ctx, x: number, y: number, flap: number, perched: boolean, faceRight = true) => {
  const art = perched ? CROW_PERCHED : flap ? CROW_FLAP_UP : CROW_FLAP_DOWN;
  stamp(ctx, art, CROW_COLORS, x - 3, y - (perched ? art.length : flap ? 2 : 1), !faceRight);
};

const CIRCLE_CX = DUNGEON.x;
const CIRCLE_RX = 40;
const CIRCLE_CY = 7;
const CIRCLE_RY = 2.5;
const CROW_MAX = 6;

/**
 * Top layer: call each frame AFTER the characters (bolt and crows are opaque; nothing here ever overlaps a character:
 * see GATE_AURA_SAFE_Y and GATE_AURA_BOLT_LANES). Under `still` there is no bolt and the crows hold fixed spots.
 */
export const drawGateAuraTop = (ctx: Ctx, time: number, still: boolean, intensity: number) => {
  const heat = clamp01(intensity);
  const flash = flashAt(time, still, heat);
  if (flash.on) paintBolt(ctx, flash);
  const perchCount = still ? PERCH.length : PERCH.length - (Math.floor(time / 9) % 2);
  for (let i = 0; i < perchCount; i++) paintCrow(ctx, PERCH[i].x, PERCH[i].y, 0, true, PERCH[i].x < DUNGEON.x);
  const circling = 3 + Math.round(heat * (CROW_MAX - 3));
  for (let i = 0; i < circling; i++) {
    const angle = (still ? 0 : time * (0.45 + 0.05 * heat)) + (i * Math.PI * 2) / circling;
    const x = CIRCLE_CX + Math.cos(angle) * (CIRCLE_RX - (i % 2) * 8);
    const y = CIRCLE_CY + Math.sin(angle) * CIRCLE_RY + (i % 2);
    paintCrow(ctx, x, y, still ? 0 : Math.floor(time * 5 + i) % 2, false, still || Math.sin(angle) <= 0);
  }
};

export const GATE_AURA_CHAR_COLUMN = { x0: CHAR_COLUMN_X0, x1: CHAR_COLUMN_X1 };
export const GATE_AURA_BOLT_Y = { top: BOLT_TOP, bottom: BOLT_BOTTOM };
