import type { MonsterKind } from "./palette";
import { Grid, lighten, luma, mix } from "./sprites";

/**
 * Regular monsters: 20x20 canvases, facing LEFT (toward the adventurer), feet on the last content row (18) with
 * the 1px outline on row 19. Four idle frames each (0..3) plus an opaque, whiter "hurt" variant.
 */
export const MON_W = 20;
export const MON_H = 20;
export const MON_FRAMES = 4;
/** last painted row of the creature itself (the outline lands one row below) */
const GROUND = 18;

const cache = new Map<string, HTMLCanvasElement>();

const EYE_DK = "#1c1230";
const TOOTH = "#fff8e8";
const TOOTH_SH = "#d8cdb0";
const RED_EYE = "#ff4a4a";
const RED_GLOW = "#ffb0a0";

type Pt = [number, number];

/** shaded ellipse: pick(light, edge) gets light in [-1,1] (up-left is bright) and edge in [0,1] (1 = rim) */
const blob = (
  grid: Grid,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  pick: (light: number, edge: number) => string | null,
  maxY = Infinity,
) => {
  for (let y = Math.floor(cy - ry); y <= Math.min(maxY, Math.ceil(cy + ry)); y++) {
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      const nx = (x + 0.5 - cx) / rx,
        ny = (y + 0.5 - cy) / ry;
      const edge = nx * nx + ny * ny;
      if (edge > 1) continue;
      const color = pick(-(nx * 0.6 + ny * 0.8), edge);
      if (color) grid.set(x, y, color);
    }
  }
};

const edgeFn = (ax: number, ay: number, bx: number, by: number, px: number, py: number) =>
  (px - bx) * (ay - by) - (ax - bx) * (py - by);
const tri = (grid: Grid, vertA: Pt, vertB: Pt, vertC: Pt, color: string) => {
  const minX = Math.floor(Math.min(vertA[0], vertB[0], vertC[0])),
    maxX = Math.ceil(Math.max(vertA[0], vertB[0], vertC[0]));
  const minY = Math.floor(Math.min(vertA[1], vertB[1], vertC[1])),
    maxY = Math.ceil(Math.max(vertA[1], vertB[1], vertC[1]));
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const px = x + 0.5,
        py = y + 0.5;
      const e1 = edgeFn(vertA[0], vertA[1], vertB[0], vertB[1], px, py),
        e2 = edgeFn(vertB[0], vertB[1], vertC[0], vertC[1], px, py),
        e3 = edgeFn(vertC[0], vertC[1], vertA[0], vertA[1], px, py);
      const neg = e1 < 0 || e2 < 0 || e3 < 0,
        pos = e1 > 0 || e2 > 0 || e3 > 0;
      if (!(neg && pos)) grid.set(x, y, color);
    }
  }
};
const line = (grid: Grid, x0: number, y0: number, x1: number, y1: number, color: string) => {
  const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
  for (let i = 0; i <= steps; i++)
    grid.set(Math.round(x0 + ((x1 - x0) * i) / steps), Math.round(y0 + ((y1 - y0) * i) / steps), color);
};

/** an angry eye: white block with a slanted brow cut across the inner top corner and a pupil looking left */
const angryEye = (
  grid: Grid,
  x0: number,
  y0: number,
  leftSide: boolean,
  white: string,
  pupil: string,
  brow: string,
) => {
  grid.rect(x0, y0, x0 + 2, y0 + 1, white);
  if (leftSide) {
    grid.set(x0, y0 - 1, brow);
    grid.set(x0 + 1, y0 - 1, brow);
    grid.set(x0 + 2, y0, brow);
    grid.set(x0 + 1, y0, brow);
  } else {
    grid.set(x0 + 2, y0 - 1, brow);
    grid.set(x0 + 1, y0 - 1, brow);
    grid.set(x0, y0, brow);
    grid.set(x0 + 1, y0, brow);
  }
  grid.set(x0, y0 + 1, pupil);
  if (leftSide) grid.set(x0, y0, pupil);
};

// ---------------------------------------------------------------- slime
/** [width, height, lift]: rest, squash, stretch (airborne), settle */
const SLIME_SHAPE: Array<[number, number, number]> = [
  [17, 11, 0],
  [19, 9, 0],
  [15, 14, 2],
  [18, 10, 0],
];
const drawSlime = (grid: Grid, frame: number) => {
  const light = "#b8ffc4",
    base = "#5fd070",
    mid = "#3aa85a",
    shade = "#257a48",
    deep = "#17583a";
  const [width, height, lift] = SLIME_SHAPE[frame];
  const radX = width / 2,
    radY = height / 2;
  const bottom = GROUND - lift,
    top = bottom - height + 1;
  const cx = 9.5,
    cy = top + radY;
  blob(grid, cx, cy, radX, radY, (lit, edge) => {
    if (edge > 0.72 && lit < -0.1) return edge > 0.9 ? deep : shade;
    if (lit > 0.72) return light;
    if (lit > 0.18) return base;
    if (lit > -0.38) return mid;
    return shade;
  });
  grid.row(bottom, Math.round(cx - radX * 0.55), Math.round(cx + radX * 0.55), deep);
  // glossy highlight
  const hx = Math.round(cx - radX * 0.55);
  grid.row(top + 2, hx, hx + 2, "#ffffff");
  grid.set(hx - 1, top + 3, "#ffffff");
  grid.set(hx - 1, top + 4, light);
  grid.set(hx + 4, top + 1, light);
  // skull floating inside (right-lower)
  const sy = bottom - 5;
  grid.rect(12, sy, 15, sy + 2, "#d8f0d0");
  grid.row(sy + 3, 13, 14, "#a8c8a8");
  grid.set(12, sy, "#ffffff");
  grid.set(13, sy + 1, EYE_DK);
  grid.set(15, sy + 1, EYE_DK);
  grid.set(14, sy + 2, "#a8c8a8");
  // angry eyes and a toothy grin
  const ey = top + 3;
  angryEye(grid, 5, ey, true, "#ffffff", EYE_DK, deep);
  angryEye(grid, 9, ey, false, "#ffffff", EYE_DK, deep);
  const my = ey + 3;
  grid.row(my, 5, 11, deep);
  grid.row(my + 1, 6, 10, deep);
  for (const x of [6, 8, 10]) grid.set(x, my, TOOTH);
  grid.set(7, my + 1, TOOTH);
  grid.set(9, my + 1, TOOTH);
};

// ---------------------------------------------------------------- goblin
const drawGoblin = (grid: Grid, frame: number) => {
  const skin = "#78b84c",
    skinHi = "#a4dc70",
    skinSh = "#4c8a38",
    skinDk = "#33672c";
  const leather = "#8a5a36",
    leatherHi = "#b07c4c",
    leatherSh = "#5a3a24";
  const earPink = "#e08a7a";
  const bob = [0, 1, 1, 0][frame];
  const earFlick = frame === 2 ? 1 : 0;
  const stab = [0, 0, -1, 1][frame];
  // legs + boots (static)
  grid.rect(6, 15, 7, 16, skinSh);
  grid.rect(12, 15, 13, 16, skinSh);
  grid.rect(4, 17, 8, 18, leatherSh);
  grid.rect(10, 17, 14, 18, leatherSh);
  grid.row(17, 4, 7, leather);
  grid.row(17, 10, 13, leather);
  grid.dy = bob;
  // hunched torso
  grid.rect(6, 10, 14, 15, skin);
  grid.rect(12, 10, 14, 15, skinSh);
  grid.rect(6, 11, 13, 15, leather);
  grid.rect(12, 11, 13, 15, leatherSh);
  // leather chest scraps: strap, studs, belt + buckle
  for (let i = 0; i < 5; i++) grid.set(7 + i, 11 + i, leatherHi);
  grid.set(7, 12, leatherHi);
  grid.set(11, 12, "#d8d0c0");
  grid.set(9, 14, "#d8d0c0");
  grid.row(15, 6, 13, "#3a2618");
  grid.set(9, 15, "#e8c04e");
  grid.set(10, 15, "#e8c04e");
  grid.set(6, 14, skin);
  // spiked shoulder pad on the back
  grid.rect(12, 9, 14, 10, leatherSh);
  grid.set(13, 8, "#c9d3e0");
  grid.set(14, 8, "#c9d3e0");
  grid.set(13, 7, "#eef3fa");
  grid.set(15, 9, "#c9d3e0");
  // back arm
  grid.rect(15, 11, 15, 14, skinSh);
  grid.set(15, 15, skinDk);
  // head: big, thrust forward-left
  grid.rect(3, 4, 11, 9, skin);
  grid.row(3, 4, 10, skin);
  grid.row(10, 4, 10, skin);
  grid.row(3, 4, 8, skinHi);
  grid.row(4, 4, 6, skinHi);
  grid.rect(10, 4, 11, 9, skinSh);
  grid.row(10, 5, 10, skinSh);
  // big pointy ears (front/back), the front one twitches
  const ex = earFlick;
  grid.row(5, 1 + ex, 3, skin);
  grid.row(4, 0 + ex, 2, skin);
  grid.row(3, 0 + ex, 1, skin);
  grid.row(6, 2, 3, skin);
  grid.set(2, 5, earPink);
  grid.set(1, 4, earPink);
  grid.row(5, 11, 13, skinSh);
  grid.row(4, 13, 15, skinSh);
  grid.row(3, 15, 17, skinSh);
  grid.row(6, 11, 12, skinSh);
  grid.set(13, 5, earPink);
  grid.set(15, 4, earPink);
  // big hooked nose
  grid.rect(1, 7, 3, 8, skinHi);
  grid.set(1, 8, skinSh);
  grid.set(0, 8, skinSh);
  // glaring yellow eyes under heavy brows
  grid.set(4, 6, "#ffe14a");
  grid.set(5, 6, "#ffe14a");
  grid.set(4, 7, EYE_DK);
  grid.set(7, 6, "#ffe14a");
  grid.set(8, 6, "#ffe14a");
  grid.set(7, 7, EYE_DK);
  grid.set(4, 5, skinDk);
  grid.set(5, 5, skinDk);
  grid.set(6, 6, skinDk);
  grid.set(9, 5, skinDk);
  grid.set(8, 5, skinDk);
  grid.set(7, 5, skinDk);
  grid.set(6, 5, skinDk);
  // snarling mouth with tusks
  grid.row(9, 4, 9, "#4a1428");
  grid.set(4, 8, TOOTH);
  grid.set(6, 8, TOOTH);
  grid.set(9, 8, TOOTH);
  grid.set(5, 10, TOOTH);
  grid.set(8, 10, TOOTH);
  grid.set(3, 9, TOOTH_SH);
  grid.dy = 0;
  // front arm thrusting a rusty dagger left
  const dag = stab;
  grid.rect(5, 12, 6, 13, skin);
  grid.rect(3, 13 + bob, 5, 14 + bob, skin);
  grid.row(14 + bob + dag, 0, 2, "#a89a88");
  grid.row(13 + bob + dag, 0, 1, "#d8cdb8");
  grid.set(1, 14 + bob + dag, "#b0623a");
  grid.set(0, 14 + bob + dag, "#8a4a2c");
  grid.rect(3, 12 + bob + dag, 3, 15 + bob + dag, "#5a3a24");
  grid.set(2, 14 + bob + dag, "#7a4a2c");
};

// ---------------------------------------------------------------- bat
type WingPose = { wrist: Pt; tips: [Pt, Pt, Pt] };
const WINGS: WingPose[] = [
  {
    wrist: [3, 2],
    tips: [
      [0, 0],
      [0, 5],
      [3, 9],
    ],
  },
  {
    wrist: [2, 6],
    tips: [
      [0, 4],
      [0, 9],
      [3, 12],
    ],
  },
  {
    wrist: [2, 11],
    tips: [
      [0, 13],
      [2, 18],
      [6, 16],
    ],
  },
  {
    wrist: [2, 7],
    tips: [
      [0, 6],
      [0, 11],
      [3, 14],
    ],
  },
];
const BAT_BOB = [1, 0, -1, 0];
const drawBat = (grid: Grid, frame: number) => {
  const mem = "#7a3f9c",
    memHi = "#9a5cc0",
    memSh = "#522a78",
    bone = "#321a52";
  const fur = "#5a3a86",
    furHi = "#8a64b8",
    furSh = "#3a2260";
  const pose = WINGS[frame];
  grid.dy = BAT_BOB[frame];
  const shoulder: Pt = [7, 9],
    back: Pt = [8, 14];
  const mirror = (pt: Pt): Pt => [19 - pt[0], pt[1]];
  for (const flip of [false, true]) {
    const map = (pt: Pt): Pt => (flip ? mirror(pt) : pt);
    const sh = map(shoulder),
      wr = map(pose.wrist),
      tips = pose.tips.map(map),
      bk = map(back);
    const color = flip ? mem : memHi;
    tri(grid, sh, wr, tips[0], color);
    tri(grid, sh, tips[0], tips[1], mem);
    tri(grid, sh, tips[1], tips[2], memSh);
    tri(grid, sh, tips[2], bk, mem);
    // membrane veins
    line(grid, sh[0], sh[1], wr[0], wr[1], bone);
    for (const tip of tips) line(grid, wr[0], wr[1], tip[0], tip[1], bone);
    line(grid, sh[0], sh[1], tips[1][0], tips[1][1], memSh);
    grid.set(tips[0][0], tips[0][1], bone);
  }
  // body, head, ears
  blob(grid, 9.5, 11, 3, 4, (lit) => (lit > 0.3 ? furHi : lit > -0.4 ? fur : furSh));
  blob(grid, 9.5, 7, 3.4, 3, (lit) => (lit > 0.35 ? furHi : lit > -0.45 ? fur : furSh));
  tri(grid, [6, 6], [6, 1], [8, 4], fur);
  tri(grid, [13, 6], [13, 1], [11, 4], furSh);
  grid.set(6, 3, "#e08aa8");
  grid.set(7, 4, "#e08aa8");
  // red eyes, snout, fangs
  grid.set(7, 6, RED_EYE);
  grid.set(8, 6, RED_GLOW);
  grid.set(11, 6, RED_EYE);
  grid.set(7, 5, bone);
  grid.set(8, 5, bone);
  grid.set(11, 5, bone);
  grid.set(12, 5, bone);
  grid.row(8, 8, 11, "#2a0f2a");
  grid.set(8, 9, TOOTH);
  grid.set(11, 9, TOOTH);
  grid.set(9, 8, TOOTH);
  grid.set(10, 8, TOOTH);
  // belly + little claws
  grid.row(12, 8, 11, furHi);
  grid.set(8, 15, bone);
  grid.set(11, 15, bone);
  grid.set(8, 16, TOOTH_SH);
  grid.set(11, 16, TOOTH_SH);
  grid.dy = 0;
};

// ---------------------------------------------------------------- skeleton
const drawSkeleton = (grid: Grid, frame: number) => {
  const bone = "#f2ecd8",
    boneSh = "#c4bca2",
    boneDk = "#8a8270";
  const iron = "#8d99ad",
    ironHi = "#c4cee0",
    ironSh = "#5c667a";
  const wood = "#8b5e3c",
    woodHi = "#b9814f",
    woodSh = "#5c3d28";
  const glow = "#59f0ff";
  const jig = [0, 1, 0, -1][frame],
    jaw = [0, 0, 1, 0][frame],
    sway = [0, 1, 1, 0][frame];
  // legs (planted)
  grid.rect(7, 14, 7, 17, bone);
  grid.rect(12, 14, 12, 17, bone);
  grid.set(8, 14, boneSh);
  grid.set(11, 14, boneSh);
  grid.row(18, 5, 8, boneSh);
  grid.row(18, 11, 14, boneSh);
  grid.row(17, 6, 7, bone);
  grid.row(17, 12, 13, bone);
  grid.set(7, 16, boneSh);
  grid.set(12, 16, boneSh);
  grid.dx = jig;
  grid.dy = sway;
  // pelvis, spine and ribs
  grid.row(14, 8, 11, boneSh);
  grid.row(13, 8, 11, bone);
  grid.rect(8, 9, 11, 12, bone);
  grid.rect(9, 9, 10, 13, boneSh);
  for (const y of [10, 12]) {
    grid.row(y, 8, 8, boneDk);
    grid.row(y, 11, 11, boneDk);
    grid.row(y, 9, 10, bone);
  }
  grid.row(11, 8, 11, boneSh);
  grid.set(11, 9, boneSh);
  // helmet skull
  grid.rect(6, 4, 13, 7, bone);
  grid.rect(7, 8, 12, 8, bone);
  grid.rect(12, 5, 13, 7, boneSh);
  // iron helmet: dome, brow band, nasal guard and crest
  grid.rect(6, 2, 13, 4, iron);
  grid.row(2, 7, 12, ironHi);
  grid.row(3, 6, 9, ironHi);
  grid.row(4, 6, 13, ironSh);
  grid.set(13, 3, ironSh);
  grid.rect(9, 0, 10, 1, "#c2434a");
  grid.set(9, 0, "#e8707a");
  grid.rect(6, 5, 6, 7, iron);
  grid.rect(13, 5, 13, 7, ironSh);
  grid.rect(8, 5, 8, 7, ironHi);
  // glowing eye sockets
  grid.rect(7, 5, 7, 6, EYE_DK);
  grid.rect(9, 5, 10, 6, EYE_DK);
  grid.set(7, 6, glow);
  grid.set(9, 6, glow);
  grid.set(10, 6, glow);
  grid.set(11, 7, EYE_DK);
  // jaw rattles
  grid.row(8 + jaw, 7, 12, boneSh);
  grid.set(8, 8 + jaw, EYE_DK);
  grid.set(10, 8 + jaw, EYE_DK);
  grid.set(11, 7, boneDk);
  if (jaw) grid.row(8, 8, 11, EYE_DK);
  // back arm (right) raising a notched sword
  grid.rect(13, 9, 14, 9, boneSh);
  grid.rect(14, 10, 14, 11, bone);
  grid.rect(16, 1, 17, 10, "#cfd6e2");
  grid.rect(17, 1, 17, 10, "#97a2b6");
  grid.set(16, 0, "#eef3fa");
  grid.set(17, 0, "#97a2b6");
  for (const y of [3, 6, 8]) grid.set(17, y, EYE_DK);
  grid.set(16, 5, EYE_DK);
  grid.row(11, 14, 18, "#e8c04e");
  grid.set(16, 12, woodSh);
  grid.set(17, 12, wood);
  grid.set(16, 13, woodSh);
  grid.set(15, 11, bone);
  // front arm (left) behind a cracked round shield
  grid.rect(7, 10, 7, 10, bone);
  grid.rect(0, 8, 6, 14, wood);
  grid.rect(1, 7, 5, 15, wood);
  grid.row(7, 1, 5, ironHi);
  grid.row(15, 1, 5, ironSh);
  grid.rect(0, 8, 0, 14, ironSh);
  grid.rect(6, 8, 6, 14, ironSh);
  grid.rect(1, 8, 2, 10, woodHi);
  grid.rect(3, 10, 4, 12, ironHi);
  grid.set(3, 11, "#ffffff");
  // crack
  line(grid, 2, 7, 3, 9, EYE_DK);
  line(grid, 3, 9, 2, 11, EYE_DK);
  line(grid, 2, 11, 4, 14, EYE_DK);
  grid.set(1, 12, woodSh);
  grid.dx = 0;
  grid.dy = 0;
};

// ---------------------------------------------------------------- mushroom
const SPORES: Pt[][] = [
  [
    [4, 1],
    [15, 3],
  ],
  [
    [3, 0],
    [16, 1],
    [10, 0],
  ],
  [
    [5, 0],
    [14, 0],
  ],
  [[2, 2]],
];
const drawMushroom = (grid: Grid, frame: number) => {
  const cap = "#d8363f",
    capHi = "#f56a72",
    capSh = "#a02030",
    capDk = "#6e1428";
  const stem = "#f6e8c8",
    stemSh = "#d2bd90",
    stemDk = "#a8926a";
  const spot = "#fff4d8";
  const squash = [0, 1, 1, 0][frame],
    wave = [0, 1, 0, -1][frame];
  // legs + stubby arms
  grid.rect(6, 15, 8, 18, stemSh);
  grid.rect(11, 15, 13, 18, stemSh);
  grid.row(18, 5, 8, stemDk);
  grid.row(18, 11, 14, stemDk);
  grid.rect(4, 11 + wave, 5, 12 + wave, stem);
  grid.set(3, 12 + wave, stemSh);
  grid.rect(14, 11 - wave, 15, 12 - wave, stemSh);
  grid.set(16, 12 - wave, stemDk);
  // body
  grid.rect(5, 8, 14, 15, stem);
  grid.rect(12, 8, 14, 15, stemSh);
  grid.row(15, 5, 14, stemSh);
  // face
  angryEye(grid, 6, 10, true, "#ffffff", RED_EYE, stemDk);
  angryEye(grid, 10, 10, false, "#ffffff", RED_EYE, stemDk);
  grid.row(13, 7, 12, "#5a1c2c");
  grid.set(7, 13, TOOTH);
  grid.set(9, 13, TOOTH);
  grid.set(11, 13, TOOTH);
  grid.set(8, 14, "#5a1c2c");
  grid.set(10, 14, "#5a1c2c");
  // cap
  grid.dy = squash;
  blob(
    grid,
    9.5,
    8.5,
    9.5,
    6.4,
    (lit, edge) => {
      if (edge > 0.75 && lit < -0.1) return capSh;
      return lit > 0.55 ? capHi : lit > -0.3 ? cap : capSh;
    },
    7,
  );
  grid.dy = 0;
  grid.dy = squash;
  grid.row(8, 1, 18, capDk);
  grid.row(8, 3, 16, capSh);
  grid.dy = 0;
  // spots
  grid.dy = squash;
  grid.rect(4, 3, 6, 5, spot);
  grid.set(4, 3, "#ffffff");
  grid.rect(10, 2, 12, 3, spot);
  grid.rect(14, 5, 16, 6, spot);
  grid.set(9, 6, spot);
  grid.set(8, 6, spot);
  grid.set(2, 6, spot);
  grid.dy = 0;
};
const drawSpores = (grid: Grid, frame: number) => {
  for (const [x, y] of SPORES[frame]) {
    grid.set(x, y, "#e0f070");
    grid.set(x + 1, y, "#9ac040");
  }
};

// ---------------------------------------------------------------- assembly
const hurtTone = (color: string): string =>
  luma(color) < 55 ? mix(color, "#ffffff", 0.2) : lighten(mix(color, "#ff6a6a", 0.25), 0.55);

const buildMonster = (kind: MonsterKind, frame: number, hurt: boolean): HTMLCanvasElement => {
  const grid = new Grid(MON_W, MON_H);
  if (kind === "slime") drawSlime(grid, frame);
  else if (kind === "goblin") drawGoblin(grid, frame);
  else if (kind === "bat") drawBat(grid, frame);
  else if (kind === "skeleton") drawSkeleton(grid, frame);
  else drawMushroom(grid, frame);
  grid.outline();
  if (kind === "mushroom") drawSpores(grid, frame);
  if (hurt) grid.recolor(hurtTone);
  return grid.toCanvas();
};

const normFrame = (frame: number): number => {
  const whole = Number.isFinite(frame) ? Math.floor(frame) : 0;
  return ((whole % MON_FRAMES) + MON_FRAMES) % MON_FRAMES;
};

/** Monster sprite, facing LEFT (toward the adventurer). hurt=true is an opaque, lighter flash variant. */
export const monsterSprite = (kind: MonsterKind, frame: number, hurt: boolean): HTMLCanvasElement => {
  const frameIdx = normFrame(frame);
  const key = `m|${kind}|${frameIdx}|${hurt ? 1 : 0}`;
  let sprite = cache.get(key);
  if (!sprite) {
    sprite = buildMonster(kind, frameIdx, hurt);
    cache.set(key, sprite);
  }
  return sprite;
};
