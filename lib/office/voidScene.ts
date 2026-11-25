/**
 * Floor 4: THE VOID SANCTUM. Nothing like B1-B3: a huge broken island of obsidian slabs floating in a starfield, a
 * giant eye rising behind the horizon, chains running up into the dark, violet and cyan crystals, and a rune ring on
 * the floor. Opaque pixel art only; the static back and front are baked once per variant (0 = veiled, 1 = veil torn,
 * 2 = true form: blood-red sky, crumbling edges) and the per-frame pieces are cheap. Same world coordinates as the
 * other floors (x VIEW_X0..VIEW_X0 + VIEW_W, y 0..WORLD_H); raiders ring (160, 130), the boss stands at (262, 120).
 * The front layer keeps to the top band and the far bottom corners, so it never covers an adventurer's body.
 */
import { VIEW_W, VIEW_X0, WORLD_H } from "./layout";
import { drawAtmosphereBack } from "./voidAtmosphere";
import { drawColossusBack, drawColossusChest, type ColossusView } from "./voidColossus";
import { VOID_ARENA_X0, VOID_ARENA_Y0, VOID_HOME_X, VOID_FEET_Y } from "./voidFight";
import { COLOSSUS_EYE_X, COLOSSUS_EYE_Y, GAZE_BODY_DARK_LEVEL, GAZE_DARK_LEVEL, noise2 } from "./voidVisualLogic";

type Ctx = CanvasRenderingContext2D;
/** 0 = the veiled arena (phase 1), 1 = TRUE FORM (phase 2: blood-red sky, burning eye), 2 = the colossus (phase 3: starfield, face, shards) */
export type VoidVariant = 0 | 1 | 2;

const TILE = 30;
const BLOCK = 3;
const ISLAND = { cx: 144, cy: 152, rx: 252, ry: 112 };
const EYE = { x: COLOSSUS_EYE_X, y: COLOSSUS_EYE_Y };
const ARENA_CX = 160;
const ARENA_CY = 130;
const SQUASH = 0.62;
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

const SKY: string[][] = [
  ["#04010a", "#080413", "#0e0820", "#160c30", "#1e1040"],
  ["#0a0103", "#1a0408", "#340910", "#5a1218", "#8a2a1c"],
  ["#0a0103", "#1a0408", "#340910", "#5a1218", "#8a2a1c"],
];
const STAR_COLORS: string[][] = [
  ["#5a4a98", "#9a8ae0", "#cfc8ff"],
  ["#a04a58", "#e8a070", "#ffe0a0"],
  ["#a04a58", "#e8a070", "#ffe0a0"],
];
/** slab tones per variant: base, light bevel, shadow bevel, deep line */
const SLAB: string[][] = [
  ["#2a2150", "#43377a", "#1c1538", "#120c26"],
  ["#2e1624", "#4a2536", "#1c0c16", "#10060c"],
  ["#2e1624", "#4a2536", "#1c0c16", "#10060c"],
];
const SLAB_ALT: string[] = ["#322762", "#2e1a2c", "#2e1a2c"];
const RUNE_A: string[] = ["#2a8a9a", "#a03040", "#a03040"];
const RUNE_B: string[] = ["#6a48c8", "#d08a30", "#d08a30"];
const GLYPH: string[] = ["#c8a040", "#ffd070", "#ffd070"];
const ROCK = ["#150f2a", "#231a40", "#34285c"];
const CHAIN = ["#3a3a5a", "#1c1c34", "#6a6a9a"];

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
const layerOf = (build: (ctx: Ctx) => void): HTMLCanvasElement | null => {
  const made = canvasOf(VIEW_W, WORLD_H);
  if (!made) return null;
  made.c.translate(-VIEW_X0, 0);
  build(made.c);
  return made.cv;
};

const insideIsland = (x: number, y: number, bite: number): boolean => {
  const nx = (x - ISLAND.cx) / ISLAND.rx,
    ny = (y - ISLAND.cy) / ISLAND.ry;
  return nx * nx + ny * ny <= 1 - bite;
};

// ---- the sky --------------------------------------------------------------------------------------------------------------
const skyAndStars = (ctx: Ctx, variant: VoidVariant) => {
  const bands = SKY[variant];
  const bandH = Math.ceil(WORLD_H / bands.length);
  const dither = 6;
  bands.forEach((color, band) => rect(ctx, color, VIEW_X0, band * bandH, VIEW_W, bandH));
  for (let band = 1; band < bands.length; band++)
    for (let y = band * bandH - dither; y < band * bandH; y++)
      for (let x = VIEW_X0; x < VIEW_X0 + VIEW_W; x++)
        if (BAYER[(y & 3) * 4 + (x & 3)] < (y - (band * bandH - dither) + 1) * 2.4) rect(ctx, bands[band], x, y, 1, 1);
  const colors = STAR_COLORS[variant];
  for (let i = 0; i < 170; i++) {
    const x = VIEW_X0 + Math.floor(noise2(i, 1) * VIEW_W),
      y = Math.floor(noise2(i, 2) * WORLD_H * 0.7);
    rect(ctx, colors[i % 3 === 0 ? 2 : i % 3 === 1 ? 1 : 0], x, y, 1, 1);
    if (i % 17 === 0) {
      rect(ctx, colors[0], x - 1, y, 3, 1);
      rect(ctx, colors[0], x, y - 1, 1, 3);
    }
  }
};

// ---- the giant eye ------------------------------------------------------------------------------------------------------
const EYE_W = 190;
const EYE_H = 104;
const IRIS = 46;
const eyeCache = new Map<string, HTMLCanvasElement | null>();
const EYE_TONES: string[][] = [
  ["#0b061c", "#1a1236", "#2a1e56", "#3c2c78"],
  ["#1a0408", "#3a0a12", "#5a1420", "#7a2030"],
  ["#1a0408", "#3a0a12", "#5a1420", "#7a2030"],
];
const IRIS_TONES: string[][] = [
  ["#0d5a58", "#1d9a8c", "#5ff5d8", "#d8fff4"],
  ["#7a1010", "#d0381c", "#ffb030", "#fff0a0"],
  ["#7a1010", "#d0381c", "#ffb030", "#fff0a0"],
];
const bakeEye = (variant: VoidVariant): { sclera: HTMLCanvasElement | null; iris: HTMLCanvasElement | null } => {
  const key = `${variant}`;
  const sclera = eyeCache.get(`s${key}`) ?? bakeSclera(variant);
  const iris = eyeCache.get(`i${key}`) ?? bakeIris(variant);
  return { sclera, iris };
};
const bakeSclera = (variant: VoidVariant): HTMLCanvasElement | null => {
  const made = canvasOf(EYE_W, EYE_H);
  eyeCache.set(`s${variant}`, made?.cv ?? null);
  if (!made) return null;
  const tones = EYE_TONES[variant];
  const half = EYE_W / 2,
    mid = EYE_H / 2;
  for (let x = 0; x < EYE_W; x++) {
    const nx = (x - half) / half;
    const reach = Math.pow(Math.max(0, 1 - nx * nx), 0.75) * (mid - 3);
    for (let y = Math.ceil(mid - reach); y <= Math.floor(mid + reach); y++) {
      const ny = Math.abs(y - mid) / Math.max(1, reach);
      const shade = ny > 0.82 ? 0 : ny > 0.55 ? 1 : ny > 0.25 ? 2 : 3;
      rect(
        made.c,
        tones[(shade + (noise2(x >> 2, y >> 2) > 0.8 ? 1 : 0)) % 4 === 0 && ny < 0.5 ? 3 : shade],
        x,
        y,
        1,
        1,
      );
    }
    // heavy lids with lashes of thorn
    const lid = Math.ceil(mid - reach);
    rect(made.c, "#05020b", x, lid - 2, 1, 3);
    rect(made.c, "#05020b", x, Math.floor(mid + reach) - 1, 1, 3);
    if (x % 9 === 0) {
      rect(made.c, "#05020b", x, lid - 5, 1, 4);
      rect(made.c, "#05020b", x, Math.floor(mid + reach) + 1, 1, 4);
    }
  }
  // blood-fine veins
  for (let vein = 0; vein < 7; vein++) {
    let vx = vein < 4 ? 14 + vein * 6 : EYE_W - 14 - (vein - 4) * 6,
      vy = mid + (vein % 2 ? 10 : -10);
    for (let step = 0; step < 14; step++) {
      vx += vein < 4 ? 3 : -3;
      vy += (noise2(vein, step) - 0.5) * 4 + (mid - vy) * 0.08;
      rect(made.c, variant >= 1 ? "#8a2a2a" : "#4a3a90", vx, vy, 1, 1);
    }
  }
  return made.cv;
};
const bakeIris = (variant: VoidVariant): HTMLCanvasElement | null => {
  const made = canvasOf(IRIS, IRIS);
  eyeCache.set(`i${variant}`, made?.cv ?? null);
  if (!made) return null;
  const tones = IRIS_TONES[variant];
  const mid = IRIS / 2 - 0.5;
  for (let y = 0; y < IRIS; y++)
    for (let x = 0; x < IRIS; x++) {
      const dist = Math.hypot(x - mid, y - mid);
      if (dist > IRIS / 2 - 0.5) continue;
      const ring = dist > 20 ? 0 : dist > 15 ? 1 : dist > 9 ? 2 : 3;
      const spoke = Math.floor((Math.atan2(y - mid, x - mid) / Math.PI) * 9) % 2 === 0;
      rect(made.c, tones[Math.max(0, Math.min(3, spoke && ring > 0 ? ring - 1 : ring))], x, y, 1, 1);
    }
  rect(made.c, "#04010a", mid - 3, 4, 7, IRIS - 8);
  rect(made.c, "#04010a", mid - 4, 12, 9, IRIS - 24);
  rect(made.c, tones[3], mid - 5, 11, 2, 2);
  return made.cv;
};

const drawEye = (
  ctx: Ctx,
  time: number,
  still: boolean,
  variant: VoidVariant,
  eyeX: number,
  eyeY: number,
  scale: number,
) => {
  const { sclera, iris } = bakeEye(variant);
  if (!sclera || !iris) return;
  const wide = Math.max(2, Math.round(EYE_W * scale)),
    high = Math.max(2, Math.round(EYE_H * scale));
  ctx.drawImage(sclera, Math.round(eyeX - wide / 2), Math.round(eyeY - high / 2), wide, high);
  const ox = still ? 0 : Math.round(Math.sin(time * 0.25) * 24 * scale),
    oy = still ? 0 : Math.round(Math.cos(time * 0.19) * 6 * scale);
  const irisPx = Math.max(2, Math.round(IRIS * scale));
  ctx.drawImage(iris, Math.round(eyeX - irisPx / 2 + ox), Math.round(eyeY - irisPx / 2 + oy), irisPx, irisPx);
  // the slowly turning rune ring around the iris
  const turn = still ? 0 : time * 0.35;
  for (let tick = 0; tick < 14; tick++) {
    const angle = turn + (tick / 14) * Math.PI * 2;
    rect(
      ctx,
      variant >= 1 ? "#ffb030" : "#5ff5d8",
      eyeX + ox + Math.cos(angle) * 30 * scale,
      eyeY + oy + Math.sin(angle) * 30 * 0.8 * scale,
      tick % 3 === 0 ? 2 : 1,
      tick % 3 === 0 ? 2 : 1,
    );
  }
};

// ---- chains, islands, crystals ------------------------------------------------------------------------------------------
const chain = (ctx: Ctx, x: number, y0: number, y1: number, seed: number) => {
  for (let y = y0; y < y1; y += 3) {
    const link = Math.floor((y - y0) / 3) % 2;
    const sway = Math.round(Math.sin(y * 0.08 + seed) * 1.4);
    rect(ctx, CHAIN[1], x + sway - 1, y, 4, 3);
    rect(ctx, link ? CHAIN[0] : CHAIN[2], x + sway, y, 2, 3);
    if (link) rect(ctx, CHAIN[1], x + sway, y + 1, 2, 1);
  }
};

const crystal = (ctx: Ctx, x: number, y: number, high: number, cyan: boolean, variant: VoidVariant) => {
  const warm = variant >= 1;
  const body = warm ? "#c8402a" : cyan ? "#2ab8b0" : "#8a5ae0";
  const hi = warm ? "#ffd070" : cyan ? "#d8fff4" : "#d8c4ff";
  const sh = warm ? "#6a1a18" : cyan ? "#0f6a68" : "#4a2a90";
  const half = Math.max(2, Math.round(high / 4));
  for (let row = 0; row < high; row++) {
    const width = row < high * 0.3 ? Math.max(1, Math.round((row / (high * 0.3)) * half)) : half;
    rect(ctx, "#0a0618", x - width - 1, y - row, width * 2 + 3, 1);
    rect(ctx, sh, x - width, y - row, width * 2 + 1, 1);
    rect(ctx, body, x - width, y - row, Math.max(1, width), 1);
    if (width > 1) rect(ctx, hi, x - width, y - row, 1, 1);
  }
  rect(ctx, hi, x, y - high, 1, 1);
};

interface Chunk {
  x: number;
  y: number;
  wide: number;
  high: number;
  par: number;
}
const CHUNKS: Chunk[] = [
  { x: -86, y: 62, wide: 46, high: 26, par: 1 },
  { x: -46, y: 20, wide: 30, high: 18, par: 1.6 },
  { x: 330, y: 52, wide: 44, high: 24, par: 1.2 },
  { x: 372, y: 22, wide: 26, high: 14, par: 1.8 },
  { x: -70, y: 206, wide: 34, high: 16, par: 0.8 },
  { x: 340, y: 200, wide: 40, high: 16, par: 1 },
];
const chunkCache = new Map<string, HTMLCanvasElement | null>();
const bakeChunk = (index: number, variant: VoidVariant): HTMLCanvasElement | null => {
  const key = `${index}|${variant}`;
  const known = chunkCache.get(key);
  if (known !== undefined) return known;
  const spec = CHUNKS[index];
  const made = canvasOf(spec.wide + 4, spec.high + 14);
  chunkCache.set(key, made?.cv ?? null);
  if (!made) return null;
  const slab = SLAB[variant];
  const half = spec.wide / 2;
  for (let x = 0; x < spec.wide; x++) {
    const nx = (x - half + 0.5) / half;
    const top = Math.round(3 + Math.abs(nx) * 3);
    const bottom = Math.round(spec.high * (1 - Math.abs(nx) * 0.75) * (0.7 + noise2(x, index) * 0.5));
    rect(made.c, slab[0], x + 2, top, 1, Math.max(2, 4 - top + 2));
    rect(made.c, slab[1], x + 2, top, 1, 1);
    for (let y = top + 3; y < top + 3 + bottom; y++)
      rect(made.c, ROCK[y % 5 === 0 ? 2 : (x + y) % 3 === 0 ? 1 : 0], x + 2, y, 1, 1);
    rect(made.c, "#05020b", x + 2, top + 3 + bottom, 1, 1);
  }
  crystal(made.c, Math.round(spec.wide * 0.35), 5, 11, index % 2 === 0, variant);
  crystal(made.c, Math.round(spec.wide * 0.62), 6, 7, index % 2 === 1, variant);
  return made.cv;
};

// ---- the island ---------------------------------------------------------------------------------------------------------
const slabColor = (tx: number, ty: number, lx: number, ly: number, variant: VoidVariant): string => {
  const slab = SLAB[variant];
  if (ly < BLOCK) return slab[1];
  if (lx < BLOCK) return slab[1];
  if (ly >= TILE - BLOCK) return slab[3];
  if (lx >= TILE - BLOCK) return slab[2];
  const speck = noise2(tx * 7 + (lx >> 2), ty * 5 + (ly >> 2));
  if (speck > 0.93) return slab[2];
  return (tx + ty) % 2 === 0 ? slab[0] : SLAB_ALT[variant];
};

const island = (ctx: Ctx, variant: VoidVariant) => {
  const x0 = VOID_ARENA_X0 + Math.floor((VIEW_X0 - VOID_ARENA_X0) / TILE) * TILE;
  const y0 = VOID_ARENA_Y0 + Math.floor(-VOID_ARENA_Y0 / TILE) * TILE;
  for (let ty = 0; y0 + ty * TILE < WORLD_H; ty++) {
    for (let tx = 0; x0 + tx * TILE < VIEW_X0 + VIEW_W; tx++) {
      const gx = x0 + tx * TILE,
        gy = y0 + ty * TILE;
      const tileCol = Math.round((gx - VOID_ARENA_X0) / TILE),
        tileRow = Math.round((gy - VOID_ARENA_Y0) / TILE);
      const inArena = tileCol >= 0 && tileCol < 6 && tileRow >= 0 && tileRow < 4;
      const edge = Math.hypot((gx + TILE / 2 - ISLAND.cx) / ISLAND.rx, (gy + TILE / 2 - ISLAND.cy) / ISLAND.ry);
      const lost = !inArena && edge > 0.78 && noise2(tileCol + 40, tileRow + 40) < (variant === 0 ? 0.32 : 0.62);
      if (lost) continue;
      for (let ly = 0; ly < TILE; ly += BLOCK)
        for (let lx = 0; lx < TILE; lx += BLOCK) {
          const bx = gx + lx,
            by = gy + ly;
          const bite = noise2(bx >> 2, by >> 2) * (variant === 0 ? 0.07 : 0.14);
          if (!insideIsland(bx + 1, by + 1, bite)) continue;
          rect(ctx, slabColor(tileCol, tileRow, lx, ly, variant), bx, by, BLOCK, BLOCK);
        }
    }
  }
  // the underside: ragged rock hanging below the rim
  for (let x = VIEW_X0; x < VIEW_X0 + VIEW_W; x++) {
    const nx = (x - ISLAND.cx) / ISLAND.rx;
    if (Math.abs(nx) >= 1) continue;
    const bottom = ISLAND.cy + ISLAND.ry * Math.sqrt(1 - nx * nx);
    if (bottom > WORLD_H) continue;
    const drop = 6 + noise2(x >> 1, 9) * 16 * (variant === 0 ? 1 : 1.5);
    for (let y = Math.floor(bottom); y < bottom + drop; y++)
      rect(ctx, ROCK[(y - Math.floor(bottom)) % 4 === 0 ? 1 : 0], x, y, 1, 1);
  }
};

const ellipsePoints = (
  ctx: Ctx,
  cx: number,
  cy: number,
  rx: number,
  color: string,
  gapEvery: number,
  variant: VoidVariant,
  seed: number,
) => {
  const steps = Math.round(rx * 5);
  for (let i = 0; i < steps; i++) {
    const angle = (i / steps) * Math.PI * 2;
    if (variant >= 1 && noise2(seed, i >> 3) < 0.4) continue;
    if (i % gapEvery < gapEvery - 2)
      rect(ctx, color, cx + Math.cos(angle) * rx, cy + Math.sin(angle) * rx * SQUASH, 1, 1);
  }
};

const runes = (ctx: Ctx, variant: VoidVariant) => {
  // the rune ring of the arena, a smaller seal under the boss, glyphs between
  for (const [rx, color, gap] of [
    [74, RUNE_A[variant], 12],
    [86, RUNE_B[variant], 9],
    [58, RUNE_B[variant], 7],
  ] as const) {
    ellipsePoints(ctx, ARENA_CX, ARENA_CY, rx, color, gap, variant, rx);
    ellipsePoints(ctx, ARENA_CX, ARENA_CY + 1, rx, SLAB[variant][3], gap, variant, rx);
  }
  for (let i = 0; i < 12; i++) {
    const angle = (i / 12) * Math.PI * 2 + 0.26;
    const gx = ARENA_CX + Math.cos(angle) * 80,
      gy = ARENA_CY + Math.sin(angle) * 80 * SQUASH;
    if (variant >= 1 && i % 3 === 0) continue;
    rect(ctx, SLAB[variant][3], gx - 3, gy - 2, 7, 5);
    rect(ctx, GLYPH[variant], gx - 1, gy - 2, 3, 1);
    rect(ctx, GLYPH[variant], gx, gy - 2, 1, 5);
    if (i % 2) rect(ctx, GLYPH[variant], gx - 2, gy, 5, 1);
  }
  ellipsePoints(ctx, VOID_HOME_X, VOID_FEET_Y + 2, 38, RUNE_B[variant], 6, variant, 77);
  ellipsePoints(ctx, VOID_HOME_X, VOID_FEET_Y + 2, 28, GLYPH[variant], 10, variant, 78);
  // the eye sigil at the centre of the arena
  rect(ctx, SLAB[variant][3], ARENA_CX - 9, ARENA_CY - 4, 19, 9);
  rect(ctx, RUNE_A[variant], ARENA_CX - 8, ARENA_CY, 17, 1);
  rect(ctx, RUNE_A[variant], ARENA_CX - 5, ARENA_CY - 2, 11, 1);
  rect(ctx, RUNE_A[variant], ARENA_CX - 5, ARENA_CY + 2, 11, 1);
  rect(ctx, GLYPH[variant], ARENA_CX - 1, ARENA_CY - 1, 3, 3);
};

/** the baked floor of a variant: the island, its runes and (veiled / true form) the crystals along the far rim */
const buildVoidFloor = (ctx: Ctx, variant: VoidVariant) => {
  island(ctx, variant);
  runes(ctx, variant);
  for (let i = 0; i < 9; i++) {
    const x = -70 + i * 50 + Math.round(noise2(i, 5) * 20);
    const edge = ISLAND.cy - ISLAND.ry * Math.sqrt(Math.max(0, 1 - ((x - ISLAND.cx) / ISLAND.rx) ** 2));
    crystal(ctx, x, Math.round(edge) + 8, 10 + Math.round(noise2(i, 6) * 12), i % 2 === 0, variant);
  }
};

/** the baked back layer of a variant (draw once per frame at VIEW_X0, 0); the colossus's is just the sky: its face and floor shards are drawn live */
export const buildVoidBack = (ctx: Ctx, variant: VoidVariant) => {
  skyAndStars(ctx, variant);
  // chains rising from behind the island into the dark
  for (const [x, seed] of [
    [-60, 1],
    [10, 2],
    [96, 3],
    [232, 4],
    [318, 5],
    [372, 6],
  ] as const) {
    const edge = ISLAND.cy - ISLAND.ry * Math.sqrt(Math.max(0, 1 - ((x - ISLAND.cx) / ISLAND.rx) ** 2));
    chain(ctx, x, 0, Math.round(edge) + 6, seed);
  }
  if (variant < 2) buildVoidFloor(ctx, variant);
};

/** the baked front layer: the top band and the far bottom corners only */
export const buildVoidFront = (ctx: Ctx, variant: VoidVariant) => {
  // dark dithered rim along the top (no raider's head reaches it)
  for (let y = 0; y < 12; y++)
    for (let x = VIEW_X0; x < VIEW_X0 + VIEW_W; x++)
      if (BAYER[(y & 3) * 4 + (x & 3)] < (12 - y) * 1.4) rect(ctx, "#05020b", x, y, 1, 1);
  for (const [x, len] of [
    [-84, 22],
    [-30, 14],
    [44, 26],
    [120, 18],
    [286, 24],
    [350, 16],
    [378, 28],
  ] as const)
    chain(ctx, x, 0, len, x);
  // black thorns climbing the bottom corners, with a few crystals in them
  for (const side of [-1, 1]) {
    const x0 = side < 0 ? VIEW_X0 : VIEW_X0 + VIEW_W;
    for (let i = 0; i < 6; i++) {
      const height = 10 + Math.round(noise2(i, side + 3) * 16);
      const x = x0 + side * -(6 + i * 9);
      for (let row = 0; row < height; row++) {
        const wide = Math.max(1, 4 - Math.floor(row / 4));
        rect(ctx, row % 5 === 0 ? "#34285c" : "#0e0820", x - wide, WORLD_H - row, wide * 2 + 1, 1);
      }
    }
    crystal(ctx, x0 + side * -30, WORLD_H - 4, 18, side < 0, variant);
    crystal(ctx, x0 + side * -42, WORLD_H - 2, 11, side > 0, variant);
  }
};

// ---- per-frame drawing --------------------------------------------------------------------------------------------------
const backs: (HTMLCanvasElement | null | undefined)[] = [];
const fronts: (HTMLCanvasElement | null | undefined)[] = [];

const patterns = new Map<string, CanvasPattern | null>();
/** an opaque Bayer-dither veil of `color` at level 0..16 over the rect (never alpha): used for the eclipse */
export const drawDitherVeil = (
  ctx: Ctx,
  color: string,
  level: number,
  x: number,
  y: number,
  wide: number,
  high: number,
) => {
  const clamped = Math.min(16, Math.max(0, Math.round(level)));
  if (clamped <= 0) return;
  if (clamped >= 16) return rect(ctx, color, x, y, wide, high);
  const key = `${color}|${clamped}`;
  let pattern = patterns.get(key);
  if (pattern === undefined) {
    const made = typeof document === "undefined" ? null : canvasOf(4, 4);
    if (made) {
      for (let i = 0; i < 16; i++) if (BAYER[i] < clamped) rect(made.c, color, i % 4, Math.floor(i / 4), 1, 1);
    }
    pattern = made ? made.c.createPattern(made.cv, "repeat") : null;
    patterns.set(key, pattern);
  }
  if (!pattern) return;
  ctx.fillStyle = pattern;
  ctx.fillRect(x, y, wide, high);
};

/** crack polylines radiating from the boss's seal across the floor (phase 2 glows, phase 3 burns) */
const CRACKS = 12;
const CRACK_LEN = 26;
const CRACK_XS = new Int16Array(CRACKS * CRACK_LEN);
const CRACK_YS = new Int16Array(CRACKS * CRACK_LEN);
for (let crack = 0; crack < CRACKS; crack++) {
  const heading = (crack / CRACKS) * Math.PI * 2 + noise2(crack, 3) * 0.5;
  let px = crack % 3 === 0 ? ARENA_CX : VOID_HOME_X,
    py = (crack % 3 === 0 ? ARENA_CY : VOID_FEET_Y) + 2;
  for (let i = 0; i < CRACK_LEN; i++) {
    const wander = (noise2(crack * 13, i) - 0.5) * 1.3;
    px += Math.cos(heading + wander) * 4.2;
    py += Math.sin(heading + wander) * 4.2 * SQUASH;
    CRACK_XS[crack * CRACK_LEN + i] = Math.round(px);
    CRACK_YS[crack * CRACK_LEN + i] = Math.round(py);
  }
}
const CRACK_COLORS: string[][] = [
  ["#1d9a8c", "#d8fff4"],
  ["#d0381c", "#ffd070"],
  ["#d0381c", "#ffd070"],
];

export interface VoidBackView {
  variant: VoidVariant;
  /** 0..1: how far the floor cracks have spread (phase 2/3 grow them) */
  crack: number;
  /** 0..1: the eclipse darkening of the background (the back layers only) */
  eclipse: number;
  /** the colossus's face, eye, shards and death (phase 3) */
  colossus: ColossusView;
  /** 0..1: the gaze darkens the back layers to near black (never the characters or the front); the chest eye glows on top */
  gazeDark: number;
}

const floors: (HTMLCanvasElement | null | undefined)[] = [];
const floorOf = (variant: VoidVariant): HTMLCanvasElement | null => {
  if (floors[variant] === undefined) floors[variant] = layerOf((target) => buildVoidFloor(target, variant));
  return floors[variant] ?? null;
};

/** floor 4 behind everything: sky, eye, the colossus, floating chunks, the island or its shards, cracks, the air, the eclipse */
export const drawVoidBack = (ctx: Ctx, time: number, still: boolean, view: VoidBackView) => {
  const { variant } = view;
  if (backs[variant] === undefined) backs[variant] = layerOf((target) => buildVoidBack(target, variant));
  const cached = backs[variant];
  if (cached) ctx.drawImage(cached, VIEW_X0, 0);
  else buildVoidBack(ctx, variant);
  if (variant === 2) {
    twinkle(ctx, time, still, variant);
    drawAtmosphereBack(ctx, time, still, true, "far");
    if (view.colossus.eyeFly < 1)
      drawEye(ctx, time, still, 1, view.colossus.eyeX, view.colossus.eyeY, view.colossus.eyeScale);
    // the gaze: the sky and the far air go near-black BEFORE the body is drawn, so the body always stays on screen
    if (view.gazeDark > 0) drawDitherVeil(ctx, "#05020b", view.gazeDark * GAZE_DARK_LEVEL, VIEW_X0, 0, VIEW_W, WORLD_H);
    // the shards are cut from the phase 2 island, so the floor is whole when the ascend begins
    drawColossusBack(ctx, view.colossus, time, still, floorOf(1), view.gazeDark <= 0);
    drawChunks(ctx, time, still, 1);
    drawAtmosphereBack(ctx, time, still, true, "near");
    if (view.gazeDark > 0) {
      // only a light veil over the body (a darkened, rim-lit silhouette); the chest eye glows on top of it
      drawDitherVeil(ctx, "#05020b", view.gazeDark * GAZE_BODY_DARK_LEVEL, VIEW_X0, 0, VIEW_W, WORLD_H);
      drawColossusChest(ctx, view.colossus, time, still);
    }
  } else {
    drawEye(ctx, time, still, variant, EYE.x, EYE.y, 1);
    twinkle(ctx, time, still, variant);
    drawChunks(ctx, time, still, variant);
    if (view.crack > 0) drawFloorCracks(ctx, time, still, variant, view.crack);
    if (variant === 1) drawAtmosphereBack(ctx, time, still, true, "all");
  }
  if (view.eclipse > 0) drawDitherVeil(ctx, "#05020b", view.eclipse * 14, VIEW_X0, 0, VIEW_W, WORLD_H);
};

const twinkle = (ctx: Ctx, time: number, still: boolean, variant: VoidVariant) => {
  if (still) return;
  for (let i = 0; i < 34; i++) {
    const speed = i % 2 ? 2.2 : 0.9;
    const x = VIEW_X0 + ((noise2(i, 11) * VIEW_W + time * speed) % VIEW_W);
    if (Math.floor(time * 2 + i) % 3 === 0) rect(ctx, STAR_COLORS[variant][2], x, 4 + noise2(i, 12) * 40, 1, 1);
  }
};
const drawChunks = (ctx: Ctx, time: number, still: boolean, variant: VoidVariant) => {
  CHUNKS.forEach((chunk, index) => {
    const sprite = bakeChunk(index, variant);
    if (!sprite) return;
    const bob = still ? 0 : Math.round(Math.sin(time * 0.7 * chunk.par + index) * 3);
    const drift = still ? 0 : Math.round(Math.sin(time * 0.2 * chunk.par + index * 2) * 4);
    const crumble = variant >= 1 && !still ? Math.round(((time * 3 + index) % 8) * 0.4) : 0;
    ctx.drawImage(sprite, chunk.x + drift, chunk.y + bob + crumble);
  });
};
const drawFloorCracks = (ctx: Ctx, time: number, still: boolean, variant: VoidVariant, grow: number) => {
  const shown = Math.floor(CRACK_LEN * Math.min(1, grow));
  const colors = CRACK_COLORS[variant];
  const flick = still ? 0 : Math.floor(time * 6);
  for (let crack = 0; crack < CRACKS; crack++)
    for (let i = 0; i < shown; i++) {
      const at = crack * CRACK_LEN + i;
      rect(ctx, (i + flick + crack) % 4 === 0 ? colors[1] : colors[0], CRACK_XS[at], CRACK_YS[at], 1, 1);
      if (i % 6 === 0) rect(ctx, colors[0], CRACK_XS[at] + 1, CRACK_YS[at], 2, 1);
    }
};

/** the front of floor 4 (top band and far corners): after every character */
export const drawVoidFront = (ctx: Ctx, variant: VoidVariant) => {
  if (fronts[variant] === undefined) fronts[variant] = layerOf((target) => buildVoidFront(target, variant));
  const cached = fronts[variant];
  if (cached) ctx.drawImage(cached, VIEW_X0, 0);
  else buildVoidFront(ctx, variant);
};

/** the scene variant of a phase (phase 3 and the death are the colossus's) */
export const voidVariantOf = (phase: string): VoidVariant =>
  phase === "phase3" || phase === "dying" ? 2 : phase === "phase2" ? 1 : 0;
