import { MAX_HEARTS, type Employee, type Office } from "./engine";
import {
  BACK_WALL_H, BAR, BRIDGE_X, CH_H, CH_W, COUNTER_BOX, DESK_COUNT, DUNGEON, GATE_OPEN, H, HALL_W, HEARTH,
  NPC_POS, ROAD_Y, TORCHES, W, WALL_X0, spotOf, squirePoint, campSquirePoint, standSlot, CAMP_MAX,
} from "./layout";
import { lookFor } from "./palette";
import { bossSprite, butterflySprite, charSprite, internSprite, monsterSprite, prop, type Pose } from "./sprites";

type Ctx = CanvasRenderingContext2D;
const rect = (c: Ctx, col: string, x: number, y: number, w: number, h: number) => {
  c.fillStyle = col;
  c.fillRect(Math.round(x), Math.round(y), w, h);
};
const EMOJI_FONT = '7px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';
const TAG_FONT = '500 5.5px ui-sans-serif, system-ui, "Sukhumvit Set", "Noto Sans Thai", sans-serif';
const INK = "#1a1c2c";
const CREAM = "#fff6e0";
const GOLD = "#f2c14e";

// guild / environment colours
const ST = { mortar: "#3f4356", a: "#6f7487", b: "#656a7d", c: "#7a8094", hi: "#9aa0b4", dark: "#4a4f63" };
const WD = { dark: "#3b2418", mid: "#6e4a36", light: "#a8764a", top: "#d2a574", hi: "#e6c295" };
const FLOOR = ["#a8764a", "#9f6d43", "#b0804f", "#a06f45", "#98663e"];
const GRASS = { base: "#4f9a4a", a: "#5aa852", b: "#468c43", c: "#3f7f3d", hi: "#7ccb62" };
const DIRT = { base: "#b38a5a", a: "#a37a4d", b: "#c49a68", edge: "#7d5a34" };

function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const mk = () => {
  const cv = document.createElement("canvas");
  cv.width = W; cv.height = H;
  return { cv, c: cv.getContext("2d")! };
};
function roundRect(c: Ctx, x: number, y: number, w: number, h: number, r: number) {
  c.beginPath();
  c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
}
/** Draw a prop with bottom-centre anchored at (cx, by). */
function blitB(c: Ctx, name: string, cx: number, by: number) {
  const s = prop(name);
  c.drawImage(s, Math.round(cx - s.width / 2), Math.round(by - s.height));
}
/** Draw a prop centred at (cx, cy). */
function blitC(c: Ctx, name: string, cx: number, cy: number) {
  const s = prop(name);
  c.drawImage(s, Math.round(cx - s.width / 2), Math.round(cy - s.height / 2));
}
const shadow = (c: Ctx, x: number, y: number, w = 10) => {
  c.globalAlpha = 0.25;
  rect(c, INK, x - w / 2, y - 1, w, 2);
  c.globalAlpha = 1;
};

// ---------- static background ----------
let bg: HTMLCanvasElement | null = null;

function bricks(c: Ctx, x0: number, y0: number, w: number, h: number, seed: number, vertical = false) {
  c.save();
  c.beginPath(); c.rect(x0, y0, w, h); c.clip();
  rect(c, ST.mortar, x0, y0, w, h);
  const r = rng(seed);
  const tones = [ST.a, ST.b, ST.c];
  if (!vertical) {
    for (let y = y0, row = 0; y < y0 + h; y += 6, row++) {
      for (let x = x0 - (row % 2) * 6; x < x0 + w; x += 12) {
        rect(c, tones[(r() * 3) | 0], x + 1, y + 1, 11, 5);
        rect(c, ST.hi, x + 1, y + 1, 11, 1);
        c.globalAlpha = 0.25; rect(c, "#000", x + 1, y + 5, 11, 1); c.globalAlpha = 1;
      }
    }
  } else {
    for (let y = y0; y < y0 + h; y += 6) {
      const off = ((y - y0) / 6) % 2 ? 4 : 0;
      for (let x = x0 - off; x < x0 + w; x += 8) {
        rect(c, tones[(r() * 3) | 0], x + 1, y + 1, 7, 5);
        rect(c, ST.hi, x + 1, y + 1, 7, 1);
      }
    }
  }
  c.restore();
}

function drawBackdrop(c: Ctx) {
  // distant mountains + hills on the transparent sky window
  for (let x = HALL_W; x < W; x++) {
    const far = 44 - Math.round(10 * Math.abs(Math.sin(x * 0.021 + 0.8)) + 4 * Math.sin(x * 0.07));
    rect(c, "#7f93c4", x, far, 1, 52 - far);
    rect(c, "#a9b9de", x, far, 1, 1);
    if (x % 11 < 3) rect(c, "#9aabd4", x, far + 3, 1, 4);
    const near = 44 - Math.round(3 * Math.sin(x * 0.04 + 2) + 2 * Math.sin(x * 0.11));
    rect(c, "#3f7f4a", x, near, 1, 52 - near);
    rect(c, "#4f9a52", x, near + 1, 1, 1);
    if (x % 3 === 0) rect(c, "#2f6a3f", x, near - 1, 2, 2);
  }
}

function drawGrass(c: Ctx) {
  rect(c, GRASS.base, HALL_W, 48, W - HALL_W, H - 48);
  const r = rng(3);
  for (let i = 0; i < 46; i++) {
    c.globalAlpha = 0.28;
    rect(c, r() < 0.5 ? GRASS.a : GRASS.c, HALL_W + r() * (W - HALL_W - 24), 52 + r() * 160, 10 + ((r() * 16) | 0), 4 + ((r() * 5) | 0));
  }
  c.globalAlpha = 1;
  for (let i = 0; i < 640; i++) {
    const x = HALL_W + 1 + ((r() * (W - HALL_W - 4)) | 0), y = 50 + ((r() * 164) | 0);
    const k = r();
    if (k < 0.5) { rect(c, GRASS.c, x, y, 1, 2); rect(c, GRASS.b, x + 1, y + 1, 1, 1); }
    else if (k < 0.8) rect(c, GRASS.hi, x, y, 1, 1);
    else { rect(c, GRASS.b, x, y + 1, 3, 1); rect(c, GRASS.a, x + 1, y, 1, 1); }
  }
}

const streamY = (x: number) => 61 + Math.round(3 * Math.sin(x * 0.05));

function drawStream(c: Ctx) {
  const r = rng(21);
  for (let x = HALL_W; x < W; x++) {
    const yc = streamY(x);
    rect(c, "#d8c58a", x, yc - 6, 1, 1);
    rect(c, "#3a6a9a", x, yc - 5, 1, 1);
    rect(c, "#4a8ad0", x, yc - 4, 1, 8);
    rect(c, "#6aa8e8", x, yc - 3, 1, 2);
    rect(c, "#3a6a9a", x, yc + 4, 1, 1);
    rect(c, "#d8c58a", x, yc + 5, 1, 1);
    if (r() < 0.08) rect(c, "#cfe9ff", x, yc - 2 + ((r() * 5) | 0), 2, 1);
  }
  // bridge (north-south)
  const bx = BRIDGE_X;
  rect(c, "#5a3a26", bx - 7, 52, 14, 21);
  for (let y = 53; y < 72; y += 3) {
    rect(c, y % 6 === 2 ? WD.light : "#8f6040", bx - 6, y, 12, 3);
    rect(c, WD.top, bx - 6, y, 12, 1);
  }
  rect(c, "#3b2418", bx - 7, 52, 1, 21); rect(c, "#3b2418", bx + 6, 52, 1, 21);
  for (const py of [52, 62, 71]) { rect(c, WD.mid, bx - 8, py, 2, 3); rect(c, WD.mid, bx + 6, py, 2, 3); }
  // trail beyond the bridge
  for (let y = 73; y < 88; y++) {
    const half = 4 - ((y - 73) >> 2);
    c.globalAlpha = 0.9 - (y - 73) * 0.05;
    rect(c, DIRT.base, bx - half, y, half * 2, 1);
    c.globalAlpha = 1;
  }
}

function drawDungeon(c: Ctx) {
  const { x, y } = DUNGEON; // base-centre
  c.globalAlpha = 0.25; rect(c, "#000", x - 26, y, 52, 3); c.globalAlpha = 1;
  bricks(c, x - 24, y - 16, 48, 16, 33);
  // arch
  rect(c, "#2a2d3a", x - 10, y - 24, 20, 24);
  rect(c, "#2a2d3a", x - 8, y - 27, 16, 3);
  rect(c, "#14121f", x - 8, y - 22, 16, 22);
  rect(c, "#14121f", x - 6, y - 25, 12, 3);
  for (let i = 0; i < 3; i++) { rect(c, ST.c, x - 10 + i, y - 24 - (i === 0 ? 0 : 0), 1, 24); }
  rect(c, ST.hi, x - 8, y - 27, 16, 1);
  rect(c, GOLD, x - 1, y - 28, 3, 2);
  // stairs inside
  for (let i = 0; i < 4; i++) rect(c, i % 2 ? "#2b2540" : "#221d33", x - 6 + i, y - 4 - i * 1, 12 - i * 2, 1);
  // broken pillars
  for (const [px, ph] of [[-24, 26], [20, 16]] as const) {
    rect(c, ST.a, x + px, y - ph, 5, ph);
    rect(c, ST.hi, x + px, y - ph, 5, 1); rect(c, ST.dark, x + px + 4, y - ph, 1, ph);
    rect(c, ST.c, x + px - 1, y - 3, 7, 3);
    if (ph < 20) { rect(c, ST.b, x + px - 2, y - 3, 2, 3); rect(c, ST.b, x + px + 6, y - 2, 3, 2); }
  }
  // ivy
  c.globalAlpha = 0.8;
  for (let i = 0; i < 10; i++) rect(c, "#3f7f4a", x - 24 + ((i * 7) % 46), y - 16 + ((i * 5) % 9), 2, 2);
  c.globalAlpha = 1;
}

function drawRoad(c: Ctx) {
  const wob = (x: number, k: number) => Math.round(1.3 * Math.sin(x * 0.09 + k));
  // gate apron
  rect(c, DIRT.base, WALL_X0 - 2, GATE_OPEN.y0, 18, GATE_OPEN.y1 - GATE_OPEN.y0);
  for (let x = HALL_W; x < W; x++) {
    const t = ROAD_Y - 8 + wob(x, 0), b = ROAD_Y + 8 + wob(x, 2);
    rect(c, DIRT.edge, x, t - 1, 1, 1);
    rect(c, DIRT.base, x, t, 1, b - t);
    rect(c, DIRT.edge, x, b, 1, 1);
    if (x % 7 === 0) rect(c, DIRT.b, x, t + 2, 3, 1);
    if (x % 9 === 4) rect(c, DIRT.a, x, b - 3, 2, 1);
  }
  // branch to the camp area (overflow adventurers)
  for (let y = ROAD_Y; y < H; y++) {
    const l = 127 + wob(y, 1), rr = 141 + wob(y, 3);
    rect(c, DIRT.edge, l - 1, y, 1, 1);
    rect(c, DIRT.base, l, y, rr - l, 1);
    rect(c, DIRT.edge, rr, y, 1, 1);
    if (y % 8 === 0) rect(c, DIRT.b, l + 3, y, 3, 1);
  }
  // pebbles
  const r = rng(9);
  for (let i = 0; i < 40; i++) {
    const x = 128 + ((r() * 250) | 0), y = ROAD_Y - 6 + ((r() * 12) | 0);
    rect(c, r() < 0.5 ? "#8a6a42" : "#d6b583", x, y, 1, 1);
  }
  // battle patches
  for (let i = 0; i < DESK_COUNT; i++) {
    const s = spotOf(i), cx = s.x + 11, cy = s.y - 1;
    for (let dy = -7; dy <= 7; dy++) {
      const half = Math.round(28 * Math.sqrt(1 - (dy / 8) * (dy / 8)));
      c.globalAlpha = 0.6; rect(c, "#9c7a4a", cx - half, cy + dy, half * 2, 1);
      c.globalAlpha = 0.5; rect(c, DIRT.base, cx - half + 3, cy + dy, Math.max(0, half * 2 - 6), 1);
      c.globalAlpha = 1;
    }
    for (let k = 0; k < 6; k++) { rect(c, "#7d5a34", cx - 22 + ((k * 9 + i * 5) % 44), cy - 5 + ((k * 5 + i) % 10), 2, 1); }
  }
}

function drawHall(c: Ctx) {
  // wood floor
  c.save();
  c.beginPath(); c.rect(0, BACK_WALL_H, HALL_W, H - BACK_WALL_H); c.clip();
  const r = rng(7);
  let row = 0;
  for (let y = BACK_WALL_H; y < H; y += 8, row++) {
    let x = -((row * 13) % 32);
    while (x < HALL_W) {
      const len = 28 + ((r() * 3) | 0) * 8;
      const x0 = Math.max(0, x), x1 = Math.min(HALL_W, x + len);
      rect(c, FLOOR[(r() * 5) | 0], x0, y, x1 - x0, 8);
      c.globalAlpha = 0.16; rect(c, "#ffe6b4", x0, y, x1 - x0, 1);
      c.globalAlpha = 0.5; rect(c, "#6b4529", x0, y + 7, x1 - x0, 1);
      if (x >= 0) rect(c, "#6b4529", x, y, 1, 8);
      c.globalAlpha = 0.14;
      for (let g = 0; g < 3; g++) rect(c, "#4a2f20", x0 + 3 + ((r() * (len - 10)) | 0), y + 2 + ((r() * 4) | 0), 3 + ((r() * 4) | 0), 1);
      c.globalAlpha = 1;
      x += len;
    }
  }
  c.restore();
  for (let i = 0; i < 5; i++) { c.globalAlpha = 0.28 - i * 0.05; rect(c, "#000", 0, BACK_WALL_H + i, HALL_W, 1); }
  c.globalAlpha = 1;

  // back wall (stone) + baseboard
  bricks(c, 0, 0, HALL_W, BACK_WALL_H - 2, 11);
  rect(c, WD.dark, 0, BACK_WALL_H - 3, HALL_W, 3); rect(c, WD.mid, 0, BACK_WALL_H - 3, HALL_W, 1);
  // ceiling beam
  rect(c, WD.dark, 0, 0, HALL_W, 3); rect(c, WD.mid, 0, 3, HALL_W, 1);
  for (let x = 20; x < HALL_W; x += 40) { rect(c, WD.mid, x, 0, 5, 8); rect(c, WD.dark, x + 4, 0, 1, 8); }

  // side walls
  bricks(c, 0, BACK_WALL_H, 9, H - BACK_WALL_H, 12, true);
  rect(c, ST.hi, 8, BACK_WALL_H, 1, H - BACK_WALL_H);
  c.globalAlpha = 0.3; rect(c, "#000", 9, BACK_WALL_H, 2, H - BACK_WALL_H); c.globalAlpha = 1;
  // right wall with the gate opening
  const gy0 = GATE_OPEN.y0, gy1 = GATE_OPEN.y1;
  bricks(c, WALL_X0, BACK_WALL_H, HALL_W + 1 - WALL_X0, gy0 - BACK_WALL_H, 13, true);
  bricks(c, WALL_X0, gy1, HALL_W + 1 - WALL_X0, H - gy1, 14, true);
  rect(c, ST.hi, WALL_X0, BACK_WALL_H, 1, gy0 - BACK_WALL_H); rect(c, ST.hi, WALL_X0, gy1, 1, H - gy1);
  rect(c, "#aeb4c8", WALL_X0, gy1, HALL_W + 1 - WALL_X0, 2);
  rect(c, "#aeb4c8", WALL_X0, gy0 - 2, HALL_W + 1 - WALL_X0, 2);
  // tower pillar above the gate (back wall corner)
  bricks(c, WALL_X0 + 2, 0, HALL_W + 1 - WALL_X0 - 2, BACK_WALL_H, 15, true);
  rect(c, ST.dark, HALL_W - 1, 0, 2, BACK_WALL_H);
  // gate floor
  rect(c, DIRT.base, WALL_X0 - 3, gy0, 14, gy1 - gy0);
  rect(c, DIRT.a, WALL_X0 - 3, gy0, 14, 2);
  // lintel + portcullis
  rect(c, ST.dark, WALL_X0 - 2, gy0 - 8, 13, 8); rect(c, ST.hi, WALL_X0 - 2, gy0 - 8, 13, 1);
  rect(c, GOLD, WALL_X0 + 3, gy0 - 7, 3, 3);
  for (let x = WALL_X0 - 1; x < WALL_X0 + 10; x += 3) { rect(c, "#3b3f4f", x, gy0, 1, 7); rect(c, "#8d93a0", x, gy0 + 7, 1, 1); }
  rect(c, "#3b3f4f", WALL_X0 - 1, gy0 + 2, 10, 1);
  rect(c, ST.dark, WALL_X0 - 3, gy0 - 8, 1, gy1 - gy0 + 8);
  c.globalAlpha = 0.25; rect(c, "#000", WALL_X0 + 10, gy1, 6, 2); c.globalAlpha = 1;
}

function drawHallDecor(c: Ctx) {
  // rugs
  const rug = (x: number, y: number, w: number, h: number, base: string, trim: string) => {
    c.globalAlpha = 0.2; rect(c, "#000", x + 2, y + 2, w, h); c.globalAlpha = 1;
    rect(c, base, x, y, w, h);
    rect(c, trim, x + 1, y + 1, w - 2, 1); rect(c, trim, x + 1, y + h - 2, w - 2, 1);
    rect(c, trim, x + 1, y + 1, 1, h - 2); rect(c, trim, x + w - 2, y + 1, 1, h - 2);
    c.globalAlpha = 0.15; rect(c, "#fff", x + 4, y + 4, w - 8, h - 8); c.globalAlpha = 1;
  };
  rug(8, 166, 32, 22, "#8a2f3a", GOLD);
  rug(22, 54, 16, 114, "#8a2f3a", GOLD);
  for (let y = 62; y < 160; y += 14) { rect(c, GOLD, 28, y, 4, 1); rect(c, GOLD, 29, y - 1, 2, 3); }
  rug(80, 66, 38, 28, "#2f4f7f", "#d9c27a");
  rect(c, "#d9c27a", 96, 76, 6, 8); rect(c, "#2f4f7f", 97, 77, 4, 6); rect(c, "#d9c27a", 98, 79, 2, 2);

  // quest board
  rect(c, "#2a1810", 5, 5, 34, 42);
  rect(c, WD.mid, 6, 6, 32, 40); rect(c, WD.light, 6, 6, 32, 2);
  rect(c, "#b98a58", 8, 14, 28, 30);
  const rn = rng(5);
  c.globalAlpha = 0.25;
  for (let i = 0; i < 26; i++) rect(c, "#7b5236", 8 + ((rn() * 27) | 0), 14 + ((rn() * 29) | 0), 1, 1);
  c.globalAlpha = 1;
  rect(c, "#2a1810", 11, 8, 22, 5); rect(c, GOLD, 12, 9, 20, 3);
  for (let i = 0; i < 6; i++) rect(c, "#8a5a1a", 14 + i * 3, 10, 2, 1);
  rect(c, WD.dark, 6, 44, 32, 2);
  // legs / posts
  rect(c, WD.dark, 8, 46, 3, 6); rect(c, WD.dark, 33, 46, 3, 6);
  for (const [nx, ny] of [[14, 22], [24, 21], [32, 23], [15, 34], [25, 35], [32, 36]] as const) {
    blitC(c, "quest_note", nx, ny);
    rect(c, "#d95763", nx - 1, ny - 4, 1, 1);
  }

  // hearth
  const hx = HEARTH.x;
  bricks(c, hx - 2, 14, HEARTH.w + 4, 38, 17);
  rect(c, WD.dark, hx - 4, 11, HEARTH.w + 8, 4); rect(c, WD.top, hx - 4, 11, HEARTH.w + 8, 1); rect(c, WD.mid, hx - 4, 14, HEARTH.w + 8, 1);
  rect(c, "#14100c", hx + 3, 24, 16, 28);
  rect(c, "#2a1810", hx + 3, 24, 16, 2);
  rect(c, "#4a2f20", hx + 5, 47, 12, 3); rect(c, "#6e4a36", hx + 4, 49, 14, 3);
  rect(c, "#8a8f9c", hx - 4, 50, HEARTH.w + 8, 3); rect(c, "#b0b6c4", hx - 4, 50, HEARTH.w + 8, 1);
  // crossed swords over the mantle
  rect(c, "#c8ced8", hx + 4, 4, 1, 6); rect(c, "#c8ced8", hx + 17, 4, 1, 6);
  rect(c, "#d9a441", hx + 2, 9, 5, 1); rect(c, "#d9a441", hx + 15, 9, 5, 1);
  rect(c, "#c8ced8", hx + 6, 5, 10, 1); rect(c, "#8d93a0", hx + 6, 6, 10, 1);

  // torch brackets
  for (const t of TORCHES.slice(0, 4)) { rect(c, "#2a2d3a", t.x - 2, t.y - 1, 5, 3); rect(c, "#6e7585", t.x - 1, t.y - 1, 3, 1); }
  for (const t of TORCHES.slice(4)) { rect(c, "#2a2d3a", t.x - 2, t.y, 5, 2); }

  // shelves behind the receptionist
  const bk = ["#d95763", "#4a6fa5", "#f2c14e", "#5fa55a", "#7b5ea7", "#e8c9a0", "#2b3a67"];
  for (const sy of [20, 32]) {
    const r2 = rng(sy);
    let bx = 81;
    while (bx < 115) {
      const w = 2 + ((r2() * 2) | 0), h = 5 + ((r2() * 4) | 0);
      if (bx + w > 115) break;
      if (r2() < 0.45) { // potion bottle
        const col = bk[(r2() * bk.length) | 0];
        rect(c, col, bx, sy - 5, 3, 4); rect(c, "#e9f3f7", bx + 1, sy - 7, 1, 2); rect(c, "#fff", bx, sy - 5, 1, 1);
        bx += 4;
      } else {
        rect(c, bk[(r2() * bk.length) | 0], bx, sy - h, w, h); rect(c, "#fff", bx, sy - h, w, 1);
        bx += w;
      }
    }
    rect(c, WD.mid, 79, sy, 38, 2); rect(c, WD.top, 79, sy, 38, 1);
  }

  // counter
  const cb = COUNTER_BOX;
  c.globalAlpha = 0.22; rect(c, "#000", cb.x + 2, cb.y + cb.h, cb.w, 3); c.globalAlpha = 1;
  rect(c, WD.dark, cb.x, cb.y, cb.w, cb.h);
  rect(c, "#c89a62", cb.x, cb.y, cb.w, 6); rect(c, "#e3bd86", cb.x, cb.y, cb.w, 1);
  rect(c, WD.mid, cb.x + 1, cb.y + 7, cb.w - 2, cb.h - 8);
  for (let x = cb.x + 3; x < cb.x + cb.w - 8; x += 12) { rect(c, "#8f6040", x, cb.y + 9, 10, 7); rect(c, "#a8764a", x + 1, cb.y + 10, 8, 5); }
  rect(c, GOLD, cb.x, cb.y + 6, cb.w, 1);
  // ledger, bell, candle
  rect(c, "#f6ecd2", 82, 42, 9, 4); rect(c, "#8a6a42", 82, 45, 9, 1); rect(c, "#3b2f3f", 84, 43, 5, 1);
  rect(c, "#d9a441", 107, 43, 4, 3); rect(c, "#f6d88a", 108, 42, 2, 1);
  rect(c, "#f5efe0", 113, 42, 2, 4);

  // weapon rack
  rect(c, WD.mid, 12, 94, 16, 3); rect(c, WD.mid, 12, 108, 16, 3); rect(c, WD.dark, 11, 94, 2, 20); rect(c, WD.dark, 27, 94, 2, 20);
  for (let i = 0; i < 4; i++) { rect(c, "#c8ced8", 15 + i * 3, 86, 1, 22); rect(c, "#8d93a0", 16 + i * 3, 88, 1, 20); rect(c, "#d9a441", 14 + i * 3, 104, 3, 1); }
  rect(c, "#4a6fa5", 11, 112, 5, 4); rect(c, "#d95763", 24, 112, 5, 4); // shields
  c.globalAlpha = 0.2; rect(c, "#000", 11, 116, 18, 2); c.globalAlpha = 1;

  // tables with stools
  for (const [tx, ty] of [[58, 138], [58, 186]] as const) {
    c.globalAlpha = 0.22; rect(c, "#000", tx - 11, ty + 5, 24, 3); c.globalAlpha = 1;
    rect(c, WD.dark, tx - 3, ty + 2, 6, 6);
    rect(c, WD.mid, tx - 11, ty - 4, 22, 9); rect(c, WD.mid, tx - 9, ty - 6, 18, 13);
    rect(c, WD.light, tx - 10, ty - 4, 20, 8); rect(c, WD.light, tx - 8, ty - 5, 16, 10);
    rect(c, WD.top, tx - 8, ty - 5, 16, 1);
    for (const sx of [-16, 14]) { rect(c, WD.dark, tx + sx, ty - 1, 5, 6); rect(c, "#8a3f3a", tx + sx, ty - 2, 5, 3); rect(c, "#a5504a", tx + sx, ty - 2, 5, 1); }
    rect(c, "#f5efe0", tx - 5, ty - 3, 3, 3); rect(c, "#d9a441", tx - 2, ty - 2, 1, 1);
    rect(c, "#e8c9a0", tx + 3, ty - 3, 3, 3); rect(c, "#f6ecd2", tx + 3, ty - 3, 3, 1);
    rect(c, "#f5efe0", tx + 1, ty - 6, 1, 3);
  }
  blitB(c, "barrel", 14, 138); blitB(c, "barrel", 14, 150); blitB(c, "barrel", 21, 144);

  // tavern bar (along the right wall, patrons stand on its left)
  const b = BAR;
  c.globalAlpha = 0.22; rect(c, "#000", b.x - 3, b.y + 3, 3, b.h); c.globalAlpha = 1;
  rect(c, WD.dark, b.x - 3, b.y - 2, b.w + 3, b.h + 8);
  rect(c, WD.mid, b.x - 2, b.y - 1, 2, b.h + 6);
  rect(c, WD.light, b.x, b.y - 1, b.w, b.h + 2); rect(c, WD.top, b.x + 1, b.y, b.w - 2, b.h);
  rect(c, WD.hi, b.x, b.y - 1, b.w, 1); rect(c, WD.hi, b.x, b.y - 1, 1, b.h);
  for (let y = b.y + 6; y < b.y + b.h; y += 11) { c.globalAlpha = 0.16; rect(c, "#5a3a26", b.x + 3, y, b.w - 6, 1); c.globalAlpha = 1; }
  rect(c, WD.dark, b.x - 3, b.y + b.h + 5, b.w + 3, 2);
  blitC(c, "ale", b.x + 5, b.y + 12); blitC(c, "ale", b.x + 12, b.y + 24);
  blitC(c, "ale", b.x + 6, b.y + 38); blitC(c, "ale", b.x + 12, b.y + 46);
  blitB(c, "barrel", b.x + 10, b.y - 2);
  blitB(c, "barrel", 108, H - 2); blitB(c, "barrel", 100, H - 1);
  // hanging tavern sign on the back wall
  rect(c, WD.dark, 119, 6, 1, 6); rect(c, WD.mid, 108, 12, 14, 8); rect(c, WD.light, 109, 13, 12, 6);
  rect(c, "#f5efe0", 112, 14, 5, 4); rect(c, GOLD, 113, 14, 3, 1); rect(c, "#f5efe0", 117, 15, 1, 2);

  // door (left wall)
  rect(c, ST.dark, 0, 152, 10, 4);
  rect(c, "#2a1810", 0, 156, 9, 40);
  rect(c, WD.mid, 0, 157, 8, 38);
  for (let y = 158; y < 194; y += 6) { rect(c, WD.light, 0, y, 8, 5); rect(c, WD.top, 0, y, 8, 1); }
  rect(c, "#2a2d3a", 0, 163, 8, 2); rect(c, "#2a2d3a", 0, 183, 8, 2);
  rect(c, GOLD, 6, 176, 2, 2);
  c.globalAlpha = 0.3; rect(c, "#000", 8, 156, 2, 40); c.globalAlpha = 1;
  // welcome light on floor by the door
  c.globalAlpha = 0.12; rect(c, "#ffe6b4", 9, 160, 7, 32); c.globalAlpha = 1;
}

function drawWildDecor(c: Ctx) {
  // shadow of the hall wall
  c.globalAlpha = 0.25; rect(c, "#000", HALL_W + 1, 52, 4, H - 52); c.globalAlpha = 0.12; rect(c, "#000", HALL_W + 5, 52, 3, H - 52); c.globalAlpha = 1;
  const items: { n: string; x: number; y: number }[] = [];
  const add = (n: string, x: number, y: number) => items.push({ n, x, y });
  for (const [x, y] of [[152, 80], [206, 78], [262, 80], [312, 78], [374, 84], [140, 62]] as const) add("tree", x, y);
  for (const [x, y] of [[378, 214], [330, 215], [268, 214], [214, 215], [150, 214]] as const) add("tree", x, y);
  add("sign", 142, 112);
  add("rock", 154, 150); add("rock", 380, 150);
  add("bush", 190, 148); add("bush", 262, 146); add("bush", 330, 148); add("bush", 372, 128);
  // scatter
  const r = rng(77);
  const free = (x: number, y: number) => {
    if (y > ROAD_Y - 12 && y < ROAD_Y + 12) return false;
    if (x < 146 && y > 112) return false;
    if (y < 78 || y > 212) return false;
    for (let i = 0; i < DESK_COUNT; i++) {
      const s = spotOf(i);
      if (x > s.x - 30 && x < s.x + 44 && y > s.y - 30 && y < s.y + 8) return false;
    }
    if (y > 192 && x < 372) return false;
    return true;
  };
  for (let i = 0, n = 0; i < 200 && n < 46; i++) {
    const x = 146 + ((r() * 234) | 0), y = 80 + ((r() * 132) | 0);
    if (!free(x, y)) continue;
    const k = r();
    add(k < 0.6 ? "flower" : k < 0.82 ? "bush" : "rock", x, y);
    n++;
  }
  items.sort((a, b) => a.y - b.y);
  for (const it of items) {
    const s = prop(it.n);
    c.globalAlpha = 0.22; rect(c, "#000", it.x - s.width / 2 + 1, it.y - 1, s.width - 1, 2); c.globalAlpha = 1;
    blitB(c, it.n, it.x, it.y);
  }
  // gate torch posts on the wilderness side (stone braziers)
  for (const t of TORCHES.slice(2, 4)) { rect(c, ST.dark, t.x - 3, t.y, 7, 3); rect(c, ST.hi, t.x - 3, t.y, 7, 1); }
}

function buildBg(): HTMLCanvasElement {
  const { cv, c } = mk();
  drawBackdrop(c);
  drawGrass(c);
  drawStream(c);
  drawDungeon(c);
  drawRoad(c);
  drawHall(c);
  drawHallDecor(c);
  drawWildDecor(c);
  return cv;
}

// ---------- lighting layer (cached per quarter hour) ----------
let lightKey = -1;
let overlay: HTMLCanvasElement | null = null;

function nightness(hr: number): number {
  if (hr >= 19 || hr < 5) return 1;
  if (hr < 6.5) return (6.5 - hr) / 1.5;
  if (hr >= 17.5) return (hr - 17.5) / 1.5;
  return 0;
}

function buildLighting(hr: number) {
  const o = mk(); const d = o.c;
  const night = nightness(hr);
  if (hr >= 16 && hr < 19.5) {
    d.globalAlpha = Math.min(0.12, Math.max(0, 1 - Math.abs(hr - 17.8) / 1.7) * 0.12);
    rect(d, "#ff9a4a", 0, 0, W, H); d.globalAlpha = 1;
  }
  if (night > 0) {
    d.fillStyle = `rgba(18,22,66,${0.2 * night})`; d.fillRect(0, 0, HALL_W, H);
    d.fillStyle = `rgba(10,16,58,${0.5 * night})`; d.fillRect(HALL_W, 0, W - HALL_W, H);
    const pools: [number, number, number][] = [
      [42, 28, 44], [73, 28, 44], [58, 44, 66], [98, 40, 44], [105, 170, 64], [58, 138, 34], [58, 186, 34], [30, 60, 34],
      [122, 94, 46], [122, 152, 46], [340, 46, 46], [140, 124, 40],
    ];
    d.globalCompositeOperation = "destination-out";
    for (const [lx, ly, r] of pools) {
      const g = d.createRadialGradient(lx, ly, 0, lx, ly, r);
      g.addColorStop(0, `rgba(0,0,0,${0.6 * night})`); g.addColorStop(1, "rgba(0,0,0,0)");
      d.fillStyle = g; d.fillRect(lx - r, ly - r, r * 2, r * 2);
    }
    d.globalCompositeOperation = "source-over";
    for (const [lx, ly, r] of pools) {
      const g = d.createRadialGradient(lx, ly, 0, lx, ly, r);
      g.addColorStop(0, `rgba(255,190,90,${0.22 * night})`); g.addColorStop(1, "rgba(255,190,90,0)");
      d.fillStyle = g; d.fillRect(lx - r, ly - r, r * 2, r * 2);
    }
  }
  const v = d.createRadialGradient(W / 2, H / 2 + 10, 100, W / 2, H / 2 + 10, 250);
  v.addColorStop(0, "rgba(30,20,10,0)"); v.addColorStop(1, "rgba(30,20,10,0.25)");
  d.fillStyle = v; d.fillRect(0, 0, W, H);
  overlay = o.cv;
}

// ---------- sky ----------
function lerpCol(a: string, b: string, t: number): string {
  const p = (s: string, i: number) => parseInt(s.slice(1 + i * 2, 3 + i * 2), 16);
  const m = (i: number) => Math.round(p(a, i) + (p(b, i) - p(a, i)) * t);
  return `rgb(${m(0)},${m(1)},${m(2)})`;
}
const SKY_KEYS: [number, string, string][] = [
  [0, "#0b1030", "#1f2c63"], [5, "#0b1030", "#1f2c63"], [6.5, "#6a6fb5", "#ffb27a"], [8, "#59b0ee", "#bfe8ff"],
  [16.5, "#59b0ee", "#bfe8ff"], [18, "#4f4a94", "#ff8f5c"], [19.5, "#0b1030", "#1f2c63"], [24, "#0b1030", "#1f2c63"],
];
function skyAt(hr: number): [string, string] {
  for (let i = 1; i < SKY_KEYS.length; i++) {
    const a = SKY_KEYS[i - 1], b = SKY_KEYS[i];
    if (hr <= b[0]) {
      const t = (hr - a[0]) / (b[0] - a[0] || 1);
      // lerpCol returns rgb(); keep hex interpolation for chaining
      const hex = (x: string, y: string) => {
        const p = (s: string, k: number) => parseInt(s.slice(1 + k * 2, 3 + k * 2), 16);
        const m = (k: number) => Math.round(p(x, k) + (p(y, k) - p(x, k)) * t).toString(16).padStart(2, "0");
        return `#${m(0)}${m(1)}${m(2)}`;
      };
      return [hex(a[1], b[1]), hex(a[2], b[2])];
    }
  }
  return ["#0b1030", "#1f2c63"];
}

function drawSky(c: Ctx, t: number, hr: number) {
  c.save();
  c.beginPath(); c.rect(HALL_W, 0, W - HALL_W, 52); c.clip();
  const [top, bot] = skyAt(hr);
  for (let b = 0; b < 13; b++) rect(c, lerpCol(top, bot, b / 12), HALL_W, b * 4, W - HALL_W, 4);
  const night = nightness(hr);
  if (night > 0.2) {
    for (let s = 0; s < 22; s++) {
      const sx = HALL_W + 6 + ((s * 37 + 11) % 246), sy = 3 + ((s * 17) % 26);
      c.globalAlpha = night * (0.4 + 0.6 * Math.abs(Math.sin(t * 1.8 + s * 1.3)));
      rect(c, "#ffffff", sx, sy, 1, 1);
    }
    c.globalAlpha = 1;
  }
  if (night < 0.9) { // sun
    const u = Math.min(1, Math.max(0, (hr - 6) / 12));
    const sx = HALL_W + 14 + u * 230, sy = 38 - Math.sin(u * Math.PI) * 30;
    c.globalAlpha = 1 - night;
    rect(c, "#fff3b0", sx - 3, sy - 2, 7, 5); rect(c, "#fff3b0", sx - 2, sy - 3, 5, 7); rect(c, "#ffd96a", sx - 2, sy - 2, 5, 5);
    c.globalAlpha = 1;
  }
  if (night > 0.3) { // moon
    const u = hr >= 18 ? (hr - 18) / 12 : (hr + 6) / 12;
    const mx = HALL_W + 14 + Math.min(1, u) * 230, my = 32 - Math.sin(Math.min(1, u) * Math.PI) * 22;
    c.globalAlpha = night;
    rect(c, "#f4f0d8", mx - 3, my - 3, 7, 7); rect(c, "#f4f0d8", mx - 4, my - 2, 9, 5);
    rect(c, "#d6d0b0", mx, my - 1, 2, 2);
    c.globalAlpha = 1;
  }
  const cloudA = 0.95 - night * 0.75;
  c.globalAlpha = cloudA;
  for (let k = 0; k < 3; k++) {
    const cx = HALL_W + ((t * 2.2 + k * 94) % 300) - 24, cy = 8 + k * 7;
    rect(c, "#ffffff", cx, cy, 16, 4); rect(c, "#ffffff", cx + 3, cy - 2, 9, 3);
    c.globalAlpha = cloudA * 0.35; rect(c, "#9aa8d0", cx, cy + 3, 16, 1); c.globalAlpha = cloudA;
  }
  c.globalAlpha = 1;
  c.restore();
}

// ---------- animated environment ----------
function drawEnvAnim(c: Ctx, t: number) {
  // stream shimmer
  for (let k = 0; k < 12; k++) {
    const x = HALL_W + 6 + ((k * 61 + Math.floor(t * 6) * 3) % 246);
    c.globalAlpha = 0.35 + 0.35 * Math.sin(t * 4 + k * 2.1);
    rect(c, "#e8f6ff", x, streamY(x) - 3 + (k % 5), 3, 1);
  }
  c.globalAlpha = 1;
}

// emissive things drawn after the night overlay
function drawLights(c: Ctx, t: number) {
  // fireplace
  const hx = HEARTH.x + 5;
  for (let i = 0; i < 6; i++) {
    const h = 5 + Math.round(3 * Math.abs(Math.sin(t * 7 + i * 1.9)) + (i === 2 || i === 3 ? 4 : 0));
    rect(c, "#e8742a", hx + i * 2, 47 - h, 3, h);
    rect(c, GOLD, hx + 1 + i * 2, 47 - h + 3, 1, Math.max(1, h - 3));
  }
  rect(c, "#d95763", hx, 45, 12, 2);
  if (Math.floor(t * 5) % 3 === 0) rect(c, GOLD, hx + 2 + ((Math.floor(t * 9) * 5) % 9), 36 - (Math.floor(t * 9) % 4), 1, 1);
  // candle on the counter
  rect(c, GOLD, 113, 40 + (Math.floor(t * 8) % 2), 2, 2);
  // wall + gate torches
  TORCHES.forEach((p, i) => blitB(c, "torch" + ((Math.floor(t * 6) + i) % 2), p.x, p.y));
  // dungeon glow
  c.globalAlpha = 0.25 + 0.15 * Math.sin(t * 2);
  rect(c, "#7b5ea7", DUNGEON.x - 6, DUNGEON.y - 18, 12, 16);
  c.globalAlpha = 1;
}

// ---------- juice helpers ----------
const tintCache = new Map<string, WeakMap<HTMLCanvasElement, HTMLCanvasElement>>();
function tinted(src: HTMLCanvasElement, col: string): HTMLCanvasElement {
  let m = tintCache.get(col);
  if (!m) { m = new WeakMap(); tintCache.set(col, m); }
  let t = m.get(src);
  if (t) return t;
  t = document.createElement("canvas");
  t.width = src.width; t.height = src.height;
  const g = t.getContext("2d")!;
  g.drawImage(src, 0, 0);
  g.globalCompositeOperation = "source-in";
  g.fillStyle = col; g.fillRect(0, 0, t.width, t.height);
  m.set(src, t);
  return t;
}
/** hit-stop: the struck pair's animation clock freezes for ~60ms */
const ts = (e: Employee, t: number) => (e.hsUntil > t ? e.hsAt : t);

function hpBar(c: Ctx, cx: number, y: number, w: number, h: number, frac: number) {
  const f = Math.max(0, Math.min(1, frac));
  rect(c, INK, cx - w / 2 - 1, y - 1, w + 2, h + 2);
  rect(c, "#5a1f2a", cx - w / 2, y, w, h);
  const fw = f > 0 ? Math.max(1, Math.round(w * f)) : 0;
  rect(c, f > 0.5 ? "#6fd36a" : f > 0.25 ? "#f2c14e" : "#ff5a5a", cx - w / 2, y, fw, h);
}

const WORLD_FONT = '600 6.5px ui-sans-serif, system-ui, "Sukhumvit Set", "Noto Sans Thai", "Apple Color Emoji", "Segoe UI Emoji", sans-serif';
const eob = (x: number) => { const a = 1.70158, b = a + 1, k = x - 1; return 1 + b * k * k * k + a * k * k; };

function outlined(c: Ctx, text: string, x: number, y: number, fill: string) {
  c.lineJoin = "round"; c.lineWidth = 1.4; c.strokeStyle = INK;
  c.strokeText(text, x, y);
  c.fillStyle = fill; c.fillText(text, x, y);
}

function drawParticles(c: Ctx, o: Office) {
  for (const p of o.particles) {
    if (!p.on) continue;
    const u = p.age / p.life;
    c.globalAlpha = u > 0.65 ? Math.max(0, (1 - u) / 0.35) : 1;
    if (p.spr) blitC(c, p.spr, p.x, p.y);
    else rect(c, p.col, p.x, p.y, p.size, p.size);
  }
  c.globalAlpha = 1;
}

function drawPopups(c: Ctx, o: Office) {
  c.textAlign = "center"; c.textBaseline = "middle";
  for (const p of o.popups) {
    const u = Math.max(0, Math.min(1, (o.clock - p.born) / p.dur));
    const y = p.y - 12 * eob(Math.min(1, u * 1.6));
    c.globalAlpha = u > 0.7 ? Math.max(0, (1 - u) / 0.3) : 1;
    c.font = p.big ? '800 9px ui-sans-serif, system-ui, sans-serif' : '700 6.5px ui-sans-serif, system-ui, sans-serif';
    const x = Math.round(p.x);
    outlined(c, p.text, x, Math.round(y), p.col);
    if (p.star) blitC(c, "crit", x - Math.ceil(c.measureText(p.text).width / 2) - 4, y);
  }
  c.globalAlpha = 1;
}

function drawBannerQ(c: Ctx, o: Office) {
  const b = o.banners[0];
  if (!b) return;
  if (b.start < 0) b.start = o.realTime;
  const el = o.realTime - b.start;
  const slide = Math.min(1, el / 0.25, Math.max(0, (b.dur - el) / 0.25));
  const boss = b.kind === "boss";
  c.font = boss ? '800 8px ui-sans-serif, system-ui, sans-serif' : WORLD_FONT;
  const w = Math.ceil(c.measureText(b.text).width) + 22, h = 15;
  const x = Math.round((W - w) / 2), y = Math.round(-h - 2 + (h + 8) * eob(Math.max(0, slide)));
  rect(c, "rgba(0,0,0,0.3)", x + 1, y + 2, w, h);
  rect(c, INK, x - 3, y - 1, w + 6, h + 2);
  rect(c, boss ? "#5a1a22" : "#ecd9a2", x, y, w, h);
  rect(c, boss ? "#8a2a34" : "#f6e8bf", x, y, w, 2);
  rect(c, boss ? "#3a0f16" : "#c9a45e", x - 2, y, 3, h); rect(c, boss ? "#3a0f16" : "#c9a45e", x + w - 1, y, 3, h);
  c.textAlign = "center"; c.textBaseline = "middle";
  c.fillStyle = boss ? "#ffdede" : "#3b2418";
  c.fillText(b.text, W / 2, y + h / 2 + 0.5);
}

let vignette: HTMLCanvasElement | null = null;
const VIG_EDGE = 10;
function drawAlertVignette(c: Ctx, o: Office) {
  let age = Infinity; // age of the freshest alert: a long-standing one calms down
  for (const e of o.employees.values()) {
    // hidden (filtered) waiting sessions still raise the alert
    if (e.state === "SEATED" && e.act === "handup") age = Math.min(age, o.clock - e.actSince);
    for (const it of e.interns.values()) if (it.act === "handup") age = Math.min(age, o.clock - it.since);
  }
  if (age === Infinity) return;
  if (!vignette) {
    // edge-only ring (never reaches further than VIG_EDGE px in), so it can't tint characters
    const m = mk(); vignette = m.cv;
    for (let i = 0; i < VIG_EDGE; i++) {
      m.c.fillStyle = `rgba(255,30,30,${(0.85 * (1 - i / VIG_EDGE) ** 2).toFixed(3)})`;
      m.c.fillRect(i, i, W - 2 * i, 1); m.c.fillRect(i, H - 1 - i, W - 2 * i, 1);
      m.c.fillRect(i, i + 1, 1, H - 2 * i - 2); m.c.fillRect(W - 1 - i, i + 1, 1, H - 2 * i - 2);
    }
  }
  const calm = age > 60;
  c.globalAlpha = calm ? 0.2 + 0.1 * Math.sin(o.realTime * 1.5) : 0.4 + 0.3 * Math.sin(o.realTime * 5);
  c.drawImage(vignette, 0, 0);
  c.globalAlpha = 1;
}

// rain: fixed pseudo-random drops, positions derived from time (no per-frame allocation)
const DROPS = (() => { const r = rng(77); return Array.from({ length: 110 }, () => ({ x: r() * W, y: r() * H, v: 110 + r() * 60 })); })();
function drawRain(c: Ctx, o: Office) {
  const n = Math.min(DROPS.length, Math.round(DROPS.length * o.rain));
  if (n <= 0) return;
  c.strokeStyle = "rgba(200,222,255,0.6)"; c.lineWidth = 1;
  c.beginPath();
  for (let i = 0; i < n; i++) {
    const d = DROPS[i];
    const y = (d.y + o.ambT * d.v) % (H + 12) - 6;
    const x = (d.x + o.ambT * d.v * 0.3) % W;
    if (x < HALL_W - 2) continue; // the guild hall has a roof
    const px = Math.round(x), py = Math.round(y);
    c.moveTo(px, py); c.lineTo(px - 2, py + 5);
  }
  c.stroke();
}

// ---------- squires ----------
function drawBadge(c: Ctx, txt: string, x: number, y: number) {
  c.font = TAG_FONT; c.textBaseline = "middle"; c.textAlign = "center";
  const w = Math.ceil(c.measureText(txt).width) + 4;
  c.fillStyle = "rgba(35,37,58,0.92)"; roundRect(c, x - w / 2, y - 6, w, 7, 2); c.fill();
  c.fillStyle = CREAM; c.fillText(txt, x, y - 2.3);
}

function drawSquire(c: Ctx, e: Employee, it: Employee["interns"] extends Map<string, infer V> ? V : never, k: number, t: number) {
  const s = e.deskIdx >= 0 ? squirePoint(e.deskIdx, k) : campSquirePoint(e.slot, k);
  shadow(c, s.x, s.y, 8);
  let spr: HTMLCanvasElement;
  let dx = 0;
  if (it.act === "typing") {
    const f = Math.floor(t * 6) % 2;
    spr = internSprite("attack", f); dx = f ? 2 : 0;
  } else if (it.act === "reading") spr = internSprite("read", Math.floor(t * 3) % 2);
  else if (it.act === "handup") spr = internSprite("hand_up", Math.floor(t * 4) % 2);
  else spr = internSprite("idle", Math.floor(t * 1.5 + k) % 2);
  c.drawImage(spr, Math.round(s.x - spr.width / 2 + dx), Math.round(s.y - spr.height));
  const top = s.y - spr.height;
  if (it.act === "handup") { if (Math.floor(t * 4) % 2 === 0) drawBubble(c, s.x, top, "❗"); }
  else if (it.act === "reading") drawBubble(c, s.x, top, "📜");
  else if (it.act === "typing") drawBubble(c, s.x, top, "⚔️");
}

// ---------- adventurers ----------
function poseFor(e: Employee, t: number): { pose: Pose; frame: number } {
  switch (e.state) {
    case "ENTERING": case "LEAVING": case "TO_COFFEE": case "FROM_COFFEE":
      if (e.holdUntil > t) return e.state === "LEAVING" ? { pose: "cheer", frame: Math.floor(t * 4) % 2 } : { pose: "idle", frame: 0 };
      return { pose: "walk", frame: Math.floor(t * 8) % 4 };
    case "STRETCH": return { pose: "cheer", frame: Math.floor(t * 3) % 2 };
    case "DRINK": return { pose: "drink", frame: Math.floor(t * 1.5) % 2 };
  }
  if (e.resting) return { pose: "rest", frame: Math.floor(t * 1.2) % 2 };
  if (e.hurtUntil > t) return { pose: "hurt", frame: Math.floor(t * 10) % 2 };
  const hasMon = !!e.monPos && !e.monDead;
  switch (e.act) {
    case "typing": case "mcp": return { pose: hasMon || e.act === "mcp" ? "cast" : "idle", frame: Math.floor(t * 8) % 2 };
    case "bash": return { pose: hasMon ? "attack" : "idle", frame: Math.floor(t * 5) % 2 };
    case "reading": return { pose: "read", frame: Math.floor(t * 3) % 2 };
    case "sticky": return { pose: "write", frame: Math.floor(t * 6) % 2 };
    case "handup": return { pose: "hand_up", frame: Math.floor(t * 4) % 2 };
    case "phone": return { pose: "idle", frame: Math.floor(t * 1.5) % 2 };
    default: return { pose: "idle", frame: Math.floor(t * 1.5) % 2 };
  }
}

function drawAdventurer(c: Ctx, e: Employee, t: number) {
  const { pose, frame } = poseFor(e, t);
  const spr = charSprite(e.look, pose, frame);
  shadow(c, e.x, e.y, 11);
  const hurt = e.state === "SEATED" && e.hurtUntil > t;
  if (hurt) { // red flash behind the (opaque) sprite
    c.globalAlpha = 0.18 + 0.22 * Math.abs(Math.sin(t * 16));
    c.fillStyle = "#ff3b3b"; c.beginPath(); c.arc(e.x, e.y - 12, 13, 0, Math.PI * 2); c.fill();
    c.globalAlpha = 1;
  }
  const bob = pose === "walk" && frame % 2 === 1 ? -1 : 0;
  let dx = 0;
  const fighting = e.state === "SEATED" && e.deskIdx >= 0 && !e.resting;
  if (e.state === "SEATED" && pose === "attack" && frame === 1) dx = 3;
  if (fighting && e.windupUntil > t) dx = -2; // anticipation: lean back before the strike
  if (fighting && e.lungeUntil > t) dx = 3;
  if (hurt) dx = -2;
  const px = Math.round(e.x - CH_W / 2 + dx), py = Math.round(e.y - CH_H + bob);
  const red = e.redUntil > t && e.state === "SEATED";
  const put = (img: HTMLCanvasElement, a: number) => {
    c.globalAlpha = a;
    if (e.facing < 0) { c.save(); c.translate(px + CH_W, py); c.scale(-1, 1); c.drawImage(img, 0, 0); c.restore(); }
    else c.drawImage(img, px, py);
    c.globalAlpha = 1;
  };
  put(spr, 1);
  if (red) put(tinted(spr, "#ff2a2a"), 0.4 + 0.2 * Math.sin(t * 40));
}

function drawMonster(c: Ctx, e: Employee, t: number) {
  const p = e.monPos;
  if (!p) return;
  if (!e.monDead) {
    const age = t - e.monAppearAt;
    if (age < 0.5) blitC(c, "poof" + (Math.floor(age * 8) % 2), p.x, p.y - 8);
    if (age < 0.2) return;
    const seated = e.state === "SEATED";
    const asleep = e.resting;
    const hit = seated && !asleep && ((e.act === "bash" && (t * 2.5) % 1 < 0.3) || (e.act === "typing" && (t * 3) % 1 < 0.2));
    const frame = asleep ? 0 : Math.floor(t * 3 + e.order) % 2;
    let lunge = 0;
    if (e.monLungeUntil > t) lunge = -Math.round(9 * Math.sin(Math.min(1, 1 - (e.monLungeUntil - t) / 0.4) * Math.PI));
    else if (e.hurtUntil > t) lunge = -3;
    if (e.monKnockUntil > t) lunge += 2;
    const boss = e.boss;
    const spr = boss ? bossSprite(boss, frame, hit) : monsterSprite(e.monKind, frame, hit);
    const cx = p.x + (boss ? 4 : 0);
    shadow(c, cx, p.y, Math.min(boss ? 22 : 14, spr.width));
    const bob = asleep || Math.floor(t * 2 + e.order) % 2 === 0 ? 0 : -1;
    const sx = Math.round(cx - spr.width / 2 + lunge + (hit ? 1 : 0)), sy = Math.round(p.y - spr.height + bob);
    c.drawImage(spr, sx, sy);
    if (e.flashUntil > t) c.drawImage(tinted(spr, "#ffffff"), sx, sy);
    if (e.monLungeUntil > t) { c.globalAlpha = 0.3; c.drawImage(tinted(spr, "#ff2a2a"), sx, sy); c.globalAlpha = 1; }
    // HP bar
    const top = Math.round(p.y - spr.height) - (boss ? 6 : 5);
    if (boss) hpBar(c, Math.round(cx), top, 24, 3, Math.max(0.12, 1 - (t - e.bossAt) / 120));
    else hpBar(c, Math.round(cx), top, 12, 2, e.monHp / e.monHpMax);
    if (asleep) blitC(c, "zzz", cx + 6, top - 5 - (Math.floor(t * 1.5) % 2));
  } else {
    const dage = t - e.monDeadAt;
    if (dage < 0.5) blitC(c, "poof" + (Math.floor(dage * 8) % 2), p.x, p.y - 8);
    if (e.monLoot && dage < 1.3) {
      const u = dage / 1.3;
      c.globalAlpha = u < 0.75 ? 1 : (1 - u) * 4;
      blitC(c, "coin", p.x - 2, p.y - 8 - Math.sin(Math.min(1, u * 1.3) * Math.PI * 0.6) * 14);
      if (dage > 0.25) blitC(c, "coin", p.x + 4, p.y - 6 - (dage - 0.25) * 10);
      c.globalAlpha = 1;
    }
  }
}

/** context-window "mana": 12x2 under the hearts, below the feet so it never covers the sprite. Unknown = not drawn. */
function manaBar(c: Ctx, e: Employee, t: number, o: Office) {
  const f = o.ctxFrac(e.id);
  if (f === null) return;
  const w = 12, x = Math.round(e.x - w / 2), y = Math.round(e.y + 13);
  const col = f > 0.9 ? (Math.floor(t * 3) % 2 === 0 ? "#ff5a5a" : "#ff8f8f") : f > 0.7 ? "#f2c14e" : "#4aa3ff";
  rect(c, INK, x - 1, y - 1, w + 2, 4);
  rect(c, "#1f2b4a", x, y, w, 2);
  if (f > 0) rect(c, col, x, y, Math.max(1, Math.round(w * f)), 2);
}

function drawFx(c: Ctx, e: Employee, t: number, o: Office) {
  // quest note popping up (board pause or new prompt)
  if (e.state === "ENTERING" && e.holdUntil > t) {
    const u = Math.min(1, (t - e.noteAt) / 0.3);
    blitC(c, "quest_note", e.x, e.y - 28 - u * 5 - Math.sin(t * 6) * 0.7);
    if (u < 1) blitC(c, "spark" + (Math.floor(t * 12) % 2), e.x + 7, e.y - 30);
  }
  // turn-in: coins + chest
  if (e.state === "LEAVING" && e.holdUntil > t) {
    const dage = t - e.lootAt;
    blitC(c, "chest", e.x + 12, e.y - 6);
    for (let k = 0; k < 3; k++) {
      const u = Math.max(0, dage - k * 0.18);
      if (u > 0 && u < 0.9) { c.globalAlpha = 1 - u * 0.6; blitC(c, "coin", e.x - 6 + k * 6, e.y - 28 - u * 10); c.globalAlpha = 1; }
    }
  }
  if (e.state === "DRINK") {
    blitC(c, "steam" + (Math.floor(t * 3) % 3), e.x + 8, e.y - 26);
    if (Math.floor(t * 1.5) % 2 === 0) blitC(c, "ale", e.x + 9, e.y - 12);
  }
  if (e.hasPaper && t - e.paperAt < 1 && e.state === "SEATED") blitC(c, "quest_note", e.x + 9, e.y - 30 - (t - e.paperAt) * 6);
  if (t < e.sparkUntil) blitC(c, "spark" + (Math.floor(t * 12) % 2), e.x + 8, e.y - 28);
  if (e.state !== "SEATED") return;
  if (e.resting) {
    const fx = e.x + 10, fy = e.y + 1;
    blitB(c, "campfire" + (Math.floor(t * 6) % 2), fx, fy);
  }
  if (e.deskIdx >= 0 && e.hearts < MAX_HEARTS) {
    for (let k = 0; k < MAX_HEARTS; k++) blitC(c, k < e.hearts ? "heart" : "heart_empty", e.x - 7 + k * 7, e.y + 5);
  }
  manaBar(c, e, t, o);
  if (e.deskIdx >= 0 && e.hearts === 0 && !e.resting) blitC(c, "sweat" + (Math.floor(t * 3) % 2), e.x - 9, e.y - 22);
  if (e.slashUntil > t && e.monPos && !e.monDead) {
    blitC(c, "slash" + (Math.floor(t * 20) % 2), e.monPos.x - 3 + (e.boss ? 4 : 0), e.monPos.y - 9);
  }

  const mon = e.monPos && !e.monDead ? e.monPos : null;
  const mx = mon ? mon.x : e.x + 22;
  const my = e.y;
  const fight = !!mon && t - e.monAppearAt > 0.3;
  switch (e.act) {
    case "typing":
      if (fight) {
        for (let k = 0; k < 3; k++) {
          const u = (t * 1.7 + k / 3) % 1;
          const sx = e.x + 9, sy = e.y - 14;
          blitC(c, "magic" + ((Math.floor(t * 8) + k) % 2), sx + (mx - 5 - sx) * u, sy + (my - 9 - sy) * u - Math.sin(u * Math.PI) * 7);
        }
        if ((t * 1.7) % 1 > 0.8) blitC(c, "spark" + (Math.floor(t * 14) % 2), mx - 2, my - 10);
      } else blitC(c, "magic" + (Math.floor(t * 8) % 2), e.x + 11, e.y - 16);
      break;
    case "bash":
      if (fight && (t * 2.5) % 1 < 0.4) blitC(c, "slash" + (Math.floor(t * 12) % 2), mx - 3, my - 9);
      if (t - e.actSince > 4) blitC(c, "sweat" + (Math.floor(t * 3) % 2), e.x - 9, e.y - 22 + (Math.floor(t * 3) % 2) * 2);
      break;
    case "reading":
      blitC(c, "scroll", e.x + 11, e.y - 17 + Math.sin(t * 3) * 1.2);
      break;
    case "sticky":
      blitC(c, "quest_note", e.x + 11, e.y - 17 + Math.sin(t * 3) * 1.2);
      break;
    case "mcp":
      blitC(c, "portal" + (Math.floor(t * 6) % 2), e.x + 17, e.y - 13);
      break;
    case "phone": {
      const cyc = 5;
      const u = (t % cyc) / cyc; // 0..1: out and back
      const out = u < 0.5 ? u * 2 : (1 - u) * 2;
      const ox = e.x + 8 + out * 70, oy = e.y - 20 - Math.sin(out * Math.PI) * 14 - out * 18;
      const s = prop("owl" + (Math.floor(t * 8) % 2));
      if (out < 0.04) { c.drawImage(s, Math.round(e.x + 8 - s.width / 2), Math.round(e.y - 22 - s.height / 2)); break; }
      if (u < 0.5) c.drawImage(s, Math.round(ox - s.width / 2), Math.round(oy - s.height / 2));
      else { c.save(); c.translate(Math.round(ox), Math.round(oy - s.height / 2)); c.scale(-1, 1); c.drawImage(s, -s.width / 2, 0); c.restore(); }
      break;
    }
    default: break;
  }
  if (e.hurtUntil > t) {
    const u = 1 - (e.hurtUntil - t) / 0.8;
    c.globalAlpha = 1 - u * u;
    blitC(c, "heart", e.x + 9, e.y - 28 - u * 10);
    c.globalAlpha = 1;
  }
}

function bubbleOf(e: Employee, t: number): string | null {
  if (e.state === "DRINK") return "🍺";
  if (e.state !== "SEATED") return null;
  if (e.tempBubble) return e.tempBubble.e;
  if (e.bubble === "❗") return Math.floor(t * 4) % 2 === 0 ? "❗" : null;
  if (!e.bubble && e.hearts === 0 && e.deskIdx >= 0 && !e.resting) return "😩";
  return e.bubble;
}

function drawBubble(c: Ctx, x: number, tipY: number, emoji: string) {
  const w = 13, h = 12;
  const bx = Math.round(x - w / 2), by = Math.round(tipY - h - 2);
  rect(c, INK, bx + 1, by, w - 2, h);
  rect(c, INK, bx, by + 1, w, h - 2);
  rect(c, "#ffffff", bx + 1, by + 1, w - 2, h - 2);
  rect(c, INK, Math.round(x) - 1, by + h, 3, 1);
  rect(c, INK, Math.round(x), by + h + 1, 1, 1);
  c.font = EMOJI_FONT; c.textAlign = "center"; c.textBaseline = "middle";
  c.fillStyle = INK;
  c.fillText(emoji, x, by + h / 2 + 0.5);
}

/** Big red "!" bubble: the adventurer needs you. */
function drawAlert(c: Ctx, x: number, tipY: number) {
  const w = 13, h = 15;
  const bx = Math.round(x - w / 2), by = Math.round(tipY - h - 2);
  rect(c, INK, bx + 1, by, w - 2, h); rect(c, INK, bx, by + 1, w, h - 2);
  rect(c, "#ff4a4a", bx + 1, by + 1, w - 2, h - 2);
  rect(c, "#ff8a8a", bx + 2, by + 2, w - 4, 1);
  rect(c, INK, Math.round(x) - 1, by + h, 3, 1); rect(c, INK, Math.round(x), by + h + 1, 1, 1);
  c.font = '800 11px ui-sans-serif, system-ui, sans-serif'; c.textAlign = "center"; c.textBaseline = "middle";
  c.fillStyle = "#ffffff"; c.fillText("!", x, by + h / 2 + 0.8);
}

function internTagLine(e: Employee): string {
  const parts: string[] = [];
  for (const it of [...e.interns.values()].slice(0, 2)) {
    const d = it.act === "idle" ? "" : (it.tool ? it.tool + " " : "") + (it.detail ?? "");
    parts.push(`+ ${it.label}${d ? ": " + d.trim() : ""}`);
  }
  return parts.join("  ");
}

function drawTag(c: Ctx, e: Employee, topY: number) {
  const text = `${e.project} ${e.tag}`;
  c.font = TAG_FONT;
  const w = Math.ceil(c.measureText(text).width) + 7, h = 9;
  const bx = Math.max(1, Math.min(W - w - 1, e.x - w / 2));
  const by = Math.max(1, topY - h);
  c.fillStyle = "rgba(0,0,0,0.3)"; roundRect(c, bx, by + 1, w, h, 2.5); c.fill();
  c.fillStyle = "#23253a"; roundRect(c, bx, by, w, h, 2.5); c.fill();
  c.strokeStyle = "rgba(244,227,193,0.35)"; c.lineWidth = 0.5; roundRect(c, bx + 0.25, by + 0.25, w - 0.5, h - 0.5, 2.3); c.stroke();
  c.textAlign = "left"; c.textBaseline = "middle"; c.fillStyle = CREAM;
  c.fillText(text, bx + 3.5, by + h / 2 + 0.3);
  const sub = internTagLine(e);
  if (sub) {
    const st = sub.length > 44 ? sub.slice(0, 43) + "…" : sub;
    const w2 = Math.ceil(c.measureText(st).width) + 7;
    const bx2 = Math.max(1, Math.min(W - w2 - 1, e.x - w2 / 2)), by2 = Math.max(1, by - h - 1);
    c.fillStyle = "#23253a"; roundRect(c, bx2, by2, w2, h, 2.5); c.fill();
    c.strokeStyle = "rgba(244,227,193,0.35)"; c.lineWidth = 0.5; roundRect(c, bx2 + 0.25, by2 + 0.25, w2 - 0.5, h - 0.5, 2.3); c.stroke();
    c.fillStyle = "#bfe3ff"; c.fillText(st, bx2 + 3.5, by2 + h / 2 + 0.3);
  }
}

// ---------- guild receptionist ----------
function drawNpc(c: Ctx, t: number) {
  const spr = charSprite(lookFor("guild-receptionist-npc"), "idle", Math.floor(t * 1.2) % 2);
  c.save();
  c.beginPath(); c.rect(0, 0, W, COUNTER_BOX.y + 1); c.clip(); // counter hides the legs
  c.drawImage(spr, Math.round(NPC_POS.x - CH_W / 2), Math.round(NPC_POS.y - CH_H));
  c.restore();
}

// ---------- scene ----------
function drawAmbientBelow(c: Ctx, o: Office, night: number) {
  const t = o.ambT;
  if (night < 0.35 && o.rain < 0.3) {
    for (let i = 0; i < o.butterflies.length; i++) {
      const b = o.butterflies[i];
      const spr = butterflySprite(b.col, Math.floor(t * 8 + i) % 2);
      c.drawImage(spr, Math.round(b.x - spr.width / 2), Math.round(b.y - spr.height / 2 + Math.sin(t * 3 + b.ph) * 2));
    }
  }
}

function drawAmbientAbove(c: Ctx, o: Office, night: number) {
  const t = o.ambT;
  // hearth smoke
  for (const s of o.smoke) {
    const u = s.age / s.life;
    c.globalAlpha = 0.75 * (1 - u);
    blitC(c, "smoke" + Math.min(2, Math.floor(u * 3)), s.x, s.y);
  }
  c.globalAlpha = 1;
  if (night > 0.3) {
    const k = Math.min(1, (night - 0.3) * 2);
    for (const f of o.fireflies) {
      const a = k * (0.25 + 0.75 * Math.pow(Math.abs(Math.sin(t * 1.6 + f.ph * 4)), 2));
      c.globalAlpha = a * 0.25; rect(c, "#e8ff7a", f.x - 1, f.y - 1, 3, 3);
      c.globalAlpha = a; blitC(c, "firefly", f.x, f.y);
    }
    c.globalAlpha = 1;
  }
}

export function drawScene(c: Ctx, o: Office) {
  const t = o.clock;
  const now = new Date();
  const hr = now.getHours() + now.getMinutes() / 60;
  const night = nightness(hr);
  c.imageSmoothingEnabled = false;
  c.globalAlpha = 1;
  c.save();
  const amp = 3 * o.trauma * o.trauma;
  if (amp > 0.35 && !o.paused && !o.reducedMotion) c.translate(Math.round((Math.random() * 2 - 1) * amp), Math.round((Math.random() * 2 - 1) * amp));
  drawSky(c, t, hr);
  if (o.bird && night < 0.6 && o.rain < 0.5) {
    const b = o.bird;
    const spr = prop("bird" + (Math.floor(b.ph * 7) % 2));
    const bx = Math.round(b.x - spr.width / 2), by = Math.round(b.y + Math.sin(b.ph * 3) * 2 - spr.height / 2);
    if (b.vx > 0) { c.save(); c.translate(bx + spr.width, by); c.scale(-1, 1); c.drawImage(spr, 0, 0); c.restore(); }
    else c.drawImage(spr, bx, by);
  }
  if (!bg) bg = buildBg();
  const key = Math.floor(hr * 4);
  if (key !== lightKey || !overlay) { buildLighting(hr); lightKey = key; }
  c.drawImage(bg, 0, 0);
  drawEnvAnim(c, t);
  // Lighting tints only the environment; characters, monsters and emissive things stay solid and full-colour.
  c.drawImage(overlay!, 0, 0);
  if (o.rain > 0) { // rain darkens the world (before entities, so characters stay solid)
    c.fillStyle = `rgba(20,30,60,${0.2 * o.rain})`; c.fillRect(HALL_W, 0, W - HALL_W, H);
    c.fillStyle = `rgba(20,30,60,${0.07 * o.rain})`; c.fillRect(0, 0, HALL_W, H);
  }
  drawLights(c, t);
  drawAmbientBelow(c, o, night);
  drawAmbientAbove(c, o, night);
  drawNpc(c, t);

  // resting campfire glow + rain go under every entity so characters stay crisp
  for (const e of o.employees.values()) {
    if (o.isHidden(e)) continue;
    if (e.state === "SEATED" && e.resting) {
      c.globalAlpha = 0.16 + 0.05 * Math.sin(t * 9);
      c.fillStyle = "#ffb050"; c.beginPath(); c.arc(e.x + 10, e.y - 4, 11, 0, Math.PI * 2); c.fill();
      c.globalAlpha = 1;
    }
  }
  drawRain(c, o);

  const ents: { y: number; fn: () => void }[] = [];
  for (const e of o.employees.values()) {
    if (o.isHidden(e)) continue;
    const te = ts(e, t);
    ents.push({ y: e.y, fn: () => drawAdventurer(c, e, te) });
    ents.push({ y: e.y + 0.4, fn: () => drawFx(c, e, te, o) });
    if (e.monPos) { const mp = e.monPos; ents.push({ y: mp.y, fn: () => drawMonster(c, e, te) }); }
    if ((e.deskIdx >= 0 || e.slot >= 0) && e.state !== "LEAVING") {
      const camp = e.deskIdx < 0;
      let k = 0;
      for (const it of e.interns.values()) {
        if (k >= 2) break;
        const kk = k++;
        ents.push({ y: (camp ? campSquirePoint(e.slot, kk) : squirePoint(e.deskIdx, kk)).y, fn: () => drawSquire(c, e, it, kk, t) });
      }
      if (e.interns.size > 2) {
        const s = camp ? standSlot(e.slot) : spotOf(e.deskIdx);
        const bx = camp ? s.x + 8 : s.x - 24, by = camp ? s.y - 6 : s.y;
        ents.push({ y: s.y + 1, fn: () => drawBadge(c, `+${e.interns.size - 2}`, bx, by) });
      }
    }
  }
  // camp overflow beyond the last slot: stacked on it, badge shows how many
  let stacked = 0;
  for (const e of o.employees.values()) if (e.deskIdx < 0 && e.slot >= CAMP_MAX) stacked++;
  if (stacked > 0) {
    const s = standSlot(CAMP_MAX - 1);
    ents.push({ y: s.y + 2, fn: () => drawBadge(c, `+${stacked}`, s.x, s.y + 9) });
  }
  ents.sort((a, b) => a.y - b.y);
  for (const en of ents) en.fn();
  drawParticles(c, o);
  drawPopups(c, o);

  // bubbles, highlights, tags
  for (const e of o.employees.values()) {
    if (o.isHidden(e)) continue;
    if (e.state === "SEATED" && e.act === "handup" && !e.tempBubble) {
      if (Math.floor(t * 4) % 2 === 0 || o.selectedId === e.id) drawAlert(c, e.x, e.y - CH_H - 1);
    } else {
      const em = bubbleOf(e, t);
      if (em) drawBubble(c, e.x, e.y - CH_H - 1, em);
    }
    const lu = t - e.lvlAt;
    if (lu >= 0 && lu < 2.2 && e.state !== "LEAVING") {
      const u = lu / 2.2;
      c.globalAlpha = u > 0.75 ? (1 - u) / 0.25 : 1;
      c.font = '800 7.5px ui-sans-serif, system-ui, sans-serif'; c.textAlign = "center"; c.textBaseline = "middle";
      const ly = Math.round(e.y - CH_H - 20 - (bubbleOf(e, t) || e.act === "handup" ? 15 : 0) - eob(Math.min(1, lu * 2)) * 6);
      outlined(c, `LEVEL UP! Lv.${e.lvlTo}`, Math.max(34, Math.min(W - 34, Math.round(e.x))), ly, "#ffe14a");
      c.globalAlpha = 1;
    }
    if (o.selectedId === e.id) {
      const bounce = Math.floor(o.realTime * 4) % 2;
      const ax = Math.round(e.x), ay = Math.round(e.y - 28 - (bubbleOf(e, t) || e.act === "handup" ? 16 : 0) - bounce);
      rect(c, "#f2c14e", ax - 3, ay - 3, 7, 1); rect(c, "#f2c14e", ax - 2, ay - 2, 5, 1);
      rect(c, "#f2c14e", ax - 1, ay - 1, 3, 1); rect(c, "#f2c14e", ax, ay, 1, 1);
    }
  }
  const hv = o.hoverId ? o.employees.get(o.hoverId) : undefined;
  if (hv) {
    c.globalAlpha = 0.9;
    rect(c, "#f2c14e", Math.round(hv.x - CH_W / 2) - 1, Math.round(hv.y - CH_H) - 1, CH_W + 2, 1);
    c.globalAlpha = 1;
    drawTag(c, hv, hv.y - CH_H - 3 - (bubbleOf(hv, t) || (hv.state === "SEATED" && hv.act === "handup") ? 17 : 0));
  }
  c.restore(); // end of shaken scene; screen-space overlays below
  drawAlertVignette(c, o);
  if (o.flash > 0) { if (!o.reducedMotion) { c.globalAlpha = o.flash; rect(c, "#ffffff", 0, 0, W, H); c.globalAlpha = 1; } o.flash = 0; }
  drawBannerQ(c, o);
}
