import {
  BRAZIER_POS,
  LANTERN_POS,
  TORCH_POS,
  buildFloorDecor,
  buildForeground,
  buildFrontDecor,
  buildWallDecor,
  drawAmbienceBack,
  drawAmbienceFront,
  drawBrazierDim,
  floorTone,
  wallTone,
} from "./dungeonAmbience";
import { THRONE_SEAT_DX, THRONE_SEAT_DY, throneSprite } from "./dungeonLordSprite";
import { MON_DX, VIEW_W, VIEW_X0, WORLD_H, type Pt } from "./layout";
import type { MonsterKind } from "./palette";

/**
 * The dungeon interior: the scene the canvas switches to when the user looks inside the dark castle. It lives in the
 * same world coordinates as the field (x from VIEW_X0 to VIEW_X0 + VIEW_W, y 0..WORLD_H), so the camera and the
 * characters' drawing helpers work unchanged. Three chambers (guard hall with cells, slime vault, lava lair) side by
 * side behind one wide flagstone floor, an entrance stairway on the far left (the way back up to the guild gate).
 * Everything here is opaque pixel art: lighting is baked into the palette (see dungeonAmbience.ts), nothing translucent.
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
/** the dungeon has three floors: B1 stone halls, B2 flooded catacombs, B3 the Dungeon Lord's throne cavern */
export const DUNGEON_FLOORS = 3;
/** where the Dungeon Lord stands on B3 (its feet; the 48x48 sprite is centred on x) */
const LORD_FEET: Pt = { x: 262, y: 120 };
export const dungeonLordPoint = (): Pt => LORD_FEET;
/** the throne's seat on the dais: the seated Lord's bottom-centre (boot soles); he steps down to LORD_FEET to fight */
const THRONE_SEAT_Y = 86;
const THRONE_CX = 336;
export const dungeonThronePoint = (): Pt => ({ x: THRONE_CX, y: THRONE_SEAT_Y });
/** floor 3: raiders ring the Lord on its left, three rings deep (the first eight slots take the inner ring) */
const LORD_RING_R = [48, 76, 104];
const LORD_RING_ANGLES = [3, 4, 2, 5, 1, 6, 0, 7];
const LORD_RING_SPAN = 56;
const LORD_RING_SQUASH = 0.62;
const LORD_RING_ANGLE_STEPS = 7;
export const LORD_SPOTS: Pt[] = Array.from({ length: SPOT_COUNT_COLS * LORD_RING_R.length }, (_, i) => {
  const ring = Math.floor(i / SPOT_COUNT_COLS);
  const angle = ((LORD_RING_ANGLES[i % SPOT_COUNT_COLS] / LORD_RING_ANGLE_STEPS) * 2 - 1) * LORD_RING_SPAN;
  const rad = (angle * Math.PI) / 180;
  return {
    x: Math.round(LORD_FEET.x - 20 - LORD_RING_R[ring] * Math.cos(rad)),
    y: Math.round(LORD_FEET.y + LORD_RING_R[ring] * Math.sin(rad) * LORD_RING_SQUASH),
  };
});
/** the floors' raider spots (B1 and B2 share a layout, B3 rings the Lord) */
export const dungeonSpotsOf = (floor: number): Pt[] => (floor >= DUNGEON_FLOORS ? LORD_SPOTS : DUNGEON_SPOTS);
/** where the raider in overflow slot `slot` stands on `floor` (1..3) of the dungeon */
export const dungeonSpotOf = (slot: number, floor = 1): Pt => dungeonSpotsOf(floor)[dungeonSpotIndex(slot)];
/** the top of the stairs down on B1 and B2: raiders walk here before they appear one floor lower */
const STAIRS_POINT: Pt = { x: VIEW_X0 + 24, y: 200 };
export const dungeonStairsPoint = (_floor = 1): Pt => STAIRS_POINT;
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
const TORCHES: Pt[] = TORCH_POS;
const X_END = VIEW_X0 + VIEW_W;
const SLIME = { x0: 100, x1: 236, y: 62, h: 9 };
const LAVA = { x0: 248, x1: 334, y: 62, h: 9 };

const rect = (ctx: Ctx, color: string, x: number, y: number, width: number, height: number) => {
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x), Math.round(y), width, height);
};
/** a rect painted in 3x3 blocks, each toned by the floor's or the wall's light (palette only, dithered, opaque) */
const litRect = (
  ctx: Ctx,
  tone: (x: number, y: number, base: string) => string,
  color: string,
  x: number,
  y: number,
  width: number,
  height: number,
) => {
  for (let by = 0; by < height; by += 3)
    for (let bx = 0; bx < width; bx += 3)
      rect(ctx, tone(x + bx + 1, y + by + 1, color), x + bx, y + by, Math.min(3, width - bx), Math.min(3, height - by));
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
      litRect(ctx, (px, py, base) => wallTone(1, px, py, base), pick(WALL, x, y), x + 1, y + 1, 17, 6);
      litRect(ctx, (px, py, base) => wallTone(1, px, py, base), WALL_HI, x + 1, y + 1, 17, 1);
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
      const tone = (px: number, py: number, base: string) => floorTone(1, px, py, base);
      litRect(ctx, tone, pick(tones, x, y), x + 1, y + 1, 19, 11);
      litRect(ctx, tone, tones[3], x + 1, y + 1, 19, 1);
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

const buildBackB1 = (ctx: Ctx) => {
  drawWall(ctx);
  buildWallDecor(ctx, 1);
  drawFloor(ctx);
  buildFloorDecor(ctx, 1);
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
  stairsDown(ctx);
  buildForeground(ctx, 1);
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
  buildFrontDecor(ctx, 1);
};

// ---- the stairs between floors ----------------------------------------------------------------------------------
/** the way down on B1 and B2: a dark stairwell in the bottom-left corner of the floor */
const STAIRS_DOWN_X = VIEW_X0 + 4;
const STAIRS_DOWN_Y = 188;
const stairsDown = (ctx: Ctx) => {
  const x0 = STAIRS_DOWN_X,
    y0 = STAIRS_DOWN_Y;
  rect(ctx, MORTAR, x0 - 1, y0 - 1, 42, 24);
  rect(ctx, "#4a4f63", x0, y0, 40, 3);
  rect(ctx, WALL_HI, x0, y0, 40, 1);
  const shades = ["#2a2b3a", "#1f2030", "#171826", "#10111c", "#0a0a12"];
  shades.forEach((shade, step) => {
    rect(ctx, shade, x0 + 2 + step * 3, y0 + 3 + step * 4, 36 - step * 6, 4);
    rect(ctx, mixDown(shade), x0 + 2 + step * 3, y0 + 6 + step * 4, 36 - step * 6, 1);
  });
  // an arrow pointing down, in bone white
  rect(ctx, BONE, x0 + 18, y0 + 6, 4, 4);
  rect(ctx, BONE, x0 + 16, y0 + 10, 8, 1);
  rect(ctx, BONE, x0 + 17, y0 + 11, 6, 1);
  rect(ctx, BONE, x0 + 18, y0 + 12, 4, 1);
  rect(ctx, BONE, x0 + 19, y0 + 13, 2, 1);
};
const mixDown = (color: string): string => {
  const value = parseInt(color.slice(1), 16);
  const part = (shift: number) => Math.max(0, ((value >> shift) & 255) - 14);
  return `#${((part(16) << 16) | (part(8) << 8) | part(0)).toString(16).padStart(6, "0")}`;
};

/** the way up (to the floor above): a dark arch with a few steps and a lit lantern, same spot as the surface door */
const stairsUp = (ctx: Ctx, glow: string, glowHi: string, frame: string, stone: string) => {
  const x0 = STAIR_X;
  rect(ctx, MORTAR, x0 - 3, 4, 40, 62);
  rect(ctx, frame, x0 - 2, 6, 38, 60);
  rect(ctx, "#070a10", x0 + 1, 10, 32, 38);
  rect(ctx, "#0e141c", x0 + 1, 30, 32, 18);
  rect(ctx, glow, x0 + 12, 14, 10, 14);
  rect(ctx, glowHi, x0 + 14, 17, 6, 8);
  rect(ctx, frame, x0 - 2, 6, 38, 4);
  rect(ctx, WALL_HI, x0 - 2, 6, 38, 1);
  rect(ctx, frame, x0 + 1, 8, 6, 3);
  rect(ctx, frame, x0 + 27, 8, 6, 3);
  for (let step = 0; step < 6; step++) {
    const y = 48 + step * 8;
    const inset = (5 - step) * 2;
    rect(ctx, "#1a1c28", x0 - 2 + inset, y + 6, 38 - inset * 2, 3);
    rect(ctx, stone, x0 - 2 + inset, y, 38 - inset * 2, 6);
    rect(ctx, mixDown(stone), x0 - 2 + inset, y + 5, 38 - inset * 2, 1);
  }
  // an arrow pointing up above the arch
  rect(ctx, BONE, x0 + 16, 0, 2, 3);
  rect(ctx, BONE, x0 + 15, 3, 4, 1);
};

// ---- B2: the flooded catacombs ----------------------------------------------------------------------------------
const CMORTAR = "#0a1216";
const CWALL = ["#1d2a30", "#203239", "#1a262b", "#24363d"];
const CWALL_HI = "#3f5a63";
const CFLOOR = ["#1f2b2f", "#233237", "#1b2629", "#293a40"];
const WATER_TONES: [string, string, string, string] = ["#1d5f6e", "#2f9aa0", "#5fd0c0", "#b8f5e0"];
const GHOST = "#9ff5ee",
  GHOST_HI = "#e8fffb",
  GHOST_LO = "#3fb7b0";
const COFFIN = ["#5a3d2b", "#7a553b", "#3b271b"];
const WATER_B2 = { x0: VIEW_X0 + 46, x1: X_END, y: 62, h: 9 };
const GHOST_LANTERNS: Pt[] = LANTERN_POS;

const coffin = (ctx: Ctx, x: number, y: number, open: boolean) => {
  rect(ctx, CMORTAR, x - 1, y + 3, 18, 36);
  rect(ctx, CMORTAR, x + 3, y - 1, 10, 6);
  rect(ctx, COFFIN[0], x, y + 6, 16, 32);
  rect(ctx, COFFIN[0], x + 3, y + 2, 10, 5);
  rect(ctx, COFFIN[1], x, y + 6, 2, 32);
  rect(ctx, COFFIN[1], x + 3, y + 2, 10, 1);
  rect(ctx, COFFIN[2], x + 13, y + 6, 3, 32);
  if (open) {
    rect(ctx, CMORTAR, x + 3, y + 9, 10, 26);
    rect(ctx, BONE, x + 11, y + 22, 4, 2); // a bony hand on the rim
    rect(ctx, BONE_DARK, x + 14, y + 24, 1, 2);
    rect(ctx, BONE, x + 5, y + 11, 5, 4); // the occupant's skull peeks out
    rect(ctx, CMORTAR, x + 6, y + 12, 1, 2);
    rect(ctx, CMORTAR, x + 8, y + 12, 1, 2);
  } else {
    rect(ctx, BONE_DARK, x + 7, y + 11, 2, 11);
    rect(ctx, BONE_DARK, x + 4, y + 14, 8, 2);
    rect(ctx, "#8a8f9c", x + 2, y + 34, 12, 2); // iron band
  }
};

const drawWallB2 = (ctx: Ctx) => {
  rect(ctx, CMORTAR, VIEW_X0, 0, VIEW_W, WALL_BASE_Y);
  for (let row = 0, y = 0; y < WALL_BASE_Y; y += 7, row++) {
    for (let x = VIEW_X0 - (row % 2) * 9; x < X_END; x += 18) {
      litRect(ctx, (px, py, base) => wallTone(2, px, py, base), pick(CWALL, x, y), x + 1, y + 1, 17, 6);
      litRect(ctx, (px, py, base) => wallTone(2, px, py, base), CWALL_HI, x + 1, y + 1, 17, 1);
      if (hash(x, y) % 8 === 0) rect(ctx, CMORTAR, x + 3 + (hash(y, x) % 10), y + 2, 1, 4);
    }
  }
  // ossuary: a dark niche band of stacked skulls running along the wall
  rect(ctx, CMORTAR, VIEW_X0, 16, VIEW_W, 18);
  for (let x = VIEW_X0 + 4; x < X_END - 6; x += 10) {
    if (hash(x, 5) % 6 === 0) continue;
    skull(ctx, x, 18);
    if (hash(x, 9) % 3 === 0) skull(ctx, x + 4, 26);
  }
  rect(ctx, "#2b3f47", VIEW_X0, 34, VIEW_W, 2);
  rect(ctx, CWALL_HI, VIEW_X0, 34, VIEW_W, 1);
  rect(ctx, "#14202a", VIEW_X0, WALL_BASE_Y - 5, VIEW_W, 5);
  rect(ctx, CMORTAR, VIEW_X0, WALL_BASE_Y - 1, VIEW_W, 1);
  rect(ctx, "#14202a", VIEW_X0, 0, VIEW_W, 3);
};

const drawFloorB2 = (ctx: Ctx) => {
  rect(ctx, CMORTAR, VIEW_X0, WALL_BASE_Y, VIEW_W, WORLD_H - WALL_BASE_Y);
  for (let row = 0, y = WALL_BASE_Y; y < WORLD_H; y += 12, row++) {
    for (let x = VIEW_X0 - (row % 2) * 10; x < X_END; x += 20) {
      const tone = (px: number, py: number, base: string) => floorTone(2, px, py, base);
      litRect(ctx, tone, pick(CFLOOR, x, y), x + 1, y + 1, 19, 11);
      litRect(ctx, tone, CFLOOR[3], x + 1, y + 1, 19, 1);
      if (hash(x, y) % 7 === 0) rect(ctx, CMORTAR, x + 4 + (hash(y, x) % 10), y + 4, 5, 1);
    }
  }
  rect(ctx, "#14202a", VIEW_X0, WALL_BASE_Y, VIEW_W, 3);
};

const buildBackB2 = (ctx: Ctx) => {
  drawWallB2(ctx);
  buildWallDecor(ctx, 2);
  drawFloorB2(ctx);
  buildFloorDecor(ctx, 2);
  stairsUp(ctx, GHOST_LO, GHOST, "#3a5560", "#4c6670");
  coffin(ctx, -8, 28, true);
  coffin(ctx, 20, 30, false);
  coffin(ctx, 150, 28, false);
  coffin(ctx, 176, 30, true);
  coffin(ctx, 306, 28, true);
  coffin(ctx, 334, 30, false);
  pillar(ctx, PILLAR_A_X);
  pillar(ctx, PILLAR_B_X);
  // the flood channel along the foot of the wall, with a stone rim
  channelRim(ctx, WATER_B2);
  bones(ctx);
  stairsDown(ctx);
  buildForeground(ctx, 2);
};

const animatedB2 = (ctx: Ctx, time: number, still: boolean) => {
  drawAmbienceBack(ctx, time, still, 2);
  channel(ctx, WATER_B2, WATER_TONES, time, still, 11);
  GHOST_LANTERNS.forEach((lantern, i) => {
    const bob = still ? 0 : Math.round(Math.sin(time * 1.4 + i * 1.7) * 1.5);
    const { x } = lantern,
      y = lantern.y + bob;
    rect(ctx, IRON_DARK, x, 0, 1, y - 4); // the chain from the ceiling
    rect(ctx, IRON_DARK, x - 3, y - 4, 7, 2);
    rect(ctx, IRON, x - 3, y - 2, 7, 8);
    rect(ctx, MORTAR, x - 4, y - 3, 1, 10);
    rect(ctx, MORTAR, x + 4, y - 3, 1, 10);
    const flicker = still ? 0 : Math.floor(time * 6 + i) % 3;
    rect(ctx, GHOST_LO, x - 2, y - 1, 5, 6);
    rect(ctx, GHOST, x - 1, y - 1 - (flicker === 1 ? 1 : 0), 3, 5);
    rect(ctx, GHOST_HI, x, y + (flicker === 2 ? 1 : 0), 1, 3);
    rect(ctx, IRON_DARK, x - 3, y + 6, 7, 2);
  });
  // wisps drifting up off the water
  if (still) return;
  for (let i = 0; i < 5; i++) {
    const phase = (time * 0.25 + i * 0.2) % 1;
    const wx = WATER_B2.x0 + 20 + ((i * 71) % (WATER_B2.x1 - WATER_B2.x0 - 40));
    rect(ctx, GHOST, wx + Math.round(Math.sin(phase * 9 + i) * 3), 60 - Math.floor(phase * 22), 1, 2);
  }
};

// ---- B3: the Dungeon Lord's throne cavern ------------------------------------------------------------------------
const RMORTAR = "#0c0609";
const RWALL = ["#241218", "#2a161c", "#1e0f14", "#301a21"];
const RWALL_HI = "#52303a";
const RFLOOR = ["#1c1620", "#211a26", "#17121b", "#281f2e"];
const LAVA_TONES: [string, string, string, string] = ["#a8200f", "#ff5a2a", "#ffb040", "#ffe14a"];
const OBSIDIAN = ["#3f3560", "#5a4e86", "#241c40", "#8a7cc0"];
const THRONE_X = THRONE_CX;
const LAVA_POOLS = [
  { x0: VIEW_X0 + 4, x1: -34, y: 62, h: 9 },
  { x0: 132, x1: 176, y: 62, h: 9 },
  { x0: 228, x1: 272, y: 62, h: 9 },
];
const LAVA_FALLS = [-52, 148, 250];
const CHAIN_X = [-34, 40, 100, 270];
const BRAZIERS: Pt[] = BRAZIER_POS;

const drawWallB3 = (ctx: Ctx) => {
  rect(ctx, RMORTAR, VIEW_X0, 0, VIEW_W, WALL_BASE_Y);
  // rough cave rock: uneven blocks
  for (let y = 0; y < WALL_BASE_Y; y += 9) {
    for (let x = VIEW_X0 - (hash(y, 1) % 14); x < X_END;) {
      const wide = 12 + (hash(x, y) % 18);
      litRect(ctx, (px, py, base) => wallTone(3, px, py, base), pick(RWALL, x, y), x + 1, y + 1, wide - 1, 8);
      litRect(ctx, (px, py, base) => wallTone(3, px, py, base), RWALL_HI, x + 1, y + 1, wide - 1, 1);
      if (hash(x, y) % 8 === 0) rect(ctx, RMORTAR, x + 3, y + 3, 1, 5);
      x += wide;
    }
  }
  rect(ctx, "#190d11", VIEW_X0, WALL_BASE_Y - 5, VIEW_W, 5);
  rect(ctx, RMORTAR, VIEW_X0, WALL_BASE_Y - 1, VIEW_W, 1);
  rect(ctx, "#190d11", VIEW_X0, 0, VIEW_W, 3);
};

const drawFloorB3 = (ctx: Ctx) => {
  rect(ctx, RMORTAR, VIEW_X0, WALL_BASE_Y, VIEW_W, WORLD_H - WALL_BASE_Y);
  for (let row = 0, y = WALL_BASE_Y; y < WORLD_H; y += 12, row++) {
    for (let x = VIEW_X0 - (row % 2) * 10; x < X_END; x += 20) {
      const tone = (px: number, py: number, base: string) => floorTone(3, px, py, base);
      litRect(ctx, tone, pick(RFLOOR, x, y), x + 1, y + 1, 19, 11);
      litRect(ctx, tone, RFLOOR[3], x + 1, y + 1, 19, 1);
      if (hash(x, y) % 6 === 0) rect(ctx, LAVA_TONES[0], x + 3 + (hash(y, x) % 9), y + 5, 6, 1); // an ember crack
      if (hash(x, y) % 14 === 0) rect(ctx, LAVA_TONES[1], x + 5 + (hash(y, x) % 6), y + 5, 2, 1);
    }
  }
  rect(ctx, "#190d11", VIEW_X0, WALL_BASE_Y, VIEW_W, 3);
  // the red carpet runs from the stairs to the foot of the throne, trimmed in gold
  const carpetY = 110;
  rect(ctx, RMORTAR, VIEW_X0 + 40, carpetY - 1, THRONE_X - 30 - VIEW_X0 - 40, 22);
  rect(ctx, "#7a1426", VIEW_X0 + 40, carpetY, THRONE_X - 30 - VIEW_X0 - 40, 20);
  rect(ctx, "#9c1f36", VIEW_X0 + 40, carpetY + 2, THRONE_X - 30 - VIEW_X0 - 40, 2);
  rect(ctx, GOLD_DIM, VIEW_X0 + 40, carpetY, THRONE_X - 30 - VIEW_X0 - 40, 1);
  rect(ctx, GOLD_DIM, VIEW_X0 + 40, carpetY + 19, THRONE_X - 30 - VIEW_X0 - 40, 1);
  for (let x = VIEW_X0 + 52; x < THRONE_X - 40; x += 24) rect(ctx, GOLD_DIM, x, carpetY + 8, 6, 3);
};

const chain = (ctx: Ctx, x: number, length: number) => {
  for (let y = 0; y < length; y += 7) {
    const wide = (y / 7) % 2 === 0;
    rect(ctx, RMORTAR, x - 1, y - 1, wide ? 9 : 5, 9);
    rect(ctx, IRON, x, y, wide ? 7 : 3, 7);
    rect(ctx, IRON_HI, x, y, wide ? 7 : 3, 1);
    rect(ctx, RMORTAR, x + (wide ? 2 : 1), y + 2, wide ? 3 : 1, 3);
  }
  // a rusted hook at the end
  rect(ctx, RMORTAR, x - 2, length - 1, 12, 5);
  rect(ctx, IRON_DARK, x - 1, length, 10, 3);
  rect(ctx, IRON, x + 1, length + 3, 3, 4);
};

const throne = (ctx: Ctx) => {
  const cx = THRONE_X;
  // dais steps in front of the wall
  for (let step = 0; step < 3; step++) {
    const half = 30 + step * 8;
    const y = 66 + step * 9;
    rect(ctx, RMORTAR, cx - half - 1, y - 1, half * 2 + 2, 11);
    rect(ctx, OBSIDIAN[0], cx - half, y, half * 2, 9);
    rect(ctx, OBSIDIAN[3], cx - half, y, half * 2, 1);
    rect(ctx, GOLD_DIM, cx - half, y + 8, half * 2, 1);
  }
  // the throne itself (far right against the wall; the Lord sits on it as a character, drawn over this layer)
  if (typeof document !== "undefined")
    ctx.drawImage(throneSprite(), cx - THRONE_SEAT_DX, THRONE_SEAT_Y - THRONE_SEAT_DY);
  // bones heaped at the foot
  skull(ctx, cx - 44, 100);
  skull(ctx, cx + 38, 102);
  rect(ctx, BONE, cx - 40, 108, 9, 2);
  rect(ctx, BONE_DARK, cx + 36, 110, 8, 2);
};

const buildBackB3 = (ctx: Ctx) => {
  drawWallB3(ctx);
  buildWallDecor(ctx, 3);
  drawFloorB3(ctx);
  buildFloorDecor(ctx, 3);
  stairsUp(ctx, LAVA_TONES[1], LAVA_TONES[3], "#4a3040", "#6a4a58");
  for (const pool of LAVA_POOLS) channelRim(ctx, pool);
  for (const x of CHAIN_X) chain(ctx, x, 34 + (hash(x, 4) % 22));
  throne(ctx);
  buildForeground(ctx, 3);
};

/**
 * The Dungeon Lord fight's mood for floor 3, set by the renderer right before it draws the floor (0 = calm):
 * `dim` darkens the braziers (the intro), `surge` swells the lava falls (the enrage), `thrones` darkens the empty throne.
 */
const mood = { dim: 0, surge: 0, throne: 0 };
export const setLordMood = (dim: number, surge: number, throne: number) => {
  mood.dim = dim;
  mood.surge = surge;
  mood.throne = throne;
};

const lavaFall = (ctx: Ctx, x: number, time: number, still: boolean, surge = 0) => {
  const wide = surge > 0 ? Math.round(surge * 3) : 0; // the fall swells on both sides
  rect(ctx, RMORTAR, x - 1 - wide, 0, 14 + wide * 2, WALL_BASE_Y);
  rect(ctx, LAVA_TONES[0], x - wide, 0, 12 + wide * 2, WALL_BASE_Y);
  rect(ctx, LAVA_TONES[1], x + 2 - wide, 0, 8 + wide * 2, WALL_BASE_Y);
  const shift = still ? 0 : Math.floor(time * (20 + surge * 26));
  const blobs = surge > 0 ? 14 : 9;
  for (let i = 0; i < blobs; i++) {
    const y = (i * (surge > 0 ? 6 : 9) + shift) % WALL_BASE_Y;
    rect(ctx, LAVA_TONES[2], x + 3 + ((i * 5) % 5), y, 2, 5);
    rect(ctx, LAVA_TONES[3], x + 4 + ((i * 3) % 4), y + 1, 1, 2);
    if (surge > 0) rect(ctx, LAVA_TONES[3], x + ((i * 7) % 12), (y + 11) % WALL_BASE_Y, 2, 3);
  }
  rect(ctx, LAVA_TONES[3], x + 4 - wide, WALL_BASE_Y - 3, 4 + wide * 2, 3 + wide); // the splash where it lands
  if (surge > 0 && !still) {
    // spray flung off the splash
    for (let k = 0; k < 4; k++) {
      const phase = (time * 1.6 + k * 0.25) % 1;
      rect(
        ctx,
        LAVA_TONES[k % 2 ? 2 : 3],
        x + 6 + Math.round((k - 1.5) * 6 * phase),
        WALL_BASE_Y - 4 - Math.round(Math.sin(phase * Math.PI) * 9),
        2,
        2,
      );
    }
  }
};

/** the throne's dark silhouette (a dim overlay that touches only the throne's own pixels) */
let throneShade: HTMLCanvasElement | null = null;
const drawThroneShade = (ctx: Ctx) => {
  if (mood.throne <= 0 || typeof document === "undefined") return;
  if (!throneShade) {
    const src = throneSprite();
    throneShade = document.createElement("canvas");
    throneShade.width = src.width;
    throneShade.height = src.height;
    const shade = throneShade.getContext("2d");
    if (shade) {
      shade.drawImage(src, 0, 0);
      shade.globalCompositeOperation = "source-in";
      shade.fillStyle = "#07050d";
      shade.fillRect(0, 0, src.width, src.height);
    }
  }
  ctx.globalAlpha = 0.72 * mood.throne;
  ctx.drawImage(throneShade, THRONE_CX - THRONE_SEAT_DX, THRONE_SEAT_Y - THRONE_SEAT_DY);
  ctx.globalAlpha = 1;
};

const animatedB3 = (ctx: Ctx, time: number, still: boolean) => {
  drawBrazierDim(ctx, mood.dim);
  drawAmbienceBack(ctx, time, still, 3);
  BRAZIERS.forEach((point, i) => torch(ctx, point, time, still, i, mood.dim));
  drawThroneShade(ctx);
  for (const pool of LAVA_POOLS) channel(ctx, pool, LAVA_TONES, time, still, 7 + pool.x0);
  for (const x of LAVA_FALLS) lavaFall(ctx, x, time, still, mood.surge);
  // embers rising from the lava cracks in the floor
  if (still) return;
  for (let i = 0; i < 10; i++) {
    const phase = (time * 0.35 + i * 0.1) % 1;
    const ex = VIEW_X0 + 14 + ((i * 53) % (VIEW_W - 28));
    rect(
      ctx,
      phase < 0.5 ? LAVA_TONES[2] : LAVA_TONES[1],
      ex + Math.round(Math.sin(phase * 8 + i) * 2),
      200 - Math.floor(phase * 90),
      1,
      1,
    );
  }
};

/** B2 / B3 foregrounds: a plain rock ceiling edge with stalactites (no stone beams or arches: those belong to B1) */
const CEILING_PALETTES = [
  { edge: "#0d1822", rock: "#1c2e3a", hi: "#2c4656", tip: "#16242e" },
  { edge: "#14070a", rock: "#2a1216", hi: "#4a2128", tip: "#1d0c10" },
];
const CAVE_STALACTITES = [-66, -30, 22, 74, 118, 150, 190, 232, 282, 322, 354];
const buildCaveFront = (ctx: Ctx, palette: (typeof CEILING_PALETTES)[number]) => {
  rect(ctx, palette.edge, VIEW_X0, 0, VIEW_W, 6);
  for (let x = VIEW_X0; x < X_END; x += 12) {
    rect(ctx, palette.rock, x + 1, 0, 11, 4 + (hash(x, 5) % 2));
    rect(ctx, palette.hi, x + 1, 0, 11, 1);
  }
  for (const sx of CAVE_STALACTITES) {
    const len = 3 + (hash(sx, 2) % 5);
    for (let k = 0; k < len; k++)
      rect(ctx, k < len - 2 ? palette.rock : palette.tip, sx + (k < len - 2 ? 0 : 1), 6 + k, k < len - 2 ? 3 : 1, 1);
  }
};
const buildFrontB2 = (ctx: Ctx) => {
  buildCaveFront(ctx, CEILING_PALETTES[0]);
  buildFrontDecor(ctx, 2);
};
const buildFrontB3 = (ctx: Ctx) => {
  buildCaveFront(ctx, CEILING_PALETTES[1]);
  buildFrontDecor(ctx, 3);
};

// ---- caches -----------------------------------------------------------------------------------------------------
const backLayers: (HTMLCanvasElement | null | undefined)[] = [];
let frontLayer: HTMLCanvasElement | null = null;
const caveFrontLayers: (HTMLCanvasElement | null | undefined)[] = [];
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
const torch = (ctx: Ctx, point: Pt, time: number, still: boolean, seed: number, dim = 0) => {
  const { x, y } = point;
  const light = 1 - dim; // `dim` (0..1) is the Lord's intro snuffing the braziers; the pools themselves are baked palette
  // bracket and cup
  rect(ctx, MORTAR, x - 3, y - 1, 7, 10);
  rect(ctx, IRON, x - 1, y + 2, 3, 6);
  rect(ctx, IRON_HI, x - 1, y + 2, 1, 6);
  rect(ctx, IRON_DARK, x - 3, y - 1, 7, 3);
  rect(ctx, IRON, x - 3, y - 1, 7, 1);
  // flame (opaque, three frames; frozen under reduced motion)
  const frame = still ? 0 : Math.floor(time * 7 + seed) % 3;
  const height = Math.max(2, Math.round((6 + (frame === 1 ? 2 : 0)) * light));
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

const animated = (ctx: Ctx, time: number, still: boolean) => {
  drawAmbienceBack(ctx, time, still, 1);
  TORCHES.forEach((point, i) => torch(ctx, point, time, still, i));
  // stairway torch is the daylight itself: nothing to flicker.
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

const BACK_BUILDERS = [buildBackB1, buildBackB2, buildBackB3];
const ANIMATORS = [animated, animatedB2, animatedB3];

/** the static back of a floor (1..3; anything else draws B1) plus its animated pieces */
export const drawDungeonBack = (ctx: Ctx, time: number, still: boolean, floor = 1) => {
  const index = Math.min(Math.max(Math.round(floor) || 1, 1), DUNGEON_FLOORS) - 1;
  if (backLayers[index] === undefined) backLayers[index] = layer(BACK_BUILDERS[index]);
  const cached = backLayers[index];
  if (cached) ctx.drawImage(cached, VIEW_X0, 0);
  else BACK_BUILDERS[index](ctx);
  ANIMATORS[index](ctx, time, still);
};

export const drawDungeonFront = (ctx: Ctx, time: number, still: boolean, floor = 1) => {
  if (floor >= 2) {
    // B2 and B3 have their own rock ceiling (the stone beams and arches are B1's); B2 drips, B3 does not
    const index = Math.min(floor, DUNGEON_FLOORS) - 2;
    const build = index === 0 ? buildFrontB2 : buildFrontB3;
    if (caveFrontLayers[index] === undefined) caveFrontLayers[index] = layer(build);
    const cached = caveFrontLayers[index];
    if (cached) ctx.drawImage(cached, VIEW_X0, 0);
    else build(ctx);
    drawAmbienceFront(ctx, time, still, floor >= 3 ? 3 : 2);
    if (still || index > 0) return;
    for (let i = 0; i < 3; i++) {
      const phase = (time * 0.7 + i * 0.37) % 1;
      rect(ctx, "#6fb8d8", [-30, 118, 232][i] + 1, 14 + Math.floor(phase * 10), 1, 2);
    }
    return;
  }
  if (!frontLayer) frontLayer = layer(buildFront);
  if (frontLayer) ctx.drawImage(frontLayer, VIEW_X0, 0);
  else buildFront(ctx);
  drawAmbienceFront(ctx, time, still, 1);
  // water dripping off the stalactites (opaque 1px drops in the top band only)
  if (still) return;
  for (let i = 0; i < 3; i++) {
    const phase = (time * 0.8 + i * 0.33) % 1;
    rect(ctx, "#8fd3ff", [-34, 126, 270][i] + 1, 14 + Math.floor(phase * 10), 1, 2);
  }
};
