// THE VEILED ONE: the secret final boss behind the Dungeon Lord. Pixel drawings built once and cached; every colour is
// an opaque #rrggbb (no alpha anywhere), the hurt flash is an opaque lighter palette and the blink / retreat fades are
// ordered-dither cut-outs (pixels disappear, they never turn translucent).
//  - form 1 (80x96): robed, veiled, cracked porcelain mask, black thorn crown, ring of eyes. Frames 0-3 idle (float +
//    veil sway + eyes opening), 4 cast (arms out, cyan orb), 5 blink-out, 6 blink-in.
//  - form 2 (80x96): the veil is torn, the mask is half broken around a glowing eye, two extra shadow arms. Same frames.
//  - form 3 TRUE FORM (160x128): towering, shattered mask, giant chest eye, six wings of void and eyes, crown ablaze.
//    Frames 0-3 idle, 4 raise-arms (the eclipse).
//  - voidBossDyingSprite(stage): form 3 with cracks spreading (0-3), then imploding (4-6).
// All sprites face the viewer, bottom-centre anchored (draw at x - wide/2, y - high).

import { Grid as BaseGrid, lighten, mix } from "./sprites";

export type VoidForm = 1 | 2 | 3;

export const VOID_W = 80;
export const VOID_H = 96;
export const VOID_TRUE_W = 160;
export const VOID_TRUE_H = 128;
export const VOID_IDLE_FRAMES = 4;
export const VOID_CAST_FRAME = 4;
export const VOID_BLINK_OUT_FRAME = 5;
export const VOID_BLINK_IN_FRAME = 6;
export const VOID_RAISE_FRAME = 4;
/** dither levels 0 (whole) .. VOID_DITHER_STEPS (nothing left) */
export const VOID_DITHER_STEPS = 8;
/** dying stages: 0-3 cracks spreading, 4-6 imploding */
export const VOID_DYING_STAGES = 7;
export const VOID_CRACK_STAGES = 4;

/** the veiled forms are drawn at this scale (nearest-neighbour, before the outline) so they tower over the raiders */
export const VOID_FIGURE_SCALE = 1.5;
export const voidFormSize = (form: VoidForm): { wide: number; high: number } =>
  form === 3
    ? { wide: VOID_TRUE_W, high: VOID_TRUE_H }
    : { wide: Math.round(VOID_W * VOID_FIGURE_SCALE), high: Math.round(VOID_H * VOID_FIGURE_SCALE) };
export const voidFormFrames = (form: VoidForm): number => (form === 3 ? 5 : 7);

// ---- palette (deep violet / black, bone white, sickly cyan and gold) ------------------------------------------------
interface Ramp {
  base: string;
  hi: string;
  sh: string;
  dk: string;
}
const ROBE: Ramp = { base: "#2a1a4a", hi: "#4f3896", sh: "#1a0f33", dk: "#0c0618" };
const ROBE3: Ramp = { base: "#2c1238", hi: "#6a2a78", sh: "#190a24", dk: "#0a0510" };
const VEIL: Ramp = { base: "#1d1040", hi: "#3c2878", sh: "#120a28", dk: "#07030f" };
const HOOD: Ramp = { base: "#1b1034", hi: "#3a2870", sh: "#10091f", dk: "#07030f" };
const BONE: Ramp = { base: "#ece4cf", hi: "#fffdf2", sh: "#b9ac8c", dk: "#6a5f48" };
const THORN: Ramp = { base: "#17102a", hi: "#4a3680", sh: "#0c0818", dk: "#050309" };
const SHADOW: Ramp = { base: "#261648", hi: "#7250d0", sh: "#160c30", dk: "#0a0518" };
const CYAN_R: Ramp = { base: "#5ff5d8", hi: "#d8fff4", sh: "#1d9a8c", dk: "#0d5a58" };
const GOLD_R: Ramp = { base: "#f2c14e", hi: "#fff0a0", sh: "#c28a22", dk: "#7a4a0c" };
const EYEBALL: Ramp = { base: "#fff2b8", hi: "#ffffff", sh: "#e8b84a", dk: "#a8741a" };
const IRIS: Ramp = { base: "#ffb52e", hi: "#ffe27a", sh: "#e8741a", dk: "#a8300c" };
const BLOOD: Ramp = { base: "#e0243c", hi: "#ff8a8a", sh: "#a8102a", dk: "#5a0614" };
const VOIDFILL = "#05020b";
const CRACK = "#5a4e3a";
const LID = "#0b0716";
const SCLERA = "#dff6ff";
const CYAN = "#5ff5d8";
const CYAN_HI = "#d8fff4";
const CYAN_SH = "#1d9a8c";
const GOLD = "#f2c14e";
const GOLD_HI = "#fff0a0";
const EMBER = "#ff8a2a";
const RIM = "#2a7a8a";
const WHITE = "#ffffff";

const hash = (seed: number): number => {
  const raw = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return raw - Math.floor(raw);
};

const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

class Grid extends BaseGrid {
  override set(x: number, y: number, color: string) {
    super.set(Math.round(x), Math.round(y), color);
  }
  clear(x: number, y: number) {
    const px = Math.round(x) + this.dx,
      py = Math.round(y) + this.dy;
    if (px >= 0 && px < this.width && py >= 0 && py < this.height) this.cells[py * this.width + px] = null;
  }
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
  tri(ax: number, ay: number, bx: number, by: number, cx: number, cy: number, color: string) {
    const side = (p1x: number, p1y: number, p2x: number, p2y: number, p3x: number, p3y: number) =>
      (p1x - p3x) * (p2y - p3y) - (p2x - p3x) * (p1y - p3y);
    for (let y = Math.floor(Math.min(ay, by, cy)); y <= Math.ceil(Math.max(ay, by, cy)); y++) {
      for (let x = Math.floor(Math.min(ax, bx, cx)); x <= Math.ceil(Math.max(ax, bx, cx)); x++) {
        const px = x + 0.5,
          py = y + 0.5;
        const d1 = side(px, py, ax, ay, bx, by),
          d2 = side(px, py, bx, by, cx, cy),
          d3 = side(px, py, cx, cy, ax, ay);
        if (!((d1 < 0 || d2 < 0 || d3 < 0) && (d1 > 0 || d2 > 0 || d3 > 0))) this.set(x, y, color);
      }
    }
  }
  line(x0: number, y0: number, x1: number, y1: number, color: string) {
    const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
    for (let i = 0; i <= steps; i++) this.set(x0 + ((x1 - x0) * i) / steps, y0 + ((y1 - y0) * i) / steps, color);
  }
  limb(x0: number, y0: number, r0: number, x1: number, y1: number, r1: number, ramp: Ramp) {
    const steps = Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)));
    for (let i = 0; i <= steps; i++) {
      const ratio = steps ? i / steps : 0;
      const radius = r0 + (r1 - r0) * ratio;
      this.ell(x0 + (x1 - x0) * ratio, y0 + (y1 - y0) * ratio, radius, radius, ramp);
    }
  }
  /** a curved tapering strand from (x0, y0) to (x1, y1) bent sideways by `bend` px */
  strand(x0: number, y0: number, x1: number, y1: number, bend: number, r0: number, r1: number, ramp: Ramp) {
    const len = Math.max(Math.hypot(x1 - x0, y1 - y0), 1);
    const nx = -(y1 - y0) / len,
      ny = (x1 - x0) / len;
    const steps = Math.ceil(len / 2);
    let px = x0,
      py = y0;
    for (let i = 1; i <= steps; i++) {
      const tick = i / steps;
      const arc = Math.sin(tick * Math.PI) * bend;
      const qx = x0 + (x1 - x0) * tick + nx * arc,
        qy = y0 + (y1 - y0) * tick + ny * arc;
      this.limb(px, py, r0 + (r1 - r0) * ((i - 1) / steps), qx, qy, r0 + (r1 - r0) * tick, ramp);
      px = qx;
      py = qy;
    }
  }
  /** remove every cell of the 4x4 Bayer pattern below `level` (0..8): an opaque dissolve */
  dither(level: number) {
    if (level <= 0) return;
    const cut = level * 2;
    for (let y = 0; y < this.height; y++)
      for (let x = 0; x < this.width; x++)
        if (BAYER[(y % 4) * 4 + (x % 4)] < cut) this.cells[y * this.width + x] = null;
  }
  /** a bigger copy: every cell repeated (factor 1.5 doubles every other row and column) */
  upscaled(factor: number): Grid {
    const out = new Grid(Math.round(this.width * factor), Math.round(this.height * factor));
    for (let y = 0; y < out.height; y++)
      for (let x = 0; x < out.width; x++)
        out.cells[y * out.width + x] = this.cells[Math.floor(y / factor) * this.width + Math.floor(x / factor)] ?? null;
    return out;
  }
  /** nearest-neighbour rescale about (cx, cy): fx / fy < 1 shrinks */
  rescale(cx: number, cy: number, fx: number, fy: number) {
    const out = new Array<string | null>(this.cells.length).fill(null);
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const sx = Math.round(cx + (x - cx) / fx),
          sy = Math.round(cy + (y - cy) / fy);
        if (sx >= 0 && sx < this.width && sy >= 0 && sy < this.height)
          out[y * this.width + x] = this.cells[sy * this.width + sx];
      }
    }
    this.cells = out;
  }
}

// ---- shared pieces ------------------------------------------------------------------------------------------------------
/** an almond eye: open 2 = wide, 1 = heavy lid, 0 = shut (a lashed line) */
const eye = (grid: Grid, x: number, y: number, open: number, iris = CYAN) => {
  if (open === 0) {
    grid.row(y, x - 2, x + 2, LID);
    grid.set(x - 3, y, iris);
    grid.set(x + 3, y, iris);
    return;
  }
  if (open === 2) grid.row(y - 1, x - 1, x + 1, LID);
  else grid.row(y - 1, x - 2, x + 2, LID);
  grid.row(y, x - 2, x + 2, SCLERA);
  grid.set(x, y, iris);
  grid.row(y + 1, x - 1, x + 1, LID);
};

/** the ring of watching eyes behind the head */
const halo = (
  grid: Grid,
  cx: number,
  cy: number,
  radius: number,
  count: number,
  frame: number,
  iris: string,
  rim: string,
) => {
  for (let step = 0; step < 120; step++) {
    const angle = (step / 120) * Math.PI * 2;
    if (step % 3 === 0) grid.set(cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius * 0.92, rim);
  }
  for (let i = 0; i < count; i++) {
    const angle = ((i + 0.5) / count) * Math.PI * 2;
    const open = (i * 2 + frame) % 4 < 2 ? 2 : (i + frame) % 4 === 2 ? 1 : 0;
    eye(grid, cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius * 0.92, open, iris);
  }
};

/** black thorns rising from the hood, tips lit by `tip` */
const thorns = (grid: Grid, cx: number, cy: number, count: number, spread: number, tall: number, tip: string) => {
  const half = (count - 1) / 2;
  for (let k = -half; k <= half; k++) {
    const dx = k * spread;
    const baseY = cy - 17 * Math.sqrt(Math.max(0, 1 - (dx / 13.5) ** 2)) + 1.5;
    const tx = cx + dx * 1.55,
      ty = baseY - (4 + (half - Math.abs(k)) * tall) + Math.abs(k) * 0.4;
    grid.tri(cx + dx - 1.6, baseY, cx + dx + 1.6, baseY, tx, ty, THORN.base);
    grid.line(cx + dx - 1, baseY - 1, tx, ty, THORN.hi);
    grid.set(cx + dx + 1, baseY - 1, THORN.sh);
    grid.set(tx, ty, tip);
  }
};

/** a fine jagged line of colour (cracks, scratches) */
const jag = (grid: Grid, points: number[][], color: string) => {
  for (let i = 0; i < points.length - 1; i++)
    grid.line(points[i][0], points[i][1], points[i + 1][0], points[i + 1][1], color);
};

// ---- forms 1 and 2: the veiled figure ------------------------------------------------------------------------------------
const BOB = [0, 1, 2, 1];

const cloak = (grid: Grid, cx: number, top: number, bottom: number, frame: number, form: VoidForm) => {
  for (let y = top; y <= bottom + 12; y++) {
    const half = Math.min(28, 9 + (y - top) * 0.55);
    for (let x = Math.ceil(cx - half); x <= Math.floor(cx + half); x++) {
      const len = bottom + (form === 2 ? 11 : 8) * hash(x * 1.7) + 2 * Math.sin(x * 0.55 + frame * 1.6);
      if (y > len) continue;
      const rel = (x - cx) / half;
      const stripe = (x + Math.floor(y / 9)) % 5 === 0;
      let color = rel > 0.45 ? VEIL.sh : VEIL.base;
      if (stripe) color = rel > 0 ? VEIL.sh : VEIL.hi;
      if (Math.abs(x - cx) >= half - 1) color = VEIL.hi;
      if (y > len - 1.2 && x % 2 === 0) color = RIM;
      grid.set(x, y, color);
    }
  }
};

const robe = (grid: Grid, cx: number, top: number, hem: number, frame: number) => {
  for (let y = top; y <= hem + 4; y++) {
    const half = 9 + (y - top) * 0.27;
    for (let x = Math.ceil(cx - half); x <= Math.floor(cx + half); x++) {
      if (y > hem + 3 * hash(x * 2.3 + frame * 0.3)) continue;
      const rel = (x - cx) / half;
      let color = rel < -0.55 ? ROBE.hi : rel > 0.45 ? ROBE.sh : ROBE.base;
      if (Math.abs(x - cx) === Math.round(half * 0.75) && y % 6 !== 0) color = ROBE.dk;
      if (Math.abs(x - cx) === Math.round(half * 0.4) && y % 5 !== 0) color = rel < 0 ? ROBE.sh : ROBE.dk;
      grid.set(x, y, color);
    }
  }
  // gold sash down the middle, belt and the eye sigil
  grid.rect(cx - 1, top + 3, cx + 1, hem + 2, GOLD_R.sh);
  grid.rect(cx, top + 3, cx, hem + 2, GOLD);
  grid.rect(cx - 11, top + 17, cx + 11, top + 18, GOLD_R.sh);
  grid.rect(cx - 11, top + 17, cx + 11, top + 17, GOLD);
  grid.ell(cx, top + 18, 3.5, 3, GOLD_R);
  grid.row(top + 18, cx - 2, cx + 2, LID);
  grid.set(cx, top + 18, CYAN);
};

const maskVeiled = (grid: Grid, cx: number, cy: number, form: VoidForm, frame: number) => {
  grid.ell(cx, cy + 2, 13.5, 17, HOOD);
  grid.ell(cx, cy, 9.5, 12.5, BONE);
  // brow shadow and nose
  grid.row(cy - 5, cx - 7, cx + 7, BONE.sh);
  grid.set(cx, cy + 2, BONE.sh);
  grid.set(cx, cy + 3, BONE.sh);
  // eye slits with a cyan pinprick that wanders
  const look = frame % 2 ? 1 : 0;
  grid.rect(cx - 7, cy - 3, cx - 3, cy - 2, LID);
  grid.rect(cx + 3, cy - 3, cx + 7, cy - 2, LID);
  grid.set(cx - 5 + look, cy - 2, CYAN);
  if (form === 1) grid.set(cx + 5 + look, cy - 2, CYAN);
  // tear tracks, mouth, the first crack
  for (let i = 0; i < 7; i++) {
    grid.set(cx - 6, cy - 1 + i, i % 2 ? CYAN_SH : CYAN);
    if (form === 1) grid.set(cx + 6, cy - 1 + i, i % 2 ? CYAN_SH : CYAN);
  }
  grid.row(cy + 8, cx - 3, cx + 3, CRACK);
  grid.set(cx - 4, cy + 7, CRACK);
  grid.set(cx + 4, cy + 7, CRACK);
  jag(
    grid,
    [
      [cx + 1, cy - 12],
      [cx + 2, cy - 9],
      [cx + 1, cy - 6],
      [cx + 3, cy - 3],
      [cx + 3, cy + 1],
    ],
    CRACK,
  );
  jag(
    grid,
    [
      [cx + 2, cy - 8],
      [cx - 2, cy - 6],
      [cx - 3, cy - 4],
    ],
    CRACK,
  );
  if (form === 2) {
    // the right half of the mask is gone: a glowing eye looks out of the break
    const edge = [
      [cx + 1, cy - 8],
      [cx + 3, cy - 5],
      [cx + 2, cy - 1],
      [cx + 5, cy + 2],
      [cx + 4, cy + 6],
      [cx + 7, cy + 9],
    ];
    for (let y = cy - 9; y <= cy + 10; y++)
      for (let x = cx + 1; x <= cx + 11; x++) {
        const bound = edge.find((pt) => pt[1] >= y)?.[0] ?? cx + 7;
        const inMask = ((x - cx) / 10) ** 2 + ((y - cy) / 13) ** 2 <= 1;
        if (x >= bound && inMask) grid.set(x, y, VOIDFILL);
      }
    for (const [ex, ey] of edge) grid.set(ex, ey, BONE.dk);
    grid.ell(cx + 5, cy + 1, 5.2, 4, EYEBALL);
    grid.ell(cx + 5 + look * 0.7, cy + 1, 2.4, 3, IRIS);
    grid.rect(cx + 5 + look, cy - 1, cx + 5 + look, cy + 3, "#14080a");
    grid.set(cx + 4, cy - 1, WHITE);
    for (let i = 0; i < 8; i++)
      grid.set(cx + 5 + Math.cos(i + frame) * 7.4, cy + 1 + Math.sin(i + frame) * 5.4, i % 2 ? CYAN : GOLD_HI);
  }
};

const handsClasp = (grid: Grid, cx: number, y: number) => {
  grid.ell(cx - 1.6, y, 3, 2.2, BONE);
  grid.ell(cx + 1.6, y, 3, 2.2, BONE);
  for (let k = -3; k <= 3; k += 2) {
    grid.set(cx + k, y + 3, BONE.base);
    grid.set(cx + k, y + 4, k % 4 ? BONE.sh : BONE.dk);
  }
};

const drawVeiled = (grid: Grid, form: 1 | 2, frame: number) => {
  const cx = 40,
    cy = 25,
    cast = frame === VOID_CAST_FRAME,
    idle = cast ? 1 : frame % VOID_IDLE_FRAMES;
  halo(grid, cx, cy, 23, 8, idle, CYAN, VEIL.hi);
  if (form === 2) {
    // the two extra arms of shadow, behind the robe
    const swing = idle % 2;
    for (const side of [-1, 1]) {
      grid.limb(cx + side * 8, 42, 3, cx + side * 27, 55 + swing, 2.4, SHADOW);
      grid.limb(cx + side * 27, 55 + swing, 2.4, cx + side * 33, 73 + swing, 1.6, SHADOW);
      for (let claw = -1; claw <= 1; claw++) {
        grid.line(cx + side * 33, 73 + swing, cx + side * (34 + claw * 2), 79 + swing + (claw === 0 ? 2 : 0), CYAN_HI);
      }
    }
  }
  cloak(grid, cx, 44, 78, idle, form);
  // ribbons of veil falling from the crown beside the face
  for (const side of [-1, 1])
    for (let y = 28; y < 62; y++) {
      const x = cx + side * (12 + Math.sin(y * 0.22 + idle * 1.4) * 1.6);
      grid.set(x, y, VEIL.base);
      grid.set(x + side, y, VEIL.sh);
      grid.set(x - side, y, y % 5 === 0 ? RIM : VEIL.hi);
    }
  robe(grid, cx, 40, 78, idle);
  // collar, pauldrons and spikes
  grid.ell(cx, 38, 12, 5, ROBE);
  for (const side of [-1, 1]) {
    grid.ell(cx + side * 13, 43, 7, 4.5, THORN);
    grid.row(40, cx + side * 13 - 5, cx + side * 13 + 5, GOLD_R.sh);
    grid.set(cx + side * 13, 40, GOLD);
    grid.tri(cx + side * 13 - 2, 40, cx + side * 13 + 2, 40, cx + side * 17, 32, THORN.base);
    grid.set(cx + side * 17, 32, form === 1 ? CYAN : GOLD);
  }
  maskVeiled(grid, cx, cy, form, idle);
  thorns(grid, cx, cy, 7, 3.4, 2, form === 1 ? CYAN : GOLD);
  // arms
  for (const side of [-1, 1]) {
    if (cast) {
      grid.limb(cx + side * 14, 44, 3.4, cx + side * 27, 48, 2.6, ROBE);
      grid.ell(cx + side * 30, 47, 2.6, 2.6, BONE);
      for (let finger = -1; finger <= 1; finger++)
        grid.line(cx + side * 31, 47, cx + side * 36, 47 + finger * 4, finger ? BONE.sh : BONE.base);
    } else {
      grid.limb(cx + side * 14, 44, 3.4, cx + side * 9, 56, 3, ROBE);
      grid.limb(cx + side * 9, 56, 3, cx + side * 3, 61 + (idle % 2), 2.4, ROBE);
    }
  }
  if (cast) {
    grid.ell(cx, 55, 5.4, 5.4, CYAN_R);
    grid.ell(cx, 55, 2.4, 2.4, { base: WHITE, hi: WHITE, sh: CYAN_HI, dk: CYAN_HI });
    for (let i = 0; i < 6; i++)
      grid.set(cx + Math.cos(i * 1.1) * 9, 55 + Math.sin(i * 1.1) * 7, i % 2 ? CYAN : CYAN_HI);
  } else handsClasp(grid, cx, 61 + (idle % 2));
};

// ---- form 3: the true form ------------------------------------------------------------------------------------------------
interface WingDef {
  dir: number;
  len: number;
  flap: number;
}
/** angles in degrees measured from straight up, clockwise (right wings); the left side mirrors them */
const WINGS: WingDef[] = [
  { dir: 52, len: 54, flap: 1 },
  { dir: 98, len: 60, flap: -0.6 },
  { dir: 138, len: 50, flap: 1 },
];

const wing = (grid: Grid, sx: number, sy: number, side: number, def: WingDef, frame: number, raise: boolean) => {
  const swing = [-5, 0, 5, 0][frame % 4] * def.flap + (raise ? -24 : 0);
  for (let feather = 0; feather < 5; feather++) {
    const angle = ((def.dir + swing + (feather - 2) * 13) * Math.PI) / 180;
    const len = def.len * (0.74 + 0.26 * (1 - Math.abs(feather - 2) / 3));
    const tx = sx + side * Math.sin(angle) * len,
      ty = sy - Math.cos(angle) * len;
    grid.strand(sx, sy, tx, ty, side * (4 + feather), 3.3, 0.8, VEIL);
    grid.set(tx, ty, feather % 2 ? EMBER : BLOOD.base);
    grid.set(tx - side * Math.sin(angle) * 3, ty + Math.cos(angle) * 3, BLOOD.sh);
  }
  const mid = ((def.dir + swing) * Math.PI) / 180;
  const ex = sx + side * Math.sin(mid) * def.len * 0.6,
    ey = sy - Math.cos(mid) * def.len * 0.6;
  eye(grid, ex, ey, (frame + (def.dir > 90 ? 1 : 0)) % 3 === 0 ? 1 : 2, "#ff4a5a");
  eye(grid, sx + side * Math.sin(mid) * def.len * 0.32, sy - Math.cos(mid) * def.len * 0.32, 2, GOLD);
};

const drawTrue = (grid: Grid, frame: number) => {
  const cx = 80,
    raise = frame === VOID_RAISE_FRAME,
    idle = raise ? 1 : frame % VOID_IDLE_FRAMES;
  halo(grid, cx, 32, 37, 12, idle, "#ff5a6a", "#7a2a50");
  for (const side of [-1, 1]) for (const def of WINGS) wing(grid, cx + side * 14, 50, side, def, idle, raise);
  // torn robe falling into strands of void
  for (let y = 44; y <= 124; y++) {
    const half = Math.min(30, 14 + (y - 44) * 0.3);
    for (let x = Math.ceil(cx - half); x <= Math.floor(cx + half); x++) {
      const len = 106 + 16 * hash(x * 1.3) + 2 * Math.sin(x * 0.4 + idle * 1.7);
      if (y > len) continue;
      const rel = (x - cx) / half;
      let color = rel < -0.5 ? ROBE3.hi : rel > 0.4 ? ROBE3.sh : ROBE3.base;
      if (Math.abs(x - cx) === Math.round(half * 0.7) && y % 7 !== 0) color = ROBE3.dk;
      if ((x + Math.floor(y / 11)) % 6 === 0) color = rel > 0 ? ROBE3.dk : ROBE3.sh;
      if (Math.abs(x - cx) >= half - 1) color = GOLD_R.sh;
      if (y > len - 1.2 && x % 2 === 0) color = BLOOD.sh;
      grid.set(x, y, color);
    }
  }
  // great shoulders with thorn spikes
  for (const side of [-1, 1]) {
    grid.ell(cx + side * 19, 50, 10, 6, THORN);
    grid.row(46, cx + side * 19 - 8, cx + side * 19 + 8, GOLD_R.sh);
    for (let spike = 0; spike < 3; spike++)
      grid.tri(
        cx + side * (13 + spike * 5) - 2,
        46,
        cx + side * (13 + spike * 5) + 2,
        46,
        cx + side * (16 + spike * 7),
        36 - spike * 3,
        THORN.base,
      );
  }
  // the giant eye in the chest, ringed with thorns
  const pan = [-2, 0, 2, 0][idle];
  for (let i = 0; i < 14; i++) {
    const angle = (i / 14) * Math.PI * 2;
    grid.tri(
      cx + Math.cos(angle - 0.18) * 15,
      68 + Math.sin(angle - 0.18) * 11,
      cx + Math.cos(angle + 0.18) * 15,
      68 + Math.sin(angle + 0.18) * 11,
      cx + Math.cos(angle) * 21,
      68 + Math.sin(angle) * 15,
      i % 2 ? THORN.base : THORN.hi,
    );
  }
  grid.ell(cx, 68, 15, 11, GOLD_R);
  grid.ell(cx, 68, 13, 9, EYEBALL);
  grid.ell(cx + pan, 68, 6.5, 8, BLOOD);
  grid.ell(cx + pan, 68, 3.4, 5.6, IRIS);
  grid.rect(cx + pan, 62, cx + pan, 74, "#14080a");
  grid.set(cx + pan - 3, 64, WHITE);
  grid.set(cx + pan - 2, 63, WHITE);
  jag(
    grid,
    [
      [cx - 14, 62],
      [cx - 9, 60],
      [cx - 7, 57],
    ],
    BLOOD.base,
  );
  jag(
    grid,
    [
      [cx + 14, 74],
      [cx + 10, 76],
      [cx + 8, 79],
    ],
    BLOOD.base,
  );
  // head: hood, void face, half a mask, floating shards, golden eyes
  grid.ell(cx, 36, 13.5, 17, HOOD);
  grid.ell(cx, 37, 9.5, 12.5, { base: VOIDFILL, hi: "#0d0820", sh: VOIDFILL, dk: VOIDFILL });
  grid.ell(cx, 36, 10, 13, BONE);
  for (let y = 22; y <= 52; y++)
    for (let x = cx - 2; x <= cx + 12; x++) {
      const edge = cx - 1 + Math.round(Math.sin(y * 0.9) * 2.4 + (y - 22) * 0.12);
      if (x >= edge && grid.get(x, y) !== null) grid.set(x, y, VOIDFILL);
    }
  for (let y = 22; y <= 50; y += 2)
    grid.set(cx - 1 + Math.round(Math.sin(y * 0.9) * 2.4 + (y - 22) * 0.12), y, BONE.dk);
  grid.rect(cx - 8, 33, cx - 4, 34, LID);
  grid.set(cx - 6, 34, CYAN);
  jag(
    grid,
    [
      [cx - 7, 24],
      [cx - 6, 28],
      [cx - 8, 33],
      [cx - 6, 38],
    ],
    CRACK,
  );
  // the void half of the face: two gold slashes for eyes
  grid.rect(cx + 2, 32, cx + 8, 34, GOLD_R.sh);
  grid.rect(cx + 3, 32, cx + 8, 33, GOLD);
  grid.row(32, cx + 4, cx + 7, GOLD_HI);
  grid.rect(cx + 1, 41, cx + 6, 41, "#7a2a50");
  for (let shard = 0; shard < 7; shard++) {
    const angle = shard * 0.9 + idle * 0.5;
    const sx = cx + Math.cos(angle) * (20 + (shard % 3) * 3),
      sy = 36 + Math.sin(angle) * (22 + (shard % 2) * 3);
    grid.tri(sx - 2, sy + 2, sx + 2, sy + 1, sx + (shard % 2 ? 1 : -1), sy - 3, shard % 2 ? BONE.base : BONE.sh);
    grid.set(sx, sy, BONE.hi);
  }
  // the crown ablaze
  thorns(grid, cx, 36, 9, 3, 1.5, GOLD_HI);
  const half = 4;
  for (let k = -half; k <= half; k++) {
    const dx = k * 3;
    const baseY = 36 - 17 * Math.sqrt(Math.max(0, 1 - (dx / 13.5) ** 2)) + 1.5;
    const tipY = baseY - (4 + (half - Math.abs(k)) * 1.5) + Math.abs(k) * 0.4;
    const tipX = cx + dx * 1.55;
    const flameH = 6 + (half - Math.abs(k)) + ((k + idle) % 2 ? 2 : 0);
    const lean = idle % 2 ? 1 : -1;
    for (let i = 0; i < flameH; i++) {
      const wide = Math.max(0, Math.round((1 - i / flameH) * 1.8));
      const fx = tipX + (i > flameH / 2 ? lean : 0);
      grid.row(tipY - 1 - i, fx - wide, fx + wide, i < flameH * 0.35 ? GOLD_R.sh : GOLD);
      if (wide > 0) grid.row(tipY - 1 - i, fx - wide + 1, fx + wide - 1, i < flameH * 0.6 ? GOLD_HI : WHITE);
    }
  }
  // arms and claws
  for (const side of [-1, 1]) {
    if (raise) {
      grid.limb(cx + side * 22, 52, 5, cx + side * 30, 34, 4, ROBE3);
      grid.limb(cx + side * 30, 34, 4, cx + side * 36, 16, 3, ROBE3);
      grid.ell(cx + side * 37, 13, 4, 4, BONE);
      for (let finger = -2; finger <= 2; finger++)
        grid.line(
          cx + side * 37,
          12,
          cx + side * (40 + finger),
          3 + Math.abs(finger) * 2,
          finger % 2 ? BONE.sh : BONE.base,
        );
    } else {
      grid.limb(cx + side * 22, 52, 5, cx + side * 34, 68, 4, ROBE3);
      grid.limb(cx + side * 34, 68, 4, cx + side * 36, 88 + (idle % 2), 3, ROBE3);
      grid.ell(cx + side * 37, 91 + (idle % 2), 4, 3.4, BONE);
      for (let finger = -2; finger <= 2; finger++)
        grid.line(
          cx + side * 37,
          93 + (idle % 2),
          cx + side * (39 + finger * 1.4),
          102 + Math.abs(finger) + (idle % 2),
          finger % 2 ? BONE.sh : BONE.base,
        );
    }
  }
};

// ---- transforms and public builders -------------------------------------------------------------------------------------
const hurtTone = (color: string): string => lighten(mix(color, "#ff5a6a", 0.5), 0.3);

const cache = new Map<string, HTMLCanvasElement>();
const wrapIndex = (value: number, count: number): number => {
  const raw = Math.floor(Number.isFinite(value) ? value : 0);
  return ((raw % count) + count) % count;
};
const clampLevel = (value: number, max: number): number =>
  Math.min(max, Math.max(0, Math.floor(Number.isFinite(value) ? value : 0)));

/** blink frames: the figure narrows to a streak (out) and a bright slit (in) */
const squeeze = (grid: Grid, frame: number, wide: number) => {
  if (frame === VOID_BLINK_OUT_FRAME) {
    grid.rescale(wide / 2, VOID_H / 2, 0.62, 1.04);
    grid.dither(2);
  } else {
    grid.rescale(wide / 2, VOID_H / 2, 0.24, 1.08);
    for (let y = 8; y < 86; y += 2) grid.set(wide / 2, y, y % 4 ? CYAN_HI : WHITE);
  }
};

/** the Veiled One: form 1-3, `frame` wrapped to the form's frames, `hurt` the opaque flash, `dither` 0..8 the dissolve */
export const voidBossSprite = (form: VoidForm, frame: number, hurt = false, dither = 0): HTMLCanvasElement => {
  const index = wrapIndex(frame, voidFormFrames(form));
  const level = clampLevel(dither, VOID_DITHER_STEPS);
  const key = `veiled|${form}|${index}|${hurt ? 1 : 0}|${level}`;
  const known = cache.get(key);
  if (known) return known;
  let grid = form === 3 ? new Grid(VOID_TRUE_W, VOID_TRUE_H) : new Grid(VOID_W, VOID_H);
  const bob = index === VOID_CAST_FRAME || index >= VOID_BLINK_OUT_FRAME ? 1 : BOB[index % VOID_IDLE_FRAMES];
  grid.dy = form === 3 ? 4 + (index === VOID_RAISE_FRAME ? 0 : bob) : 3 + bob;
  if (form === 3) drawTrue(grid, index);
  else drawVeiled(grid, form, index);
  if (form !== 3 && index >= VOID_BLINK_OUT_FRAME) squeeze(grid, index, VOID_W);
  if (form !== 3) grid = grid.upscaled(VOID_FIGURE_SCALE);
  grid.outline();
  grid.dither(level);
  if (hurt) grid.recolorFill(hurtTone);
  const canvas = grid.toCanvas();
  cache.set(key, canvas);
  return canvas;
};

const crackPath = (index: number, reach: number): number[][] => {
  const out: number[][] = [];
  let px = 80,
    py = 68;
  const heading = (index / 9) * Math.PI * 2 + hash(index) * 0.6;
  for (let i = 0; i < reach; i++) {
    const wander = (hash(index * 31 + i) - 0.5) * 1.5;
    px += Math.cos(heading + wander) * 1.4;
    py += Math.sin(heading + wander) * 1.5;
    out.push([px, py]);
  }
  return out;
};

/** the true form dying: stages 0-3 the light cracks through it, 4-6 it implodes toward its eye */
export const voidBossDyingSprite = (stage: number): HTMLCanvasElement => {
  const index = clampLevel(stage, VOID_DYING_STAGES - 1);
  const key = `dying|${index}`;
  const known = cache.get(key);
  if (known) return known;
  const grid = new Grid(VOID_TRUE_W, VOID_TRUE_H);
  grid.dy = 4;
  drawTrue(grid, 0);
  const reach = 10 + index * 8;
  const cracks = Math.min(9, 3 + index * 2);
  for (let crack = 0; crack < cracks; crack++) {
    crackPath(crack, reach).forEach(([cx, cy], step) => {
      if (grid.get(cx, cy - 4) === null) return;
      const bright = (step + crack) % 3 === 0;
      grid.set(cx, cy - 4, bright ? WHITE : GOLD_HI);
      if (step % 4 === 0) grid.set(cx + 1, cy - 4, GOLD);
    });
  }
  if (index >= VOID_CRACK_STAGES) {
    const shrink = [0.82, 0.52, 0.26][index - VOID_CRACK_STAGES];
    grid.rescale(80, 68, shrink, shrink);
    grid.ell(80, 68, 4 + (index - VOID_CRACK_STAGES) * 0.5, 4, { base: WHITE, hi: WHITE, sh: GOLD_HI, dk: GOLD });
    grid.recolorFill((color) => lighten(color, 0.25 * (index - VOID_CRACK_STAGES + 1)));
  }
  grid.outline();
  const canvas = grid.toCanvas();
  cache.set(key, canvas);
  return canvas;
};
