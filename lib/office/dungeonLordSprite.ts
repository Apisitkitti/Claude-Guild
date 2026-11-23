// The DUNGEON LORD and his THRONE. Pixel drawings built once and cached; nothing here is translucent.
//  - lordSprite(frame, hurt): the standing demon king, 64x64, facing LEFT (toward the raiders), feet-centre anchored.
//    Frames 0-1 idle (breathing, flames and cape flicker), 2-3 attack (blade raised, then the slam with an ember trail).
//    `hurt` is the opaque lighter palette (the outline stays dark).
//  - lordSeatedSprite(frame) / lordRiseSprite(frame): the same king seated (front view, hands on the planted sword's
//    pommel) and rising from the seat; both are bottom-centre anchored (the middle of the boots' bottom edge).
//  - throneSprite(): the obsidian-and-bone throne he is layered onto (seat anchor in THRONE_SEAT_DX/DY).

import { Grid as BaseGrid, lighten, luma, mix } from "./sprites";

export const LORD_W = 64;
export const LORD_H = 64;
export const LORD_FRAMES = 4;
/** frames 0-1 are the calm pair, 2-3 the attack pair */
export const LORD_ATTACK_FROM = 2;

/** seated Lord: front view, bottom-centre = boot soles (draw at seatX - W/2, seatY - H) */
export const LORD_SEATED_W = 56;
export const LORD_SEATED_H = 62;
export const LORD_SEATED_FRAMES = 2;
/** rising Lord: same width and bottom-centre anchor as the seated one, taller */
export const LORD_RISE_W = 56;
export const LORD_RISE_H = 74;
export const LORD_RISE_FRAMES = 2;

export const THRONE_W = 80;
export const THRONE_H = 91;
/**
 * Where the seated Lord's bottom-centre goes inside the throne canvas: draw the seated (or rising) sprite at
 * x = throneX + THRONE_SEAT_DX - LORD_SEATED_W / 2, y = throneY + THRONE_SEAT_DY - LORD_SEATED_H
 * (the same bottom-centre rule for the rise sprite with LORD_RISE_W / LORD_RISE_H).
 */
export const THRONE_SEAT_DX = 40;
export const THRONE_SEAT_DY = 80;

const GLOW = "#ff4a2a",
  GLOW_HI = "#ffd070",
  EMBER = "#ff8a2a",
  RUNE = "#c27bff";
const TRIM = "#b3182c",
  TRIM_SH = "#6e0e1c";
const GOLD = "#d9a82a",
  GOLD_SH = "#8a6416";
const CAPE = "#6a0f22",
  CAPE_HI = "#9c1a34",
  CAPE_SH = "#3c0814";
const BLADE = "#9a94b8",
  BLADE_HI = "#e4e0f6",
  BLADE_SH = "#2c2244";
const VOID = "#12060c";

interface Ramp {
  base: string;
  hi: string;
  sh: string;
  dk: string;
}

/** deep purple-black plate */
const ARMOR: Ramp = { base: "#2c2140", hi: "#53407c", sh: "#1b142b", dk: "#0f0a1b" };
/** black iron for horns, spikes and gauntlets, with a cold lit edge */
const IRON: Ramp = { base: "#4a3d66", hi: "#8d78bd", sh: "#2c2342", dk: "#170f26" };
/** the throne: cool slate obsidian, set apart from the Lord's violet */
const STONE: Ramp = { base: "#3d4a5e", hi: "#7189a8", sh: "#28323f", dk: "#141a23" };
const BONE: Ramp = { base: "#e9e0c4", hi: "#fffaf0", sh: "#b3a57e", dk: "#6e6444" };
const GEM = "#e0243c",
  GEM_HI = "#ff9aa0",
  GEM_SH = "#8a0f22";

class Grid extends BaseGrid {
  override set(x: number, y: number, color: string) {
    super.set(Math.round(x), Math.round(y), color);
  }
  clear(x: number, y: number) {
    const px = Math.round(x) + this.dx,
      py = Math.round(y) + this.dy;
    if (px >= 0 && px < this.width && py >= 0 && py < this.height) this.cells[py * this.width + px] = null;
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
    const minX = Math.floor(Math.min(vertA[0], vertB[0], vertC[0])),
      maxX = Math.ceil(Math.max(vertA[0], vertB[0], vertC[0])),
      minY = Math.floor(Math.min(vertA[1], vertB[1], vertC[1])),
      maxY = Math.ceil(Math.max(vertA[1], vertB[1], vertC[1]));
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
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
  /** a curved horn through the points, tapering to the tip, with an ember point */
  horn(points: number[][], r0: number, ramp: Ramp, tip = EMBER) {
    for (let i = 0; i < points.length - 1; i++) {
      const [ax, ay] = points[i],
        [bx, by] = points[i + 1];
      const ra = r0 * (1 - i / (points.length - 1)) + 0.4,
        rb = r0 * (1 - (i + 1) / (points.length - 1)) + 0.4;
      this.limb(ax, ay, ra, bx, by, rb, ramp);
    }
    const last = points[points.length - 1];
    this.set(last[0], last[1], tip);
  }
  /** a tongue of fire rising from (x, y): red rim, orange body, pale core; it leans with `sway` */
  flame(x: number, y: number, height: number, sway: number) {
    for (let i = 0; i < height; i++) {
      const half = Math.max(0, Math.round((1 - i / height) * 2.2));
      const lean = i > height / 2 ? sway : 0;
      this.row(y - i, x - half + lean, x + half + lean, GLOW);
      if (half > 0 && i < height - 1) this.row(y - i, x - half + 1 + lean, x + half - 1 + lean, EMBER);
      if (half > 1 && i < height * 0.6) this.set(x + lean, y - i, GLOW_HI);
    }
  }
}

/** the greatsword: a black-iron blade with a glowing rune fuller, licking flames and a spiked guard */
const greatsword = (grid: Grid, hx: number, hy: number, tx: number, ty: number, flick: number) => {
  const dx = tx - hx,
    dy = ty - hy;
  const len = Math.max(Math.hypot(dx, dy), 1);
  const px = -dy / len,
    py = dx / len;
  // blade: dark edges, lit steel, a bright spine and a glowing fuller
  for (let wid = -3; wid <= 3; wid++) {
    const col = Math.abs(wid) === 3 ? BLADE_SH : Math.abs(wid) === 2 ? BLADE : wid < 0 ? BLADE_HI : BLADE;
    grid.line(hx + px * wid, hy + py * wid, tx + px * wid * 0.35, ty + py * wid * 0.35, col);
  }
  grid.line(hx + px, hy + py, tx + px * 0.3, ty + py * 0.3, GLOW);
  // rune notches pulse along the fuller
  for (let k = 3; k < len - 4; k += 5) {
    const col = (k / 5 + flick) % 2 === 0 ? GLOW_HI : EMBER;
    grid.set(hx + (dx * k) / len, hy + (dy * k) / len, col);
  }
  // flames licking off the edge
  for (let k = 8; k < len - 2; k += 7) {
    const fx = hx + (dx * k) / len - px * 3.5,
      fy = hy + (dy * k) / len - py * 3.5;
    grid.set(fx, fy, flick ? GLOW_HI : EMBER);
    grid.set(fx - px, fy - py - 1, GLOW);
    grid.set(fx - px * 2, fy - py * 2 - 1, flick ? EMBER : GLOW);
  }
  // crossguard: a spiked bar with a gem
  for (let k = -6; k <= 6; k++) {
    grid.set(hx + px * k, hy + py * k, Math.abs(k) > 4 ? GOLD_SH : GOLD);
    grid.set(hx + px * k - (dx / len) * 1, hy + py * k - (dy / len) * 1, GOLD_SH);
  }
  grid.set(hx - dx / len, hy - dy / len, GEM_HI);
  // grip and pommel
  grid.line(hx, hy, hx - (dx / len) * 6, hy - (dy / len) * 6, IRON.dk, 2);
  grid.ell(hx - (dx / len) * 7, hy - (dy / len) * 7, 1.6, 1.6, IRON);
};

const spikes = (grid: Grid, list: number[][][]) => {
  for (const [pa, pb, pc] of list) {
    grid.tri(pa, pb, pc, IRON.base);
    grid.line(pa[0], pa[1], pb[0], pb[1], IRON.hi);
    grid.set(pb[0], pb[1], EMBER);
  }
};

/** the standing Lord (virtual canvas drawn through a (2, 3) offset so horns and blade keep clear of the outline) */
const drawLord = (grid: Grid, frame: number) => {
  const attack = frame >= LORD_ATTACK_FROM;
  const strike = frame === LORD_ATTACK_FROM + 1;
  const flick = frame % 2;
  const up = frame === 1 ? 1 : 0;
  const lean = strike ? -2 : attack ? 1 : 0;
  const drop = strike ? 3 : 0;
  const uy = up + drop;

  // tattered crimson cape, streaming behind (to the right)
  grid.tri([32 + lean, 20 + uy], [60, 55], [28, 56], CAPE);
  grid.tri([34 + lean, 22 + uy], [57, 50], [32, 52], CAPE_HI);
  grid.line(44, 30, 53, 53, CAPE_SH);
  grid.line(38, 34, 42, 54, CAPE_SH);
  grid.line(50, 38, 57, 52, CAPE_SH);
  for (let x = 28; x <= 60; x++) {
    const tooth = (x * 7 + flick * 3) % 6;
    const hem = 56 - (tooth < 2 ? 5 : tooth < 4 ? 2 : 0);
    for (let y = hem; y <= 57; y++) grid.clear(x, y);
  }

  // the greatsword (behind the arm that holds it)
  if (strike) greatsword(grid, 33, 33, 3, 56, flick);
  else if (attack) greatsword(grid, 46, 24, 58, 2, flick);

  // legs: greaved thighs and heavy spiked boots
  grid.limb(21, 44, 4, 17, 56, 3.4, ARMOR);
  grid.limb(38, 44, 4, 41, 56, 3.4, ARMOR);
  grid.rect(16, 50, 23, 50, TRIM_SH);
  grid.rect(36, 50, 43, 50, TRIM_SH);
  grid.ell(16, 57, 7, 2.6, ARMOR);
  grid.ell(41, 57, 7, 2.6, ARMOR);
  spikes(grid, [
    [
      [8, 58],
      [3, 55],
      [10, 55],
    ],
    [
      [33, 58],
      [28, 55],
      [35, 55],
    ],
  ]);

  // tassets and belt
  grid.rect(23, 40, 35, 46, ARMOR.base);
  grid.rect(23, 40, 35, 40, IRON.hi);
  for (const x of [24, 28, 32]) grid.rect(x, 42, x + 2, 46, ARMOR.sh);
  for (const x of [25, 29, 33]) grid.set(x, 46, TRIM);
  grid.rect(21, 38, 37, 40, IRON.sh);
  grid.rect(21, 38, 37, 38, GOLD_SH);
  grid.rect(27 + lean, 37, 31 + lean, 41, BONE.base);
  grid.set(28 + lean, 39, ARMOR.dk);
  grid.set(30 + lean, 39, ARMOR.dk);

  // torso: dark plate with a cracked, burning core
  grid.ell(29 + lean, 31 + uy, 11, 9.5, ARMOR);
  grid.ell(27 + lean, 33 + uy, 8, 5, { base: ARMOR.hi, hi: "#6e58a0", sh: ARMOR.base, dk: ARMOR.sh });
  grid.line(29 + lean, 21 + uy, 28 + lean, 37 + uy, GLOW, 1);
  grid.line(28 + lean, 28 + uy, 22 + lean, 31 + uy, GLOW);
  grid.line(29 + lean, 26 + uy, 35 + lean, 29 + uy, GLOW);
  grid.line(28 + lean, 33 + uy, 33 + lean, 36 + uy, EMBER);
  grid.rect(28 + lean, 28 + uy, 29 + lean, 29 + uy, flick ? GLOW_HI : EMBER);
  grid.row(25 + uy, 20 + lean, 25 + lean, TRIM);
  grid.row(25 + uy, 33 + lean, 38 + lean, TRIM);
  grid.row(35 + uy, 20 + lean, 24 + lean, TRIM_SH);
  grid.row(35 + uy, 34 + lean, 38 + lean, TRIM_SH);
  // gorget
  grid.ell(27 + lean, 22 + uy, 7, 3.5, IRON);

  // massive spiked pauldrons
  grid.ell(14 + lean, 25 + uy, 7.5, 6, ARMOR);
  grid.ell(44 + lean, 24 + uy, 7.5, 6, ARMOR);
  grid.row(22 + uy, 8 + lean, 20 + lean, IRON.hi);
  grid.row(21 + uy, 39 + lean, 51 + lean, IRON.hi);
  grid.row(28 + uy, 9 + lean, 19 + lean, TRIM);
  grid.row(27 + uy, 39 + lean, 49 + lean, TRIM);
  spikes(grid, [
    [
      [6 + lean, 21 + uy],
      [1 + lean, 12 + uy],
      [11 + lean, 19 + uy],
    ],
    [
      [12 + lean, 18 + uy],
      [10 + lean, 8 + uy],
      [18 + lean, 18 + uy],
    ],
    [
      [20 + lean, 18 + uy],
      [22 + lean, 10 + uy],
      [25 + lean, 18 + uy],
    ],
    [
      [38 + lean, 17 + uy],
      [41 + lean, 6 + uy],
      [46 + lean, 17 + uy],
    ],
    [
      [47 + lean, 19 + uy],
      [55 + lean, 11 + uy],
      [52 + lean, 24 + uy],
    ],
  ]);

  // back (sword) arm and gauntlet
  if (!attack) greatsword(grid, 56, 38 + up, 56, 4 + up, flick);
  if (strike) {
    grid.limb(44 + lean, 27 + uy, 3.4, 34, 33, 3, ARMOR);
    grid.ell(33, 33, 3.4, 3.4, IRON);
  } else if (attack) {
    grid.limb(46 + lean, 22 + uy, 3.4, 47, 24, 3, ARMOR);
    grid.ell(46, 24, 3.4, 3.4, IRON);
  } else {
    grid.limb(46, 28 + uy, 3.4, 55, 36 + up, 3, ARMOR);
    grid.ell(56, 38 + up, 3.4, 3.4, IRON);
  }

  // front claw, reaching for the raiders
  const reach = strike ? [6, 42] : attack ? [3, 26] : [5, 41 + up];
  grid.limb(11 + lean, 28 + uy, 3.6, reach[0] + 3, reach[1] - 7, 3, ARMOR);
  grid.ell(reach[0] + 1, reach[1] - 3, 3.6, 3.6, IRON);
  for (const [cx, cy] of [
    [0, 2],
    [2, 3],
    [4, 3],
  ]) {
    grid.line(reach[0] + cx - 1, reach[1] + cy - 2, reach[0] + cx - 2, reach[1] + cy + 2, BONE.base);
    grid.set(reach[0] + cx - 2, reach[1] + cy + 2, GLOW);
  }

  // head: horned, crowned, burning
  const hx = 26 + lean,
    hy = 16 + uy;
  grid.ell(hx, hy, 7.8, 7.2, ARMOR);
  grid.rect(hx - 7, hy - 1, hx + 4, hy - 1, IRON.hi);
  grid.rect(hx - 6, hy, hx + 3, hy + 5, VOID);
  // brow ridge and glowing eyes
  grid.row(hy, hx - 7, hx - 2, ARMOR.dk);
  grid.row(hy, hx + 0, hx + 5, ARMOR.dk);
  grid.row(hy + 1, hx - 6, hx - 4, GLOW);
  grid.row(hy + 2, hx - 5, hx - 2, GLOW);
  grid.row(hy + 1, hx + 2, hx + 4, GLOW);
  grid.row(hy + 2, hx, hx + 3, GLOW);
  grid.set(hx - 4, hy + 2, GLOW_HI);
  grid.set(hx + 1, hy + 2, GLOW_HI);
  grid.set(hx - 7, hy + 2, EMBER);
  grid.set(hx + 3, hy + 2, EMBER);
  // maw and fangs, open and spewing embers when he attacks
  const open = attack ? 3 : 1;
  grid.rect(hx - 5, hy + 4, hx + 1, hy + 4 + open, "#2a0610");
  for (let x = hx - 5; x <= hx + 1; x += 3) {
    grid.set(x, hy + 4, BONE.hi);
    grid.set(x, hy + 5, BONE.hi);
    grid.set(x + 1, hy + 4 + open, BONE.hi);
  }
  grid.set(hx - 7, hy + 5, BONE.base);
  grid.set(hx - 7, hy + 4, BONE.base);
  grid.set(hx - 7, hy + 3, BONE.base);
  if (attack) {
    const range = strike ? 8 : 4;
    for (let k = 0; k < range; k++) {
      grid.set(hx - 8 - k, hy + 5 + (k % 2), k < 3 ? GLOW_HI : GLOW);
      grid.set(hx - 8 - k, hy + 6 - (k % 3), EMBER);
    }
  }
  // horns swept back over the skull
  grid.horn(
    [
      [hx + 1, hy - 6],
      [hx + 7, hy - 11],
      [hx + 15, hy - 13],
      [hx + 22, hy - 10],
    ],
    2.8,
    IRON,
  );
  grid.horn(
    [
      [hx + 5, hy - 4],
      [hx + 12, hy - 7],
      [hx + 20, hy - 6],
      [hx + 26, hy - 1],
    ],
    2.4,
    IRON,
  );
  // crown of black iron burning with flames
  grid.rect(hx - 6, hy - 8, hx + 1, hy - 6, IRON.base);
  grid.row(hy - 8, hx - 6, hx + 1, IRON.hi);
  grid.set(hx - 3, hy - 7, GEM_HI);
  grid.flame(hx - 5, hy - 9, 5, flick ? -1 : 1);
  grid.flame(hx - 2, hy - 9, 7, flick ? 1 : -1);
  grid.flame(hx + 1, hy - 9, 4, flick ? -1 : 0);

  // violet rune glints that pulse with the frame
  const spots: number[][] = [
    [12, 26],
    [46, 25],
    [20, 52],
    [38, 52],
    [29, 43],
  ];
  spots.forEach(([x, y], k) => {
    if ((k + frame) % 2 === 0) grid.set(x + lean, y + uy, RUNE);
  });
};

/**
 * The Lord seated (front view). `lift` raises the body off the seat (0 = seated); the boots stay planted on virtual
 * row 50. `flick` is the glow and flame flicker frame.
 */
const drawSeated = (grid: Grid, flick: number, lift: number) => {
  const cx = 26;
  const lf = lift;
  const kneeY = 39 - Math.round(lf * 0.5);

  // cape draped behind and to both sides
  grid.tri([cx, 14 - lf], [2, 50], [cx - 6, 50], CAPE);
  grid.tri([cx, 14 - lf], [50, 50], [cx + 6, 50], CAPE);
  grid.tri([cx - 8, 20 - lf], [5, 47], [cx - 8, 47], CAPE_HI);
  grid.tri([cx + 8, 20 - lf], [47, 47], [cx + 8, 47], CAPE_HI);
  for (const [x0, x1] of [
    [2, cx - 6],
    [cx + 6, 50],
  ])
    for (let x = x0; x <= x1; x++) {
      const tooth = (x * 5 + flick * 2) % 6;
      const hem = 51 - (tooth < 2 ? 5 : tooth < 4 ? 2 : 0);
      for (let y = hem; y <= 51; y++) grid.clear(x, y);
    }

  // legs apart: armoured thighs out to the knees, greaves down to spiked boots
  grid.limb(cx - 7, 40 - lf, 5, cx - 14, kneeY, 4.6, ARMOR);
  grid.limb(cx + 7, 40 - lf, 5, cx + 14, kneeY, 4.6, ARMOR);
  grid.limb(cx - 14, kneeY + 1, 4.2, cx - 15, 47, 3.8, ARMOR);
  grid.limb(cx + 14, kneeY + 1, 4.2, cx + 15, 47, 3.8, ARMOR);
  grid.ell(cx - 14, kneeY, 3, 3, IRON);
  grid.ell(cx + 14, kneeY, 3, 3, IRON);
  grid.set(cx - 14, kneeY - 3, EMBER);
  grid.set(cx + 14, kneeY - 3, EMBER);
  grid.ell(cx - 16, 49, 6.5, 2.2, ARMOR);
  grid.ell(cx + 16, 49, 6.5, 2.2, ARMOR);
  spikes(grid, [
    [
      [cx - 21, 50],
      [cx - 24, 47],
      [cx - 19, 47],
    ],
    [
      [cx + 21, 50],
      [cx + 24, 47],
      [cx + 19, 47],
    ],
  ]);

  // pelvis, belt and tassets
  grid.rect(cx - 8, 36 - lf, cx + 8, 42 - lf, ARMOR.base);
  grid.rect(cx - 8, 36 - lf, cx + 8, 36 - lf, IRON.hi);
  grid.rect(cx - 9, 34 - lf, cx + 9, 36 - lf, IRON.sh);
  grid.rect(cx - 2, 33 - lf, cx + 2, 37 - lf, BONE.base);
  grid.set(cx - 1, 35 - lf, ARMOR.dk);
  grid.set(cx + 1, 35 - lf, ARMOR.dk);

  // torso
  grid.ell(cx, 27 - lf, 9.5, 8.5, ARMOR);
  grid.ell(cx - 2, 30 - lf, 6, 3.5, { base: ARMOR.hi, hi: "#6e58a0", sh: ARMOR.base, dk: ARMOR.sh });
  grid.line(cx, 18 - lf, cx, 33 - lf, GLOW);
  grid.line(cx, 25 - lf, cx - 6, 28 - lf, GLOW);
  grid.line(cx, 23 - lf, cx + 6, 26 - lf, EMBER);
  grid.rect(cx, 26 - lf, cx + 1, 27 - lf, flick ? GLOW_HI : EMBER);
  grid.row(22 - lf, cx - 9, cx - 3, TRIM);
  grid.row(22 - lf, cx + 3, cx + 9, TRIM);
  grid.ell(cx, 19 - lf, 5, 2.5, IRON);

  // the greatsword planted point-down, its grip and pommel under both hands
  const tipY = 50;
  for (let wid = -2; wid <= 2; wid++)
    grid.line(cx + wid, 40 - lf, cx + wid * 0.3, tipY, Math.abs(wid) === 2 ? BLADE_SH : wid < 0 ? BLADE_HI : BLADE);
  grid.line(cx, 41 - lf, cx, tipY - 1, GLOW);
  for (let y = 43; y < tipY; y += 4) grid.set(cx, y - lf * (y < 46 ? 1 : 0), flick ? GLOW_HI : EMBER);
  grid.rect(cx - 5, 39 - lf, cx + 5, 40 - lf, GOLD);
  grid.set(cx - 5, 40 - lf, GOLD_SH);
  grid.set(cx + 5, 40 - lf, GOLD_SH);
  grid.set(cx, 39 - lf, GEM_HI);
  grid.rect(cx - 1, 31 - lf, cx + 1, 38 - lf, IRON.dk);
  grid.ell(cx, 30 - lf, 2.6, 2.6, IRON);
  grid.set(cx, 30 - lf, GEM);

  // pauldrons
  grid.ell(cx - 14, 21 - lf, 6.5, 5, ARMOR);
  grid.ell(cx + 14, 21 - lf, 6.5, 5, ARMOR);
  grid.row(18 - lf, cx - 20, cx - 9, IRON.hi);
  grid.row(18 - lf, cx + 9, cx + 20, IRON.hi);
  grid.row(23 - lf, cx - 19, cx - 10, TRIM);
  grid.row(23 - lf, cx + 10, cx + 19, TRIM);
  spikes(grid, [
    [
      [cx - 20, 17 - lf],
      [cx - 23, 7 - lf],
      [cx - 14, 15 - lf],
    ],
    [
      [cx - 14, 15 - lf],
      [cx - 13, 5 - lf],
      [cx - 9, 16 - lf],
    ],
    [
      [cx + 9, 16 - lf],
      [cx + 13, 5 - lf],
      [cx + 14, 15 - lf],
    ],
    [
      [cx + 14, 15 - lf],
      [cx + 23, 7 - lf],
      [cx + 20, 17 - lf],
    ],
  ]);

  // arms down to the pommel, clawed gauntlets resting on it
  grid.limb(cx - 18, 24 - lf, 3.4, cx - 17, 29 - lf, 3.2, ARMOR);
  grid.limb(cx + 18, 24 - lf, 3.4, cx + 17, 29 - lf, 3.2, ARMOR);
  grid.limb(cx - 17, 29 - lf, 3, cx - 5, 30 - lf, 2.6, ARMOR);
  grid.limb(cx + 17, 29 - lf, 3, cx + 5, 30 - lf, 2.6, ARMOR);
  grid.ell(cx - 4, 30 - lf, 3.2, 3.2, IRON);
  grid.ell(cx + 4, 30 - lf, 3.2, 3.2, IRON);
  for (const x of [-6, -4, -2, 2, 4, 6]) grid.set(cx + x, 33 - lf, BONE.base);

  // head, slightly lowered: horns sweeping out, crown aflame, eyes burning
  const hy = 10 - lf + 1;
  grid.ell(cx, hy, 7.8, 7, ARMOR);
  grid.rect(cx - 6, hy, cx + 6, hy + 4, VOID);
  grid.row(hy - 1, cx - 7, cx + 7, IRON.hi);
  grid.row(hy, cx - 7, cx - 1, ARMOR.dk);
  grid.row(hy, cx + 1, cx + 7, ARMOR.dk);
  grid.row(hy + 1, cx - 6, cx - 4, GLOW);
  grid.row(hy + 2, cx - 4, cx - 2, GLOW);
  grid.row(hy + 1, cx + 4, cx + 6, GLOW);
  grid.row(hy + 2, cx + 2, cx + 4, GLOW);
  grid.set(cx - 3, hy + 2, flick ? GLOW_HI : EMBER);
  grid.set(cx + 3, hy + 2, flick ? GLOW_HI : EMBER);
  grid.rect(cx - 3, hy + 3, cx + 3, hy + 4, "#2a0610");
  for (let x = cx - 3; x <= cx + 3; x += 3) grid.set(x, hy + 4, BONE.hi);
  grid.horn(
    [
      [cx - 6, hy - 4],
      [cx - 12, hy - 6],
      [cx - 16, hy - 12],
      [cx - 15, hy - 18],
    ],
    2.8,
    IRON,
  );
  grid.horn(
    [
      [cx + 6, hy - 4],
      [cx + 12, hy - 6],
      [cx + 16, hy - 12],
      [cx + 15, hy - 18],
    ],
    2.8,
    IRON,
  );
  grid.rect(cx - 5, hy - 8, cx + 5, hy - 6, IRON.base);
  grid.row(hy - 8, cx - 5, cx + 5, IRON.hi);
  grid.set(cx, hy - 7, GEM_HI);
  grid.flame(cx - 4, hy - 9, 5, flick ? 1 : -1);
  grid.flame(cx, hy - 9, 8, flick ? -1 : 1);
  grid.flame(cx + 4, hy - 9, 5, flick ? 1 : -1);
};

/** the throne, front view, built from slate obsidian, bone skulls, red banners and gems */
const drawThrone = (grid: Grid) => {
  const cx = 40;
  const mirrorTri = (pa: number[], pb: number[], pc: number[], color: string) => {
    grid.tri(pa, pb, pc, color);
    grid.tri([2 * cx - pa[0], pa[1]], [2 * cx - pb[0], pb[1]], [2 * cx - pc[0], pc[1]], color);
  };
  const both = (fn: (sx: number) => void) => {
    fn(-1);
    fn(1);
  };
  const skull = (sx: number, sy: number, rad: number) => {
    grid.ell(sx, sy, rad, rad * 0.9, BONE);
    grid.rect(sx - rad + 2, sy + rad * 0.55, sx + rad - 2, sy + rad * 0.9 + 1, BONE.sh);
    grid.rect(sx - rad * 0.7, sy - 1, sx - 1, sy + 1, VOID);
    grid.rect(sx + 1, sy - 1, sx + rad * 0.7, sy + 1, VOID);
    grid.set(sx - 1, sy, GEM);
    grid.set(sx + 1, sy, GEM);
  };

  // dais: two wide steps with red-lit risers
  grid.rect(2, 83, 77, 87, STONE.base);
  grid.rect(2, 83, 77, 83, STONE.hi);
  grid.rect(2, 87, 77, 87, STONE.sh);
  for (let x = 6; x <= 74; x += 8) grid.rect(x, 85, x + 3, 86, STONE.sh);
  grid.rect(8, 76, 71, 82, STONE.base);
  grid.rect(8, 76, 71, 76, STONE.hi);
  grid.rect(8, 82, 71, 82, STONE.sh);
  for (let x = 12; x <= 66; x += 6) {
    grid.rect(x, 78, x + 2, 81, STONE.sh);
    grid.set(x + 1, 79, GEM);
  }

  // banners hanging behind the back, ends cut into points
  both((sx) => {
    const bx = cx + sx * 33;
    grid.rect(bx - 3, 14, bx + 3, 52, TRIM);
    grid.rect(bx - 3, 14, bx - 2, 52, CAPE_HI);
    grid.rect(bx + 3, 14, bx + 3, 52, TRIM_SH);
    grid.tri([bx - 3, 52], [bx + 3, 52], [bx, 59], TRIM);
    grid.line(bx, 20, bx, 46, GOLD_SH);
    grid.set(bx, 31, GOLD);
    grid.set(bx - 1, 30, GOLD);
    grid.set(bx + 1, 30, GOLD);
  });

  // the tall spiked back
  grid.rect(16, 18, 64, 76, STONE.base);
  grid.rect(16, 18, 20, 76, STONE.hi);
  grid.rect(60, 18, 64, 76, STONE.sh);
  grid.rect(23, 24, 57, 76, STONE.dk);
  grid.rect(25, 26, 55, 76, "#2a1020");
  for (let y = 30; y < 76; y += 9) {
    grid.rect(25, y, 55, y, "#3d1428");
    grid.set(27, y, GEM);
    grid.set(53, y, GEM);
  }
  // shoulder spires and the stepped crest
  mirrorTri([12, 22], [8, 4], [22, 18], STONE.base);
  mirrorTri([20, 20], [20, 1], [28, 16], STONE.base);
  grid.line(8, 5, 12, 21, STONE.hi);
  grid.line(72, 5, 68, 21, STONE.sh);
  grid.line(20, 2, 20, 18, STONE.hi);
  grid.line(60, 2, 60, 18, STONE.sh);
  grid.set(8, 4, GEM_HI);
  grid.set(72, 4, GEM_HI);
  grid.set(20, 1, GEM_HI);
  grid.set(60, 1, GEM_HI);
  grid.rect(28, 12, 52, 24, STONE.base);
  grid.rect(28, 12, 52, 12, STONE.hi);
  // curved bone horns flanking the skull crest
  both((sx) => {
    grid.horn(
      [
        [cx + sx * 8, 15],
        [cx + sx * 15, 11],
        [cx + sx * 19, 5],
        [cx + sx * 17, 0],
      ],
      2.6,
      BONE,
      GEM_HI,
    );
  });
  // skull crest
  skull(cx, 10, 8);
  grid.rect(cx - 2, 17, cx + 2, 19, BONE.sh);
  grid.set(cx, 14, GEM_SH);
  // inlaid runes and gems on the crest band
  both((sx) => {
    grid.rect(cx + sx * 12, 14, cx + sx * 12 + 1, 17, GEM);
    grid.set(cx + sx * 12, 14, GEM_HI);
    grid.set(cx + sx * 20, 16, GEM);
    grid.line(cx + sx * 21, 28, cx + sx * 21, 44, TRIM);
    grid.set(cx + sx * 21, 36, GEM_HI);
  });

  // seat block with a crimson cushion edge
  grid.rect(20, 62, 60, 76, STONE.base);
  grid.rect(20, 62, 60, 63, STONE.hi);
  grid.rect(20, 64, 60, 65, TRIM);
  grid.rect(20, 66, 60, 66, TRIM_SH);
  grid.rect(20, 70, 60, 76, STONE.sh);
  for (let x = 23; x <= 57; x += 6) grid.rect(x, 71, x + 2, 75, STONE.dk);

  // skull armrests on blocky pillars
  both((sx) => {
    const ax = cx + sx * 27;
    grid.rect(ax - 6, 56, ax + 6, 76, STONE.base);
    grid.rect(ax - 6, 56, ax + 6, 58, STONE.hi);
    grid.rect(ax + (sx > 0 ? 3 : -6), 58, ax + (sx > 0 ? 6 : -3), 76, STONE.sh);
    grid.rect(ax - 2, 66, ax + 2, 70, STONE.dk);
    grid.set(ax, 68, GEM);
    skull(ax, 52, 5);
  });
};

const hurtTone = (color: string): string => {
  if (luma(color) < 40) return color;
  return lighten(mix(color, "#ff6a5a", 0.35), 0.35);
};

const cache = new Map<string, HTMLCanvasElement>();
const wrap = (frame: number, count: number): number => {
  const raw = Math.floor(Number.isFinite(frame) ? frame : 0);
  return ((raw % count) + count) % count;
};
const cached = (key: string, build: () => HTMLCanvasElement): HTMLCanvasElement => {
  const known = cache.get(key);
  if (known) return known;
  const canvas = build();
  cache.set(key, canvas);
  return canvas;
};

/** the standing Dungeon Lord, facing left; `hurt` is the opaque lighter flash palette (outline stays dark) */
export const lordSprite = (frame: number, hurt = false): HTMLCanvasElement => {
  const index = wrap(frame, LORD_FRAMES);
  return cached(`lord|${index}|${hurt ? 1 : 0}`, () => {
    const grid = new Grid(LORD_W, LORD_H);
    grid.dx = 2; // keeps claws, cape and horns off the outline columns
    grid.dy = 3;
    drawLord(grid, index);
    grid.outline();
    if (hurt) grid.recolorFill(hurtTone);
    return grid.toCanvas();
  });
};

/** the Lord seated, no throne: front view, 2 frames (eye glow and flame flicker); bottom-centre anchored */
export const lordSeatedSprite = (frame: number): HTMLCanvasElement => {
  const index = wrap(frame, LORD_SEATED_FRAMES);
  return cached(`seat|${index}`, () => {
    const grid = new Grid(LORD_SEATED_W, LORD_SEATED_H);
    grid.dx = 2;
    grid.dy = LORD_SEATED_H - 52;
    drawSeated(grid, index, 0);
    grid.outline();
    return grid.toCanvas();
  });
};

/** the Lord pushing himself up out of the seat: frame 0 half up, frame 1 nearly standing; same anchor as seated */
export const lordRiseSprite = (frame: number): HTMLCanvasElement => {
  const index = wrap(frame, LORD_RISE_FRAMES);
  return cached(`rise|${index}`, () => {
    const grid = new Grid(LORD_RISE_W, LORD_RISE_H);
    grid.dx = 2;
    grid.dy = LORD_RISE_H - 52;
    drawSeated(grid, index, index === 0 ? 4 : 8);
    grid.outline();
    return grid.toCanvas();
  });
};

/** the empty throne (THRONE_W x THRONE_H); seat the Lord with THRONE_SEAT_DX / THRONE_SEAT_DY */
export const throneSprite = (): HTMLCanvasElement =>
  cached("throne", () => {
    const grid = new Grid(THRONE_W, THRONE_H);
    grid.dy = 2; // keeps the horns and spires off the outline row
    drawThrone(grid);
    grid.outline();
    return grid.toCanvas();
  });
