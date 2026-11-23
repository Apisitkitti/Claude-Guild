// The DUNGEON LORD: the big shared boss at the bottom of the dungeon. A 48x48 pixel drawing facing LEFT (toward the
// raiders), feet on row 45 (row 46 is the outline), four frames: 0-1 idle (breathing, embers), 2-3 attack (greatsword
// wound up, then brought down, maw open and burning), plus an opaque "hurt" variant (a lighter palette on the fill; the
// outline stays dark). Built once and cached. Nothing here is translucent.

import { Grid as BaseGrid, lighten, luma, mix } from "./sprites";

export const LORD_W = 48;
export const LORD_H = 48;
export const LORD_FRAMES = 4;
/** frames 0-1 are the calm pair, 2-3 the attack pair */
export const LORD_ATTACK_FROM = 2;

const GLOW = "#ff4a2a",
  GLOW_HI = "#ffd070",
  RUNE = "#c27bff";
const BONE = "#efe6c8",
  BONE_SH = "#b8a982";
const STEEL = "#aab6c6",
  STEEL_HI = "#e6edf7",
  STEEL_SH = "#5d6879";
const CAPE = "#5e1020",
  CAPE_HI = "#8a1c30",
  CAPE_SH = "#3a0a14";
const GOLD = "#d9a82a",
  GOLD_SH = "#8a6416";

interface Ramp {
  base: string;
  hi: string;
  sh: string;
  dk: string;
}

const ARMOR: Ramp = { base: "#3d3752", hi: "#6a6288", sh: "#27223a", dk: "#16122a" };
const FLESH: Ramp = { base: "#8a2a3a", hi: "#c04a5e", sh: "#5e1a28", dk: "#3a0f18" };

class Grid extends BaseGrid {
  override set(x: number, y: number, color: string) {
    super.set(Math.round(x), Math.round(y), color);
  }
  /** shaded ellipse: light from the upper left, a deep core shadow on the lower right */
  ell(cx: number, cy: number, rx: number, ry: number, ramp: Ramp) {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        const nx = (x - cx) / (rx + 0.35),
          ny = (y - cy) / (ry + 0.35);
        if (nx * nx + ny * ny > 1) continue;
        const light = nx * 0.8 + ny * 0.9;
        this.set(x, y, light < -0.55 ? ramp.hi : light > 0.95 ? ramp.dk : light > 0.35 ? ramp.sh : ramp.base);
      }
    }
  }
  tri(vertA: number[], vertB: number[], vertC: number[], color: string) {
    const side = (p1: number[], p2: number[], p3: number[]) =>
      (p1[0] - p3[0]) * (p2[1] - p3[1]) - (p2[0] - p3[0]) * (p1[1] - p3[1]);
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const pt = [x + 0.5, y + 0.5];
        const d1 = side(pt, vertA, vertB),
          d2 = side(pt, vertB, vertC),
          d3 = side(pt, vertC, vertA);
        if (!((d1 < 0 || d2 < 0 || d3 < 0) && (d1 > 0 || d2 > 0 || d3 > 0))) this.set(x, y, color);
      }
    }
  }
  line(x0: number, y0: number, x1: number, y1: number, color: string, width = 1) {
    const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
    for (let i = 0; i <= steps; i++) {
      const px = x0 + ((x1 - x0) * i) / steps,
        py = y0 + ((y1 - y0) * i) / steps;
      for (let step = 0; step < width; step++) this.set(px + step, py, color);
    }
  }
  limb(x0: number, y0: number, r0: number, x1: number, y1: number, r1: number, ramp: Ramp) {
    const steps = Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)));
    for (let i = 0; i <= steps; i++) {
      const ratio = steps ? i / steps : 0;
      const radius = r0 + (r1 - r0) * ratio;
      this.ell(x0 + (x1 - x0) * ratio, y0 + (y1 - y0) * ratio, radius, radius, ramp);
    }
  }
}

/** the greatsword: a steel blade with a glowing rune edge, from the hilt (hx, hy) to the tip (tx, ty) */
const sword = (grid: Grid, hx: number, hy: number, tx: number, ty: number) => {
  grid.line(hx, hy, tx, ty, STEEL_SH, 4);
  grid.line(hx, hy, tx, ty, STEEL, 3);
  grid.line(hx, hy, tx, ty, STEEL_HI, 1);
  grid.line(hx + 3, hy, tx + 3, ty, GLOW, 1);
  // crossguard
  const dx = ty - hy,
    dy = hx - tx;
  const norm = Math.max(Math.abs(dx), Math.abs(dy), 1);
  for (let k = -5; k <= 5; k++) grid.set(hx + 1.5 + (dx * k) / norm, hy + (dy * k) / norm, k % 2 ? GOLD : GOLD_SH);
};

const drawLord = (grid: Grid, frame: number) => {
  const attack = frame >= LORD_ATTACK_FROM;
  const strike = frame === LORD_ATTACK_FROM + 1;
  const lift = frame === 1 ? 1 : 0;
  const lean = strike ? -2 : attack ? 1 : 0;

  // cape, billowing behind
  grid.tri([28 + lean, 14 + lift], [45, 44], [24, 44], CAPE);
  grid.tri([30 + lean, 16 + lift], [44, 40], [28, 42], CAPE_HI);
  grid.line(35, 24, 40, 43, CAPE_SH);
  grid.line(31, 28, 33, 43, CAPE_SH);

  // greatsword behind the back arm
  if (strike) sword(grid, 30, 25, 5, 41);
  else if (attack) sword(grid, 40, 18, 42, 2);
  else sword(grid, 41, 29 + lift, 41, 8 + lift);

  // legs and heavy boots
  grid.limb(18, 33, 3.6, 16, 43, 3.2, ARMOR);
  grid.limb(28, 33, 3.6, 31, 43, 3.2, ARMOR);
  grid.ell(14, 44, 5.4, 2.3, ARMOR);
  grid.ell(32, 44, 5.4, 2.3, ARMOR);
  for (const x of [9, 11, 27, 29]) grid.set(x, 45, BONE); // toe spikes
  grid.rect(14, 38, 20, 38, GOLD_SH);
  grid.rect(28, 38, 34, 38, GOLD_SH);

  // torso: breastplate with a glowing cracked core
  grid.ell(24 + lean, 25 + lift, 11, 10, ARMOR);
  grid.ell(23 + lean, 29 + lift, 8, 5, { ...ARMOR, base: ARMOR.hi, hi: "#8b83ac" });
  grid.rect(21 + lean, 24 + lift, 23 + lean, 31 + lift, ARMOR.dk);
  grid.line(22 + lean, 22 + lift, 21 + lean, 31 + lift, GLOW, 1);
  grid.line(21 + lean, 27 + lift, 17 + lean, 29 + lift, GLOW);
  grid.line(22 + lean, 25 + lift, 27 + lean, 27 + lift, GLOW);
  grid.set(22 + lean, 28 + lift, GLOW_HI);
  // belt with a skull buckle
  grid.rect(14 + lean, 33 + lift, 33 + lean, 35 + lift, GOLD_SH);
  grid.rect(14 + lean, 33 + lift, 33 + lean, 33 + lift, GOLD);
  grid.rect(21 + lean, 32 + lift, 25 + lean, 36 + lift, BONE);
  grid.set(22 + lean, 34 + lift, ARMOR.dk);
  grid.set(24 + lean, 34 + lift, ARMOR.dk);

  // shoulders with spikes
  grid.ell(11 + lean, 18 + lift, 6, 5, ARMOR);
  grid.ell(36 + lean, 17 + lift, 6, 5, ARMOR);
  grid.tri([6 + lean, 16 + lift], [5 + lean, 8 + lift], [10 + lean, 14 + lift], BONE);
  grid.tri([11 + lean, 14 + lift], [11 + lean, 6 + lift], [15 + lean, 13 + lift], BONE);
  grid.tri([34 + lean, 13 + lift], [37 + lean, 5 + lift], [40 + lean, 13 + lift], BONE);
  grid.line(6 + lean, 15 + lift, 6 + lean, 10 + lift, BONE_SH);

  // back (sword) arm
  if (strike) {
    grid.limb(36 + lean, 19, 3, 31, 25, 2.6, ARMOR);
    grid.ell(30, 25, 3, 3, ARMOR);
  } else if (attack) {
    grid.limb(37, 17, 3, 41, 19, 2.6, ARMOR);
    grid.ell(41, 19, 3, 3, ARMOR);
  } else {
    grid.limb(37, 19 + lift, 3, 41, 28 + lift, 2.6, ARMOR);
    grid.ell(41, 29 + lift, 3, 3, ARMOR);
  }

  // front (claw) arm, reaching toward the raiders
  if (strike) {
    grid.limb(11 + lean, 21, 3, 6 + lean, 30, 2.6, FLESH);
    grid.ell(6 + lean, 31, 3, 3, FLESH);
    for (const [x, y] of [
      [3, 33],
      [5, 34],
      [7, 34],
    ])
      grid.set(x + lean, y, BONE);
  } else if (attack) {
    grid.limb(11, 21, 3, 5, 16, 2.6, FLESH);
    grid.ell(4, 15, 3, 3, FLESH);
    for (const [x, y] of [
      [1, 12],
      [1, 15],
      [2, 18],
    ])
      grid.set(x, y, BONE);
  } else {
    grid.limb(11, 21 + lift, 3, 7, 31 + lift, 2.6, FLESH);
    grid.ell(6, 32 + lift, 3, 3, FLESH);
    for (const [x, y] of [
      [3, 34],
      [5, 35],
      [7, 35],
    ])
      grid.set(x, y + lift, BONE);
  }

  // head: horned black helm, burning eyes, fanged maw
  const hx = 21 + lean + (strike ? -1 : 0),
    hy = 11 + lift;
  grid.ell(hx, hy, 7.5, 6.5, ARMOR);
  grid.rect(hx - 6, hy, hx + 5, hy + 4, FLESH.dk); // the dark face under the visor
  grid.rect(hx - 7, hy - 1, hx + 5, hy - 1, ARMOR.sh);
  // eyes
  grid.rect(hx - 6, hy + 1, hx - 3, hy + 2, GLOW);
  grid.rect(hx, hy + 1, hx + 3, hy + 2, GLOW);
  grid.set(hx - 5, hy + 1, GLOW_HI);
  grid.set(hx + 1, hy + 1, GLOW_HI);
  // maw and fangs
  const open = attack ? 3 : 1;
  grid.rect(hx - 5, hy + 4, hx + 2, hy + 4 + open, "#1a0608");
  for (let x = hx - 5; x <= hx + 2; x += 2) {
    grid.set(x, hy + 4, BONE);
    grid.set(x, hy + 4 + open, BONE);
  }
  grid.set(hx - 6, hy + 5, BONE);
  grid.set(hx - 6, hy + 4, BONE);
  if (attack) {
    // breath of embers pouring out of the open maw
    const reach = strike ? 7 : 4;
    for (let k = 0; k < reach; k++) {
      grid.set(hx - 7 - k, hy + 5 + (k % 2), k < 3 ? GLOW_HI : GLOW);
      grid.set(hx - 7 - k, hy + 6 - (k % 3), GLOW);
    }
  }
  // great curved horns
  grid.line(hx - 4, hy - 4, hx - 8, hy - 6, BONE, 2);
  grid.line(hx - 9, hy - 6, hx - 10, hy - 9, BONE);
  grid.line(hx - 10, hy - 9, hx - 9, hy - 10, BONE_SH);
  grid.line(hx + 3, hy - 5, hx + 7, hy - 7, BONE, 2);
  grid.line(hx + 8, hy - 7, hx + 9, hy - 10, BONE);
  grid.line(hx + 9, hy - 10, hx + 8, hy - 10, BONE_SH);
  // a crown of spikes between the horns
  for (const x of [-1, 2]) grid.line(hx + x, hy - 6, hx + x, hy - 8, GOLD);

  // violet rune glints on the armor (they pulse with the frame)
  const spots: [number, number][] = [
    [10, 20],
    [38, 19],
    [18, 38],
    [30, 38],
  ];
  spots.forEach(([x, y], k) => {
    if ((k + frame) % 2 === 0) grid.set(x + lean, y + lift, RUNE);
  });
};

const hurtTone = (color: string): string => {
  if (luma(color) < 40) return color;
  return lighten(mix(color, "#ff6a5a", 0.35), 0.35);
};

const cache = new Map<string, HTMLCanvasElement>();
const wrapFrame = (frame: number): number => {
  const count = Math.floor(Number.isFinite(frame) ? frame : 0);
  return ((count % LORD_FRAMES) + LORD_FRAMES) % LORD_FRAMES;
};

/** the Dungeon Lord, facing left; `hurt` is the opaque lighter flash palette (outline stays dark) */
export const lordSprite = (frame: number, hurt = false): HTMLCanvasElement => {
  const index = wrapFrame(frame);
  const key = `${index}|${hurt ? 1 : 0}`;
  const known = cache.get(key);
  if (known) return known;
  const grid = new Grid(LORD_W, LORD_H);
  grid.dx = 1; // keeps the claws and the cape off the outline columns
  drawLord(grid, index);
  grid.outline();
  if (hurt) grid.recolorFill(hurtTone);
  const canvas = grid.toCanvas();
  cache.set(key, canvas);
  return canvas;
};
