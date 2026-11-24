// Tier presence drawing: what level 5 / 10 / 15 / 20 look like from across the field. Render-only (the sprites keep their
// 16x24 box and feet anchor). Every layer here is drawn in a PRE-PASS before the depth-sorted entities, so the back
// pieces, ground marks, pillar, ring, trail and the orbiting sparkles are always behind every character (a neighbour at
// the feast table, a squire, the stacked raiders never get covered). Opaque #rrggbb only, dither instead of alpha, and
// every moving part has a static form for reduced motion. The rules (which tier wears what) live in tierAuraLogic.ts.
// Nothing here allocates per frame: pixel lists are built once, `plot` reads module state.

import type { GearTier } from "./gearTier";
import { CH_H, CH_W } from "./layout";
import type { AdvClass } from "./palette";
import type { Pose } from "./sprites";
import { capeFrame, overlayFor, showsBigWeapon, wingFrame, type TierUpPhase } from "./tierAuraLogic";

type Ctx = CanvasRenderingContext2D;

const GOLD = "#f2c14e";
const GOLD_DK = "#c9972e";
const WHITE = "#ffffff";
const CREAM = "#fff6d8";
const CREST_INK = "#1a1c2c";

// ---------------------------------------------------------------- drawing state (set once per call, read by plot)
let sCtx: Ctx;
let sPx = 0;
let sPy = 0;
let sFacing = 1;

const fill = (color: string, x: number, y: number, width = 1, height = 1) => {
  sCtx.fillStyle = color;
  sCtx.fillRect(Math.round(x), Math.round(y), width, height);
};
/** a rect given in sprite-local coords, mirrored with the facing */
const plot = (lx: number, ly: number, width: number, height: number, color: string) => {
  const sx = sFacing >= 0 ? sPx + lx : sPx + CH_W - lx - width;
  fill(color, sx, sPy + ly, width, height);
};
const begin = (ctx: Ctx, px: number, py: number, facing: number) => {
  sCtx = ctx;
  sPx = px;
  sPy = py;
  sFacing = facing;
};

interface Pix {
  lx: number;
  ly: number;
  color: string;
}

// ---------------------------------------------------------------- crest
const CREST_ART: Record<number, { rows: string[]; colors: Record<string, string> }> = {
  1: { rows: ["a...a", ".a.a.", "..a.."], colors: { a: "#c98a4b" } },
  2: { rows: ["a...a", "aa.aa", ".aaa.", "..a.."], colors: { a: "#d4dbe6" } },
  3: { rows: ["..a..", ".aaa.", "aaaaa", ".aaa.", ".a.a."], colors: { a: "#f2c14e" } },
  4: { rows: ["..a..", ".awa.", "aawaa", ".awa.", ".a.a."], colors: { a: "#a56bff", w: "#ffffff" } },
};
/** each crest as a flat pixel list (outline first), built once */
const CREST_PIX: Record<number, Pix[]> = {};
for (const [key, art] of Object.entries(CREST_ART)) {
  const solid = (col: number, row: number): boolean => art.rows[row]?.[col] !== undefined && art.rows[row][col] !== ".";
  const pixels: Pix[] = [];
  for (let row = -1; row <= art.rows.length; row++)
    for (let col = -1; col <= 5; col++) {
      if (solid(col, row)) continue;
      if (solid(col - 1, row) || solid(col + 1, row) || solid(col, row - 1) || solid(col, row + 1))
        pixels.push({ lx: col, ly: row, color: CREST_INK });
    }
  art.rows.forEach((line, row) =>
    [...line].forEach((cell, col) => {
      if (cell !== ".") pixels.push({ lx: col, ly: row, color: art.colors[cell] });
    }),
  );
  CREST_PIX[Number(key)] = pixels;
}

/** the small rank crest (bronze / silver / gold chevron or star, violet star for legends) with a dark outline */
export const drawCrest = (ctx: Ctx, tier: GearTier, left: number, top: number) => {
  const pixels = CREST_PIX[tier];
  if (!pixels) return;
  begin(ctx, left, top, 1);
  for (let i = 0; i < pixels.length; i++) fill(pixels[i].color, left + pixels[i].lx, top + pixels[i].ly);
};

// ---------------------------------------------------------------- pads and the bigger weapon
const PAD_STEEL = "#aeb8c8";
const PAD_STEEL_HI = "#e4eaf4";
const drawPads = (tier: GearTier) => {
  const metal = tier >= 3 ? GOLD : PAD_STEEL;
  const shine = tier >= 4 ? WHITE : tier >= 3 ? CREAM : PAD_STEEL_HI;
  plot(-1, 8, 1, 3, metal);
  plot(-1, 8, 1, 1, shine);
  plot(CH_W, 8, 1, 3, metal);
  plot(CH_W, 8, 1, 1, shine);
};

const BLADE = "#c8d0dc";
const BLADE_HI = "#f4f8ff";
const BLADE_GOLD = "#e8d8a0";
const WOOD = "#8a5a30";
const WOOD_DK = "#5c3d28";
const VIOLET = "#a56bff";
const WOOD_TIP = "#c99a5a";
/** per tier: [edge, core, guard] */
const BLADE_SET: readonly (readonly [string, string, string])[] = [
  [BLADE_HI, BLADE, GOLD_DK],
  [BLADE_HI, BLADE, GOLD_DK],
  [BLADE_HI, BLADE, GOLD_DK],
  [CREAM, BLADE_GOLD, GOLD],
  [WHITE, BLADE_GOLD, GOLD],
];

const drawWeapon = (cls: AdvClass, tier: GearTier, lift: number) => {
  const [edge, core, guard] = BLADE_SET[tier];
  switch (cls) {
    case "warrior":
      // a greatsword: tall two-wide blade past the hand
      plot(16, 1 + lift, 1, 13, edge);
      plot(17, 2 + lift, 1, 12, core);
      plot(16, lift, 1, 1, WHITE);
      plot(15, 14 + lift, 5, 1, guard);
      plot(16, 15 + lift, 2, 3, WOOD);
      plot(16, 18 + lift, 2, 1, guard);
      break;
    case "mage":
      // a tall staff with a glowing orb
      plot(17, 3 + lift, 1, 19, WOOD);
      plot(16, -2 + lift, 3, 3, tier >= 3 ? GOLD : VIOLET);
      plot(17, -1 + lift, 1, 1, WHITE);
      plot(16, 3 + lift, 3, 1, guard);
      break;
    case "rogue":
      // a long dagger on the right and a twin on the left
      plot(16, 4 + lift, 1, 10, edge);
      plot(15, 14 + lift, 3, 1, guard);
      plot(16, 15 + lift, 1, 2, WOOD_DK);
      plot(-2, 8 + lift, 1, 7, core);
      plot(-3, 15 + lift, 3, 1, guard);
      plot(-2, 16 + lift, 1, 2, WOOD_DK);
      break;
    case "cleric":
      // a mace: pole and a big gold head with a cross
      plot(17, 4 + lift, 1, 18, WOOD);
      plot(15, -1 + lift, 5, 5, guard);
      plot(16, lift, 3, 3, tier >= 4 ? WHITE : CREAM);
      plot(17, -1 + lift, 1, 5, guard);
      plot(15, 1 + lift, 5, 1, guard);
      break;
    case "ranger":
      // a tall bow with a cream string
      plot(16, 3 + lift, 1, 17, CREAM);
      plot(18, 4 + lift, 1, 15, WOOD);
      plot(17, 2 + lift, 1, 2, WOOD);
      plot(17, 19 + lift, 1, 2, WOOD);
      plot(16, 1 + lift, 1, 2, WOOD_DK);
      plot(16, 20 + lift, 1, 2, WOOD_DK);
      plot(18, 10 + lift, 1, 3, tier >= 3 ? GOLD : WOOD_DK);
      break;
  }
};

// ---------------------------------------------------------------- cape (elite+)
const CAPE = "#b3263e";
const CAPE_LEGEND = "#d83a56";
const CAPE_DK = "#7a1830";
const CAPE_TOP = 8;
const CAPE_BOTTOM = 24;
const CAPE_SWAY = [0, 1, 0];
const drawCape = (tier: GearTier, frame: number) => {
  const body = tier >= 4 ? CAPE_LEGEND : CAPE;
  const hem = tier >= 4 ? WHITE : GOLD;
  const sway = CAPE_SWAY[frame];
  for (let ly = CAPE_TOP; ly < CAPE_BOTTOM; ly++) {
    const flare = 1 + Math.floor((ly - CAPE_TOP) / 5);
    const width = flare + (ly > CAPE_TOP + 4 ? sway * (ly > CAPE_TOP + 9 ? 2 : 1) : 0);
    plot(-width, ly, width, 1, CAPE_DK);
    plot(CH_W, ly, width, 1, body);
    if (ly > CAPE_TOP + 2) {
      plot(-width, ly, 1, 1, CAPE_DK);
      plot(CH_W + width - 1, ly, 1, 1, CAPE_DK);
    }
  }
  plot(0, CAPE_BOTTOM - 1, CH_W, 1, CAPE_DK);
  plot(-4, CAPE_BOTTOM, CH_W + 8, 1, hem); // the hem runs under the feet row
};

// ---------------------------------------------------------------- legend back pieces
const WING_COLORS: Record<string, string> = { k: GOLD_DK, G: GOLD, W: CREAM };
const WING_ART = [
  "k.......",
  "kk......",
  "kGk.....",
  "kWGk....",
  "kWWGk...",
  "kWWWGkk.",
  ".kWWWWGk",
  ".kWWWWWG",
  "..kWWWWW",
  "..kGWWWW",
  "...kWWWW",
  "...kGWWW",
  "....kWWW",
  "....kkWW",
  ".....kWW",
  ".....kkW",
];
const WING_TOP = -3;
const WING_W = 8;
/** the left wing as lx/ly pixels; the right one mirrors it */
const WING_PIX: Pix[] = [];
WING_ART.forEach((line, row) =>
  [...line].forEach((cell, col) => {
    if (cell !== ".") WING_PIX.push({ lx: col - (WING_W - 1), ly: WING_TOP + row, color: WING_COLORS[cell] });
  }),
);
const drawWings = (frame: number) => {
  const lift = frame === 1 ? -1 : 0;
  for (let i = 0; i < WING_PIX.length; i++) {
    const pix = WING_PIX[i];
    plot(pix.lx, pix.ly + lift, 1, 1, pix.color);
    plot(CH_W - 1 - pix.lx, pix.ly + lift, 1, 1, pix.color);
  }
};

const RING_CX = 8;
const RING_CY = 11;
const RING_RX = 13;
const RING_RY = 14;
const RING_STEPS = 40;
const RING_DASH = 3;
const RUNE_VIOLET = "#a56bff";
const RUNE_BLUE = "#7fd9ff";
const RING_SIN: number[] = [];
const RING_COS: number[] = [];
for (let i = 0; i < RING_STEPS; i++) {
  RING_SIN.push(Math.sin((i / RING_STEPS) * Math.PI * 2));
  RING_COS.push(Math.cos((i / RING_STEPS) * Math.PI * 2));
}
const drawRuneRing = (time: number, still: boolean) => {
  const spin = still ? 0 : Math.floor(time * 6);
  for (let i = 0; i < RING_STEPS; i++) {
    const lit = Math.floor((i + spin) / RING_DASH) % 2 === 0;
    plot(
      Math.round(RING_CX + RING_COS[i] * RING_RX),
      Math.round(RING_CY + RING_SIN[i] * RING_RY),
      1,
      1,
      lit ? RUNE_VIOLET : RUNE_BLUE,
    );
  }
  // four rune ticks (little pluses) that ride the ring
  for (let i = 0; i < 4; i++) {
    const ang = (still ? 0 : time * 0.8) + (i * Math.PI) / 2;
    const rx = Math.round(RING_CX + Math.cos(ang) * RING_RX),
      ry = Math.round(RING_CY + Math.sin(ang) * RING_RY);
    plot(rx - 1, ry, 3, 1, WHITE);
    plot(rx, ry - 1, 1, 3, WHITE);
  }
};

const FAN_COUNT = 5;
const FAN_STEP_DEG = 26;
const FAN_R0 = 7;
const FAN_R1 = 19;
const DAGGER_GRIP = "#4a3a6a";
const DAGGER_STEEL = "#aab0c8";
const drawDaggerFan = (time: number, still: boolean) => {
  const sway = still ? 0 : Math.sin(time * 2.5) * 4;
  for (let k = 0; k < FAN_COUNT; k++) {
    const ang = ((-90 + (k - (FAN_COUNT - 1) / 2) * FAN_STEP_DEG + sway) * Math.PI) / 180;
    const cos = Math.cos(ang),
      sin = Math.sin(ang);
    for (let reach = FAN_R0; reach <= FAN_R1; reach++) {
      const color = reach < FAN_R0 + 3 ? DAGGER_GRIP : reach >= FAN_R1 - 1 ? WHITE : DAGGER_STEEL;
      plot(Math.round(RING_CX + cos * reach), Math.round(RING_CY + 3 + sin * reach), 1, 1, color);
    }
  }
};

const ANTLER: readonly (readonly [number, number])[] = [
  [5, 1],
  [5, 0],
  [4, -1],
  [4, -2],
  [3, -3],
  [2, -4],
  [4, -4],
  [5, -2],
  [6, -3],
  [6, -4],
  [3, -1],
  [2, -1],
];
const ANTLER_TIPS = [4, 5, 6, 9];
const LEAF_ART = ["...gG", "..gGg", ".gGg.", "gGg..", ".gG.."];
const LEAF_COLORS: Record<string, string> = { g: "#3f9d55", G: "#8fe06f" };
const LEAF_TOP = 5;
const LEAF_PIX: Pix[] = [];
LEAF_ART.forEach((line, row) =>
  [...line].forEach((cell, col) => {
    if (cell !== ".") LEAF_PIX.push({ lx: col - WING_W + 3, ly: LEAF_TOP + row * 2, color: LEAF_COLORS[cell] });
  }),
);
const drawAntlers = (time: number, still: boolean) => {
  for (let i = 0; i < ANTLER.length; i++) {
    const color = ANTLER_TIPS.includes(i) ? WOOD_TIP : WOOD;
    plot(ANTLER[i][0], ANTLER[i][1], 1, 1, color);
    plot(CH_W - 1 - ANTLER[i][0], ANTLER[i][1], 1, 1, color);
  }
  const sway = still ? 0 : Math.floor(time * 2) % 2;
  for (let i = 0; i < LEAF_PIX.length; i++) {
    const pix = LEAF_PIX[i];
    plot(pix.lx, pix.ly - sway, 1, 2, pix.color);
    plot(CH_W - 1 - pix.lx, pix.ly - sway, 1, 2, pix.color);
  }
};

// ---------------------------------------------------------------- sparkles orbiting outside the body
const ORBIT_COUNT = 4;
const ORBIT_RX = 14;
const ORBIT_RY = 16;
const ORBIT_SPEED = 1.4;
const orbitAngle = (i: number, time: number, still: boolean): number =>
  (still ? Math.PI / 4 : time * ORBIT_SPEED) + (i * Math.PI * 2) / ORBIT_COUNT;
/** sprite-space position of orbiting sparkle `i` (always outside the 16x24 box) */
export const orbitX = (i: number, time: number, still: boolean): number =>
  Math.round(RING_CX + Math.cos(orbitAngle(i, time, still)) * ORBIT_RX);
export const orbitY = (i: number, time: number, still: boolean): number =>
  Math.round(RING_CY + Math.sin(orbitAngle(i, time, still)) * ORBIT_RY);
export const ORBIT_SPARKS = ORBIT_COUNT;

// ---------------------------------------------------------------- the pre-pass entry points
/** everything that sits behind the 16x24 sprite for this tier and class (pre-pass, before the entity sort) */
export const drawTierBack = (
  ctx: Ctx,
  cls: AdvClass,
  tier: GearTier,
  pose: Pose,
  px: number,
  py: number,
  facing: number,
  time: number,
  still: boolean,
) => {
  const overlay = overlayFor(cls, tier);
  if (!overlay.pads) return;
  begin(ctx, px, py, facing);
  if (overlay.back === "wings") drawWings(wingFrame(time, still));
  else if (overlay.back === "runes") drawRuneRing(time, still);
  else if (overlay.back === "daggers") drawDaggerFan(time, still);
  else if (overlay.back === "antlers") drawAntlers(time, still);
  if (overlay.cape) drawCape(tier, capeFrame(time, still));
  drawPads(tier);
  if (overlay.weapon && showsBigWeapon(pose)) drawWeapon(cls, tier, pose === "attack" ? -3 : 0);
  if (overlay.sparkles)
    for (let i = 0; i < ORBIT_COUNT; i++)
      plot(orbitX(i, time, still), orbitY(i, time, still), 1, 1, i % 2 === 0 ? WHITE : GOLD);
};

// ---------------------------------------------------------------- ground marks
const ELITE_RX = 9;
const ELITE_RY = 3;
const LEGEND_RX = 14;
const LEGEND_RY = 5;
const GROUND_GOLD = "#d9a441";
const GROUND_GOLD_DK = "#9a6f20";
const DASH_COUNT = 8;
const inEllipse = (dx: number, dy: number, rx: number, ry: number): number => (dx / rx) ** 2 + (dy / ry) ** 2;

/** under the feet: elite = small dithered gold ellipse, legend = bigger gold + white rune circle with turning dashes */
export const drawGroundMark = (ctx: Ctx, tier: GearTier, cx: number, cy: number, time: number, still: boolean) => {
  if (tier < 3) return;
  sCtx = ctx;
  const legend = tier >= 4;
  const rx = legend ? LEGEND_RX : ELITE_RX,
    ry = legend ? LEGEND_RY : ELITE_RY;
  const spin = still ? 0 : time * 0.6;
  const edge = inEllipse(rx - 1, 0, rx, ry);
  const x0 = Math.round(cx),
    y0 = Math.round(cy);
  for (let dy = -ry; dy <= ry; dy++)
    for (let dx = -rx; dx <= rx; dx++) {
      const dist = inEllipse(dx, dy, rx, ry);
      if (dist > 1) continue;
      const checker = (dx + dy) % 2 === 0;
      if (!legend) {
        if (dist > edge) fill(GROUND_GOLD, x0 + dx, y0 + dy);
        else if (checker) fill(GROUND_GOLD_DK, x0 + dx, y0 + dy);
        continue;
      }
      const ang = Math.atan2(dy / ry, dx / rx) + spin;
      const dash = Math.floor(((ang / (Math.PI * 2)) % 1) * DASH_COUNT * 2 + DASH_COUNT * 2) % (DASH_COUNT * 2);
      if (dist > 0.72) {
        if (dash % 2 === 0) fill(dash % 4 === 0 ? WHITE : GOLD, x0 + dx, y0 + dy);
        else if (checker) fill(GROUND_GOLD_DK, x0 + dx, y0 + dy);
      } else if (dist > 0.38 && dist < 0.5 && dash % 2 === 1) fill(GOLD, x0 + dx, y0 + dy);
      else if (dist <= 0.2) fill(checker ? WHITE : GOLD, x0 + dx, y0 + dy);
    }
};

// ---------------------------------------------------------------- legend spark trail (stateless: derived from time)
export const TRAIL_COUNT = 4;
const TRAIL_LIFE_S = 0.8;
const TRAIL_SPEED = 3;
const TRAIL_BEHIND_PX = 12;
/** 0..1 age of trail spark `i`, or -1 when it is not alive (nothing under reduced motion) */
export const trailAge = (i: number, time: number, still: boolean): number => {
  if (still) return -1;
  const age = (time * TRAIL_SPEED + i / TRAIL_COUNT) % 1;
  return age < TRAIL_LIFE_S ? age : -1;
};
export const trailX = (x: number, facing: number, age: number): number =>
  Math.round(x - (facing >= 0 ? 1 : -1) * (4 + age * TRAIL_BEHIND_PX));
export const trailY = (y: number, i: number, age: number): number => Math.round(y - 2 - age * 6 - (i % 2) * 2);
export const drawTrail = (ctx: Ctx, x: number, y: number, facing: number, time: number, still: boolean) => {
  sCtx = ctx;
  for (let i = 0; i < TRAIL_COUNT; i++) {
    const age = trailAge(i, time, still);
    if (age < 0) continue;
    fill(age < TRAIL_LIFE_S / 2 ? WHITE : GOLD, trailX(x, facing, age), trailY(y, i, age));
  }
};

// ---------------------------------------------------------------- tier-up pillar and ring (behind the character)
const PILLAR_H = 46;
const PILLAR_CORE_HALF = 2;
const PILLAR_HALF = 6;
const RING_DOTS = 16;
export const drawTierUpBack = (ctx: Ctx, phase: TierUpPhase, cx: number, groundY: number) => {
  sCtx = ctx;
  if (phase.pillar > 0) {
    const height = Math.round(PILLAR_H * phase.pillar);
    for (let dy = 0; dy < height; dy++)
      for (let dx = -PILLAR_HALF; dx < PILLAR_HALF; dx++) {
        const edge = Math.abs(dx + 0.5);
        if (edge < PILLAR_CORE_HALF) fill(WHITE, cx + dx, groundY - dy);
        else if ((dx + dy) % 2 === 0 && edge < PILLAR_HALF - (dy > height - 4 ? 2 : 0))
          fill(GOLD, cx + dx, groundY - dy);
      }
  }
  if (phase.ring !== null) {
    const radius = 6 + phase.ring * 16;
    for (let i = 0; i < RING_DOTS; i++) {
      const ang = (i / RING_DOTS) * Math.PI * 2;
      fill(
        i % 2 === 0 ? WHITE : GOLD,
        cx + Math.cos(ang) * radius,
        groundY - CH_H / 2 + Math.sin(ang) * radius * 0.7,
        2,
        2,
      );
    }
  }
};
