// Hand-built boss sprites: a hulking OGRE, a winged DRAGON and a robed LICH. Each is a 32x32 pixel drawing facing
// LEFT with its feet on the bottom row, four idle/menace frames, and an opaque "hurt" variant (a lighter palette,
// never a translucent overlay). Sprites are built once and cached; nothing here is translucent.

import { WORLD_W } from "./layout";
import type { BossKind } from "./palette";
import { Grid as BaseGrid, INK, lighten, luma, mix } from "./sprites";

export const BOSS_W = 32;
export const BOSS_H = 32;
export const BOSS_FRAMES = 4;
/** the boss is drawn centred this many px right of its fight spot, leaving a clear gap from the adventurer */
export const BOSS_DX = 12;

const WHITE_HI = "#ffffff";
const BONE = "#efe6c8",
  BONE_SH = "#b8a982",
  STEEL = "#aab6c6",
  STEEL_HI = "#e6edf7",
  STEEL_SH = "#5d6879";

interface Ramp {
  base: string;
  hi: string;
  sh: string;
  dk: string;
}

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
  line(x0: number, y0: number, x1: number, y1: number, color: string) {
    const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
    for (let i = 0; i <= steps; i++) this.set(x0 + ((x1 - x0) * i) / steps, y0 + ((y1 - y0) * i) / steps, color);
  }
  /** a limb: shaded blobs along a segment, radius easing from r0 to r1 */
  limb(x0: number, y0: number, r0: number, x1: number, y1: number, r1: number, ramp: Ramp) {
    const steps = Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)));
    for (let i = 0; i <= steps; i++) {
      const ratio = steps ? i / steps : 0;
      const radius = r0 + (r1 - r0) * ratio;
      this.ell(x0 + (x1 - x0) * ratio, y0 + (y1 - y0) * ratio, radius, radius, ramp);
    }
  }
  /** paint another grid's filled cells on top of this one */
  stamp(other: Grid) {
    other.cells.forEach((color, at) => {
      if (color) this.cells[at] = color;
    });
  }
  /** first filled row from the top in column x (or -1) */
  top(x: number): number {
    for (let y = 0; y < this.height; y++) if (this.get(x, y)) return y;
    return -1;
  }
}

// ---------------------------------------------------------------- ogre
const OGRE_SKIN: Ramp = { base: "#6f9d4a", hi: "#9fcd6e", sh: "#4a7339", dk: "#335229" };
const WOOD: Ramp = { base: "#8b5e3c", hi: "#b4825a", sh: "#5f3d26", dk: "#432a1a" };
const LEATHER: Ramp = { base: "#6b4328", hi: "#8d5f3a", sh: "#4a2d1a", dk: "#33200f" };
const CLOTH: Ramp = { base: "#9a5a3a", hi: "#c07a52", sh: "#6e3d28", dk: "#4a2918" };

const drawOgre = (grid: Grid, frame: number) => {
  const breathe = [0, 0, 1, 1][frame];
  const sway = [0, 1, 2, 1][frame];
  const lift = breathe;
  // iron-banded spiked club, held up on the right (behind the body)
  const headX = 24 + sway;
  grid.limb(24, 25, 1, headX, 9, 1.2, WOOD);
  grid.ell(headX, 6, 3.6, 5, WOOD);
  for (let y = 1; y <= 11; y++)
    for (let x = headX - 5; x <= headX + 5; x++)
      if (grid.get(x, y) && (y === 3 || y === 8))
        grid.set(x, y, x < headX ? STEEL_HI : x > headX + 1 ? STEEL_SH : STEEL);
  for (const [dx, dy] of [
    [-4, 4],
    [-4, 9],
    [4, 4],
    [4, 9],
    [-3, 1],
    [3, 1],
  ])
    grid.set(headX + dx, dy, STEEL_HI);
  grid.set(headX, 1, STEEL_HI);
  grid.set(headX, 0, STEEL);
  // legs
  grid.rect(8, 24, 13, 29, OGRE_SKIN.base);
  grid.rect(8, 24, 9, 29, OGRE_SKIN.hi);
  grid.rect(12, 24, 13, 29, OGRE_SKIN.sh);
  grid.rect(16, 24, 21, 29, OGRE_SKIN.base);
  grid.rect(16, 24, 17, 29, OGRE_SKIN.hi);
  grid.rect(20, 24, 21, 29, OGRE_SKIN.sh);
  grid.rect(5, 30, 13, 31, OGRE_SKIN.sh);
  grid.rect(5, 30, 10, 30, OGRE_SKIN.base);
  grid.rect(15, 30, 23, 31, OGRE_SKIN.sh);
  grid.rect(15, 30, 20, 30, OGRE_SKIN.base);
  for (const x of [6, 8, 16, 18]) grid.set(x, 31, BONE);
  // back hump + torso
  grid.ell(19, 12 + lift, 7, 5, OGRE_SKIN);
  grid.ell(15, 19 + lift, 8.5, 7, OGRE_SKIN);
  grid.ell(14, 21 + lift, 5, 3.5, { ...OGRE_SKIN, base: OGRE_SKIN.hi, hi: "#b5de85" });
  // pecs, scars and warts
  grid.row(17 + lift, 11, 14, OGRE_SKIN.sh);
  grid.line(17, 15 + lift, 20, 20 + lift, "#a85a48");
  grid.set(20, 14 + lift, OGRE_SKIN.dk);
  grid.set(11, 24 + lift, OGRE_SKIN.sh);
  // shoulder spikes
  grid.tri([22, 8 + lift], [24, 3 + lift], [25, 10 + lift], BONE);
  grid.tri([18, 7 + lift], [19, 3 + lift], [21, 8 + lift], BONE);
  grid.line(24, 4 + lift, 24, 8 + lift, BONE_SH);
  // club arm: shoulder -> fist on the shaft
  grid.limb(22, 13 + lift, 2.4, 25, 21, 2, OGRE_SKIN);
  grid.ell(25, 22, 2.6, 2.4, OGRE_SKIN);
  grid.row(22, 23, 27, OGRE_SKIN.dk);
  // belt, skulls and loincloth
  grid.rect(9, 23 + lift, 22, 24 + lift, LEATHER.base);
  grid.row(23 + lift, 9, 22, LEATHER.hi);
  grid.row(24 + lift, 9, 22, LEATHER.sh);
  grid.rect(11, 22 + lift, 12, 24 + lift, BONE);
  grid.set(11, 23 + lift, INK);
  grid.set(12, 23 + lift, INK);
  grid.set(11, 22 + lift, WHITE_HI);
  grid.rect(18, 22 + lift, 19, 24 + lift, BONE);
  grid.set(18, 23 + lift, INK);
  grid.set(19, 23 + lift, INK);
  grid.set(18, 22 + lift, WHITE_HI);
  grid.rect(14, 23 + lift, 15, 24 + lift, "#d9b23a");
  grid.set(14, 23 + lift, "#fff0a0");
  for (let x = 10; x <= 21; x++) {
    const hem = 27 + (x % 3 === 0 ? 1 : 0) + (x % 4 === 1 ? 1 : 0);
    for (let y = 25 + lift; y <= hem; y++)
      grid.set(x, y, x < 13 ? CLOTH.hi : x > 18 ? CLOTH.sh : y > 26 ? CLOTH.sh : CLOTH.base);
  }
  grid.line(13, 26, 15, 27, CLOTH.dk);
  // front arm hangs to the left with a shackle and a chain
  grid.limb(11, 15 + lift, 2.6, 5, 24, 2.2, OGRE_SKIN);
  grid.ell(4.5, 26, 2.8, 2.6, OGRE_SKIN);
  grid.row(26, 3, 6, OGRE_SKIN.dk);
  grid.rect(3, 21, 8, 22, STEEL);
  grid.row(21, 3, 8, STEEL_HI);
  grid.row(22, 3, 8, STEEL_SH);
  grid.set(1, 22, STEEL);
  grid.set(1, 24, STEEL_SH);
  grid.set(0, 25, STEEL);
  grid.set(1, 27, STEEL_SH);
  grid.set(0, 29, STEEL);
  grid.set(2, 22, STEEL_SH);
  // head: forward-slung, low between the shoulders
  grid.ell(8, 11 + lift, 5.2, 4.6, OGRE_SKIN);
  grid.ell(7, 14 + lift, 4.2, 2.6, OGRE_SKIN);
  grid.tri([12, 8 + lift], [16, 3 + lift], [13, 11 + lift], OGRE_SKIN.base);
  grid.set(13, 8 + lift, "#c98a7a");
  grid.row(9 + lift, 3, 10, OGRE_SKIN.dk);
  grid.row(10 + lift, 4, 9, OGRE_SKIN.sh);
  // the single eye: yellow with a red slit pupil that burns brighter on the inhale
  grid.rect(5, 10 + lift, 7, 12 + lift, "#ffe45a");
  grid.set(6, 11 + lift, breathe ? "#ff2a1a" : "#c4181a");
  grid.set(6, 12 + lift, breathe ? "#ff2a1a" : "#c4181a");
  grid.set(5, 10 + lift, "#fff6b0");
  // the other eye is long gone: a ragged scar across it
  grid.line(11, 7 + lift, 8, 14 + lift, "#c0645a");
  grid.set(9, 11 + lift, OGRE_SKIN.dk);
  // mouth, teeth and tusks
  grid.row(15 + lift, 3, 9, OGRE_SKIN.dk);
  grid.set(5, 14 + lift, BONE);
  grid.set(8, 14 + lift, BONE);
  grid.line(3, 16 + lift, 2, 11 + lift, BONE);
  grid.line(4, 16 + lift, 3, 12 + lift, BONE_SH);
  grid.line(9, 16 + lift, 10, 12 + lift, BONE);
  grid.set(4, 12 + lift, OGRE_SKIN.dk);
};
// ---------------------------------------------------------------- dragon
const DRAGON: Ramp = { base: "#c23b2e", hi: "#f0704e", sh: "#85261f", dk: "#561814" };
const DRAGON_BELLY: Ramp = { base: "#f2c46a", hi: "#ffe39a", sh: "#d19a46", dk: "#a87530" };
const MEMBRANE = "#d9632f",
  MEMBRANE_HI = "#f2994c",
  WING_BONE = "#6e1d18",
  EYE_GLOW = "#ffe14a";
const FLAME_RED = "#e8421e",
  FLAME_ORANGE = "#ff9a2e",
  FLAME_YELLOW = "#ffe45a",
  FLAME_WHITE = "#fff7c4";

const WINGS = [
  {
    elbow: [21, 5],
    tips: [
      [24, 0],
      [31, 4],
      [30, 12],
    ],
  },
  {
    elbow: [22, 8],
    tips: [
      [27, 4],
      [31, 9],
      [30, 15],
    ],
  },
  {
    elbow: [22, 12],
    tips: [
      [28, 10],
      [31, 16],
      [28, 21],
    ],
  },
  {
    elbow: [22, 7],
    tips: [
      [26, 3],
      [31, 8],
      [30, 14],
    ],
  },
];

const drawDragon = (grid: Grid, frame: number) => {
  const body = new Grid(BOSS_W, BOSS_H);
  const jaw = [0, 0, 1, 2][frame];
  const curl = [0, 1, 0, -1][frame];
  // tail with a curl at the end
  body.limb(24, 23, 2.8, 27, 27, 2.3, DRAGON);
  body.limb(27, 27, 2.3, 30, 28, 1.8, DRAGON);
  body.limb(30, 28, 1.8, 31, 24 + curl, 1.2, DRAGON);
  body.limb(31, 24 + curl, 1.2, 29, 21 + curl, 0.8, DRAGON);
  // legs and claws
  body.limb(21, 24, 3.4, 22, 28, 1.7, DRAGON);
  body.rect(19, 29, 24, 31, DRAGON.sh);
  body.rect(19, 29, 22, 29, DRAGON.base);
  for (const x of [18, 20, 22]) body.set(x, 31, BONE);
  body.limb(13, 25, 2.6, 13, 28, 1.7, DRAGON);
  body.rect(9, 29, 15, 31, DRAGON.sh);
  body.rect(9, 29, 13, 29, DRAGON.base);
  for (const x of [8, 10, 12]) body.set(x, 31, BONE);
  // body, belly plates, neck
  body.ell(19, 21, 7.5, 6, DRAGON);
  body.ell(15, 24, 4.5, 3.5, DRAGON_BELLY);
  for (const y of [23, 25, 27]) body.row(y, 11, 18, DRAGON_BELLY.dk);
  body.limb(15, 16, 3.5, 13, 11, 3, DRAGON);
  body.ell(11.5, 13, 1.7, 4, DRAGON_BELLY);
  for (const y of [11, 13, 15]) body.row(y, 10, 12, DRAGON_BELLY.dk);
  // scale highlights
  for (let y = 9; y < 28; y++)
    for (let x = 9; x < 32; x++)
      if (body.get(x, y) === DRAGON.base) {
        const pat = (x + 2 * (y % 2)) % 4;
        if (pat === 0) body.set(x, y, DRAGON.hi);
        else if (pat === 2 && y % 3 === 0) body.set(x, y, DRAGON.sh);
      }
  // head: upper snout, jaw that drops while breathing fire
  body.ell(11, 8.5, 3.8, 3.2, DRAGON);
  body.ell(8, 9.5, 3.4, 2.2, DRAGON);
  body.rect(5, 11 + jaw, 11, 12 + jaw, DRAGON.sh);
  body.row(12 + jaw, 5, 11, DRAGON.dk);
  if (jaw) body.rect(6, 11, 10, 10 + jaw, "#4a0f0f");
  for (const x of [6, 8, 10]) body.set(x, 11 + jaw, BONE);
  for (const x of [7, 9]) body.set(x, 10, BONE);
  body.set(5, 9, DRAGON.dk);
  body.set(6, 9, DRAGON.dk);
  // glowing eye + angry brow
  body.rect(10, 8, 11, 8, EYE_GLOW);
  body.set(10, 8, WHITE_HI);
  body.set(11, 9, FLAME_ORANGE);
  body.row(7, 9, 12, DRAGON.dk);
  body.set(12, 6, DRAGON.dk);
  // swept-back horns + head frill
  body.line(12, 6, 14, 3, BONE);
  body.line(14, 3, 17, 1, BONE);
  body.line(13, 7, 16, 5, BONE_SH);
  body.line(16, 5, 19, 4, BONE_SH);
  body.set(14, 4, WHITE_HI);
  // spiny ridge along the back
  for (const [at, size] of [
    [12, 1],
    [14, 2],
    [16, 2],
    [18, 2],
    [21, 2],
    [24, 2],
    [26, 2],
    [27, 1],
  ]) {
    const top = body.top(at);
    if (top < 0) continue;
    for (let spike = 1; spike <= size; spike++) body.set(at, top - spike, spike === size ? BONE : BONE_SH);
  }
  // wing (behind everything)
  const wing = WINGS[frame];
  const root = [19, 15];
  const [tipA, tipB, tipC] = wing.tips;
  grid.tri(root, wing.elbow, tipA, MEMBRANE);
  grid.tri(root, tipA, tipB, MEMBRANE);
  grid.tri(root, tipB, tipC, MEMBRANE);
  grid.tri(root, tipA, [(tipA[0] + tipB[0]) / 2, (tipA[1] + tipB[1]) / 2], MEMBRANE_HI);
  for (const tip of [tipA, tipB, tipC]) grid.line(root[0], root[1], tip[0], tip[1], WING_BONE);
  grid.line(root[0], root[1], wing.elbow[0], wing.elbow[1], WING_BONE);
  grid.line(wing.elbow[0], wing.elbow[1], tipA[0], tipA[1], WING_BONE);
  grid.stamp(body);
  // fire breath: a rising glow at the mouth, then a full blast (all opaque pixels)
  if (frame === 2) {
    grid.set(4, 12, FLAME_ORANGE);
    grid.set(3, 13, FLAME_YELLOW);
    grid.set(4, 13, FLAME_RED);
    grid.set(2, 12, FLAME_RED);
  } else if (frame === 3) {
    grid.rect(2, 11, 4, 14, FLAME_RED);
    grid.rect(0, 12, 3, 14, FLAME_ORANGE);
    grid.rect(2, 12, 4, 13, FLAME_ORANGE);
    grid.rect(3, 12, 4, 13, FLAME_YELLOW);
    grid.set(4, 12, FLAME_WHITE);
    grid.set(4, 13, FLAME_WHITE);
    grid.set(1, 10, FLAME_RED);
    grid.set(2, 15, FLAME_RED);
    grid.set(0, 11, FLAME_ORANGE);
    grid.set(0, 15, FLAME_RED);
    grid.set(1, 16, FLAME_ORANGE);
  }
};

// ---------------------------------------------------------------- lich
const ROBE: Ramp = { base: "#4a2f7a", hi: "#7350b0", sh: "#2f1d52", dk: "#1c1132" };
const VOID = "#0b0814";
const GLOW = "#5ef0ff",
  GLOW_HI = "#d8fdff",
  GLOW_DIM = "#2a8aa8",
  ORB_VIOLET = "#b05cff",
  GOLD = "#d9b23a",
  GOLD_HI = "#fff0a0";

const drawLich = (grid: Grid, frame: number) => {
  const sway = [0, 1, 0, -1][frame];
  const pulse = [2.4, 3, 3.5, 3][frame];
  // staff with a pulsing skull orb (front, left)
  grid.rect(5, 9, 6, 31, WOOD.base);
  grid.rect(5, 9, 5, 31, WOOD.hi);
  grid.rect(6, 9, 6, 31, WOOD.sh);
  grid.ell(5.5, 5, pulse + 1, pulse + 1, { base: ORB_VIOLET, hi: GLOW_HI, sh: "#7a3ac8", dk: "#4a1f8a" });
  grid.ell(5.5, 5, pulse - 1, pulse - 1, { base: GLOW, hi: GLOW_HI, sh: GLOW, dk: GLOW_DIM });
  for (const [dx, dy] of [
    [-4, 2],
    [4, 2],
    [-4, 8],
    [4, 8],
  ])
    grid.set(5 + dx + (dx > 0 ? 1 : 0), 5 + dy - 5, BONE);
  grid.line(2, 8, 3, 4, BONE_SH);
  grid.line(9, 8, 8, 4, BONE_SH);
  // flowing robe, hem ragged and swaying
  for (let y = 12; y <= 30; y++) {
    const half = Math.min(10, 5 + (y - 12) * 0.5);
    for (let x = Math.ceil(17 - half); x <= Math.floor(17 + half); x++) {
      const edge = x - (17 - half);
      const fold = (x + sway * (y > 22 ? 1 : 0)) % 4 === 0;
      grid.set(x, y, edge < 2 ? ROBE.hi : edge > half * 2 - 2 ? ROBE.sh : fold ? ROBE.sh : ROBE.base);
    }
  }
  // clear ragged hem notches (cells cleared => outline reveals the ragged edge)
  for (let x = 7; x <= 27; x++) {
    const rag = (x * 7 + frame * 3) % 5;
    if (rag === 0) {
      grid.cells[31 * BOSS_W + x] = null;
      grid.cells[30 * BOSS_W + x] = null;
      grid.cells[29 * BOSS_W + x] = null;
    } else if (rag === 1) {
      grid.cells[30 * BOSS_W + x] = null;
    }
  }
  // wisps drifting below the hem
  grid.set(10 + sway, 31, ORB_VIOLET);
  grid.set(22 - sway, 31, GLOW_DIM);
  // open robe front: ribcage and phylactery
  grid.rect(14, 15, 20, 24, VOID);
  for (const y of [16, 18, 20, 22]) grid.row(y, 14, 20, BONE);
  grid.rect(17, 15, 17, 24, BONE_SH);
  grid.rect(16, 24, 18, 26, GOLD);
  grid.set(17, 25, frame % 2 ? "#ff5a6a" : "#c4182a");
  grid.set(16, 24, GOLD_HI);
  // pauldrons with bone spikes
  grid.ell(10, 14, 3.4, 2.6, ROBE);
  grid.ell(24, 14, 3.4, 2.6, ROBE);
  grid.tri([22, 12], [25, 6], [26, 13], BONE);
  grid.tri([8, 12], [9, 7], [11, 12], BONE);
  // casting hand on the right, with swirling spectral fire
  grid.limb(25, 15, 2, 28, 12, 1.4, ROBE);
  grid.ell(28, 11, 1.8, 1.8, { base: BONE, hi: WHITE_HI, sh: BONE_SH, dk: BONE_SH });
  grid.set(30, 10, BONE);
  grid.set(30, 12, BONE);
  const flame = [
    [28, 7],
    [27, 6],
    [29, 6],
    [28, 5],
  ];
  flame.forEach(([fx, fy], at) => {
    grid.set(fx, fy - ((frame + at) % 2), (frame + at) % 2 ? GLOW : ORB_VIOLET);
  });
  grid.set(28, 8, GLOW_HI);
  // staff hand
  grid.limb(11, 15, 2, 7, 18, 1.6, ROBE);
  grid.ell(6.5, 18, 1.8, 1.8, { base: BONE, hi: WHITE_HI, sh: BONE_SH, dk: BONE_SH });
  // hood, void face, skull jaw and crown
  grid.ell(17, 8, 6.2, 6, ROBE);
  grid.tri([13, 4], [17, 0], [21, 5], ROBE.base);
  grid.ell(15, 9, 3.6, 4, { base: VOID, hi: VOID, sh: VOID, dk: VOID });
  grid.rect(12, 9, 13, 10, GLOW_DIM);
  grid.rect(15, 9, 16, 10, GLOW_DIM);
  grid.rect(12, 8, 13, 9, GLOW);
  grid.rect(15, 8, 16, 9, GLOW);
  grid.set(12, 8, GLOW_HI);
  grid.set(15, 8, GLOW_HI);
  if (frame === 3) {
    grid.set(12, 10, GLOW);
    grid.set(16, 10, GLOW);
  }
  grid.row(12, 12, 16, BONE);
  grid.row(13, 12, 16, VOID);
  for (const x of [13, 15]) grid.set(x, 13, BONE);
  for (const [cx, height] of [
    [13, 2],
    [15, 3],
    [17, 2],
    [19, 3],
  ])
    for (let spike = 0; spike < height; spike++) grid.set(cx, 3 - spike + 1, spike === height - 1 ? GOLD_HI : GOLD);
  grid.row(4, 13, 19, GOLD);
};

const build = (kind: BossKind, frame: number, hurt: boolean): HTMLCanvasElement => {
  const grid = new Grid(BOSS_W, BOSS_H);
  if (kind === "dragon") drawDragon(grid, frame);
  else if (kind === "lich") drawLich(grid, frame);
  else drawOgre(grid, frame);
  grid.outline();
  // hurt: a fully opaque, lighter and warmer palette (the outline stays dark so the silhouette holds)
  if (hurt) grid.recolorFill((color) => (luma(color) < 40 ? color : lighten(mix(color, "#ff6a5a", 0.3), 0.28)));
  return grid.toCanvas();
};

const cache = new Map<string, HTMLCanvasElement>();

/** Boss sprite (32x32), facing LEFT, feet on the bottom row. hurt=true is an opaque lighter variant. */
export const bossSprite = (kind: BossKind, frame: number, hurt: boolean): HTMLCanvasElement => {
  const known: BossKind = kind === "dragon" || kind === "lich" ? kind : "ogre";
  const whole = Number.isFinite(frame) ? Math.floor(frame) : 0;
  const frameIdx = ((whole % BOSS_FRAMES) + BOSS_FRAMES) % BOSS_FRAMES;
  const key = `${known}|${frameIdx}|${hurt ? 1 : 0}`;
  let sprite = cache.get(key);
  if (!sprite) {
    sprite = build(known, frameIdx, hurt);
    cache.set(key, sprite);
  }
  return sprite;
};

/** where a boss standing at `posX` is drawn (its centre): offset from the fight spot, never past the world edge */
export const bossCenterX = (posX: number): number => Math.min(posX + BOSS_DX, WORLD_W - BOSS_W / 2);
