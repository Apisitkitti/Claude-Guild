export const WORLD_W = 384;
export const WORLD_H = 216;
export const CH_W = 16;
export const CH_H = 24;
/** `wait` (seconds): pause when this waypoint is reached. */
export interface Pt {
  x: number;
  y: number;
  wait?: number;
}

// ---- world split ----
/** Guild hall occupies x < HALL_W; wilderness is everything to the right. */
export const HALL_W = 126;
export const WALL_X0 = 118; // right wall of the hall (with the gate)
export const BACK_WALL_H = 52;

// ---- guild hall anchor points ----
export const DOOR: Pt = { x: 6, y: 176 };
export const DOOR_IN: Pt = { x: 30, y: 176 };
export const BOARD: Pt = { x: 30, y: 68 };
export const COUNTER: Pt = { x: 98, y: 80 };
export const GATE_Y = 124;
export const GATE_IN: Pt = { x: 112, y: GATE_Y };
export const GATE_OUT: Pt = { x: 134, y: GATE_Y };
export const GATE_OPEN = { y0: 102, y1: 146 };
export const TAVERN_SPOTS: Pt[] = [
  { x: 88, y: 160 },
  { x: 88, y: 180 },
  { x: 88, y: 200 },
];
export const NPC_POS: Pt = { x: 98, y: 54 };
export const BAR = { x: 98, y: 150, w: 18, h: 54 };
export const COUNTER_BOX = { x: 78, y: 46, w: 40, h: 18 };

// ---- battle spots (2 rows x 4) ----
const SPOT_COL_0 = 168;
const SPOT_COL_STEP = 60;
export const GRID_COLS = 4;
export const SPOT_COLS = [
  SPOT_COL_0,
  SPOT_COL_0 + SPOT_COL_STEP,
  SPOT_COL_0 + 2 * SPOT_COL_STEP,
  SPOT_COL_0 + (GRID_COLS - 1) * SPOT_COL_STEP,
];
const SPOT_ROW_0 = 102;
const SPOT_ROW_1 = 168;
export const SPOT_ROWS = [SPOT_ROW_0, SPOT_ROW_1];
export const ROAD_Y = GATE_Y;
export const DESK_COUNT = 8;
export const MON_DX = 22;

export const spotOf = (i: number): Pt => ({ x: SPOT_COLS[i % GRID_COLS], y: SPOT_ROWS[(i / GRID_COLS) | 0] });
export const monsterSpot = (i: number): Pt => {
  const spot = spotOf(i);
  return { x: spot.x + MON_DX, y: spot.y };
};
/** Camp: 3 rows x 14; beyond that everyone stacks on the last slot (render shows a +N badge). */
export const CAMP_COLS = 14;
const CAMP_ROWS = 3;
export const CAMP_MAX = CAMP_COLS * CAMP_ROWS;
const CAMP_X0 = 152;
const CAMP_Y0 = 206;
const CAMP_DX = 16;
const CAMP_DY = 12;
export const standSlot = (slot: number): Pt => {
  const capped = Math.min(Math.max(0, slot), CAMP_MAX - 1);
  return { x: CAMP_X0 + CAMP_DX * (capped % CAMP_COLS), y: CAMP_Y0 - CAMP_DY * ((capped / CAMP_COLS) | 0) };
};
export const seatPoint = (desk: number, slot: number): Pt => (desk >= 0 ? spotOf(desk) : standSlot(Math.max(0, slot)));
const SQUIRE_0_DX = -15;
const SQUIRE_1_DX = -11;
const SQUIRE_1_DY = -9;
const CAMP_SQUIRE_DX = 8;
const TAVERN_COUNT = TAVERN_SPOTS.length;
/** Squire (intern) standing point: just behind / left of the adventurer. */
export const squirePoint = (desk: number, index: number): Pt => {
  const spot = spotOf(desk);
  return index === 0
    ? { x: spot.x + SQUIRE_0_DX, y: spot.y + 2 }
    : { x: spot.x + SQUIRE_1_DX, y: spot.y + SQUIRE_1_DY };
};
/** Squire point for a camp (overflow) adventurer: tight, beside the adventurer. */
export const campSquirePoint = (slot: number, index: number): Pt => {
  const spot = standSlot(slot);
  return { x: spot.x + (index === 0 ? -CAMP_SQUIRE_DX : CAMP_SQUIRE_DX), y: spot.y + 1 };
};
export const tavernSpot = (order: number): Pt => TAVERN_SPOTS[((order % TAVERN_COUNT) + TAVERN_COUNT) % TAVERN_COUNT];

const dedupe = (pts: Pt[]): Pt[] => {
  const out: Pt[] = [];
  for (const point of pts) {
    const last = out[out.length - 1];
    if (!last || last.x !== point.x || last.y !== point.y) out.push(point);
    else if (point.wait) last.wait = point.wait;
  }
  return out;
};

/** seat -> point just outside the gate (first point = seat). */
const seatToGate = (desk: number, slot: number): Pt[] => {
  const spot = seatPoint(desk, slot);
  if (desk >= 0) return [spot, { x: spot.x, y: ROAD_Y }, { ...GATE_OUT }];
  return [spot, { x: GATE_OUT.x, y: spot.y }, { ...GATE_OUT }];
};

/** Full route door -> board (pause) -> gate -> seat (first point = DOOR). */
export const routeIn = (desk: number, slot: number): Pt[] => {
  const seatToG = seatToGate(desk, slot); // seat ... GATE_OUT
  const outside = [...seatToG].reverse(); // GATE_OUT ... seat
  return dedupe([
    { ...DOOR },
    { ...DOOR_IN },
    { ...BOARD, wait: 0.9 },
    { x: BOARD.x, y: GATE_Y },
    { ...GATE_IN },
    ...outside,
  ]);
};

/** camp slot -> battle spot via the branch road (excludes the start). */
export const routePromote = (x: number, y: number, desk: number): Pt[] => {
  const spot = spotOf(desk);
  return dedupe([{ x, y }, { x: GATE_OUT.x, y }, { ...GATE_OUT }, { x: spot.x, y: ROAD_Y }, spot]).slice(1);
};

/** seat -> tavern stand point (first point = seat). */
export const routeToTavern = (desk: number, slot: number, order: number): Pt[] =>
  routeToTavernSpot(desk, slot, tavernSpot(order));
/** seat -> a given stand point inside the hall (first point = seat). */
export const routeToTavernSpot = (desk: number, slot: number, spot: Pt): Pt[] =>
  dedupe([...seatToGate(desk, slot), { ...GATE_IN }, { x: spot.x, y: GATE_Y }, spot]);
/** when every tavern table spot is taken: stand by the quest counter, just off the aisle */
const OVERFLOW_DY = 16;
export const TAVERN_OVERFLOW: Pt = { x: COUNTER.x, y: COUNTER.y + OVERFLOW_DY };

/** From wherever the character stands -> counter (turn in the quest, pause) -> door. Excludes the start. */
const LOW_ROW_Y = 180; // below this the character is in the lower wilderness
const UPPER_HALL_MARGIN = 10;
const HALL_AISLE_X = 100;
export const routeLeave = (x: number, y: number): Pt[] => {
  const pts: Pt[] = [];
  if (x >= HALL_W + 1) {
    pts.push(y > LOW_ROW_Y ? { x: GATE_OUT.x, y } : { x, y: ROAD_Y });
    pts.push({ ...GATE_OUT }, { ...GATE_IN });
  } else if (y < GATE_Y - UPPER_HALL_MARGIN && x <= HALL_AISLE_X) {
    // already in the upper hall: walk straight to the counter (no detour via the gate row)
  } else if (x < BOARD.x && y > GATE_Y) {
    // near the door below the barrels: step out to the aisle first
    pts.push({ x: BOARD.x, y }, { x: BOARD.x, y: GATE_Y });
  } else {
    pts.push({ x: Math.min(x, HALL_AISLE_X), y: GATE_Y });
  }
  pts.push({ ...COUNTER, wait: 1.4 }, { x: BOARD.x, y: GATE_Y }, { ...DOOR_IN }, { ...DOOR });
  return dedupe(pts);
};

// ---- decor (render only) ----
export const TORCHES: Pt[] = [
  { x: 42, y: 30 },
  { x: 73, y: 30 },
  { x: 122, y: 99 },
  { x: 122, y: 150 },
  { x: 326, y: 48 },
  { x: 358, y: 48 },
];
export const HEARTH = { x: 47, y: 14, w: 22, h: 38 };
export const DUNGEON = { x: 342, y: 50 };
export const BRIDGE_X = 340;

// ---- the two gates ----
/** Click / hover area of the dungeon gate (the stone arch + torches), logical px. */
export const DUNGEON_HIT: Rect = { x: 318, y: 18, w: 48, h: 36 };
/** Where a boss steps out of the dungeon (just inside the arch). */
export const GATE_MOUTH: Pt = { x: DUNGEON.x, y: DUNGEON.y - 1 };
const BRIDGE_TOP_Y = 53;
const BRIDGE_END_Y = 74;
/** The dirt trail south of the bridge ends here; bosses fan out from this row. */
const TRAIL_END_Y = 90;
const BOSS_LANE_DX = 18;
const WORLD_EDGE_MARGIN = 8;
/** Boss walk: gate mouth -> over the bridge -> down the trail -> along the northern edge of the battle rows -> goal. Excludes the start. */
export const routeBoss = (desk: number): Pt[] => {
  const goal = monsterSpot(desk);
  const pts: Pt[] = [
    { x: BRIDGE_X, y: BRIDGE_TOP_Y },
    { x: BRIDGE_X, y: BRIDGE_END_Y },
    { x: BRIDGE_X, y: TRAIL_END_Y },
  ];
  if (desk < GRID_COLS) pts.push({ x: goal.x, y: TRAIL_END_Y });
  else {
    // lower row: a free lane just right of the monster column, then back left onto the goal
    const lane = Math.min(goal.x + BOSS_LANE_DX, WORLD_W - WORLD_EDGE_MARGIN);
    pts.push({ x: lane, y: TRAIL_END_Y }, { x: lane, y: goal.y });
  }
  pts.push({ ...goal });
  return dedupe(pts);
};

/**
 * The ally gate: the dungeon gate's friendly twin on the LEFT of the wilderness, across the same river, with its own
 * wooden bridge (x 158, just right of the hall wall) and a trail down to the branch road. Squires and adventurers
 * resting after a compact walk use it. The mouth is where they stand in the doorway.
 */
export const ALLY_GATE = { x: 160, y: 50 };
export const ALLY_BRIDGE_X = 158;
export const ALLY_GATE_MOUTH: Pt = { x: ALLY_GATE.x, y: ALLY_GATE.y + 1 };
/** warm torches either side of the arch (same spacing as the dungeon's) */
const ALLY_TORCH_DX = 16;
export const ALLY_TORCHES: Pt[] = [
  { x: ALLY_GATE.x - ALLY_TORCH_DX, y: 48 },
  { x: ALLY_GATE.x + ALLY_TORCH_DX, y: 48 },
];
const ALLY_BRIDGE_TOP_Y = 53;
const ALLY_TRAIL_Y = 92;
/** the branch road south of the hall gate (x 127..141): the trail joins it here */
const ALLY_LANE_X = 134;
const ALLY_LANE_Y = 116;
/** below this a target counts as "lower battle row / camp": reached via the branch road and the main road */
const ALLY_UPPER_LIMIT = 112;
/** The trail corners, gate mouth side first: over the bridge, down the trail, then (for lower targets) to the branch road. */
export const ALLY_TRAIL: Pt[] = [
  { x: ALLY_BRIDGE_X, y: ALLY_BRIDGE_TOP_Y },
  { x: ALLY_BRIDGE_X, y: BRIDGE_END_Y },
  { x: ALLY_BRIDGE_X, y: ALLY_TRAIL_Y },
];
export const ALLY_LANE: Pt[] = [
  { x: ALLY_LANE_X + 2, y: ALLY_LANE_Y },
  { x: ALLY_LANE_X, y: ROAD_Y },
];
/** Ally gate mouth -> a point in the wilderness (excludes the start): bridge, trail, then along the road or straight to an upper spot. */
export const routeFromAllyGate = (x: number, y: number): Pt[] => {
  const pts: Pt[] = ALLY_TRAIL.map((point) => ({ ...point }));
  if (y < ALLY_UPPER_LIMIT) pts.push({ x, y: ALLY_TRAIL_Y });
  else pts.push(...ALLY_LANE.map((point) => ({ ...point })), { x, y: ROAD_Y });
  pts.push({ x, y });
  return dedupe([{ ...ALLY_GATE_MOUTH }, ...pts]).slice(1);
};
/** A point in the wilderness -> the ally gate mouth (excludes the start): the reverse of routeFromAllyGate. */
export const routeToAllyGate = (x: number, y: number): Pt[] => {
  const out = routeFromAllyGate(x, y); // mouth -> ... -> (x,y)
  const pts: Pt[] = [];
  for (let i = out.length - 2; i >= 0; i--) pts.push(out[i]);
  pts.push({ ...ALLY_GATE_MOUTH });
  return dedupe([{ x, y }, ...pts]).slice(1);
};

// ---- territory: land plots + duels ----
export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}
const PLOT_W_SMALL = 44,
  PLOT_W_MEDIUM = 50,
  PLOT_W_LARGE = 56;
const PLOT_H_SMALL = 26,
  PLOT_H_MEDIUM = 32,
  PLOT_H_LARGE = 36;
const PLOT_W = [PLOT_W_SMALL, PLOT_W_MEDIUM, PLOT_W_LARGE],
  PLOT_H = [PLOT_H_SMALL, PLOT_H_MEDIUM, PLOT_H_LARGE];
const PLOT_LARGE_CLAIMS = 6;
const PLOT_MEDIUM_CLAIMS = 3;
const PLOT_OFFSET_X = 22;
const PLOT_OFFSET_Y = 14;
const DUEL_SIDEWAYS_DY = 10; // rows closer than this duel "sideways"
const DUEL_SIDEWAYS_DROP = 14;
/** Claimed-land patch around a battle spot. Grows with the number of held files (1-2 small, 3-5 medium, 6+ large). Pass `out` to avoid allocating. */
export const plotRect = (desk: number, claims: number, out: Rect = { x: 0, y: 0, w: 0, h: 0 }): Rect => {
  const big = claims >= PLOT_LARGE_CLAIMS ? 2 : claims >= PLOT_MEDIUM_CLAIMS ? 1 : 0;
  out.x = SPOT_COLS[desk % GRID_COLS] - PLOT_OFFSET_X;
  out.y = SPOT_ROWS[(desk / GRID_COLS) | 0] - PLOT_OFFSET_Y;
  out.w = PLOT_W[big];
  out.h = PLOT_H[big];
  return out;
};
/** Where two adventurers meet to duel (the contested flag stands here). Sideways rows duel just below the monsters. Pass `out` to avoid allocating. */
export const duelMid = (first: Pt, second: Pt, out: Pt = { x: 0, y: 0 }): Pt => {
  out.x = Math.round((first.x + second.x) / 2);
  out.y =
    Math.round((first.y + second.y) / 2) + (Math.abs(first.y - second.y) < DUEL_SIDEWAYS_DY ? DUEL_SIDEWAYS_DROP : 0);
  return out;
};
/** duelMid for two battle spots, allocation-free. */
export const duelMidOfDesks = (da: number, db: number, out: Pt): Pt => {
  const ax = SPOT_COLS[da % GRID_COLS],
    ay = SPOT_ROWS[(da / GRID_COLS) | 0],
    bx = SPOT_COLS[db % GRID_COLS],
    by = SPOT_ROWS[(db / GRID_COLS) | 0];
  // clamped so the fighters (+ the K.O. knock-back and a half sprite) never leave the playfield (same-column pairs sit at the edges)
  out.x = Math.max(HALL_W + DUEL_EDGE, Math.min(WORLD_W - DUEL_EDGE, Math.round((ax + bx) / 2)));
  out.y = Math.round((ay + by) / 2) + (Math.abs(ay - by) < DUEL_SIDEWAYS_DY ? DUEL_SIDEWAYS_DROP : 0);
  return out;
};
/** Half the gap between two duellists (centre to the meeting point). Sprites are 16 wide, so the open gap is 2*(DUEL_HALF-8) = 40px:
 * room for a ~32px melee dash (sprites stay >= 8px apart at contact), the blade lock and projectiles in flight. */
export const DUEL_HALF = 28;
/** meeting point to the farthest a fighter can end up sideways: DUEL_HALF + K.O. knock-back (engine DUEL_KNOCK_KO = 12) + half a sprite (8) */
const DUEL_KNOCK_KO = 12;
const SPRITE_HALF_W = 8;
export const DUEL_EDGE = DUEL_HALF + DUEL_KNOCK_KO + SPRITE_HALF_W;
