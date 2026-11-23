import { VIEW_W, VIEW_X0, WORLD_H, type Pt } from "./layout";

/**
 * Atmosphere for the three dungeon floors: lit and darkened stone (palette only, dithered, baked into the static
 * layer), far vaults seen through broken walls, floor decals and runic inlays, wall reliefs, and a few cheap opaque
 * animated bits (candles, rats, motes, ripples, mist, wisps, swaying cages, bats and embers in the top band).
 * Everything is opaque. Back-layer pieces sit under every character; the front-layer pieces stay in the top band.
 */
type Ctx = CanvasRenderingContext2D;
export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}
export interface Prop extends Box {
  floor: number;
  kind: string;
}

export const WALL_BASE = 64;
const X_END = VIEW_X0 + VIEW_W;
const MID_X = VIEW_X0 + VIEW_W / 2;
/** the bottom strip below the lowest raider row, and the top strip under the wall: the only places solid props go */
export const FRONT_BAND = 30;

// ---- helpers ----------------------------------------------------------------------------------------------------
const rect = (ctx: Ctx, color: string, x: number, y: number, width: number, height: number) => {
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x), Math.round(y), width, height);
};
const hash = (first: number, second: number): number => {
  let mixed = Math.imul(first + 0x9e37, 0x85ebca6b) ^ Math.imul(second + 0x7f4a, 0xc2b2ae35);
  mixed = Math.imul(mixed ^ (mixed >>> 13), 0x27d4eb2f);
  return (mixed ^ (mixed >>> 15)) >>> 0;
};
const pick = <T>(list: readonly T[], first: number, second: number): T => list[hash(first, second) % list.length];
const clamp = (value: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, value));
const mixCache = new Map<string, string>();
export const mixHex = (from: string, to: string, amount: number): string => {
  const key = `${from}${to}${amount.toFixed(3)}`;
  const hit = mixCache.get(key);
  if (hit) return hit;
  const fromN = parseInt(from.slice(1), 16),
    toN = parseInt(to.slice(1), 16);
  const part = (shift: number) => Math.round(((fromN >> shift) & 255) * (1 - amount) + ((toN >> shift) & 255) * amount);
  const out = `#${((part(16) << 16) | (part(8) << 8) | part(0)).toString(16).padStart(6, "0")}`;
  mixCache.set(key, out);
  return out;
};
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
const bayer = (x: number, y: number) => (BAYER[((y & 3) << 2) | (x & 3)] + 0.5) / 16;
const blockOf = (value: number) => Math.floor(value / 3);

// ---- light sources ----------------------------------------------------------------------------------------------
export const TORCH_POS: Pt[] = [
  { x: -52, y: 42 },
  { x: 66, y: 42 },
  { x: 107, y: 42 },
  { x: 186, y: 42 },
  { x: 258, y: 42 },
  { x: 326, y: 42 },
];
export const LANTERN_POS: Pt[] = [
  { x: -44, y: 26 },
  { x: 48, y: 30 },
  { x: 128, y: 26 },
  { x: 212, y: 30 },
  { x: 296, y: 26 },
  { x: 362, y: 30 },
];
export const BRAZIER_POS: Pt[] = [
  { x: -18, y: 42 },
  { x: 70, y: 42 },
  { x: 190, y: 42 },
  { x: 222, y: 42 },
  { x: 284, y: 42 },
];
const LAVA_FALL_X = [-52, 148, 250];

interface Light {
  x: number;
  y: number;
  rx: number;
  ry: number;
  k: number;
  tone: string;
  ring?: string;
}
const WARM = "#e0922e";
const MOON = "#9cc0ff";
const TEAL = "#4fd0c4";
const LAVA_LIGHT = "#ff5a2a";
const FLOOR_LIGHTS: Light[][] = [
  [
    ...TORCH_POS.map((pos) => ({ x: pos.x, y: 78, rx: 52, ry: 36, k: 1, tone: WARM, ring: "#6a4c30" })),
    { x: -76, y: 86, rx: 46, ry: 30, k: 0.9, tone: "#bfe0ff" },
    { x: 130, y: 106, rx: 24, ry: 13, k: 1.7, tone: MOON, ring: "#3c5280" },
    { x: 358, y: 100, rx: 28, ry: 14, k: 1.7, tone: MOON, ring: "#3c5280" },
    { x: 168, y: 74, rx: 62, ry: 16, k: 0.6, tone: "#7ccb62" },
    { x: 290, y: 74, rx: 52, ry: 16, k: 0.7, tone: LAVA_LIGHT },
  ],
  [
    ...LANTERN_POS.map((pos) => ({ x: pos.x, y: 84, rx: 46, ry: 32, k: 0.95, tone: TEAL, ring: "#1f6462" })),
    { x: 168, y: 70, rx: 250, ry: 15, k: 0.7, tone: "#5fd0c0" },
  ],
  [
    { x: -64, y: 80, rx: 56, ry: 28, k: 1, tone: LAVA_LIGHT },
    { x: 154, y: 80, rx: 46, ry: 26, k: 1, tone: LAVA_LIGHT },
    { x: 250, y: 80, rx: 46, ry: 26, k: 1, tone: LAVA_LIGHT },
    ...BRAZIER_POS.map((pos) => ({ x: pos.x, y: 80, rx: 46, ry: 32, k: 0.85, tone: "#ff8a2a", ring: "#7a3818" })),
    { x: 262, y: 132, rx: 86, ry: 52, k: 0.5, tone: "#c0301a" },
    { x: 336, y: 92, rx: 50, ry: 22, k: 0.55, tone: "#d94a1e" },
  ],
];
const WALL_LIGHTS: Light[][] = [
  [
    ...TORCH_POS.map((pos) => ({ x: pos.x, y: pos.y - 4, rx: 30, ry: 34, k: 1, tone: WARM })),
    { x: -76, y: 28, rx: 44, ry: 40, k: 0.8, tone: "#bfe0ff" },
  ],
  LANTERN_POS.map((pos) => ({ x: pos.x, y: pos.y + 6, rx: 36, ry: 36, k: 0.9, tone: TEAL })),
  [
    ...BRAZIER_POS.map((pos) => ({ x: pos.x, y: pos.y - 4, rx: 32, ry: 34, k: 0.9, tone: "#ff8a2a" })),
    ...LAVA_FALL_X.map((x) => ({ x: x + 6, y: 30, rx: 30, ry: 44, k: 0.9, tone: LAVA_LIGHT })),
  ],
];
const DEEP = ["#07070f", "#04090c", "#080308"];

const lightOf = (lights: Light[], x: number, y: number) => {
  let amount = 0,
    best = 0,
    tone = lights[0].tone;
  for (const light of lights) {
    const dx = (x - light.x) / light.rx,
      dy = (y - light.y) / light.ry;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist >= 1) continue;
    const weight = (1 - dist) * light.k;
    amount += weight;
    if (weight > best) {
      best = weight;
      tone = light.tone;
    }
  }
  return { lit: Math.min(1, amount), tone };
};
const toneAt = (
  lights: Light[],
  floor: number,
  x: number,
  y: number,
  base: string,
  dark: number,
  cap: number,
): string => {
  const { lit, tone } = lightOf(lights, x, y);
  const bx = blockOf(x),
    by = blockOf(y);
  const litQ = Math.floor(lit * 5 + bayer(bx, by)) / 5;
  const darkQ = Math.floor(dark * (1 - lit) * 5 + bayer(bx + 2, by + 1)) / 5;
  const shaded = darkQ > 0 ? mixHex(base, DEEP[floor - 1], darkQ) : base;
  return litQ > 0 ? mixHex(shaded, tone, Math.min(cap, litQ * 0.5)) : shaded;
};
/** a floor tile pixel's colour: darker far from the lights (and at the edges), warm or cold pools near them, all dithered */
export const floorTone = (floor: number, x: number, y: number, base: string): string => {
  const edge = Math.abs(x - MID_X) / (VIEW_W / 2);
  const dark = clamp(0.1 + ((y - WALL_BASE) / 150) * 0.26 + edge * edge * 0.16, 0, 0.5);
  return toneAt(FLOOR_LIGHTS[floor - 1], floor, x, y, base, dark, 0.55);
};
/** a wall stone's colour: torch light cones, dark at the ceiling and in the corners */
export const wallTone = (floor: number, x: number, y: number, base: string): string => {
  const edge = Math.abs(x - MID_X) / (VIEW_W / 2);
  const dark = clamp(0.1 + Math.max(0, 1 - y / 26) * 0.28 + edge * edge * 0.12, 0, 0.5);
  return toneAt(WALL_LIGHTS[floor - 1], floor, x, y, base, dark, 0.3);
};

// ---- wall palettes (the stone around the far openings) -----------------------------------------------------------
const WALLS = [
  { tones: ["#2b2d3d", "#303346", "#262838", "#343749"], hi: "#454a60", mortar: "#14121f" },
  { tones: ["#1d2a30", "#203239", "#1a262b", "#24363d"], hi: "#3f5a63", mortar: "#0a1216" },
  { tones: ["#241218", "#2a161c", "#1e0f14", "#301a21"], hi: "#52303a", mortar: "#0c0609" },
];
const IRON = "#5a5e6b",
  IRON_HI = "#8d93a0",
  IRON_DARK = "#3a3d4a";
const BONE = "#e8e0cc",
  BONE_DARK = "#b9ae94";
const GOLD = "#c9962a";

// ---- far vaults seen through broken walls ------------------------------------------------------------------------
type OpeningKind = "vault" | "breach" | "mural";
interface Opening {
  x: number;
  w: number;
  y: number;
  h: number;
  kind: OpeningKind;
  rubble?: boolean;
  statue?: boolean;
}
const OPENINGS: Opening[][] = [
  [
    { x: 114, w: 32, y: 10, h: 48, kind: "vault", statue: true },
    { x: 192, w: 40, y: 10, h: 46, kind: "mural" },
    { x: 340, w: 40, y: 10, h: 48, kind: "breach", rubble: true },
  ],
  [
    { x: 56, w: 30, y: 10, h: 48, kind: "vault", statue: true },
    { x: 108, w: 38, y: 10, h: 48, kind: "vault" },
    { x: 194, w: 38, y: 10, h: 48, kind: "vault", statue: true },
    { x: 256, w: 42, y: 10, h: 48, kind: "vault" },
  ],
  [{ x: 84, w: 42, y: 8, h: 50, kind: "vault", rubble: true, statue: true }],
];
/** [bg, far, mid, near, hi, glow dim, glow, floor] */
const FAR = [
  ["#08070f", "#100f1d", "#16162a", "#1d1e35", "#2a2c48", "#3a2a1c", "#7a5428", "#0d0c18"],
  ["#050d10", "#0b1a1f", "#102429", "#17323a", "#24505a", "#12403f", "#2c9a90", "#08161a"],
  ["#0a0306", "#1a0a12", "#241018", "#34161f", "#5a2230", "#701c0c", "#d4480f", "#12060b"],
];
const archOutline = (ctx: Ctx, cx: number, top: number, half: number, color: string, thick = 1) => {
  for (let row = 0; row < half; row++) {
    const dx = Math.round(Math.sqrt(half * half - (half - row) * (half - row)));
    rect(ctx, color, cx - dx, top + row, thick, 1);
    rect(ctx, color, cx + dx - thick + 1, top + row, thick, 1);
  }
};
const gargoyle = (ctx: Ctx, x: number, y: number, color: string, hi: string, flip: boolean) => {
  const dir = flip ? -1 : 1;
  const at = (dx: number, width: number) => (dir > 0 ? x + dx : x - dx - width + 1);
  rect(ctx, color, at(0, 8), y + 5, 8, 5); // crouched body
  rect(ctx, color, at(1, 6), y + 2, 6, 4);
  rect(ctx, color, at(6, 4), y + 1, 4, 4); // head
  rect(ctx, color, at(7, 1), y - 1, 1, 3); // horns
  rect(ctx, color, at(10, 1), y - 1, 1, 3);
  rect(ctx, color, at(-3, 5), y + 1, 4, 5); // folded wing
  rect(ctx, color, at(-4, 2), y - 2, 2, 4);
  rect(ctx, hi, at(1, 6), y + 2, 6, 1);
  rect(ctx, hi, at(7, 3), y + 1, 3, 1);
  rect(ctx, color, at(0, 10), y + 10, 10, 2); // plinth
  rect(ctx, hi, at(0, 10), y + 10, 10, 1);
};
const drawVault = (ctx: Ctx, floor: number, opening: Opening) => {
  const [bg, far, mid, near, hi, glowDim, glow, flr] = FAR[floor - 1];
  const { x, y, w, h } = opening;
  const cx = x + (w >> 1),
    horizon = y + h - 9;
  rect(ctx, bg, x, y, w, h);
  if (opening.kind === "breach") {
    rect(ctx, "#18223f", x + 3, y, w - 6, 13);
    rect(ctx, "#223056", x + 5, y + 6, w - 10, 7);
    for (const [sx, sy] of [
      [6, 2],
      [17, 5],
      [30, 3],
    ])
      rect(ctx, "#cfe0ff", x + sx, y + sy, 1, 1);
    rect(ctx, "#e8f0ff", x + w - 12, y + 3, 4, 4); // the moon through the hole
    rect(ctx, "#223056", x + w - 11, y + 3, 3, 3);
  } else {
    // the deepest bay: small arches receding into the dark
    for (let bx = x + 3; bx < x + w - 6; bx += 8) {
      archOutline(ctx, bx + 3, y + 9, 3, far);
      rect(ctx, far, bx, y + 12, 1, horizon - y - 12);
      rect(ctx, far, bx + 6, y + 12, 1, horizon - y - 12);
    }
    rect(ctx, glowDim, cx - 3, horizon - 10, 6, 10); // a far doorway with a lantern beyond
    rect(ctx, glow, cx - 1, horizon - 7, 2, 7);
  }
  rect(ctx, flr, x, horizon, w, 9);
  rect(ctx, glowDim, x, horizon, w, 1); // the far floor catches the distant light
  for (let k = 0; k < 3; k++) rect(ctx, far, x, horizon + 1 + k * 3, w, 1);
  for (let lx = x + 4; lx < x + w - 3; lx += 6) rect(ctx, mid, lx, horizon + 3, 1, 6);
  // the nearer span: a big arch on columns
  const half = (w >> 1) - 3;
  archOutline(ctx, cx, y + 4, half, mid, 2);
  rect(ctx, mid, x + 3, y + 4 + half, 2, horizon - y - 4 - half);
  rect(ctx, mid, x + w - 5, y + 4 + half, 2, horizon - y - 4 - half);
  // the nearest columns, framing it
  for (const colX of [x + 1, x + w - 5]) {
    rect(ctx, near, colX, y + 2, 4, h - 2);
    rect(ctx, hi, colX, y + 2, 1, h - 2);
    rect(ctx, mid, colX - 1, y + 12, 6, 2);
    rect(ctx, mid, colX - 1, horizon - 3, 6, 3);
  }
  if (opening.statue) gargoyle(ctx, x + 7, horizon - 13, near, hi, floor === 2);
};
const drawMural = (ctx: Ctx, opening: Opening) => {
  const { x, y, w, h } = opening;
  rect(ctx, "#0c0609", x - 1, y - 1, w + 2, h + 2);
  rect(ctx, GOLD, x, y, w, h);
  rect(ctx, "#1f1218", x + 2, y + 2, w - 4, h - 4);
  rect(ctx, "#2a1820", x + 2, y + 2, w - 4, 4);
  const cx = x + (w >> 1);
  // the Lord: a halo, horns, a long cape, his blade planted before him
  rect(ctx, "#8a6a1c", cx - 6, y + 6, 12, 1);
  rect(ctx, "#8a6a1c", cx - 7, y + 7, 1, 8);
  rect(ctx, "#8a6a1c", cx + 6, y + 7, 1, 8);
  rect(ctx, "#8a6a1c", cx - 6, y + 15, 12, 1);
  rect(ctx, "#4a1822", cx - 4, y + 8, 8, 7);
  rect(ctx, "#6e2432", cx - 4, y + 8, 2, 7);
  rect(ctx, "#4a1822", cx - 7, y + 4, 2, 5);
  rect(ctx, "#4a1822", cx + 5, y + 4, 2, 5);
  rect(ctx, "#c23a30", cx - 3, y + 11, 2, 1);
  rect(ctx, "#c23a30", cx + 1, y + 11, 2, 1);
  rect(ctx, "#4a1822", cx - 6, y + 16, 12, 16);
  rect(ctx, "#6e2432", cx - 6, y + 16, 3, 16);
  rect(ctx, "#331019", cx - 9, y + 28, 18, 4);
  rect(ctx, "#8d93a0", cx - 1, y + 20, 2, 18);
  rect(ctx, "#a8764a", cx - 3, y + 25, 6, 1);
  // little kneeling worshippers
  for (const px of [4, 10, 28, 34]) {
    rect(ctx, "#3a2a1e", x + px, y + h - 9, 3, 2);
    rect(ctx, "#2a1c14", x + px, y + h - 7, 4, 3);
  }
  // flaking paint and old cracks
  for (let k = 0; k < 9; k++)
    rect(ctx, "#0c0609", x + 3 + (hash(k, 9) % (w - 7)), y + 3 + (hash(k, 5) % (h - 7)), 2, 1);
  rect(ctx, "#0c0609", x + 12, y + 18, 1, 9);
  rect(ctx, "#0c0609", x + 13, y + 26, 1, 8);
};
/** knock the opening's edge into broken stone: ragged sides, a rounded top */
const jag = (ctx: Ctx, floor: number, opening: Opening) => {
  const wall = WALLS[floor - 1];
  const { x, y, w, h } = opening;
  const stone = (px: number, py: number, pw: number, ph: number) => {
    rect(ctx, wall.mortar, px - 1, py - 1, pw + 2, ph + 2);
    rect(ctx, pick(wall.tones, px, py), px, py, pw, ph);
    rect(ctx, wall.hi, px, py, pw, 1);
  };
  const insets = [7, 4, 3, 2, 1, 1];
  insets.forEach((inset, row) => {
    stone(x, y + row, inset, 1);
    stone(x + w - inset, y + row, inset, 1);
  });
  for (let py = y + 6; py < y + h; py += 3) {
    stone(x - 1, py, 1 + (hash(py, x) % 3), 3);
    stone(x + w - (hash(x, py) % 3), py, 2 + (hash(py, 3) % 2), 3);
  }
  rect(ctx, wall.hi, x - 2, y + h, w + 4, 1);
  rect(ctx, wall.mortar, x - 2, y + h + 1, w + 4, 2);
  rect(ctx, pick(wall.tones, x, 2), x - 2, y + h - 1, w + 4, 1);
};
const rubblePile = (ctx: Ctx, floor: number, opening: Opening) => {
  const wall = WALLS[floor - 1];
  const base = WALL_BASE + 7;
  for (let k = 0; k < 14; k++) {
    const px = opening.x - 2 + (hash(k, opening.x) % opening.w);
    const py = base - (hash(k, 3) % 6) + (k % 2) * 2;
    const pw = 3 + (hash(k, 7) % 4);
    rect(ctx, wall.mortar, px - 1, py - 1, pw + 2, 5);
    rect(ctx, pick(wall.tones, px, py), px, py, pw, 3);
    rect(ctx, wall.hi, px, py, pw, 1);
  }
};
const RUBBLE_BOX = (opening: Opening): Box => ({ x: opening.x - 4, y: WALL_BASE - 2, w: opening.w + 10, h: 13 });

// ---- hand-built props -------------------------------------------------------------------------------------------
const candle = (ctx: Ctx, x: number, y: number) => {
  rect(ctx, "#14121f", x - 1, y + 1, 4, 6);
  rect(ctx, "#f4e3c1", x, y + 2, 2, 4);
  rect(ctx, "#fff6e0", x, y + 2, 1, 4);
  rect(ctx, "#6b4a2a", x - 1, y + 6, 4, 1);
};
const niche = (ctx: Ctx, floor: number, x: number, y: number, width: number, height: number, skullToo: boolean) => {
  const wall = WALLS[floor - 1];
  rect(ctx, wall.mortar, x - 1, y - 1, width + 2, height + 2);
  rect(ctx, "#08060c", x, y, width, height);
  rect(ctx, wall.mortar, x, y, 2, 2);
  rect(ctx, wall.mortar, x + width - 2, y, 2, 2);
  rect(ctx, wall.hi, x - 1, y + height, width + 2, 2);
  candle(ctx, x + 2, y + height - 8);
  candle(ctx, x + width - 4, y + height - 6);
  if (skullToo) {
    rect(ctx, BONE, x + (width >> 1) - 2, y + height - 7, 4, 3);
    rect(ctx, "#08060c", x + (width >> 1) - 1, y + height - 6, 1, 1);
    rect(ctx, "#08060c", x + (width >> 1) + 1, y + height - 6, 1, 1);
  }
};
const root = (ctx: Ctx, x: number, length: number) => {
  let rx = x;
  for (let y = 3; y < 3 + length; y++) {
    if (y % 4 === 0) rx += (hash(x, y) % 3) - 1;
    rect(ctx, "#3a2a1e", rx, y, y < length / 2 ? 2 : 1, 1);
    if (y % 5 === 0) rect(ctx, "#5a4230", rx, y, 1, 1);
    if (y % 7 === 0) rect(ctx, "#3f6a3a", rx + 1, y, 2, 1);
  }
};
const grate = (ctx: Ctx, x: number, y: number) => {
  rect(ctx, "#0c0609", x - 1, y - 1, 18, 10);
  rect(ctx, "#0e2a14", x, y, 16, 8);
  for (let gx = x + 1; gx < x + 16; gx += 3) rect(ctx, IRON, gx, y, 1, 8);
  rect(ctx, IRON_DARK, x, y + 3, 16, 1);
  rect(ctx, IRON_HI, x, y, 16, 1);
};
const cage = (ctx: Ctx, x: number, y: number, dx: number, eyes: string) => {
  // a chain from the ceiling and an iron cage that sways on it
  for (let k = 0; k < y; k += 3) {
    const cx = x + Math.round((dx * k) / y);
    rect(ctx, IRON_HI, cx, k, 1, 2);
    rect(ctx, IRON_DARK, cx, k + 2, 1, 1);
  }
  const cx = x + dx;
  rect(ctx, "#0c0609", cx - 6, y - 1, 12, 17);
  rect(ctx, IRON, cx - 5, y, 10, 2);
  for (let bx = cx - 5; bx <= cx + 4; bx += 3) rect(ctx, IRON, bx, y + 2, 1, 11);
  rect(ctx, "#0a080e", cx - 4, y + 2, 8, 11);
  for (let bx = cx - 5; bx <= cx + 4; bx += 3) rect(ctx, IRON_HI, bx, y + 2, 1, 11);
  rect(ctx, IRON_DARK, cx - 5, y + 13, 10, 2);
  if (eyes) {
    rect(ctx, eyes, cx - 2, y + 7, 1, 1);
    rect(ctx, eyes, cx + 1, y + 7, 1, 1);
  } else {
    rect(ctx, BONE, cx - 2, y + 9, 4, 4);
    rect(ctx, "#0a080e", cx - 1, y + 10, 1, 1);
    rect(ctx, "#0a080e", cx + 1, y + 10, 1, 1);
  }
};

// ---- floor props (solid: they stay in the strips clear of every spot) ---------------------------------------------
const sword = (ctx: Ctx, x: number, y: number) => {
  rect(ctx, IRON_DARK, x, y + 1, 10, 1);
  rect(ctx, IRON_HI, x + 1, y, 8, 1);
  rect(ctx, "#6e4a36", x + 10, y, 1, 3);
  rect(ctx, GOLD, x + 11, y + 1, 3, 1);
};
const shield = (ctx: Ctx, x: number, y: number) => {
  rect(ctx, "#14121f", x - 1, y - 1, 10, 10);
  rect(ctx, "#6e4a36", x, y, 8, 8);
  rect(ctx, "#8b5e3c", x, y, 8, 1);
  rect(ctx, IRON, x + 3, y + 3, 2, 2);
  rect(ctx, "#14121f", x + 5, y, 1, 4); // split
  rect(ctx, "#14121f", x + 4, y + 4, 1, 3);
};
const axe = (ctx: Ctx, x: number, y: number) => {
  rect(ctx, "#6e4a36", x, y + 3, 10, 1);
  rect(ctx, IRON, x + 6, y, 3, 6);
  rect(ctx, IRON_HI, x + 6, y, 1, 6);
};
const spear = (ctx: Ctx, x: number, y: number) => {
  rect(ctx, "#6e4a36", x, y + 1, 11, 1);
  rect(ctx, IRON_HI, x + 11, y, 4, 3);
  rect(ctx, IRON_DARK, x + 14, y + 1, 1, 1);
};
const helmet = (ctx: Ctx, x: number, y: number) => {
  rect(ctx, "#14121f", x - 1, y - 1, 10, 8);
  rect(ctx, IRON, x, y, 8, 5);
  rect(ctx, IRON_HI, x + 1, y, 5, 1);
  rect(ctx, "#08060c", x + 2, y + 3, 4, 1);
  rect(ctx, "#8a4a2a", x + 3, y - 2, 2, 2);
};
const plank = (ctx: Ctx, x: number, y: number) => {
  rect(ctx, "#2a1c14", x, y + 3, 16, 1);
  rect(ctx, "#5a3d2b", x, y, 16, 3);
  rect(ctx, "#7a553b", x, y, 16, 1);
  rect(ctx, "#8a8f9c", x + 3, y + 1, 1, 1);
  rect(ctx, "#8a8f9c", x + 12, y + 1, 1, 1);
};
const shard = (ctx: Ctx, x: number, y: number, height: number) => {
  rect(ctx, "#0c0609", x - 1, y - 1, 8, height + 3);
  for (let k = 0; k < height; k++) {
    const half = Math.min(3, 1 + Math.floor(k / 3));
    rect(ctx, k % 2 ? "#241c40" : "#3f3560", x + 3 - half, y + k, half * 2, 1);
    rect(ctx, "#8a7cc0", x + 3 - half, y + k, 1, 1);
  }
};
const pit = (ctx: Ctx, floor: number, x: number, y: number) => {
  const wall = WALLS[floor - 1];
  rect(ctx, wall.mortar, x, y, 20, 12);
  rect(ctx, "#030206", x + 2, y + 2, 15, 8);
  rect(ctx, "#0a0810", x + 2, y + 2, 15, 2);
  for (const [px, py] of [
    [0, 0],
    [16, 0],
    [0, 8],
    [15, 9],
  ])
    rect(ctx, pick(wall.tones, x + px, y + py), x + px, y + py, 4, 3);
  rect(ctx, wall.hi, x + 5, y + 8, 3, 1);
};
const STRIP: { floor: number; kind: string; x: number; y: number; w: number; h: number }[] = [
  { floor: 1, kind: "sword", x: 12, y: 200, w: 14, h: 3 },
  { floor: 1, kind: "shield", x: 92, y: 196, w: 8, h: 8 },
  { floor: 1, kind: "axe", x: 186, y: 198, w: 10, h: 6 },
  { floor: 1, kind: "spear", x: 232, y: 197, w: 15, h: 3 },
  { floor: 1, kind: "helmet", x: 346, y: 204, w: 8, h: 6 },
  { floor: 1, kind: "pit", x: 34, y: 196, w: 20, h: 12 },
  { floor: 1, kind: "pit", x: 274, y: 196, w: 20, h: 12 },
  { floor: 2, kind: "plank", x: 20, y: 198, w: 16, h: 4 },
  { floor: 2, kind: "sword", x: 90, y: 204, w: 14, h: 3 },
  { floor: 2, kind: "shield", x: 178, y: 198, w: 8, h: 8 },
  { floor: 2, kind: "plank", x: 276, y: 198, w: 16, h: 4 },
  { floor: 2, kind: "helmet", x: 346, y: 204, w: 8, h: 6 },
  { floor: 2, kind: "pit", x: 34, y: 196, w: 20, h: 12 },
  { floor: 3, kind: "shard", x: -28, y: 198, w: 6, h: 11 },
  { floor: 3, kind: "shard", x: 34, y: 202, w: 6, h: 8 },
  { floor: 3, kind: "shard", x: 92, y: 197, w: 6, h: 12 },
  { floor: 3, kind: "shard", x: 168, y: 201, w: 6, h: 9 },
  { floor: 3, kind: "sword", x: 120, y: 204, w: 14, h: 3 },
  { floor: 3, kind: "axe", x: 214, y: 199, w: 10, h: 6 },
  { floor: 3, kind: "shard", x: 306, y: 198, w: 6, h: 11 },
  { floor: 3, kind: "pit", x: 54, y: 196, w: 20, h: 12 },
];
const stripProp = (ctx: Ctx, floor: number, piece: (typeof STRIP)[number]) => {
  switch (piece.kind) {
    case "sword":
      return sword(ctx, piece.x, piece.y);
    case "shield":
      return shield(ctx, piece.x, piece.y);
    case "axe":
      return axe(ctx, piece.x, piece.y);
    case "spear":
      return spear(ctx, piece.x, piece.y);
    case "helmet":
      return helmet(ctx, piece.x, piece.y);
    case "plank":
      return plank(ctx, piece.x, piece.y);
    case "shard":
      return shard(ctx, piece.x, piece.y, piece.h);
    default:
      return pit(ctx, floor, piece.x, piece.y);
  }
};
const STATUES = [
  { floor: 2, x: 119, y: 38 },
  { floor: 2, x: 269, y: 38 },
];
/** the solid props the ambience adds to the floor and the wall base: tests keep them off every spot and the Lord's area */
export const AMBIENCE_PROPS: Prop[] = [
  ...STRIP.map((prop) => ({ ...prop, y: prop.y - 1, h: prop.h + 2 })),
  ...OPENINGS.flatMap((list, index) =>
    list
      .filter((opening) => opening.rubble)
      .map((opening) => ({ floor: index + 1, kind: "rubble", ...RUBBLE_BOX(opening) })),
  ),
  ...STATUES.map((statue) => ({ ...statue, kind: "statue", w: 14, h: 32 })),
];

// ---- floor decals ------------------------------------------------------------------------------------------------
export const PUDDLES: Box[] = Array.from({ length: 16 }, (_, i) => ({
  x: VIEW_X0 + 16 + (hash(i, 31) % (VIEW_W - 40)),
  y: 84 + (hash(i, 17) % 110),
  w: 10 + (hash(i, 3) % 12),
  h: 4,
}));
const WATER = ["#1d5f6e", "#2f9aa0", "#5fd0c0", "#b8f5e0"];
const crack = (ctx: Ctx, color: string, x: number, y: number, length: number, seed: number) => {
  let cx = x,
    cy = y;
  for (let k = 0; k < length; k++) {
    rect(ctx, color, cx, cy, 1, 1);
    const roll = hash(seed, k) % 5;
    if (roll < 2) cx += 1;
    else if (roll < 3) cx -= 1;
    else cy += 1;
  }
};
const mossPatch = (ctx: Ctx, tones: string[], x: number, y: number, width: number, height: number, seed: number) => {
  for (let k = 0; k < width * height * 0.5; k++) {
    const px = x + (hash(seed, k) % width),
      py = y + (hash(k, seed) % height);
    rect(ctx, tones[hash(px, py) % tones.length], px, py, 1 + (k % 2), 1);
  }
};
interface Runes {
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  dim: string;
  glow: string[];
}
const RUNES: Runes[][] = [
  [
    { cx: 172, cy: 142, rx: 44, ry: 22, dim: "#2a3868", glow: ["#3f5aa8", "#6f95e8", "#bfd8ff"] },
    { cx: 52, cy: 170, rx: 24, ry: 12, dim: "#2a3868", glow: ["#3f5aa8", "#6f95e8", "#bfd8ff"] },
  ],
  [{ cx: 160, cy: 138, rx: 44, ry: 22, dim: "#1c4c4c", glow: ["#2c8a84", "#5fd0c0", "#d8fff6"] }],
  [{ cx: 262, cy: 136, rx: 56, ry: 26, dim: "#4a1224", glow: ["#8a1c2c", "#d0382a", "#ff9a50"] }],
];
const GLYPHS = 8;
const glyphPos = (rune: Runes, k: number): Pt => {
  const angle = (k / GLYPHS) * Math.PI * 2 + 0.3;
  return {
    x: Math.round(rune.cx + Math.cos(angle) * rune.rx * 0.85),
    y: Math.round(rune.cy + Math.sin(angle) * rune.ry * 0.85),
  };
};
const runeCircle = (ctx: Ctx, rune: Runes) => {
  for (let deg = 0; deg < 360; deg += 3) {
    const rad = (deg * Math.PI) / 180;
    rect(
      ctx,
      rune.dim,
      Math.round(rune.cx + Math.cos(rad) * rune.rx),
      Math.round(rune.cy + Math.sin(rad) * rune.ry),
      1,
      1,
    );
    if (deg % 6 === 0)
      rect(
        ctx,
        rune.dim,
        Math.round(rune.cx + Math.cos(rad) * rune.rx * 0.7),
        Math.round(rune.cy + Math.sin(rad) * rune.ry * 0.7),
        1,
        1,
      );
  }
  for (let k = 0; k < GLYPHS; k++) {
    const { x, y } = glyphPos(rune, k);
    rect(ctx, rune.dim, x - 1, y - 1, 3, 3);
    rect(ctx, "#08070c", x, y, 1, 1);
  }
  // an inner star
  for (let k = 0; k < 5; k++) {
    const a1 = (k / 5) * Math.PI * 2 - Math.PI / 2,
      a2 = (((k + 2) % 5) / 5) * Math.PI * 2 - Math.PI / 2;
    for (let step = 0; step < 14; step++) {
      const frac = step / 14;
      const px = rune.cx + (Math.cos(a1) * (1 - frac) + Math.cos(a2) * frac) * rune.rx * 0.5;
      const py = rune.cy + (Math.sin(a1) * (1 - frac) + Math.sin(a2) * frac) * rune.ry * 0.5;
      rect(ctx, rune.dim, Math.round(px), Math.round(py), 1, 1);
    }
  }
};
const runnerSegment = (ctx: Ctx, x0: number, x1: number, y: number) => {
  for (let x = x0; x < x1; x += 2) {
    if (x < x0 + 8 && hash(x, y) % 3 === 0) continue; // frayed ends
    if (x > x1 - 8 && hash(y, x) % 3 === 0) continue;
    if (hash(x, 6) % 17 === 0) continue; // holes
    rect(ctx, "#3e1c26", x, y, 2, 12);
    rect(ctx, "#5a2634", x, y + 2, 2, 8);
  }
  for (let x = x0 + 4; x < x1 - 4; x += 2) {
    rect(ctx, GOLD, x, y + 1, 2, 1);
    rect(ctx, GOLD, x, y + 10, 2, 1);
  }
};
const veins = (ctx: Ctx) => {
  for (let i = 0; i < 12; i++) {
    const x = VIEW_X0 + 16 + (hash(i, 77) % (VIEW_W - 40)),
      y = 76 + (hash(i, 78) % 126);
    crack(ctx, "#6e1a14", x, y, 14 + (hash(i, 5) % 10), i + 40);
    crack(ctx, "#d0382a", x, y, 9 + (hash(i, 6) % 6), i + 40);
  }
};

/** loose stones and grit scattered over the flagstones (flat: they never block anything) */
const pebbles = (ctx: Ctx, floor: number) => {
  const wall = WALLS[floor - 1];
  for (let i = 0; i < 34; i++) {
    const x = VIEW_X0 + 8 + (hash(i, 61) % (VIEW_W - 20)),
      y = 70 + (hash(i, 62) % 136);
    const size = 2 + (hash(i, 63) % 3);
    rect(ctx, wall.mortar, x - 1, y + 1, size + 2, 2);
    rect(ctx, pick(wall.tones, x, y), x, y, size, 2);
    rect(ctx, wall.hi, x, y, size, 1);
  }
};

export const buildFloorDecor = (ctx: Ctx, floor: number) => {
  const mortar = WALLS[floor - 1].mortar;
  pebbles(ctx, floor);
  if (floor === 3) veins(ctx);
  else
    for (let i = 0; i < 16; i++) {
      const x = VIEW_X0 + 14 + (hash(i, 41) % (VIEW_W - 30)),
        y = 70 + (hash(i, 42) % 130);
      crack(ctx, mortar, x, y, 7 + (hash(i, 8) % 9), i);
    }
  if (floor === 1) {
    mossPatch(ctx, ["#2f4a2c", "#3e5e36", "#243c24"], 6, 66, 26, 8, 1);
    mossPatch(ctx, ["#2f4a2c", "#3e5e36", "#243c24"], 150, 70, 28, 6, 2);
    mossPatch(ctx, ["#2f4a2c", "#3e5e36", "#243c24"], 236, 196, 30, 10, 3);
    mossPatch(ctx, ["#2f4a2c", "#3e5e36", "#243c24"], -20, 196, 18, 10, 4);
    runnerSegment(ctx, -64, 40, 152);
    runnerSegment(ctx, 74, 138, 152);
    runnerSegment(ctx, 300, 372, 176);
    // a root forcing up through the flagstones
    root(ctx, -2, 3);
  }
  if (floor === 2) {
    PUDDLES.forEach((puddle, i) => {
      rect(ctx, mortar, puddle.x - 1, puddle.y - 1, puddle.w + 2, puddle.h + 2);
      rect(ctx, WATER[0], puddle.x, puddle.y, puddle.w, puddle.h);
      rect(ctx, WATER[1], puddle.x + 1, puddle.y, puddle.w - 2, 1);
      rect(ctx, WATER[2], puddle.x + 3, puddle.y + 2, 3, 1);
      if (i % 2) rect(ctx, "#2a5a48", puddle.x - 3, puddle.y + 3, 4, 1); // algae creeping out of it
    });
    mossPatch(ctx, ["#1f4a44", "#2a5a52", "#16363a"], 0, 70, 40, 6, 5);
    mossPatch(ctx, ["#1f4a44", "#2a5a52", "#16363a"], 180, 196, 40, 10, 6);
  }
  if (floor === 3) {
    mossPatch(ctx, ["#3a1a20", "#4a2228"], 20, 190, 40, 12, 9);
  }
  for (const rune of RUNES[floor - 1]) runeCircle(ctx, rune);
};

// ---- wall decor (drawn before the existing props, which may overpaint it) -----------------------------------------
const obsidianColumn = (ctx: Ctx, x: number) => {
  const OBS = ["#3f3560", "#5a4e86", "#241c40", "#8a7cc0"];
  rect(ctx, "#0c0609", x - 1, 0, 14, WALL_BASE + 2);
  rect(ctx, OBS[2], x, 0, 12, WALL_BASE + 1);
  rect(ctx, OBS[0], x + 2, 0, 8, WALL_BASE + 1);
  rect(ctx, OBS[1], x + 2, 0, 2, WALL_BASE + 1);
  rect(ctx, OBS[3], x + 2, 0, 1, WALL_BASE + 1);
  rect(ctx, "#150f26", x + 9, 0, 3, WALL_BASE + 1);
  for (const by of [10, 26, 42]) {
    rect(ctx, OBS[2], x - 1, by, 14, 3);
    rect(ctx, OBS[1], x - 1, by, 14, 1);
  }
  rect(ctx, OBS[2], x - 2, WALL_BASE - 5, 16, 6);
  rect(ctx, OBS[1], x - 2, WALL_BASE - 5, 16, 1);
  rect(ctx, "#c23a30", x + 5, 20, 2, 3); // a gem sunk in the stone
  rect(ctx, "#ff9a50", x + 5, 20, 1, 1);
};
const demonSkullRelief = (ctx: Ctx) => {
  const cx = 336;
  const stone = "#2c1820",
    hi = "#52303a",
    deep = "#0c0609";
  // curling horns reaching past the throne
  for (const side of [-1, 1]) {
    for (let k = 0; k < 18; k++) {
      const hx = cx + side * (40 + Math.round(k * 1.1)),
        hy = 30 - k;
      rect(ctx, deep, hx - 1, hy - 1, 6, 4);
      rect(ctx, stone, hx, hy, 4, 2);
      rect(ctx, hi, hx + (side > 0 ? 0 : 3), hy, 1, 1);
    }
  }
  rect(ctx, deep, cx - 38, 2, 76, 52);
  rect(ctx, stone, cx - 36, 3, 72, 50);
  rect(ctx, hi, cx - 36, 3, 72, 1);
  rect(ctx, "#1c0f14", cx - 30, 16, 22, 14); // sockets
  rect(ctx, "#1c0f14", cx + 8, 16, 22, 14);
  rect(ctx, "#3a1218", cx - 26, 20, 14, 8);
  rect(ctx, "#3a1218", cx + 12, 20, 14, 8);
  rect(ctx, "#7a1a14", cx - 22, 22, 6, 4);
  rect(ctx, "#7a1a14", cx + 16, 22, 6, 4);
  rect(ctx, deep, cx - 4, 32, 8, 8);
  for (let k = -5; k <= 5; k++) {
    rect(ctx, BONE_DARK, cx + k * 6 - 1, 46, 4, 7);
    rect(ctx, deep, cx + k * 6 + 3, 46, 1, 7);
  }
};
const frieze = (ctx: Ctx, floor: number) => {
  const lo = ["#1c1b2b", "#0e1c22", "#190d11"][floor - 1],
    hiTone = ["#3a3e54", "#2a4a54", "#3a1e26"][floor - 1];
  for (let x = VIEW_X0 + 3; x < X_END - 6; x += 6) {
    if (hash(x, 4) % 7 === 0) continue;
    rect(ctx, lo, x, 52, 4, 5);
    rect(ctx, hiTone, x, 52, 4, 1);
    rect(ctx, hiTone, x + (hash(x, 1) % 3), 54, 1, 2);
    rect(ctx, hiTone, x + 1 + (hash(x, 2) % 2), 55, 2, 1);
  }
  rect(ctx, hiTone, VIEW_X0, 51, VIEW_W, 1);
};
const stains = (ctx: Ctx) => {
  // the flood line: dark wet stone with trickles running down
  rect(ctx, "#12262c", VIEW_X0, 48, VIEW_W, 11);
  for (let x = VIEW_X0 + 2; x < X_END; x += 5) {
    const len = 4 + (hash(x, 9) % 10);
    rect(ctx, "#18343c", x, 40 - (hash(x, 3) % 8), 1, len + 8);
  }
};
const lavaCracks = (ctx: Ctx) => {
  for (const [cx, cy, len] of [
    [-30, 8, 22],
    [60, 4, 26],
    [128, 40, 14],
    [200, 6, 28],
    [236, 10, 20],
  ]) {
    crack(ctx, "#6e1a14", cx, cy, len, cx);
    crack(ctx, "#d0382a", cx, cy, Math.floor(len * 0.6), cx);
  }
};
export const buildWallDecor = (ctx: Ctx, floor: number) => {
  if (floor === 2) stains(ctx);
  else frieze(ctx, floor);
  if (floor === 1) {
    for (const rx of [22, 84, 150, 250, 316]) root(ctx, rx, 14 + (hash(rx, 3) % 14));
    niche(ctx, 1, 50, 22, 11, 26, true);
    grate(ctx, 148, 48);
    // a tattered second banner in the dark between the pillar and the demon
    rect(ctx, "#8b5e3c", 256, 6, 14, 2);
    rect(ctx, "#2a1c40", 257, 8, 12, 14);
    rect(ctx, "#2a1c40", 259, 22, 3, 3);
    rect(ctx, "#2a1c40", 265, 22, 2, 5);
    rect(ctx, "#4a2f6b", 258, 8, 3, 14);
  }
  if (floor === 2) {
    // bone pilasters between the openings and a niche of candles
    for (const px of [-14, 40, 302, 352]) {
      for (let y = 38; y < WALL_BASE - 6; y += 4) {
        rect(ctx, BONE_DARK, px, y, 6, 3);
        rect(ctx, BONE, px, y, 3, 1);
        rect(ctx, "#0a1216", px + 2, y + 1, 1, 1);
      }
    }
    for (const rx of [22, 100, 180, 246]) root(ctx, rx, 12 + (hash(rx, 5) % 12));
    for (const cx of [14, 44, 360]) {
      rect(ctx, "#3f5a63", cx - 4, 35, 10, 2);
      candle(ctx, cx, 29);
    }
  }
  if (floor === 3) {
    lavaCracks(ctx);
    for (const x of [24, 134, 170, 232]) obsidianColumn(ctx, x);
    demonSkullRelief(ctx);
  }
  for (const opening of OPENINGS[floor - 1]) {
    if (opening.kind === "mural") drawMural(ctx, opening);
    else {
      drawVault(ctx, floor, opening);
      jag(ctx, floor, opening);
      if (opening.rubble) rubblePile(ctx, floor, opening);
    }
  }
};
/** things painted after the existing props: drowned statues, floor clutter */
export const buildForeground = (ctx: Ctx, floor: number) => {
  for (const prop of STRIP.filter((entry) => entry.floor === floor)) stripProp(ctx, floor, prop);
  if (floor === 2) for (const statue of STATUES) drownedStatue(ctx, statue.x, statue.y);
};
const drownedStatue = (ctx: Ctx, x: number, y: number) => {
  const [base, hi, sh, dark, moss] = ["#33504f", "#5a8680", "#1a2e2f", "#0a1618", "#3f7a4a"];
  rect(ctx, dark, x - 1, y - 1, 16, 34);
  rect(ctx, base, x + 4, y, 6, 6); // head
  rect(ctx, hi, x + 4, y, 6, 1);
  rect(ctx, dark, x + 5, y + 3, 1, 1);
  rect(ctx, dark, x + 8, y + 3, 1, 1);
  rect(ctx, base, x + 5, y + 6, 4, 2);
  rect(ctx, base, x + 1, y + 8, 12, 4); // shoulders
  rect(ctx, hi, x + 1, y + 8, 12, 1);
  rect(ctx, base, x + 2, y + 12, 10, 20); // robe
  rect(ctx, hi, x + 2, y + 12, 2, 20);
  rect(ctx, sh, x + 10, y + 12, 2, 20);
  rect(ctx, sh, x + 5, y + 14, 4, 2); // crossed arms
  rect(ctx, sh, x + 6, y + 20, 1, 10);
  rect(ctx, moss, x + 2, y + 18, 3, 2);
  rect(ctx, moss, x + 8, y + 26, 4, 2);
  rect(ctx, moss, x + 5, y + 9, 3, 1);
};

// ---- the front layer's ceiling decor (top band only) ---------------------------------------------------------------
export const buildFrontDecor = (ctx: Ctx, floor: number) => {
  if (floor === 1) {
    for (const hx of [124, 354]) {
      rect(ctx, "#08070f", hx - 1, 0, 14, 6);
      rect(ctx, "#223056", hx, 0, 12, 5);
      rect(ctx, "#cfe0ff", hx + 3, 1, 1, 1);
      rect(ctx, "#8fb0e8", hx + 8, 2, 1, 1);
    }
    for (const rx of [-20, 176, 300]) {
      for (let k = 0; k < 14; k++) {
        const jitter = Math.round(Math.sin(k * 0.9 + rx) * 1.2);
        rect(ctx, "#3a2a1e", rx + jitter, 7 + k, k < 6 ? 2 : 1, 1);
        if (k % 5 === 2) rect(ctx, "#3f6a3a", rx + jitter + 1, 7 + k, 2, 1);
      }
    }
  }
  if (floor === 2) {
    for (const sx of [-12, 104, 206, 268]) {
      rect(ctx, "#6fd8d0", sx, 6, 1, 1);
      rect(ctx, "#2c9a90", sx, 7, 1, 2);
    }
  }
  if (floor === 3) {
    for (const hx of [70, 190]) {
      crack(ctx, "#a8200f", hx, 1, 12, hx);
      crack(ctx, "#ffb040", hx, 1, 6, hx);
    }
  }
};

// ---- animated pieces: back layer (under every character) ----------------------------------------------------------
const CANDLES: Pt[][] = [
  [
    { x: 53, y: 41 },
    { x: 59, y: 43 },
    { x: 180, y: 31 },
  ],
  [
    { x: 14, y: 28 },
    { x: 44, y: 28 },
    { x: 360, y: 28 },
  ],
  [],
];
const MOTES: Box[][] = [
  [
    { x: 118, y: 90, w: 24, h: 36 },
    { x: 344, y: 84, w: 28, h: 34 },
  ],
  [],
  [],
];
const flameAt = (ctx: Ctx, x: number, y: number, frame: number) => {
  rect(ctx, "#ff8a2a", x, y - (frame === 1 ? 1 : 0), 1, 2);
  rect(ctx, "#ffe14a", x, y - 1 - (frame === 1 ? 1 : 0), 1, 1);
};
const rat = (ctx: Ctx, x: number, y: number, dir: number, step: number) => {
  const head = dir > 0 ? x + 5 : x - 2,
    tail = dir > 0 ? x - 4 : x + 5;
  rect(ctx, "#4a3b36", x, y + 1, 5, 2);
  rect(ctx, "#5d4a44", x + 1, y, 3, 1);
  rect(ctx, "#4a3b36", head, y + 1, 2, 2);
  rect(ctx, "#8a6a6a", head + (dir > 0 ? 1 : 0), y, 1, 1);
  rect(ctx, "#ff3b2a", head + (dir > 0 ? 1 : 0), y + 1, 1, 1);
  rect(ctx, "#8a6a6a", tail, y + 2, 4, 1);
  rect(ctx, "#2a201c", x + 1 + step, y + 3, 1, 1);
  rect(ctx, "#2a201c", x + 3 - step, y + 3, 1, 1);
};
/** the flicker of the lit rings: opaque lit-stone pixels around each light pool, a different handful every few frames */
const ringSparks = (ctx: Ctx, floor: number, time: number, still: boolean) => {
  if (still) return;
  const variant = Math.floor(time * 5) % 3;
  FLOOR_LIGHTS[floor - 1].forEach((light, li) => {
    if (!light.ring) return;
    for (let j = 0; j < 9; j++) {
      const angle = ((j + ((variant + li) % 3) / 3) / 9) * Math.PI * 2 + hash(li, j) * 0.001;
      const reach = 0.5 + 0.12 * (((j + variant) % 3) - 1) + 0.1;
      rect(
        ctx,
        light.ring,
        light.x + Math.cos(angle) * light.rx * reach,
        light.y + Math.sin(angle) * light.ry * reach,
        2,
        1,
      );
    }
  });
};
const runePulse = (ctx: Ctx, floor: number, time: number, still: boolean) => {
  for (const rune of RUNES[floor - 1]) {
    for (let k = 0; k < GLYPHS; k++) {
      const { x, y } = glyphPos(rune, k);
      const level = still ? 1 : clamp(Math.round(1 + Math.sin(time * 0.9 + k * 0.8) * 1.2), 0, 2);
      rect(ctx, rune.glow[level], x - 1, y - 1, 3, 3);
      rect(ctx, "#08070c", x, y, 1, 1);
      if (level === 2) rect(ctx, rune.glow[2], x, y - 2, 1, 1);
    }
  }
};
export const drawAmbienceBack = (ctx: Ctx, time: number, still: boolean, floor: number) => {
  ringSparks(ctx, floor, time, still);
  runePulse(ctx, floor, time, still);
  CANDLES[floor - 1].forEach((flameSpot, i) =>
    flameAt(ctx, flameSpot.x, flameSpot.y, still ? 0 : Math.floor(time * 6 + i * 2) % 3),
  );
  if (floor === 1) {
    // the green glow under the grate pulses
    const pulse = still ? 1 : Math.floor(time * 1.6) % 3;
    for (let gx = 149; gx < 163; gx += 3)
      rect(ctx, pulse === 0 ? "#2f6b3a" : pulse === 1 ? "#5aa852" : "#9ae07a", gx, 53, 2, 2);
  }
  if (floor !== 3) {
    // rats scurry along the foot of the wall
    const span = VIEW_W - 24;
    [0, 1].forEach((ratIdx) => {
      const travel = still ? hash(ratIdx, 3) % span : (time * (11 + ratIdx * 5) + ratIdx * 173) % span;
      const x = ratIdx % 2 ? X_END - 12 - travel : VIEW_X0 + 12 + travel;
      rat(ctx, x, 75 + ratIdx, ratIdx % 2 ? -1 : 1, still ? 0 : Math.floor(time * 8) % 2);
    });
  }
  if (floor === 1) {
    // dust drifting in the moon's shafts, over the floor and under everyone
    MOTES[0].forEach((zone, zi) => {
      for (let k = 0; k < 6; k++) {
        const frac = still ? k / 6 : (time * 0.12 + k / 6) % 1;
        const mx = zone.x + 2 + ((hash(zi, k) % (zone.w - 4)) + (still ? 0 : Math.round(Math.sin(time * 0.5 + k) * 2)));
        rect(ctx, k % 2 ? "#e8f0ff" : "#8fb0e8", mx, zone.y + frac * zone.h, 1, 1);
      }
    });
  }
  if (floor === 1) {
    // the swaying cage
    const sway = still ? 0 : Math.round(Math.sin(time * 1.1) * 2);
    cage(ctx, 262, 24, sway, "");
  }
  if (floor === 3) {
    const sway = still ? 0 : Math.round(Math.sin(time * 0.9 + 1) * 2);
    cage(ctx, 206, 22, sway, "#ff3b2a");
  }
  if (floor === 2) {
    // ripples spread on some puddles, and a torch glint shivers on others
    PUDDLES.forEach((puddle, i) => {
      if (i % 3 === 0 && !still) {
        const phase = (time * 0.45 + i * 0.37) % 1;
        if (phase < 0.7) {
          const reach = Math.floor(phase * (puddle.w / 2 + 3));
          const cx = puddle.x + (puddle.w >> 1);
          rect(ctx, WATER[2], cx - reach, puddle.y + 1, 1, 1);
          rect(ctx, WATER[2], cx + reach, puddle.y + 1, 1, 1);
          rect(ctx, WATER[3], cx - (reach >> 1), puddle.y + 3, 1, 1);
          rect(ctx, WATER[3], cx + (reach >> 1), puddle.y - 1, 1, 1);
        }
      }
      const glint = still ? i % 4 === 0 : Math.floor(time * 4 + i) % 5 === 0;
      if (glint && LANTERN_POS.some((lamp) => Math.abs(lamp.x - puddle.x) < 60))
        rect(ctx, "#e8fffb", puddle.x + 2 + (i % 4), puddle.y + 1, 1, 1);
    });
    if (still) return;
    // mist hugging the water and the floor under it
    for (let j = 0; j < 14; j++) {
      const x = VIEW_X0 + ((j * 37 + time * (2 + (j % 3))) % VIEW_W);
      const y = 66 + (hash(j, 5) % 28) + Math.round(Math.sin(time * 0.4 + j) * 2);
      if ((j + Math.floor(time * 0.3)) % 3 === 0) continue;
      rect(ctx, "#2c4d56", x, y, 4, 1);
      rect(ctx, "#3a6670", x + 1, y - 1, 2, 1);
    }
    // ghost wisps drifting behind the broken wall
    OPENINGS[1].forEach((opening, i) => {
      const phase = (time * 0.12 + i * 0.27) % 1;
      const wx = opening.x + 8 + Math.round(Math.sin(phase * 6.28 + i) * (opening.w / 2 - 8)) + (opening.w >> 1) - 8;
      const wy = opening.y + 18 + Math.round(Math.sin(phase * 12) * 3);
      rect(ctx, "#6fd8d0", wx, wy, 1, 2);
      rect(ctx, "#2c9a90", wx, wy + 2, 1, 2);
      rect(ctx, "#e8fffb", wx, wy, 1, 1);
    });
  }
};

// ---- animated pieces: front layer (top band only) -------------------------------------------------------------------
const bat = (ctx: Ctx, x: number, y: number, up: boolean, color: string) => {
  rect(ctx, color, x + 3, y + 1, 1, 2);
  rect(ctx, color, x + 1, y + (up ? 0 : 2), 2, 1);
  rect(ctx, color, x + 4, y + (up ? 0 : 2), 2, 1);
  rect(ctx, color, x, y + (up ? 1 : 2), 1, 1);
  rect(ctx, color, x + 6, y + (up ? 1 : 2), 1, 1);
  rect(ctx, color, x + 1, y + 1, 2, 1);
  rect(ctx, color, x + 4, y + 1, 2, 1);
  rect(ctx, "#ff3b2a", x + 3, y + 1, 1, 1);
};
export const drawAmbienceFront = (ctx: Ctx, time: number, still: boolean, floor: number) => {
  if (still) return;
  const bats = floor === 3 ? 1 : 2;
  const color = ["#4a3a6a", "#2c4a58", "#5a2a3a"][floor - 1];
  for (let batIdx = 0; batIdx < bats; batIdx++) {
    const loop = (time * (9 + batIdx * 4) + batIdx * 211) % (VIEW_W + 40);
    const x = batIdx % 2 ? X_END + 20 - loop : VIEW_X0 - 20 + loop;
    const y = 12 + Math.round(Math.sin(time * 1.7 + batIdx * 2) * 5) + batIdx * 3;
    bat(ctx, x, clamp(y, 8, FRONT_BAND - 4), Math.floor(time * 9 + batIdx) % 2 === 0, color);
  }
  if (floor === 3) {
    // embers rain down the top band, drifting
    for (let j = 0; j < 9; j++) {
      const phase = (time * 0.3 + j / 9) % 1;
      const ex = VIEW_X0 + 10 + ((j * 59) % (VIEW_W - 20)) + Math.round(Math.sin(time * 0.8 + j) * 3);
      const ey = 7 + Math.floor(phase * 20);
      rect(ctx, phase < 0.5 ? "#ffb040" : phase < 0.8 ? "#ff5a2a" : "#a8200f", ex, ey, 1, 1);
      if (j % 3 === 0 && phase < 0.5) rect(ctx, "#ffe14a", ex, ey - 1, 1, 1);
    }
  }
};

// ---- darkening of the braziers' light for the Lord's intro (opaque dither, under characters) ------------------------------
const DIM_LEVELS = 4;
const dimLayers: (HTMLCanvasElement | null | undefined)[] = [];
const dimPaint = (ctx: Ctx, level: number) => {
  const reach = level / DIM_LEVELS;
  for (const brazier of BRAZIER_POS) {
    for (let y = 68; y < 128; y += 2)
      for (let x = brazier.x - 52; x < brazier.x + 52; x += 2) {
        const dx = (x - brazier.x) / 52,
          dy = (y - 80) / 34;
        if (dx * dx + dy * dy > 1) continue;
        if (bayer(blockOf(x), blockOf(y)) < reach * 0.9) rect(ctx, "#07040a", x, y, 2, 2);
      }
  }
};
/** darkens the dungeon floor where the braziers light it, in `levels` steps; `dim` is 0..1 (the Lord's intro) */
export const drawBrazierDim = (ctx: Ctx, dim: number) => {
  const level = Math.round(clamp(dim, 0, 1) * DIM_LEVELS);
  if (level <= 0) return;
  if (typeof document === "undefined") return;
  if (dimLayers[level] === undefined) {
    const canvas = document.createElement("canvas");
    canvas.width = VIEW_W;
    canvas.height = WORLD_H;
    const layerCtx = canvas.getContext("2d");
    if (layerCtx) {
      layerCtx.translate(-VIEW_X0, 0);
      dimPaint(layerCtx, level);
    }
    dimLayers[level] = layerCtx ? canvas : null;
  }
  const cached = dimLayers[level];
  if (cached) ctx.drawImage(cached, VIEW_X0, 0);
};
