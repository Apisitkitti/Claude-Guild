/**
 * World coordinates: the wilderness, the hall gate and every route keep the coordinates they always had (the hall's
 * east edge is HALL_W, the world's is WORLD_W). The guild grew WESTWARD: a wing (kitchen, feast table, bard) now
 * occupies the negative x range [VIEW_X0, 0), and the canvas shows VIEW_W x WORLD_H logical px with x = VIEW_X0 at its
 * left edge. Hit-testing and drawing translate by WING_W.
 */
export const WORLD_W = 384;
export const WORLD_H = 216;
export const WING_W = 96;
export const VIEW_X0 = -WING_W;
export const VIEW_W = WORLD_W + WING_W;
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
const DOOR_INSET = 6;
export const DOOR: Pt = { x: VIEW_X0 + DOOR_INSET, y: 176 };
export const DOOR_IN: Pt = { x: 30, y: 176 };
export const BOARD: Pt = { x: 30, y: 68 };
export const COUNTER: Pt = { x: 98, y: 80 };
export const GATE_Y = 124;
export const GATE_IN: Pt = { x: 112, y: GATE_Y };
export const GATE_OUT: Pt = { x: 134, y: GATE_Y };
export const GATE_OPEN = { y0: 102, y1: 146 };

// ---- the west wing: kitchen, long feast table, bard ----
export interface FeastSeat extends Pt {
  /** which way the diner looks (towards the middle of the table) */
  face: 1 | -1;
  /** far side of the table (behind it, reached by the east lane) or the near side (reached from the aisle) */
  far: boolean;
}
export const FEAST_TABLE: Rect = { x: -78, y: 86, w: 56, h: 16 };
/** walkers must not cross this part of the table (seats sit on its edges) */
export const FEAST_BLOCK: Rect = { x: -76, y: 90, w: 52, h: 10 };
const FEAST_COLS = 4;
const FEAST_COL_X0 = -71;
const FEAST_COL_DX = 14;
const FEAST_FAR_Y = 88;
const FEAST_NEAR_Y = 114;
/** order the table fills in: opposite pairs first, the ends last */
const FEAST_COL_ORDER = [1, 2, 0, FEAST_COLS - 1];
export const FEAST_SEATS: FeastSeat[] = FEAST_COL_ORDER.flatMap((col): FeastSeat[] => {
  const x = FEAST_COL_X0 + col * FEAST_COL_DX;
  const face = col < FEAST_COLS / 2 ? 1 : -1;
  return [
    { x, y: FEAST_NEAR_Y, face, far: false },
    { x, y: FEAST_FAR_Y, face, far: true },
  ];
});
/** the vertical lane just east of the table that leads to the far side, and the row behind the far seats */
export const FEAST_LANE_X = -14;
const FEAST_FAR_LANE_Y = 78;
/** kitchen: the chef cooks at the hearth, picks plates up at the serving counter and sets them down at the table's east end */
export const CHEF_HOME: Pt = { x: -80, y: 62 };
export const CHEF_PICKUP: Pt = { x: -34, y: 62 };
export const CHEF_SERVE: Pt = { x: FEAST_LANE_X, y: 94 };
const CHEF_LANE_Y = 62;
export const BARD_POS: Pt = { x: -50, y: 148 }; // between the feast aisle (y 124) and the entrance path (y 176), clear of both
export const KITCHEN_HEARTH = { x: -92, y: 14, w: 30, h: 38 };
export const SERVING_COUNTER = { x: -50, y: 40, w: 32, h: 12 };
export const WING_TORCHES: Pt[] = [
  { x: -58, y: 34 },
  { x: -16, y: 34 },
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
/** a battle spot, or (overflow, desk -1) the dungeon gate mouth: raiders wait inside, so every slot shares the gate point */
export const seatPoint = (desk: number, _slot: number): Pt => (desk >= 0 ? spotOf(desk) : { ...GATE_MOUTH });
const SQUIRE_0_DX = -15;
const SQUIRE_1_DX = -11;
const SQUIRE_1_DY = -9;
/** Squire (intern) standing point: just behind / left of the adventurer. */
export const squirePoint = (desk: number, index: number): Pt => {
  const spot = spotOf(desk);
  return index === 0
    ? { x: spot.x + SQUIRE_0_DX, y: spot.y + 2 }
    : { x: spot.x + SQUIRE_1_DX, y: spot.y + SQUIRE_1_DY };
};

const dedupe = (pts: Pt[]): Pt[] => {
  const out: Pt[] = [];
  for (const point of pts) {
    const last = out[out.length - 1];
    if (!last || last.x !== point.x || last.y !== point.y) out.push(point);
    else if (point.wait) last.wait = point.wait;
  }
  return out;
};

/**
 * Dungeon gate mouth -> over the bridge -> along the river bank -> down the branch road to the hall gate (excludes the
 * start, ends at GATE_OUT). The boss route in reverse; the raiders' way in and out of the dungeon.
 */
export const dungeonToHallGate = (): Pt[] => [
  { x: BRIDGE_X, y: BRIDGE_TOP_Y },
  { x: BRIDGE_X, y: RAID_BANK_Y },
  { x: GATE_OUT.x, y: RAID_BANK_Y },
  { ...GATE_OUT },
];

/** seat -> point just outside the gate (first point = seat). */
const seatToGate = (desk: number, slot: number): Pt[] => {
  const spot = seatPoint(desk, slot);
  if (desk >= 0) return [spot, { x: spot.x, y: ROAD_Y }, { ...GATE_OUT }];
  return [spot, ...dungeonToHallGate()];
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

/** dungeon gate mouth -> battle spot: over the bridge, along the bank, then down its own column (upper row) or the branch road (excludes the start). */
export const routeFromDungeon = (desk: number): Pt[] => {
  const spot = spotOf(desk);
  const pts: Pt[] = [{ ...GATE_MOUTH }, { x: BRIDGE_X, y: BRIDGE_TOP_Y }, { x: BRIDGE_X, y: RAID_BANK_Y }];
  if (desk < GRID_COLS) pts.push({ x: spot.x, y: RAID_BANK_Y });
  else pts.push({ x: GATE_OUT.x, y: RAID_BANK_Y }, { x: GATE_OUT.x, y: ROAD_Y }, { x: spot.x, y: ROAD_Y });
  pts.push(spot);
  return dedupe(pts).slice(1);
};

/** when every feast seat is taken: stand by the quest counter, just off the aisle */
const OVERFLOW_DY = 16;
export const TAVERN_OVERFLOW: Pt = { x: COUNTER.x, y: COUNTER.y + OVERFLOW_DY };
/** the table seat's last leg: near-side seats are reached from the aisle, far-side ones round the east end of the table */
const feastApproach = (seat: FeastSeat): Pt[] =>
  seat.far
    ? [
        { x: FEAST_LANE_X, y: GATE_Y },
        { x: FEAST_LANE_X, y: FEAST_FAR_LANE_Y },
        { x: seat.x, y: FEAST_FAR_LANE_Y },
        { x: seat.x, y: seat.y },
      ]
    : [
        { x: seat.x, y: GATE_Y },
        { x: seat.x, y: seat.y },
      ];
/** seat (desk or camp) -> a place at the feast table (first point = seat) */
export const routeToFeast = (desk: number, slot: number, seatIdx: number): Pt[] =>
  dedupe([...seatToGate(desk, slot), { ...GATE_IN }, ...feastApproach(FEAST_SEATS[seatIdx])]);
/** seat -> a given stand point inside the hall (first point = seat). */
export const routeToTavernSpot = (desk: number, slot: number, spot: Pt): Pt[] =>
  dedupe([...seatToGate(desk, slot), { ...GATE_IN }, { x: spot.x, y: GATE_Y }, spot]);
/** seat -> feast seat (seatIdx >= 0) or the counter overflow spot (-1); first point = seat */
export const routeToBreak = (desk: number, slot: number, seatIdx: number): Pt[] =>
  seatIdx >= 0 ? routeToFeast(desk, slot, seatIdx) : routeToTavernSpot(desk, slot, TAVERN_OVERFLOW);
/** the chef's round trip from the hearth: serving counter (pick a plate up), the table's east end (set it down), home. Excludes the start. */
export const CHEF_PICK_S = 0.7;
export const CHEF_PLACE_S = 0.6;
export const routeChefServe = (): Pt[] => [
  { ...CHEF_PICKUP, wait: CHEF_PICK_S },
  { x: FEAST_LANE_X, y: CHEF_LANE_Y },
  { ...CHEF_SERVE, wait: CHEF_PLACE_S },
  { x: FEAST_LANE_X, y: CHEF_LANE_Y },
  { ...CHEF_HOME },
];
/**
 * The guild master: waits in the upper hall (clear of the board queue, the counter, the aisle row and the feast
 * wing), walks out through the gate to stand just left of an adventurer at a battle spot, then walks back.
 */
export const GUILD_MASTER_HOME: Pt = { x: 62, y: 100 };
/**
 * He stands up-left of the adventurer's spot, BEHIND the row: 28 left, 34 up. His 16x24 box is [-36,-20] x [-58,-34]
 * from the spot, which clears squire 0 (box [-23,-7] x [-22,2]), squire 1 ([-19,-3] x [-33,-9]), the adventurer's
 * hearts / mana bar (below it), its bubble ([-7,7] x [-42,-27]) and the previous column's monster (right edge -28, top -20,
 * HP bar top -26). A boss in the previous column reaches him (checked in canVisit).
 */
const GUILD_MASTER_DX = -28;
const GUILD_MASTER_DY = -34;
/** his stand point beside battle spot `desk`, written into `out` when given (no allocation in per-frame checks) */
export const guildMasterStand = (desk: number, out: Pt = { x: 0, y: 0 }): Pt => {
  out.x = SPOT_COLS[desk % GRID_COLS] + GUILD_MASTER_DX;
  out.y = SPOT_ROWS[(desk / GRID_COLS) | 0] + GUILD_MASTER_DY;
  return out;
};
/** home -> the aisle row -> the gate -> the road -> straight to his stand point beside battle spot `desk` (excludes the start) */
export const routeGuildMaster = (desk: number): Pt[] => {
  const stand = guildMasterStand(desk);
  return dedupe([
    { ...GUILD_MASTER_HOME },
    { x: GUILD_MASTER_HOME.x, y: GATE_Y },
    { ...GATE_IN },
    { ...GATE_OUT },
    { x: stand.x, y: ROAD_Y },
    stand,
  ]).slice(1);
};
/** from wherever he stands (hall or wilderness, on his routes) back home (excludes the start) */
export const routeGuildMasterHome = (x: number, y: number): Pt[] => {
  // still on the first leg (straight down from home to the aisle row): walk straight back up
  if (x === GUILD_MASTER_HOME.x && y <= GATE_Y) return dedupe([{ x, y }, { ...GUILD_MASTER_HOME }]).slice(1);
  const pts: Pt[] = [{ x, y }];
  if (x > HALL_W) pts.push({ x, y: ROAD_Y }, { ...GATE_OUT });
  if (x > GATE_IN.x) pts.push({ ...GATE_IN });
  pts.push({ x: GUILD_MASTER_HOME.x, y: GATE_Y }, { ...GUILD_MASTER_HOME });
  return dedupe(pts).slice(1);
};
/** where a plate lands on the table, in front of seat `seatIdx` */
export const FEAST_PLATE_NEAR_DY = 9;
export const FEAST_PLATE_FAR_DY = 5;
export const platePoint = (seatIdx: number): Pt => {
  const seat = FEAST_SEATS[seatIdx];
  return { x: seat.x, y: FEAST_TABLE.y + (seat.far ? FEAST_PLATE_FAR_DY : FEAST_PLATE_NEAR_DY) };
};

/** From wherever the character stands -> counter (turn in the quest, pause) -> door. Excludes the start. */
const LOW_ROW_Y = 180; // below this the character is in the lower wilderness
const UPPER_HALL_MARGIN = 10;
const HALL_AISLE_X = 100;
const RAID_ZONE_DX = 6;
export const routeLeave = (x: number, y: number): Pt[] => {
  const pts: Pt[] = [];
  if (y <= RAID_BANK_Y && x >= GATE_OUT.x) {
    // at the dungeon gate, on its bridge or on the river bank: out the way raiders walk (bridge, bank, branch road)
    if (x >= BRIDGE_X - RAID_ZONE_DX) pts.push(...dungeonToHallGate().slice(y < BRIDGE_TOP_Y ? 0 : 1));
    else pts.push({ x: GATE_OUT.x, y }, { ...GATE_OUT });
    pts.push({ ...GATE_IN });
  } else if (x >= HALL_W + 1) {
    pts.push(y > LOW_ROW_Y ? { x: GATE_OUT.x, y } : { x, y: ROAD_Y });
    pts.push({ ...GATE_OUT }, { ...GATE_IN });
  } else if (x < 0 && y < GATE_Y - UPPER_HALL_MARGIN) {
    // behind the feast table / in the kitchen: out by the east lane, never across the table. A far-side diner first
    // steps back to the row behind the seats (the mirror of the approach), so nobody walks over the table edge.
    if (y > FEAST_FAR_LANE_Y && x < FEAST_LANE_X) pts.push({ x, y: FEAST_FAR_LANE_Y });
    pts.push({ x: FEAST_LANE_X, y: Math.min(y, FEAST_FAR_LANE_Y) }, { x: FEAST_LANE_X, y: GATE_Y });
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
/** raiders walk the river bank on this row (the same one bosses use) */
const RAID_BANK_Y = 75;
/** Boss feet walk this row just south of the river: above every adventurer box (they start at y 78, their HP bars at 76). */
const BOSS_WALK_Y = 75;
/** Lower-row bosses use the road between the battle rows, a box-height below the upper row's feet. */
const BOSS_ROAD_OFFSET = 10;
const BOSS_ROAD_Y = ROAD_Y + BOSS_ROAD_OFFSET;
/** Drawn centre of the lane beside the hall wall that carries lower-row bosses down to the road. */
const BOSS_LANE_X = 142;
/** a boss is drawn this far right of its position (see bossSprites BOSS_DX); the route is written in drawn x */
const BOSS_DRAW_DX = 12;
/**
 * Boss walk: gate mouth -> over the bridge -> along the river bank above the battle rows -> (lower row: down the lane
 * by the hall wall and along the road) -> straight down its own column to the goal. Never crosses another fight
 * spot's adventurer / monster box. Excludes the start.
 */
export const routeBoss = (desk: number): Pt[] => {
  const goal = monsterSpot(desk);
  const via = (drawnX: number, y: number): Pt => ({ x: drawnX - BOSS_DRAW_DX, y });
  const pts: Pt[] = [via(BRIDGE_X, BRIDGE_TOP_Y), via(BRIDGE_X, BRIDGE_END_Y), via(BRIDGE_X, BOSS_WALK_Y)];
  if (desk < GRID_COLS) pts.push({ x: goal.x, y: BOSS_WALK_Y });
  else pts.push(via(BOSS_LANE_X, BOSS_WALK_Y), via(BOSS_LANE_X, BOSS_ROAD_Y), { x: goal.x, y: BOSS_ROAD_Y });
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
