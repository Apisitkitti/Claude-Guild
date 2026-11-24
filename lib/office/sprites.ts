import type { GearTier } from "./gearTier";
import { ADV_CLASSES, INTERN_LOOK, SPRITE_COLORS, fnv1a, type AdvClass, type Look } from "./palette";

const cache = new Map<string, HTMLCanvasElement>();

const mkCanvas = (width: number, height: number): HTMLCanvasElement => {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return canvas;
};

// ---------------------------------------------------------------- colour helpers
export const mix = (colorA: string, colorB: string, amount: number): string => {
  const rgbA = parseInt(colorA.slice(1), 16),
    rgbB = parseInt(colorB.slice(1), 16);
  const hexChannel = (shift: number) => {
    const x = (rgbA >>> shift) & 255,
      y = (rgbB >>> shift) & 255;
    return Math.round(x + (y - x) * amount)
      .toString(16)
      .padStart(2, "0");
  };
  return "#" + hexChannel(16) + hexChannel(8) + hexChannel(0);
};
export const lighten = (color: string, amount: number) => mix(color, "#ffffff", amount);
const darken = (color: string, amount: number) => mix(color, "#000000", amount);

export const INK = "#14121f";
const sat = (color: string, amount: number): string => {
  const rgb = parseInt(color.slice(1), 16);
  const red = (rgb >>> 16) & 255,
    green = (rgb >>> 8) & 255,
    blue = rgb & 255;
  const grey = 0.3 * red + 0.59 * green + 0.11 * blue;
  const adjust = (channel: number) =>
    Math.max(0, Math.min(255, Math.round(grey + (channel - grey) * (1 + amount))))
      .toString(16)
      .padStart(2, "0");
  return "#" + adjust(red) + adjust(green) + adjust(blue);
};
export const luma = (color: string): number => {
  const rgb = parseInt(color.slice(1), 16);
  return 0.3 * ((rgb >>> 16) & 255) + 0.59 * ((rgb >>> 8) & 255) + 0.11 * (rgb & 255);
};

const EYE = "#2a1f3a";
const WHITE = "#ffffff";
const MOUTH = "#8a3446";
const TONGUE = "#e8707a";
const STEEL = "#c9d3e0",
  STEEL_HI = "#eef3fa",
  STEEL_SH = "#8793a6";
const GOLD = "#e8c04e",
  GOLD_HI = "#fff0a8",
  GOLD_SH = "#b88a2a";
const WOOD = "#8b5e3c",
  WOOD_HI = "#b9814f",
  WOOD_SH = "#5c3d28";
const LEATHER = "#6b4a36",
  BELT = "#4a3426",
  BOOT = "#4a3426",
  BOOT_HI = "#6e4f3a";
const GEM = "#6ff0ff",
  GEM_HI = "#d6fbff";
const PAPER = "#efe2c0",
  PAPER_SH = "#d4bf90",
  INKLINE = "#8a6f4a";
const FEATHER = "#f4f1ea";

// ---------------------------------------------------------------- pixel grid
export class Grid {
  cells: (string | null)[];
  dx = 0;
  dy = 0;
  /** cells painted by outline() (so a hurt flash can keep the silhouette dark) */
  inked = new Set<number>();
  constructor(
    readonly width: number,
    readonly height: number,
  ) {
    this.cells = new Array(width * height).fill(null);
  }
  set(x: number, y: number, color: string) {
    x += this.dx;
    y += this.dy;
    if (x >= 0 && x < this.width && y >= 0 && y < this.height) this.cells[y * this.width + x] = color;
  }
  get(x: number, y: number): string | null {
    x += this.dx;
    y += this.dy;
    return x >= 0 && x < this.width && y >= 0 && y < this.height ? this.cells[y * this.width + x] : null;
  }
  row(y: number, x0: number, x1: number, color: string) {
    for (let x = x0; x <= x1; x++) this.set(x, y, color);
  }
  rect(x0: number, y0: number, x1: number, y1: number, color: string) {
    for (let y = y0; y <= y1; y++) this.row(y, x0, x1, color);
  }
  /** Closed dark outline: every empty cell touching a filled one becomes a dark shade of that fill. */
  outline() {
    const { width, height, cells } = this;
    const out = cells.slice();
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (cells[y * width + x]) continue;
        let neighbour: string | null = null;
        for (let dy = -1; dy <= 1 && !neighbour; dy++) {
          for (let dx = -1; dx <= 1 && !neighbour; dx++) {
            const nx = x + dx,
              ny = y + dy;
            if ((dx || dy) && nx >= 0 && nx < width && ny >= 0 && ny < height) neighbour = cells[ny * width + nx];
          }
        }
        if (neighbour) {
          out[y * width + x] = mix(neighbour, INK, 0.8);
          this.inked.add(y * width + x);
        }
      }
    }
    this.cells = out;
  }
  /** like recolor, but leaves the outline cells alone */
  recolorFill(transform: (color: string) => string) {
    this.cells = this.cells.map((color, at) => (color && !this.inked.has(at) ? transform(color) : color));
  }
  recolor(transform: (color: string) => string) {
    this.cells = this.cells.map((color) => (color ? transform(color) : color));
  }
  toCanvas(): HTMLCanvasElement {
    const canvas = mkCanvas(this.width, this.height);
    const ctx = canvas.getContext("2d");
    if (!ctx) return canvas;
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const color = this.cells[y * this.width + x];
        if (color) {
          ctx.fillStyle = color;
          ctx.fillRect(x, y, 1, 1);
        }
      }
    }
    return canvas;
  }
}

const normFrame = (frame: number, count: number): number => {
  const whole = Number.isFinite(frame) ? Math.floor(frame) : 0;
  return ((whole % count) + count) % count;
};

// ---------------------------------------------------------------- palette from Look
interface Pal {
  cls: PalCls;
  hair: string;
  hHi: string;
  hSh: string;
  skin: string;
  skSh: string;
  blush: string;
  /** class cloth colour (steel plate for warriors, robe for mages, dark leather for rogues ...) */
  main: string;
  mHi: string;
  mSh: string;
  /** the session's shirt colour, used as the class's accent (tabard, plume, scarf, feather) */
  accent: string;
  sleeve: string;
  glove: string;
  pants: string;
  pSh: string;
  style: number;
}

type PalCls = AdvClass | "squire";

const CLASS_PANTS: Record<PalCls, string> = {
  warrior: "#4a4f63",
  mage: "#3d3a58",
  rogue: "#2f2f3f",
  cleric: "#cfc6b0",
  ranger: "#6b5a3a",
  squire: "#4a4f63",
};

const BEARD = "#e9e6f0",
  BEARD_SH = "#b9b4c8";
const HOOD_SHADOW = "#16131f";
const IRON = "#9aa3b2",
  IRON_HI = "#c7cfdb",
  IRON_SH = "#6a7384";

interface Cloth {
  main: string;
  mHi: string;
  mSh: string;
  sleeve: string;
  glove: string | null;
}

const clothFor = (cls: PalCls, look: Look, base: string): Cloth => {
  switch (cls) {
    case "warrior":
      return { main: STEEL, mHi: STEEL_HI, mSh: STEEL_SH, sleeve: STEEL_SH, glove: STEEL_HI };
    case "cleric":
      return { main: "#f6f1e4", mHi: WHITE, mSh: "#cfc6b0", sleeve: "#e6dfcb", glove: null };
    case "rogue": {
      const main = darken(sat(look.shirt, 0.1), 0.45);
      return { main, mHi: lighten(main, 0.4), mSh: darken(main, 0.35), sleeve: main, glove: "#2a2530" };
    }
    case "ranger": {
      const main = mix("#8fae3e", base, 0.15);
      return { main, mHi: lighten(main, 0.3), mSh: darken(main, 0.32), sleeve: LEATHER, glove: WOOD_SH };
    }
    default: {
      const mSh = darken(sat(look.shirt, 0.3), 0.32);
      return {
        main: base,
        mHi: lighten(base, 0.3),
        mSh,
        sleeve: cls === "mage" ? darken(base, 0.12) : mSh,
        glove: null,
      };
    }
  }
};

const mkPal = (look: Look, cls: PalCls): Pal => {
  const hash = fnv1a(look.hair + "|" + look.shirt + "|" + look.skin);
  const shirt = sat(look.shirt, 0.2);
  const cloth = clothFor(cls, look, shirt);
  const pants = CLASS_PANTS[cls];
  return {
    cls,
    hair: look.hair,
    hHi: lighten(sat(look.hair, 0.3), 0.38),
    hSh: darken(look.hair, 0.3),
    skin: look.skin,
    skSh: sat(darken(look.skin, 0.2), 0.25),
    blush: mix(look.skin, "#ff5f7c", 0.55),
    main: cloth.main,
    mHi: cloth.mHi,
    mSh: cloth.mSh,
    accent: shirt,
    sleeve: cloth.sleeve,
    glove: cloth.glove ?? look.skin,
    pants,
    pSh: darken(pants, 0.28),
    style: hash % 3,
  };
};

export type Pose =
  "walk" | "idle" | "attack" | "cast" | "read" | "write" | "hand_up" | "hurt" | "drink" | "cheer" | "rest";

type Expr = "normal" | "blink" | "down" | "happy" | "wide" | "wince";
type MouthT = "smile" | "open" | "flat";

// ---------------------------------------------------------------- character (16x24)
const isRobe = (cls: AdvClass) => cls === "mage" || cls === "cleric";

/** horizontal sway of robe hems / cloak tails per walk frame (0 when standing) */
const SWAY = [-1, 0, 1, 0];
const swayOf = (wf: number) => (wf < 0 ? 0 : SWAY[wf % SWAY.length]);

const drawLegs = (grid: Grid, palette: Pal, wf: number, cls: AdvClass) => {
  grid.dx = 0;
  grid.dy = 0;
  if (isRobe(cls)) return; // the robe hides the legs; its hem + boot tips are drawn with the body
  const top = 19;
  const leg = (x0: number, lifted: boolean) => {
    const end = lifted ? top + 1 : top + 2;
    if (cls === "ranger") {
      // thigh then tall folded boots
      grid.rect(x0, top, x0 + 1, top, palette.pants);
      grid.rect(x0, top + 1, x0 + 2, lifted ? top + 1 : top + 2, BOOT);
      grid.row(top + 1, x0, x0 + 2, BOOT_HI);
      grid.row(end + 1, x0, x0 + 2, BOOT);
      return;
    }
    for (let y = top; y <= end; y++) {
      grid.set(x0, y, palette.pants);
      grid.set(x0 + 1, y, palette.pSh);
    }
    if (cls === "warrior") {
      grid.set(x0, top + 1, STEEL); // knee cop
      grid.set(x0 + 1, top + 1, STEEL_SH);
    }
    const sy = end + 1;
    grid.row(sy, x0, x0 + 2, BOOT);
    grid.set(x0, sy, BOOT_HI);
    if (cls === "warrior") grid.row(sy, x0, x0 + 2, STEEL_SH);
  };
  const xs = cls === "rogue" ? [6, 9] : [5, 9];
  leg(xs[0], wf === 0);
  leg(xs[1], wf === 2);
};

interface BodyOpt {
  wf: number;
  /** cross-legged: no skirt, hem or cloak tail below the belt */
  seated: boolean;
}

/** robe boot tips peeking under the hem */
const robeTips = (grid: Grid, wf: number) => {
  for (const [x0, lifted] of [
    [5, wf === 0],
    [9, wf === 2],
  ] as const) {
    if (lifted) continue;
    grid.row(22, x0, x0 + 1, BOOT);
    grid.set(x0, 22, BOOT_HI);
  }
};

const bodyWarrior = (grid: Grid, palette: Pal, opt: BodyOpt) => {
  const { accent } = palette;
  // chest plate
  grid.rect(5, 11, 10, 16, STEEL);
  grid.row(11, 5, 10, STEEL_HI);
  for (let y = 11; y <= 16; y++) grid.set(10, y, STEEL_SH);
  grid.row(16, 5, 10, STEEL_SH);
  grid.rect(5, 12, 5, 14, STEEL_HI);
  grid.row(15, 6, 9, STEEL_SH);
  grid.rect(7, 13, 8, 14, accent);
  grid.set(7, 13, lighten(accent, 0.35));
  // broad pauldrons
  grid.row(11, 3, 5, STEEL_HI);
  grid.row(12, 3, 5, STEEL);
  grid.row(13, 4, 5, STEEL_SH);
  grid.set(3, 12, STEEL_HI);
  grid.set(4, 12, GOLD);
  grid.row(11, 10, 12, STEEL);
  grid.row(12, 10, 12, STEEL_SH);
  grid.row(13, 10, 11, STEEL_SH);
  grid.set(11, 11, STEEL_HI);
  grid.set(11, 12, GOLD_SH);
  // belt + faulds + tabard flap
  grid.row(17, 5, 10, BELT);
  grid.set(8, 17, GOLD);
  grid.row(18, 5, 10, STEEL_SH);
  grid.row(18, 7, 8, accent);
  if (!opt.seated) grid.rect(7, 19, 8, 20, accent);
};

const bodyMage = (grid: Grid, palette: Pal, opt: BodyOpt) => {
  const { main, mHi, mSh } = palette;
  grid.rect(5, 11, 10, 16, main);
  for (let y = 11; y <= 16; y++) grid.set(10, y, mSh);
  grid.row(11, 5, 10, mHi);
  grid.set(5, 12, mHi);
  grid.set(5, 13, mHi);
  grid.set(6, 12, mHi);
  // gold trim down the opening + sash with a tassel
  for (let y = 12; y <= 16; y++) grid.set(8, y, y % 2 ? GOLD_SH : GOLD);
  grid.row(16, 5, 10, GOLD);
  grid.set(7, 13, GOLD_HI);
  grid.set(6, 14, GOLD_SH);
  grid.set(9, 15, GOLD_SH);
  if (opt.seated) return;
  const sway = swayOf(opt.wf);
  // long flowing skirt that flares to the hem
  grid.rect(5, 17, 10, 17, main);
  grid.rect(4, 18, 11, 19, main);
  grid.rect(3, 20, 12, 20, main);
  grid.row(21, 3 + sway, 12 + sway, GOLD);
  grid.row(21, 3 + sway, 4 + sway, GOLD_HI);
  for (let y = 17; y <= 20; y++) grid.set(y > 19 ? 12 : y > 17 ? 11 : 10, y, mSh);
  grid.set(11, 20, mSh);
  for (let y = 18; y <= 20; y++) grid.set(6, y, mSh);
  grid.set(4, 19, mHi);
  grid.set(3, 20, mHi);
  grid.set(8, 17, GOLD);
  grid.set(8, 18, GOLD_SH);
  grid.set(9, 17, GOLD_SH);
  grid.set(9, 18, GOLD);
  grid.set(10, 19, GOLD_HI);
  grid.set(5, 20, GOLD_HI);
  robeTips(grid, opt.wf);
};

const bodyRogue = (grid: Grid, palette: Pal, opt: BodyOpt) => {
  const { main, mHi, mSh, accent } = palette;
  // hooded cloak hanging behind (tail trails with the walk)
  const sway = swayOf(opt.wf);
  grid.rect(4, 11, 5, 14, main);
  grid.rect(3, 15, 5, 17, main);
  grid.set(3, 12, mSh);
  grid.set(4, 13, mSh);
  grid.set(3, 16, mSh);
  grid.set(4, 15, mHi);
  if (!opt.seated) {
    grid.rect(2 + sway, 18, 4 + sway, 20, main);
    grid.set(2 + sway, 19, mSh);
    grid.set(3 + sway, 20, mSh);
    grid.set(3 + sway, 21, mSh);
    grid.set(2 + sway, 20, mSh);
  }
  // slim dark leather vest over an undershirt
  grid.rect(6, 11, 9, 16, main);
  grid.rect(7, 11, 8, 13, accent);
  grid.set(8, 12, darken(accent, 0.25));
  grid.set(9, 11, mSh);
  for (let y = 11; y <= 16; y++) grid.set(9, y, mSh);
  grid.set(6, 12, mHi);
  grid.set(6, 13, mHi);
  // crossed bandolier
  for (let i = 0; i <= 5; i++) grid.set(6 + Math.floor((i * 4) / 6), 11 + i, LEATHER);
  grid.set(8, 14, GOLD_SH);
  // belt with a dagger on each hip
  grid.row(17, 6, 9, BELT);
  grid.set(7, 17, GOLD_SH);
  grid.row(18, 6, 9, palette.pants);
  grid.set(5, 16, GOLD_SH);
  grid.set(5, 17, WOOD_SH);
  grid.rect(5, 18, 5, 19, STEEL_HI);
  grid.set(10, 16, GOLD_SH);
  grid.set(10, 17, WOOD_SH);
  grid.rect(10, 18, 10, 19, STEEL_SH);
};

const bodyCleric = (grid: Grid, palette: Pal, opt: BodyOpt) => {
  const { main, mSh, accent } = palette;
  grid.rect(5, 11, 10, 16, main);
  for (let y = 11; y <= 16; y++) grid.set(10, y, mSh);
  // gold-trimmed mantle over the shoulders
  grid.row(11, 4, 11, WHITE);
  grid.row(12, 4, 5, GOLD_SH);
  grid.row(12, 10, 11, GOLD_SH);
  grid.set(4, 11, GOLD);
  grid.set(11, 11, GOLD);
  // tabard in the session colour with a holy cross
  grid.rect(6, 12, 9, opt.seated ? 18 : 20, accent);
  for (let y = 12; y <= (opt.seated ? 18 : 20); y++) grid.set(9, y, darken(accent, 0.22));
  grid.set(6, 12, GOLD);
  grid.set(9, 12, GOLD);
  for (let y = 13; y <= 16; y++) grid.set(8, y, GOLD);
  grid.row(14, 7, 9, GOLD);
  grid.set(8, 13, GOLD_HI);
  // rope belt
  grid.row(17, 5, 10, GOLD_SH);
  grid.set(7, 17, GOLD);
  grid.set(5, 12, WHITE);
  if (opt.seated) return;
  const sway = swayOf(opt.wf);
  // straight cassock to the feet
  grid.rect(5, 18, 5, 20, main);
  grid.rect(10, 18, 10, 20, mSh);
  grid.rect(4, 19, 4, 20, main);
  grid.rect(11, 19, 11, 20, mSh);
  grid.row(21, 4 + sway, 11 + sway, GOLD_SH);
  grid.row(21, 6 + sway, 9 + sway, GOLD);
  grid.set(4, 20, WHITE);
  grid.set(5, 18, WHITE);
  robeTips(grid, opt.wf);
};

const bodyRanger = (grid: Grid, palette: Pal, opt: BodyOpt) => {
  const { main, mHi, mSh, accent } = palette;
  const sway = swayOf(opt.wf);
  // hooded cape behind the back
  grid.rect(3, 10, 5, 14, main);
  grid.rect(2, 15, 5, 17, main);
  grid.set(3, 11, mHi);
  grid.set(2, 16, mSh);
  grid.set(3, 14, mSh);
  grid.set(5, 15, mSh);
  if (!opt.seated) {
    grid.rect(2 + sway, 18, 4 + sway, 19, main);
    grid.set(2 + sway, 19, mSh);
    grid.set(4 + sway, 18, mSh);
    grid.set(3 + sway, 20, mSh);
  }
  // quiver strapped to the back with arrows sticking out
  grid.rect(2, 10, 3, 16, LEATHER);
  grid.set(2, 10, WOOD_HI);
  grid.set(2, 12, WOOD_SH);
  grid.set(3, 14, WOOD_SH);
  grid.set(3, 16, WOOD_SH);
  grid.rect(2, 6, 2, 9, WOOD_HI);
  grid.rect(3, 7, 3, 9, WOOD_HI);
  grid.rect(1, 8, 1, 9, WOOD_HI);
  grid.set(2, 5, FEATHER);
  grid.set(2, 6, FEATHER);
  grid.set(3, 6, FEATHER);
  grid.set(3, 7, accent);
  grid.set(1, 7, FEATHER);
  grid.set(1, 6, accent);
  // leather jerkin
  grid.rect(5, 11, 10, 16, LEATHER);
  for (let y = 11; y <= 16; y++) grid.set(10, y, WOOD_SH);
  grid.row(16, 5, 10, WOOD_SH);
  grid.rect(5, 12, 5, 14, WOOD_HI);
  grid.row(11, 7, 9, lighten(accent, 0.15));
  for (let i = 0; i <= 4; i++) grid.set(6 + i, 12 + i, WOOD_HI);
  grid.set(7, 14, WOOD);
  grid.set(8, 13, WOOD);
  // short mantle over the shoulders
  grid.row(11, 4, 6, main);
  grid.row(11, 10, 11, main);
  grid.set(4, 12, main);
  grid.set(11, 12, mSh);
  grid.set(5, 11, mHi);
  // belt, pouch
  grid.row(17, 5, 10, BELT);
  grid.set(7, 17, GOLD_SH);
  grid.rect(9, 17, 10, 18, LEATHER);
  grid.set(9, 17, WOOD_HI);
  grid.row(18, 5, 8, palette.pants);
  grid.set(8, 18, palette.pSh);
};

const drawBody = (grid: Grid, palette: Pal, cls: AdvClass, opt: BodyOpt) => {
  grid.dx = 0;
  grid.dy = 0;
  switch (cls) {
    case "warrior":
      return bodyWarrior(grid, palette, opt);
    case "mage":
      return bodyMage(grid, palette, opt);
    case "rogue":
      return bodyRogue(grid, palette, opt);
    case "cleric":
      return bodyCleric(grid, palette, opt);
    case "ranger":
      return bodyRanger(grid, palette, opt);
  }
};

/** A thin arm from the shoulder to a hand; sleeve pixels then a gloved/skin hand. */
const arm = (grid: Grid, palette: Pal, x0: number, y0: number, x1: number, y1: number) => {
  const left = x0 < 8;
  const sx = palette.cls === "rogue" ? (left ? x0 + 1 : x0 - 1) : x0; // slimmer shoulders
  const steps = Math.max(Math.abs(x1 - sx), Math.abs(y1 - y0), 1);
  const points: [number, number][] = [];
  for (let i = 0; i < steps; i++) {
    const x = Math.round(sx + ((x1 - sx) * i) / steps);
    const y = Math.round(y0 + ((y1 - y0) * i) / steps);
    grid.set(x, y, i === 0 ? palette.main : palette.sleeve);
    points.push([x, y]);
  }
  if (palette.cls === "mage") {
    // wide bell sleeves with a gold cuff
    const out = left ? -1 : 1;
    for (const [x, y] of points.slice(-2)) grid.set(x + out, y, palette.main);
    const [cx, cy] = points[points.length - 1];
    grid.set(cx + out, cy, palette.mSh);
    grid.set(cx, cy, GOLD);
  }
  grid.set(x1, y1, palette.glove);
};

const drawHead = (grid: Grid, palette: Pal, cls: AdvClass, expr: Expr, mouth: MouthT) => {
  const { hair, hHi, hSh, skin, skSh, blush } = palette;
  // back hair (only where no helm / hood covers it)
  if (cls === "cleric" || (cls === "mage" && palette.style === 1)) {
    grid.rect(2, 5, 3, 9, hSh);
    grid.rect(3, 5, 3, 9, hair);
    if (cls === "mage" || palette.style === 1) {
      grid.rect(2, 10, 3, cls === "mage" ? 15 : 11, hSh);
      grid.rect(3, 10, 3, cls === "mage" ? 15 : 11, hair);
    }
  }
  // face
  grid.rect(4, 5, 11, 9, skin);
  grid.row(10, 5, 10, skSh);
  for (let y = 6; y <= 9; y++) grid.set(4, y, skSh);
  grid.set(5, 10, skSh);
  // eyes
  const eye2 = (x: number, y: number) => {
    grid.set(x, y, EYE);
    grid.set(x, y + 1, EYE);
  };
  switch (expr) {
    case "normal":
      eye2(7, 7);
      eye2(10, 7);
      grid.set(7, 7, "#4a3a63");
      grid.set(10, 7, "#4a3a63");
      break;
    case "blink":
      grid.row(8, 6, 7, EYE);
      grid.row(8, 9, 10, EYE);
      break;
    case "down":
      grid.set(7, 7, skSh);
      grid.set(10, 7, skSh);
      grid.set(7, 8, EYE);
      grid.set(10, 8, EYE);
      break;
    case "happy":
      grid.set(6, 8, EYE);
      grid.set(7, 7, EYE);
      grid.set(8, 8, EYE);
      grid.set(9, 8, EYE);
      grid.set(10, 7, EYE);
      grid.set(11, 8, EYE);
      break;
    case "wide":
      for (const x of [7, 10]) {
        grid.set(x, 6, EYE);
        grid.set(x, 7, WHITE);
        grid.set(x, 8, EYE);
      }
      break;
    case "wince":
      grid.set(6, 7, EYE);
      grid.set(7, 8, EYE);
      grid.set(11, 7, EYE);
      grid.set(10, 8, EYE);
      break;
  }
  grid.set(5, 9, blush);
  grid.set(11, 9, blush);
  // mouth
  if (mouth === "open") {
    grid.set(8, 9, MOUTH);
    grid.set(9, 9, MOUTH);
    grid.set(8, 10, TONGUE);
    grid.set(9, 10, MOUTH);
  } else if (mouth === "smile") {
    grid.set(8, 9, MOUTH);
    grid.set(9, 9, MOUTH);
  } else {
    grid.set(9, 9, MOUTH);
  }
  // hair (no headwear) or headwear
  switch (cls) {
    case "warrior": {
      // great helm: dome, brow plate, cheek guards, nasal bar, and a swept plume
      const plume = palette.accent;
      grid.row(3, 5, 10, STEEL);
      grid.row(4, 4, 11, STEEL);
      grid.row(5, 3, 11, STEEL);
      grid.row(6, 3, 11, STEEL_SH);
      grid.rect(3, 7, 4, 9, STEEL_SH);
      grid.rect(3, 5, 3, 9, STEEL);
      grid.set(6, 3, STEEL_HI);
      grid.set(5, 4, STEEL_HI);
      grid.set(6, 4, STEEL_HI);
      grid.set(7, 4, STEEL_HI);
      grid.set(10, 3, STEEL_SH);
      grid.set(11, 4, STEEL_SH);
      grid.set(11, 5, STEEL_SH);
      grid.rect(8, 6, 9, 7, STEEL);
      grid.set(8, 6, STEEL_HI);
      grid.set(8, 5, GOLD);
      grid.row(2, 5, 10, plume);
      grid.row(1, 6, 9, plume);
      grid.row(1, 7, 8, lighten(plume, 0.3));
      grid.rect(3, 2, 4, 4, plume);
      grid.set(2, 3, darken(plume, 0.25));
      grid.set(2, 4, darken(plume, 0.25));
      grid.set(3, 4, darken(plume, 0.25));
      break;
    }
    case "mage": {
      // beard (white, or the hair colour) or long hair; wide-brimmed pointed hat
      const longHair = palette.style === 1;
      if (!longHair) {
        const beard = palette.style === 2 ? hair : BEARD;
        const beardSh = palette.style === 2 ? hSh : BEARD_SH;
        grid.row(10, 5, 10, beard);
        grid.row(11, 6, 10, beard);
        grid.row(12, 6, 9, beard);
        grid.set(4, 9, beard);
        grid.set(5, 9, beard);
        grid.set(11, 9, beard);
        if (palette.style === 0) {
          grid.row(13, 7, 9, beard);
          grid.row(14, 7, 8, beard);
          grid.set(8, 15, beard);
          grid.set(9, 13, beardSh);
          grid.set(8, 14, beardSh);
        }
        grid.set(10, 10, beardSh);
        grid.set(10, 11, beardSh);
        grid.set(9, 12, beardSh);
      }
      grid.row(5, 4, 8, hair);
      grid.set(6, 5, hHi);
      grid.row(4, 2, 12, palette.main);
      grid.row(4, 11, 12, palette.mSh);
      grid.set(2, 4, palette.mHi);
      grid.set(3, 4, palette.mHi);
      grid.row(3, 5, 10, GOLD);
      grid.set(5, 3, GOLD_HI);
      grid.row(2, 6, 9, palette.main);
      grid.row(1, 7, 8, palette.main);
      grid.set(9, 1, palette.main);
      grid.set(9, 2, palette.mSh);
      grid.set(8, 1, palette.mSh);
      grid.set(7, 2, GOLD_HI);
      grid.set(6, 2, palette.mHi);
      break;
    }
    case "rogue": {
      // deep hood: the brow is a pit of shadow, only the eyes show, a scarf hides the mouth
      const { main, mHi, mSh, accent } = palette;
      grid.row(1, 7, 8, main);
      grid.row(2, 5, 10, main);
      grid.row(3, 4, 11, main);
      grid.row(4, 3, 12, main);
      grid.rect(2, 5, 4, 10, main);
      grid.rect(12, 5, 12, 8, main);
      grid.rect(11, 4, 12, 4, mSh);
      grid.set(6, 2, mHi);
      grid.set(5, 3, mHi);
      grid.set(4, 4, mHi);
      grid.set(2, 6, mSh);
      grid.rect(2, 8, 3, 10, mSh);
      for (let y = 5; y <= 6; y++) {
        for (let x = 5; x <= 11; x++) {
          const cell = grid.get(x, y);
          if (cell !== EYE && cell !== WHITE) grid.set(x, y, HOOD_SHADOW);
        }
      }
      grid.row(9, 5, 11, accent);
      grid.row(10, 5, 10, darken(accent, 0.25));
      grid.set(6, 9, lighten(accent, 0.25));
      grid.set(8, 9, darken(accent, 0.12));
      grid.set(4, 9, darken(accent, 0.25));
      // trailing scarf end
      grid.set(3, 10, accent);
      grid.set(3, 11, darken(accent, 0.25));
      grid.set(2, 12, accent);
      break;
    }
    case "cleric": {
      if (palette.style !== 2) {
        // mitre: split peak with a gold band and cross
        grid.row(1, 5, 6, WHITE);
        grid.row(1, 9, 10, WHITE);
        grid.row(2, 5, 10, WHITE);
        grid.row(3, 4, 11, WHITE);
        grid.row(4, 4, 11, GOLD);
        grid.row(4, 4, 5, GOLD_HI);
        grid.set(8, 4, GEM);
        grid.set(9, 4, GEM_HI);
        grid.rect(8, 1, 8, 3, GOLD);
        grid.set(7, 2, GOLD);
        grid.set(9, 2, GOLD_SH);
        grid.rect(10, 1, 11, 3, "#cfc6b0");
        grid.set(10, 1, WHITE);
        grid.set(10, 2, WHITE);
        grid.set(11, 3, "#cfc6b0");
        grid.row(5, 4, 5, hair);
        grid.row(5, 9, 11, hSh);
      } else {
        // bare head with a circlet and a floating halo
        grid.row(3, 5, 10, hair);
        grid.row(4, 4, 11, hair);
        grid.row(3, 6, 7, hHi);
        grid.row(4, 9, 11, hSh);
        grid.row(1, 6, 9, GOLD_HI);
        grid.set(5, 2, GOLD);
        grid.set(10, 2, GOLD);
        grid.row(5, 4, 11, GOLD);
        grid.set(4, 5, GOLD_SH);
        grid.set(11, 5, GOLD_SH);
        grid.set(8, 5, GEM);
        grid.set(9, 5, GEM_HI);
      }
      break;
    }
    case "ranger": {
      // open green hood with a swept-back point and a tall feather
      const { main, mHi, mSh, accent } = palette;
      grid.row(1, 3, 6, main);
      grid.row(2, 4, 9, main);
      grid.row(3, 4, 11, main);
      grid.row(4, 3, 12, main);
      grid.rect(12, 5, 12, 6, mSh);
      grid.rect(3, 5, 3, 8, mSh);
      grid.set(4, 2, mHi);
      grid.set(5, 3, mHi);
      grid.set(6, 3, mHi);
      grid.set(5, 2, mHi);
      grid.row(4, 9, 12, mSh);
      grid.row(3, 10, 11, mSh);
      grid.row(5, 4, 8, hair);
      grid.set(6, 5, hHi);
      grid.set(9, 5, hSh);
      grid.set(11, 3, accent);
      grid.set(12, 3, FEATHER);
      grid.set(12, 2, accent);
      grid.set(13, 2, FEATHER);
      break;
    }
  }
};

type Dir = "up" | "fwd";

const drawBaseWeapon = (
  grid: Grid,
  palette: Pal,
  cls: AdvClass,
  hx: number,
  hy: number,
  dir: Dir,
  opt: { pulled?: boolean; glow?: boolean; len?: number } = {},
) => {
  const ax = hx + 1;
  if (dir === "up") {
    switch (cls) {
      case "warrior": {
        grid.row(hy - 1, hx, hx + 2, GOLD);
        for (let y = hy - 7; y <= hy - 2; y++) {
          grid.set(ax, y, STEEL_HI);
          grid.set(ax + 1, y, STEEL_SH);
        }
        grid.set(ax, hy - 8, WHITE);
        grid.set(ax, hy, WOOD);
        grid.set(ax, hy + 1, GOLD_SH);
        break;
      }
      case "mage": {
        const len = opt.len ?? 8;
        for (let y = hy - len; y <= hy + 6; y++) grid.set(ax, y, y % 3 === 0 ? WOOD_HI : WOOD);
        grid.rect(ax, hy - len - 2, ax + 1, hy - len - 1, opt.glow ? GEM_HI : GEM);
        grid.set(ax, hy - len - 2, WHITE);
        grid.set(ax - 1, hy - len - 1, WOOD_HI);
        grid.set(ax + 2, hy - len - 1, WOOD_HI);
        grid.set(ax - 1, hy - len - 2, GEM_HI);
        grid.set(ax + 2, hy - len - 3, GEM_HI);
        grid.set(ax + 1, hy - len - 3, GEM);
        if (opt.glow) {
          grid.set(ax - 2, hy - len - 2, GEM);
          grid.set(ax + 3, hy - len - 2, GEM);
          grid.set(ax, hy - len - 4, GEM);
        }
        break;
      }
      case "rogue": {
        grid.row(hy - 1, hx, hx + 2, WOOD_SH);
        for (let y = hy - 4; y <= hy - 2; y++) {
          grid.set(ax, y, STEEL_HI);
          if (y > hy - 4) grid.set(ax + 1, y, STEEL_SH);
        }
        grid.set(ax, hy - 5, WHITE);
        grid.set(ax, hy, BELT);
        break;
      }
      case "cleric": {
        // holy staff topped with a golden cross
        for (let y = hy - 5; y <= hy + 1; y++) grid.set(ax, y, y % 3 === 0 ? WOOD_HI : WOOD);
        grid.rect(ax, hy - 10, ax, hy - 6, GOLD);
        grid.row(hy - 8, ax - 1, ax + 1, GOLD);
        grid.set(ax, hy - 10, GOLD_HI);
        grid.set(ax, hy - 8, GOLD_HI);
        grid.set(ax + 1, hy - 8, GOLD_SH);
        grid.set(ax, hy - 6, GOLD_SH);
        break;
      }
      case "ranger": {
        const wood = [
          [0, -8],
          [1, -7],
          [1, -6],
          [1, -5],
          [1, -4],
          [1, -3],
          [1, -2],
          [1, -1],
          [1, 0],
          [1, 1],
          [1, 2],
          [1, 3],
          [1, 4],
          [0, 5],
        ];
        for (const [ox, oy] of wood) grid.set(ax + ox, hy + oy, ox === 0 ? WOOD_SH : WOOD_HI);
        for (let y = hy - 7; y <= hy + 4; y++) grid.set(ax, y, FEATHER);
        break;
      }
    }
    return;
  }
  // forward strike (hand at hx,hy)
  switch (cls) {
    case "warrior":
      grid.rect(hx + 1, hy - 1, hx + 1, hy + 2, GOLD);
      grid.row(hy, hx + 2, hx + 3, STEEL_HI);
      grid.row(hy + 1, hx + 2, hx + 3, STEEL_SH);
      grid.set(hx + 3, hy, WHITE);
      break;
    case "mage":
      grid.set(hx + 1, hy, WOOD_HI);
      grid.set(hx + 1, hy + 1, WOOD);
      grid.rect(hx + 2, hy - 1, hx + 3, hy, opt.glow ? GEM_HI : GEM);
      grid.set(hx + 2, hy - 1, WHITE);
      break;
    case "rogue":
      grid.rect(hx + 1, hy - 1, hx + 1, hy + 1, WOOD_SH);
      grid.row(hy, hx + 2, hx + 3, STEEL_HI);
      grid.set(hx + 2, hy + 1, STEEL_SH);
      break;
    case "cleric":
      grid.set(hx + 1, hy, WOOD);
      grid.rect(hx + 2, hy - 1, hx + 3, hy + 1, GOLD);
      grid.set(hx + 2, hy - 1, GOLD_HI);
      grid.set(hx + 3, hy + 1, GOLD_SH);
      break;
    case "ranger": {
      const bx = hx + 3;
      for (let y = hy - 3; y <= hy + 3; y++) grid.set(bx, y, WOOD_HI);
      grid.set(bx - 1, hy - 3, WOOD_SH);
      grid.set(bx - 1, hy + 3, WOOD_SH);
      if (opt.pulled) {
        grid.set(bx - 1, hy - 2, FEATHER);
        grid.set(bx - 2, hy - 1, FEATHER);
        grid.set(bx - 2, hy + 1, FEATHER);
        grid.set(bx - 1, hy + 2, FEATHER);
        grid.set(bx - 2, hy, FEATHER);
        grid.set(bx - 1, hy, WOOD);
        grid.set(bx, hy, STEEL_HI);
      } else {
        for (let y = hy - 2; y <= hy + 2; y++) grid.set(bx - 1, y, FEATHER);
      }
      break;
    }
  }
};

/** What the left hand carries: the warrior's heater shield, the cleric's holy book. */
const drawBaseOffhand = (grid: Grid, palette: Pal, cls: AdvClass) => {
  grid.dx = 0;
  grid.dy = 0;
  if (cls === "warrior") {
    const face = palette.accent;
    grid.row(12, 2, 5, STEEL);
    grid.set(1, 13, STEEL);
    grid.row(13, 2, 4, face);
    grid.set(5, 13, STEEL_SH);
    grid.set(1, 14, STEEL);
    grid.row(14, 2, 4, face);
    grid.set(3, 14, GOLD);
    grid.set(5, 14, STEEL_SH);
    grid.set(1, 15, STEEL);
    grid.set(2, 15, lighten(face, 0.3));
    grid.set(3, 15, GOLD_HI);
    grid.set(4, 15, face);
    grid.set(5, 15, STEEL_SH);
    grid.set(1, 16, STEEL);
    grid.row(16, 2, 4, darken(face, 0.15));
    grid.set(5, 16, STEEL_SH);
    grid.set(2, 17, STEEL);
    grid.row(17, 3, 4, darken(face, 0.3));
    grid.set(5, 17, STEEL_SH);
    grid.row(18, 3, 4, STEEL_SH);
    grid.set(3, 19, STEEL_SH);
  } else if (cls === "cleric") {
    const cover = darken(palette.accent, 0.1);
    grid.rect(1, 14, 3, 17, cover);
    grid.rect(3, 14, 3, 17, PAPER);
    grid.set(3, 15, PAPER_SH);
    grid.set(3, 17, PAPER_SH);
    grid.rect(1, 14, 1, 17, darken(cover, 0.25));
    grid.set(2, 16, GOLD);
    grid.row(16, 1, 3, GOLD_SH);
    grid.set(2, 14, GOLD_HI);
    grid.set(2, 15, GOLD_HI);
  }
};

// ---------------------------------------------------------------- level gear (tiers 1-4, tier 0 = the plain look)
// Everything below is opaque pixels only. Tier 1 adds a cloak and a small detail, tier 2 better weapon/armour with
// metal trim, tier 3 a longer patterned cloak with gold and a gem, tier 4 a gold headpiece and sparkle pixels.
const CAPE_COLOR: Record<AdvClass, string> = {
  warrior: "#a8323c",
  mage: "#4b3f9e",
  rogue: "#3a2f4f",
  cleric: "#b9a8e6",
  ranger: "#2f6b3a",
};
/** the last row of the cloak per tier (rogue and ranger already wear one, theirs just grows longer) */
const CAPE_END = [0, 19, 19, 21, 22];
const CAPE_END_HOODED = [0, 21, 21, 22, 22];
const CAPE_TOP = 11;

/** the cloak hangs behind the body on the back (left) side; drawn first so body, arms and legs cover its middle */
const drawCape = (grid: Grid, palette: Pal, cls: AdvClass, tier: GearTier, opt: BodyOpt) => {
  if (tier < 1) return;
  grid.dx = 0;
  grid.dy = 0;
  const hooded = cls === "rogue" || cls === "ranger";
  const base = hooded ? palette.main : tier >= 4 ? lighten(CAPE_COLOR[cls], 0.2) : CAPE_COLOR[cls];
  const hi = lighten(base, 0.3);
  const sh = darken(base, 0.3);
  const end = Math.min(hooded ? CAPE_END_HOODED[tier] : CAPE_END[tier], opt.seated ? 17 : 22);
  const sway = swayOf(opt.wf);
  const start = hooded ? (cls === "rogue" ? 21 : 20) : CAPE_TOP;
  for (let y = start; y <= end; y++) {
    const shift = y >= 18 ? sway : 0;
    const left = (y < 15 ? 3 : isRobe(cls) && y >= 16 ? 1 : 2) + shift;
    const right = 4 + shift;
    for (let x = left; x <= right; x++) {
      let color = x === left ? sh : x === right ? hi : base;
      if (tier >= 3 && y % 2 === 0 && x === left + 1 && y < end) color = tier >= 4 ? GOLD : GOLD_SH;
      if (y === end && tier >= 2) color = tier >= 4 ? GOLD_HI : tier >= 3 ? GOLD : GOLD_SH;
      grid.set(x, y, color);
    }
  }
  if (tier >= 3 && !opt.seated) grid.set(3 + sway, Math.min(end, 22) - 1, tier >= 4 ? GEM : GOLD);
};

/** a dithered pair of sparkle pixels (opaque, never alpha) */
const sparkle = (grid: Grid, x: number, y: number) => {
  grid.set(x, y, WHITE);
  grid.set(x + 1, y - 1, GOLD_HI);
};

const gearWarriorBody = (grid: Grid, tier: GearTier) => {
  if (tier >= 1) {
    grid.set(5, 17, GOLD_SH);
    grid.set(10, 17, GOLD_SH);
    grid.set(5, 18, GOLD_SH);
  }
  if (tier >= 2) {
    // steel pauldrons grow outwards, gold-rimmed breastplate
    grid.rect(2, 11, 2, 13, STEEL);
    grid.set(2, 11, STEEL_HI);
    grid.set(2, 13, STEEL_SH);
    grid.set(3, 13, STEEL_SH);
    grid.rect(13, 11, 13, 12, STEEL);
    grid.set(13, 12, STEEL_SH);
    grid.set(12, 13, STEEL_SH);
    grid.set(5, 11, GOLD);
    grid.set(10, 11, GOLD);
    grid.row(16, 5, 10, GOLD_SH);
  }
  if (tier >= 3) {
    grid.set(7, 12, GOLD);
    grid.set(8, 12, GEM);
    grid.set(9, 12, GOLD);
    grid.set(2, 12, GOLD);
    grid.set(13, 11, GOLD);
    grid.row(17, 6, 9, GOLD_SH);
    grid.set(8, 17, GOLD_HI);
  }
  if (tier >= 4) {
    grid.row(16, 5, 10, GOLD);
    grid.row(11, 2, 5, GOLD_HI);
    grid.set(8, 12, GEM_HI);
    grid.set(4, 12, GOLD_HI);
    grid.set(5, 18, GOLD);
    grid.set(10, 18, GOLD);
  }
};

const gearMageBody = (grid: Grid, palette: Pal, tier: GearTier, opt: BodyOpt) => {
  const sway = swayOf(opt.wf);
  if (tier >= 1) grid.set(8, 16, GEM);
  if (tier >= 2) {
    // gold-capped mantle over the shoulders
    grid.set(4, 11, GOLD);
    grid.set(4, 12, palette.mHi);
    grid.set(11, 11, GOLD);
    grid.set(11, 12, palette.mSh);
    grid.set(6, 15, GOLD_HI);
    grid.set(9, 13, GOLD_HI);
  }
  if (tier >= 3) {
    grid.set(8, 12, GEM);
    grid.row(11, 5, 10, GOLD_SH);
    if (!opt.seated) {
      grid.set(5, 19, GOLD);
      grid.set(10, 18, GOLD);
      grid.set(8, 20, GOLD_HI);
      grid.set(6, 18, GOLD_SH);
    }
  }
  if (tier >= 4) {
    grid.row(11, 5, 10, GOLD);
    grid.set(4, 11, GOLD_HI);
    grid.set(11, 11, GOLD_HI);
    if (!opt.seated) grid.row(21, 3 + sway, 12 + sway, GOLD_HI);
    grid.set(8, 16, GEM_HI);
  }
};

const gearRogueBody = (grid: Grid, tier: GearTier) => {
  if (tier >= 1) {
    // gold clasp and chain on the cloak (shows seated too)
    grid.set(5, 11, GOLD_SH);
    grid.set(5, 12, GOLD_SH);
    grid.set(4, 13, GOLD_SH);
    grid.set(6, 17, GOLD_SH);
    grid.set(9, 17, GOLD_SH);
  }
  if (tier >= 2) {
    // a second bandolier crosses the first
    for (let i = 0; i <= 5; i++) grid.set(9 - Math.floor((i * 4) / 6), 11 + i, LEATHER);
    grid.set(8, 13, GOLD_SH);
    grid.set(5, 11, GOLD);
  }
  if (tier >= 3) {
    grid.set(7, 12, GOLD);
    grid.set(8, 15, GOLD);
    grid.set(6, 16, GOLD_SH);
    grid.set(9, 16, GOLD_SH);
    grid.set(8, 14, GEM);
  }
  if (tier >= 4) {
    grid.row(17, 6, 9, GOLD_SH);
    grid.set(7, 17, GOLD_HI);
    grid.set(8, 14, GEM_HI);
  }
};

const gearClericBody = (grid: Grid, tier: GearTier, opt: BodyOpt) => {
  const sway = swayOf(opt.wf);
  if (tier >= 1) {
    grid.set(6, 11, GOLD);
    grid.set(9, 11, GOLD);
  }
  if (tier >= 2) {
    // a big holy symbol on the chest and gold shoulder caps
    grid.set(8, 14, GEM);
    grid.set(7, 14, GOLD_HI);
    grid.set(9, 14, GOLD_HI);
    grid.set(8, 13, GOLD_HI);
    grid.set(8, 15, GOLD_HI);
    grid.set(4, 11, GOLD_HI);
    grid.set(11, 11, GOLD_HI);
    grid.set(4, 12, GOLD);
    grid.set(11, 12, GOLD);
  }
  if (tier >= 3) {
    for (let x = 5; x <= 10; x += 2) grid.set(x, 11, GOLD);
    grid.row(17, 5, 10, GOLD);
    if (!opt.seated) grid.row(21, 4 + sway, 11 + sway, GOLD);
    grid.set(8, 14, GEM_HI);
  }
  if (tier >= 4) {
    grid.rect(8, 13, 8, 16, GOLD_HI);
    grid.row(14, 7, 9, GOLD_HI);
    grid.set(8, 14, GEM_HI);
    grid.set(5, 12, GOLD_HI);
  }
};

const gearRangerBody = (grid: Grid, tier: GearTier) => {
  if (tier >= 1) {
    grid.set(5, 11, GOLD_SH);
    grid.set(5, 12, GOLD_SH);
    grid.set(4, 13, GOLD_SH);
    grid.set(5, 17, GOLD_SH);
    grid.set(8, 17, GOLD_SH);
  }
  if (tier >= 2) {
    // leather shoulder guard and a gold-studded quiver
    grid.rect(11, 11, 12, 11, LEATHER);
    grid.set(12, 11, WOOD_HI);
    grid.set(11, 12, WOOD_HI);
    grid.set(2, 10, GOLD_SH);
    grid.set(2, 13, GOLD_SH);
  }
  if (tier >= 3) {
    for (let i = 0; i <= 4; i += 2) grid.set(6 + i, 12 + i, GOLD_SH);
    grid.set(2, 5, GOLD_HI);
    grid.set(2, 6, GOLD_HI);
    grid.set(3, 6, GOLD);
    grid.set(1, 7, GOLD_HI);
    grid.set(8, 13, GEM);
  }
  if (tier >= 4) {
    grid.set(4, 11, GOLD);
    grid.set(5, 11, GOLD_HI);
    grid.set(10, 11, GOLD);
    grid.set(8, 13, GEM_HI);
    grid.row(17, 5, 8, GOLD_SH);
  }
};

const drawBodyGear = (grid: Grid, palette: Pal, cls: AdvClass, tier: GearTier, opt: BodyOpt) => {
  if (tier < 1) return;
  grid.dx = 0;
  grid.dy = 0;
  switch (cls) {
    case "warrior":
      return gearWarriorBody(grid, tier);
    case "mage":
      return gearMageBody(grid, palette, tier, opt);
    case "rogue":
      return gearRogueBody(grid, tier);
    case "cleric":
      return gearClericBody(grid, tier, opt);
    case "ranger":
      return gearRangerBody(grid, tier);
  }
};

const gearWarriorHead = (grid: Grid, tier: GearTier) => {
  if (tier >= 1) grid.set(4, 5, GOLD_SH);
  if (tier >= 2) {
    grid.row(3, 6, 9, STEEL_HI);
    grid.row(6, 4, 7, GOLD_SH);
    grid.set(4, 6, GOLD);
  }
  if (tier >= 3) {
    grid.set(8, 5, GEM);
    grid.set(6, 1, GOLD);
    grid.set(9, 1, GOLD);
    grid.row(6, 4, 7, GOLD);
  }
  if (tier >= 4) {
    // a golden crown around the helm
    grid.row(4, 4, 11, GOLD);
    grid.row(4, 4, 6, GOLD_HI);
    for (const x of [5, 7, 9]) grid.set(x, 3, GOLD_HI);
    grid.set(8, 4, GEM_HI);
  }
};

const gearMageHead = (grid: Grid, palette: Pal, tier: GearTier) => {
  if (tier >= 1) grid.set(8, 3, GEM);
  if (tier >= 2) {
    // gem-set hat band and gold brim edges
    grid.row(3, 5, 10, GOLD_HI);
    grid.set(8, 3, GEM);
    grid.set(7, 3, GOLD_SH);
    grid.set(2, 4, GOLD_SH);
    grid.set(12, 4, GOLD_SH);
  }
  if (tier >= 3) {
    grid.set(6, 3, GEM_HI);
    grid.set(9, 3, GEM);
    grid.set(2, 4, GOLD);
    grid.set(12, 4, GOLD);
    grid.set(9, 1, GOLD);
  }
  if (tier >= 4) {
    // a golden pointed crown-hat
    grid.row(1, 7, 9, GOLD);
    grid.set(8, 1, GOLD_HI);
    grid.row(2, 6, 9, GOLD_SH);
    grid.row(2, 6, 7, palette.main);
    grid.set(9, 2, GOLD);
    grid.set(5, 3, GEM);
    grid.set(11, 4, GOLD_HI);
    grid.set(3, 4, GOLD_HI);
  }
};

const gearRogueHead = (grid: Grid, tier: GearTier) => {
  if (tier >= 2) grid.set(8, 2, GOLD_SH);
  if (tier >= 3) {
    grid.set(8, 2, GOLD);
    grid.set(5, 3, GOLD_SH);
    grid.set(10, 3, GOLD_SH);
  }
  if (tier >= 4) {
    // a gold circlet over the hood
    grid.row(4, 4, 11, GOLD);
    grid.set(8, 4, GEM);
    grid.set(4, 4, GOLD_HI);
  }
};

const gearClericHead = (grid: Grid, palette: Pal, tier: GearTier) => {
  const mitre = palette.style !== 2;
  if (tier >= 1) grid.set(7, mitre ? 4 : 5, GOLD_HI);
  if (tier >= 2) {
    if (mitre) {
      grid.set(6, 4, GEM);
      grid.set(10, 4, GEM);
    } else {
      grid.row(1, 5, 10, GOLD_HI);
    }
  }
  if (tier >= 3) {
    if (mitre) {
      grid.set(5, 1, GOLD);
      grid.set(6, 1, GOLD);
      grid.set(9, 1, GOLD);
      grid.set(10, 1, GOLD_HI);
    } else {
      grid.set(6, 5, GEM);
      grid.set(10, 5, GEM_HI);
    }
  }
  if (tier >= 4) {
    if (mitre) {
      grid.row(2, 5, 10, GOLD_HI);
      grid.row(3, 4, 11, GOLD);
      grid.set(8, 3, GEM_HI);
    } else {
      grid.set(4, 1, GOLD);
      grid.set(11, 1, GOLD);
      grid.set(4, 2, GOLD_SH);
      grid.set(11, 2, GOLD_SH);
    }
  }
};

const gearRangerHead = (grid: Grid, tier: GearTier) => {
  if (tier >= 2) {
    grid.set(4, 1, GOLD_SH);
    grid.set(5, 1, GOLD_SH);
  }
  if (tier >= 3) {
    grid.set(11, 3, GOLD);
    grid.set(12, 3, GOLD_HI);
    grid.set(12, 2, GOLD);
    grid.set(13, 2, GOLD_HI);
  }
  if (tier >= 4) {
    // a gold circlet on the hood brim
    grid.row(4, 4, 11, GOLD);
    grid.set(8, 4, GEM);
    grid.set(4, 4, GOLD_HI);
  }
};

const drawHeadGear = (grid: Grid, palette: Pal, cls: AdvClass, tier: GearTier) => {
  if (tier < 1) return;
  switch (cls) {
    case "warrior":
      return gearWarriorHead(grid, tier);
    case "mage":
      return gearMageHead(grid, palette, tier);
    case "rogue":
      return gearRogueHead(grid, tier);
    case "cleric":
      return gearClericHead(grid, palette, tier);
    case "ranger":
      return gearRangerHead(grid, tier);
  }
};

/** upgrades drawn over the plain weapon; never touches the hand cell (hx, hy) */
const gearWeaponUp = (grid: Grid, cls: AdvClass, tier: GearTier, hx: number, hy: number, len: number) => {
  const ax = hx + 1;
  switch (cls) {
    case "warrior":
      if (tier >= 2) {
        grid.row(hy - 1, hx - 1, hx + 3, GOLD);
        grid.set(ax, hy - 8, STEEL_HI);
        grid.set(ax + 1, hy - 8, STEEL_SH);
        grid.set(ax, hy - 9, WHITE);
        grid.set(ax, hy + 1, GOLD);
      }
      if (tier >= 3) {
        grid.set(ax, hy - 1, GEM);
        grid.set(hx - 1, hy - 1, GOLD_HI);
        grid.set(hx + 3, hy - 1, GOLD_HI);
      }
      if (tier >= 4) {
        sparkle(grid, ax - 1, hy - 6);
        sparkle(grid, ax + 1, hy - 9);
      }
      break;
    case "mage":
      if (tier >= 2) {
        grid.set(ax - 1, hy - len - 1, GOLD);
        grid.set(ax + 2, hy - len - 1, GOLD);
        grid.set(ax, hy - len, GOLD);
        grid.set(ax + 1, hy - len, GOLD_SH);
      }
      if (tier >= 3) {
        for (let y = hy - len + 2; y <= hy + 5; y += 4) grid.set(ax, y, GOLD_SH);
        grid.set(ax - 1, hy - len - 2, GEM);
        grid.set(ax + 2, hy - len - 2, GEM);
      }
      if (tier >= 4) {
        sparkle(grid, ax - 2, hy - len - 2);
        sparkle(grid, ax + 2, hy - len + 1);
      }
      break;
    case "rogue":
      if (tier >= 2) {
        for (let y = hy - 7; y <= hy - 5; y++) {
          grid.set(ax, y, STEEL_HI);
          grid.set(ax + 1, y, STEEL_SH);
        }
        grid.set(ax, hy - 8, WHITE);
        grid.set(hx, hy - 1, GOLD_SH);
        grid.set(hx + 2, hy - 1, GOLD_SH);
      }
      if (tier >= 3) {
        grid.set(ax, hy, GEM);
        grid.set(ax, hy - 1, GOLD);
      }
      if (tier >= 4) {
        sparkle(grid, ax - 1, hy - 6);
        sparkle(grid, ax + 1, hy - 8);
      }
      break;
    case "cleric":
      if (tier >= 2) {
        // the staff's cross becomes a studded mace head
        grid.rect(ax - 1, hy - 9, ax + 1, hy - 7, GOLD);
        grid.set(ax - 1, hy - 9, GOLD_HI);
        grid.set(ax + 1, hy - 9, GOLD_SH);
        grid.set(ax - 1, hy - 7, GOLD_SH);
        grid.set(ax + 1, hy - 7, GOLD_SH);
        grid.set(ax, hy - 8, GOLD_SH);
        grid.set(ax, hy - 10, GOLD_HI);
      }
      if (tier >= 3) {
        grid.set(ax, hy - 8, GEM);
        grid.set(ax, hy - 6, GOLD);
      }
      if (tier >= 4) {
        grid.set(ax, hy - 8, GEM_HI);
        sparkle(grid, ax - 2, hy - 8);
        sparkle(grid, ax + 1, hy - 10);
      }
      break;
    case "ranger":
      if (tier >= 2) {
        grid.set(ax - 1, hy - 9, WOOD_SH);
        grid.set(ax - 1, hy + 6, WOOD_SH);
        grid.set(ax, hy - 8, WOOD_SH);
        grid.set(ax, hy + 5, WOOD_SH);
        grid.set(ax + 1, hy + 5, WOOD_HI);
      }
      if (tier >= 3) {
        grid.set(ax - 1, hy - 9, GOLD);
        grid.set(ax - 1, hy + 6, GOLD);
        grid.set(ax + 1, hy - 1, GOLD_SH);
      }
      if (tier >= 4) {
        grid.set(ax + 1, hy + 1, GEM);
        sparkle(grid, ax - 2, hy - 7);
      }
      break;
  }
};

const gearWeaponFwd = (grid: Grid, cls: AdvClass, tier: GearTier, hx: number, hy: number) => {
  switch (cls) {
    case "warrior":
      if (tier >= 2) {
        grid.row(hy, hx + 2, hx + 4, STEEL_HI);
        grid.row(hy + 1, hx + 2, hx + 4, STEEL_SH);
        grid.set(hx + 4, hy, WHITE);
        grid.set(hx + 1, hy - 2, GOLD);
        grid.set(hx + 1, hy + 3, GOLD);
      }
      if (tier >= 3) grid.set(hx + 1, hy + 1, GEM);
      if (tier >= 4) {
        sparkle(grid, hx + 3, hy - 2);
        sparkle(grid, hx + 4, hy + 3);
      }
      break;
    case "mage":
      if (tier >= 2) {
        grid.set(hx + 1, hy - 1, GOLD);
        grid.set(hx + 2, hy + 1, GOLD);
        grid.set(hx + 4, hy, GEM);
      }
      if (tier >= 3) grid.set(hx + 3, hy + 1, GOLD_SH);
      if (tier >= 4) sparkle(grid, hx + 3, hy - 2);
      break;
    case "rogue":
      if (tier >= 2) {
        grid.row(hy, hx + 2, hx + 4, STEEL_HI);
        grid.row(hy + 1, hx + 2, hx + 3, STEEL_SH);
        grid.set(hx + 4, hy, WHITE);
      }
      if (tier >= 3) grid.set(hx + 1, hy, GEM);
      if (tier >= 4) sparkle(grid, hx + 3, hy - 2);
      break;
    case "cleric":
      if (tier >= 2) {
        grid.rect(hx + 2, hy - 1, hx + 4, hy + 1, GOLD);
        grid.set(hx + 2, hy - 1, GOLD_HI);
        grid.set(hx + 3, hy, GOLD_SH);
        grid.set(hx + 4, hy + 1, GOLD_SH);
      }
      if (tier >= 3) grid.set(hx + 3, hy, GEM);
      if (tier >= 4) {
        grid.set(hx + 3, hy, GEM_HI);
        sparkle(grid, hx + 3, hy - 3);
      }
      break;
    case "ranger":
      // a longer bow: one extra stave pixel at each end, gold tips from tier 3
      if (tier >= 2) {
        grid.set(hx + 3, hy - 4, WOOD_HI);
        grid.set(hx + 3, hy + 4, WOOD_HI);
      }
      if (tier >= 3) {
        grid.set(hx + 3, hy - 4, GOLD);
        grid.set(hx + 3, hy + 4, GOLD);
      }
      if (tier >= 4) sparkle(grid, hx + 2, hy - 5);
      break;
  }
};

const drawWeapon = (
  grid: Grid,
  palette: Pal,
  cls: AdvClass,
  tier: GearTier,
  hx: number,
  hy: number,
  dir: Dir,
  opt: { pulled?: boolean; glow?: boolean; len?: number } = {},
) => {
  drawBaseWeapon(grid, palette, cls, hx, hy, dir, opt);
  if (tier < 1) return;
  if (dir === "up") gearWeaponUp(grid, cls, tier, hx, hy, opt.len ?? 8);
  else gearWeaponFwd(grid, cls, tier, hx, hy);
};

const drawOffhand = (grid: Grid, palette: Pal, cls: AdvClass, tier: GearTier) => {
  drawBaseOffhand(grid, palette, cls);
  if (tier < 2) return;
  if (cls === "warrior") {
    // a gold cross-bar on the shield; rim and boss turn gold with the tier
    grid.rect(3, 13, 3, 16, GOLD);
    if (tier >= 3) {
      grid.rect(1, 13, 1, 16, GOLD_SH);
      grid.row(12, 2, 5, GOLD_SH);
    }
    if (tier >= 4) {
      grid.rect(1, 13, 1, 16, GOLD);
      grid.row(12, 2, 5, GOLD_HI);
      grid.set(3, 14, GEM);
    }
  } else if (cls === "cleric") {
    grid.set(1, 14, GOLD);
    grid.set(1, 17, GOLD);
    if (tier >= 3) grid.set(2, 15, GEM);
    if (tier >= 4) sparkle(grid, 0, 14);
  } else if (cls === "rogue") {
    // twin daggers: a second blade in the off hand
    grid.rect(3, 12, 3, 14, STEEL_HI);
    grid.set(3, 11, WHITE);
    grid.set(3, 15, GOLD_SH);
    grid.set(2, 15, WOOD_SH);
    if (tier >= 3) grid.set(3, 16, GEM);
    if (tier >= 4) sparkle(grid, 1, 11);
  }
};

const buildChar = (look: Look, pose: Pose, frame: number, tier: GearTier): HTMLCanvasElement => {
  const cls: AdvClass = (ADV_CLASSES as string[]).includes(look.cls) ? look.cls : "warrior";
  const palette = mkPal(look, cls);
  const frameIdx = normFrame(frame, pose === "walk" ? 4 : 2);
  if (pose === "rest") return buildRest(palette, cls, frameIdx, tier);
  const grid = new Grid(16, 24);
  const walkFrame = pose === "walk" ? frameIdx : -1;

  drawCape(grid, palette, cls, tier, { wf: walkFrame, seated: false });
  drawLegs(grid, palette, walkFrame, cls);
  drawBody(grid, palette, cls, { wf: walkFrame, seated: false });
  drawBodyGear(grid, palette, cls, tier, { wf: walkFrame, seated: false });

  let expr: Expr = "normal",
    mouth: MouthT = "smile",
    hdx = 0,
    hdy = 0;
  let draw: () => void = () => {};

  switch (pose) {
    case "idle":
      hdy = frameIdx;
      if (frameIdx === 1) expr = "blink";
      draw = () => {
        arm(grid, palette, 4, 12, 4, 15);
        arm(grid, palette, 11, 12, 12, 15);
        drawWeapon(grid, palette, cls, tier, 12, 15, "up");
        drawOffhand(grid, palette, cls, tier);
      };
      break;
    case "walk": {
      hdy = frameIdx % 2 === 1 ? -1 : 0;
      const ry = frameIdx === 0 ? 16 : frameIdx === 2 ? 14 : 15;
      const ly = frameIdx === 0 ? 14 : frameIdx === 2 ? 16 : 15;
      draw = () => {
        arm(grid, palette, 4, 12, 4, ly);
        arm(grid, palette, 11, 12, 12, ry);
        drawWeapon(grid, palette, cls, tier, 12, ry, "up");
        drawOffhand(grid, palette, cls, tier);
      };
      break;
    }
    case "attack":
      if (frameIdx === 0) {
        mouth = "flat";
        draw = () => {
          arm(grid, palette, 4, 12, 4, 15);
          if (cls === "ranger") {
            arm(grid, palette, 11, 12, 11, 13);
            drawWeapon(grid, palette, cls, tier, 11, 13, "fwd", { pulled: true });
          } else {
            arm(grid, palette, 11, 12, 12, 10);
            drawWeapon(grid, palette, cls, tier, 12, 10, "up");
          }
          drawOffhand(grid, palette, cls, tier);
        };
      } else {
        mouth = "open";
        hdx = 1;
        draw = () => {
          arm(grid, palette, 4, 12, 4, 15);
          if (cls === "ranger") {
            arm(grid, palette, 11, 12, 11, 13);
            drawWeapon(grid, palette, cls, tier, 11, 13, "fwd");
          } else {
            arm(grid, palette, 11, 12, 11, 14);
            drawWeapon(grid, palette, cls, tier, 11, 14, "fwd", { glow: true });
          }
          drawOffhand(grid, palette, cls, tier);
        };
      }
      break;
    case "cast": {
      mouth = "open";
      expr = "wide";
      const ry = frameIdx === 0 ? 11 : 10;
      draw = () => {
        arm(grid, palette, 4, 12, 3, frameIdx === 0 ? 10 : 9);
        arm(grid, palette, 11, 12, 12, ry);
        drawWeapon(grid, palette, cls, tier, 12, ry, "up", { glow: frameIdx === 1, len: 7 });
        if (frameIdx === 1) {
          grid.set(1, 8, GEM);
          grid.set(2, 7, GEM_HI);
          grid.set(1, 11, GEM_HI);
        }
      };
      break;
    }
    case "read":
      expr = "down";
      mouth = "flat";
      draw = () => {
        grid.row(13, 5, 11, PAPER_SH);
        grid.row(17, 5, 11, PAPER_SH);
        grid.rect(6, 14, 10, 16, PAPER);
        grid.row(14, 6, 9 - frameIdx, INKLINE);
        grid.row(15, 6, 8 + frameIdx, INKLINE);
        grid.row(16, 6, 10, frameIdx ? "#c9b88a" : INKLINE);
        grid.set(5, 13, GOLD_SH);
        grid.set(11, 17, GOLD_SH);
        arm(grid, palette, 4, 12, 5, 15);
        arm(grid, palette, 11, 12, 11, 15);
        grid.set(5, 15, palette.skin);
        grid.set(11, 15, palette.skin);
      };
      break;
    case "write":
      expr = "down";
      mouth = "flat";
      draw = () => {
        grid.rect(6, 13, 10, 17, "#7a4a2b");
        grid.rect(7, 14, 9, 16, PAPER);
        grid.row(14 + frameIdx, 7, 8 + frameIdx, INKLINE);
        grid.row(16, 7, 9, frameIdx ? INKLINE : "#c9b88a");
        grid.set(6, 13, GOLD_SH);
        arm(grid, palette, 4, 12, 5, 16);
        arm(grid, palette, 11, 12, 11, 14 + frameIdx);
        const qy = 13 + frameIdx;
        grid.set(12, qy, FEATHER);
        grid.set(13, qy - 1, FEATHER);
        grid.set(14, qy - 2, "#d95763");
      };
      break;
    case "hand_up":
      expr = "wide";
      mouth = "open";
      draw = () => {
        arm(grid, palette, 4, 12, 4, 15);
        arm(grid, palette, 11, 12, frameIdx ? 13 : 12, frameIdx ? 6 : 5);
      };
      break;
    case "hurt":
      expr = "wince";
      mouth = "open";
      hdx = -1;
      hdy = frameIdx;
      draw = () => {
        arm(grid, palette, 4, 12, 2, 13 + frameIdx);
        arm(grid, palette, 11, 12, 13, 13 + frameIdx);
        drawOffhand(grid, palette, cls, tier);
        grid.set(13, 5, GEM_HI);
        grid.set(14, 6, GEM);
      };
      break;
    case "drink":
      draw = () => {
        arm(grid, palette, 4, 12, 4, 15);
        if (frameIdx === 0) {
          arm(grid, palette, 11, 12, 12, 14);
          grid.rect(12, 10, 14, 13, WOOD_HI);
          grid.row(10, 12, 14, WHITE);
          grid.row(12, 12, 14, GOLD);
          grid.set(14, 13, WOOD);
          grid.set(12, 14, palette.skin);
        } else {
          arm(grid, palette, 11, 12, 12, 12);
          grid.rect(12, 8, 14, 11, WOOD_HI);
          grid.row(8, 12, 14, WHITE);
          grid.row(10, 12, 14, GOLD);
          grid.set(14, 11, WOOD);
          grid.set(12, 12, palette.skin);
        }
      };
      if (frameIdx === 1) expr = "happy";
      break;
    case "cheer":
      expr = "happy";
      mouth = "open";
      hdy = -frameIdx;
      draw = () => {
        arm(grid, palette, 4, 12, 2, 5 - frameIdx);
        arm(grid, palette, 11, 12, 13, 5 - frameIdx);
        if (frameIdx === 1) {
          grid.set(0 + 1, 3, GOLD_HI);
          grid.set(14, 3, GOLD_HI);
        }
      };
      break;
  }

  grid.dx = hdx;
  grid.dy = hdy;
  drawHead(grid, palette, cls, expr, mouth);
  drawHeadGear(grid, palette, cls, tier);
  grid.dx = 0;
  grid.dy = 0;
  draw();
  grid.dx = 0;
  grid.dy = 0;
  grid.outline();
  return grid.toCanvas();
};

/** Sitting cross-legged on the ground; frame 1 = eyes closed + slow breath. */
const buildRest = (palette: Pal, cls: AdvClass, frame: number, tier: GearTier): HTMLCanvasElement => {
  const grid = new Grid(16, 24);
  const robe = isRobe(cls);
  // standing torso drawn in a scratch grid, then dropped 3 rows (legs are replaced by a crossed sit)
  const scratch = new Grid(16, 24);
  drawCape(scratch, palette, cls, tier, { wf: -1, seated: true });
  drawBody(scratch, palette, cls, { wf: -1, seated: true });
  drawBodyGear(scratch, palette, cls, tier, { wf: -1, seated: true });
  const SH = 3;
  for (let y = 0; y < 24 - SH; y++) {
    for (let x = 0; x < 16; x++) {
      const cell = scratch.cells[y * 16 + x];
      if (cell) grid.cells[(y + SH) * 16 + x] = cell;
    }
  }
  // crossed legs
  if (robe) {
    grid.row(21, 3, 12, palette.main);
    grid.set(12, 21, palette.mSh);
    grid.set(3, 21, palette.mHi);
    grid.row(22, 4, 11, cls === "mage" ? GOLD : GOLD_SH);
    grid.row(22, 2, 3, BOOT);
    grid.row(22, 12, 13, BOOT);
    grid.set(2, 22, BOOT_HI);
    grid.set(8, 21, cls === "mage" ? GOLD_HI : palette.mHi);
  } else {
    grid.row(21, 2, 13, palette.pants);
    grid.row(21, 11, 13, palette.pSh);
    grid.row(22, 5, 10, palette.pSh);
    grid.set(5, 22, palette.pants);
    grid.set(6, 22, palette.pants);
    grid.row(22, 2, 4, BOOT);
    grid.set(2, 22, BOOT_HI);
    grid.row(22, 11, 13, BOOT);
    grid.set(8, 21, BELT);
  }
  // hands resting on the knees
  grid.dy = SH;
  arm(grid, palette, 4, 12, 3, 17);
  arm(grid, palette, 11, 12, 12, 17);
  grid.dy = SH + frame;
  drawHead(grid, palette, cls, frame === 1 ? "blink" : "normal", "smile");
  drawHeadGear(grid, palette, cls, tier);
  grid.dx = 0;
  grid.dy = 0;
  grid.outline();
  return grid.toCanvas();
};

export const charSprite = (look: Look, pose: Pose, frame: number, tier: GearTier = 0): HTMLCanvasElement => {
  const frameCount = pose === "walk" ? 4 : 2;
  const key = `c|${look.cls}|${look.hair}|${look.shirt}|${look.skin}|${pose}|${normFrame(frame, frameCount)}|t${tier}`;
  let sprite = cache.get(key);
  if (!sprite) {
    sprite = buildChar(look, pose, frame, tier);
    cache.set(key, sprite);
  }
  return sprite;
};

// ---------------------------------------------------------------- squire (12x18)
type InternPose = "idle" | "walk" | "attack" | "read" | "hand_up";

const buildIntern = (pose: InternPose, frame: number): HTMLCanvasElement => {
  const palette = mkPal(INTERN_LOOK, "squire");
  const grid = new Grid(12, 18);
  const TABARD = "#e9dcc0",
    TABARD_SH = "#c9b88a";
  const SACK = "#a9794a",
    SACK_SH = "#7a5230";
  const main = palette.main,
    mSh = palette.mSh;
  // legs
  const liftL = pose === "walk" && frame === 0,
    liftR = pose === "walk" && frame === 1;
  const leg = (x0: number, lifted: boolean) => {
    grid.rect(x0, 13, x0 + 1, lifted ? 13 : 14, palette.pants);
    grid.set(x0 + 1, 13, palette.pSh);
    const sy = lifted ? 14 : 15;
    grid.row(sy, x0, x0 + 2, BOOT);
    grid.set(x0, sy, BOOT_HI);
  };
  leg(3, liftL);
  leg(7, liftR);
  grid.row(12, 3, 8, palette.pants);
  // plain green tunic with a cream tabard and a rope belt
  grid.rect(3, 8, 8, 11, main);
  for (let y = 8; y <= 11; y++) grid.set(8, y, mSh);
  grid.set(3, 9, palette.mHi);
  grid.rect(4, 8, 7, 12, TABARD);
  grid.rect(7, 8, 7, 12, TABARD_SH);
  grid.set(5, 9, GOLD_SH);
  grid.set(5, 10, GOLD_SH);
  grid.row(11, 3, 8, BELT);
  grid.set(5, 11, GOLD);
  // head
  const hdy = pose === "idle" ? frame : pose === "walk" && frame === 1 ? -1 : 0;
  grid.dy = hdy;
  grid.rect(2, 4, 9, 7, palette.skin);
  grid.row(7, 3, 8, palette.skSh);
  grid.set(2, 5, palette.hair);
  grid.set(2, 6, palette.hSh);
  grid.set(2, 4, palette.hair);
  // pot helmet: round iron dome with a flat rim
  grid.row(0, 4, 7, IRON);
  grid.row(1, 3, 8, IRON);
  grid.row(2, 2, 9, IRON);
  grid.row(3, 1, 10, IRON_SH);
  grid.set(4, 0, IRON_HI);
  grid.set(5, 0, IRON_HI);
  grid.set(3, 1, IRON_HI);
  grid.set(4, 1, IRON_HI);
  grid.set(3, 2, IRON_HI);
  grid.set(8, 1, IRON_SH);
  grid.set(9, 2, IRON_SH);
  grid.set(7, 0, IRON_SH);
  grid.set(1, 3, IRON);
  grid.set(2, 3, IRON);
  const blink = pose === "idle" && frame === 1;
  const down = pose === "read";
  for (const x of [6, 8]) {
    if (blink) grid.set(x, 6, EYE);
    else if (down) {
      grid.set(x, 5, palette.skSh);
      grid.set(x, 6, EYE);
    } else {
      grid.set(x, 5, EYE);
      grid.set(x, 6, EYE);
    }
  }
  grid.set(9, 6, palette.blush);
  grid.set(3, 6, palette.blush);
  if (pose === "hand_up") {
    grid.set(7, 7, MOUTH);
    grid.set(8, 7, MOUTH);
  } else grid.set(7, 7, MOUTH);
  grid.dy = 0;
  // arms / items: a bundle sack on a strap instead of a shield, a wooden practice stick instead of a sword
  const sack = () => {
    grid.rect(0, 10, 2, 12, SACK);
    grid.row(10, 0, 2, SACK_SH);
    grid.set(1, 9, SACK_SH);
    grid.set(0, 12, SACK_SH);
    grid.set(2, 12, SACK_SH);
    grid.set(1, 11, GOLD_SH);
    grid.set(0, 11, SACK_SH);
  };
  const sword = (hx: number, hy: number, dir: "up" | "fwd") => {
    if (dir === "up") {
      grid.set(hx + 1, hy, WOOD_SH);
      for (let y = hy - 5; y <= hy - 1; y++) grid.set(hx + 1, y, y === hy - 5 ? WOOD_HI : WOOD);
    } else {
      grid.rect(hx + 1, hy, hx + 3, hy, WOOD);
      grid.set(hx + 3, hy, WOOD_HI);
    }
  };
  const rarm = (x1: number, y1: number) => {
    grid.set(9, 9, main);
    if (x1 !== 9 || y1 !== 9) {
      grid.set(9, 10, mSh);
    }
    grid.set(x1, y1, palette.skin);
  };
  if (pose === "idle" || pose === "walk") {
    grid.set(2, 9, mSh);
    rarm(9, 10 + (pose === "walk" && frame === 1 ? 1 : 0));
    sword(9, 10, "up");
    sack();
  } else if (pose === "attack") {
    grid.set(2, 9, mSh);
    if (frame === 0) {
      grid.set(9, 9, main);
      grid.set(9, 8, palette.skin);
      sword(9, 8, "up");
    } else {
      grid.set(9, 9, main);
      grid.set(9, 10, palette.skin);
      sword(9, 10, "fwd");
    }
    sack();
  } else if (pose === "read") {
    grid.rect(3, 9, 8, 12, PAPER);
    grid.row(9, 3, 8, PAPER_SH);
    grid.row(12, 3, 8, PAPER_SH);
    grid.row(10, 4, 6 + frame, INKLINE);
    grid.row(11, 4, 7 - frame, "#c9b88a");
    grid.set(2, 10, palette.skin);
    grid.set(9, 10, palette.skin);
    grid.set(2, 9, mSh);
    grid.set(9, 9, mSh);
  } else {
    grid.set(2, 9, mSh);
    grid.set(2, 10, palette.skin);
    grid.set(9, 9, main);
    for (let y = 4; y <= 8; y++) grid.set(10, y, mSh);
    grid.set(10, 3, palette.skin);
    if (frame) grid.set(11, 3, palette.skin);
    else grid.set(10, 2, palette.skin);
    sack();
  }
  grid.outline();
  return grid.toCanvas();
};

/** Squire (subagent): own 12x18 art, small kid with leather cap and tiny shield + sword. */
export const internSprite = (pose: InternPose, frame: number): HTMLCanvasElement => {
  const frameIdx = normFrame(frame, 2);
  const key = `i|${pose}|${frameIdx}`;
  let sprite = cache.get(key);
  if (!sprite) {
    sprite = buildIntern(pose, frameIdx);
    cache.set(key, sprite);
  }
  return sprite;
};

// ---------------------------------------------------------------- props
const EXTRA: Record<string, string> = {
  Y: "#d9a53a",
  K: "#5ea9dd",
  m: "#e8707a",
  x: "#a04050",
  s: "#c9d6e6",
  f: "#fbf7ec",
  B: "#3b6ea5",
  e: "#5c3d28",
  t: "#b9814f",
  G: "#2f6b3a",
  h: "#8fd68a",
  R: "#a82e3d",
  v: "#9b6bd6",
  V: "#5a3a9a",
  C: "#6ff0ff",
  z: "#3a9bb5",
  q: "#6b6f7a",
  u: "#a9afbc",
  o: "#f5a03a",
  W: "#efe2c0",
  j: "#d4bf90",
  Z: "#fff3b0",
  E: "#2e7d3e",
  L: "#3f9a4b",
  M: "#6bbf59",
  T: "#7a4a2b",
  U: "#a0693d",
  F: "#ffd24a",
  H: "#ff7aa8",
  N: "#6a6f7c",
  X: "#9aa0ad",
  D: "#2a2d3a",
  I: "#9fd633",
  J: "#e6ff7a",
};

const PROPS: Record<string, string[]> = {
  paper: ["OOOOOO", "OfBBfO", "OfffBO", "OfBBfO", "OOOOOO"],
  sticky: ["yyyy", "yOOy", "yyOy", "YyyY"],
  mug: ["OOOO.", "OmwOO", "OmmOO", "OOOO."],
  note0: ["....OO..", "....OFO.", "....OFFO", "....OF.O", "....OF..", "..OOOF..", ".OFFFO..", ".OFFFO..", "..OOO..."],
  note1: ["...OO...", "...OFOO.", "...OFFFO", "...OF.OO", "...OF...", ".OOOF...", "OFFFO...", "OFFFO...", ".OOO...."],
  plant: [
    "....g.....",
    "...ggg.g..",
    ".g.ggggg..",
    ".ggggggg.g",
    "..ggggggg.",
    ".gggOgggg.",
    "..gggggg..",
    "...ggg.g..",
    "....g.g...",
    "....ggg...",
    "....nn....",
    "..nnnnnn..",
    "..nnnnnn..",
    "..OnnnnO..",
    "...OnnO...",
    "...OOOO...",
  ],
  steam0: [".s..", "s...", ".sw.", "..s.", ".s..", "s..."],
  steam1: ["..s.", ".sw.", "..s.", ".s..", "..s.", ".s.."],
  steam2: [".s..", "..s.", ".sw.", "s...", ".s..", "..s."],
  sweat0: [".k.", "kwk", ".K."],
  sweat1: ["kk.", "kwK", ".K."],
  spark0: ["..w..", "..y..", "wyyyw", "..y..", "..w.."],
  spark1: ["y...y", ".ywy.", "..w..", ".ywy.", "y...y"],

  ale: [".wfwfw...", "OwwwwwO..", "OoooooOOO", "OoYoooO.O", "OoooooOOO", "OOOOOOO.."],
  scroll: [".OOOOOOOO.", "OjWWWWWWjO", "OjWjjWjWjO", "OjWWWWWWjO", ".OOOOOOOO."],
  quest_note: [
    "....r....",
    ".OOOrOOO.",
    "OWWWWWWWO",
    "OWjjjjjWO",
    "OWWWWWWWO",
    "OWjjjjWWO",
    "OWWWWWWWO",
    "OWjjjjjWO",
    "OWWWWWWWO",
    "OWWWWWjWO",
    ".OOOOOOO.",
  ],
  coin: [".OOO.", "OywyO", "OyYyO", "OYyYO", ".OOO."],
  chest: [
    ".OOOOOOOOOO.",
    "OttttttttttO",
    "OtnnnnnnnntO",
    "OYYYYYYYYYYO",
    "OnnnnYYnnnnO",
    "OnnnnYOnnnnO",
    "OnnnnnnnnnnO",
    "OeeeeeeeeeeO",
    ".OOOOOOOOOO.",
  ],
  slash0: [
    "..s.....",
    "...s....",
    "....ss..",
    ".....ss.",
    "......ss",
    "......ss",
    ".....ss.",
    "....ss..",
    "...s....",
    "..s.....",
  ],
  slash1: [
    "..w.......",
    "...ww.....",
    ".....ww...",
    "......www.",
    ".......www",
    ".......www",
    ".......www",
    ".......www",
    "......www.",
    ".....ww...",
    "...ww.....",
    "..w.......",
  ],
  magic0: [
    "....C....",
    "..v.C.v..",
    "...vCv...",
    ".vCCwCCv.",
    "CCCCwCCCC",
    ".vCCwCCv.",
    "...vCv...",
    "..v.C.v..",
    "....C....",
  ],
  magic1: [
    "C...v...C",
    ".v..C..v.",
    "..v.C.v..",
    "...vwv...",
    "vCCwwwCCv",
    "...vwv...",
    "..v.C.v..",
    ".v..C..v.",
    "C...v...C",
  ],
  owl0: ["nn....nn", "nnnnnnnn", "nwOnnOwn", "nnnYYnnn", "tnnllnnt", ".tnllnt.", "..y..y.."],
  owl1: ["tn....nt", "tnnnnnnt", "twOnnOwt", "tnnYYnnt", ".tnllnt.", "..nllnn.", "..y..y.."],
  portal0: [
    "...OOOO...",
    "..OvvvvO..",
    ".OvVVVVvO.",
    "OvVVVVVVvO",
    "OvVVwwVVvO",
    "OvVwCCwVvO",
    "OvVwCCwVvO",
    "OvVVwwVVvO",
    "OvVVVVVVvO",
    ".OvVVVVvO.",
    "..OvvvvO..",
    "...OOOO...",
  ],
  portal1: [
    "...OOOO...",
    "..OvvvvO..",
    ".OvVVVVvO.",
    "OvVVCVVVvO",
    "OvVCwwVVvO",
    "OvVVwCCVvO",
    "OvVCCwVVvO",
    "OvVVwwCVvO",
    "OvVVVCVVvO",
    ".OvVVVVvO.",
    "..OvvvvO..",
    "...OOOO...",
  ],
  heart: [".OO.OO.", "OwrOrrO", "OrrrrrO", ".OrrrO.", "..OrO..", "...O..."],
  poof0: ["...wwww...", ".wwwwwwww.", "wwwwswwwww", "wwswwwwwsw", ".wwwwwwww.", "..sswwss.."],
  poof1: ["w..ww..w..", ".ww..ww..w", "w..ssw.ww.", "..w....w..", ".w.ww.w..w", "..ww..ww.."],
  arrow: ["ww....u.", "nnnnnnuu", "ww....u."],
  flag: [
    "errrrrr.",
    "errrrrrr",
    "errwwrrr",
    "errrrrr.",
    "e.......",
    "e.......",
    "e.......",
    "e.......",
    "e.......",
    "e.......",
    "e.......",
    "eee.....",
  ],
  torch0: ["...o..", "..oyo.", ".oyyyo", ".oywyo", "..oyo.", ".qNNq.", "..NN..", "..ee..", "..ee..", "..ee.."],
  torch1: ["..o...", "..oyo.", ".oyyyo", ".oyyyo", ".oywyo", ".qNNq.", "..NN..", "..ee..", "..ee..", "..ee.."],
  tree: [
    "......OOOO......",
    "....OOMMMMOO....",
    "...OMMMMMMMMO...",
    "..OMMMLMMMMMMO..",
    ".OMMLLLMMMMMMLO.",
    ".OMLLLLMMMMMLLO.",
    "OMLLLLLMMMMLLLEO",
    "OLLLLLLLMMLLLLEO",
    "OLLLLLLLLLLLLEEO",
    "OELLLLLLLLLLEEEO",
    ".OELLLLLLLLEEEO.",
    ".OEEELLLLEEEEO..",
    "..OOEEEEEEEEOO..",
    "....OOOOOOOO....",
    "......OTUO......",
    "......OTUO......",
    "......OTTO......",
    ".....OTTUTO.....",
    "....OTTTUTTO....",
    "....OOOOOOOO....",
  ],
  bush: [
    "....OOOO....",
    "..OOMMLLOO..",
    ".OMMMLLLLLO.",
    "OMMLLLLLLEEO",
    "OLLLLLLLLEEO",
    "OLLLLLEEEEEO",
    ".OOEEEEEEOO.",
    "...OOOOOO...",
  ],
  rock: ["...OOOO...", "..OuuXXO..", ".OuuXXXNO.", "OuXXXXNNNO", "OXXXXNNNNO", "OXXNNNNNNO", ".OOOOOOOO."],
  flower: ["..H..", ".HFH.", "..H..", "..E..", ".LE..", "..E.."],
  barrel: [".OOOOOO.", "OtttttnO", "OYYYYYYO", "OtnnnnnO", "OtnnnnnO", "OYYYYYYO", "OtnnnnnO", "OnnnnneO", ".OOOOOO."],
  sign: [
    "OOOOOOOOOO",
    "OttttttttO",
    "OteettetnO",
    "OtettetttO",
    "OnnnnnnnnO",
    "OOOOOOOOOO",
    "....OeO...",
    "....OeO...",
    "....OeO...",
    "....OeO...",
    "....OeO...",
    "...OOOOO..",
  ],
  butterfly0: ["ww.ww", "wwOww", "waOaw", ".w.w."],
  butterfly1: ["..w..", ".wOw.", ".waw.", "..O.."],
  bird0: ["D.....D", "DD...DD", ".DDDDD.", "..DDD.."],
  bird1: ["..DDD..", "DDDDDDD", "D.DDD.D", "...D..."],
  firefly: ["JI", "II"],
  smoke0: [".....", "..u..", ".uXu.", "..X..", "....."],
  smoke1: [".....", ".uuu.", "uuXXu", "uXXXN", ".NNN."],
  smoke2: [".uuu.", "uuuXu", "uuXXX", "uXXXN", ".NNN."],
  dust0: [".jWj.", "jWWWj", ".jjj."],
  dust1: ["j.W.j", ".jWj.", "j...j"],
  heart_empty: [".OO.OO.", "OXNONNO", "ONNNNNO", ".ONNNO.", "..ONO..", "...O..."],
  campfire0: [
    "....o.....",
    "...ooo....",
    "..ooyoo...",
    "..oyyyo.o.",
    ".ooyyyyoo.",
    ".oyywwyyo.",
    "..OoyyoO..",
    "OtnnnnnntO",
    ".OeeeeeeO.",
  ],
  campfire1: [
    ".....o....",
    "....oo....",
    "...ooyo...",
    ".o.oyyoo..",
    ".ooyyyyo..",
    ".oyywyyyo.",
    "..OoyyoO..",
    "OtnnnnnntO",
    ".OeeeeeeO.",
  ],
  crit: ["...F...", ".F.F.F.", "..FwF..", "FFwwwFF", "..FwF..", ".F.F.F.", "...F..."],
  gold_icon: ["..OOO..", ".OywyO.", ".OYYYO.", "OOOOOOO", "OyywyYO", "OYYYYYO", ".OOOOO."],
};

const rowsToCanvas = (rows: string[], colorOf: (glyph: string) => string | null): HTMLCanvasElement => {
  const width = Math.max(...rows.map((row) => row.length));
  const canvas = mkCanvas(width, rows.length);
  const ctx = canvas.getContext("2d");
  if (ctx) {
    for (let y = 0; y < rows.length; y++) {
      for (let x = 0; x < rows[y].length; x++) {
        const glyph = rows[y][x];
        const color = glyph === "." ? null : colorOf(glyph);
        if (color) {
          ctx.fillStyle = color;
          ctx.fillRect(x, y, 1, 1);
        }
      }
    }
  }
  return canvas;
};

const ZZZ_GLYPH = ["WWW", ".W.", "WWW"];
const buildZzz = (): HTMLCanvasElement => {
  const grid = new Grid(8, 8);
  ZZZ_GLYPH.forEach((row, y) => {
    for (let x = 0; x < 3; x++) if (row[x] === "W") grid.set(4 + x, 1 + y, WHITE);
  });
  ZZZ_GLYPH.forEach((row, y) => {
    for (let x = 0; x < 3; x++) if (row[x] === "W") grid.set(1 + x, 4 + y, "#dfe6f2");
  });
  grid.outline();
  return grid.toCanvas();
};

const butterflyTinted = new Map<string, HTMLCanvasElement>();
/** Butterfly with wings tinted `color` (hex "#rrggbb"); frame 0 = open, 1 = closed. Cached (bounded). */
export const butterflySprite = (color: string, frame: number): HTMLCanvasElement => {
  const frameIdx = normFrame(frame, 2);
  const tint = /^#[0-9a-fA-F]{6}$/.test(color) ? color.toLowerCase() : "#ff9ad0";
  const key = tint + "|" + frameIdx;
  let sprite = butterflyTinted.get(key);
  if (sprite) return sprite;
  const shade = darken(tint, 0.3);
  sprite = rowsToCanvas(PROPS[frameIdx === 0 ? "butterfly0" : "butterfly1"], (glyph) =>
    glyph === "w" ? tint : glyph === "a" ? shade : glyph === "O" ? INK : null,
  );
  if (butterflyTinted.size >= 96) butterflyTinted.clear();
  butterflyTinted.set(key, sprite);
  return sprite;
};

export const prop = (name: string): HTMLCanvasElement => {
  const key = "p|" + name;
  let sprite = cache.get(key);
  if (sprite) return sprite;
  if (name === "zzz") {
    sprite = buildZzz();
  } else {
    const rows = Object.prototype.hasOwnProperty.call(PROPS, name) ? PROPS[name] : undefined;
    if (!rows || rows.length === 0) {
      sprite = mkCanvas(1, 1);
      cache.set(key, sprite);
      return sprite;
    }
    sprite = rowsToCanvas(rows, (glyph) => EXTRA[glyph] ?? SPRITE_COLORS[glyph] ?? null);
  }
  cache.set(key, sprite);
  return sprite;
};
