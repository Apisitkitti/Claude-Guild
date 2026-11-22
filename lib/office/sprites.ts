import {
  ADV_CLASSES,
  INTERN_LOOK,
  SPRITE_COLORS,
  fnv1a,
  type AdvClass,
  type BossKind,
  type Look,
  type MonsterKind,
} from "./palette";

const cache = new Map<string, HTMLCanvasElement>();

const mkCanvas = (width: number, height: number): HTMLCanvasElement => {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return canvas;
};

// ---------------------------------------------------------------- colour helpers
const mix = (colorA: string, colorB: string, amount: number): string => {
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
const lighten = (color: string, amount: number) => mix(color, "#ffffff", amount);
const darken = (color: string, amount: number) => mix(color, "#000000", amount);

const INK = "#14121f";
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
const luma = (color: string): number => {
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
const CAPE = "#8c2f3f",
  CAPE_SH = "#64202d";
const SHIELD = "#b8353f";
const GEM = "#6ff0ff",
  GEM_HI = "#d6fbff";
const PAPER = "#efe2c0",
  PAPER_SH = "#d4bf90",
  INKLINE = "#8a6f4a";
const FEATHER = "#f4f1ea";

// ---------------------------------------------------------------- pixel grid
class Grid {
  cells: (string | null)[];
  dx = 0;
  dy = 0;
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
        if (neighbour) out[y * width + x] = mix(neighbour, INK, 0.8);
      }
    }
    this.cells = out;
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
  hair: string;
  hHi: string;
  hSh: string;
  skin: string;
  skSh: string;
  blush: string;
  main: string;
  mHi: string;
  mSh: string;
  accent: string;
  pants: string;
  pSh: string;
  style: number;
}

const CLASS_PANTS: Record<AdvClass, string> = {
  warrior: "#4a4f63",
  mage: "#3d3a58",
  rogue: "#2f2f3f",
  cleric: "#cfc6b0",
  ranger: "#6b5a3a",
};

const mkPal = (look: Look, cls: AdvClass): Pal => {
  const hash = fnv1a(look.hair + "|" + look.shirt + "|" + look.skin);
  const shirt = sat(look.shirt, 0.2);
  const cleric = cls === "cleric";
  const main = cleric ? "#f6f1e4" : shirt;
  const pants = CLASS_PANTS[cls];
  return {
    hair: look.hair,
    hHi: lighten(sat(look.hair, 0.3), 0.38),
    hSh: darken(look.hair, 0.3),
    skin: look.skin,
    skSh: sat(darken(look.skin, 0.2), 0.25),
    blush: mix(look.skin, "#ff5f7c", 0.55),
    main,
    mHi: cleric ? "#ffffff" : lighten(main, 0.3),
    mSh: cleric ? "#cfc6b0" : darken(sat(look.shirt, 0.3), 0.32),
    accent: shirt,
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
const drawLegs = (grid: Grid, palette: Pal, wf: number, robe: boolean) => {
  grid.dx = 0;
  grid.dy = 0;
  const top = robe ? 20 : 19;
  const leg = (x0: number, lifted: boolean) => {
    const end = lifted ? top + 1 : top + 2;
    for (let y = top; y <= end; y++) {
      grid.set(x0, y, palette.pants);
      grid.set(x0 + 1, y, palette.pSh);
    }
    const sy = end + 1;
    grid.row(sy, x0, x0 + 2, BOOT);
    grid.set(x0, sy, BOOT_HI);
  };
  leg(5, wf === 0);
  leg(9, wf === 2);
};

const drawBody = (grid: Grid, palette: Pal, cls: AdvClass) => {
  grid.dx = 0;
  grid.dy = 0;
  const robe = cls === "mage" || cls === "cleric";
  // behind-the-body items
  if (cls === "rogue") {
    grid.rect(3, 11, 4, 18, CAPE);
    grid.rect(3, 12, 3, 19, CAPE_SH);
    grid.set(4, 19, CAPE_SH);
  }
  if (cls === "ranger") {
    grid.rect(3, 10, 4, 16, LEATHER);
    grid.set(3, 9, FEATHER);
    grid.set(4, 8, FEATHER);
    grid.set(4, 9, "#d95763");
    grid.set(3, 10, WOOD_HI);
    grid.set(3, 12, WOOD_SH);
    grid.set(4, 14, WOOD_SH);
  }
  // torso
  grid.rect(5, 11, 10, 16, palette.main);
  for (let y = 11; y <= 16; y++) grid.set(10, y, palette.mSh);
  grid.row(16, 5, 10, palette.mSh);
  grid.set(5, 12, palette.mHi);
  grid.set(5, 13, palette.mHi);
  grid.set(6, 12, palette.mHi);
  if (robe) {
    grid.rect(4, 17, 11, 19, palette.main);
    grid.rect(11, 17, 11, 19, palette.mSh);
    grid.row(19, 4, 11, cls === "mage" ? GOLD : GOLD_SH);
    grid.set(4, 18, palette.mHi);
    grid.row(17, 4, 11, cls === "mage" ? GOLD : GOLD_SH);
    grid.set(8, 17, GOLD_HI);
  } else {
    grid.row(17, 5, 10, BELT);
    grid.set(8, 17, GOLD);
    grid.row(18, 5, 10, palette.pants);
    grid.set(10, 18, palette.pSh);
  }
  switch (cls) {
    case "warrior":
      grid.row(12, 6, 9, STEEL_HI);
      grid.rect(6, 13, 9, 14, STEEL);
      grid.row(15, 6, 9, STEEL_SH);
      grid.set(7, 13, "#d95763");
      grid.set(8, 13, "#d95763");
      grid.set(4, 11, STEEL_HI);
      grid.set(11, 11, STEEL);
      grid.set(5, 11, STEEL);
      grid.set(10, 11, STEEL_SH);
      break;
    case "mage":
      grid.set(7, 13, GOLD);
      grid.set(8, 13, GOLD_HI);
      grid.set(6, 15, GOLD_SH);
      grid.set(9, 14, GOLD_SH);
      grid.row(11, 5, 10, palette.mHi);
      break;
    case "rogue":
      grid.set(7, 12, palette.mSh);
      grid.set(8, 13, palette.mSh);
      grid.set(7, 14, palette.mSh);
      grid.set(8, 15, palette.mSh);
      grid.rect(9, 17, 10, 18, LEATHER);
      grid.set(9, 17, WOOD_HI);
      break;
    case "cleric":
      grid.rect(7, 11, 8, 18, palette.accent);
      grid.set(8, 12, darken(palette.accent, 0.2));
      grid.set(8, 14, darken(palette.accent, 0.2));
      grid.set(8, 16, darken(palette.accent, 0.2));
      grid.rect(7, 13, 8, 14, GOLD);
      grid.set(7, 13, GOLD_HI);
      grid.set(8, 14, GOLD_SH);
      break;
    case "ranger":
      for (let i = 0; i <= 5; i++) grid.set(5 + i, 11 + i, LEATHER);
      grid.set(6, 11, WOOD_HI);
      break;
  }
};

/** A thin arm from the shoulder to a hand; sleeve pixels then a skin hand. */
const arm = (grid: Grid, palette: Pal, x0: number, y0: number, x1: number, y1: number) => {
  const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
  const sleeve = palette.main === "#f6f1e4" ? "#e6dfcb" : palette.mSh;
  for (let i = 0; i < steps; i++) {
    const x = Math.round(x0 + ((x1 - x0) * i) / steps);
    const y = Math.round(y0 + ((y1 - y0) * i) / steps);
    grid.set(x, y, i === 0 ? palette.main : sleeve);
  }
  grid.set(x1, y1, palette.skin);
};

const drawHead = (grid: Grid, palette: Pal, cls: AdvClass, expr: Expr, mouth: MouthT) => {
  const { hair, hHi, hSh, skin, skSh, blush } = palette;
  // back hair
  if (cls !== "rogue") {
    grid.rect(2, 5, 3, 9, hSh);
    grid.rect(3, 5, 3, 9, hair);
    if (palette.style === 1 && cls !== "warrior") {
      grid.rect(2, 10, 3, 11, hSh);
      grid.set(3, 10, hair);
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
      grid.row(3, 5, 10, STEEL);
      grid.row(4, 4, 11, STEEL);
      grid.row(5, 3, 11, STEEL_SH);
      grid.set(6, 3, STEEL_HI);
      grid.set(6, 4, STEEL_HI);
      grid.set(7, 4, STEEL_HI);
      grid.set(5, 4, STEEL_HI);
      grid.rect(3, 6, 4, 8, STEEL_SH);
      grid.set(3, 6, STEEL);
      grid.set(8, 5, GOLD);
      grid.row(2, 7, 9, "#d95763");
      grid.set(8, 1, "#d95763");
      grid.set(7, 2, "#f08a94");
      grid.set(10, 3, STEEL_SH);
      break;
    }
    case "mage": {
      grid.row(5, 3, 12, palette.main);
      grid.row(5, 10, 12, palette.mSh);
      grid.row(4, 5, 10, GOLD);
      grid.row(4, 5, 6, GOLD_HI);
      grid.row(3, 6, 9, palette.main);
      grid.set(9, 3, palette.mSh);
      grid.set(6, 3, palette.mHi);
      grid.row(2, 7, 8, palette.main);
      grid.set(8, 2, palette.mSh);
      grid.set(8, 1, palette.main);
      grid.set(9, 1, palette.mSh);
      grid.set(7, 3, GOLD_HI);
      grid.row(6, 5, 8, hair);
      grid.set(6, 6, hHi);
      break;
    }
    case "rogue": {
      grid.row(2, 6, 9, palette.main);
      grid.row(3, 4, 11, palette.main);
      grid.row(4, 3, 12, palette.main);
      grid.row(5, 4, 11, palette.mSh);
      grid.set(3, 5, palette.main);
      grid.set(12, 5, palette.main);
      grid.rect(2, 5, 3, 10, palette.main);
      grid.rect(3, 6, 4, 10, palette.main);
      grid.rect(2, 8, 3, 10, palette.mSh);
      grid.set(12, 6, palette.main);
      grid.set(12, 4, palette.main);
      grid.set(6, 2, palette.mHi);
      grid.set(5, 3, palette.mHi);
      grid.set(4, 4, palette.mHi);
      grid.row(5, 6, 9, hair);
      grid.set(7, 5, hHi);
      grid.rect(5, 6, 5, 9, skSh);
      grid.set(5, 10, palette.mSh);
      break;
    }
    case "cleric": {
      grid.row(3, 5, 10, hair);
      grid.row(4, 4, 11, hair);
      grid.row(3, 6, 7, hHi);
      grid.row(4, 9, 11, hSh);
      if (palette.style === 2) {
        grid.set(5, 2, hair);
        grid.set(8, 2, hair);
        grid.set(10, 2, hSh);
        grid.set(8, 3, hHi);
      }
      grid.row(5, 4, 11, GOLD);
      grid.set(4, 5, GOLD_SH);
      grid.set(11, 5, GOLD_SH);
      grid.set(8, 5, GEM);
      grid.set(9, 5, GEM_HI);
      break;
    }
    case "ranger": {
      const cap = palette.mSh;
      grid.row(3, 5, 10, cap);
      grid.row(4, 4, 11, cap);
      grid.set(6, 3, palette.main);
      grid.set(7, 3, palette.main);
      grid.set(5, 4, palette.main);
      grid.set(6, 4, palette.main);
      grid.set(7, 4, palette.main);
      grid.row(4, 9, 11, darken(cap, 0.25));
      grid.row(5, 9, 12, darken(cap, 0.3));
      grid.row(5, 4, 8, hair);
      grid.set(6, 5, hHi);
      grid.set(4, 2, FEATHER);
      grid.set(3, 2, FEATHER);
      grid.set(3, 1, "#d95763");
      grid.set(4, 3, FEATHER);
      break;
    }
  }
};

type Dir = "up" | "fwd";

const drawWeapon = (
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
        for (let y = hy - 5; y <= hy + 1; y++) grid.set(ax, y, WOOD);
        grid.rect(ax - 1, hy - 8, ax + 1, hy - 6, GOLD);
        grid.set(ax - 1, hy - 8, GOLD_HI);
        grid.set(ax, hy - 7, GOLD_HI);
        grid.row(hy - 6, ax - 1, ax + 1, GOLD_SH);
        grid.set(ax, hy - 9, GOLD_HI);
        break;
      }
      case "ranger": {
        const wood = [
          [0, -6],
          [1, -5],
          [1, -4],
          [1, -3],
          [1, -2],
          [1, -1],
          [1, 0],
          [1, 1],
          [1, 2],
          [0, 3],
        ];
        for (const [ox, oy] of wood) grid.set(ax + ox, hy + oy, ox === 0 ? WOOD_SH : WOOD_HI);
        for (let y = hy - 5; y <= hy + 2; y++) grid.set(ax, y, FEATHER);
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

const drawShield = (grid: Grid) => {
  grid.dx = 0;
  grid.dy = 0;
  grid.row(13, 3, 4, STEEL);
  grid.set(2, 14, STEEL);
  grid.row(14, 3, 4, SHIELD);
  grid.set(5, 14, STEEL_SH);
  grid.set(2, 15, STEEL);
  grid.set(3, 15, STEEL_HI);
  grid.set(4, 15, SHIELD);
  grid.set(5, 15, STEEL_SH);
  grid.set(2, 16, STEEL);
  grid.row(16, 3, 4, SHIELD);
  grid.set(5, 16, STEEL_SH);
  grid.row(17, 3, 4, STEEL_SH);
};

const buildChar = (look: Look, pose: Pose, frame: number): HTMLCanvasElement => {
  const cls: AdvClass = (ADV_CLASSES as string[]).includes(look.cls) ? look.cls : "warrior";
  const palette = mkPal(look, cls);
  const frameIdx = normFrame(frame, pose === "walk" ? 4 : 2);
  if (pose === "rest") return buildRest(palette, cls, frameIdx);
  const grid = new Grid(16, 24);
  const robe = cls === "mage" || cls === "cleric";

  drawLegs(grid, palette, pose === "walk" ? frameIdx : -1, robe);
  drawBody(grid, palette, cls);

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
        drawWeapon(grid, palette, cls, 12, 15, "up");
        if (cls === "warrior") drawShield(grid);
      };
      break;
    case "walk": {
      hdy = frameIdx % 2 === 1 ? -1 : 0;
      const ry = frameIdx === 0 ? 16 : frameIdx === 2 ? 14 : 15;
      const ly = frameIdx === 0 ? 14 : frameIdx === 2 ? 16 : 15;
      draw = () => {
        arm(grid, palette, 4, 12, 4, ly);
        arm(grid, palette, 11, 12, 12, ry);
        drawWeapon(grid, palette, cls, 12, ry, "up");
        if (cls === "warrior") drawShield(grid);
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
            drawWeapon(grid, palette, cls, 11, 13, "fwd", { pulled: true });
          } else {
            arm(grid, palette, 11, 12, 12, 10);
            drawWeapon(grid, palette, cls, 12, 10, "up");
          }
          if (cls === "warrior") drawShield(grid);
        };
      } else {
        mouth = "open";
        hdx = 1;
        draw = () => {
          arm(grid, palette, 4, 12, 4, 15);
          if (cls === "ranger") {
            arm(grid, palette, 11, 12, 11, 13);
            drawWeapon(grid, palette, cls, 11, 13, "fwd");
          } else {
            arm(grid, palette, 11, 12, 11, 14);
            drawWeapon(grid, palette, cls, 11, 14, "fwd", { glow: true });
          }
          if (cls === "warrior") drawShield(grid);
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
        drawWeapon(grid, palette, cls, 12, ry, "up", { glow: frameIdx === 1, len: 7 });
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
        if (cls === "warrior") drawShield(grid);
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
  grid.dx = 0;
  grid.dy = 0;
  draw();
  grid.dx = 0;
  grid.dy = 0;
  grid.outline();
  return grid.toCanvas();
};

/** Sitting cross-legged on the ground; frame 1 = eyes closed + slow breath. */
const buildRest = (palette: Pal, cls: AdvClass, frame: number): HTMLCanvasElement => {
  const grid = new Grid(16, 24);
  const robe = cls === "mage" || cls === "cleric";
  // standing torso drawn in a scratch grid, then dropped 3 rows (legs are replaced by a crossed sit)
  const scratch = new Grid(16, 24);
  drawBody(scratch, palette, cls);
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
  grid.dx = 0;
  grid.dy = 0;
  grid.outline();
  return grid.toCanvas();
};

export const charSprite = (look: Look, pose: Pose, frame: number): HTMLCanvasElement => {
  const frameCount = pose === "walk" ? 4 : 2;
  const key = `c|${look.cls}|${look.hair}|${look.shirt}|${look.skin}|${pose}|${normFrame(frame, frameCount)}`;
  let sprite = cache.get(key);
  if (!sprite) {
    sprite = buildChar(look, pose, frame);
    cache.set(key, sprite);
  }
  return sprite;
};

// ---------------------------------------------------------------- squire (12x18)
type InternPose = "idle" | "walk" | "attack" | "read" | "hand_up";

const buildIntern = (pose: InternPose, frame: number): HTMLCanvasElement => {
  const palette = mkPal(INTERN_LOOK, "warrior");
  const grid = new Grid(12, 18);
  const CAP = "#8b5e3c",
    CAP_HI = "#b9814f",
    CAP_SH = "#5c3d28";
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
  // body
  grid.rect(3, 8, 8, 11, main);
  for (let y = 8; y <= 11; y++) grid.set(8, y, mSh);
  grid.row(11, 3, 8, mSh);
  grid.set(3, 9, palette.mHi);
  grid.set(4, 9, palette.mHi);
  grid.row(11, 3, 8, BELT);
  grid.set(6, 11, GOLD);
  // head
  const hdy = pose === "idle" ? frame : pose === "walk" && frame === 1 ? -1 : 0;
  grid.dy = hdy;
  grid.rect(2, 4, 9, 7, palette.skin);
  grid.row(7, 3, 8, palette.skSh);
  grid.set(2, 5, palette.hair);
  grid.set(2, 6, palette.hSh);
  grid.set(2, 4, palette.hair);
  grid.row(1, 4, 7, CAP);
  grid.row(2, 3, 8, CAP);
  grid.row(3, 2, 8, CAP);
  grid.set(4, 1, CAP_HI);
  grid.set(5, 1, CAP_HI);
  grid.set(4, 2, CAP_HI);
  grid.row(3, 9, 10, CAP_SH);
  grid.set(8, 2, CAP_SH);
  grid.set(7, 3, CAP_SH);
  grid.row(3, 2, 6, CAP_SH);
  grid.row(3, 3, 6, CAP);
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
  // arms / items
  const shield = () => {
    grid.rect(1, 9, 2, 11, WOOD_HI);
    grid.set(1, 9, WOOD_SH);
    grid.set(2, 11, WOOD_SH);
    grid.set(1, 11, WOOD_SH);
    grid.set(2, 10, GOLD);
    grid.set(2, 9, WOOD);
  };
  const sword = (hx: number, hy: number, dir: "up" | "fwd") => {
    if (dir === "up") {
      grid.set(hx + 1, hy, WOOD);
      grid.row(hy - 1, hx, hx + 1, GOLD);
      for (let y = hy - 6; y <= hy - 2; y++) grid.set(hx + 1, y, y === hy - 6 ? WHITE : STEEL_HI);
    } else {
      grid.rect(hx + 1, hy - 1, hx + 1, hy + 1, GOLD);
      grid.set(hx + 2, hy, STEEL_HI);
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
    shield();
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
    shield();
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
    shield();
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

// ---------------------------------------------------------------- monsters (<=16x16, facing LEFT)
const buildMonster = (kind: MonsterKind, frame: number, hurt: boolean): HTMLCanvasElement => {
  const grid = new Grid(16, 16);
  const beat = frame;
  switch (kind) {
    case "slime": {
      const base = "#5fc46a",
        hi = "#a8f0ac",
        sh = "#3a9450",
        dk = "#2a6e3c";
      const rows: Array<[number, number, number]> =
        beat === 0
          ? [
              [5, 6, 9],
              [6, 4, 11],
              [7, 3, 12],
              [8, 2, 13],
              [9, 2, 13],
              [10, 2, 13],
              [11, 2, 13],
              [12, 3, 12],
            ]
          : [
              [7, 5, 10],
              [8, 3, 12],
              [9, 2, 13],
              [10, 1, 14],
              [11, 1, 14],
              [12, 2, 13],
            ];
      const top = rows[0][0],
        bot = rows[rows.length - 1][0];
      for (const [y, x0, x1] of rows) {
        grid.row(y, x0, x1, base);
        grid.set(x1, y, sh);
        if (y >= bot - 1) grid.row(y, x0, x1, sh);
      }
      grid.row(bot, rows[rows.length - 1][1], rows[rows.length - 1][2], dk);
      grid.set(rows[1][1] + 1, top + 1, hi);
      grid.set(rows[1][1] + 2, top + 1, hi);
      grid.set(rows[2][1] + 1, top + 2, hi);
      const ey = top + 3;
      for (const x of [5, 8]) {
        grid.set(x, ey, EYE);
        grid.set(x, ey + 1, EYE);
        grid.set(x, ey, WHITE);
      }
      grid.row(ey + 2, 6, 7, dk);
      break;
    }
    case "goblin": {
      const skin = "#6fb04f",
        sh = "#4a8a3a",
        hi = "#97d36f",
        cloth = "#8b5e3c",
        clothSh = "#5c3d28";
      // legs
      grid.rect(5, 13, 6, 14, sh);
      grid.rect(9, 13, 10, 14, sh);
      grid.row(14, 4, 6, "#4a3426");
      grid.row(14, 9, 11, "#4a3426");
      grid.dy = beat;
      // body
      grid.rect(5, 9, 10, 12, cloth);
      grid.rect(10, 9, 10, 12, clothSh);
      grid.row(12, 5, 10, clothSh);
      grid.set(7, 10, WOOD_HI);
      grid.set(8, 11, WOOD_HI);
      // right (back) arm
      grid.rect(11, 9, 11, 11, skin);
      grid.set(11, 12, sh);
      // head + ears
      grid.rect(5, 3, 10, 8, skin);
      grid.row(3, 5, 10, hi);
      grid.rect(10, 4, 10, 8, sh);
      grid.set(4, 5, skin);
      grid.set(3, 5, skin);
      grid.set(2, 4, skin);
      grid.set(3, 4, hi);
      grid.set(11, 5, sh);
      grid.set(12, 5, sh);
      grid.set(13, 4, sh);
      grid.set(6, 5, "#ffd84a");
      grid.set(6, 6, EYE);
      grid.set(8, 5, "#ffd84a");
      grid.set(8, 6, EYE);
      grid.row(4, 6, 7, sh);
      grid.row(4, 8, 9, sh);
      grid.set(5, 7, sh);
      grid.row(8, 6, 9, "#3a1f2a");
      grid.set(6, 8, WHITE);
      grid.set(9, 8, WHITE);
      // left (front) arm + club
      grid.set(4, 10, skin);
      grid.set(3, 11, skin);
      grid.rect(1, 5, 3, 8, WOOD_HI);
      grid.row(8, 1, 3, WOOD);
      grid.set(3, 5, WOOD_SH);
      grid.set(1, 5, WOOD);
      grid.set(0 + 1, 4, STEEL_SH);
      grid.set(3, 4, STEEL_SH);
      grid.rect(2, 9, 2, 11, WOOD);
      grid.set(2, 12, WOOD_SH);
      grid.dy = 0;
      break;
    }
    case "bat": {
      const base = "#8a5ac0",
        sh = "#5f3a90",
        hi = "#b58be0",
        wing = "#6b3fa0",
        bone = "#4a2878";
      const wings: Array<[number, number, number]> =
        beat === 0
          ? [
              [3, 1, 2],
              [4, 1, 4],
              [5, 2, 5],
              [6, 3, 5],
              [7, 4, 5],
            ]
          : [
              [7, 4, 5],
              [8, 2, 5],
              [9, 1, 5],
              [10, 1, 3],
              [11, 1, 2],
            ];
      for (const [y, x0, x1] of wings) {
        for (let x = x0; x <= x1; x++) {
          grid.set(x, y, x === x0 ? bone : wing);
          grid.set(15 - x, y, 15 - x === 15 - x0 ? bone : wing);
        }
      }
      grid.rect(6, 6, 9, 9, base);
      grid.row(10, 7, 8, base);
      grid.rect(9, 6, 9, 9, sh);
      grid.set(7, 10, sh);
      grid.set(8, 10, sh);
      grid.set(6, 5, base);
      grid.set(6, 4, sh);
      grid.set(9, 5, base);
      grid.set(9, 4, sh);
      grid.set(7, 6, hi);
      grid.set(6, 6, hi);
      grid.set(6, 7, "#ff5a5a");
      grid.set(8, 7, "#ff5a5a");
      grid.set(7, 9, WHITE);
      grid.set(8, 9, WHITE);
      break;
    }
    case "skeleton": {
      const bone = "#ece6d2",
        sh = "#b9b19a",
        dk = "#2a2438";
      // legs first (static), upper body bobs over them
      grid.rect(6, 12, 6, 14, sh);
      grid.rect(9, 12, 9, 14, sh);
      grid.row(14, 5, 6, bone);
      grid.row(14, 9, 10, bone);
      grid.dy = beat;
      grid.row(11, 6, 9, sh);
      grid.rect(5, 8, 10, 10, bone);
      grid.row(9, 5, 10, sh);
      grid.set(7, 8, dk);
      grid.set(8, 8, dk);
      grid.row(10, 5, 10, bone);
      grid.set(7, 10, sh);
      grid.set(8, 10, sh);
      grid.rect(7, 7, 8, 7, sh);
      // skull
      grid.row(2, 6, 9, bone);
      grid.rect(5, 3, 10, 6, bone);
      grid.row(7, 6, 9, bone);
      grid.row(2, 6, 7, WHITE);
      grid.rect(10, 3, 10, 6, sh);
      grid.rect(6, 4, 7, 5, dk);
      grid.rect(9, 4, 9, 5, dk);
      grid.set(6, 5, "#ff5a5a");
      grid.set(9, 5, "#ff5a5a");
      grid.set(8, 6, dk);
      grid.row(7, 6, 9, bone);
      grid.set(7, 7, dk);
      grid.set(9, 7, dk);
      // arms
      grid.rect(11, 8, 11, 10, bone);
      grid.set(11, 11, sh);
      grid.set(4, 8, bone);
      grid.set(4, 9, bone);
      grid.set(3, 10, bone);
      // sword
      for (let y = 2; y <= 8; y++) grid.set(2, y, y % 2 ? "#a9a39a" : "#8c867d");
      grid.set(2, 1, "#c9c4bb");
      grid.row(9, 1, 3, WOOD_SH);
      grid.set(3, 9, WOOD_SH);
      grid.set(2, 10, bone);
      grid.set(2, 11, WOOD);
      grid.dy = 0;
      break;
    }
    case "mushroom": {
      const cap = "#d9434f",
        hi = "#f2707a",
        sh = "#a82e3d",
        under = "#7d2230";
      const stem = "#f1e3c4",
        stemSh = "#cdb98e";
      // feet + stem (static)
      grid.rect(5, 8, 10, 12, stem);
      grid.rect(10, 8, 10, 12, stemSh);
      grid.row(13, 5, 6, stemSh);
      grid.row(13, 9, 10, stemSh);
      grid.row(12, 5, 10, stemSh);
      // face on stem
      for (const x of [6, 9]) {
        grid.set(x, 10, EYE);
        grid.set(x, 11, EYE);
      }
      grid.set(5, 11, "#f2a0a8");
      grid.set(7, 12, MOUTH);
      grid.set(8, 12, MOUTH);
      grid.set(6, 10, WHITE);
      grid.dy = beat;
      const rows: Array<[number, number, number]> = [
        [2, 6, 9],
        [3, 4, 11],
        [4, 3, 12],
        [5, 2, 13],
        [6, 2, 13],
      ];
      for (const [y, x0, x1] of rows) {
        grid.row(y, x0, x1, cap);
        grid.set(x1, y, sh);
      }
      grid.row(7, 2, 13, under);
      grid.row(7, 4, 11, sh);
      grid.set(5, 2 + 1, hi);
      grid.set(6, 3, hi);
      grid.set(4, 4, hi);
      // spots
      grid.rect(4, 4, 5, 5, WHITE);
      grid.rect(9, 3, 10, 4, WHITE);
      grid.set(12, 6, WHITE);
      grid.set(8, 6, WHITE);
      grid.set(7, 5, WHITE);
      grid.dy = 0;
      break;
    }
  }
  grid.outline();
  if (hurt) {
    grid.recolor((color) => (luma(color) < 55 ? color : lighten(mix(color, "#ff3b3b", 0.4), 0.55)));
  }
  return grid.toCanvas();
};

/** Monster sprite, facing LEFT (toward the adventurer). hurt=true draws a white/red flash variant. */
export const monsterSprite = (kind: MonsterKind, frame: number, hurt: boolean): HTMLCanvasElement => {
  const frameIdx = normFrame(frame, 2);
  const key = `m|${kind}|${frameIdx}|${hurt ? 1 : 0}`;
  let sprite = cache.get(key);
  if (!sprite) {
    sprite = buildMonster(kind, frameIdx, hurt);
    cache.set(key, sprite);
  }
  return sprite;
};

// ---------------------------------------------------------------- bosses (24x24, facing LEFT)
const ell = (grid: Grid, cx: number, cy: number, rx: number, ry: number, color: string) => {
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      const dx = (x - cx) / (rx + 0.35),
        dy = (y - cy) / (ry + 0.35);
      if (dx * dx + dy * dy <= 1) grid.set(x, y, color);
    }
  }
};
const tri = (grid: Grid, vertA: [number, number], vertB: [number, number], vertC: [number, number], color: string) => {
  const sgn = (v1: number[], v2: number[], v3: number[]) =>
    (v1[0] - v3[0]) * (v2[1] - v3[1]) - (v2[0] - v3[0]) * (v1[1] - v3[1]);
  for (let y = 0; y < grid.height; y++) {
    for (let x = 0; x < grid.width; x++) {
      const pt = [x + 0.5, y + 0.5];
      const d1 = sgn(pt, vertA, vertB),
        d2 = sgn(pt, vertB, vertC),
        d3 = sgn(pt, vertC, vertA);
      const neg = d1 < 0 || d2 < 0 || d3 < 0,
        pos = d1 > 0 || d2 > 0 || d3 > 0;
      if (!(neg && pos)) grid.set(x, y, color);
    }
  }
};
const line = (grid: Grid, x0: number, y0: number, x1: number, y1: number, color: string) => {
  const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
  for (let i = 0; i <= steps; i++)
    grid.set(Math.round(x0 + ((x1 - x0) * i) / steps), Math.round(y0 + ((y1 - y0) * i) / steps), color);
};

const buildBoss = (kind: BossKind, frame: number, hurt: boolean): HTMLCanvasElement => {
  const grid = new Grid(24, 24);
  const BONE = "#f0e8d0";
  if (kind === "ogre") {
    const SK = "#6a9a4a",
      HI = "#93c466",
      SHD = "#44693a",
      DK = "#2f4a2a",
      CL = "#7a4a2b",
      CL_SH = "#5c3622";
    // club (behind)
    grid.rect(18, 2 + frame, 22, 7 + frame, WOOD);
    grid.rect(18, 2 + frame, 18, 7 + frame, WOOD_HI);
    grid.rect(22, 2 + frame, 22, 7 + frame, WOOD_SH);
    grid.set(20, 3 + frame, BONE);
    grid.set(19, 6 + frame, BONE);
    grid.set(21, 5 + frame, BONE);
    grid.rect(19, 8 + frame, 21, 17 + frame, WOOD);
    grid.rect(19, 8 + frame, 19, 17 + frame, WOOD_HI);
    grid.rect(21, 8 + frame, 21, 17 + frame, WOOD_SH);
    // legs
    const le = 21 - frame,
      re = 20 + frame;
    grid.rect(6, 18, 10, le, SK);
    grid.rect(10, 18, 10, le, SHD);
    grid.row(le, 5, 10, DK);
    grid.rect(13, 18, 17, re, SK);
    grid.rect(17, 18, 17, re, SHD);
    grid.row(re, 12, 17, DK);
    // torso
    ell(grid, 12, 13 + frame, 7, 6, SK);
    for (let y = 7; y <= 20; y++) for (let x = 16; x <= 20; x++) if (grid.cells[y * 24 + x] === SK) grid.set(x, y, SHD);
    ell(grid, 10, 14 + frame, 3, 3, HI);
    grid.rect(7, 17 + frame, 16, 19, CL);
    grid.row(19, 7, 16, CL_SH);
    grid.set(10, 17 + frame, CL_SH);
    grid.set(13, 18 + frame, CL_SH);
    // head
    ell(grid, 7, 6 + frame, 4, 3, SK);
    grid.set(5, 3 + frame, HI);
    grid.set(6, 3 + frame, HI);
    grid.set(11, 4 + frame, SK);
    grid.set(12, 4 + frame, SK);
    grid.set(12, 5 + frame, SHD);
    grid.set(3, 6 + frame, SHD);
    grid.row(4 + frame, 4, 6, DK);
    grid.set(7, 5 + frame, DK);
    grid.set(5, 5 + frame, "#ff5a3a");
    grid.set(8, 5 + frame, "#ff5a3a");
    grid.row(8 + frame, 4, 9, DK);
    grid.set(4, 7 + frame, BONE);
    grid.set(4, 8 + frame, BONE);
    grid.set(7, 7 + frame, BONE);
    grid.set(7, 8 + frame, BONE);
    // arms
    grid.rect(3, 11 + frame, 5, 15 + frame, SK);
    grid.rect(3, 11 + frame, 3, 15 + frame, HI);
    grid.rect(3, 15 + frame, 5, 17 + frame, HI);
    grid.row(17 + frame, 3, 5, SHD);
    grid.rect(16, 9 + frame, 18, 12 + frame, SK);
    grid.rect(18, 12 + frame, 21, 14 + frame, SK);
    grid.row(14 + frame, 18, 21, SHD);
  } else {
    const RED = "#c8402f",
      HI = "#ee6a4a",
      SHD = "#8a2a24",
      BELLY = "#f2c46a",
      BSH = "#d9a04a";
    const WING = "#e0773a",
      WHI = "#f0a050",
      EYEC = "#ffe14a";
    // wing (behind)
    if (frame === 0) {
      tri(grid, [12, 11], [17, 1], [22, 7], WING);
      tri(grid, [12, 11], [22, 7], [20, 14], WING);
      line(grid, 12, 11, 17, 1, SHD);
      line(grid, 12, 11, 22, 7, SHD);
      line(grid, 12, 11, 20, 14, SHD);
      grid.set(15, 5, WHI);
      grid.set(16, 4, WHI);
    } else {
      tri(grid, [12, 11], [15, 5], [22, 11], WING);
      tri(grid, [12, 11], [22, 11], [20, 17], WING);
      line(grid, 12, 11, 15, 5, SHD);
      line(grid, 12, 11, 22, 11, SHD);
      line(grid, 12, 11, 20, 17, SHD);
      grid.set(15, 8, WHI);
      grid.set(17, 9, WHI);
    }
    // tail
    grid.rect(15, 15, 19, 17, RED);
    grid.row(17, 15, 19, SHD);
    grid.rect(19, 17 - frame, 21, 18 - frame, RED);
    grid.set(22, 17 - frame, SHD);
    grid.set(22, 18 - frame, HI);
    // legs
    grid.rect(9, 18, 10, 19, RED);
    grid.rect(8, 20, 10, 20, SHD);
    grid.rect(14, 18, 15, 19, RED);
    grid.rect(13, 20, 15, 20, SHD);
    // body
    ell(grid, 12, 14, 5, 4, RED);
    for (let y = 16; y <= 18; y++)
      for (let x = 14; x <= 17; x++) if (grid.cells[y * 24 + x] === RED) grid.set(x, y, SHD);
    ell(grid, 10, 15, 3, 3, BELLY);
    grid.row(17, 8, 12, BSH);
    grid.set(11, 11, HI);
    grid.set(12, 11, HI);
    grid.set(13, 12, HI);
    // neck + head
    grid.rect(8, 9, 11, 13, RED);
    grid.set(8, 10, HI);
    grid.rect(8, 11, 9, 13, BELLY);
    const hy = frame;
    ell(grid, 6, 8 + hy, 3, 3, RED);
    grid.rect(2, 8 + hy, 4, 10 + hy, RED);
    grid.row(10 + hy, 2, 5, SHD);
    grid.set(3, 10 + hy, BONE);
    grid.set(5, 10 + hy, BONE);
    grid.set(2, 8 + hy, SHD);
    grid.set(5, 7 + hy, EYEC);
    grid.set(4, 6 + hy, SHD);
    grid.set(5, 6 + hy, SHD);
    grid.set(5, 5 + hy, HI);
    grid.set(7, 5 + hy, BONE);
    grid.set(8, 4 + hy, BONE);
    grid.set(9, 3 + hy, BONE);
    grid.set(9, 5 + hy, BONE);
    grid.set(10, 4 + hy, BONE);
    grid.set(11, 3 + hy, BONE);
  }
  grid.outline();
  if (hurt) grid.recolor((color) => (luma(color) < 55 ? color : lighten(mix(color, "#ff3b3b", 0.4), 0.55)));
  return grid.toCanvas();
};

/** Boss sprite (24x24), facing LEFT. hurt=true draws a white/red flash variant. */
export const bossSprite = (kind: BossKind, frame: number, hurt: boolean): HTMLCanvasElement => {
  const k: BossKind = kind === "dragon" ? "dragon" : "ogre";
  const frameIdx = normFrame(frame, 2);
  const key = `b|${k}|${frameIdx}|${hurt ? 1 : 0}`;
  let sprite = cache.get(key);
  if (!sprite) {
    sprite = buildBoss(k, frameIdx, hurt);
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
