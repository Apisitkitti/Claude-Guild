import { MON_DX, VIEW_W, VIEW_X0, WORLD_H, type Pt } from "./layout";
import { COZY, type MonsterKind } from "./palette";

/**
 * The dungeon interior: the scene the canvas switches to when the user looks inside the dark castle. It lives in the
 * same world coordinates as the field (x from VIEW_X0 to VIEW_X0 + VIEW_W, y 0..WORLD_H), so the camera and the
 * characters' drawing helpers work unchanged. Three chambers (guard hall with cells, slime vault, lava lair) side by
 * side behind one wide flagstone floor, an entrance stairway on the far left (the way back up to the guild gate).
 * Everything here is opaque pixel art except the soft light pools on the floor, which sit UNDER the characters.
 */
type Ctx = CanvasRenderingContext2D;

// ---- raider spots -----------------------------------------------------------------------------------------------
const SPOT_COL_X0 = -44;
const SPOT_COL_DX = 46;
const SPOT_COUNT_COLS = 8;
const SPOT_ROWS = [104, 142, 180];
/** column order of one row: consecutive slots land in different chambers (guard hall, slime vault, lava lair, ...) */
const SPOT_COL_ORDER = [1, 4, 7, 6, 2, 5, 0, 3];
/** slots fill row by row, hopping across chambers inside a row, so a few raiders never crowd one chamber */
export const DUNGEON_SPOTS: Pt[] = Array.from({ length: SPOT_COUNT_COLS * SPOT_ROWS.length }, (_, i) => ({
  x: SPOT_COL_X0 + SPOT_COL_ORDER[i % SPOT_COUNT_COLS] * SPOT_COL_DX,
  y: SPOT_ROWS[Math.floor(i / SPOT_COUNT_COLS)],
}));
/** the last spot: raiders in slots beyond it stand stacked there (a +N badge counts them) */
export const DUNGEON_LAST_SPOT = DUNGEON_SPOTS.length - 1;
/** spot index of the raider in overflow slot `slot`: keyed by the slot, so nobody jumps when another raider leaves */
export const dungeonSpotIndex = (slot: number): number => Math.min(Math.max(0, slot), DUNGEON_LAST_SPOT);
/** where the raider in overflow slot `slot` stands inside the dungeon */
export const dungeonSpotOf = (slot: number): Pt => DUNGEON_SPOTS[dungeonSpotIndex(slot)];
/** a raider's foe stands to the right of the raider */
export const dungeonMonsterPoint = (spot: Pt): Pt => ({ x: spot.x + MON_DX, y: spot.y });

/** sleepers shown while nobody is inside (feet position of each 20x20 monster) */
export const DUNGEON_IDLERS: { kind: MonsterKind; x: number; y: number }[] = [
  { kind: "slime", x: 60, y: 150 },
  { kind: "skeleton", x: 170, y: 118 },
  { kind: "bat", x: 214, y: 168 },
  { kind: "goblin", x: 290, y: 130 },
  { kind: "mushroom", x: 20, y: 184 },
];

// ---- palette (all opaque) ---------------------------------------------------------------------------------------
const VOID = "#0d0b16";
const MORTAR = "#14121f";
const WALL = ["#2b2d3d", "#303346", "#262838", "#343749"];
const WALL_HI = "#454a60";
const GOLD_DIM = "#c9962a";
const IRON = "#5a5e6b";
const IRON_HI = "#8d93a0";
const IRON_DARK = "#3a3d4a";
const BONE = "#e8e0cc";
const BONE_DARK = "#b9ae94";
const FLOORS = [
  ["#2a2b3a", "#2e3040", "#262735", "#32344a"],
  ["#232f2e", "#27332f", "#202a29", "#2b3836"],
  ["#34252b", "#392a30", "#2d1f25", "#3f2e35"],
];
const FLAME = ["#d9481f", "#ff8a2a", "#ffe14a"];
const WALL_BASE_Y = 64;
const PILLAR_A_X = 90;
const PILLAR_B_X = 238;
const STAIR_X = VIEW_X0 + 2;
const TORCHES: Pt[] = [
  { x: -52, y: 42 },
  { x: 66, y: 42 },
  { x: 112, y: 42 },
  { x: 200, y: 42 },
  { x: 258, y: 42 },
  { x: 326, y: 42 },
];
const X_END = VIEW_X0 + VIEW_W;
const SLIME = { x0: 100, x1: 236, y: 62, h: 9 };
const LAVA = { x0: 248, x1: 334, y: 62, h: 9 };

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
const chamberOf = (x: number): number => (x < PILLAR_A_X ? 0 : x < PILLAR_B_X ? 1 : 2);

// ---- static pieces ----------------------------------------------------------------------------------------------
const drawWall = (ctx: Ctx) => {
  rect(ctx, VOID, VIEW_X0, 0, VIEW_W, WORLD_H);
  rect(ctx, MORTAR, VIEW_X0, 0, VIEW_W, WALL_BASE_Y);
  for (let row = 0, y = 0; y < WALL_BASE_Y; y += 7, row++) {
    for (let x = VIEW_X0 - (row % 2) * 9; x < X_END; x += 18) {
      rect(ctx, pick(WALL, x, y), x + 1, y + 1, 17, 6);
      rect(ctx, WALL_HI, x + 1, y + 1, 17, 1);
      if (hash(x, y) % 9 === 0) rect(ctx, MORTAR, x + 3 + (hash(y, x) % 10), y + 2, 1, 4); // crack
    }
  }
  // the wall darkens towards the floor and towards the ceiling
  rect(ctx, "#1c1b2b", VIEW_X0, WALL_BASE_Y - 5, VIEW_W, 5);
  rect(ctx, MORTAR, VIEW_X0, WALL_BASE_Y - 1, VIEW_W, 1);
  rect(ctx, "#1c1b2b", VIEW_X0, 0, VIEW_W, 3);
};

const drawFloor = (ctx: Ctx) => {
  rect(ctx, MORTAR, VIEW_X0, WALL_BASE_Y, VIEW_W, WORLD_H - WALL_BASE_Y);
  for (let row = 0, y = WALL_BASE_Y; y < WORLD_H; y += 12, row++) {
    for (let x = VIEW_X0 - (row % 2) * 10; x < X_END; x += 20) {
      const tones = FLOORS[chamberOf(x + 10)];
      rect(ctx, pick(tones, x, y), x + 1, y + 1, 19, 11);
      rect(ctx, tones[3], x + 1, y + 1, 19, 1);
      if (hash(x, y) % 7 === 0) rect(ctx, MORTAR, x + 4 + (hash(y, x) % 10), y + 4, 5, 1); // crack
      if (hash(x + 1, y) % 11 === 0) rect(ctx, tones[2], x + 12, y + 7, 3, 2); // chipped corner
    }
  }
  // the wall's long shadow on the floor
  rect(ctx, "#1c1b2b", VIEW_X0, WALL_BASE_Y, VIEW_W, 3);
};

const skull = (ctx: Ctx, x: number, y: number) => {
  rect(ctx, MORTAR, x - 1, y - 1, 8, 7);
  rect(ctx, BONE, x, y, 6, 4);
  rect(ctx, BONE_DARK, x + 1, y + 4, 4, 1);
  rect(ctx, MORTAR, x + 1, y + 1, 1, 2);
  rect(ctx, MORTAR, x + 4, y + 1, 1, 2);
  rect(ctx, MORTAR, x + 2, y + 4, 1, 1);
  rect(ctx, MORTAR, x + 3, y + 4, 1, 1);
};

const pillar = (ctx: Ctx, x: number) => {
  rect(ctx, MORTAR, x - 1, 0, 14, WALL_BASE_Y + 4);
  rect(ctx, "#3d4057", x, 0, 12, WALL_BASE_Y + 3);
  rect(ctx, WALL_HI, x, 0, 2, WALL_BASE_Y + 3);
  rect(ctx, "#262838", x + 9, 0, 3, WALL_BASE_Y + 3);
  for (let y = 8; y < WALL_BASE_Y; y += 14) rect(ctx, "#2f3248", x, y, 12, 1);
  rect(ctx, "#4a4f63", x - 3, WALL_BASE_Y - 4, 18, 6); // base
  rect(ctx, WALL_HI, x - 3, WALL_BASE_Y - 4, 18, 1);
  rect(ctx, "#4a4f63", x - 3, 10, 18, 4); // capital
  rect(ctx, WALL_HI, x - 3, 10, 18, 1);
};

const cobweb = (ctx: Ctx, x: number, y: number, dir: 1 | -1) => {
  const web = "#9aa0b4";
  for (let ray = 1; ray < 15; ray++) {
    rect(ctx, web, x + dir * ray, y, 1, 1);
    rect(ctx, web, x, y + ray, 1, 1);
    rect(ctx, web, x + dir * Math.round(ray * 0.8), y + Math.round(ray * 0.8), 1, 1);
  }
  for (const ring of [5, 9, 13]) {
    rect(ctx, web, x + dir * ring, y + 1, 1, 1);
    for (let k = 1; k < ring - 1; k += 2)
      rect(ctx, web, x + dir * Math.round(ring - k * 0.8), y + Math.round(k * 0.8 + 1), 1, 1);
    rect(ctx, web, x + 1 * dir, y + ring, 1, 1);
  }
};

const cells = (ctx: Ctx) => {
  for (const cx of [-46, -22]) {
    rect(ctx, MORTAR, cx - 2, 8, 28, 52);
    rect(ctx, "#0b0912", cx, 10, 24, 48);
    rect(ctx, "#15131f", cx, 52, 24, 6);
    // bars
    for (let x = cx + 1; x < cx + 24; x += 5) {
      rect(ctx, IRON, x, 10, 2, 48);
      rect(ctx, IRON_HI, x, 10, 1, 48);
    }
    rect(ctx, IRON_DARK, cx, 10, 24, 3);
    rect(ctx, IRON, cx, 11, 24, 1);
    rect(ctx, IRON_DARK, cx, 30, 24, 2);
    rect(ctx, IRON_DARK, cx, 55, 24, 3);
    rect(ctx, "#8b5e3c", cx + 10, 32, 5, 4); // lock
    rect(ctx, GOLD_DIM, cx + 11, 33, 3, 2);
  }
  // left cell: a skeleton slumped against the wall
  rect(ctx, BONE, -38, 42, 6, 5);
  rect(ctx, MORTAR, -37, 43, 1, 2);
  rect(ctx, MORTAR, -34, 43, 1, 2);
  rect(ctx, BONE_DARK, -39, 48, 8, 1);
  rect(ctx, BONE, -38, 49, 6, 1);
  rect(ctx, BONE, -38, 51, 6, 1);
  rect(ctx, BONE, -42, 54, 14, 2);
  rect(ctx, BONE_DARK, -30, 53, 3, 1);
};

const manacles = (ctx: Ctx) => {
  // two chains and a skeleton hanging by its wrists between the cells and the first pillar
  for (const cx of [26, 44]) {
    for (let y = 4; y < 24; y += 3) {
      rect(ctx, IRON_HI, cx, y, 2, 2);
      rect(ctx, IRON_DARK, cx, y + 1, 2, 1);
    }
    rect(ctx, IRON, cx - 1, 24, 4, 3);
  }
  skull(ctx, 32, 24);
  rect(ctx, BONE, 33, 30, 4, 12); // ribs
  for (let y = 31; y < 41; y += 3) rect(ctx, MORTAR, 33, y, 4, 1);
  rect(ctx, BONE_DARK, 34, 42, 2, 8);
  rect(ctx, BONE, 30, 28, 2, 8);
  rect(ctx, BONE, 38, 28, 2, 8);
  rect(ctx, BONE_DARK, 32, 50, 2, 6);
  rect(ctx, BONE_DARK, 36, 50, 2, 6);
};

const banner = (ctx: Ctx, x: number, y: number) => {
  rect(ctx, MORTAR, x - 1, y - 1, 14, 3);
  rect(ctx, "#8b5e3c", x - 1, y - 1, 14, 2);
  rect(ctx, "#4a2f6b", x, y + 1, 12, 22);
  rect(ctx, "#5b3f87", x + 1, y + 1, 4, 22);
  // tattered hem
  rect(ctx, VOID, x + 2, y + 21, 2, 3);
  rect(ctx, VOID, x + 7, y + 22, 2, 2);
  rect(ctx, VOID, x + 10, y + 20, 2, 4);
  skull(ctx, x + 3, y + 7);
};

const skullShelf = (ctx: Ctx, x: number) => {
  rect(ctx, MORTAR, x - 1, 38, 36, 6);
  rect(ctx, "#4a4f63", x, 39, 34, 4);
  rect(ctx, WALL_HI, x, 39, 34, 1);
  for (const sx of [3, 14, 25]) skull(ctx, x + sx, 33);
  rect(ctx, "#f4e3c1", x + 31, 32, 2, 6); // candle stub
};

const pipe = (ctx: Ctx, x: number) => {
  rect(ctx, MORTAR, x - 1, 0, 8, 46);
  rect(ctx, IRON, x, 0, 6, 44);
  rect(ctx, IRON_HI, x, 0, 1, 44);
  rect(ctx, IRON_DARK, x + 5, 0, 1, 44);
  rect(ctx, IRON_DARK, x - 2, 40, 10, 6);
  rect(ctx, IRON, x - 2, 40, 10, 2);
  rect(ctx, "#2f6b3a", x + 1, 46, 4, 2);
  for (let y = 8; y < 40; y += 10) rect(ctx, IRON_DARK, x - 1, y, 8, 2);
};

const demonFace = (ctx: Ctx) => {
  const x = 276;
  rect(ctx, MORTAR, x - 2, 6, 44, 48);
  rect(ctx, "#3d4057", x, 8, 40, 44);
  rect(ctx, WALL_HI, x, 8, 40, 2);
  // horns
  rect(ctx, "#4a4f63", x + 2, 2, 5, 12);
  rect(ctx, "#4a4f63", x + 33, 2, 5, 12);
  rect(ctx, WALL_HI, x + 2, 2, 2, 12);
  rect(ctx, WALL_HI, x + 33, 2, 2, 12);
  // brow, cheeks, nose
  rect(ctx, "#262838", x + 4, 18, 14, 3);
  rect(ctx, "#262838", x + 22, 18, 14, 3);
  rect(ctx, "#262838", x + 18, 22, 4, 12);
  rect(ctx, "#2f3248", x + 4, 36, 6, 8);
  rect(ctx, "#2f3248", x + 30, 36, 6, 8);
  // mouth, fangs
  rect(ctx, "#0b0912", x + 8, 40, 24, 9);
  for (const fx of [10, 15, 24, 29]) {
    rect(ctx, BONE, x + fx, 40, 3, 4);
    rect(ctx, BONE_DARK, x + fx + 1, 44, 1, 1);
  }
  for (const fx of [13, 19, 26]) rect(ctx, BONE, x + fx, 46, 2, 3);
};

const treasure = (ctx: Ctx) => {
  const cx = 362,
    base = 176;
  // soft shadow under the pile
  rect(ctx, "#15131f", cx - 26, base - 3, 52, 6);
  const golds = ["#f2c14e", "#e8c04e", "#c9962a", "#fff3a0", "#f2c14e"];
  for (let layerRow = 0; layerRow < 30; layerRow++) {
    const half = Math.round(24 * (1 - layerRow / 32)) + 1;
    for (let x = cx - half; x <= cx + half; x += 2) {
      rect(ctx, pick(golds, x, layerRow), x, base - layerRow - 3, 2, 1);
    }
    rect(ctx, "#8a6a1c", cx - half - 1, base - layerRow - 3, 1, 1);
    rect(ctx, "#8a6a1c", cx + half + 1, base - layerRow - 3, 1, 1);
  }
  for (const [gx, gy, col] of [
    [-8, -10, "#d95763"],
    [6, -16, "#4a6fa5"],
    [-14, -4, "#5fa55a"],
    [12, -5, "#d95763"],
    [0, -22, "#8fd3ff"],
  ] as const) {
    rect(ctx, MORTAR, cx + gx - 1, base + gy - 1, 5, 5);
    rect(ctx, col, cx + gx, base + gy, 3, 3);
    rect(ctx, "#ffffff", cx + gx, base + gy, 1, 1);
  }
  // a crown on top and a sword stuck in the pile
  rect(ctx, "#8a6a1c", cx - 3, base - 36, 8, 4);
  rect(ctx, "#f2c14e", cx - 3, base - 37, 8, 3);
  for (const tx of [-3, 0, 3]) rect(ctx, "#f2c14e", cx + tx, base - 39, 2, 2);
  rect(ctx, IRON_HI, cx + 16, base - 32, 2, 18);
  rect(ctx, "#a8764a", cx + 14, base - 14, 6, 2);
  // an overturned chest at the foot of the pile
  rect(ctx, MORTAR, cx - 36, base - 8, 18, 14);
  rect(ctx, "#6e4a36", cx - 35, base - 7, 16, 12);
  rect(ctx, "#a8764a", cx - 35, base - 7, 16, 3);
  rect(ctx, "#f2c14e", cx - 29, base - 3, 4, 4);
  rect(ctx, "#f2c14e", cx - 33, base - 9, 3, 3);
};

const bones = (ctx: Ctx) => {
  for (const [bx, by] of [
    [-30, 206],
    [150, 204],
    [304, 202],
    [64, 196],
    [212, 208],
  ] as const) {
    rect(ctx, BONE_DARK, bx, by, 8, 2);
    rect(ctx, BONE, bx, by, 2, 3);
    rect(ctx, BONE, bx + 6, by - 1, 2, 3);
  }
  skull(ctx, -8, 196);
  skull(ctx, 262, 204);
  skull(ctx, 120, 200);
  // ribcage
  rect(ctx, BONE, 330, 196, 10, 2);
  for (const rx of [331, 334, 337]) rect(ctx, BONE_DARK, rx, 198, 1, 4);
};

const channelRim = (ctx: Ctx, zone: { x0: number; x1: number; y: number; h: number }) => {
  rect(ctx, MORTAR, zone.x0 - 3, zone.y - 2, zone.x1 - zone.x0 + 6, zone.h + 5);
  rect(ctx, "#4a4f63", zone.x0 - 2, zone.y + zone.h, zone.x1 - zone.x0 + 4, 2);
  rect(ctx, WALL_HI, zone.x0 - 2, zone.y + zone.h, zone.x1 - zone.x0 + 4, 1);
};

const stairway = (ctx: Ctx) => {
  const x0 = STAIR_X;
  // doorway to the surface: bright sky and a bit of green beyond
  rect(ctx, MORTAR, x0 - 3, 4, 40, 62);
  rect(ctx, "#4a4f63", x0 - 2, 6, 38, 60);
  rect(ctx, "#8fd3ff", x0 + 1, 10, 32, 38);
  rect(ctx, "#b9e4ff", x0 + 1, 10, 32, 14);
  rect(ctx, "#dff3ff", x0 + 1, 10, 32, 6);
  rect(ctx, "#5aa852", x0 + 1, 40, 32, 8);
  rect(ctx, "#3f7f3d", x0 + 1, 46, 32, 2);
  rect(ctx, "#fff6e0", x0 + 6, 16, 8, 3); // cloud
  rect(ctx, "#fff6e0", x0 + 9, 14, 6, 3);
  // arch stones round the doorway
  rect(ctx, "#4a4f63", x0 - 2, 6, 38, 4);
  rect(ctx, WALL_HI, x0 - 2, 6, 38, 1);
  rect(ctx, "#4a4f63", x0 + 1, 8, 6, 3);
  rect(ctx, "#4a4f63", x0 + 27, 8, 6, 3);
  // stairs climbing to the door (wider at the bottom)
  for (let step = 0; step < 6; step++) {
    const y = 48 + step * 8;
    const inset = (5 - step) * 2;
    rect(ctx, "#2a2b3a", x0 - 2 + inset, y + 6, 38 - inset * 2, 3);
    rect(ctx, "#6f7487", x0 - 2 + inset, y, 38 - inset * 2, 6);
    rect(ctx, "#9aa0b4", x0 - 2 + inset, y, 38 - inset * 2, 1);
  }
  // a warm shaft of light on the stairs
  rect(ctx, "#8a8f9c", x0 + 10, 56, 14, 2);
  rect(ctx, "#b5bac6", x0 + 12, 64, 10, 2);
  // the guild's crest above the door: gold shield, crossed swords
  const cx = x0 + 17;
  rect(ctx, MORTAR, cx - 8, -1, 18, 12);
  rect(ctx, "#a24853", cx - 7, 0, 16, 9);
  rect(ctx, "#f2c14e", cx - 7, 0, 16, 1);
  rect(ctx, "#f2c14e", cx - 7, 8, 16, 1);
  rect(ctx, "#fff6e0", cx - 4, 2, 2, 1);
  rect(ctx, "#fff6e0", cx - 3, 3, 2, 1);
  rect(ctx, "#fff6e0", cx - 2, 4, 3, 1);
  rect(ctx, "#fff6e0", cx + 1, 3, 2, 1);
  rect(ctx, "#fff6e0", cx + 2, 2, 2, 1);
  rect(ctx, "#fff6e0", cx - 3, 5, 2, 1);
  rect(ctx, "#fff6e0", cx + 2, 5, 2, 1);
  rect(ctx, "#f2c14e", cx - 1, 1, 3, 7);
  rect(ctx, "#fff3a0", cx, 1, 1, 6);
};

const cobwebs = (ctx: Ctx) => {
  cobweb(ctx, VIEW_X0 + 40, 4, 1);
  cobweb(ctx, PILLAR_A_X - 4, 12, -1);
  cobweb(ctx, PILLAR_A_X + 14, 12, 1);
  cobweb(ctx, PILLAR_B_X - 4, 12, -1);
  cobweb(ctx, PILLAR_B_X + 14, 12, 1);
  cobweb(ctx, X_END - 2, 4, -1);
};

const buildBack = (ctx: Ctx) => {
  drawWall(ctx);
  drawFloor(ctx);
  stairway(ctx);
  cells(ctx);
  manacles(ctx);
  banner(ctx, 6, 8);
  pillar(ctx, PILLAR_A_X);
  skullShelf(ctx, 148);
  pipe(ctx, 172);
  pillar(ctx, PILLAR_B_X);
  demonFace(ctx);
  channelRim(ctx, SLIME);
  channelRim(ctx, LAVA);
  treasure(ctx);
  bones(ctx);
  cobwebs(ctx);
};

/** the ceiling beams, arches and hanging chains: top and side edges only (never over a character's body) */
const buildFront = (ctx: Ctx) => {
  // ceiling beam
  rect(ctx, MORTAR, VIEW_X0, 0, VIEW_W, 7);
  for (let x = VIEW_X0; x < X_END; x += 16) {
    rect(ctx, pick(WALL, x, 3), x + 1, 0, 15, 5);
    rect(ctx, WALL_HI, x + 1, 0, 15, 1);
  }
  // pointed arches over each pillar
  for (const px of [PILLAR_A_X, PILLAR_B_X]) {
    rect(ctx, MORTAR, px - 6, 7, 24, 1);
    rect(ctx, "#4a4f63", px - 7, 5, 26, 3);
    rect(ctx, WALL_HI, px - 7, 5, 26, 1);
    for (let k = 0; k < 4; k++) {
      rect(ctx, "#3d4057", px - 7 + k * 2, 8 + k, 2, 1);
      rect(ctx, "#3d4057", px + 17 - k * 2, 8 + k, 2, 1);
    }
  }
  // stalactites
  for (const sx of [-70, -34, 10, 58, 126, 156, 196, 226, 270, 314, 350]) {
    const len = 3 + (hash(sx, 1) % 5);
    for (let k = 0; k < len; k++) {
      rect(
        ctx,
        k < len - 2 ? "#3d4057" : "#2b2d3d",
        sx + (k < len - 2 ? 0 : 1),
        7 + k,
        k < len - 2 ? 5 - Math.floor(k / 2) : 2,
        1,
      );
    }
  }
  // hanging chains with a cage hook (short: stay in the top band)
  for (const cx of [-12, 100, 184, 290]) {
    for (let y = 7; y < 20; y += 3) {
      rect(ctx, IRON_HI, cx, y, 2, 2);
      rect(ctx, IRON_DARK, cx, y + 1, 2, 1);
    }
    rect(ctx, IRON, cx - 1, 20, 4, 2);
    rect(ctx, IRON_DARK, cx - 2, 22, 6, 1);
  }
  // side walls
  rect(ctx, MORTAR, VIEW_X0, 0, 3, WORLD_H);
  rect(ctx, "#3d4057", VIEW_X0, 0, 2, WORLD_H);
  rect(ctx, MORTAR, X_END - 3, 0, 3, WORLD_H);
  rect(ctx, "#262838", X_END - 2, 0, 2, WORLD_H);
  // bottom lip
  rect(ctx, MORTAR, VIEW_X0, WORLD_H - 3, VIEW_W, 3);
  rect(ctx, "#2b2d3d", VIEW_X0, WORLD_H - 2, VIEW_W, 1);
};

// ---- caches -----------------------------------------------------------------------------------------------------
let backLayer: HTMLCanvasElement | null = null;
let frontLayer: HTMLCanvasElement | null = null;
const layer = (build: (ctx: Ctx) => void): HTMLCanvasElement | null => {
  if (typeof document === "undefined") return null;
  const canvas = document.createElement("canvas");
  canvas.width = VIEW_W;
  canvas.height = WORLD_H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.translate(-VIEW_X0, 0);
  build(ctx);
  return canvas;
};

// ---- animated pieces --------------------------------------------------------------------------------------------
const torch = (ctx: Ctx, point: Pt, time: number, still: boolean, seed: number) => {
  const { x, y } = point;
  // light pools on the wall and floor (soft, BELOW every character)
  const flick = still ? 0 : Math.sin(time * 9 + seed * 2) * 0.012;
  ctx.fillStyle = COZY.torchGlow;
  for (let k = 0; k < 3; k++) {
    ctx.globalAlpha = 0.045 + flick;
    const half = 12 + k * 9;
    ctx.fillRect(x - half, y - 8 - half * 0.5, half * 2, half + 8);
  }
  for (let k = 0; k < 3; k++) {
    ctx.globalAlpha = 0.04 + flick;
    const half = 14 + k * 10;
    ctx.fillRect(x - half, y + 22 - k * 3, half * 2, 14 + k * 8);
  }
  ctx.globalAlpha = 1;
  // bracket and cup
  rect(ctx, MORTAR, x - 3, y - 1, 7, 10);
  rect(ctx, IRON, x - 1, y + 2, 3, 6);
  rect(ctx, IRON_HI, x - 1, y + 2, 1, 6);
  rect(ctx, IRON_DARK, x - 3, y - 1, 7, 3);
  rect(ctx, IRON, x - 3, y - 1, 7, 1);
  // flame (opaque, three frames; frozen under reduced motion)
  const frame = still ? 0 : Math.floor(time * 7 + seed) % 3;
  const height = 6 + (frame === 1 ? 2 : 0);
  rect(ctx, FLAME[0], x - 2, y - 1 - height, 5, height);
  rect(ctx, FLAME[0], x - 1 + (frame === 2 ? 1 : 0), y - 2 - height, 3, 2);
  rect(ctx, FLAME[1], x - 1, y - height, 3, height - 1);
  rect(ctx, FLAME[2], x, y - height + 2, 1, height - 3);
  rect(ctx, MORTAR, x - 3, y - 1 - height, 1, height);
  rect(ctx, MORTAR, x + 3, y - 1 - height, 1, height);
};

const channel = (
  ctx: Ctx,
  zone: { x0: number; x1: number; y: number; h: number },
  tones: [string, string, string, string],
  time: number,
  still: boolean,
  seed: number,
) => {
  const width = zone.x1 - zone.x0;
  rect(ctx, tones[0], zone.x0, zone.y, width, zone.h);
  rect(ctx, tones[1], zone.x0, zone.y, width, 2);
  const shift = still ? 0 : time * 6;
  for (let i = 0; i < width / 6; i++) {
    const px = zone.x0 + ((i * 6 + shift) % width);
    const py = zone.y + 2 + (hash(i, seed) % (zone.h - 3));
    rect(ctx, tones[2], px, py, 3, 1);
    if (hash(i, seed + 1) % 3 === 0) rect(ctx, tones[3], px + 1, py - 1, 1, 1);
  }
  // bubbles that pop
  for (let i = 0; i < 4; i++) {
    const phase = still ? 0.4 : (time * 0.7 + i * 0.37 + seed) % 1;
    const bx = zone.x0 + 8 + ((hash(i, seed) % (width - 16)) | 0);
    if (phase < 0.6) rect(ctx, tones[3], bx, zone.y + zone.h - 2 - Math.floor(phase * 6), 2, 2);
    else if (phase < 0.7) rect(ctx, tones[2], bx - 1, zone.y + 1, 4, 1);
  }
};

const lightFloorByChannel = (ctx: Ctx, zone: { x0: number; x1: number; y: number; h: number }, color: string) => {
  ctx.fillStyle = color;
  for (let k = 0; k < 4; k++) {
    ctx.globalAlpha = 0.1 - k * 0.02;
    ctx.fillRect(zone.x0 - 4, zone.y + zone.h + 2 + k * 5, zone.x1 - zone.x0 + 8, 5);
  }
  ctx.globalAlpha = 1;
};

const animated = (ctx: Ctx, time: number, still: boolean) => {
  TORCHES.forEach((point, i) => torch(ctx, point, time, still, i));
  // stairway torch is the daylight itself: nothing to flicker.
  lightFloorByChannel(ctx, SLIME, "#7ccb62");
  lightFloorByChannel(ctx, LAVA, "#ff5a2a");
  channel(ctx, SLIME, ["#2f6b3a", "#5aa852", "#7ccb62", "#c8f59a"], time, still, 3);
  channel(ctx, LAVA, ["#a8200f", "#ff5a2a", "#ffb040", "#ffe14a"], time, still, 7);
  // slime dripping from the pipe into the channel
  const drop = still ? 0.5 : (time * 0.9) % 1;
  rect(ctx, "#5aa852", 175, 46, 2, 2);
  rect(ctx, "#7ccb62", 175, 48 + Math.floor(drop * 12), 2, 3);
  if (drop > 0.85) rect(ctx, "#c8f59a", 173, 61, 6, 1);
  // the demon's eyes: glow red, blink now and then
  const blink = !still && Math.floor(time * 1.6) % 7 === 0;
  for (const ex of [284, 304]) {
    rect(ctx, "#0b0912", ex - 1, 22, 11, 6);
    if (blink) rect(ctx, "#6e1a1a", ex, 25, 9, 1);
    else {
      rect(ctx, "#ff3b2a", ex, 23, 9, 4);
      rect(ctx, "#ffb070", ex + 3, 24, 3, 2);
    }
  }
  // glowing eyes in the right-hand cell, watching
  const eyes = still || Math.floor(time * 0.8) % 5 !== 0;
  if (eyes) {
    rect(ctx, "#ff3b2a", -14, 36, 2, 2);
    rect(ctx, "#ff3b2a", -9, 36, 2, 2);
    rect(ctx, "#ffb070", -14, 36, 1, 1);
    rect(ctx, "#ffb070", -9, 36, 1, 1);
  }
  // twinkles on the treasure
  for (let i = 0; i < 4; i++) {
    const on = still ? i % 2 === 0 : Math.floor(time * 3 + i * 1.7) % 3 === 0;
    if (!on) continue;
    const sx = 346 + ((i * 11) % 30),
      sy = 156 + ((i * 7) % 16);
    rect(ctx, "#ffffff", sx, sy, 1, 1);
    rect(ctx, "#fff3a0", sx - 1, sy, 3, 1);
    rect(ctx, "#fff3a0", sx, sy - 1, 1, 3);
  }
};

export const drawDungeonBack = (ctx: Ctx, time: number, still: boolean) => {
  if (!backLayer) backLayer = layer(buildBack);
  if (backLayer) ctx.drawImage(backLayer, VIEW_X0, 0);
  else buildBack(ctx);
  animated(ctx, time, still);
};

export const drawDungeonFront = (ctx: Ctx, time: number, still: boolean) => {
  if (!frontLayer) frontLayer = layer(buildFront);
  if (frontLayer) ctx.drawImage(frontLayer, VIEW_X0, 0);
  else buildFront(ctx);
  // water dripping off the stalactites (opaque 1px drops in the top band only)
  if (still) return;
  for (let i = 0; i < 3; i++) {
    const phase = (time * 0.8 + i * 0.33) % 1;
    rect(ctx, "#8fd3ff", [-34, 126, 270][i] + 1, 14 + Math.floor(phase * 10), 1, 2);
  }
};
