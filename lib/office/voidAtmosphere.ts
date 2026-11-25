/**
 * The air of the Void Sanctum once the Veiled One shows its TRUE FORM (phase 2) and beyond: drifting embers and ash,
 * void tendrils rising from the island's edges, lightning in the blood-red sky, falling rubble, an orbiting ring of
 * debris around the boss and a pulsing rune circle under it. Everything is opaque rects driven by deterministic hashes
 * (no arrays, no allocation per frame). The sky pieces belong to the back layer, the rune circle to the floor pass and
 * the debris ring is drawn around the boss in the entity pass, which sits behind every raider: nothing here ever covers
 * a character. Under reduced motion every piece holds one still pose and the lightning stays dark.
 */
import { VIEW_W, VIEW_X0, WORLD_H } from "./layout";
import { noise2 } from "./voidVisualLogic";

type Ctx = CanvasRenderingContext2D;

const rect = (ctx: Ctx, color: string, x: number, y: number, wide: number, high: number) => {
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x), Math.round(y), wide, high);
};
const SQUASH = 0.62;
const TURN = Math.PI * 2;

// ---- the sky: embers, ash, lightning, rubble ------------------------------------------------------------------------------------------
const EMBERS = 52;
const EMBER_COLORS = ["#ff8a2a", "#ffd070", "#d0381c", "#ffb030"];
const ASH = 34;
const ASH_COLORS = ["#6a5a6a", "#4a3a52", "#8a7a86"];
const RUBBLE = 16;
const RUBBLE_COLORS = ["#2e1624", "#4a2536", "#6a3a48", "#1c0c16"];
const BOLT_EVERY_S = 2.4;
const BOLT_LIFE_S = 0.3;
const BOLT_STEPS = 17;
const BOLT_STEP_PX = 6;

const embers = (ctx: Ctx, time: number, still: boolean) => {
  const span = WORLD_H + 24;
  for (let i = 0; i < EMBERS; i++) {
    const speed = 14 + noise2(i, 31) * 26;
    const rise = still ? noise2(i, 32) * span : (time * speed + noise2(i, 32) * span) % span;
    const sway = still ? 0 : Math.sin(time * 1.3 + i * 1.7) * 6;
    const x = VIEW_X0 + noise2(i, 33) * VIEW_W + sway;
    const flicker = !still && Math.floor(time * 7 + i) % 5 === 0;
    rect(
      ctx,
      flicker ? "#ffe9a0" : EMBER_COLORS[i % EMBER_COLORS.length],
      x,
      WORLD_H + 6 - rise,
      i % 5 === 0 ? 2 : 1,
      1 + (i % 3 === 0 ? 1 : 0),
    );
  }
};

const ash = (ctx: Ctx, time: number, still: boolean) => {
  const span = WORLD_H + 12;
  for (let i = 0; i < ASH; i++) {
    const speed = 6 + noise2(i, 41) * 10;
    const fall = still ? noise2(i, 42) * span : (time * speed + noise2(i, 42) * span) % span;
    const drift = still ? 0 : time * (3 + noise2(i, 43) * 4);
    const x = VIEW_X0 + ((noise2(i, 44) * VIEW_W + drift) % VIEW_W);
    rect(ctx, ASH_COLORS[i % ASH_COLORS.length], x, fall - 6, 2, 1);
    if (i % 3 === 0) rect(ctx, ASH_COLORS[0], x + 1, fall - 5, 1, 1);
  }
};

/** a bolt of lightning: a jagged line from the top of the sky with a wide dark-red glow, a white core and forks */
const lightning = (ctx: Ctx, time: number) => {
  const slot = Math.floor(time / BOLT_EVERY_S);
  const age = time - slot * BOLT_EVERY_S;
  if (age > BOLT_LIFE_S || noise2(slot, 51) < 0.25) return;
  let x = VIEW_X0 + 30 + noise2(slot, 52) * (VIEW_W - 60);
  let y = 0;
  const fade = 1 - age / BOLT_LIFE_S;
  for (let step = 0; step < BOLT_STEPS; step++) {
    const lean = (noise2(slot * 31 + step, 53) - 0.5) * 12;
    const nextX = x + lean,
      nextY = y + BOLT_STEP_PX;
    for (let sub = 0; sub < BOLT_STEP_PX; sub++) {
      const px = x + (lean * sub) / BOLT_STEP_PX;
      rect(ctx, "#5a1218", px - 2, y + sub, 5, 1);
      rect(ctx, fade > 0.5 ? "#ffd070" : "#ff8a2a", px - 1, y + sub, 3, 1);
      rect(ctx, "#ffffff", px, y + sub, 1, 1);
    }
    if (step % 5 === 3) {
      const dir = noise2(slot + step, 54) > 0.5 ? 1 : -1;
      for (let fork = 1; fork < 8; fork++) rect(ctx, "#ffd070", nextX + dir * fork * 2, nextY + fork, 2, 1);
    }
    x = nextX;
    y = nextY;
  }
  rect(ctx, "#ffffff", x - 3, y, 7, 2);
};

/** slabs shaken loose from the island's far rim and the dark above, falling past the arena */
const rubble = (ctx: Ctx, time: number, still: boolean) => {
  for (let i = 0; i < RUBBLE; i++) {
    const period = 5 + noise2(i, 61) * 5;
    const tick = still ? noise2(i, 62) : ((time + noise2(i, 62) * period) % period) / period;
    const pull = tick * tick;
    const x = VIEW_X0 + noise2(i, 63) * VIEW_W + (still ? 0 : Math.sin(time + i) * 3);
    const y = -8 + pull * (WORLD_H + 24);
    const size = 2 + Math.floor(noise2(i, 64) * 4);
    rect(ctx, RUBBLE_COLORS[i % RUBBLE_COLORS.length], x, y, size, size);
    rect(ctx, RUBBLE_COLORS[2], x, y, size, 1);
    if (!still && tick < 0.9) rect(ctx, "#ff8a2a", x + (size >> 1), y - 2, 1, 1);
  }
};

// ---- tendrils ------------------------------------------------------------------------------------------------------------------------------
/** [x, baseY, height, lean]: they climb out of the island's far and side rims, curling toward the middle */
const TENDRILS: readonly (readonly [number, number, number, number])[] = [
  [-86, 150, 72, 1],
  [-58, 122, 56, 1],
  [-30, 98, 48, 1],
  [28, 78, 44, 1],
  [96, 70, 40, 1],
  [226, 70, 42, -1],
  [300, 80, 46, -1],
  [346, 100, 52, -1],
  [376, 128, 62, -1],
  [392, 156, 74, -1],
];
const TENDRIL_DARK = ["#0a0518", "#1a0f33", "#2a1648"];
const tendrils = (ctx: Ctx, time: number, still: boolean, warm: boolean) => {
  TENDRILS.forEach(([baseX, baseY, high, lean], index) => {
    for (let row = 0; row < high; row += 2) {
      const climb = row / high;
      const sway = still
        ? Math.sin(index + climb * 3) * 3
        : Math.sin(time * 1.1 + index * 1.9 + climb * 4) * (3 + climb * 8);
      const x = baseX + lean * climb * climb * 26 + sway;
      const wide = Math.max(1, Math.round(5 * (1 - climb) + 1));
      rect(ctx, TENDRIL_DARK[0], x - wide - 1, baseY - row, wide * 2 + 3, 2);
      rect(ctx, TENDRIL_DARK[row % 8 === 0 ? 2 : 1], x - wide, baseY - row, wide * 2 + 1, 2);
      if (row % 10 === 0) rect(ctx, warm ? "#a02030" : "#4a2a90", x, baseY - row, 1, 2);
    }
    const tipX = baseX + lean * 26 + (still ? 0 : Math.sin(time * 1.1 + index * 1.9 + 4) * 11);
    const glow = still || Math.floor(time * 4 + index) % 2 === 0;
    rect(ctx, glow ? "#ff5a6a" : "#a02030", tipX, baseY - high, 2, 2);
  });
};

/**
 * the sky of phase 2 / 3 (call after the baked back layer and the eye, before the floor): `warm` red, else violet-gold.
 * `far` = what hangs behind the colossus (tendrils, rubble, lightning), `near` = what drifts in front of it (ash, embers).
 */
export const drawAtmosphereBack = (
  ctx: Ctx,
  time: number,
  still: boolean,
  warm: boolean,
  part: "all" | "far" | "near",
) => {
  if (part !== "near") {
    tendrils(ctx, time, still, warm);
    rubble(ctx, time, still);
  }
  if (part !== "far") {
    ash(ctx, time, still);
    embers(ctx, time, still);
  }
  if (part !== "near" && !still && warm) lightning(ctx, time);
};

// ---- the orbiting debris and the rune circle -----------------------------------------------------------------------------------------
const DEBRIS = 16;
const DEBRIS_RX = 118;
const DEBRIS_RY = 36;
const STONE = ["#1c0c16", "#4a2536", "#7a4256", "#ffb030"];
/** one half of the debris ring around (cx, cy): `front` = the nearer half (drawn after the boss), else the far half */
export const drawDebrisRing = (ctx: Ctx, cx: number, cy: number, time: number, still: boolean, front: boolean) => {
  const spin = still ? 0.4 : time * 0.42;
  for (let i = 0; i < DEBRIS; i++) {
    const angle = spin + (i / DEBRIS) * TURN;
    const near = Math.sin(angle) > 0;
    if (near !== front) continue;
    const lane = 1 + (i % 3) * 0.14;
    const bob = still ? 0 : Math.sin(time * 1.6 + i * 2.1) * 3;
    const px = cx + Math.cos(angle) * DEBRIS_RX * lane;
    const py = cy + Math.sin(angle) * DEBRIS_RY * lane + bob;
    const size = 4 + (i % 4) * 2;
    rect(ctx, STONE[0], px - size / 2 - 1, py - size / 2 - 1, size + 2, size + 2);
    rect(ctx, STONE[1], px - size / 2, py - size / 2, size, size);
    rect(ctx, STONE[2], px - size / 2, py - size / 2, size - 1, 1);
    rect(ctx, STONE[0], px, py + size / 2 - 2, size / 2, 2);
    if (i % 3 === 0) rect(ctx, STONE[3], px, py, 1, 1);
  }
};

const CIRCLE_COLORS = ["#a03040", "#d08a30", "#ffd070"];
const dotted = (
  ctx: Ctx,
  cx: number,
  cy: number,
  radius: number,
  color: string,
  step: number,
  turn: number,
  thick: number,
) => {
  for (let angle = turn; angle < turn + TURN; angle += step)
    rect(ctx, color, cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius * SQUASH, thick, thick);
};
/** the pulsing rune circle burning under the boss (floor pass: under every character) */
export const drawBossRuneCircle = (ctx: Ctx, cx: number, cy: number, time: number, still: boolean, scale = 1) => {
  const beat = still ? 0.5 : (Math.sin(time * 3) + 1) / 2;
  const grow = 1 + beat * 0.05;
  dotted(ctx, cx, cy, 58 * scale * grow, CIRCLE_COLORS[0], 0.06, still ? 0 : time * 0.3, 2);
  dotted(ctx, cx, cy, 46 * scale * grow, CIRCLE_COLORS[1], 0.09, still ? 0 : -time * 0.5, 1);
  dotted(
    ctx,
    cx,
    cy,
    32 * scale * grow,
    beat > 0.5 ? CIRCLE_COLORS[2] : CIRCLE_COLORS[1],
    0.12,
    still ? 0 : time * 0.8,
    1,
  );
  // a six-point star inside, its tips marked with glyph ticks
  for (let tip = 0; tip < 6; tip++) {
    const angle = (tip / 6) * TURN + (still ? 0 : time * 0.15);
    const next = angle + TURN / 3;
    const ax = cx + Math.cos(angle) * 44 * scale,
      ay = cy + Math.sin(angle) * 44 * scale * SQUASH;
    const bx = cx + Math.cos(next) * 44 * scale,
      by = cy + Math.sin(next) * 44 * scale * SQUASH;
    for (let seg = 0; seg < 14; seg++) {
      const tick = seg / 14;
      rect(ctx, CIRCLE_COLORS[0], ax + (bx - ax) * tick, ay + (by - ay) * tick, 1, 1);
    }
    rect(ctx, CIRCLE_COLORS[2], ax - 1, ay - 1, 3, 3);
  }
  rect(ctx, CIRCLE_COLORS[2], cx - 1, cy - 1, 3, 3);
  if (beat > 0.8) rect(ctx, "#ffffff", cx, cy, 1, 1);
};

// ---- opaque ordered-dither fills (never alpha): the hand's shadow, the sky blot, the dust wall -------------------------------------------
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
const DITHER_MAX = 16;
const ditherPatterns = new Map<string, CanvasPattern | null>();
/** a cached 4x4 Bayer pattern of `color` covering `level` / 16 of the pixels (null when no canvas exists) */
const ditherPattern = (ctx: Ctx, color: string, level: number): CanvasPattern | null => {
  const key = `${color}|${level}`;
  const known = ditherPatterns.get(key);
  if (known !== undefined) return known;
  let pattern: CanvasPattern | null = null;
  if (typeof document !== "undefined") {
    const cv = document.createElement("canvas");
    cv.width = 4;
    cv.height = 4;
    const tile = cv.getContext("2d");
    if (tile) {
      for (let i = 0; i < 16; i++) if (BAYER[i] < level) rect(tile, color, i % 4, Math.floor(i / 4), 1, 1);
      pattern = ctx.createPattern(cv, "repeat");
    }
  }
  ditherPatterns.set(key, pattern);
  return pattern;
};
/** an opaque dither of `color` over a rect: level 0..16 (16 = solid) */
export const drawDitherRect = (
  ctx: Ctx,
  color: string,
  level: number,
  x: number,
  y: number,
  wide: number,
  high: number,
) => {
  const clamped = Math.min(DITHER_MAX, Math.max(0, Math.round(level)));
  if (clamped <= 0 || wide <= 0 || high <= 0) return;
  if (clamped >= DITHER_MAX) return rect(ctx, color, x, y, wide, high);
  const pattern = ditherPattern(ctx, color, clamped);
  if (!pattern) return;
  ctx.fillStyle = pattern;
  ctx.fillRect(Math.round(x), Math.round(y), Math.round(wide), Math.round(high));
};
/** an opaque dithered ellipse, one row at a time (rows are runs: cheap) */
export const drawDitherEllipse = (
  ctx: Ctx,
  color: string,
  level: number,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
) => {
  for (let row = -Math.round(ry); row <= Math.round(ry); row++) {
    const half = Math.round(rx * Math.sqrt(Math.max(0, 1 - (row * row) / (ry * ry + 1))));
    drawDitherRect(ctx, color, level, cx - half, cy + row, half * 2 + 1, 1);
  }
};
