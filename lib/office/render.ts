import {
  DUEL_FLOURISH,
  DUEL_IMPACT,
  DUEL_IMPACT_FINAL,
  DUEL_PIPS,
  DUEL_STOP,
  DUEL_STOP_FINAL,
  duelContact,
  duelScript,
  MAX_HEARTS,
  type Duel,
  type DuelScript,
  type Employee,
  type Office,
} from "./engine";
import {
  ALLY_BRIDGE_X,
  ALLY_GATE,
  ALLY_TORCHES,
  BACK_WALL_H,
  BAR,
  BRIDGE_X,
  CH_H,
  CH_W,
  COUNTER_BOX,
  DESK_COUNT,
  DUNGEON,
  DUNGEON_HIT,
  GATE_OPEN,
  WORLD_H,
  HALL_W,
  HEARTH,
  NPC_POS,
  ROAD_Y,
  TORCHES,
  WORLD_W,
  WALL_X0,
  duelMidOfDesks,
  plotRect,
  spotOf,
  squirePoint,
  campSquirePoint,
  standSlot,
  CAMP_MAX,
} from "./layout";
import { lookFor } from "./palette";
import { bossSprite, butterflySprite, charSprite, internSprite, monsterSprite, prop, type Pose } from "./sprites";

type Ctx = CanvasRenderingContext2D;
const rect = (ctx: Ctx, color: string, x: number, y: number, width: number, height: number) => {
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x), Math.round(y), width, height);
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

const rng = (seed: number) => {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
};
const mk = () => {
  const canvas = document.createElement("canvas");
  canvas.width = WORLD_W;
  canvas.height = WORLD_H;
  return { cv: canvas, c: canvas.getContext("2d")! };
};
const roundRect = (ctx: Ctx, x: number, y: number, width: number, height: number, radius: number) => {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + width, y, x + width, y + height, radius);
  ctx.arcTo(x + width, y + height, x, y + height, radius);
  ctx.arcTo(x, y + height, x, y, radius);
  ctx.arcTo(x, y, x + width, y, radius);
  ctx.closePath();
};
/** Draw a prop with bottom-centre anchored at (cx, by). */
const blitB = (ctx: Ctx, name: string, cx: number, by: number) => {
  const sprite = prop(name);
  ctx.drawImage(sprite, Math.round(cx - sprite.width / 2), Math.round(by - sprite.height));
};
/** Draw a prop centred at (cx, cy). */
const blitC = (ctx: Ctx, name: string, cx: number, cy: number) => {
  const sprite = prop(name);
  ctx.drawImage(sprite, Math.round(cx - sprite.width / 2), Math.round(cy - sprite.height / 2));
};
const shadow = (ctx: Ctx, x: number, y: number, width = 10) => {
  ctx.globalAlpha = 0.25;
  rect(ctx, INK, x - width / 2, y - 1, width, 2);
  ctx.globalAlpha = 1;
};

// ---------- static background ----------
let bg: HTMLCanvasElement | null = null;

const bricks = (ctx: Ctx, x0: number, y0: number, width: number, height: number, seed: number, vertical = false) => {
  ctx.save();
  ctx.beginPath();
  ctx.rect(x0, y0, width, height);
  ctx.clip();
  rect(ctx, ST.mortar, x0, y0, width, height);
  const rand = rng(seed);
  const tones = [ST.a, ST.b, ST.c];
  if (!vertical) {
    for (let y = y0, row = 0; y < y0 + height; y += 6, row++) {
      for (let x = x0 - (row % 2) * 6; x < x0 + width; x += 12) {
        rect(ctx, tones[(rand() * 3) | 0], x + 1, y + 1, 11, 5);
        rect(ctx, ST.hi, x + 1, y + 1, 11, 1);
        ctx.globalAlpha = 0.25;
        rect(ctx, "#000", x + 1, y + 5, 11, 1);
        ctx.globalAlpha = 1;
      }
    }
  } else {
    for (let y = y0; y < y0 + height; y += 6) {
      const off = ((y - y0) / 6) % 2 ? 4 : 0;
      for (let x = x0 - off; x < x0 + width; x += 8) {
        rect(ctx, tones[(rand() * 3) | 0], x + 1, y + 1, 7, 5);
        rect(ctx, ST.hi, x + 1, y + 1, 7, 1);
      }
    }
  }
  ctx.restore();
};

const drawBackdrop = (ctx: Ctx) => {
  // distant mountains + hills on the transparent sky window
  for (let x = HALL_W; x < WORLD_W; x++) {
    const far = 44 - Math.round(10 * Math.abs(Math.sin(x * 0.021 + 0.8)) + 4 * Math.sin(x * 0.07));
    rect(ctx, "#7f93c4", x, far, 1, 52 - far);
    rect(ctx, "#a9b9de", x, far, 1, 1);
    if (x % 11 < 3) rect(ctx, "#9aabd4", x, far + 3, 1, 4);
    const near = 44 - Math.round(3 * Math.sin(x * 0.04 + 2) + 2 * Math.sin(x * 0.11));
    rect(ctx, "#3f7f4a", x, near, 1, 52 - near);
    rect(ctx, "#4f9a52", x, near + 1, 1, 1);
    if (x % 3 === 0) rect(ctx, "#2f6a3f", x, near - 1, 2, 2);
  }
};

const drawGrass = (ctx: Ctx) => {
  rect(ctx, GRASS.base, HALL_W, 48, WORLD_W - HALL_W, WORLD_H - 48);
  const rand = rng(3);
  for (let i = 0; i < 46; i++) {
    ctx.globalAlpha = 0.28;
    rect(
      ctx,
      rand() < 0.5 ? GRASS.a : GRASS.c,
      HALL_W + rand() * (WORLD_W - HALL_W - 24),
      52 + rand() * 160,
      10 + ((rand() * 16) | 0),
      4 + ((rand() * 5) | 0),
    );
  }
  ctx.globalAlpha = 1;
  for (let i = 0; i < 640; i++) {
    const x = HALL_W + 1 + ((rand() * (WORLD_W - HALL_W - 4)) | 0),
      y = 50 + ((rand() * 164) | 0);
    const k = rand();
    if (k < 0.5) {
      rect(ctx, GRASS.c, x, y, 1, 2);
      rect(ctx, GRASS.b, x + 1, y + 1, 1, 1);
    } else if (k < 0.8) rect(ctx, GRASS.hi, x, y, 1, 1);
    else {
      rect(ctx, GRASS.b, x, y + 1, 3, 1);
      rect(ctx, GRASS.a, x + 1, y, 1, 1);
    }
  }
};

const streamY = (x: number) => 61 + Math.round(3 * Math.sin(x * 0.05));

const drawStream = (ctx: Ctx) => {
  const rand = rng(21);
  for (let x = HALL_W; x < WORLD_W; x++) {
    const yc = streamY(x);
    rect(ctx, "#d8c58a", x, yc - 6, 1, 1);
    rect(ctx, "#3a6a9a", x, yc - 5, 1, 1);
    rect(ctx, "#4a8ad0", x, yc - 4, 1, 8);
    rect(ctx, "#6aa8e8", x, yc - 3, 1, 2);
    rect(ctx, "#3a6a9a", x, yc + 4, 1, 1);
    rect(ctx, "#d8c58a", x, yc + 5, 1, 1);
    if (rand() < 0.08) rect(ctx, "#cfe9ff", x, yc - 2 + ((rand() * 5) | 0), 2, 1);
  }
  drawBridge(ctx, BRIDGE_X);
  drawBridge(ctx, ALLY_BRIDGE_X);
  drawAllyTrail(ctx);
};

/** a wooden bridge over the river (north-south) and the start of the dirt trail beyond it */
const drawBridge = (ctx: Ctx, bx: number) => {
  rect(ctx, "#5a3a26", bx - 7, 52, 14, 21);
  for (let y = 53; y < 72; y += 3) {
    rect(ctx, y % 6 === 2 ? WD.light : "#8f6040", bx - 6, y, 12, 3);
    rect(ctx, WD.top, bx - 6, y, 12, 1);
  }
  rect(ctx, "#3b2418", bx - 7, 52, 1, 21);
  rect(ctx, "#3b2418", bx + 6, 52, 1, 21);
  for (const py of [52, 62, 71]) {
    rect(ctx, WD.mid, bx - 8, py, 2, 3);
    rect(ctx, WD.mid, bx + 6, py, 2, 3);
  }
  // trail beyond the bridge
  for (let y = 73; y < 88; y++) {
    const half = 4 - ((y - 73) >> 2);
    ctx.globalAlpha = 0.9 - (y - 73) * 0.05;
    rect(ctx, DIRT.base, bx - half, y, half * 2, 1);
    ctx.globalAlpha = 1;
  }
};

/** the ally bridge's trail: straight down to the trail row, then a diagonal onto the branch road */
const drawAllyTrail = (ctx: Ctx) => {
  const bx = ALLY_BRIDGE_X;
  for (let y = 73; y < 92; y++) {
    rect(ctx, DIRT.edge, bx - 4, y, 1, 1);
    rect(ctx, DIRT.base, bx - 3, y, 7, 1);
    rect(ctx, DIRT.edge, bx + 4, y, 1, 1);
  }
  const steps = 24;
  for (let i = 0; i <= steps; i++) {
    const x = bx + ((136 - bx) * i) / steps,
      y = 92 + ((118 - 92) * i) / steps;
    rect(ctx, DIRT.edge, x - 4, y, 9, 2);
    rect(ctx, DIRT.base, x - 3, y, 7, 2);
  }
  rect(ctx, DIRT.b, bx - 1, 80, 3, 1);
  rect(ctx, DIRT.a, bx + 1, 88, 2, 1);
};

const drawDungeon = (ctx: Ctx) => {
  const { x, y } = DUNGEON; // base-centre
  ctx.globalAlpha = 0.25;
  rect(ctx, "#000", x - 26, y, 52, 3);
  ctx.globalAlpha = 1;
  bricks(ctx, x - 24, y - 16, 48, 16, 33);
  // arch
  rect(ctx, "#2a2d3a", x - 10, y - 24, 20, 24);
  rect(ctx, "#2a2d3a", x - 8, y - 27, 16, 3);
  rect(ctx, "#14121f", x - 8, y - 22, 16, 22);
  rect(ctx, "#14121f", x - 6, y - 25, 12, 3);
  for (let i = 0; i < 3; i++) {
    rect(ctx, ST.c, x - 10 + i, y - 24 - (i === 0 ? 0 : 0), 1, 24);
  }
  rect(ctx, ST.hi, x - 8, y - 27, 16, 1);
  rect(ctx, GOLD, x - 1, y - 28, 3, 2);
  // stairs inside
  for (let i = 0; i < 4; i++) rect(ctx, i % 2 ? "#2b2540" : "#221d33", x - 6 + i, y - 4 - i * 1, 12 - i * 2, 1);
  // broken pillars
  for (const [px, phase] of [
    [-24, 26],
    [20, 16],
  ] as const) {
    rect(ctx, ST.a, x + px, y - phase, 5, phase);
    rect(ctx, ST.hi, x + px, y - phase, 5, 1);
    rect(ctx, ST.dark, x + px + 4, y - phase, 1, phase);
    rect(ctx, ST.c, x + px - 1, y - 3, 7, 3);
    if (phase < 20) {
      rect(ctx, ST.b, x + px - 2, y - 3, 2, 3);
      rect(ctx, ST.b, x + px + 6, y - 2, 3, 2);
    }
  }
  // ivy
  ctx.globalAlpha = 0.8;
  for (let i = 0; i < 10; i++) rect(ctx, "#3f7f4a", x - 24 + ((i * 7) % 46), y - 16 + ((i * 5) % 9), 2, 2);
  ctx.globalAlpha = 1;
};

// The dungeon gate is its own sprite (not part of the cached background) so it can shake while a boss is out.
const GATE_PAD = 32;
const GATE_W = 64;
const GATE_H = 40;
let gateSprite: HTMLCanvasElement | null = null;
const buildGateSprite = (): HTMLCanvasElement => {
  const canvas = document.createElement("canvas");
  canvas.width = GATE_W;
  canvas.height = GATE_H;
  const ctx = canvas.getContext("2d")!;
  ctx.translate(GATE_PAD - DUNGEON.x, GATE_PAD - DUNGEON.y);
  drawDungeon(ctx);
  return canvas;
};
const SHAKE_X = [0, 1, 0, -1, 1, 0, -1, 0];
const SHAKE_Y = [0, 0, -1, 0, 0, 1, 0, 0];
/** how far the gate is shaken this frame (0 while no boss is out, and always 0 under reduced motion) */
const gateShake = (office: Office, time: number): { dx: number; dy: number } => {
  if (office.bossAlive <= 0 || office.reducedMotion) return { dx: 0, dy: 0 };
  const tick = Math.floor(time * 24);
  return { dx: SHAKE_X[tick % SHAKE_X.length], dy: SHAKE_Y[tick % SHAKE_Y.length] };
};
const drawGate = (ctx: Ctx, office: Office, time: number) => {
  if (!gateSprite) gateSprite = buildGateSprite();
  const { dx, dy } = gateShake(office, time);
  ctx.drawImage(gateSprite, DUNGEON.x - GATE_PAD + dx, DUNGEON.y - GATE_PAD + dy);
};

const drawRoad = (ctx: Ctx) => {
  const wob = (x: number, k: number) => Math.round(1.3 * Math.sin(x * 0.09 + k));
  // gate apron
  rect(ctx, DIRT.base, WALL_X0 - 2, GATE_OPEN.y0, 18, GATE_OPEN.y1 - GATE_OPEN.y0);
  for (let x = HALL_W; x < WORLD_W; x++) {
    const roadTop = ROAD_Y - 8 + wob(x, 0),
      roadBottom = ROAD_Y + 8 + wob(x, 2);
    rect(ctx, DIRT.edge, x, roadTop - 1, 1, 1);
    rect(ctx, DIRT.base, x, roadTop, 1, roadBottom - roadTop);
    rect(ctx, DIRT.edge, x, roadBottom, 1, 1);
    if (x % 7 === 0) rect(ctx, DIRT.b, x, roadTop + 2, 3, 1);
    if (x % 9 === 4) rect(ctx, DIRT.a, x, roadBottom - 3, 2, 1);
  }
  // branch to the camp area (overflow adventurers)
  for (let y = ROAD_Y; y < WORLD_H; y++) {
    const left = 127 + wob(y, 1),
      right = 141 + wob(y, 3);
    rect(ctx, DIRT.edge, left - 1, y, 1, 1);
    rect(ctx, DIRT.base, left, y, right - left, 1);
    rect(ctx, DIRT.edge, right, y, 1, 1);
    if (y % 8 === 0) rect(ctx, DIRT.b, left + 3, y, 3, 1);
  }
  // pebbles
  const rand = rng(9);
  for (let i = 0; i < 40; i++) {
    const x = 128 + ((rand() * 250) | 0),
      y = ROAD_Y - 6 + ((rand() * 12) | 0);
    rect(ctx, rand() < 0.5 ? "#8a6a42" : "#d6b583", x, y, 1, 1);
  }
  // battle patches
  for (let i = 0; i < DESK_COUNT; i++) {
    const spot = spotOf(i),
      cx = spot.x + 11,
      cy = spot.y - 1;
    for (let dy = -7; dy <= 7; dy++) {
      const half = Math.round(28 * Math.sqrt(1 - (dy / 8) * (dy / 8)));
      ctx.globalAlpha = 0.6;
      rect(ctx, "#9c7a4a", cx - half, cy + dy, half * 2, 1);
      ctx.globalAlpha = 0.5;
      rect(ctx, DIRT.base, cx - half + 3, cy + dy, Math.max(0, half * 2 - 6), 1);
      ctx.globalAlpha = 1;
    }
    for (let k = 0; k < 6; k++) {
      rect(ctx, "#7d5a34", cx - 22 + ((k * 9 + i * 5) % 44), cy - 5 + ((k * 5 + i) % 10), 2, 1);
    }
  }
};

const drawHall = (ctx: Ctx) => {
  // wood floor
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, BACK_WALL_H, HALL_W, WORLD_H - BACK_WALL_H);
  ctx.clip();
  const rand = rng(7);
  let row = 0;
  for (let y = BACK_WALL_H; y < WORLD_H; y += 8, row++) {
    let x = -((row * 13) % 32);
    while (x < HALL_W) {
      const len = 28 + ((rand() * 3) | 0) * 8;
      const x0 = Math.max(0, x),
        x1 = Math.min(HALL_W, x + len);
      rect(ctx, FLOOR[(rand() * 5) | 0], x0, y, x1 - x0, 8);
      ctx.globalAlpha = 0.16;
      rect(ctx, "#ffe6b4", x0, y, x1 - x0, 1);
      ctx.globalAlpha = 0.5;
      rect(ctx, "#6b4529", x0, y + 7, x1 - x0, 1);
      if (x >= 0) rect(ctx, "#6b4529", x, y, 1, 8);
      ctx.globalAlpha = 0.14;
      for (let grain = 0; grain < 3; grain++)
        rect(
          ctx,
          "#4a2f20",
          x0 + 3 + ((rand() * (len - 10)) | 0),
          y + 2 + ((rand() * 4) | 0),
          3 + ((rand() * 4) | 0),
          1,
        );
      ctx.globalAlpha = 1;
      x += len;
    }
  }
  ctx.restore();
  for (let i = 0; i < 5; i++) {
    ctx.globalAlpha = 0.28 - i * 0.05;
    rect(ctx, "#000", 0, BACK_WALL_H + i, HALL_W, 1);
  }
  ctx.globalAlpha = 1;

  // back wall (stone) + baseboard
  bricks(ctx, 0, 0, HALL_W, BACK_WALL_H - 2, 11);
  rect(ctx, WD.dark, 0, BACK_WALL_H - 3, HALL_W, 3);
  rect(ctx, WD.mid, 0, BACK_WALL_H - 3, HALL_W, 1);
  // ceiling beam
  rect(ctx, WD.dark, 0, 0, HALL_W, 3);
  rect(ctx, WD.mid, 0, 3, HALL_W, 1);
  for (let x = 20; x < HALL_W; x += 40) {
    rect(ctx, WD.mid, x, 0, 5, 8);
    rect(ctx, WD.dark, x + 4, 0, 1, 8);
  }

  // side walls
  bricks(ctx, 0, BACK_WALL_H, 9, WORLD_H - BACK_WALL_H, 12, true);
  rect(ctx, ST.hi, 8, BACK_WALL_H, 1, WORLD_H - BACK_WALL_H);
  ctx.globalAlpha = 0.3;
  rect(ctx, "#000", 9, BACK_WALL_H, 2, WORLD_H - BACK_WALL_H);
  ctx.globalAlpha = 1;
  // right wall with the gate opening
  const gy0 = GATE_OPEN.y0,
    gy1 = GATE_OPEN.y1;
  bricks(ctx, WALL_X0, BACK_WALL_H, HALL_W + 1 - WALL_X0, gy0 - BACK_WALL_H, 13, true);
  bricks(ctx, WALL_X0, gy1, HALL_W + 1 - WALL_X0, WORLD_H - gy1, 14, true);
  rect(ctx, ST.hi, WALL_X0, BACK_WALL_H, 1, gy0 - BACK_WALL_H);
  rect(ctx, ST.hi, WALL_X0, gy1, 1, WORLD_H - gy1);
  rect(ctx, "#aeb4c8", WALL_X0, gy1, HALL_W + 1 - WALL_X0, 2);
  rect(ctx, "#aeb4c8", WALL_X0, gy0 - 2, HALL_W + 1 - WALL_X0, 2);
  // tower pillar above the gate (back wall corner)
  bricks(ctx, WALL_X0 + 2, 0, HALL_W + 1 - WALL_X0 - 2, BACK_WALL_H, 15, true);
  rect(ctx, ST.dark, HALL_W - 1, 0, 2, BACK_WALL_H);
  // gate floor
  rect(ctx, DIRT.base, WALL_X0 - 3, gy0, 14, gy1 - gy0);
  rect(ctx, DIRT.a, WALL_X0 - 3, gy0, 14, 2);
  // lintel + portcullis
  rect(ctx, ST.dark, WALL_X0 - 2, gy0 - 8, 13, 8);
  rect(ctx, ST.hi, WALL_X0 - 2, gy0 - 8, 13, 1);
  rect(ctx, GOLD, WALL_X0 + 3, gy0 - 7, 3, 3);
  for (let x = WALL_X0 - 1; x < WALL_X0 + 10; x += 3) {
    rect(ctx, "#3b3f4f", x, gy0, 1, 7);
    rect(ctx, "#8d93a0", x, gy0 + 7, 1, 1);
  }
  rect(ctx, "#3b3f4f", WALL_X0 - 1, gy0 + 2, 10, 1);
  rect(ctx, ST.dark, WALL_X0 - 3, gy0 - 8, 1, gy1 - gy0 + 8);
  ctx.globalAlpha = 0.25;
  rect(ctx, "#000", WALL_X0 + 10, gy1, 6, 2);
  ctx.globalAlpha = 1;
};

const drawHallDecor = (ctx: Ctx) => {
  // rugs
  const rug = (x: number, y: number, width: number, height: number, base: string, trim: string) => {
    ctx.globalAlpha = 0.2;
    rect(ctx, "#000", x + 2, y + 2, width, height);
    ctx.globalAlpha = 1;
    rect(ctx, base, x, y, width, height);
    rect(ctx, trim, x + 1, y + 1, width - 2, 1);
    rect(ctx, trim, x + 1, y + height - 2, width - 2, 1);
    rect(ctx, trim, x + 1, y + 1, 1, height - 2);
    rect(ctx, trim, x + width - 2, y + 1, 1, height - 2);
    ctx.globalAlpha = 0.15;
    rect(ctx, "#fff", x + 4, y + 4, width - 8, height - 8);
    ctx.globalAlpha = 1;
  };
  rug(8, 166, 32, 22, "#8a2f3a", GOLD);
  rug(22, 54, 16, 114, "#8a2f3a", GOLD);
  for (let y = 62; y < 160; y += 14) {
    rect(ctx, GOLD, 28, y, 4, 1);
    rect(ctx, GOLD, 29, y - 1, 2, 3);
  }
  rug(80, 66, 38, 28, "#2f4f7f", "#d9c27a");
  rect(ctx, "#d9c27a", 96, 76, 6, 8);
  rect(ctx, "#2f4f7f", 97, 77, 4, 6);
  rect(ctx, "#d9c27a", 98, 79, 2, 2);

  // quest board
  rect(ctx, "#2a1810", 5, 5, 34, 42);
  rect(ctx, WD.mid, 6, 6, 32, 40);
  rect(ctx, WD.light, 6, 6, 32, 2);
  rect(ctx, "#b98a58", 8, 14, 28, 30);
  const rand = rng(5);
  ctx.globalAlpha = 0.25;
  for (let i = 0; i < 26; i++) rect(ctx, "#7b5236", 8 + ((rand() * 27) | 0), 14 + ((rand() * 29) | 0), 1, 1);
  ctx.globalAlpha = 1;
  rect(ctx, "#2a1810", 11, 8, 22, 5);
  rect(ctx, GOLD, 12, 9, 20, 3);
  for (let i = 0; i < 6; i++) rect(ctx, "#8a5a1a", 14 + i * 3, 10, 2, 1);
  rect(ctx, WD.dark, 6, 44, 32, 2);
  // legs / posts
  rect(ctx, WD.dark, 8, 46, 3, 6);
  rect(ctx, WD.dark, 33, 46, 3, 6);
  for (const [nx, ny] of [
    [14, 22],
    [24, 21],
    [32, 23],
    [15, 34],
    [25, 35],
    [32, 36],
  ] as const) {
    blitC(ctx, "quest_note", nx, ny);
    rect(ctx, "#d95763", nx - 1, ny - 4, 1, 1);
  }

  // hearth
  const hx = HEARTH.x;
  bricks(ctx, hx - 2, 14, HEARTH.w + 4, 38, 17);
  rect(ctx, WD.dark, hx - 4, 11, HEARTH.w + 8, 4);
  rect(ctx, WD.top, hx - 4, 11, HEARTH.w + 8, 1);
  rect(ctx, WD.mid, hx - 4, 14, HEARTH.w + 8, 1);
  rect(ctx, "#14100c", hx + 3, 24, 16, 28);
  rect(ctx, "#2a1810", hx + 3, 24, 16, 2);
  rect(ctx, "#4a2f20", hx + 5, 47, 12, 3);
  rect(ctx, "#6e4a36", hx + 4, 49, 14, 3);
  rect(ctx, "#8a8f9c", hx - 4, 50, HEARTH.w + 8, 3);
  rect(ctx, "#b0b6c4", hx - 4, 50, HEARTH.w + 8, 1);
  // crossed swords over the mantle
  rect(ctx, "#c8ced8", hx + 4, 4, 1, 6);
  rect(ctx, "#c8ced8", hx + 17, 4, 1, 6);
  rect(ctx, "#d9a441", hx + 2, 9, 5, 1);
  rect(ctx, "#d9a441", hx + 15, 9, 5, 1);
  rect(ctx, "#c8ced8", hx + 6, 5, 10, 1);
  rect(ctx, "#8d93a0", hx + 6, 6, 10, 1);

  // torch brackets
  for (const torch of TORCHES.slice(0, 4)) {
    rect(ctx, "#2a2d3a", torch.x - 2, torch.y - 1, 5, 3);
    rect(ctx, "#6e7585", torch.x - 1, torch.y - 1, 3, 1);
  }
  for (const torch of TORCHES.slice(4)) {
    rect(ctx, "#2a2d3a", torch.x - 2, torch.y, 5, 2);
  }

  // shelves behind the receptionist
  const bookColors = ["#d95763", "#4a6fa5", "#f2c14e", "#5fa55a", "#7b5ea7", "#e8c9a0", "#2b3a67"];
  for (const sy of [20, 32]) {
    const r2 = rng(sy);
    let bx = 81;
    while (bx < 115) {
      const width = 2 + ((r2() * 2) | 0),
        height = 5 + ((r2() * 4) | 0);
      if (bx + width > 115) break;
      if (r2() < 0.45) {
        // potion bottle
        const color = bookColors[(r2() * bookColors.length) | 0];
        rect(ctx, color, bx, sy - 5, 3, 4);
        rect(ctx, "#e9f3f7", bx + 1, sy - 7, 1, 2);
        rect(ctx, "#fff", bx, sy - 5, 1, 1);
        bx += 4;
      } else {
        rect(ctx, bookColors[(r2() * bookColors.length) | 0], bx, sy - height, width, height);
        rect(ctx, "#fff", bx, sy - height, width, 1);
        bx += width;
      }
    }
    rect(ctx, WD.mid, 79, sy, 38, 2);
    rect(ctx, WD.top, 79, sy, 38, 1);
  }

  // counter
  const counterBox = COUNTER_BOX;
  ctx.globalAlpha = 0.22;
  rect(ctx, "#000", counterBox.x + 2, counterBox.y + counterBox.h, counterBox.w, 3);
  ctx.globalAlpha = 1;
  rect(ctx, WD.dark, counterBox.x, counterBox.y, counterBox.w, counterBox.h);
  rect(ctx, "#c89a62", counterBox.x, counterBox.y, counterBox.w, 6);
  rect(ctx, "#e3bd86", counterBox.x, counterBox.y, counterBox.w, 1);
  rect(ctx, WD.mid, counterBox.x + 1, counterBox.y + 7, counterBox.w - 2, counterBox.h - 8);
  for (let x = counterBox.x + 3; x < counterBox.x + counterBox.w - 8; x += 12) {
    rect(ctx, "#8f6040", x, counterBox.y + 9, 10, 7);
    rect(ctx, "#a8764a", x + 1, counterBox.y + 10, 8, 5);
  }
  rect(ctx, GOLD, counterBox.x, counterBox.y + 6, counterBox.w, 1);
  // ledger, bell, candle
  rect(ctx, "#f6ecd2", 82, 42, 9, 4);
  rect(ctx, "#8a6a42", 82, 45, 9, 1);
  rect(ctx, "#3b2f3f", 84, 43, 5, 1);
  rect(ctx, "#d9a441", 107, 43, 4, 3);
  rect(ctx, "#f6d88a", 108, 42, 2, 1);
  rect(ctx, "#f5efe0", 113, 42, 2, 4);

  // weapon rack
  rect(ctx, WD.mid, 12, 94, 16, 3);
  rect(ctx, WD.mid, 12, 108, 16, 3);
  rect(ctx, WD.dark, 11, 94, 2, 20);
  rect(ctx, WD.dark, 27, 94, 2, 20);
  for (let i = 0; i < 4; i++) {
    rect(ctx, "#c8ced8", 15 + i * 3, 86, 1, 22);
    rect(ctx, "#8d93a0", 16 + i * 3, 88, 1, 20);
    rect(ctx, "#d9a441", 14 + i * 3, 104, 3, 1);
  }
  rect(ctx, "#4a6fa5", 11, 112, 5, 4);
  rect(ctx, "#d95763", 24, 112, 5, 4); // shields
  ctx.globalAlpha = 0.2;
  rect(ctx, "#000", 11, 116, 18, 2);
  ctx.globalAlpha = 1;

  // tables with stools
  for (const [tx, ty] of [
    [58, 138],
    [58, 186],
  ] as const) {
    ctx.globalAlpha = 0.22;
    rect(ctx, "#000", tx - 11, ty + 5, 24, 3);
    ctx.globalAlpha = 1;
    rect(ctx, WD.dark, tx - 3, ty + 2, 6, 6);
    rect(ctx, WD.mid, tx - 11, ty - 4, 22, 9);
    rect(ctx, WD.mid, tx - 9, ty - 6, 18, 13);
    rect(ctx, WD.light, tx - 10, ty - 4, 20, 8);
    rect(ctx, WD.light, tx - 8, ty - 5, 16, 10);
    rect(ctx, WD.top, tx - 8, ty - 5, 16, 1);
    for (const sx of [-16, 14]) {
      rect(ctx, WD.dark, tx + sx, ty - 1, 5, 6);
      rect(ctx, "#8a3f3a", tx + sx, ty - 2, 5, 3);
      rect(ctx, "#a5504a", tx + sx, ty - 2, 5, 1);
    }
    rect(ctx, "#f5efe0", tx - 5, ty - 3, 3, 3);
    rect(ctx, "#d9a441", tx - 2, ty - 2, 1, 1);
    rect(ctx, "#e8c9a0", tx + 3, ty - 3, 3, 3);
    rect(ctx, "#f6ecd2", tx + 3, ty - 3, 3, 1);
    rect(ctx, "#f5efe0", tx + 1, ty - 6, 1, 3);
  }
  blitB(ctx, "barrel", 14, 138);
  blitB(ctx, "barrel", 14, 150);
  blitB(ctx, "barrel", 21, 144);

  // tavern bar (along the right wall, patrons stand on its left)
  const bar = BAR;
  ctx.globalAlpha = 0.22;
  rect(ctx, "#000", bar.x - 3, bar.y + 3, 3, bar.h);
  ctx.globalAlpha = 1;
  rect(ctx, WD.dark, bar.x - 3, bar.y - 2, bar.w + 3, bar.h + 8);
  rect(ctx, WD.mid, bar.x - 2, bar.y - 1, 2, bar.h + 6);
  rect(ctx, WD.light, bar.x, bar.y - 1, bar.w, bar.h + 2);
  rect(ctx, WD.top, bar.x + 1, bar.y, bar.w - 2, bar.h);
  rect(ctx, WD.hi, bar.x, bar.y - 1, bar.w, 1);
  rect(ctx, WD.hi, bar.x, bar.y - 1, 1, bar.h);
  for (let y = bar.y + 6; y < bar.y + bar.h; y += 11) {
    ctx.globalAlpha = 0.16;
    rect(ctx, "#5a3a26", bar.x + 3, y, bar.w - 6, 1);
    ctx.globalAlpha = 1;
  }
  rect(ctx, WD.dark, bar.x - 3, bar.y + bar.h + 5, bar.w + 3, 2);
  blitC(ctx, "ale", bar.x + 5, bar.y + 12);
  blitC(ctx, "ale", bar.x + 12, bar.y + 24);
  blitC(ctx, "ale", bar.x + 6, bar.y + 38);
  blitC(ctx, "ale", bar.x + 12, bar.y + 46);
  blitB(ctx, "barrel", bar.x + 10, bar.y - 2);
  blitB(ctx, "barrel", 108, WORLD_H - 2);
  blitB(ctx, "barrel", 100, WORLD_H - 1);
  // hanging tavern sign on the back wall
  rect(ctx, WD.dark, 119, 6, 1, 6);
  rect(ctx, WD.mid, 108, 12, 14, 8);
  rect(ctx, WD.light, 109, 13, 12, 6);
  rect(ctx, "#f5efe0", 112, 14, 5, 4);
  rect(ctx, GOLD, 113, 14, 3, 1);
  rect(ctx, "#f5efe0", 117, 15, 1, 2);

  // door (left wall)
  rect(ctx, ST.dark, 0, 152, 10, 4);
  rect(ctx, "#2a1810", 0, 156, 9, 40);
  rect(ctx, WD.mid, 0, 157, 8, 38);
  for (let y = 158; y < 194; y += 6) {
    rect(ctx, WD.light, 0, y, 8, 5);
    rect(ctx, WD.top, 0, y, 8, 1);
  }
  rect(ctx, "#2a2d3a", 0, 163, 8, 2);
  rect(ctx, "#2a2d3a", 0, 183, 8, 2);
  rect(ctx, GOLD, 6, 176, 2, 2);
  ctx.globalAlpha = 0.3;
  rect(ctx, "#000", 8, 156, 2, 40);
  ctx.globalAlpha = 1;
  // welcome light on floor by the door
  ctx.globalAlpha = 0.12;
  rect(ctx, "#ffe6b4", 9, 160, 7, 32);
  ctx.globalAlpha = 1;
};

const drawWildDecor = (ctx: Ctx) => {
  // shadow of the hall wall
  ctx.globalAlpha = 0.25;
  rect(ctx, "#000", HALL_W + 1, 52, 4, WORLD_H - 52);
  ctx.globalAlpha = 0.12;
  rect(ctx, "#000", HALL_W + 5, 52, 3, WORLD_H - 52);
  ctx.globalAlpha = 1;
  const items: { n: string; x: number; y: number }[] = [];
  const add = (propName: string, x: number, y: number) => items.push({ n: propName, x, y });
  for (const [x, y] of [
    [206, 78],
    [262, 80],
    [312, 78],
    [374, 84],
  ] as const)
    add("tree", x, y);
  for (const [x, y] of [
    [378, 214],
    [330, 215],
    [268, 214],
    [214, 215],
    [150, 214],
  ] as const)
    add("tree", x, y);
  add("sign", 142, 112);
  add("rock", 154, 150);
  add("rock", 380, 150);
  add("bush", 262, 146);
  add("bush", 330, 148);
  add("bush", 372, 128);
  // scatter
  const rand = rng(77);
  const free = (x: number, y: number) => {
    if (y > ROAD_Y - 12 && y < ROAD_Y + 12) return false;
    if (x < 146 && y > 112) return false;
    if (y < 78 || y > 212) return false;
    for (let i = 0; i < DESK_COUNT; i++) {
      const spot = spotOf(i);
      if (x > spot.x - 30 && x < spot.x + 44 && y > spot.y - 30 && y < spot.y + 8) return false;
    }
    if (y > 192 && x < 372) return false;
    return true;
  };
  for (let i = 0, placed = 0; i < 200 && placed < 46; i++) {
    const x = 146 + ((rand() * 234) | 0),
      y = 80 + ((rand() * 132) | 0);
    if (!free(x, y)) continue;
    const k = rand();
    add(k < 0.6 ? "flower" : k < 0.82 ? "bush" : "rock", x, y);
    placed++;
  }
  items.sort((itemA, itemB) => itemA.y - itemB.y);
  for (const it of items) {
    const sprite = prop(it.n);
    ctx.globalAlpha = 0.22;
    rect(ctx, "#000", it.x - sprite.width / 2 + 1, it.y - 1, sprite.width - 1, 2);
    ctx.globalAlpha = 1;
    blitB(ctx, it.n, it.x, it.y);
  }
  // gate torch posts on the wilderness side (stone braziers)
  for (const torch of TORCHES.slice(2, 4)) {
    rect(ctx, ST.dark, torch.x - 3, torch.y, 7, 3);
    rect(ctx, ST.hi, torch.x - 3, torch.y, 7, 1);
  }
};

const buildBg = (): HTMLCanvasElement => {
  const { cv: canvas, c: ctx } = mk();
  drawBackdrop(ctx);
  drawGrass(ctx);
  drawStream(ctx);
  drawRoad(ctx);
  drawHall(ctx);
  drawHallDecor(ctx);
  drawWildDecor(ctx);
  return canvas;
};

// ---------- lighting layer (cached per quarter hour) ----------
let lightKey = -1;
let overlay: HTMLCanvasElement | null = null;

const nightness = (hour: number): number => {
  if (hour >= 19 || hour < 5) return 1;
  if (hour < 6.5) return (6.5 - hour) / 1.5;
  if (hour >= 17.5) return (hour - 17.5) / 1.5;
  return 0;
};

const buildLighting = (hour: number) => {
  const layer = mk();
  const ctx = layer.c;
  const night = nightness(hour);
  if (hour >= 16 && hour < 19.5) {
    ctx.globalAlpha = Math.min(0.12, Math.max(0, 1 - Math.abs(hour - 17.8) / 1.7) * 0.12);
    rect(ctx, "#ff9a4a", 0, 0, WORLD_W, WORLD_H);
    ctx.globalAlpha = 1;
  }
  if (night > 0) {
    ctx.fillStyle = `rgba(18,22,66,${0.2 * night})`;
    ctx.fillRect(0, 0, HALL_W, WORLD_H);
    ctx.fillStyle = `rgba(10,16,58,${0.5 * night})`;
    ctx.fillRect(HALL_W, 0, WORLD_W - HALL_W, WORLD_H);
    const pools: [number, number, number][] = [
      [42, 28, 44],
      [73, 28, 44],
      [58, 44, 66],
      [98, 40, 44],
      [105, 170, 64],
      [58, 138, 34],
      [58, 186, 34],
      [30, 60, 34],
      [122, 94, 46],
      [122, 152, 46],
      [340, 46, 46],
      [140, 124, 40],
    ];
    ctx.globalCompositeOperation = "destination-out";
    for (const [lx, ly, radius] of pools) {
      const gradient = ctx.createRadialGradient(lx, ly, 0, lx, ly, radius);
      gradient.addColorStop(0, `rgba(0,0,0,${0.6 * night})`);
      gradient.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = gradient;
      ctx.fillRect(lx - radius, ly - radius, radius * 2, radius * 2);
    }
    ctx.globalCompositeOperation = "source-over";
    for (const [lx, ly, radius] of pools) {
      const gradient = ctx.createRadialGradient(lx, ly, 0, lx, ly, radius);
      gradient.addColorStop(0, `rgba(255,190,90,${0.22 * night})`);
      gradient.addColorStop(1, "rgba(255,190,90,0)");
      ctx.fillStyle = gradient;
      ctx.fillRect(lx - radius, ly - radius, radius * 2, radius * 2);
    }
  }
  const vignetteGradient = ctx.createRadialGradient(
    WORLD_W / 2,
    WORLD_H / 2 + 10,
    100,
    WORLD_W / 2,
    WORLD_H / 2 + 10,
    250,
  );
  vignetteGradient.addColorStop(0, "rgba(30,20,10,0)");
  vignetteGradient.addColorStop(1, "rgba(30,20,10,0.25)");
  ctx.fillStyle = vignetteGradient;
  ctx.fillRect(0, 0, WORLD_W, WORLD_H);
  overlay = layer.cv;
};

// ---------- sky ----------
const lerpCol = (colorFrom: string, colorTo: string, amount: number): string => {
  const byteAt = (color: string, i: number) => parseInt(color.slice(1 + i * 2, 3 + i * 2), 16);
  const lerpByte = (i: number) =>
    Math.round(byteAt(colorFrom, i) + (byteAt(colorTo, i) - byteAt(colorFrom, i)) * amount);
  return `rgb(${lerpByte(0)},${lerpByte(1)},${lerpByte(2)})`;
};
const SKY_KEYS: [number, string, string][] = [
  [0, "#0b1030", "#1f2c63"],
  [5, "#0b1030", "#1f2c63"],
  [6.5, "#6a6fb5", "#ffb27a"],
  [8, "#59b0ee", "#bfe8ff"],
  [16.5, "#59b0ee", "#bfe8ff"],
  [18, "#4f4a94", "#ff8f5c"],
  [19.5, "#0b1030", "#1f2c63"],
  [24, "#0b1030", "#1f2c63"],
];
const skyAt = (hour: number): [string, string] => {
  for (let i = 1; i < SKY_KEYS.length; i++) {
    const before = SKY_KEYS[i - 1],
      after = SKY_KEYS[i];
    if (hour <= after[0]) {
      const amount = (hour - before[0]) / (after[0] - before[0] || 1);
      // lerpCol returns rgb(); keep hex interpolation for chaining
      const hex = (x: string, y: string) => {
        const byteAt = (color: string, k: number) => parseInt(color.slice(1 + k * 2, 3 + k * 2), 16);
        const lerpByte = (k: number) =>
          Math.round(byteAt(x, k) + (byteAt(y, k) - byteAt(x, k)) * amount)
            .toString(16)
            .padStart(2, "0");
        return `#${lerpByte(0)}${lerpByte(1)}${lerpByte(2)}`;
      };
      return [hex(before[1], after[1]), hex(before[2], after[2])];
    }
  }
  return ["#0b1030", "#1f2c63"];
};

const drawSky = (ctx: Ctx, time: number, hour: number) => {
  ctx.save();
  ctx.beginPath();
  ctx.rect(HALL_W, 0, WORLD_W - HALL_W, 52);
  ctx.clip();
  const [top, bot] = skyAt(hour);
  for (let band = 0; band < 13; band++) rect(ctx, lerpCol(top, bot, band / 12), HALL_W, band * 4, WORLD_W - HALL_W, 4);
  const night = nightness(hour);
  if (night > 0.2) {
    for (let star = 0; star < 22; star++) {
      const sx = HALL_W + 6 + ((star * 37 + 11) % 246),
        sy = 3 + ((star * 17) % 26);
      ctx.globalAlpha = night * (0.4 + 0.6 * Math.abs(Math.sin(time * 1.8 + star * 1.3)));
      rect(ctx, "#ffffff", sx, sy, 1, 1);
    }
    ctx.globalAlpha = 1;
  }
  if (night < 0.9) {
    // sun
    const progress = Math.min(1, Math.max(0, (hour - 6) / 12));
    const sx = HALL_W + 14 + progress * 230,
      sy = 38 - Math.sin(progress * Math.PI) * 30;
    ctx.globalAlpha = 1 - night;
    rect(ctx, "#fff3b0", sx - 3, sy - 2, 7, 5);
    rect(ctx, "#fff3b0", sx - 2, sy - 3, 5, 7);
    rect(ctx, "#ffd96a", sx - 2, sy - 2, 5, 5);
    ctx.globalAlpha = 1;
  }
  if (night > 0.3) {
    // moon
    const progress = hour >= 18 ? (hour - 18) / 12 : (hour + 6) / 12;
    const mx = HALL_W + 14 + Math.min(1, progress) * 230,
      my = 32 - Math.sin(Math.min(1, progress) * Math.PI) * 22;
    ctx.globalAlpha = night;
    rect(ctx, "#f4f0d8", mx - 3, my - 3, 7, 7);
    rect(ctx, "#f4f0d8", mx - 4, my - 2, 9, 5);
    rect(ctx, "#d6d0b0", mx, my - 1, 2, 2);
    ctx.globalAlpha = 1;
  }
  const cloudA = 0.95 - night * 0.75;
  ctx.globalAlpha = cloudA;
  for (let k = 0; k < 3; k++) {
    const cx = HALL_W + ((time * 2.2 + k * 94) % 300) - 24,
      cy = 8 + k * 7;
    rect(ctx, "#ffffff", cx, cy, 16, 4);
    rect(ctx, "#ffffff", cx + 3, cy - 2, 9, 3);
    ctx.globalAlpha = cloudA * 0.35;
    rect(ctx, "#9aa8d0", cx, cy + 3, 16, 1);
    ctx.globalAlpha = cloudA;
  }
  ctx.globalAlpha = 1;
  ctx.restore();
};

// ---------- animated environment ----------
const drawEnvAnim = (ctx: Ctx, time: number) => {
  // stream shimmer
  for (let k = 0; k < 12; k++) {
    const x = HALL_W + 6 + ((k * 61 + Math.floor(time * 6) * 3) % 246);
    ctx.globalAlpha = 0.35 + 0.35 * Math.sin(time * 4 + k * 2.1);
    rect(ctx, "#e8f6ff", x, streamY(x) - 3 + (k % 5), 3, 1);
  }
  ctx.globalAlpha = 1;
};

// emissive things drawn after the night overlay
const drawLights = (ctx: Ctx, time: number, office: Office) => {
  // fireplace
  const hx = HEARTH.x + 5;
  for (let i = 0; i < 6; i++) {
    const height = 5 + Math.round(3 * Math.abs(Math.sin(time * 7 + i * 1.9)) + (i === 2 || i === 3 ? 4 : 0));
    rect(ctx, "#e8742a", hx + i * 2, 47 - height, 3, height);
    rect(ctx, GOLD, hx + 1 + i * 2, 47 - height + 3, 1, Math.max(1, height - 3));
  }
  rect(ctx, "#d95763", hx, 45, 12, 2);
  if (Math.floor(time * 5) % 3 === 0)
    rect(ctx, GOLD, hx + 2 + ((Math.floor(time * 9) * 5) % 9), 36 - (Math.floor(time * 9) % 4), 1, 1);
  // candle on the counter
  rect(ctx, GOLD, 113, 40 + (Math.floor(time * 8) % 2), 2, 2);
  // wall + gate torches
  const boss = office.bossAlive > 0;
  const { dx, dy } = gateShake(office, time);
  TORCHES.forEach((point, i) => {
    const dungeonTorch = i >= TORCHES.length - 2;
    const sx = dungeonTorch ? dx : 0,
      sy = dungeonTorch ? dy : 0;
    blitB(ctx, "torch" + ((Math.floor(time * 6) + i) % 2), point.x + sx, point.y + sy);
    if (dungeonTorch && boss) drawTorchFlare(ctx, point.x + sx, point.y + sy, time, office.reducedMotion, i);
  });
  ALLY_TORCHES.forEach((point, i) => blitB(ctx, "torch" + ((Math.floor(time * 6) + i + 1) % 2), point.x, point.y));
  // dungeon glow: purple normally, red while a boss is out (static under reduced motion)
  if (boss) {
    ctx.globalAlpha = office.reducedMotion ? 0.55 : 0.45 + 0.2 * Math.sin(time * 9);
    rect(ctx, "#ff3b2a", DUNGEON.x - 8 + dx, DUNGEON.y - 22 + dy, 16, 22);
    ctx.globalAlpha = office.reducedMotion ? 0.3 : 0.2 + 0.15 * Math.sin(time * 9 + 1);
    rect(ctx, "#ffb070", DUNGEON.x - 4 + dx, DUNGEON.y - 16 + dy, 8, 12);
  } else {
    ctx.globalAlpha = 0.25 + 0.15 * Math.sin(time * 2);
    rect(ctx, "#7b5ea7", DUNGEON.x - 6, DUNGEON.y - 18, 12, 16);
  }
  ctx.globalAlpha = 1;
  if (office.gateLit) drawGateBrackets(ctx);
};

/** a boss is out: the dungeon torches flare up (taller red/orange flame + a halo) */
const drawTorchFlare = (ctx: Ctx, x: number, y: number, time: number, still: boolean, seed: number) => {
  const flick = still ? 1 : Math.floor(2 + 2 * Math.abs(Math.sin(time * 11 + seed * 1.7)));
  ctx.globalAlpha = 0.25;
  rect(ctx, "#ff3b2a", x - 5, y - 16, 10, 10);
  ctx.globalAlpha = 1;
  rect(ctx, "#ff5a2a", x - 2, y - 11 - flick, 4, flick + 2);
  rect(ctx, "#ffd24a", x - 1, y - 11 - flick + 1, 2, flick);
};

/** hover / open highlight on the clickable gate: four opaque gold corner brackets */
const drawGateBrackets = (ctx: Ctx) => {
  const { x, y, w, h } = DUNGEON_HIT;
  const len = 6;
  for (const [cx, cy, sx, sy] of [
    [x, y, 1, 1],
    [x + w - 1, y, -1, 1],
    [x, y + h - 1, 1, -1],
    [x + w - 1, y + h - 1, -1, -1],
  ] as const) {
    rect(ctx, GOLD, sx > 0 ? cx : cx - len + 1, cy, len, 1);
    rect(ctx, GOLD, cx, sy > 0 ? cy : cy - len + 1, 1, len);
  }
};

// ---------- the ally gate: the dungeon gate's friendly twin ----------
const BANNER = { cloth: "#d95763", shade: "#a8403f", gold: "#f2c14e" };
const DOOR_WOOD = ["#a8764a", "#8f6040"];
/**
 * Stone arch like the dungeon's, but with intact pillars, guild banners and warm wooden doors. `open` swings the
 * doors aside on a lit hall (someone is passing). Drawn before the lighting layer.
 */
const drawAllyGate = (ctx: Ctx, open: boolean, time: number, still: boolean) => {
  const { x, y } = ALLY_GATE;
  ctx.globalAlpha = 0.25;
  rect(ctx, "#000", x - 26, y, 52, 3);
  ctx.globalAlpha = 1;
  bricks(ctx, x - 24, y - 16, 48, 16, 41);
  // arch (lighter stone than the dungeon's)
  rect(ctx, ST.a, x - 10, y - 24, 20, 24);
  rect(ctx, ST.a, x - 8, y - 27, 16, 3);
  rect(ctx, ST.hi, x - 8, y - 27, 16, 1);
  rect(ctx, ST.hi, x - 10, y - 24, 1, 24);
  rect(ctx, ST.dark, x + 9, y - 24, 1, 24);
  rect(ctx, GOLD, x - 1, y - 28, 3, 2);
  // doorway
  rect(ctx, "#3b2418", x - 8, y - 22, 16, 22);
  rect(ctx, "#3b2418", x - 6, y - 25, 12, 3);
  if (open) {
    rect(ctx, "#7a4a1e", x - 7, y - 21, 14, 21);
    rect(ctx, "#c9892f", x - 6, y - 24, 12, 3);
    rect(ctx, "#e8a43a", x - 6, y - 21, 12, 19);
    rect(ctx, "#f6cf6a", x - 4, y - 19, 8, 15);
    rect(ctx, "#fff0b0", x - 2, y - 15, 4, 8);
    rect(ctx, "#5a3a26", x - 7, y - 3, 14, 3); // floor
    rect(ctx, DOOR_WOOD[0], x - 9, y - 22, 2, 22); // the leaves, swung back against the arch
    rect(ctx, DOOR_WOOD[0], x + 8, y - 22, 2, 22);
    rect(ctx, "#2a2d3a", x - 9, y - 16, 2, 1);
    rect(ctx, "#2a2d3a", x + 8, y - 16, 2, 1);
  } else {
    for (let i = 0; i < 4; i++) rect(ctx, DOOR_WOOD[i % 2], x - 8 + i * 4, y - 22, 4, 22);
    rect(ctx, DOOR_WOOD[0], x - 6, y - 25, 12, 3);
    rect(ctx, "#3b2418", x, y - 25, 1, 25); // the seam
    rect(ctx, "#2a2d3a", x - 8, y - 16, 16, 1); // iron bands
    rect(ctx, "#2a2d3a", x - 8, y - 6, 16, 1);
    rect(ctx, GOLD, x - 2, y - 11, 1, 2); // handles
    rect(ctx, GOLD, x + 2, y - 11, 1, 2);
  }
  // intact pillars with guild banners and pennants
  for (const side of [-1, 1]) {
    const px = side < 0 ? x - 24 : x + 20;
    rect(ctx, ST.a, px, y - 24, 5, 24);
    rect(ctx, ST.hi, px, y - 24, 5, 1);
    rect(ctx, ST.dark, px + 4, y - 24, 1, 24);
    rect(ctx, ST.c, px - 1, y - 3, 7, 3);
    rect(ctx, ST.c, px - 1, y - 26, 7, 2);
    // hanging banner
    const bx = px + 1;
    rect(ctx, WD.mid, bx - 1, y - 21, 5, 1);
    rect(ctx, BANNER.cloth, bx, y - 20, 3, 10);
    rect(ctx, BANNER.shade, bx + 2, y - 20, 1, 10);
    rect(ctx, BANNER.gold, bx, y - 18, 3, 1);
    rect(ctx, BANNER.cloth, bx + 1, y - 10, 1, 2);
    // pennant on a pole above the pillar
    const wave = still ? 0 : Math.round(Math.sin(time * 5 + side));
    rect(ctx, WD.mid, px + 2, y - 33, 1, 7);
    rect(ctx, BANNER.cloth, px + 3, y - 33, 4, 1);
    rect(ctx, BANNER.cloth, px + 3, y - 32, 3, 1);
    rect(ctx, BANNER.shade, px + 3, y - 31 + wave, 2, 1);
  }
  // torch brackets (the flames are drawn with the other lights)
  for (const torch of ALLY_TORCHES) rect(ctx, "#2a2d3a", torch.x - 2, torch.y, 5, 2);
  // flowers at the foot: this side is tended
  for (const [fx, fc] of [
    [-18, "#ff9ad5"],
    [-14, "#ffd94a"],
    [14, "#ffd94a"],
    [18, "#ff9ad5"],
  ] as const) {
    rect(ctx, "#3f7f4a", x + fx, y + 1, 1, 2);
    rect(ctx, fc, x + fx, y, 1, 1);
  }
};

/** the warm lamplight of the ally gate's doorway (after the night overlay: emissive) */
const drawAllyGlow = (ctx: Ctx, office: Office, time: number) => {
  const { x, y } = ALLY_GATE;
  const lit = office.allyDoorsUntil > time;
  ctx.globalAlpha = lit ? (office.reducedMotion ? 0.35 : 0.3 + 0.1 * Math.sin(time * 6)) : 0.14;
  rect(ctx, "#ffb050", x - 7, y - 21, 14, 21);
  ctx.globalAlpha = 1;
};

// ---------- juice helpers ----------
const tintCache = new Map<string, WeakMap<HTMLCanvasElement, HTMLCanvasElement>>();
const tinted = (src: HTMLCanvasElement, color: string): HTMLCanvasElement => {
  let perColor = tintCache.get(color);
  if (!perColor) {
    perColor = new WeakMap();
    tintCache.set(color, perColor);
  }
  let tintedCanvas = perColor.get(src);
  if (tintedCanvas) return tintedCanvas;
  tintedCanvas = document.createElement("canvas");
  tintedCanvas.width = src.width;
  tintedCanvas.height = src.height;
  const ctx = tintedCanvas.getContext("2d")!;
  ctx.drawImage(src, 0, 0);
  ctx.globalCompositeOperation = "source-in";
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, tintedCanvas.width, tintedCanvas.height);
  perColor.set(src, tintedCanvas);
  return tintedCanvas;
};
/** hit-stop: the struck pair's animation clock freezes for ~60ms */
const frozenTime = (emp: Employee, time: number) => (emp.hsUntil > time ? emp.hsAt : time);

const hpBar = (ctx: Ctx, cx: number, y: number, width: number, height: number, frac: number) => {
  const ratio = Math.max(0, Math.min(1, frac));
  rect(ctx, INK, cx - width / 2 - 1, y - 1, width + 2, height + 2);
  rect(ctx, "#5a1f2a", cx - width / 2, y, width, height);
  const fw = ratio > 0 ? Math.max(1, Math.round(width * ratio)) : 0;
  rect(ctx, ratio > 0.5 ? "#6fd36a" : ratio > 0.25 ? "#f2c14e" : "#ff5a5a", cx - width / 2, y, fw, height);
};

const WORLD_FONT =
  '600 6.5px ui-sans-serif, system-ui, "Sukhumvit Set", "Noto Sans Thai", "Apple Color Emoji", "Segoe UI Emoji", sans-serif';
const eob = (x: number) => {
  const overshoot = 1.70158,
    scale = overshoot + 1,
    k = x - 1;
  return 1 + scale * k * k * k + overshoot * k * k;
};

const outlined = (ctx: Ctx, text: string, x: number, y: number, fill: string) => {
  ctx.lineJoin = "round";
  ctx.lineWidth = 1.4;
  ctx.strokeStyle = INK;
  ctx.strokeText(text, x, y);
  ctx.fillStyle = fill;
  ctx.fillText(text, x, y);
};

/** `under`: the duel/territory particles, drawn before the entity pass (they fade, so they must never sit over a character) */
const drawParticles = (ctx: Ctx, office: Office, under: boolean) => {
  for (const particle of office.particles) {
    if (!particle.on || particle.under !== under) continue;
    const progress = particle.age / particle.life;
    ctx.globalAlpha = progress > 0.65 ? Math.max(0, (1 - progress) / 0.35) : 1;
    if (particle.spr) blitC(ctx, particle.spr, particle.x, particle.y);
    else rect(ctx, particle.col, particle.x, particle.y, particle.size, particle.size);
  }
  ctx.globalAlpha = 1;
};

const drawPopups = (ctx: Ctx, office: Office) => {
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  for (const popup of office.popups) {
    const progress = Math.max(0, Math.min(1, (office.clock - popup.born) / popup.dur));
    const y = popup.y - 12 * eob(Math.min(1, progress * 1.6));
    ctx.globalAlpha = progress > 0.7 ? Math.max(0, (1 - progress) / 0.3) : 1;
    ctx.font = popup.big
      ? "800 9px ui-sans-serif, system-ui, sans-serif"
      : "700 6.5px ui-sans-serif, system-ui, sans-serif";
    const x = Math.round(popup.x);
    outlined(ctx, popup.text, x, Math.round(y), popup.col);
    if (popup.star) blitC(ctx, "crit", x - Math.ceil(ctx.measureText(popup.text).width / 2) - 4, y);
  }
  ctx.globalAlpha = 1;
};

// ---- territory: claim flags, conflict lines and swords (all drawn as separate UI; never over/through characters' colours) ----
interface TLink {
  ax: number;
  ay: number;
  bx: number;
  by: number;
  ix: number;
  iy: number;
  level: "overlap" | "clash";
  ea: Employee | null;
  eb: Employee | null;
}
const linkPool: TLink[] = [];
let linkN = 0;
// badge sits above the heads: head top (CH_H) + tallest overhead bubble (17) + gap (6) + badge radius (7)
const ICON_R = 7,
  ICON_UP = CH_H + 17 + 6 + ICON_R,
  ICON_STEP = 6,
  ICON_TRIES = 4;
const hitsBox = (x0: number, y0: number, x1: number, y1: number, cx: number, cy: number): boolean => {
  return cx + ICON_R > x0 && cx - ICON_R < x1 && cy + ICON_R > y0 && cy - ICON_R < y1;
};
/** true if the badge box at (cx,cy) overlaps any visible adventurer / monster / boss sprite box */
const iconBlocked = (office: Office, cx: number, cy: number): boolean => {
  for (const emp of office.employees.values()) {
    if (office.isHidden(emp) || emp.state === "LEAVING") continue;
    if (hitsBox(emp.x - CH_W / 2, emp.y - CH_H, emp.x + CH_W / 2, emp.y, cx, cy)) return true;
    const pos = emp.monPos;
    if (pos && !emp.monDead) {
      const sprite = emp.boss ? bossSprite(emp.boss, 0, false) : monsterSprite(emp.monKind, 0, false);
      const mcx = pos.x + (emp.boss ? 4 : 0);
      if (hitsBox(mcx - sprite.width / 2, pos.y - sprite.height - 7, mcx + sprite.width / 2, pos.y, cx, cy))
        return true;
    }
  }
  return false;
};
const placeLinkIcon = (office: Office, link: TLink, topFeetY: number) => {
  const x = Math.max(ICON_R + 1, Math.min(WORLD_W - ICON_R - 1, Math.round((link.ax + link.bx) / 2)));
  let y = Math.round(topFeetY - ICON_UP);
  for (let k = 0; k < ICON_TRIES && y > ICON_R + 1 && iconBlocked(office, x, y); k++) y -= ICON_STEP;
  link.ix = x;
  link.iy = Math.max(ICON_R + 1, Math.min(WORLD_H - ICON_R - 1, y));
};

/** fills the shared pool; returns the live count */
const territoryLinks = (office: Office): number => {
  linkN = 0;
  for (const row of office.conflictRows()) {
    // cached in the engine; only rebuilt when territory/roster changes
    if (row.level === "clash" && office.isSettled(row)) continue; // fought out: the arena between the plots is cleared
    let first: Employee | null = null;
    for (let k = 0; k < row.sids.length; k++) {
      const emp = office.employees.get(row.sids[k]);
      if (
        !emp ||
        office.isHidden(emp) ||
        emp.state === "LEAVING" ||
        emp.x < 0 ||
        emp.x > WORLD_W ||
        emp.y < 0 ||
        emp.y > WORLD_H
      )
        continue;
      if (!first) {
        first = emp;
        continue;
      }
      const link =
        linkPool[linkN] ??
        (linkPool[linkN] = { ax: 0, ay: 0, bx: 0, by: 0, ix: 0, iy: 0, level: "overlap", ea: null, eb: null });
      link.ax = first.x;
      link.ay = first.y - 9;
      link.bx = emp.x;
      link.by = emp.y - 9;
      link.level = row.level;
      link.ea = first;
      link.eb = emp;
      placeLinkIcon(office, link, Math.min(first.y, emp.y));
      linkN++;
    }
  }
  return linkN;
};

// ---- territory: land plots, contested strip + flag ----
const ROPE = "#d9c38a";
/** claimed land: tinted ground + rope fence with stakes in the owner's colour. Drawn on the ground layer, before entities. */
const RA = { x: 0, y: 0, w: 0, h: 0 },
  RB = { x: 0, y: 0, w: 0, h: 0 },
  MID = { x: 0, y: 0 };
const drawPlots = (ctx: Ctx, office: Office) => {
  for (const emp of office.employees.values()) {
    if (office.isHidden(emp) || emp.deskIdx < 0 || emp.state === "LEAVING") continue;
    const claims = office.claimsOf(emp.id);
    if (claims <= 0) continue;
    const plot = plotRect(emp.deskIdx, claims, RA),
      color = emp.look.shirt;
    ctx.globalAlpha = 0.2;
    rect(ctx, color, plot.x, plot.y, plot.w, plot.h);
    ctx.globalAlpha = 0.14; // tilled-soil ticks
    for (let yy = plot.y + 4, row = 0; yy < plot.y + plot.h - 2; yy += 6, row++)
      for (let xx = plot.x + 4 + (row & 1) * 4; xx < plot.x + plot.w - 2; xx += 8) rect(ctx, "#ffffff", xx, yy, 2, 1);
    ctx.globalAlpha = 1;
    rect(ctx, ROPE, plot.x, plot.y, plot.w, 1);
    rect(ctx, ROPE, plot.x, plot.y + plot.h, plot.w + 1, 1);
    rect(ctx, ROPE, plot.x, plot.y, 1, plot.h);
    rect(ctx, ROPE, plot.x + plot.w, plot.y, 1, plot.h);
    for (let x = plot.x; x <= plot.x + plot.w; x += 8) {
      stake(ctx, x, plot.y, color);
      stake(ctx, x, plot.y + plot.h, color);
    }
    for (let y = plot.y + 8; y < plot.y + plot.h - 3; y += 8) {
      stake(ctx, plot.x, y, color);
      stake(ctx, plot.x + plot.w, y, color);
    }
    stake(ctx, plot.x + plot.w, plot.y, color);
    stake(ctx, plot.x + plot.w, plot.y + plot.h, color);
  }
};
const stake = (ctx: Ctx, x: number, y: number, color: string) => {
  rect(ctx, INK, x - 1, y - 3, 3, 5);
  rect(ctx, color, x, y - 2, 1, 3);
};
const inRect = (
  px: number,
  py: number,
  bounds: { x: number; y: number; w: number; h: number },
  margin: number,
): boolean => {
  return (
    px > bounds.x + margin &&
    px < bounds.x + bounds.w - margin &&
    py > bounds.y + margin &&
    py < bounds.y + bounds.h - margin
  );
};
/** between two linked plots: a checker of both owners' colours that swaps slowly (static under reduced motion), with the flag on it */
const drawContested = (ctx: Ctx, office: Office, linkCount: number, time: number) => {
  const still = office.reducedMotion;
  for (let i = 0; i < linkCount; i++) {
    const link = linkPool[i],
      empA = link.ea,
      empB = link.eb;
    if (!empA || !empB || empA.deskIdx < 0 || empB.deskIdx < 0 || empA.state === "LEAVING" || empB.state === "LEAVING")
      continue;
    const rectA = plotRect(empA.deskIdx, Math.max(1, office.claimsOf(empA.id)), RA),
      rectB = plotRect(empB.deskIdx, Math.max(1, office.claimsOf(empB.id)), RB);
    const ax = rectA.x + rectA.w / 2,
      ay = rectA.y + rectA.h / 2,
      bx = rectB.x + rectB.w / 2,
      by = rectB.y + rectB.h / 2;
    const dx = bx - ax,
      dy = by - ay,
      len = Math.hypot(dx, dy) || 1;
    const steps = Math.ceil(len / 4),
      nx = -dy / len,
      ny = dx / len;
    const flip = still ? 0 : Math.floor(time * (link.level === "clash" ? 3 : 1.4)) & 1;
    for (let k = 0; k <= steps; k++) {
      if (Math.abs(k - steps / 2) > 6) continue;
      const px = ax + (dx * k) / steps,
        py = ay + (dy * k) / steps;
      if (inRect(px, py, rectA, 4) || inRect(px, py, rectB, 4)) continue;
      for (let j = -3; j <= 3; j++) {
        const tx = Math.floor((px + nx * j * 4) / 4),
          ty = Math.floor((py + ny * j * 4) / 4);
        rect(ctx, ((tx + ty + flip) & 1) === 0 ? empA.look.shirt : empB.look.shirt, tx * 4, ty * 4, 4, 4);
      }
    }
    if (empA.deskIdx >= 0 && empB.deskIdx >= 0) drawMidFlag(ctx, office, link, empA, empB, time);
  }
};
const drawMidFlag = (ctx: Ctx, office: Office, link: TLink, empA: Employee, empB: Employee, time: number) => {
  const mid = duelMidOfDesks(empA.deskIdx, empB.deskIdx, MID);
  const x = mid.x,
    y = mid.y;
  shadow(ctx, x, y, 6);
  const tug = !office.reducedMotion && office.tugUntil(empA.id, empB.id) > office.clock;
  if (link.level === "clash") {
    // knocked over: stub, snapped pole on the ground, two torn scraps
    rect(ctx, INK, x - 1, y - 6, 3, 6);
    rect(ctx, "#8a6a3a", x, y - 5, 1, 5);
    rect(ctx, INK, x + 2, y - 3, 11, 4);
    rect(ctx, "#8a6a3a", x + 3, y - 2, 9, 2);
    rect(ctx, INK, x - 9, y - 1, 7, 4);
    rect(ctx, empA.look.shirt, x - 8, y, 5, 2);
    rect(ctx, INK, x + 9, y, 7, 4);
    rect(ctx, empB.look.shirt, x + 10, y + 1, 5, 2);
    return;
  }
  const sway = office.reducedMotion ? 0 : Math.round(Math.sin(time * (tug ? 14 : 2.4)) * (tug ? 5 : 2));
  rect(ctx, INK, x - 1, y - 17, 3, 17);
  rect(ctx, "#8a6a3a", x, y - 16, 1, 16);
  rect(ctx, INK, x + sway, y - 17, 12, 8);
  rect(ctx, empA.look.shirt, x + 1 + sway, y - 16, 5, 6);
  rect(ctx, empB.look.shirt, x + 6 + sway, y - 16, 5, 6);
};

// ---- territory duels ----
const DP = { pose: "idle" as Pose, frame: 0, dx: 0, dy: 0 };
// (built here, not via the engine: render <-> engine import each other, so no engine call may run at module load)
const mkScript = (): DuelScript => ({
  dx: 0,
  dy: 0,
  pose: "idle",
  frame: 0,
  hp: 0,
  ex: -1,
  q: 0,
  atk: -1,
  act: 0,
  stage: 0,
  fly: -1,
  big: false,
  ko: false,
  hit: false,
  stop: false,
});
const SA = mkScript(),
  SB = mkScript(),
  S0 = mkScript(),
  S1 = mkScript();
const CPT = { x: 0, y: 0 };
/** Fills DP for an adventurer in the fight phase of a (non-still) duel from the shared script; false = use the normal pose. */
/** the fight offset of this adventurer (0 outside a walking duel), written to DP.dx / DP.dy */
const duelOffsetInto = (emp: Employee, time: number) => {
  if (!(emp.duel && duelPoseInto(emp, emp.duel, frozenTime(emp, time)))) {
    DP.dx = 0;
    DP.dy = 0;
  }
};
const duelPoseInto = (emp: Employee, duel: Duel, time: number): boolean => {
  DP.dx = 0;
  DP.dy = 0;
  if (duel.phase !== "fight" || duel.still) return false;
  const script = duelScript(duel, duel.l === emp.id ? 0 : 1, time - duel.t0, SA);
  DP.pose = script.pose;
  DP.frame = script.frame;
  DP.dx = script.dx;
  DP.dy = script.dy;
  return true;
};

const pxLine = (
  ctx: Ctx,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  color: string,
  thickness: number,
  wig = 0,
  time = 0,
) => {
  const count = Math.max(1, Math.round(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0))));
  ctx.fillStyle = color;
  for (let i = 0; i <= count; i++) {
    const progress = i / count,
      offset = wig ? Math.round(Math.sin(i * 0.7 + time * 30) * wig * Math.sin(progress * Math.PI)) : 0;
    ctx.fillRect(
      Math.round(x0 + (x1 - x0) * progress - thickness / 2),
      Math.round(y0 + (y1 - y0) * progress - thickness / 2 + offset),
      thickness,
      thickness,
    );
  }
};
const blade = (ctx: Ctx, hx: number, hy: number, tx: number, ty: number) => {
  pxLine(ctx, hx, hy, tx, ty, INK, 3);
  pxLine(ctx, hx, hy, tx, ty, "#d8dde8", 1);
  rect(ctx, GOLD, Math.round(hx) - 1, Math.round(hy) - 1, 3, 3);
};
const arrowPx = (ctx: Ctx, x: number, y: number, dir: number) => {
  const x0 = Math.round(x),
    y0 = Math.round(y);
  rect(ctx, INK, x0 - 4, y0 - 1, 9, 3);
  rect(ctx, "#c69c6d", x0 - 3, y0, 6, 1);
  rect(ctx, "#d8dde8", dir > 0 ? x0 + 3 : x0 - 4, y0, 2, 1);
  rect(ctx, "#ffffff", dir > 0 ? x0 - 4 : x0 + 3, y0 - 1, 1, 3);
};
/** a hit on a monster, by class: warrior/rogue slash, ranger looses an arrow that flies in, mage/cleric a spell burst. p = 0..1 progress */
const hitFx = (ctx: Ctx, emp: Employee, mx: number, my: number, time: number, rate: number, progress: number) => {
  const cls = emp.look.cls;
  if (cls === "ranger") {
    const sx = emp.x + 11,
      sy = emp.y - 14,
      k = Math.min(1, progress / 0.6);
    if (k < 1) arrowPx(ctx, sx + (mx - 4 - sx) * k, sy + (my - 10 - sy) * k, 1);
    else {
      arrowPx(ctx, mx - 4, my - 10, 1);
      blitC(ctx, "spark" + (Math.floor(time * rate) % 2), mx - 2, my - 10);
    }
  } else if (cls === "mage" || cls === "cleric") {
    blitC(ctx, "magic" + (Math.floor(time * rate) % 2), mx - 5, my - 10);
    blitC(ctx, "spark" + (Math.floor(time * rate + 1) % 2), mx - 1, my - 12);
  } else blitC(ctx, "slash" + (Math.floor(time * rate) % 2), mx - 3, my - 9);
};
const magicCol = (emp: Employee) => (emp.look.cls === "cleric" ? "#ffe27a" : "#b07bff");
const crown = (ctx: Ctx, x: number, y: number, time: number) => {
  const cx = Math.round(x),
    cy = Math.round(y - Math.abs(Math.sin(time * 5)) * 1.5);
  rect(ctx, INK, cx - 4, cy - 1, 9, 6);
  rect(ctx, "#f2c14e", cx - 3, cy + 1, 7, 3);
  rect(ctx, "#f2c14e", cx - 3, cy, 1, 1);
  rect(ctx, "#f2c14e", cx, cy - 1, 1, 2);
  rect(ctx, "#f2c14e", cx + 3, cy, 1, 1);
  rect(ctx, "#d95763", cx, cy + 2, 1, 1);
  rect(ctx, "#fff6c0", cx - 3, cy + 1, 7, 1);
};
const drawVs = (ctx: Ctx, leftEmp: Employee, rightEmp: Employee, x: number, y: number) => {
  ctx.font = "800 6px ui-sans-serif, system-ui, sans-serif";
  ctx.textBaseline = "middle";
  ctx.textAlign = "right";
  const wl = Math.ceil(ctx.measureText(leftEmp.tag).width),
    wr = Math.ceil(ctx.measureText(rightEmp.tag).width);
  const width = wl + wr + 22,
    height = 10;
  const bx = Math.max(2, Math.min(WORLD_W - width - 2, Math.round(x - width / 2))),
    by = Math.round(y - height / 2);
  rect(ctx, INK, bx - 1, by - 1, width + 2, height + 2);
  rect(ctx, "#ecd9a2", bx, by, width, height);
  rect(ctx, "#f6e8bf", bx, by, width, 2);
  rect(ctx, leftEmp.look.shirt, bx, by, 2, height);
  rect(ctx, rightEmp.look.shirt, bx + width - 2, by, 2, height);
  ctx.fillStyle = "#3b2418";
  ctx.fillText(leftEmp.tag, bx + 3 + wl, by + height / 2 + 0.5);
  ctx.textAlign = "center";
  ctx.fillStyle = "#b8232f";
  ctx.fillText("VS", bx + width / 2, by + height / 2 + 0.5);
  ctx.textAlign = "left";
  ctx.fillStyle = "#3b2418";
  ctx.fillText(rightEmp.tag, bx + width - 3 - wr, by + height / 2 + 0.5);
};

/** integer-aligned pixel disc, left half `cl`, right half `cr` (alpha 1) */
const pxDisc = (ctx: Ctx, cx: number, cy: number, radius: number, colorLeft: string, colorRight: string) => {
  for (let dy = -radius; dy <= radius; dy++) {
    const span = Math.floor(Math.sqrt(radius * radius - dy * dy) + 0.5);
    rect(ctx, colorLeft, cx - span, cy + dy, span, 1);
    rect(ctx, colorRight, cx, cy + dy, span + 1, 1);
  }
};
/** big opaque impact star (alpha 1) */
const impactStar = (ctx: Ctx, x: number, y: number, radius: number, color: string) => {
  const inset = Math.round(radius * 0.7);
  pxLine(ctx, x - radius, y, x + radius, y, INK, 5);
  pxLine(ctx, x, y - radius, x, y + radius, INK, 5);
  pxLine(ctx, x - inset, y - inset, x + inset, y + inset, INK, 3);
  pxLine(ctx, x - inset, y + inset, x + inset, y - inset, INK, 3);
  pxLine(ctx, x - radius + 1, y, x + radius - 1, y, color, 3);
  pxLine(ctx, x, y - radius + 1, x, y + radius - 1, color, 3);
  pxLine(ctx, x - inset, y - inset, x + inset, y + inset, color, 1);
  pxLine(ctx, x - inset, y + inset, x + inset, y - inset, color, 1);
  pxLine(ctx, x - radius + 2, y, x + radius - 2, y, "#ffffff", 1);
  pxLine(ctx, x, y - radius + 2, x, y + radius - 2, "#ffffff", 1);
  rect(ctx, "#ffffff", x - 1, y - 1, 3, 3);
};
/** the duel HP bar above a head: INK frame, DUEL_PIPS pips (alpha 1), 2px clear of the sprite box */
const drawHpBar = (ctx: Ctx, x: number, y: number, hp: number) => {
  const bx = Math.round(x) - 8,
    by = Math.round(y) - CH_H - 7;
  rect(ctx, INK, bx, by, 16, 5);
  for (let i = 0; i < DUEL_PIPS; i++) {
    const lit = i < hp;
    rect(ctx, lit ? "#e8534a" : "#2b2233", bx + 1 + i * 5, by + 1, 4, 3);
    if (lit) rect(ctx, "#ff9a8a", bx + 1 + i * 5, by + 1, 4, 1);
  }
};
const starDot = (ctx: Ctx, x: number, y: number) => {
  rect(ctx, INK, x - 2, y - 1, 5, 3);
  rect(ctx, INK, x - 1, y - 2, 3, 5);
  rect(ctx, "#ffe14a", x - 1, y, 3, 1);
  rect(ctx, "#ffe14a", x, y - 1, 1, 3);
  rect(ctx, "#ffffff", x, y, 1, 1);
};
const dirtEdge = "#4f3a22",
  dirtFill = "#8b6b44",
  dirtLite = "#9c7b52";
/** ground pass (before entities): the dirt arena under a walking duel, opaque */
const drawArenas = (ctx: Ctx, office: Office) => {
  for (const duel of office.duels) {
    if (duel.phase !== "fight" || duel.still) continue;
    const leftEmp = office.employees.get(duel.l),
      rightEmp = office.employees.get(duel.r);
    if (!leftEmp || !rightEmp || office.isHidden(leftEmp) || office.isHidden(rightEmp)) continue;
    const cx = Math.round((leftEmp.x + rightEmp.x) / 2),
      cy = Math.round((leftEmp.y + rightEmp.y) / 2) + 1,
      rx = Math.round(Math.abs(rightEmp.x - leftEmp.x) / 2) + 14,
      ry = 11;
    for (let dy = -ry; dy <= ry; dy++) {
      const span = Math.floor(rx * Math.sqrt(1 - (dy * dy) / (ry * ry)) + 0.5);
      rect(ctx, dirtEdge, cx - span, cy + dy, span * 2 + 1, 1);
      if (Math.abs(dy) < ry) {
        const innerSpan = Math.max(0, span - 2);
        rect(ctx, dirtFill, cx - innerSpan, cy + dy, innerSpan * 2 + 1, 1);
      }
    }
    for (let k = 0; k < 14; k++)
      rect(ctx, dirtLite, cx - rx + 8 + ((k * 37) % (rx * 2 - 16)), cy - ry + 3 + ((k * 53) % (ry * 2 - 5)), 2, 1);
  }
};

/**
 * Everything here reads the same script as the poses (duelScript) so effects land on the DRAWN bodies. All of it is opaque (alpha 1)
 * and drawn after the entity pass; the only fading effects are `under` particles (see the engine). Pips and KO stars sit above the heads.
 */
const koStars = (ctx: Ctx, emp: Employee, script: DuelScript, time: number) => {
  if (!script.ko) return;
  const sx = Math.round(emp.x + script.dx),
    sy = Math.round(emp.y + script.dy - CH_H - 14);
  for (let k = 0; k < 3; k++) {
    const angle = time * 6 + k * 2.094;
    starDot(ctx, sx + Math.round(Math.cos(angle) * 7), sy + Math.round(Math.sin(angle) * 2.5));
  }
};
const drawDuels = (ctx: Ctx, office: Office, time: number) => {
  for (const duel of office.duels) {
    if (duel.phase !== "fight") continue;
    const leftEmp = office.employees.get(duel.l),
      rightEmp = office.employees.get(duel.r);
    if (!leftEmp || !rightEmp || office.isHidden(leftEmp) || office.isHidden(rightEmp)) continue;
    const progress = time - duel.t0;
    const top = Math.min(leftEmp.y, rightEmp.y) - CH_H - 14;
    if (duel.still || progress < 1.8) drawVs(ctx, leftEmp, rightEmp, (leftEmp.x + rightEmp.x) / 2, top);
    if (duel.still) continue;
    if (progress >= DUEL_FLOURISH) {
      const winner = duel.winner === 0 ? leftEmp : rightEmp,
        lo = duel.winner === 0 ? rightEmp : leftEmp,
        ls = duelScript(duel, duel.winner === 0 ? 1 : 0, progress, SB);
      crown(ctx, winner.x, winner.y - CH_H - 7, time);
      if (ls.ko) {
        const sx = Math.round(lo.x + ls.dx),
          sy = Math.round(lo.y + ls.dy - CH_H - 14);
        for (let k = 0; k < 3; k++) {
          const angle = time * 6 + k * 2.094;
          starDot(ctx, sx + Math.round(Math.cos(angle) * 7), sy + Math.round(Math.sin(angle) * 2.5));
        }
      }
      continue;
    }
    const s0 = duelScript(duel, 0, progress, S0),
      s1 = duelScript(duel, 1, progress, S1);
    drawHpBar(ctx, leftEmp.x + s0.dx, leftEmp.y, s0.hp);
    drawHpBar(ctx, rightEmp.x + s1.dx, rightEmp.y, s1.hp);
    if (s0.ex < 0) continue;
    koStars(ctx, leftEmp, s0, time);
    koStars(ctx, rightEmp, s1, time); // KO stars (final blow, before the flourish)
    const impact = s0.big ? DUEL_IMPACT_FINAL : DUEL_IMPACT,
      stopLen = s0.big ? DUEL_STOP_FINAL : DUEL_STOP;
    const contact = duelContact(leftEmp, rightEmp, s0, CPT),
      cx = Math.round(contact.x),
      cy = Math.round(contact.y);
    const since = s0.q - impact; // seconds since the impact
    if (s0.atk < 0) {
      // blade lock: both blades cross at the contact point
      if (s0.stage >= 2 && since < 0.3) {
        blade(ctx, leftEmp.x + s0.dx + 9, leftEmp.y - 15, cx + 3, cy - 4);
        blade(ctx, rightEmp.x + s1.dx - 9, rightEmp.y - 15, cx - 3, cy - 4);
      }
      if (since >= 0 && since < 0.3) impactStar(ctx, cx, cy - 2, since < stopLen ? 9 : since < 0.2 ? 7 : 5, "#ffe14a");
      continue;
    }
    const attacker = s0.atk === 0 ? leftEmp : rightEmp,
      sa = s0.atk === 0 ? s0 : s1,
      dirA = s0.atk === 0 ? 1 : -1;
    const style = s0.atk === 0 ? duel.styleL : duel.styleR;
    const hx = attacker.x + sa.dx + dirA * 10,
      hy = attacker.y - 15;
    if (s0.act === 1) {
      if (s0.stage === 2)
        for (let k = 0; k < 3; k++)
          rect(
            ctx,
            "#ffffff",
            Math.round(attacker.x + sa.dx - dirA * (11 + k * 4)) - (dirA > 0 ? 3 : 0),
            Math.round(attacker.y - 8 - k * 5),
            4,
            1,
          ); // speed lines
      if (since >= 0 && since < 0.2) {
        // slash across the contact point
        pxLine(ctx, cx - dirA * 5, cy - 8, cx + dirA * 3, cy + 7, INK, 4);
        pxLine(ctx, cx - dirA * 5, cy - 8, cx + dirA * 3, cy + 7, "#ffffff", 2);
      }
    } else if (s0.stage === 2 && sa.fly >= 0) {
      // projectile in flight, ends on the defender's body
      const flight = sa.fly,
        ex = contact.x - dirA * (style === "arrow" ? 4 : 3);
      const px = hx + (ex - hx) * flight,
        py = hy + (contact.y - hy) * flight;
      if (style === "arrow") arrowPx(ctx, px, py, dirA);
      else {
        const radius = s0.big ? 4 : 3,
          color = magicCol(attacker),
          px0 = Math.round(px),
          py0 = Math.round(py);
        for (let k = 3; k >= 1; k--) rect(ctx, k === 1 ? "#ffffff" : color, px0 - dirA * k * 3 - 1, py0 - 1, 3, 3);
        pxDisc(ctx, px0, py0, radius + 1, INK, INK);
        pxDisc(ctx, px0, py0, radius, color, color);
        rect(ctx, "#ffffff", px0 - 1, py0 - 1, 3, 3);
      }
    }
    if (since >= 0 && since < stopLen + (s0.big ? 0.3 : 0.14)) {
      const radius = (s0.big ? 8 : 5) - (since > stopLen ? 2 : 0);
      impactStar(ctx, cx, cy, radius, s0.big ? "#ff4a4a" : style === "magic" ? magicCol(attacker) : "#ffe14a");
    }
  }
};

const drawClaimFlags = (ctx: Ctx, office: Office, time: number) => {
  for (const emp of office.employees.values()) {
    if (office.isHidden(emp) || emp.deskIdx < 0 || emp.state === "LEAVING") continue;
    const claims = office.claimsOf(emp.id);
    if (claims <= 0) continue;
    const spot = spotOf(emp.deskIdx);
    const fx = Math.round(spot.x - 29),
      fy = Math.round(spot.y + 3);
    const wave = office.reducedMotion ? 0 : Math.round(Math.sin(time * 3 + emp.order));
    shadow(ctx, fx, fy, 3);
    rect(ctx, INK, fx, fy - 15, 2, 15); // pole
    rect(ctx, "#8a6a3a", fx, fy - 14, 1, 14);
    rect(ctx, INK, fx + 2, fy - 15, 9, 8); // cloth outline
    rect(ctx, emp.look.shirt, fx + 2, fy - 14, 8, 6 + wave);
    rect(ctx, "rgba(255,255,255,0.35)", fx + 2, fy - 14, 8, 1);
    ctx.font = "800 6px ui-sans-serif, system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    outlined(ctx, String(claims), fx + 12, fy - 10, CREAM);
  }
};

const drawLinks = (ctx: Ctx, linkCount: number, time: number, office: Office) => {
  if (!linkCount) return;
  ctx.save();
  ctx.lineCap = "butt";
  for (let i = 0; i < linkCount; i++) {
    const link = linkPool[i];
    const color = link.level === "clash" ? "#ff4a4a" : "#ffd94a";
    ctx.setLineDash([3, 2]);
    ctx.lineDashOffset = office.reducedMotion ? 0 : -(time * (link.level === "clash" ? 10 : 5));
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.moveTo(link.ax, link.ay);
    ctx.lineTo(link.bx, link.by);
    ctx.stroke();
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(link.ax, link.ay);
    ctx.lineTo(link.bx, link.by);
    ctx.stroke();
  }
  ctx.setLineDash([]);
  ctx.lineWidth = 1; // thin tick from the link up to its badge (drawn under entities, so it never covers a character)
  for (let i = 0; i < linkCount; i++) {
    const link = linkPool[i];
    ctx.strokeStyle = link.level === "clash" ? "#ff4a4a" : "#ffd94a";
    const mx = Math.round((link.ax + link.bx) / 2) + 0.5,
      my = (link.ay + link.by) / 2;
    ctx.beginPath();
    ctx.moveTo(mx, my);
    ctx.lineTo(link.ix + 0.5, link.iy + ICON_R);
    ctx.stroke();
  }
  ctx.restore();
};

const SWORD_BACKDROP = "#1a1c2c"; // fully opaque: nothing translucent in the territory layer
const drawSwords = (ctx: Ctx, x: number, y: number, color: string, k: number) => {
  ctx.save();
  ctx.translate(Math.round(x), Math.round(y));
  ctx.scale(k, k);
  ctx.fillStyle = SWORD_BACKDROP;
  ctx.beginPath();
  ctx.arc(0, 0, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.lineCap = "round";
  for (let pass = 0; pass < 2; pass++) {
    ctx.strokeStyle = pass === 0 ? INK : color;
    ctx.lineWidth = pass === 0 ? 2.4 : 1.2;
    ctx.beginPath();
    ctx.moveTo(-4, -4);
    ctx.lineTo(4, 4);
    ctx.moveTo(4, -4);
    ctx.lineTo(-4, 4);
    ctx.stroke();
    if (pass === 1) {
      ctx.strokeStyle = CREAM;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(-2.4, 1.4);
      ctx.lineTo(-0.6, 3.2);
      ctx.moveTo(2.4, 1.4);
      ctx.lineTo(0.6, 3.2);
      ctx.stroke();
    }
  }
  ctx.restore();
};

const drawLinkIcons = (ctx: Ctx, linkCount: number, time: number, office: Office) => {
  for (let i = 0; i < linkCount; i++) {
    const link = linkPool[i];
    const mx = link.ix,
      my = link.iy;
    if (link.level === "clash") {
      const phase = office.reducedMotion ? 0 : Math.sin(time * 5);
      drawSwords(ctx, mx, my, "#ff5a5a", 1 + 0.1 * phase);
      if (!office.reducedMotion && Math.sin(time * 2.2) > 0.7) {
        // gentle glint
        rect(ctx, "#ffffff", mx + 3, my - 6, 1, 3);
        rect(ctx, "#ffffff", mx + 2, my - 5, 3, 1);
      }
    } else drawSwords(ctx, mx, my, "#ffd94a", 0.85);
  }
};

const drawBannerQ = (ctx: Ctx, office: Office) => {
  const banner = office.banners[0];
  if (!banner) return;
  if (banner.start < 0) banner.start = office.realTime;
  const elapsed = office.realTime - banner.start;
  const slide = Math.min(1, elapsed / 0.25, Math.max(0, (banner.dur - elapsed) / 0.25));
  const boss = banner.kind === "boss";
  ctx.font = boss ? "800 8px ui-sans-serif, system-ui, sans-serif" : WORLD_FONT;
  const width = Math.ceil(ctx.measureText(banner.text).width) + 22,
    height = 15;
  const x = Math.round((WORLD_W - width) / 2),
    y = Math.round(-height - 2 + (height + 8) * eob(Math.max(0, slide)));
  rect(ctx, "rgba(0,0,0,0.3)", x + 1, y + 2, width, height);
  rect(ctx, INK, x - 3, y - 1, width + 6, height + 2);
  rect(ctx, boss ? "#5a1a22" : "#ecd9a2", x, y, width, height);
  rect(ctx, boss ? "#8a2a34" : "#f6e8bf", x, y, width, 2);
  rect(ctx, boss ? "#3a0f16" : "#c9a45e", x - 2, y, 3, height);
  rect(ctx, boss ? "#3a0f16" : "#c9a45e", x + width - 1, y, 3, height);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = boss ? "#ffdede" : "#3b2418";
  ctx.fillText(banner.text, WORLD_W / 2, y + height / 2 + 0.5);
};

let vignette: HTMLCanvasElement | null = null;
const VIG_EDGE = 10;
const drawAlertVignette = (ctx: Ctx, office: Office) => {
  let age = Infinity; // age of the freshest alert: a long-standing one calms down
  for (const emp of office.employees.values()) {
    // hidden (filtered) waiting sessions still raise the alert
    if (waitsOnYou(emp)) age = Math.min(age, office.clock - emp.actSince);
    for (const it of emp.interns.values()) if (it.act === "handup") age = Math.min(age, office.clock - it.since);
  }
  if (age === Infinity) return;
  if (!vignette) {
    // edge-only ring (never reaches further than VIG_EDGE px in), so it can't tint characters
    const layer = mk();
    vignette = layer.cv;
    for (let i = 0; i < VIG_EDGE; i++) {
      layer.c.fillStyle = `rgba(255,30,30,${(0.85 * (1 - i / VIG_EDGE) ** 2).toFixed(3)})`;
      layer.c.fillRect(i, i, WORLD_W - 2 * i, 1);
      layer.c.fillRect(i, WORLD_H - 1 - i, WORLD_W - 2 * i, 1);
      layer.c.fillRect(i, i + 1, 1, WORLD_H - 2 * i - 2);
      layer.c.fillRect(WORLD_W - 1 - i, i + 1, 1, WORLD_H - 2 * i - 2);
    }
  }
  const calm = age > 60;
  ctx.globalAlpha = calm ? 0.2 + 0.1 * Math.sin(office.realTime * 1.5) : 0.4 + 0.3 * Math.sin(office.realTime * 5);
  ctx.drawImage(vignette, 0, 0);
  ctx.globalAlpha = 1;
};

// rain: fixed pseudo-random drops, positions derived from time (no per-frame allocation)
const DROPS = (() => {
  const rand = rng(77);
  return Array.from({ length: 110 }, () => ({ x: rand() * WORLD_W, y: rand() * WORLD_H, v: 110 + rand() * 60 }));
})();
const drawRain = (ctx: Ctx, office: Office) => {
  const dropCount = Math.min(DROPS.length, Math.round(DROPS.length * office.rain));
  if (dropCount <= 0) return;
  ctx.strokeStyle = "rgba(200,222,255,0.6)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let i = 0; i < dropCount; i++) {
    const drop = DROPS[i];
    const y = ((drop.y + office.ambT * drop.v) % (WORLD_H + 12)) - 6;
    const x = (drop.x + office.ambT * drop.v * 0.3) % WORLD_W;
    if (x < HALL_W - 2) continue; // the guild hall has a roof
    const px = Math.round(x),
      py = Math.round(y);
    ctx.moveTo(px, py);
    ctx.lineTo(px - 2, py + 5);
  }
  ctx.stroke();
};

const onTavernRest = (emp: Employee): boolean =>
  emp.state === "TO_TAVERN_REST" || emp.state === "AT_TAVERN_REST" || emp.state === "FROM_TAVERN_REST";
/** a hand is up: seated, or on the way to / from the well (the ❗ must not wait for the walk to end) */
const waitsOnYou = (emp: Employee): boolean => emp.act === "handup" && (emp.state === "SEATED" || onTavernRest(emp));

// ---------- squires ----------
const drawBadge = (ctx: Ctx, txt: string, x: number, y: number) => {
  ctx.font = TAG_FONT;
  ctx.textBaseline = "middle";
  ctx.textAlign = "center";
  const width = Math.ceil(ctx.measureText(txt).width) + 4;
  ctx.fillStyle = "rgba(35,37,58,0.92)";
  roundRect(ctx, x - width / 2, y - 6, width, 7, 2);
  ctx.fill();
  ctx.fillStyle = CREAM;
  ctx.fillText(txt, x, y - 2.3);
};

type Squire = Employee["interns"] extends Map<string, infer V> ? V : never;
/** a squire on the move (out of the portal to its master, or back in): walk frames, mirrored when heading left */
const drawSquireWalk = (ctx: Ctx, x: number, y: number, face: 1 | -1, time: number) => {
  shadow(ctx, x, y, 8);
  const frame = Math.floor(time * 8) % 2;
  const sprite = internSprite("walk", frame);
  const px = Math.round(x - sprite.width / 2),
    py = Math.round(y - sprite.height) - frame;
  if (face < 0) {
    ctx.save();
    ctx.translate(px + sprite.width, py);
    ctx.scale(-1, 1);
    ctx.drawImage(sprite, 0, 0);
    ctx.restore();
  } else ctx.drawImage(sprite, px, py);
};

const drawSquire = (ctx: Ctx, emp: Employee, it: Squire, k: number, time: number) => {
  if (it.phase === "in") {
    drawSquireWalk(ctx, it.x, it.y, it.face, time);
    return;
  }
  const spot = it.phase === "snap" ? squireSpotOf(emp, k) : { x: it.x, y: it.y };
  shadow(ctx, spot.x, spot.y, 8);
  let sprite: HTMLCanvasElement;
  let dx = 0;
  if (it.act === "typing") {
    const frame = Math.floor(time * 6) % 2;
    sprite = internSprite("attack", frame);
    dx = frame ? 2 : 0;
  } else if (it.act === "reading") sprite = internSprite("read", Math.floor(time * 3) % 2);
  else if (it.act === "handup") sprite = internSprite("hand_up", Math.floor(time * 4) % 2);
  else sprite = internSprite("idle", Math.floor(time * 1.5 + k) % 2);
  ctx.drawImage(sprite, Math.round(spot.x - sprite.width / 2 + dx), Math.round(spot.y - sprite.height));
  const top = spot.y - sprite.height;
  if (it.act === "handup") {
    if (Math.floor(time * 4) % 2 === 0) drawBubble(ctx, spot.x, top, "❗");
  } else if (it.act === "reading") drawBubble(ctx, spot.x, top, "📜");
  else if (it.act === "typing") drawBubble(ctx, spot.x, top, "⚔️");
};

// ---------- adventurers ----------
const squireSpotOf = (emp: Employee, slot: number) =>
  emp.deskIdx >= 0 ? squirePoint(emp.deskIdx, slot) : campSquirePoint(emp.slot, slot);
let duelDxNow = 0,
  duelDyNow = 0;
const poseFor = (emp: Employee, time: number): { pose: Pose; frame: number } => {
  duelDxNow = 0;
  duelDyNow = 0;
  if (emp.duel && duelPoseInto(emp, emp.duel, time)) {
    duelDxNow = DP.dx;
    duelDyNow = DP.dy;
    return { pose: DP.pose, frame: DP.frame };
  }
  switch (emp.state) {
    case "DUEL":
      return emp.path.length
        ? { pose: "walk", frame: Math.floor(time * 8) % 4 }
        : { pose: "idle", frame: Math.floor(time * 4) % 2 };
    case "ENTERING":
    case "LEAVING":
    case "TO_COFFEE":
    case "FROM_COFFEE":
      if (emp.holdUntil > time)
        return emp.state === "LEAVING"
          ? { pose: "cheer", frame: Math.floor(time * 4) % 2 }
          : { pose: "idle", frame: 0 };
      return { pose: "walk", frame: Math.floor(time * 8) % 4 };
    case "TO_TAVERN_REST":
    case "FROM_TAVERN_REST":
      return { pose: "walk", frame: Math.floor(time * 8) % 4 };
    case "AT_TAVERN_REST":
      return { pose: "drink", frame: Math.floor(time * 1.5) % 2 };
    case "STRETCH":
      return { pose: "cheer", frame: Math.floor(time * 3) % 2 };
    case "DRINK":
      return { pose: "drink", frame: Math.floor(time * 1.5) % 2 };
  }
  if (emp.resting) return { pose: "rest", frame: Math.floor(time * 1.2) % 2 };
  if (emp.hurtUntil > time) return { pose: "hurt", frame: Math.floor(time * 10) % 2 };
  const hasMon = !!emp.monPos && !emp.monDead && !emp.bossPath.length; // a boss still walking out is too far to fight
  switch (emp.act) {
    case "typing":
    case "mcp":
      return { pose: hasMon || emp.act === "mcp" ? "cast" : "idle", frame: Math.floor(time * 8) % 2 };
    case "bash":
      return { pose: hasMon ? "attack" : "idle", frame: Math.floor(time * 5) % 2 };
    case "reading":
      return { pose: "read", frame: Math.floor(time * 3) % 2 };
    case "sticky":
      return { pose: "write", frame: Math.floor(time * 6) % 2 };
    case "handup":
      return { pose: "hand_up", frame: Math.floor(time * 4) % 2 };
    case "phone":
      return { pose: "idle", frame: Math.floor(time * 1.5) % 2 };
    default:
      return { pose: "idle", frame: Math.floor(time * 1.5) % 2 };
  }
};

const drawAdventurer = (ctx: Ctx, emp: Employee, time: number) => {
  const { pose, frame } = poseFor(emp, time);
  const sprite = charSprite(emp.look, pose, frame);
  shadow(ctx, emp.x + duelDxNow, emp.y, 11);
  const hurt = emp.state === "SEATED" && emp.hurtUntil > time;
  if (hurt) {
    // red flash behind the (opaque) sprite
    ctx.globalAlpha = 0.18 + 0.22 * Math.abs(Math.sin(time * 16));
    ctx.fillStyle = "#ff3b3b";
    ctx.beginPath();
    ctx.arc(emp.x, emp.y - 12, 13, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
  const bob = pose === "walk" && frame % 2 === 1 ? -1 : 0;
  let dx = 0;
  const fighting = emp.state === "SEATED" && emp.deskIdx >= 0 && !emp.resting;
  if (emp.state === "SEATED" && pose === "attack" && frame === 1) dx = 3;
  if (fighting && emp.windupUntil > time) dx = -2; // anticipation: lean back before the strike
  if (fighting && emp.lungeUntil > time) dx = 3;
  if (hurt) dx = -2;
  if (duelDxNow) dx = duelDxNow;
  const px = Math.round(emp.x - CH_W / 2 + dx),
    py = Math.round(emp.y - CH_H + bob + duelDyNow);
  const red = emp.redUntil > time && emp.state === "SEATED";
  const put = (img: HTMLCanvasElement, alpha: number) => {
    ctx.globalAlpha = alpha;
    if (emp.facing < 0) {
      ctx.save();
      ctx.translate(px + CH_W, py);
      ctx.scale(-1, 1);
      ctx.drawImage(img, 0, 0);
      ctx.restore();
    } else ctx.drawImage(img, px, py);
    ctx.globalAlpha = 1;
  };
  put(sprite, 1);
  if (red) put(tinted(sprite, "#ff2a2a"), 0.4 + 0.2 * Math.sin(time * 40));
};

const drawMonster = (ctx: Ctx, emp: Employee, time: number) => {
  const pos = emp.monPos;
  if (!pos) return;
  if (!emp.monDead) {
    const age = time - emp.monAppearAt;
    if (age < 0.5) blitC(ctx, "poof" + (Math.floor(age * 8) % 2), pos.x, pos.y - 8);
    if (age < 0.2) return;
    const seated = emp.state === "SEATED";
    const asleep = emp.resting;
    const walking = emp.bossPath.length > 0; // a boss still walking out of the dungeon gate
    const hit =
      seated &&
      !asleep &&
      !walking &&
      ((emp.act === "bash" && (time * 2.5) % 1 < 0.3) || (emp.act === "typing" && (time * 3) % 1 < 0.2));
    const frame = asleep ? 0 : Math.floor(time * 3 + emp.order) % 2;
    let lunge = 0;
    if (emp.monLungeUntil > time)
      lunge = -Math.round(9 * Math.sin(Math.min(1, 1 - (emp.monLungeUntil - time) / 0.4) * Math.PI));
    else if (emp.hurtUntil > time) lunge = -3;
    if (emp.monKnockUntil > time) lunge += 2;
    const boss = emp.boss;
    const sprite = boss ? bossSprite(boss, frame, hit) : monsterSprite(emp.monKind, frame, hit);
    const cx = pos.x + (boss ? 4 : 0);
    shadow(ctx, cx, pos.y, Math.min(boss ? 22 : 14, sprite.width));
    const bob = asleep || Math.floor(time * 2 + emp.order) % 2 === 0 ? 0 : -1;
    const sx = Math.round(cx - sprite.width / 2 + lunge + (hit ? 1 : 0)),
      sy = Math.round(pos.y - sprite.height + bob);
    if (walking && emp.bossFace > 0) {
      // sprites face left: mirror while the boss heads right
      ctx.save();
      ctx.translate(sx + sprite.width, sy);
      ctx.scale(-1, 1);
      ctx.drawImage(sprite, 0, 0);
      ctx.restore();
    } else ctx.drawImage(sprite, sx, sy);
    if (emp.flashUntil > time) ctx.drawImage(tinted(sprite, "#ffffff"), sx, sy);
    if (emp.monLungeUntil > time) {
      ctx.globalAlpha = 0.3;
      ctx.drawImage(tinted(sprite, "#ff2a2a"), sx, sy);
      ctx.globalAlpha = 1;
    }
    // HP bar
    const top = Math.round(pos.y - sprite.height) - (boss ? 6 : 5);
    if (boss) hpBar(ctx, Math.round(cx), top, 24, 3, Math.max(0.12, 1 - (time - emp.bossAt) / 120));
    else hpBar(ctx, Math.round(cx), top, 12, 2, emp.monHp / emp.monHpMax);
    if (asleep) blitC(ctx, "zzz", cx + 6, top - 5 - (Math.floor(time * 1.5) % 2));
  } else {
    const dage = time - emp.monDeadAt;
    if (dage < 0.5) blitC(ctx, "poof" + (Math.floor(dage * 8) % 2), pos.x, pos.y - 8);
    if (emp.monLoot && dage < 1.3) {
      const progress = dage / 1.3;
      ctx.globalAlpha = progress < 0.75 ? 1 : (1 - progress) * 4;
      blitC(ctx, "coin", pos.x - 2, pos.y - 8 - Math.sin(Math.min(1, progress * 1.3) * Math.PI * 0.6) * 14);
      if (dage > 0.25) blitC(ctx, "coin", pos.x + 4, pos.y - 6 - (dage - 0.25) * 10);
      ctx.globalAlpha = 1;
    }
  }
};

/** context-window "mana": 12x2 under the hearts, below the feet so it never covers the sprite. Unknown = not drawn. */
const manaBar = (ctx: Ctx, emp: Employee, time: number, office: Office) => {
  const frac = office.ctxFrac(emp.id);
  if (frac === null) return;
  const width = 12,
    x = Math.round(emp.x - width / 2),
    y = Math.round(emp.y + 13);
  const color =
    emp.manaFlashUntil > time
      ? Math.floor(time * 8) % 2 === 0
        ? "#ffffff"
        : "#bfe3ff"
      : frac > 0.9
        ? Math.floor(time * 3) % 2 === 0
          ? "#ff5a5a"
          : "#ff8f8f"
        : frac > 0.7
          ? "#f2c14e"
          : "#4aa3ff";
  rect(ctx, INK, x - 1, y - 1, width + 2, 4);
  rect(ctx, "#1f2b4a", x, y, width, 2);
  if (frac > 0) rect(ctx, color, x, y, Math.max(1, Math.round(width * frac)), 2);
};

const drawFx = (ctx: Ctx, emp: Employee, time: number, office: Office) => {
  // quest note popping up (board pause or new prompt)
  if (emp.state === "ENTERING" && emp.holdUntil > time) {
    const progress = Math.min(1, (time - emp.noteAt) / 0.3);
    blitC(ctx, "quest_note", emp.x, emp.y - 28 - progress * 5 - Math.sin(time * 6) * 0.7);
    if (progress < 1) blitC(ctx, "spark" + (Math.floor(time * 12) % 2), emp.x + 7, emp.y - 30);
  }
  // turn-in: coins + chest
  if (emp.state === "LEAVING" && emp.holdUntil > time) {
    const dage = time - emp.lootAt;
    blitC(ctx, "chest", emp.x + 12, emp.y - 6);
    for (let k = 0; k < 3; k++) {
      const progress = Math.max(0, dage - k * 0.18);
      if (progress > 0 && progress < 0.9) {
        ctx.globalAlpha = 1 - progress * 0.6;
        blitC(ctx, "coin", emp.x - 6 + k * 6, emp.y - 28 - progress * 10);
        ctx.globalAlpha = 1;
      }
    }
  }
  if (emp.state === "DRINK" || emp.state === "AT_TAVERN_REST") {
    blitC(ctx, "steam" + (Math.floor(time * 3) % 3), emp.x + 8, emp.y - 26);
    if (Math.floor(time * 1.5) % 2 === 0) blitC(ctx, "ale", emp.x + 9, emp.y - 12);
  }
  if (emp.hasPaper && time - emp.paperAt < 1 && emp.state === "SEATED")
    blitC(ctx, "quest_note", emp.x + 9, emp.y - 30 - (time - emp.paperAt) * 6);
  if (time < emp.sparkUntil) blitC(ctx, "spark" + (Math.floor(time * 12) % 2), emp.x + 8, emp.y - 28);
  if (emp.state !== "SEATED") return;
  if (emp.resting && !emp.duel) {
    const fx = emp.x + 10,
      fy = emp.y + 1;
    blitB(ctx, "campfire" + (Math.floor(time * 6) % 2), fx, fy);
  }
  if (emp.deskIdx >= 0 && emp.hearts < MAX_HEARTS) {
    for (let k = 0; k < MAX_HEARTS; k++)
      blitC(ctx, k < emp.hearts ? "heart" : "heart_empty", emp.x - 7 + k * 7, emp.y + 5);
  }
  manaBar(ctx, emp, time, office);
  if (emp.duel && emp.duel.phase === "fight" && !emp.duel.still) return; // the duel replaces the usual monster fight effects
  if (emp.deskIdx >= 0 && emp.hearts === 0 && !emp.resting)
    blitC(ctx, "sweat" + (Math.floor(time * 3) % 2), emp.x - 9, emp.y - 22);
  if (emp.slashUntil > time && emp.monPos && !emp.monDead && !emp.bossPath.length)
    hitFx(ctx, emp, emp.monPos.x + (emp.boss ? 4 : 0), emp.monPos.y, time, 20, 1);

  const monster = emp.monPos && !emp.monDead && !emp.bossPath.length ? emp.monPos : null;
  const mx = monster ? monster.x : emp.x + 22;
  const my = emp.y;
  const fight = !!monster && time - emp.monAppearAt > 0.3;
  switch (emp.act) {
    case "typing":
      if (fight) {
        for (let k = 0; k < 3; k++) {
          const progress = (time * 1.7 + k / 3) % 1;
          const sx = emp.x + 9,
            sy = emp.y - 14;
          blitC(
            ctx,
            "magic" + ((Math.floor(time * 8) + k) % 2),
            sx + (mx - 5 - sx) * progress,
            sy + (my - 9 - sy) * progress - Math.sin(progress * Math.PI) * 7,
          );
        }
        if ((time * 1.7) % 1 > 0.8) blitC(ctx, "spark" + (Math.floor(time * 14) % 2), mx - 2, my - 10);
      } else blitC(ctx, "magic" + (Math.floor(time * 8) % 2), emp.x + 11, emp.y - 16);
      break;
    case "bash":
      if (fight && (time * 2.5) % 1 < 0.4) hitFx(ctx, emp, mx, my, time, 12, ((time * 2.5) % 1) / 0.4);
      if (time - emp.actSince > 4)
        blitC(ctx, "sweat" + (Math.floor(time * 3) % 2), emp.x - 9, emp.y - 22 + (Math.floor(time * 3) % 2) * 2);
      break;
    case "reading":
      blitC(ctx, "scroll", emp.x + 11, emp.y - 17 + Math.sin(time * 3) * 1.2);
      break;
    case "sticky":
      blitC(ctx, "quest_note", emp.x + 11, emp.y - 17 + Math.sin(time * 3) * 1.2);
      break;
    case "mcp":
      blitC(ctx, "portal" + (Math.floor(time * 6) % 2), emp.x + 17, emp.y - 13);
      break;
    case "phone": {
      const cyc = 5;
      const progress = (time % cyc) / cyc; // 0..1: out and back
      const out = progress < 0.5 ? progress * 2 : (1 - progress) * 2;
      const ox = emp.x + 8 + out * 70,
        oy = emp.y - 20 - Math.sin(out * Math.PI) * 14 - out * 18;
      const sprite = prop("owl" + (Math.floor(time * 8) % 2));
      if (out < 0.04) {
        ctx.drawImage(sprite, Math.round(emp.x + 8 - sprite.width / 2), Math.round(emp.y - 22 - sprite.height / 2));
        break;
      }
      if (progress < 0.5) ctx.drawImage(sprite, Math.round(ox - sprite.width / 2), Math.round(oy - sprite.height / 2));
      else {
        ctx.save();
        ctx.translate(Math.round(ox), Math.round(oy - sprite.height / 2));
        ctx.scale(-1, 1);
        ctx.drawImage(sprite, -sprite.width / 2, 0);
        ctx.restore();
      }
      break;
    }
    default:
      break;
  }
  if (emp.hurtUntil > time) {
    const progress = 1 - (emp.hurtUntil - time) / 0.8;
    ctx.globalAlpha = 1 - progress * progress;
    blitC(ctx, "heart", emp.x + 9, emp.y - 28 - progress * 10);
    ctx.globalAlpha = 1;
  }
};

/** sessions in a failure loop this frame (set once per render from the engine) */
let LOOPING: ReadonlySet<string> = new Set();

/** drawn for a looping adventurer this frame (🔁 badge + berserk marks) */
const isLooping = (emp: Employee): boolean => {
  return LOOPING.has(emp.id) && emp.state !== "LEAVING" && emp.state !== "DRINK";
};

/** "Berserk": opaque red vein mark + steam puffs beside the head. Rects only, nothing translucent. */
const drawBerserk = (ctx: Ctx, emp: Employee, time: number, still: boolean) => {
  duelOffsetInto(emp, time);
  const hx = Math.round(emp.x + DP.dx),
    hy = Math.round(emp.y + DP.dy - CH_H);
  // anger vein (red cross-hatch) at the temple
  const vx = hx + 4,
    vy = hy + 1;
  rect(ctx, INK, vx - 1, vy - 1, 6, 6);
  rect(ctx, "#e23b3b", vx, vy, 2, 1);
  rect(ctx, "#e23b3b", vx, vy + 1, 1, 1);
  rect(ctx, "#e23b3b", vx + 3, vy, 1, 2);
  rect(ctx, "#e23b3b", vx + 2, vy + 3, 2, 1);
  rect(ctx, "#e23b3b", vx, vy + 3, 1, 1);
  rect(ctx, "#ff8a7a", vx + 1, vy + 1, 1, 1);
  // two steam puffs rising off the head (opaque pixels that step up and reset; still frame when reduced motion).
  // Kept >= 11px to the side of the head so they never touch the ❗/🔁 bubble above it; skipped in duels (HP pips live there).
  if (emp.duel) return;
  for (let i = 0; i < 2; i++) {
    const progress = still ? 0.4 : (time * 1.3 + i * 0.5) % 1;
    const px = hx + (i ? 13 : -15) + (still ? 0 : Math.round(Math.sin(time * 4 + i) * 1));
    const py = hy - 1 - Math.floor(progress * 7);
    const size = progress < 0.5 ? 3 : 2;
    rect(ctx, INK, px - 1, py - 1, size + 2, size + 2);
    rect(ctx, progress < 0.75 ? "#f4f4f4" : "#cfd3dc", px, py, size, size);
  }
};

const bubbleOf = (emp: Employee, time: number): string | null => {
  if (emp.state === "DRINK") return "🍺";
  if (onTavernRest(emp)) return emp.act === "handup" ? "❗" : "🍺";
  if (emp.state !== "SEATED") return null;
  if (emp.tempBubble) return emp.tempBubble.e;
  if (emp.bubble === "❗") return Math.floor(time * 4) % 2 === 0 ? "❗" : null;
  if (!emp.bubble && emp.hearts === 0 && emp.deskIdx >= 0 && !emp.resting) return "😩";
  return emp.bubble;
};

const drawBubble = (ctx: Ctx, x: number, tipY: number, emoji: string) => {
  const width = 13,
    height = 12;
  const bx = Math.round(x - width / 2),
    by = Math.round(tipY - height - 2);
  rect(ctx, INK, bx + 1, by, width - 2, height);
  rect(ctx, INK, bx, by + 1, width, height - 2);
  rect(ctx, "#ffffff", bx + 1, by + 1, width - 2, height - 2);
  rect(ctx, INK, Math.round(x) - 1, by + height, 3, 1);
  rect(ctx, INK, Math.round(x), by + height + 1, 1, 1);
  ctx.font = EMOJI_FONT;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = INK;
  ctx.fillText(emoji, x, by + height / 2 + 0.5);
};

/** Big red "!" bubble: the adventurer needs you. */
const drawAlert = (ctx: Ctx, x: number, tipY: number) => {
  const width = 13,
    height = 15;
  const bx = Math.round(x - width / 2),
    by = Math.round(tipY - height - 2);
  rect(ctx, INK, bx + 1, by, width - 2, height);
  rect(ctx, INK, bx, by + 1, width, height - 2);
  rect(ctx, "#ff4a4a", bx + 1, by + 1, width - 2, height - 2);
  rect(ctx, "#ff8a8a", bx + 2, by + 2, width - 4, 1);
  rect(ctx, INK, Math.round(x) - 1, by + height, 3, 1);
  rect(ctx, INK, Math.round(x), by + height + 1, 1, 1);
  ctx.font = "800 11px ui-sans-serif, system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#ffffff";
  ctx.fillText("!", x, by + height / 2 + 0.8);
};

const internTagLine = (emp: Employee): string => {
  const parts: string[] = [];
  for (const it of [...emp.interns.values()].slice(0, 2)) {
    const detail = it.act === "idle" ? "" : (it.tool ? it.tool + " " : "") + (it.detail ?? "");
    parts.push(`+ ${it.label}${detail ? ": " + detail.trim() : ""}`);
  }
  return parts.join("  ");
};

const drawTag = (ctx: Ctx, emp: Employee, topY: number, dx = 0) => {
  const text = `${emp.project} ${emp.tag}`;
  ctx.font = TAG_FONT;
  const width = Math.ceil(ctx.measureText(text).width) + 7,
    height = 9;
  const bx = Math.max(1, Math.min(WORLD_W - width - 1, emp.x + dx - width / 2));
  const by = Math.max(1, topY - height);
  ctx.fillStyle = "rgba(0,0,0,0.3)";
  roundRect(ctx, bx, by + 1, width, height, 2.5);
  ctx.fill();
  ctx.fillStyle = "#23253a";
  roundRect(ctx, bx, by, width, height, 2.5);
  ctx.fill();
  ctx.strokeStyle = "rgba(244,227,193,0.35)";
  ctx.lineWidth = 0.5;
  roundRect(ctx, bx + 0.25, by + 0.25, width - 0.5, height - 0.5, 2.3);
  ctx.stroke();
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillStyle = CREAM;
  ctx.fillText(text, bx + 3.5, by + height / 2 + 0.3);
  const subLine = internTagLine(emp);
  if (subLine) {
    const shortText = subLine.length > 44 ? subLine.slice(0, 43) + "…" : subLine;
    const w2 = Math.ceil(ctx.measureText(shortText).width) + 7;
    const bx2 = Math.max(1, Math.min(WORLD_W - w2 - 1, emp.x + dx - w2 / 2)),
      by2 = Math.max(1, by - height - 1);
    ctx.fillStyle = "#23253a";
    roundRect(ctx, bx2, by2, w2, height, 2.5);
    ctx.fill();
    ctx.strokeStyle = "rgba(244,227,193,0.35)";
    ctx.lineWidth = 0.5;
    roundRect(ctx, bx2 + 0.25, by2 + 0.25, w2 - 0.5, height - 0.5, 2.3);
    ctx.stroke();
    ctx.fillStyle = "#bfe3ff";
    ctx.fillText(shortText, bx2 + 3.5, by2 + height / 2 + 0.3);
  }
};

// ---------- guild receptionist ----------
const drawNpc = (ctx: Ctx, time: number, office: Office) => {
  const sprite = charSprite(lookFor("guild-receptionist-npc"), "idle", Math.floor(time * 1.2) % 2);
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, WORLD_W, COUNTER_BOX.y + 1);
  ctx.clip(); // counter hides the legs
  ctx.drawImage(sprite, Math.round(NPC_POS.x - CH_W / 2), Math.round(NPC_POS.y - CH_H));
  ctx.restore();
  // Lookout Bell: while someone needs the user the receptionist rings the counter bell (opaque swing; static when idle / reduced motion)
  if (office.bellRinging()) {
    const phase = office.reducedMotion ? 0 : Math.floor(time * 8) % 4;
    const dx = phase === 1 ? -1 : phase === 3 ? 1 : 0;
    rect(ctx, "#d9a441", 106 + dx, 43, 6, 3);
    rect(ctx, "#f6d88a", 107 + dx, 42, 4, 1);
    rect(ctx, "#8a6a42", 108 + dx, 46, 2, 1);
    if (dx < 0) {
      rect(ctx, "#fff6d0", 104, 42, 1, 2);
      rect(ctx, "#fff6d0", 103, 40, 1, 1);
    } else if (dx > 0) {
      rect(ctx, "#fff6d0", 107, 40, 1, 1);
      rect(ctx, "#fff6d0", 111, 40, 1, 1);
    } else if (office.reducedMotion) {
      rect(ctx, "#fff6d0", 104, 42, 1, 2);
      rect(ctx, "#fff6d0", 115, 42, 1, 2);
      rect(ctx, "#fff6d0", 109, 40, 1, 1);
    } // static "ringing" cue
  }
};

// ---------- scene ----------
const drawAmbientBelow = (ctx: Ctx, office: Office, night: number) => {
  const time = office.ambT;
  if (night < 0.35 && office.rain < 0.3) {
    for (let i = 0; i < office.butterflies.length; i++) {
      const butterfly = office.butterflies[i];
      const sprite = butterflySprite(butterfly.col, Math.floor(time * 8 + i) % 2);
      ctx.drawImage(
        sprite,
        Math.round(butterfly.x - sprite.width / 2),
        Math.round(butterfly.y - sprite.height / 2 + Math.sin(time * 3 + butterfly.ph) * 2),
      );
    }
  }
};

const drawAmbientAbove = (ctx: Ctx, office: Office, night: number) => {
  const time = office.ambT;
  // hearth smoke
  for (const smoke of office.smoke) {
    const progress = smoke.age / smoke.life;
    ctx.globalAlpha = 0.75 * (1 - progress);
    blitC(ctx, "smoke" + Math.min(2, Math.floor(progress * 3)), smoke.x, smoke.y);
  }
  ctx.globalAlpha = 1;
  if (night > 0.3) {
    const k = Math.min(1, (night - 0.3) * 2);
    for (const firefly of office.fireflies) {
      const alpha = k * (0.25 + 0.75 * Math.pow(Math.abs(Math.sin(time * 1.6 + firefly.ph * 4)), 2));
      ctx.globalAlpha = alpha * 0.25;
      rect(ctx, "#e8ff7a", firefly.x - 1, firefly.y - 1, 3, 3);
      ctx.globalAlpha = alpha;
      blitC(ctx, "firefly", firefly.x, firefly.y);
    }
    ctx.globalAlpha = 1;
  }
};

export const drawScene = (ctx: Ctx, office: Office) => {
  const time = office.clock;
  const now = new Date();
  const hour = now.getHours() + now.getMinutes() / 60;
  const night = nightness(hour);
  ctx.imageSmoothingEnabled = false;
  ctx.globalAlpha = 1;
  ctx.save();
  const amp = 3 * office.trauma * office.trauma;
  if (amp > 0.35 && !office.paused && !office.reducedMotion)
    ctx.translate(Math.round((Math.random() * 2 - 1) * amp), Math.round((Math.random() * 2 - 1) * amp));
  drawSky(ctx, time, hour);
  if (office.bird && night < 0.6 && office.rain < 0.5) {
    const bird = office.bird;
    const sprite = prop("bird" + (Math.floor(bird.ph * 7) % 2));
    const bx = Math.round(bird.x - sprite.width / 2),
      by = Math.round(bird.y + Math.sin(bird.ph * 3) * 2 - sprite.height / 2);
    if (bird.vx > 0) {
      ctx.save();
      ctx.translate(bx + sprite.width, by);
      ctx.scale(-1, 1);
      ctx.drawImage(sprite, 0, 0);
      ctx.restore();
    } else ctx.drawImage(sprite, bx, by);
  }
  if (!bg) bg = buildBg();
  const key = Math.floor(hour * 4);
  if (key !== lightKey || !overlay) {
    buildLighting(hour);
    lightKey = key;
  }
  ctx.drawImage(bg, 0, 0);
  drawEnvAnim(ctx, time);
  drawGate(ctx, office, time);
  drawAllyGate(ctx, office.allyDoorsUntil > time, time, office.reducedMotion);
  // Lighting tints only the environment; characters, monsters and emissive things stay solid and full-colour.
  ctx.drawImage(overlay!, 0, 0);
  if (office.rain > 0) {
    // rain darkens the world (before entities, so characters stay solid)
    ctx.fillStyle = `rgba(20,30,60,${0.2 * office.rain})`;
    ctx.fillRect(HALL_W, 0, WORLD_W - HALL_W, WORLD_H);
    ctx.fillStyle = `rgba(20,30,60,${0.07 * office.rain})`;
    ctx.fillRect(0, 0, HALL_W, WORLD_H);
  }
  drawLights(ctx, time, office);
  drawAllyGlow(ctx, office, time);
  drawAmbientBelow(ctx, office, night);
  drawAmbientAbove(ctx, office, night);
  drawNpc(ctx, time, office);
  LOOPING = office.loopIds;

  // resting campfire glow + rain go under every entity so characters stay crisp
  for (const emp of office.employees.values()) {
    if (office.isHidden(emp)) continue;
    if (emp.state === "SEATED" && emp.resting) {
      ctx.globalAlpha = 0.16 + 0.05 * Math.sin(time * 9);
      ctx.fillStyle = "#ffb050";
      ctx.beginPath();
      ctx.arc(emp.x + 10, emp.y - 4, 11, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }
  drawRain(ctx, office);
  // territory layer: all of it (lines, flags, swords) is drawn BEFORE the entity pass, fully opaque where it overlaps
  // a character's footprint, so nothing translucent ever sits on top of a character
  const nLinks = territoryLinks(office);
  drawArenas(ctx, office); // ground first: the knocked-over flag and plots stay visible on top
  drawPlots(ctx, office);
  drawContested(ctx, office, nLinks, time);
  drawLinks(ctx, nLinks, time, office);
  drawClaimFlags(ctx, office, time);
  drawParticles(ctx, office, true);

  const ents: { y: number; fn: () => void }[] = [];
  for (const emp of office.employees.values()) {
    if (office.isHidden(emp)) continue;
    const heldTime = frozenTime(emp, time);
    ents.push({ y: emp.y, fn: () => drawAdventurer(ctx, emp, heldTime) });
    ents.push({ y: emp.y + 0.4, fn: () => drawFx(ctx, emp, heldTime, office) });
    if (emp.monPos) {
      const monsterPos = emp.monPos;
      ents.push({ y: monsterPos.y, fn: () => drawMonster(ctx, emp, heldTime) });
    }
    if ((emp.deskIdx >= 0 || emp.slot >= 0) && emp.state !== "LEAVING") {
      const camp = emp.deskIdx < 0;
      let k = 0;
      for (const it of emp.interns.values()) {
        if (k >= 2) break;
        const squireSlot = k++;
        if (it.phase === "wait") continue; // still inside the tent
        ents.push({
          y: it.phase === "snap" ? squireSpotOf(emp, squireSlot).y : it.y,
          fn: () => drawSquire(ctx, emp, it, squireSlot, time),
        });
      }
      if (emp.interns.size > 2) {
        const spot = camp ? standSlot(emp.slot) : spotOf(emp.deskIdx);
        const bx = camp ? spot.x + 8 : spot.x - 24,
          by = camp ? spot.y - 6 : spot.y;
        ents.push({ y: spot.y + 1, fn: () => drawBadge(ctx, `+${emp.interns.size - 2}`, bx, by) });
      }
    }
  }
  // finished squires walking back into the portal
  for (const leaver of office.leavers)
    ents.push({ y: leaver.y, fn: () => drawSquireWalk(ctx, leaver.x, leaver.y, leaver.face, time) });
  // camp overflow beyond the last slot: stacked on it, badge shows how many
  let stacked = 0;
  for (const emp of office.employees.values()) if (emp.deskIdx < 0 && emp.slot >= CAMP_MAX) stacked++;
  if (stacked > 0) {
    const spot = standSlot(CAMP_MAX - 1);
    ents.push({ y: spot.y + 2, fn: () => drawBadge(ctx, `+${stacked}`, spot.x, spot.y + 9) });
  }
  ents.sort((entA, entB) => entA.y - entB.y);
  for (const entity of ents) entity.fn();
  drawDuels(ctx, office, time);
  drawLinkIcons(ctx, nLinks, time, office); // after entities: the opaque badge is never hidden
  drawParticles(ctx, office, false);
  drawPopups(ctx, office);

  // bubbles, highlights, tags
  for (const emp of office.employees.values()) {
    if (office.isHidden(emp)) continue;
    if (waitsOnYou(emp) && !emp.tempBubble) {
      if (Math.floor(time * 4) % 2 === 0 || office.selectedId === emp.id) drawAlert(ctx, emp.x, emp.y - CH_H - 1);
    } else {
      const emote = bubbleOf(emp, time);
      // opaque 🔁 badge over a looping adventurer; alternates with any other bubble (static under reduced motion)
      if (isLooping(emp) && (!emote || office.reducedMotion || Math.floor(time * 1.5) % 2 === 0))
        drawBubble(ctx, emp.x, emp.y - CH_H - 1, "🔁");
      else if (emote) drawBubble(ctx, emp.x, emp.y - CH_H - 1, emote);
    }
    if (isLooping(emp)) drawBerserk(ctx, emp, time, office.reducedMotion);
    const sinceLevelUp = time - emp.lvlAt;
    if (sinceLevelUp >= 0 && sinceLevelUp < 2.2 && emp.state !== "LEAVING") {
      const progress = sinceLevelUp / 2.2;
      ctx.globalAlpha = progress > 0.75 ? (1 - progress) / 0.25 : 1;
      ctx.font = "800 7.5px ui-sans-serif, system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const ly = Math.round(
        emp.y -
          CH_H -
          20 -
          (bubbleOf(emp, time) || emp.act === "handup" || isLooping(emp) ? 15 : 0) -
          eob(Math.min(1, sinceLevelUp * 2)) * 6,
      );
      outlined(
        ctx,
        `LEVEL UP! Lv.${emp.lvlTo}`,
        Math.max(34, Math.min(WORLD_W - 34, Math.round(emp.x))),
        ly,
        "#ffe14a",
      );
      ctx.globalAlpha = 1;
    }
    if (office.selectedId === emp.id) {
      const bounce = Math.floor(office.realTime * 4) % 2;
      duelOffsetInto(emp, time);
      const ax = Math.round(emp.x + DP.dx),
        ay = Math.round(
          emp.y + DP.dy - 28 - (bubbleOf(emp, time) || emp.act === "handup" || isLooping(emp) ? 16 : 0) - bounce,
        );
      rect(ctx, "#f2c14e", ax - 3, ay - 3, 7, 1);
      rect(ctx, "#f2c14e", ax - 2, ay - 2, 5, 1);
      rect(ctx, "#f2c14e", ax - 1, ay - 1, 3, 1);
      rect(ctx, "#f2c14e", ax, ay, 1, 1);
    }
  }
  const hovered = office.hoverId ? office.employees.get(office.hoverId) : undefined;
  if (hovered) {
    duelOffsetInto(hovered, time);
    ctx.globalAlpha = 0.9;
    rect(
      ctx,
      "#f2c14e",
      Math.round(hovered.x + DP.dx - CH_W / 2) - 1,
      Math.round(hovered.y + DP.dy - CH_H) - 1,
      CH_W + 2,
      1,
    );
    ctx.globalAlpha = 1;
    drawTag(
      ctx,
      hovered,
      hovered.y + DP.dy - CH_H - 3 - (bubbleOf(hovered, time) || waitsOnYou(hovered) || isLooping(hovered) ? 17 : 0),
      DP.dx,
    );
  }
  ctx.restore(); // end of shaken scene; screen-space overlays below
  drawAlertVignette(ctx, office);
  if (office.flash > 0) {
    if (!office.reducedMotion) {
      ctx.globalAlpha = office.flash;
      rect(ctx, "#ffffff", 0, 0, WORLD_W, WORLD_H);
      ctx.globalAlpha = 1;
    }
    office.flash = 0;
  }
  drawBannerQ(ctx, office);
};
