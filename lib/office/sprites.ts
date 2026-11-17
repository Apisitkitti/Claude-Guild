import {
  ADV_CLASSES, INTERN_LOOK, SPRITE_COLORS, fnv1a,
  type AdvClass, type BossKind, type Look, type MonsterKind,
} from "./palette";

const cache = new Map<string, HTMLCanvasElement>();

function mkCanvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
}

// ---------------------------------------------------------------- colour helpers
function mix(a: string, b: string, t: number): string {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  const ch = (s: number) => {
    const x = (pa >>> s) & 255, y = (pb >>> s) & 255;
    return Math.round(x + (y - x) * t).toString(16).padStart(2, "0");
  };
  return "#" + ch(16) + ch(8) + ch(0);
}
const lighten = (c: string, t: number) => mix(c, "#ffffff", t);
const darken = (c: string, t: number) => mix(c, "#000000", t);

const INK = "#14121f";
function sat(c: string, t: number): string {
  const n = parseInt(c.slice(1), 16);
  const r = (n >>> 16) & 255, g = (n >>> 8) & 255, b = n & 255;
  const l = 0.3 * r + 0.59 * g + 0.11 * b;
  const f = (v: number) => Math.max(0, Math.min(255, Math.round(l + (v - l) * (1 + t)))).toString(16).padStart(2, "0");
  return "#" + f(r) + f(g) + f(b);
}
function luma(c: string): number {
  const n = parseInt(c.slice(1), 16);
  return 0.3 * ((n >>> 16) & 255) + 0.59 * ((n >>> 8) & 255) + 0.11 * (n & 255);
}

const EYE = "#2a1f3a";
const WHITE = "#ffffff";
const MOUTH = "#8a3446";
const TONGUE = "#e8707a";
const STEEL = "#c9d3e0", STEEL_HI = "#eef3fa", STEEL_SH = "#8793a6";
const GOLD = "#e8c04e", GOLD_HI = "#fff0a8", GOLD_SH = "#b88a2a";
const WOOD = "#8b5e3c", WOOD_HI = "#b9814f", WOOD_SH = "#5c3d28";
const LEATHER = "#6b4a36", BELT = "#4a3426", BOOT = "#4a3426", BOOT_HI = "#6e4f3a";
const CAPE = "#8c2f3f", CAPE_SH = "#64202d";
const SHIELD = "#b8353f";
const GEM = "#6ff0ff", GEM_HI = "#d6fbff";
const PAPER = "#efe2c0", PAPER_SH = "#d4bf90", INKLINE = "#8a6f4a";
const FEATHER = "#f4f1ea";

// ---------------------------------------------------------------- pixel grid
class Grid {
  c: (string | null)[];
  dx = 0;
  dy = 0;
  constructor(readonly w: number, readonly h: number) {
    this.c = new Array(w * h).fill(null);
  }
  set(x: number, y: number, col: string) {
    x += this.dx;
    y += this.dy;
    if (x >= 0 && x < this.w && y >= 0 && y < this.h) this.c[y * this.w + x] = col;
  }
  row(y: number, x0: number, x1: number, col: string) {
    for (let x = x0; x <= x1; x++) this.set(x, y, col);
  }
  rect(x0: number, y0: number, x1: number, y1: number, col: string) {
    for (let y = y0; y <= y1; y++) this.row(y, x0, x1, col);
  }
  /** Closed dark outline: every empty cell touching a filled one becomes a dark shade of that fill. */
  outline() {
    const { w, h, c } = this;
    const out = c.slice();
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (c[y * w + x]) continue;
        let n: string | null = null;
        for (let dy = -1; dy <= 1 && !n; dy++) {
          for (let dx = -1; dx <= 1 && !n; dx++) {
            const nx = x + dx, ny = y + dy;
            if ((dx || dy) && nx >= 0 && nx < w && ny >= 0 && ny < h) n = c[ny * w + nx];
          }
        }
        if (n) out[y * w + x] = mix(n, INK, 0.8);
      }
    }
    this.c = out;
  }
  recolor(fn: (c: string) => string) {
    this.c = this.c.map((v) => (v ? fn(v) : v));
  }
  toCanvas(): HTMLCanvasElement {
    const cv = mkCanvas(this.w, this.h);
    const ctx = cv.getContext("2d");
    if (!ctx) return cv;
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        const col = this.c[y * this.w + x];
        if (col) { ctx.fillStyle = col; ctx.fillRect(x, y, 1, 1); }
      }
    }
    return cv;
  }
}

function normFrame(frame: number, n: number): number {
  const f = Number.isFinite(frame) ? Math.floor(frame) : 0;
  return ((f % n) + n) % n;
}

// ---------------------------------------------------------------- palette from Look
interface Pal {
  hair: string; hHi: string; hSh: string;
  skin: string; skSh: string; blush: string;
  main: string; mHi: string; mSh: string;
  accent: string;
  pants: string; pSh: string;
  style: number;
}

const CLASS_PANTS: Record<AdvClass, string> = {
  warrior: "#4a4f63", mage: "#3d3a58", rogue: "#2f2f3f", cleric: "#cfc6b0", ranger: "#6b5a3a",
};

function mkPal(look: Look, cls: AdvClass): Pal {
  const h = fnv1a(look.hair + "|" + look.shirt + "|" + look.skin);
  const shirt = sat(look.shirt, 0.2);
  const cleric = cls === "cleric";
  const main = cleric ? "#f6f1e4" : shirt;
  const pants = CLASS_PANTS[cls];
  return {
    hair: look.hair, hHi: lighten(sat(look.hair, 0.3), 0.38), hSh: darken(look.hair, 0.3),
    skin: look.skin, skSh: sat(darken(look.skin, 0.2), 0.25), blush: mix(look.skin, "#ff5f7c", 0.55),
    main, mHi: cleric ? "#ffffff" : lighten(main, 0.3), mSh: cleric ? "#cfc6b0" : darken(sat(look.shirt, 0.3), 0.32),
    accent: shirt,
    pants, pSh: darken(pants, 0.28),
    style: h % 3,
  };
}

export type Pose =
  | "walk" | "idle" | "attack" | "cast" | "read" | "write" | "hand_up" | "hurt" | "drink" | "cheer" | "rest";

type Expr = "normal" | "blink" | "down" | "happy" | "wide" | "wince";
type MouthT = "smile" | "open" | "flat";

// ---------------------------------------------------------------- character (16x24)
function drawLegs(g: Grid, p: Pal, wf: number, robe: boolean) {
  g.dx = 0; g.dy = 0;
  const top = robe ? 20 : 19;
  const leg = (x0: number, lifted: boolean) => {
    const end = lifted ? top + 1 : top + 2;
    for (let y = top; y <= end; y++) {
      g.set(x0, y, p.pants); g.set(x0 + 1, y, p.pSh);
    }
    const sy = end + 1;
    g.row(sy, x0, x0 + 2, BOOT);
    g.set(x0, sy, BOOT_HI);
  };
  leg(5, wf === 0);
  leg(9, wf === 2);
}

function drawBody(g: Grid, p: Pal, cls: AdvClass) {
  g.dx = 0; g.dy = 0;
  const robe = cls === "mage" || cls === "cleric";
  // behind-the-body items
  if (cls === "rogue") {
    g.rect(3, 11, 4, 18, CAPE);
    g.rect(3, 12, 3, 19, CAPE_SH);
    g.set(4, 19, CAPE_SH);
  }
  if (cls === "ranger") {
    g.rect(3, 10, 4, 16, LEATHER);
    g.set(3, 9, FEATHER); g.set(4, 8, FEATHER); g.set(4, 9, "#d95763");
    g.set(3, 10, WOOD_HI); g.set(3, 12, WOOD_SH); g.set(4, 14, WOOD_SH);
  }
  // torso
  g.rect(5, 11, 10, 16, p.main);
  for (let y = 11; y <= 16; y++) g.set(10, y, p.mSh);
  g.row(16, 5, 10, p.mSh);
  g.set(5, 12, p.mHi); g.set(5, 13, p.mHi); g.set(6, 12, p.mHi);
  if (robe) {
    g.rect(4, 17, 11, 19, p.main);
    g.rect(11, 17, 11, 19, p.mSh);
    g.row(19, 4, 11, cls === "mage" ? GOLD : GOLD_SH);
    g.set(4, 18, p.mHi);
    g.row(17, 4, 11, cls === "mage" ? GOLD : GOLD_SH);
    g.set(8, 17, GOLD_HI);
  } else {
    g.row(17, 5, 10, BELT);
    g.set(8, 17, GOLD);
    g.row(18, 5, 10, p.pants);
    g.set(10, 18, p.pSh);
  }
  switch (cls) {
    case "warrior":
      g.row(12, 6, 9, STEEL_HI);
      g.rect(6, 13, 9, 14, STEEL);
      g.row(15, 6, 9, STEEL_SH);
      g.set(7, 13, "#d95763"); g.set(8, 13, "#d95763");
      g.set(4, 11, STEEL_HI); g.set(11, 11, STEEL); g.set(5, 11, STEEL);
      g.set(10, 11, STEEL_SH);
      break;
    case "mage":
      g.set(7, 13, GOLD); g.set(8, 13, GOLD_HI);
      g.set(6, 15, GOLD_SH); g.set(9, 14, GOLD_SH);
      g.row(11, 5, 10, p.mHi);
      break;
    case "rogue":
      g.set(7, 12, p.mSh); g.set(8, 13, p.mSh); g.set(7, 14, p.mSh); g.set(8, 15, p.mSh);
      g.rect(9, 17, 10, 18, LEATHER); g.set(9, 17, WOOD_HI);
      break;
    case "cleric":
      g.rect(7, 11, 8, 18, p.accent);
      g.set(8, 12, darken(p.accent, 0.2)); g.set(8, 14, darken(p.accent, 0.2)); g.set(8, 16, darken(p.accent, 0.2));
      g.rect(7, 13, 8, 14, GOLD);
      g.set(7, 13, GOLD_HI); g.set(8, 14, GOLD_SH);
      break;
    case "ranger":
      for (let i = 0; i <= 5; i++) g.set(5 + i, 11 + i, LEATHER);
      g.set(6, 11, WOOD_HI);
      break;
  }
}

/** A thin arm from the shoulder to a hand; sleeve pixels then a skin hand. */
function arm(g: Grid, p: Pal, x0: number, y0: number, x1: number, y1: number) {
  const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
  const sleeve = p.main === "#f6f1e4" ? "#e6dfcb" : p.mSh;
  for (let i = 0; i < steps; i++) {
    const x = Math.round(x0 + ((x1 - x0) * i) / steps);
    const y = Math.round(y0 + ((y1 - y0) * i) / steps);
    g.set(x, y, i === 0 ? p.main : sleeve);
  }
  g.set(x1, y1, p.skin);
}

function drawHead(g: Grid, p: Pal, cls: AdvClass, expr: Expr, mouth: MouthT) {
  const { hair, hHi, hSh, skin, skSh, blush } = p;
  // back hair
  if (cls !== "rogue") {
    g.rect(2, 5, 3, 9, hSh);
    g.rect(3, 5, 3, 9, hair);
    if (p.style === 1 && cls !== "warrior") { g.rect(2, 10, 3, 11, hSh); g.set(3, 10, hair); }
  }
  // face
  g.rect(4, 5, 11, 9, skin);
  g.row(10, 5, 10, skSh);
  for (let y = 6; y <= 9; y++) g.set(4, y, skSh);
  g.set(5, 10, skSh);
  // eyes
  const eye2 = (x: number, y: number) => { g.set(x, y, EYE); g.set(x, y + 1, EYE); };
  switch (expr) {
    case "normal": eye2(7, 7); eye2(10, 7); g.set(7, 7, "#4a3a63"); g.set(10, 7, "#4a3a63"); break;
    case "blink": g.row(8, 6, 7, EYE); g.row(8, 9, 10, EYE); break;
    case "down": g.set(7, 7, skSh); g.set(10, 7, skSh); g.set(7, 8, EYE); g.set(10, 8, EYE); break;
    case "happy":
      g.set(6, 8, EYE); g.set(7, 7, EYE); g.set(8, 8, EYE);
      g.set(9, 8, EYE); g.set(10, 7, EYE); g.set(11, 8, EYE);
      break;
    case "wide":
      for (const x of [7, 10]) { g.set(x, 6, EYE); g.set(x, 7, WHITE); g.set(x, 8, EYE); }
      break;
    case "wince":
      g.set(6, 7, EYE); g.set(7, 8, EYE); g.set(11, 7, EYE); g.set(10, 8, EYE);
      break;
  }
  g.set(5, 9, blush); g.set(11, 9, blush);
  // mouth
  if (mouth === "open") {
    g.set(8, 9, MOUTH); g.set(9, 9, MOUTH); g.set(8, 10, TONGUE); g.set(9, 10, MOUTH);
  } else if (mouth === "smile") {
    g.set(8, 9, MOUTH); g.set(9, 9, MOUTH);
  } else {
    g.set(9, 9, MOUTH);
  }
  // hair (no headwear) or headwear
  switch (cls) {
    case "warrior": {
      g.row(3, 5, 10, STEEL); g.row(4, 4, 11, STEEL); g.row(5, 3, 11, STEEL_SH);
      g.set(6, 3, STEEL_HI); g.set(6, 4, STEEL_HI); g.set(7, 4, STEEL_HI); g.set(5, 4, STEEL_HI);
      g.rect(3, 6, 4, 8, STEEL_SH); g.set(3, 6, STEEL);
      g.set(8, 5, GOLD);
      g.row(2, 7, 9, "#d95763"); g.set(8, 1, "#d95763"); g.set(7, 2, "#f08a94");
      g.set(10, 3, STEEL_SH);
      break;
    }
    case "mage": {
      g.row(5, 3, 12, p.main); g.row(5, 10, 12, p.mSh);
      g.row(4, 5, 10, GOLD); g.row(4, 5, 6, GOLD_HI);
      g.row(3, 6, 9, p.main); g.set(9, 3, p.mSh); g.set(6, 3, p.mHi);
      g.row(2, 7, 8, p.main); g.set(8, 2, p.mSh);
      g.set(8, 1, p.main); g.set(9, 1, p.mSh);
      g.set(7, 3, GOLD_HI);
      g.row(6, 5, 8, hair); g.set(6, 6, hHi);
      break;
    }
    case "rogue": {
      g.row(2, 6, 9, p.main); g.row(3, 4, 11, p.main); g.row(4, 3, 12, p.main);
      g.row(5, 4, 11, p.mSh); g.set(3, 5, p.main); g.set(12, 5, p.main);
      g.rect(2, 5, 3, 10, p.main); g.rect(3, 6, 4, 10, p.main);
      g.rect(2, 8, 3, 10, p.mSh);
      g.set(12, 6, p.main); g.set(12, 4, p.main);
      g.set(6, 2, p.mHi); g.set(5, 3, p.mHi); g.set(4, 4, p.mHi);
      g.row(5, 6, 9, hair); g.set(7, 5, hHi);
      g.rect(5, 6, 5, 9, skSh); g.set(5, 10, p.mSh);
      break;
    }
    case "cleric": {
      g.row(3, 5, 10, hair); g.row(4, 4, 11, hair);
      g.row(3, 6, 7, hHi); g.row(4, 9, 11, hSh);
      if (p.style === 2) { g.set(5, 2, hair); g.set(8, 2, hair); g.set(10, 2, hSh); g.set(8, 3, hHi); }
      g.row(5, 4, 11, GOLD); g.set(4, 5, GOLD_SH); g.set(11, 5, GOLD_SH);
      g.set(8, 5, GEM); g.set(9, 5, GEM_HI);
      break;
    }
    case "ranger": {
      const cap = p.mSh;
      g.row(3, 5, 10, cap); g.row(4, 4, 11, cap);
      g.set(6, 3, p.main); g.set(7, 3, p.main); g.set(5, 4, p.main); g.set(6, 4, p.main); g.set(7, 4, p.main);
      g.row(4, 9, 11, darken(cap, 0.25));
      g.row(5, 9, 12, darken(cap, 0.3));
      g.row(5, 4, 8, hair); g.set(6, 5, hHi);
      g.set(4, 2, FEATHER); g.set(3, 2, FEATHER); g.set(3, 1, "#d95763"); g.set(4, 3, FEATHER);
      break;
    }
  }
}

type Dir = "up" | "fwd";

function drawWeapon(
  g: Grid, p: Pal, cls: AdvClass, hx: number, hy: number, dir: Dir,
  opt: { pulled?: boolean; glow?: boolean; len?: number } = {},
) {
  const ax = hx + 1;
  if (dir === "up") {
    switch (cls) {
      case "warrior": {
        g.row(hy - 1, hx, hx + 2, GOLD);
        for (let y = hy - 7; y <= hy - 2; y++) { g.set(ax, y, STEEL_HI); g.set(ax + 1, y, STEEL_SH); }
        g.set(ax, hy - 8, WHITE);
        g.set(ax, hy, WOOD); g.set(ax, hy + 1, GOLD_SH);
        break;
      }
      case "mage": {
        const len = opt.len ?? 8;
        for (let y = hy - len; y <= hy + 6; y++) g.set(ax, y, y % 3 === 0 ? WOOD_HI : WOOD);
        g.rect(ax, hy - len - 2, ax + 1, hy - len - 1, opt.glow ? GEM_HI : GEM);
        g.set(ax, hy - len - 2, WHITE);
        g.set(ax - 1, hy - len - 1, WOOD_HI); g.set(ax + 2, hy - len - 1, WOOD_HI);
        break;
      }
      case "rogue": {
        g.row(hy - 1, hx, hx + 2, WOOD_SH);
        for (let y = hy - 4; y <= hy - 2; y++) { g.set(ax, y, STEEL_HI); if (y > hy - 4) g.set(ax + 1, y, STEEL_SH); }
        g.set(ax, hy - 5, WHITE);
        g.set(ax, hy, BELT);
        break;
      }
      case "cleric": {
        for (let y = hy - 5; y <= hy + 1; y++) g.set(ax, y, WOOD);
        g.rect(ax - 1, hy - 8, ax + 1, hy - 6, GOLD);
        g.set(ax - 1, hy - 8, GOLD_HI); g.set(ax, hy - 7, GOLD_HI);
        g.row(hy - 6, ax - 1, ax + 1, GOLD_SH);
        g.set(ax, hy - 9, GOLD_HI);
        break;
      }
      case "ranger": {
        const wood = [[0, -6], [1, -5], [1, -4], [1, -3], [1, -2], [1, -1], [1, 0], [1, 1], [1, 2], [0, 3]];
        for (const [ox, oy] of wood) g.set(ax + ox, hy + oy, ox === 0 ? WOOD_SH : WOOD_HI);
        for (let y = hy - 5; y <= hy + 2; y++) g.set(ax, y, FEATHER);
        break;
      }
    }
    return;
  }
  // forward strike (hand at hx,hy)
  switch (cls) {
    case "warrior":
      g.rect(hx + 1, hy - 1, hx + 1, hy + 2, GOLD);
      g.row(hy, hx + 2, hx + 3, STEEL_HI); g.row(hy + 1, hx + 2, hx + 3, STEEL_SH);
      g.set(hx + 3, hy, WHITE);
      break;
    case "mage":
      g.set(hx + 1, hy, WOOD_HI); g.set(hx + 1, hy + 1, WOOD);
      g.rect(hx + 2, hy - 1, hx + 3, hy, opt.glow ? GEM_HI : GEM);
      g.set(hx + 2, hy - 1, WHITE);
      break;
    case "rogue":
      g.rect(hx + 1, hy - 1, hx + 1, hy + 1, WOOD_SH);
      g.row(hy, hx + 2, hx + 3, STEEL_HI); g.set(hx + 2, hy + 1, STEEL_SH);
      break;
    case "cleric":
      g.set(hx + 1, hy, WOOD);
      g.rect(hx + 2, hy - 1, hx + 3, hy + 1, GOLD);
      g.set(hx + 2, hy - 1, GOLD_HI); g.set(hx + 3, hy + 1, GOLD_SH);
      break;
    case "ranger": {
      const bx = hx + 3;
      for (let y = hy - 3; y <= hy + 3; y++) g.set(bx, y, WOOD_HI);
      g.set(bx - 1, hy - 3, WOOD_SH); g.set(bx - 1, hy + 3, WOOD_SH);
      if (opt.pulled) {
        g.set(bx - 1, hy - 2, FEATHER); g.set(bx - 2, hy - 1, FEATHER);
        g.set(bx - 2, hy + 1, FEATHER); g.set(bx - 1, hy + 2, FEATHER);
        g.set(bx - 2, hy, FEATHER);
        g.set(bx - 1, hy, WOOD); g.set(bx, hy, STEEL_HI);
      } else {
        for (let y = hy - 2; y <= hy + 2; y++) g.set(bx - 1, y, FEATHER);
      }
      break;
    }
  }
}

function drawShield(g: Grid) {
  g.dx = 0; g.dy = 0;
  g.row(13, 3, 4, STEEL);
  g.set(2, 14, STEEL); g.row(14, 3, 4, SHIELD); g.set(5, 14, STEEL_SH);
  g.set(2, 15, STEEL); g.set(3, 15, STEEL_HI); g.set(4, 15, SHIELD); g.set(5, 15, STEEL_SH);
  g.set(2, 16, STEEL); g.row(16, 3, 4, SHIELD); g.set(5, 16, STEEL_SH);
  g.row(17, 3, 4, STEEL_SH);
}

function buildChar(look: Look, pose: Pose, frame: number): HTMLCanvasElement {
  const cls: AdvClass = (ADV_CLASSES as string[]).includes(look.cls) ? look.cls : "warrior";
  const p = mkPal(look, cls);
  const f = normFrame(frame, pose === "walk" ? 4 : 2);
  if (pose === "rest") return buildRest(p, cls, f);
  const g = new Grid(16, 24);
  const robe = cls === "mage" || cls === "cleric";

  drawLegs(g, p, pose === "walk" ? f : -1, robe);
  drawBody(g, p, cls);

  let expr: Expr = "normal", mouth: MouthT = "smile", hdx = 0, hdy = 0;
  let draw: () => void = () => {};

  switch (pose) {
    case "idle":
      hdy = f; if (f === 1) expr = "blink";
      draw = () => {
        arm(g, p, 4, 12, 4, 15); arm(g, p, 11, 12, 12, 15);
        drawWeapon(g, p, cls, 12, 15, "up");
        if (cls === "warrior") drawShield(g);
      };
      break;
    case "walk": {
      hdy = f % 2 === 1 ? -1 : 0;
      const ry = f === 0 ? 16 : f === 2 ? 14 : 15;
      const ly = f === 0 ? 14 : f === 2 ? 16 : 15;
      draw = () => {
        arm(g, p, 4, 12, 4, ly); arm(g, p, 11, 12, 12, ry);
        drawWeapon(g, p, cls, 12, ry, "up");
        if (cls === "warrior") drawShield(g);
      };
      break;
    }
    case "attack":
      if (f === 0) {
        mouth = "flat";
        draw = () => {
          arm(g, p, 4, 12, 4, 15);
          if (cls === "ranger") { arm(g, p, 11, 12, 11, 13); drawWeapon(g, p, cls, 11, 13, "fwd", { pulled: true }); }
          else { arm(g, p, 11, 12, 12, 10); drawWeapon(g, p, cls, 12, 10, "up"); }
          if (cls === "warrior") drawShield(g);
        };
      } else {
        mouth = "open"; hdx = 1;
        draw = () => {
          arm(g, p, 4, 12, 4, 15);
          if (cls === "ranger") { arm(g, p, 11, 12, 11, 13); drawWeapon(g, p, cls, 11, 13, "fwd"); }
          else { arm(g, p, 11, 12, 11, 14); drawWeapon(g, p, cls, 11, 14, "fwd", { glow: true }); }
          if (cls === "warrior") drawShield(g);
        };
      }
      break;
    case "cast": {
      mouth = "open"; expr = "wide";
      const ry = f === 0 ? 11 : 10;
      draw = () => {
        arm(g, p, 4, 12, 3, f === 0 ? 10 : 9);
        arm(g, p, 11, 12, 12, ry);
        drawWeapon(g, p, cls, 12, ry, "up", { glow: f === 1, len: 7 });
        if (f === 1) { g.set(1, 8, GEM); g.set(2, 7, GEM_HI); g.set(1, 11, GEM_HI); }
      };
      break;
    }
    case "read":
      expr = "down"; mouth = "flat";
      draw = () => {
        g.row(13, 5, 11, PAPER_SH); g.row(17, 5, 11, PAPER_SH);
        g.rect(6, 14, 10, 16, PAPER);
        g.row(14, 6, 9 - f, INKLINE); g.row(15, 6, 8 + f, INKLINE); g.row(16, 6, 10, f ? "#c9b88a" : INKLINE);
        g.set(5, 13, GOLD_SH); g.set(11, 17, GOLD_SH);
        arm(g, p, 4, 12, 5, 15); arm(g, p, 11, 12, 11, 15);
        g.set(5, 15, p.skin); g.set(11, 15, p.skin);
      };
      break;
    case "write":
      expr = "down"; mouth = "flat";
      draw = () => {
        g.rect(6, 13, 10, 17, "#7a4a2b");
        g.rect(7, 14, 9, 16, PAPER);
        g.row(14 + f, 7, 8 + f, INKLINE); g.row(16, 7, 9, f ? INKLINE : "#c9b88a");
        g.set(6, 13, GOLD_SH);
        arm(g, p, 4, 12, 5, 16);
        arm(g, p, 11, 12, 11, 14 + f);
        const qy = 13 + f;
        g.set(12, qy, FEATHER); g.set(13, qy - 1, FEATHER); g.set(14, qy - 2, "#d95763");
      };
      break;
    case "hand_up":
      expr = "wide"; mouth = "open";
      draw = () => {
        arm(g, p, 4, 12, 4, 15);
        arm(g, p, 11, 12, f ? 13 : 12, f ? 6 : 5);
      };
      break;
    case "hurt":
      expr = "wince"; mouth = "open"; hdx = -1; hdy = f;
      draw = () => {
        arm(g, p, 4, 12, 2, 13 + f);
        arm(g, p, 11, 12, 13, 13 + f);
        if (cls === "warrior") drawShield(g);
        g.set(13, 5, GEM_HI); g.set(14, 6, GEM);
      };
      break;
    case "drink":
      draw = () => {
        arm(g, p, 4, 12, 4, 15);
        if (f === 0) {
          arm(g, p, 11, 12, 12, 14);
          g.rect(12, 10, 14, 13, WOOD_HI); g.row(10, 12, 14, WHITE);
          g.row(12, 12, 14, GOLD); g.set(14, 13, WOOD);
          g.set(12, 14, p.skin);
        } else {
          arm(g, p, 11, 12, 12, 12);
          g.rect(12, 8, 14, 11, WOOD_HI); g.row(8, 12, 14, WHITE);
          g.row(10, 12, 14, GOLD); g.set(14, 11, WOOD);
          g.set(12, 12, p.skin);
        }
      };
      if (f === 1) expr = "happy";
      break;
    case "cheer":
      expr = "happy"; mouth = "open"; hdy = -f;
      draw = () => {
        arm(g, p, 4, 12, 2, 5 - f);
        arm(g, p, 11, 12, 13, 5 - f);
        if (f === 1) { g.set(0 + 1, 3, GOLD_HI); g.set(14, 3, GOLD_HI); }
      };
      break;
  }

  g.dx = hdx; g.dy = hdy;
  drawHead(g, p, cls, expr, mouth);
  g.dx = 0; g.dy = 0;
  draw();
  g.dx = 0; g.dy = 0;
  g.outline();
  return g.toCanvas();
}

/** Sitting cross-legged on the ground; frame 1 = eyes closed + slow breath. */
function buildRest(p: Pal, cls: AdvClass, f: number): HTMLCanvasElement {
  const g = new Grid(16, 24);
  const robe = cls === "mage" || cls === "cleric";
  // standing torso drawn in a scratch grid, then dropped 3 rows (legs are replaced by a crossed sit)
  const tmp = new Grid(16, 24);
  drawBody(tmp, p, cls);
  const SH = 3;
  for (let y = 0; y < 24 - SH; y++) {
    for (let x = 0; x < 16; x++) {
      const v = tmp.c[y * 16 + x];
      if (v) g.c[(y + SH) * 16 + x] = v;
    }
  }
  // crossed legs
  if (robe) {
    g.row(21, 3, 12, p.main); g.set(12, 21, p.mSh); g.set(3, 21, p.mHi);
    g.row(22, 4, 11, cls === "mage" ? GOLD : GOLD_SH);
    g.row(22, 2, 3, BOOT); g.row(22, 12, 13, BOOT); g.set(2, 22, BOOT_HI);
    g.set(8, 21, cls === "mage" ? GOLD_HI : p.mHi);
  } else {
    g.row(21, 2, 13, p.pants); g.row(21, 11, 13, p.pSh);
    g.row(22, 5, 10, p.pSh); g.set(5, 22, p.pants); g.set(6, 22, p.pants);
    g.row(22, 2, 4, BOOT); g.set(2, 22, BOOT_HI);
    g.row(22, 11, 13, BOOT);
    g.set(8, 21, BELT);
  }
  // hands resting on the knees
  g.dy = SH;
  arm(g, p, 4, 12, 3, 17);
  arm(g, p, 11, 12, 12, 17);
  g.dy = SH + f;
  drawHead(g, p, cls, f === 1 ? "blink" : "normal", "smile");
  g.dx = 0; g.dy = 0;
  g.outline();
  return g.toCanvas();
}

export function charSprite(look: Look, pose: Pose, frame: number): HTMLCanvasElement {
  const nf = pose === "walk" ? 4 : 2;
  const key = `c|${look.cls}|${look.hair}|${look.shirt}|${look.skin}|${pose}|${normFrame(frame, nf)}`;
  let c = cache.get(key);
  if (!c) { c = buildChar(look, pose, frame); cache.set(key, c); }
  return c;
}

// ---------------------------------------------------------------- squire (12x18)
type InternPose = "idle" | "walk" | "attack" | "read" | "hand_up";

function buildIntern(pose: InternPose, f: number): HTMLCanvasElement {
  const p = mkPal(INTERN_LOOK, "warrior");
  const g = new Grid(12, 18);
  const CAP = "#8b5e3c", CAP_HI = "#b9814f", CAP_SH = "#5c3d28";
  const main = p.main, mSh = p.mSh;
  // legs
  const liftL = pose === "walk" && f === 0, liftR = pose === "walk" && f === 1;
  const leg = (x0: number, lifted: boolean) => {
    g.rect(x0, 13, x0 + 1, lifted ? 13 : 14, p.pants);
    g.set(x0 + 1, 13, p.pSh);
    const sy = lifted ? 14 : 15;
    g.row(sy, x0, x0 + 2, BOOT);
    g.set(x0, sy, BOOT_HI);
  };
  leg(3, liftL); leg(7, liftR);
  g.row(12, 3, 8, p.pants);
  // body
  g.rect(3, 8, 8, 11, main);
  for (let y = 8; y <= 11; y++) g.set(8, y, mSh);
  g.row(11, 3, 8, mSh);
  g.set(3, 9, p.mHi); g.set(4, 9, p.mHi);
  g.row(11, 3, 8, BELT); g.set(6, 11, GOLD);
  // head
  const hdy = pose === "idle" ? f : pose === "walk" && f === 1 ? -1 : 0;
  g.dy = hdy;
  g.rect(2, 4, 9, 7, p.skin);
  g.row(7, 3, 8, p.skSh);
  g.set(2, 5, p.hair); g.set(2, 6, p.hSh); g.set(2, 4, p.hair);
  g.row(1, 4, 7, CAP); g.row(2, 3, 8, CAP); g.row(3, 2, 8, CAP);
  g.set(4, 1, CAP_HI); g.set(5, 1, CAP_HI); g.set(4, 2, CAP_HI);
  g.row(3, 9, 10, CAP_SH); g.set(8, 2, CAP_SH);
  g.set(7, 3, CAP_SH);
  g.row(3, 2, 6, CAP_SH); g.row(3, 3, 6, CAP);
  const blink = pose === "idle" && f === 1;
  const down = pose === "read";
  for (const x of [6, 8]) {
    if (blink) g.set(x, 6, EYE);
    else if (down) { g.set(x, 5, p.skSh); g.set(x, 6, EYE); }
    else { g.set(x, 5, EYE); g.set(x, 6, EYE); }
  }
  g.set(9, 6, p.blush); g.set(3, 6, p.blush);
  if (pose === "hand_up") { g.set(7, 7, MOUTH); g.set(8, 7, MOUTH); } else g.set(7, 7, MOUTH);
  g.dy = 0;
  // arms / items
  const shield = () => {
    g.rect(1, 9, 2, 11, WOOD_HI);
    g.set(1, 9, WOOD_SH); g.set(2, 11, WOOD_SH); g.set(1, 11, WOOD_SH); g.set(2, 10, GOLD);
    g.set(2, 9, WOOD);
  };
  const sword = (hx: number, hy: number, dir: "up" | "fwd") => {
    if (dir === "up") {
      g.set(hx + 1, hy, WOOD); g.row(hy - 1, hx, hx + 1, GOLD);
      for (let y = hy - 6; y <= hy - 2; y++) g.set(hx + 1, y, y === hy - 6 ? WHITE : STEEL_HI);
    } else {
      g.rect(hx + 1, hy - 1, hx + 1, hy + 1, GOLD);
      g.set(hx + 2, hy, STEEL_HI);
    }
  };
  const rarm = (x1: number, y1: number) => {
    g.set(9, 9, main);
    if (x1 !== 9 || y1 !== 9) { g.set(9, 10, mSh); }
    g.set(x1, y1, p.skin);
  };
  if (pose === "idle" || pose === "walk") {
    g.set(2, 9, mSh);
    rarm(9, 10 + (pose === "walk" && f === 1 ? 1 : 0));
    sword(9, 10, "up");
    shield();
  } else if (pose === "attack") {
    g.set(2, 9, mSh);
    if (f === 0) { g.set(9, 9, main); g.set(9, 8, p.skin); sword(9, 8, "up"); }
    else { g.set(9, 9, main); g.set(9, 10, p.skin); sword(9, 10, "fwd"); }
    shield();
  } else if (pose === "read") {
    g.rect(3, 9, 8, 12, PAPER);
    g.row(9, 3, 8, PAPER_SH); g.row(12, 3, 8, PAPER_SH);
    g.row(10, 4, 6 + f, INKLINE); g.row(11, 4, 7 - f, "#c9b88a");
    g.set(2, 10, p.skin); g.set(9, 10, p.skin); g.set(2, 9, mSh); g.set(9, 9, mSh);
  } else {
    g.set(2, 9, mSh); g.set(2, 10, p.skin);
    g.set(9, 9, main);
    for (let y = 4; y <= 8; y++) g.set(10, y, mSh);
    g.set(10, 3, p.skin); if (f) g.set(11, 3, p.skin); else g.set(10, 2, p.skin);
    shield();
  }
  g.outline();
  return g.toCanvas();
}

/** Squire (subagent): own 12x18 art, small kid with leather cap and tiny shield + sword. */
export function internSprite(pose: InternPose, frame: number): HTMLCanvasElement {
  const f = normFrame(frame, 2);
  const key = `i|${pose}|${f}`;
  let c = cache.get(key);
  if (!c) { c = buildIntern(pose, f); cache.set(key, c); }
  return c;
}

// ---------------------------------------------------------------- monsters (<=16x16, facing LEFT)
function buildMonster(kind: MonsterKind, f: number, hurt: boolean): HTMLCanvasElement {
  const g = new Grid(16, 16);
  const b = f;
  switch (kind) {
    case "slime": {
      const base = "#5fc46a", hi = "#a8f0ac", sh = "#3a9450", dk = "#2a6e3c";
      const rows: Array<[number, number, number]> = b === 0
        ? [[5, 6, 9], [6, 4, 11], [7, 3, 12], [8, 2, 13], [9, 2, 13], [10, 2, 13], [11, 2, 13], [12, 3, 12]]
        : [[7, 5, 10], [8, 3, 12], [9, 2, 13], [10, 1, 14], [11, 1, 14], [12, 2, 13]];
      const top = rows[0][0], bot = rows[rows.length - 1][0];
      for (const [y, x0, x1] of rows) {
        g.row(y, x0, x1, base);
        g.set(x1, y, sh);
        if (y >= bot - 1) g.row(y, x0, x1, sh);
      }
      g.row(bot, rows[rows.length - 1][1], rows[rows.length - 1][2], dk);
      g.set(rows[1][1] + 1, top + 1, hi); g.set(rows[1][1] + 2, top + 1, hi); g.set(rows[2][1] + 1, top + 2, hi);
      const ey = top + 3;
      for (const x of [5, 8]) {
        g.set(x, ey, EYE); g.set(x, ey + 1, EYE); g.set(x, ey, WHITE);
      }
      g.row(ey + 2, 6, 7, dk);
      break;
    }
    case "goblin": {
      const skin = "#6fb04f", sh = "#4a8a3a", hi = "#97d36f", cloth = "#8b5e3c", clothSh = "#5c3d28";
      // legs
      g.rect(5, 13, 6, 14, sh); g.rect(9, 13, 10, 14, sh);
      g.row(14, 4, 6, "#4a3426"); g.row(14, 9, 11, "#4a3426");
      g.dy = b;
      // body
      g.rect(5, 9, 10, 12, cloth);
      g.rect(10, 9, 10, 12, clothSh); g.row(12, 5, 10, clothSh);
      g.set(7, 10, WOOD_HI); g.set(8, 11, WOOD_HI);
      // right (back) arm
      g.rect(11, 9, 11, 11, skin); g.set(11, 12, sh);
      // head + ears
      g.rect(5, 3, 10, 8, skin); g.row(3, 5, 10, hi); g.rect(10, 4, 10, 8, sh);
      g.set(4, 5, skin); g.set(3, 5, skin); g.set(2, 4, skin); g.set(3, 4, hi);
      g.set(11, 5, sh); g.set(12, 5, sh); g.set(13, 4, sh);
      g.set(6, 5, "#ffd84a"); g.set(6, 6, EYE); g.set(8, 5, "#ffd84a"); g.set(8, 6, EYE);
      g.row(4, 6, 7, sh); g.row(4, 8, 9, sh);
      g.set(5, 7, sh);
      g.row(8, 6, 9, "#3a1f2a"); g.set(6, 8, WHITE); g.set(9, 8, WHITE);
      // left (front) arm + club
      g.set(4, 10, skin); g.set(3, 11, skin);
      g.rect(1, 5, 3, 8, WOOD_HI); g.row(8, 1, 3, WOOD); g.set(3, 5, WOOD_SH); g.set(1, 5, WOOD);
      g.set(0 + 1, 4, STEEL_SH); g.set(3, 4, STEEL_SH);
      g.rect(2, 9, 2, 11, WOOD); g.set(2, 12, WOOD_SH);
      g.dy = 0;
      break;
    }
    case "bat": {
      const base = "#8a5ac0", sh = "#5f3a90", hi = "#b58be0", wing = "#6b3fa0", bone = "#4a2878";
      const wings: Array<[number, number, number]> = b === 0
        ? [[3, 1, 2], [4, 1, 4], [5, 2, 5], [6, 3, 5], [7, 4, 5]]
        : [[7, 4, 5], [8, 2, 5], [9, 1, 5], [10, 1, 3], [11, 1, 2]];
      for (const [y, x0, x1] of wings) {
        for (let x = x0; x <= x1; x++) {
          g.set(x, y, x === x0 ? bone : wing);
          g.set(15 - x, y, 15 - x === 15 - x0 ? bone : wing);
        }
      }
      g.rect(6, 6, 9, 9, base); g.row(10, 7, 8, base);
      g.rect(9, 6, 9, 9, sh); g.set(7, 10, sh); g.set(8, 10, sh);
      g.set(6, 5, base); g.set(6, 4, sh); g.set(9, 5, base); g.set(9, 4, sh);
      g.set(7, 6, hi); g.set(6, 6, hi);
      g.set(6, 7, "#ff5a5a"); g.set(8, 7, "#ff5a5a");
      g.set(7, 9, WHITE); g.set(8, 9, WHITE);
      break;
    }
    case "skeleton": {
      const bone = "#ece6d2", sh = "#b9b19a", dk = "#2a2438";
      // legs first (static), upper body bobs over them
      g.rect(6, 12, 6, 14, sh); g.rect(9, 12, 9, 14, sh);
      g.row(14, 5, 6, bone); g.row(14, 9, 10, bone);
      g.dy = b;
      g.row(11, 6, 9, sh);
      g.rect(5, 8, 10, 10, bone);
      g.row(9, 5, 10, sh); g.set(7, 8, dk); g.set(8, 8, dk);
      g.row(10, 5, 10, bone); g.set(7, 10, sh); g.set(8, 10, sh);
      g.rect(7, 7, 8, 7, sh);
      // skull
      g.row(2, 6, 9, bone); g.rect(5, 3, 10, 6, bone); g.row(7, 6, 9, bone);
      g.row(2, 6, 7, WHITE); g.rect(10, 3, 10, 6, sh);
      g.rect(6, 4, 7, 5, dk); g.rect(9, 4, 9, 5, dk);
      g.set(6, 5, "#ff5a5a"); g.set(9, 5, "#ff5a5a");
      g.set(8, 6, dk);
      g.row(7, 6, 9, bone); g.set(7, 7, dk); g.set(9, 7, dk);
      // arms
      g.rect(11, 8, 11, 10, bone); g.set(11, 11, sh);
      g.set(4, 8, bone); g.set(4, 9, bone); g.set(3, 10, bone);
      // sword
      for (let y = 2; y <= 8; y++) g.set(2, y, y % 2 ? "#a9a39a" : "#8c867d");
      g.set(2, 1, "#c9c4bb");
      g.row(9, 1, 3, WOOD_SH); g.set(3, 9, WOOD_SH);
      g.set(2, 10, bone); g.set(2, 11, WOOD);
      g.dy = 0;
      break;
    }
    case "mushroom": {
      const cap = "#d9434f", hi = "#f2707a", sh = "#a82e3d", under = "#7d2230";
      const stem = "#f1e3c4", stemSh = "#cdb98e";
      // feet + stem (static)
      g.rect(5, 8, 10, 12, stem); g.rect(10, 8, 10, 12, stemSh);
      g.row(13, 5, 6, stemSh); g.row(13, 9, 10, stemSh);
      g.row(12, 5, 10, stemSh);
      // face on stem
      for (const x of [6, 9]) { g.set(x, 10, EYE); g.set(x, 11, EYE); }
      g.set(5, 11, "#f2a0a8"); g.set(7, 12, MOUTH); g.set(8, 12, MOUTH);
      g.set(6, 10, WHITE);
      g.dy = b;
      const rows: Array<[number, number, number]> = [[2, 6, 9], [3, 4, 11], [4, 3, 12], [5, 2, 13], [6, 2, 13]];
      for (const [y, x0, x1] of rows) { g.row(y, x0, x1, cap); g.set(x1, y, sh); }
      g.row(7, 2, 13, under); g.row(7, 4, 11, sh);
      g.set(5, 2 + 1, hi); g.set(6, 3, hi); g.set(4, 4, hi);
      // spots
      g.rect(4, 4, 5, 5, WHITE); g.rect(9, 3, 10, 4, WHITE); g.set(12, 6, WHITE); g.set(8, 6, WHITE);
      g.set(7, 5, WHITE);
      g.dy = 0;
      break;
    }
  }
  g.outline();
  if (hurt) {
    g.recolor((c) => (luma(c) < 55 ? c : lighten(mix(c, "#ff3b3b", 0.4), 0.55)));
  }
  return g.toCanvas();
}

/** Monster sprite, facing LEFT (toward the adventurer). hurt=true draws a white/red flash variant. */
export function monsterSprite(kind: MonsterKind, frame: number, hurt: boolean): HTMLCanvasElement {
  const f = normFrame(frame, 2);
  const key = `m|${kind}|${f}|${hurt ? 1 : 0}`;
  let c = cache.get(key);
  if (!c) { c = buildMonster(kind, f, hurt); cache.set(key, c); }
  return c;
}

// ---------------------------------------------------------------- bosses (24x24, facing LEFT)
function ell(g: Grid, cx: number, cy: number, rx: number, ry: number, col: string) {
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      const dx = (x - cx) / (rx + 0.35), dy = (y - cy) / (ry + 0.35);
      if (dx * dx + dy * dy <= 1) g.set(x, y, col);
    }
  }
}
function tri(g: Grid, a: [number, number], b: [number, number], c: [number, number], col: string) {
  const sgn = (p: number[], q: number[], r: number[]) => (p[0] - r[0]) * (q[1] - r[1]) - (q[0] - r[0]) * (p[1] - r[1]);
  for (let y = 0; y < g.h; y++) {
    for (let x = 0; x < g.w; x++) {
      const pt = [x + 0.5, y + 0.5];
      const d1 = sgn(pt, a, b), d2 = sgn(pt, b, c), d3 = sgn(pt, c, a);
      const neg = d1 < 0 || d2 < 0 || d3 < 0, pos = d1 > 0 || d2 > 0 || d3 > 0;
      if (!(neg && pos)) g.set(x, y, col);
    }
  }
}
function line(g: Grid, x0: number, y0: number, x1: number, y1: number, col: string) {
  const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
  for (let i = 0; i <= n; i++) g.set(Math.round(x0 + ((x1 - x0) * i) / n), Math.round(y0 + ((y1 - y0) * i) / n), col);
}

function buildBoss(kind: BossKind, f: number, hurt: boolean): HTMLCanvasElement {
  const g = new Grid(24, 24);
  const BONE = "#f0e8d0";
  if (kind === "ogre") {
    const SK = "#6a9a4a", HI = "#93c466", SHD = "#44693a", DK = "#2f4a2a", CL = "#7a4a2b", CL_SH = "#5c3622";
    // club (behind)
    g.rect(18, 2 + f, 22, 7 + f, WOOD); g.rect(18, 2 + f, 18, 7 + f, WOOD_HI); g.rect(22, 2 + f, 22, 7 + f, WOOD_SH);
    g.set(20, 3 + f, BONE); g.set(19, 6 + f, BONE); g.set(21, 5 + f, BONE);
    g.rect(19, 8 + f, 21, 17 + f, WOOD); g.rect(19, 8 + f, 19, 17 + f, WOOD_HI); g.rect(21, 8 + f, 21, 17 + f, WOOD_SH);
    // legs
    const le = 21 - f, re = 20 + f;
    g.rect(6, 18, 10, le, SK); g.rect(10, 18, 10, le, SHD); g.row(le, 5, 10, DK);
    g.rect(13, 18, 17, re, SK); g.rect(17, 18, 17, re, SHD); g.row(re, 12, 17, DK);
    // torso
    ell(g, 12, 13 + f, 7, 6, SK);
    for (let y = 7; y <= 20; y++) for (let x = 16; x <= 20; x++) if (g.c[y * 24 + x] === SK) g.set(x, y, SHD);
    ell(g, 10, 14 + f, 3, 3, HI);
    g.rect(7, 17 + f, 16, 19, CL); g.row(19, 7, 16, CL_SH); g.set(10, 17 + f, CL_SH); g.set(13, 18 + f, CL_SH);
    // head
    ell(g, 7, 6 + f, 4, 3, SK);
    g.set(5, 3 + f, HI); g.set(6, 3 + f, HI); g.set(11, 4 + f, SK); g.set(12, 4 + f, SK); g.set(12, 5 + f, SHD);
    g.set(3, 6 + f, SHD);
    g.row(4 + f, 4, 6, DK); g.set(7, 5 + f, DK);
    g.set(5, 5 + f, "#ff5a3a"); g.set(8, 5 + f, "#ff5a3a");
    g.row(8 + f, 4, 9, DK);
    g.set(4, 7 + f, BONE); g.set(4, 8 + f, BONE); g.set(7, 7 + f, BONE); g.set(7, 8 + f, BONE);
    // arms
    g.rect(3, 11 + f, 5, 15 + f, SK); g.rect(3, 11 + f, 3, 15 + f, HI); g.rect(3, 15 + f, 5, 17 + f, HI); g.row(17 + f, 3, 5, SHD);
    g.rect(16, 9 + f, 18, 12 + f, SK); g.rect(18, 12 + f, 21, 14 + f, SK); g.row(14 + f, 18, 21, SHD);
  } else {
    const RED = "#c8402f", HI = "#ee6a4a", SHD = "#8a2a24", BELLY = "#f2c46a", BSH = "#d9a04a";
    const WING = "#e0773a", WHI = "#f0a050", EYEC = "#ffe14a";
    // wing (behind)
    if (f === 0) {
      tri(g, [12, 11], [17, 1], [22, 7], WING); tri(g, [12, 11], [22, 7], [20, 14], WING);
      line(g, 12, 11, 17, 1, SHD); line(g, 12, 11, 22, 7, SHD); line(g, 12, 11, 20, 14, SHD);
      g.set(15, 5, WHI); g.set(16, 4, WHI);
    } else {
      tri(g, [12, 11], [15, 5], [22, 11], WING); tri(g, [12, 11], [22, 11], [20, 17], WING);
      line(g, 12, 11, 15, 5, SHD); line(g, 12, 11, 22, 11, SHD); line(g, 12, 11, 20, 17, SHD);
      g.set(15, 8, WHI); g.set(17, 9, WHI);
    }
    // tail
    g.rect(15, 15, 19, 17, RED); g.row(17, 15, 19, SHD);
    g.rect(19, 17 - f, 21, 18 - f, RED); g.set(22, 17 - f, SHD); g.set(22, 18 - f, HI);
    // legs
    g.rect(9, 18, 10, 19, RED); g.rect(8, 20, 10, 20, SHD);
    g.rect(14, 18, 15, 19, RED); g.rect(13, 20, 15, 20, SHD);
    // body
    ell(g, 12, 14, 5, 4, RED);
    for (let y = 16; y <= 18; y++) for (let x = 14; x <= 17; x++) if (g.c[y * 24 + x] === RED) g.set(x, y, SHD);
    ell(g, 10, 15, 3, 3, BELLY); g.row(17, 8, 12, BSH);
    g.set(11, 11, HI); g.set(12, 11, HI); g.set(13, 12, HI);
    // neck + head
    g.rect(8, 9, 11, 13, RED); g.set(8, 10, HI);
    g.rect(8, 11, 9, 13, BELLY);
    const hy = f;
    ell(g, 6, 8 + hy, 3, 3, RED);
    g.rect(2, 8 + hy, 4, 10 + hy, RED); g.row(10 + hy, 2, 5, SHD);
    g.set(3, 10 + hy, BONE); g.set(5, 10 + hy, BONE);
    g.set(2, 8 + hy, SHD);
    g.set(5, 7 + hy, EYEC); g.set(4, 6 + hy, SHD); g.set(5, 6 + hy, SHD);
    g.set(5, 5 + hy, HI);
    g.set(7, 5 + hy, BONE); g.set(8, 4 + hy, BONE); g.set(9, 3 + hy, BONE);
    g.set(9, 5 + hy, BONE); g.set(10, 4 + hy, BONE); g.set(11, 3 + hy, BONE);
  }
  g.outline();
  if (hurt) g.recolor((c) => (luma(c) < 55 ? c : lighten(mix(c, "#ff3b3b", 0.4), 0.55)));
  return g.toCanvas();
}

/** Boss sprite (24x24), facing LEFT. hurt=true draws a white/red flash variant. */
export function bossSprite(kind: BossKind, frame: number, hurt: boolean): HTMLCanvasElement {
  const k: BossKind = kind === "dragon" ? "dragon" : "ogre";
  const f = normFrame(frame, 2);
  const key = `b|${k}|${f}|${hurt ? 1 : 0}`;
  let c = cache.get(key);
  if (!c) { c = buildBoss(k, f, hurt); cache.set(key, c); }
  return c;
}

// ---------------------------------------------------------------- props
const EXTRA: Record<string, string> = {
  Y: "#d9a53a", K: "#5ea9dd", m: "#e8707a", x: "#a04050", s: "#c9d6e6", f: "#fbf7ec", B: "#3b6ea5",
  e: "#5c3d28", t: "#b9814f", G: "#2f6b3a", h: "#8fd68a", R: "#a82e3d", v: "#9b6bd6", V: "#5a3a9a",
  C: "#6ff0ff", z: "#3a9bb5", q: "#6b6f7a", u: "#a9afbc", o: "#f5a03a", W: "#efe2c0", j: "#d4bf90",
  Z: "#fff3b0", E: "#2e7d3e", L: "#3f9a4b", M: "#6bbf59", T: "#7a4a2b", U: "#a0693d", F: "#ffd24a",
  H: "#ff7aa8", N: "#6a6f7c", X: "#9aa0ad", D: "#2a2d3a", I: "#9fd633", J: "#e6ff7a",
};

const PROPS: Record<string, string[]> = {
  paper: ["OOOOOO", "OfBBfO", "OfffBO", "OfBBfO", "OOOOOO"],
  sticky: ["yyyy", "yOOy", "yyOy", "YyyY"],
  mug: ["OOOO.", "OmwOO", "OmmOO", "OOOO."],
  plant: [
    "....g.....", "...ggg.g..", ".g.ggggg..", ".ggggggg.g", "..ggggggg.", ".gggOgggg.", "..gggggg..",
    "...ggg.g..", "....g.g...", "....ggg...", "....nn....", "..nnnnnn..", "..nnnnnn..", "..OnnnnO..",
    "...OnnO...", "...OOOO...",
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
    "....r....", ".OOOrOOO.", "OWWWWWWWO", "OWjjjjjWO", "OWWWWWWWO", "OWjjjjWWO",
    "OWWWWWWWO", "OWjjjjjWO", "OWWWWWWWO", "OWWWWWjWO", ".OOOOOOO.",
  ],
  coin: [".OOO.", "OywyO", "OyYyO", "OYyYO", ".OOO."],
  chest: [
    ".OOOOOOOOOO.", "OttttttttttO", "OtnnnnnnnntO", "OYYYYYYYYYYO", "OnnnnYYnnnnO", "OnnnnYOnnnnO",
    "OnnnnnnnnnnO", "OeeeeeeeeeeO", ".OOOOOOOOOO.",
  ],
  slash0: [
    "..s.....", "...s....", "....ss..", ".....ss.", "......ss", "......ss", ".....ss.", "....ss..", "...s....", "..s.....",
  ],
  slash1: [
    "..w.......", "...ww.....", ".....ww...", "......www.", ".......www", ".......www", ".......www", ".......www",
    "......www.", ".....ww...", "...ww.....", "..w.......",
  ],
  magic0: [
    "....C....", "..v.C.v..", "...vCv...", ".vCCwCCv.", "CCCCwCCCC", ".vCCwCCv.", "...vCv...", "..v.C.v..", "....C....",
  ],
  magic1: [
    "C...v...C", ".v..C..v.", "..v.C.v..", "...vwv...", "vCCwwwCCv", "...vwv...", "..v.C.v..", ".v..C..v.", "C...v...C",
  ],
  owl0: ["nn....nn", "nnnnnnnn", "nwOnnOwn", "nnnYYnnn", "tnnllnnt", ".tnllnt.", "..y..y.."],
  owl1: ["tn....nt", "tnnnnnnt", "twOnnOwt", "tnnYYnnt", ".tnllnt.", "..nllnn.", "..y..y.."],
  portal0: [
    "...OOOO...", "..OvvvvO..", ".OvVVVVvO.", "OvVVVVVVvO", "OvVVwwVVvO", "OvVwCCwVvO",
    "OvVwCCwVvO", "OvVVwwVVvO", "OvVVVVVVvO", ".OvVVVVvO.", "..OvvvvO..", "...OOOO...",
  ],
  portal1: [
    "...OOOO...", "..OvvvvO..", ".OvVVVVvO.", "OvVVCVVVvO", "OvVCwwVVvO", "OvVVwCCVvO",
    "OvVCCwVVvO", "OvVVwwCVvO", "OvVVVCVVvO", ".OvVVVVvO.", "..OvvvvO..", "...OOOO...",
  ],
  heart: [".OO.OO.", "OwrOrrO", "OrrrrrO", ".OrrrO.", "..OrO..", "...O..."],
  poof0: [
    "...wwww...", ".wwwwwwww.", "wwwwswwwww", "wwswwwwwsw", ".wwwwwwww.", "..sswwss..",
  ],
  poof1: [
    "w..ww..w..", ".ww..ww..w", "w..ssw.ww.", "..w....w..", ".w.ww.w..w", "..ww..ww..",
  ],
  arrow: ["ww....u.", "nnnnnnuu", "ww....u."],
  flag: [
    "errrrrr.", "errrrrrr", "errwwrrr", "errrrrr.", "e.......", "e.......", "e.......", "e.......",
    "e.......", "e.......", "e.......", "eee.....",
  ],
  torch0: [
    "...o..", "..oyo.", ".oyyyo", ".oywyo", "..oyo.", ".qNNq.", "..NN..", "..ee..", "..ee..", "..ee..",
  ],
  torch1: [
    "..o...", "..oyo.", ".oyyyo", ".oyyyo", ".oywyo", ".qNNq.", "..NN..", "..ee..", "..ee..", "..ee..",
  ],
  tree: [
    "......OOOO......", "....OOMMMMOO....", "...OMMMMMMMMO...", "..OMMMLMMMMMMO..", ".OMMLLLMMMMMMLO.",
    ".OMLLLLMMMMMLLO.", "OMLLLLLMMMMLLLEO", "OLLLLLLLMMLLLLEO", "OLLLLLLLLLLLLEEO", "OELLLLLLLLLLEEEO",
    ".OELLLLLLLLEEEO.", ".OEEELLLLEEEEO..", "..OOEEEEEEEEOO..", "....OOOOOOOO....",
    "......OTUO......", "......OTUO......", "......OTTO......", ".....OTTUTO.....", "....OTTTUTTO....",
    "....OOOOOOOO....",
  ],
  bush: [
    "....OOOO....", "..OOMMLLOO..", ".OMMMLLLLLO.", "OMMLLLLLLEEO", "OLLLLLLLLEEO", "OLLLLLEEEEEO",
    ".OOEEEEEEOO.", "...OOOOOO...",
  ],
  rock: [
    "...OOOO...", "..OuuXXO..", ".OuuXXXNO.", "OuXXXXNNNO", "OXXXXNNNNO", "OXXNNNNNNO", ".OOOOOOOO.",
  ],
  flower: ["..H..", ".HFH.", "..H..", "..E..", ".LE..", "..E.."],
  barrel: [
    ".OOOOOO.", "OtttttnO", "OYYYYYYO", "OtnnnnnO", "OtnnnnnO", "OYYYYYYO", "OtnnnnnO", "OnnnnneO", ".OOOOOO.",
  ],
  sign: [
    "OOOOOOOOOO", "OttttttttO", "OteettetnO", "OtettetttO", "OnnnnnnnnO", "OOOOOOOOOO", "....OeO...", "....OeO...",
    "....OeO...", "....OeO...", "....OeO...", "...OOOOO..",
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
    "....o.....", "...ooo....", "..ooyoo...", "..oyyyo.o.", ".ooyyyyoo.", ".oyywwyyo.",
    "..OoyyoO..", "OtnnnnnntO", ".OeeeeeeO.",
  ],
  campfire1: [
    ".....o....", "....oo....", "...ooyo...", ".o.oyyoo..", ".ooyyyyo..", ".oyywyyyo.",
    "..OoyyoO..", "OtnnnnnntO", ".OeeeeeeO.",
  ],
  crit: ["...F...", ".F.F.F.", "..FwF..", "FFwwwFF", "..FwF..", ".F.F.F.", "...F..."],
  gold_icon: ["..OOO..", ".OywyO.", ".OYYYO.", "OOOOOOO", "OyywyYO", "OYYYYYO", ".OOOOO."],
};

function rowsToCanvas(rows: string[], colorOf: (ch: string) => string | null): HTMLCanvasElement {
  const w = Math.max(...rows.map((r) => r.length));
  const c = mkCanvas(w, rows.length);
  const ctx = c.getContext("2d");
  if (ctx) {
    for (let y = 0; y < rows.length; y++) {
      for (let x = 0; x < rows[y].length; x++) {
        const ch = rows[y][x];
        const col = ch === "." ? null : colorOf(ch);
        if (col) { ctx.fillStyle = col; ctx.fillRect(x, y, 1, 1); }
      }
    }
  }
  return c;
}

const ZZZ_GLYPH = ["WWW", ".W.", "WWW"];
function buildZzz(): HTMLCanvasElement {
  const g = new Grid(8, 8);
  ZZZ_GLYPH.forEach((r, y) => { for (let x = 0; x < 3; x++) if (r[x] === "W") g.set(4 + x, 1 + y, WHITE); });
  ZZZ_GLYPH.forEach((r, y) => { for (let x = 0; x < 3; x++) if (r[x] === "W") g.set(1 + x, 4 + y, "#dfe6f2"); });
  g.outline();
  return g.toCanvas();
}

const butterflyTinted = new Map<string, HTMLCanvasElement>();
/** Butterfly with wings tinted `color` (hex "#rrggbb"); frame 0 = open, 1 = closed. Cached (bounded). */
export function butterflySprite(color: string, frame: number): HTMLCanvasElement {
  const f = normFrame(frame, 2);
  const col = /^#[0-9a-fA-F]{6}$/.test(color) ? color.toLowerCase() : "#ff9ad0";
  const key = col + "|" + f;
  let c = butterflyTinted.get(key);
  if (c) return c;
  const shade = darken(col, 0.3);
  c = rowsToCanvas(PROPS[f === 0 ? "butterfly0" : "butterfly1"], (ch) =>
    ch === "w" ? col : ch === "a" ? shade : ch === "O" ? INK : null);
  if (butterflyTinted.size >= 96) butterflyTinted.clear();
  butterflyTinted.set(key, c);
  return c;
}


export function prop(name: string): HTMLCanvasElement {
  const key = "p|" + name;
  let c = cache.get(key);
  if (c) return c;
  if (name === "zzz") {
    c = buildZzz();
  } else {
    const rows = Object.prototype.hasOwnProperty.call(PROPS, name) ? PROPS[name] : undefined;
    if (!rows || rows.length === 0) {
      c = mkCanvas(1, 1);
      cache.set(key, c);
      return c;
    }
    c = rowsToCanvas(rows, (ch) => EXTRA[ch] ?? SPRITE_COLORS[ch] ?? null);
  }
  cache.set(key, c);
  return c;
}
