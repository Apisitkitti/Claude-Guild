// Drawing for the lively guild hall (see hallLife.ts): static decor baked into the background (window frame, guild
// standards with the crest, hearth rug and armchair, card table, dragon-skull plaque, plants, dog cushion) and the
// per-frame parts: the sunlit/moonlit window with its light shaft and dust motes, candle flames, and the cat, dog,
// mouse and regulars as depth-sorted entities. Characters are opaque and nothing translucent is drawn over them.

import {
  CARD_TABLE,
  BANNER_POSTS,
  DOG_POS,
  HEARTH_RUG,
  MOUSE_HOLE_A,
  MOUSE_HOLE_B,
  PATRON_SPOTS,
  PLANT_SPOTS,
  WINDOW,
  windowSky,
  type HallLife,
  type Patron,
} from "./hallLife";
import { CH_H, CH_W } from "./layout";
import { patronSprite } from "./patronSprites";
import {
  CAT_H,
  CAT_W,
  DOG_H,
  DOG_W,
  MOUSE_H,
  MOUSE_W,
  catSprite,
  dogSprite,
  mouseSprite,
  type CatPose,
} from "./petSprites";

type Ctx = CanvasRenderingContext2D;

const GOLD = "#f2c14e";
const WD = { dark: "#3b2418", mid: "#6e4a36", light: "#a8764a", top: "#d2a574", hi: "#e6c295" };
const STONE = { dark: "#4a4f63", mid: "#6f7487", hi: "#9aa0b4" };
const CLOTH = { base: "#8a2f3a", dark: "#5e1f28", hi: "#b04552" };
const STEEL = "#c8ced8";
const SHIELD = "#2f4f7f";
const INK = "#1a1c2c";
const STAR = "#ffffff";
const MOTE_COUNT = 9;
const BEAM_TOP_Y = WINDOW.y + WINDOW.h;
const BEAM_BOTTOM_Y = 92;
const BEAM_SLIDE = 30;

const rect = (ctx: Ctx, color: string, x: number, y: number, width: number, height: number) => {
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x), Math.round(y), width, height);
};

// ---------------------------------------------------------------- static decor (baked into the background)
const drawWindowFrame = (ctx: Ctx) => {
  const win = WINDOW;
  rect(ctx, STONE.dark, win.x - 2, win.y - 2, win.w + 4, win.h + 5);
  rect(ctx, STONE.hi, win.x - 2, win.y - 2, win.w + 4, 1);
  rect(ctx, "#14100c", win.x, win.y, win.w, win.h); // the glass is painted live over this
  // rounded top
  rect(ctx, STONE.dark, win.x, win.y, 2, 1);
  rect(ctx, STONE.dark, win.x + win.w - 2, win.y, 2, 1);
  // sill
  rect(ctx, STONE.mid, win.x - 3, win.y + win.h, win.w + 6, 2);
  rect(ctx, STONE.hi, win.x - 3, win.y + win.h, win.w + 6, 1);
};

/** the glass, mullions and curtains: drawn live (after the night overlay) so the sky shows through and stays bright */
const drawWindowGlass = (ctx: Ctx, time: number, hour: number, still: boolean) => {
  const win = WINDOW;
  const [top, bottom] = windowSky(hour);
  const bands = 6;
  for (let band = 0; band < bands; band++) {
    const k = band / (bands - 1);
    const mixAt = (from: string, to: string) => {
      const channel = (color: string, i: number) => parseInt(color.slice(1 + i * 2, 3 + i * 2), 16);
      return `rgb(${[0, 1, 2].map((i) => Math.round(channel(from, i) + (channel(to, i) - channel(from, i)) * k)).join(",")})`;
    };
    rect(ctx, mixAt(top, bottom), win.x, win.y + (band * win.h) / bands, win.w, Math.ceil(win.h / bands));
  }
  const night = hour >= 19.5 || hour < 5;
  if (night) {
    for (const [sx, sy] of [
      [2, 4],
      [9, 7],
      [5, 12],
      [11, 3],
    ]) {
      const twinkle = still ? 1 : Math.abs(Math.sin(time * 1.5 + sx));
      if (twinkle > 0.3) rect(ctx, STAR, win.x + sx, win.y + sy, 1, 1);
    }
    // a crescent moon
    rect(ctx, "#f4f1d0", win.x + 8, win.y + 3, 3, 3);
    rect(ctx, "#0b1030", win.x + 9, win.y + 3, 2, 2);
  } else if (hour > 7 && hour < 17.5) {
    rect(ctx, "#fff3a8", win.x + 8, win.y + 3, 3, 3);
    rect(ctx, "#ffffff", win.x + 3, win.y + 9, 5, 1);
    rect(ctx, "#ffffff", win.x + 4, win.y + 8, 3, 1);
  }
  // mullions
  rect(ctx, WD.dark, win.x + Math.floor(win.w / 2) - 1, win.y, 1, win.h);
  rect(ctx, WD.dark, win.x, win.y + Math.floor(win.h / 2), win.w, 1);
  // curtains
  rect(ctx, CLOTH.base, win.x, win.y, 2, win.h - 5);
  rect(ctx, CLOTH.hi, win.x, win.y, 1, win.h - 5);
  rect(ctx, CLOTH.base, win.x + win.w - 2, win.y, 2, win.h - 5);
  rect(ctx, CLOTH.dark, win.x + win.w - 1, win.y, 1, win.h - 5);
  rect(ctx, WD.mid, win.x - 1, win.y, win.w + 2, 1);
};

const drawBanner = (ctx: Ctx, px: number, py: number) => {
  // base and pole
  rect(ctx, STONE.dark, px - 4, py - 2, 9, 3);
  rect(ctx, STONE.hi, px - 4, py - 2, 9, 1);
  rect(ctx, WD.dark, px, py - 24, 1, 22);
  rect(ctx, GOLD, px - 1, py - 25, 3, 2);
  // crossbar and the cloth hanging from it
  rect(ctx, WD.mid, px - 6, py - 22, 13, 1);
  rect(ctx, GOLD, px - 7, py - 23, 1, 3);
  rect(ctx, GOLD, px + 7, py - 23, 1, 3);
  rect(ctx, CLOTH.base, px - 5, py - 21, 11, 18);
  rect(ctx, CLOTH.hi, px - 5, py - 21, 1, 18);
  rect(ctx, CLOTH.dark, px + 5, py - 21, 1, 18);
  rect(ctx, GOLD, px - 5, py - 21, 11, 1);
  // swallowtail
  rect(ctx, "#14100c", px, py - 5, 1, 2);
  rect(ctx, CLOTH.dark, px - 1, py - 5, 3, 1);
  // crest: crossed swords over a shield (the guild icon)
  for (let step = 0; step < 8; step++) {
    rect(ctx, STEEL, px - 4 + step, py - 18 + step, 1, 1);
    rect(ctx, STEEL, px + 4 - step, py - 18 + step, 1, 1);
  }
  rect(ctx, GOLD, px - 5, py - 12, 3, 1);
  rect(ctx, GOLD, px + 3, py - 12, 3, 1);
  rect(ctx, STEEL, px - 2, py - 16, 5, 7);
  rect(ctx, SHIELD, px - 1, py - 15, 3, 5);
  rect(ctx, SHIELD, px, py - 9, 1, 1);
  rect(ctx, GOLD, px, py - 14, 1, 3);
  rect(ctx, GOLD, px - 1, py - 13, 3, 1);
};

const drawHearthRug = (ctx: Ctx) => {
  const rug = HEARTH_RUG;
  ctx.globalAlpha = 0.2;
  rect(ctx, "#000", rug.x + 2, rug.y + 2, rug.w, rug.h);
  ctx.globalAlpha = 1;
  rect(ctx, "#6a3a2a", rug.x, rug.y, rug.w, rug.h);
  rect(ctx, GOLD, rug.x + 1, rug.y + 1, rug.w - 2, 1);
  rect(ctx, GOLD, rug.x + 1, rug.y + rug.h - 2, rug.w - 2, 1);
  rect(ctx, GOLD, rug.x + 1, rug.y + 1, 1, rug.h - 2);
  rect(ctx, GOLD, rug.x + rug.w - 2, rug.y + 1, 1, rug.h - 2);
  rect(ctx, "#8a4a34", rug.x + 4, rug.y + 4, rug.w - 8, rug.h - 8);
  for (let x = rug.x + 6; x < rug.x + rug.w - 5; x += 6) rect(ctx, "#d9a441", x, rug.y + rug.h / 2 - 1, 2, 2);
};

const drawArmchair = (ctx: Ctx, cx: number, feetY: number) => {
  rect(ctx, "#000", cx - 9, feetY - 2, 19, 1);
  rect(ctx, "#5e1f28", cx - 8, feetY - 18, 17, 17);
  rect(ctx, CLOTH.base, cx - 7, feetY - 17, 15, 15);
  rect(ctx, CLOTH.hi, cx - 7, feetY - 17, 15, 1);
  rect(ctx, "#5e1f28", cx - 9, feetY - 10, 4, 9);
  rect(ctx, "#5e1f28", cx + 6, feetY - 10, 4, 9);
  rect(ctx, CLOTH.hi, cx - 9, feetY - 10, 4, 1);
  rect(ctx, CLOTH.hi, cx + 6, feetY - 10, 4, 1);
  rect(ctx, WD.dark, cx - 9, feetY - 1, 2, 2);
  rect(ctx, WD.dark, cx + 8, feetY - 1, 2, 2);
};

const drawStool = (ctx: Ctx, cx: number, feetY: number) => {
  rect(ctx, WD.dark, cx - 8, feetY - 8, 16, 4);
  rect(ctx, WD.light, cx - 7, feetY - 8, 14, 2);
  rect(ctx, WD.top, cx - 7, feetY - 8, 14, 1);
  rect(ctx, WD.dark, cx - 7, feetY - 4, 2, 4);
  rect(ctx, WD.dark, cx + 5, feetY - 4, 2, 4);
};

const drawCardTable = (ctx: Ctx) => {
  const tab = CARD_TABLE;
  rect(ctx, "#4a2f20", tab.x - 6, tab.y + tab.h - 2, tab.w + 12, 18); // rug
  rect(ctx, "#3f5a3a", tab.x - 5, tab.y + tab.h - 1, tab.w + 10, 16);
  rect(ctx, "#d9c27a", tab.x - 5, tab.y + tab.h - 1, tab.w + 10, 1);
  rect(ctx, "#d9c27a", tab.x - 5, tab.y + tab.h + 14, tab.w + 10, 1);
  ctx.globalAlpha = 0.22;
  rect(ctx, "#000", tab.x + 1, tab.y + tab.h, tab.w, 3);
  ctx.globalAlpha = 1;
  rect(ctx, WD.dark, tab.x + 1, tab.y + 5, 2, tab.h + 3);
  rect(ctx, WD.dark, tab.x + tab.w - 3, tab.y + 5, 2, tab.h + 3);
  rect(ctx, WD.dark, tab.x, tab.y, tab.w, 7);
  rect(ctx, WD.light, tab.x + 1, tab.y + 1, tab.w - 2, 5);
  rect(ctx, WD.top, tab.x + 1, tab.y + 1, tab.w - 2, 1);
  rect(ctx, "#2e5a3a", tab.x + 2, tab.y + 2, tab.w - 4, 3); // green baize
  // cards, coins, a mug, the candle stub
  rect(ctx, "#f5efe0", tab.x + 4, tab.y + 2, 2, 2);
  rect(ctx, "#d95763", tab.x + 4, tab.y + 2, 1, 1);
  rect(ctx, GOLD, tab.x + 8, tab.y + 3, 1, 1);
  rect(ctx, GOLD, tab.x + 9, tab.y + 2, 1, 1);
  rect(ctx, "#cfd6e0", tab.x + tab.w - 5, tab.y + 1, 2, 3);
  rect(ctx, "#f5efe0", tab.x + 7, tab.y - 2, 2, 3);
};

/** a dragon skull mounted on a plaque above the counter shelves */
const drawTrophy = (ctx: Ctx) => {
  const cx = 96;
  rect(ctx, WD.dark, cx - 12, 2, 25, 11);
  rect(ctx, WD.mid, cx - 11, 3, 23, 9);
  // horns curving out and up
  for (const side of [-1, 1]) {
    rect(ctx, "#e8e0c8", cx + side * 6 + (side > 0 ? 0 : -1), 5, 2, 2);
    rect(ctx, "#e8e0c8", cx + side * 8 + (side > 0 ? 0 : -1), 4, 2, 1);
    rect(ctx, "#c9bfa2", cx + side * 9 + (side > 0 ? 0 : -1), 3, 1, 1);
  }
  // cranium, snout, eye sockets, teeth
  rect(ctx, "#e8e0c8", cx - 5, 4, 11, 4);
  rect(ctx, "#f4efdc", cx - 4, 4, 9, 1);
  rect(ctx, "#e8e0c8", cx - 3, 8, 7, 3);
  rect(ctx, "#c9bfa2", cx - 5, 7, 11, 1);
  rect(ctx, "#2a1a14", cx - 4, 5, 3, 2);
  rect(ctx, "#2a1a14", cx + 2, 5, 3, 2);
  rect(ctx, "#d11a2a", cx - 3, 6, 1, 1);
  rect(ctx, "#d11a2a", cx + 3, 6, 1, 1);
  rect(ctx, "#2a1a14", cx - 1, 8, 1, 1);
  rect(ctx, "#2a1a14", cx + 1, 8, 1, 1);
  for (let tooth = -3; tooth <= 3; tooth += 2) rect(ctx, "#fffaf0", cx + tooth, 11, 1, 2);
};

const drawPlant = (ctx: Ctx, px: number, py: number) => {
  rect(ctx, "#000", px - 5, py - 1, 11, 1);
  rect(ctx, "#8a4a34", px - 4, py - 8, 9, 8);
  rect(ctx, "#a85a3a", px - 4, py - 8, 9, 2);
  rect(ctx, "#6a3a2a", px + 2, py - 7, 3, 7);
  for (const [lx, ly, width] of [
    [-5, -16, 5],
    [1, -17, 5],
    [-3, -20, 5],
    [-6, -12, 4],
    [3, -13, 4],
  ] as const) {
    rect(ctx, "#2f7a3a", px + lx, py + ly, width, 4);
    rect(ctx, "#5fa55a", px + lx, py + ly, width, 1);
    rect(ctx, "#256030", px + lx + 1, py + ly + 3, width - 1, 1);
  }
};

const drawDogCushion = (ctx: Ctx) => {
  rect(ctx, "#000", DOG_POS.x - 15, DOG_POS.y - 2, 30, 1);
  rect(ctx, "#5e1f28", DOG_POS.x - 14, DOG_POS.y - 6, 28, 7);
  rect(ctx, CLOTH.base, DOG_POS.x - 13, DOG_POS.y - 5, 26, 5);
  rect(ctx, CLOTH.hi, DOG_POS.x - 13, DOG_POS.y - 5, 26, 1);
  rect(ctx, GOLD, DOG_POS.x - 14, DOG_POS.y, 28, 1);
};

const drawMouseHoles = (ctx: Ctx) => {
  for (const hole of [MOUSE_HOLE_A, MOUSE_HOLE_B]) {
    rect(ctx, "#14100c", hole.x - 2, hole.y - 4, 5, 4);
    rect(ctx, "#14100c", hole.x - 1, hole.y - 5, 3, 1);
  }
};

/** baked once into the static background (after the hall and the west wing) */
export const drawHallLifeDecor = (ctx: Ctx) => {
  drawWindowFrame(ctx);
  drawHearthRug(ctx);
  drawTrophy(ctx);
  drawMouseHoles(ctx);
  drawDogCushion(ctx);
  for (const spot of PLANT_SPOTS) drawPlant(ctx, spot.x, spot.y);
  drawCardTable(ctx);
  for (const spot of PATRON_SPOTS) {
    if (spot.kind === "traveller") drawArmchair(ctx, spot.x, spot.y);
    else drawStool(ctx, spot.x, spot.y);
  }
  for (const post of BANNER_POSTS) drawBanner(ctx, post.x, post.y);
};

// ---------------------------------------------------------------- live lights (after the night overlay)
const beamEdges = (y: number): [number, number] => {
  const progress = (y - BEAM_TOP_Y) / (BEAM_BOTTOM_Y - BEAM_TOP_Y);
  const left = WINDOW.x - BEAM_SLIDE * progress,
    right = WINDOW.x + WINDOW.w - BEAM_SLIDE * progress;
  return [left, right];
};

const drawBeam = (ctx: Ctx, hour: number) => {
  const night = hour >= 19.5 || hour < 5;
  const dusk = (hour >= 17 && hour < 19.5) || (hour >= 5 && hour < 7);
  ctx.globalAlpha = night ? 0.1 : dusk ? 0.13 : 0.12;
  ctx.fillStyle = night ? "#bcd0ff" : dusk ? "#ffb070" : "#fff3c4";
  const [topLeft, topRight] = beamEdges(BEAM_TOP_Y);
  const [bottomLeft, bottomRight] = beamEdges(BEAM_BOTTOM_Y);
  ctx.beginPath();
  ctx.moveTo(topLeft, BEAM_TOP_Y);
  ctx.lineTo(topRight, BEAM_TOP_Y);
  ctx.lineTo(bottomRight, BEAM_BOTTOM_Y);
  ctx.lineTo(bottomLeft, BEAM_BOTTOM_Y);
  ctx.closePath();
  ctx.fill();
  ctx.globalAlpha = 1;
};

/** dust motes drifting down the light shaft: single opaque pixels (they stay put under reduced motion) */
const drawMotes = (ctx: Ctx, time: number, hour: number, still: boolean) => {
  const night = hour >= 19.5 || hour < 5;
  const color = night ? "#d7e2ff" : "#fff6d0";
  for (let i = 0; i < MOTE_COUNT; i++) {
    const phase = still ? (i * 0.11) % 1 : (time * (0.035 + (i % 3) * 0.01) + i * 0.37) % 1;
    const y = BEAM_TOP_Y + 4 + phase * (BEAM_BOTTOM_Y - BEAM_TOP_Y - 8);
    const [left, right] = beamEdges(y);
    const across = 0.5 + 0.42 * Math.sin(i * 2.1 + (still ? 0 : time * 0.5));
    if (!still && Math.sin(time * 1.3 + i * 1.7) < -0.55) continue;
    rect(ctx, color, left + 1 + across * (right - left - 2), y, 1, 1);
  }
};

const drawCandles = (ctx: Ctx, hall: HallLife, time: number, still: boolean) => {
  const flicker = still ? 0 : Math.floor(time * 8) % 2;
  const bright = hall.candle > 0.6;
  const flameX = CARD_TABLE.x + 7,
    flameY = CARD_TABLE.y - 4;
  rect(ctx, bright ? GOLD : "#c98a3a", flameX, flameY - flicker * (bright ? 1 : 0), 2, bright ? 2 : 1);
};

export const drawHallLifeLights = (ctx: Ctx, hall: HallLife, time: number, hour: number, still: boolean) => {
  drawBeam(ctx, hour);
  drawWindowGlass(ctx, time, hour, still);
  drawMotes(ctx, time, hour, still);
  drawCandles(ctx, hall, time, still);
};

// ---------------------------------------------------------------- entities (depth sorted with the characters)
const drawFlipped = (ctx: Ctx, sprite: HTMLCanvasElement, left: number, top: number, face: 1 | -1) => {
  if (face > 0) {
    ctx.drawImage(sprite, Math.round(left), Math.round(top));
    return;
  }
  ctx.save();
  ctx.translate(Math.round(left) + sprite.width, Math.round(top));
  ctx.scale(-1, 1);
  ctx.drawImage(sprite, 0, 0);
  ctx.restore();
};

/** three opaque "z" letters drifting up from a sleeper */
const drawZzz = (ctx: Ctx, x: number, y: number, time: number, still: boolean) => {
  const beat = still ? 0 : Math.floor(time * 1.5) % 3;
  for (let i = 0; i <= beat; i++) {
    const size = 1 + i;
    const zx = x + i * 3,
      zy = y - i * 4;
    rect(ctx, "#fff6d0", zx, zy, size + 1, 1);
    rect(ctx, "#fff6d0", zx, zy + size, size + 1, 1);
    rect(ctx, "#fff6d0", zx + size, zy + 1, 1, Math.max(1, size - 1));
  }
};

const CAT_POSE: Record<string, CatPose> = {
  nap: "nap",
  sit: "sit",
  walk: "walk",
  chase: "chase",
  scared: "scared",
};
const CAT_FPS: Record<string, number> = { nap: 0.7, sit: 0.9, walk: 6, chase: 10, scared: 5 };

const drawCat = (ctx: Ctx, hall: HallLife, time: number, still: boolean) => {
  const cat = hall.cat;
  const frame = still ? 0 : Math.floor(time * CAT_FPS[cat.mode]);
  const sprite = catSprite(CAT_POSE[cat.mode], frame);
  ctx.globalAlpha = 0.25;
  rect(ctx, INK, cat.x - 6, cat.y - 1, 12, 2);
  ctx.globalAlpha = 1;
  drawFlipped(ctx, sprite, cat.x - CAT_W / 2, cat.y - CAT_H + 2, cat.face);
  if (cat.asleep) drawZzz(ctx, cat.x + 4, cat.y - CAT_H + 1, time, still);
};

const drawDog = (ctx: Ctx, hall: HallLife, time: number, still: boolean) => {
  const awake = hall.dog.awake;
  const sprite = awake
    ? dogSprite("wag", still ? 0 : Math.floor(time * 6))
    : dogSprite("sleep", still ? 0 : Math.floor(time * 1.1));
  drawFlipped(ctx, sprite, DOG_POS.x - DOG_W / 2, DOG_POS.y - DOG_H + 1, 1);
  if (!awake && hall.quiet) drawZzz(ctx, DOG_POS.x + 6, DOG_POS.y - DOG_H, time, still);
};

const drawMouse = (ctx: Ctx, hall: HallLife, time: number) => {
  const mouse = hall.mouse;
  if (!mouse.visible) return;
  drawFlipped(ctx, mouseSprite(Math.floor(time * 12)), mouse.x - MOUSE_W / 2, mouse.y - MOUSE_H + 2, mouse.face);
};

const drawPatron = (ctx: Ctx, patron: Patron, index: number, time: number, still: boolean) => {
  const frame = still ? 0 : Math.floor(time * 1.4 + index);
  const sprite = patronSprite(patron.kind, patron.pose, frame);
  drawFlipped(ctx, sprite, patron.x - CH_W / 2, patron.y - CH_H, patron.face);
  const headX = patron.x,
    headY = patron.y - CH_H;
  if (patron.pose === "alert") {
    // opaque red "!" badge above the head
    rect(ctx, INK, headX - 3, headY - 11, 7, 10);
    rect(ctx, "#fffaf0", headX - 2, headY - 10, 5, 8);
    rect(ctx, "#d11a2a", headX, headY - 9, 1, 4);
    rect(ctx, "#d11a2a", headX, headY - 4, 1, 1);
  } else if (patron.pose === "toast" && !still) {
    const sparkle = Math.floor(time * 6 + index) % 2;
    rect(ctx, GOLD, headX + patron.face * 5 + sparkle * 2, headY - 1, 1, 1);
    rect(ctx, "#fff6d0", headX + patron.face * 4 - sparkle, headY - 3, 1, 1);
  }
};

export interface HallEntity {
  y: number;
  fn: () => void;
}

/** the animals and regulars, to be mixed into the scene's y-sorted entity list */
export const hallEntities = (ctx: Ctx, hall: HallLife, time: number, still: boolean): HallEntity[] => {
  const ents: HallEntity[] = [
    { y: DOG_POS.y, fn: () => drawDog(ctx, hall, time, still) },
    { y: hall.cat.y, fn: () => drawCat(ctx, hall, time, still) },
  ];
  if (hall.mouse.visible) ents.push({ y: hall.mouse.y, fn: () => drawMouse(ctx, hall, time) });
  hall.patrons.forEach((patron, index) =>
    ents.push({ y: patron.y, fn: () => drawPatron(ctx, patron, index, time, still) }),
  );
  return ents;
};
