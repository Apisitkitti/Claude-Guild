export const W = 384;
export const H = 216;
export const CH_W = 16;
export const CH_H = 24;
/** `wait` (seconds): pause when this waypoint is reached. */
export interface Pt { x: number; y: number; wait?: number }

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
export const TAVERN_SPOTS: Pt[] = [{ x: 88, y: 160 }, { x: 88, y: 180 }, { x: 88, y: 200 }];
export const NPC_POS: Pt = { x: 98, y: 54 };
export const BAR = { x: 98, y: 150, w: 18, h: 54 };
export const COUNTER_BOX = { x: 78, y: 46, w: 40, h: 18 };

// ---- battle spots (2 rows x 4) ----
export const SPOT_COLS = [168, 228, 288, 348];
export const SPOT_ROWS = [102, 168];
export const ROAD_Y = GATE_Y;
export const DESK_COUNT = 8;
export const MON_DX = 22;

export const spotOf = (i: number): Pt => ({ x: SPOT_COLS[i % 4], y: SPOT_ROWS[(i / 4) | 0] });
export const monsterSpot = (i: number): Pt => { const s = spotOf(i); return { x: s.x + MON_DX, y: s.y }; };
/** Camp: 3 rows x 14; beyond that everyone stacks on the last slot (render shows a +N badge). */
export const CAMP_MAX = 42;
export const standSlot = (n: number): Pt => { const m = Math.min(Math.max(0, n), CAMP_MAX - 1); return { x: 152 + 16 * (m % 14), y: 206 - 12 * ((m / 14) | 0) }; };
export const seatPoint = (desk: number, slot: number): Pt => (desk >= 0 ? spotOf(desk) : standSlot(Math.max(0, slot)));
/** Squire (intern) standing point: just behind / left of the adventurer. */
export const squirePoint = (desk: number, k: number): Pt => {
  const s = spotOf(desk);
  return k === 0 ? { x: s.x - 15, y: s.y + 2 } : { x: s.x - 11, y: s.y - 9 };
};
/** Squire point for a camp (overflow) adventurer: tight, beside the adventurer. */
export const campSquirePoint = (slot: number, k: number): Pt => {
  const s = standSlot(slot);
  return { x: s.x + (k === 0 ? -8 : 8), y: s.y + 1 };
};
export const tavernSpot = (order: number): Pt => TAVERN_SPOTS[((order % 3) + 3) % 3];

function dedupe(pts: Pt[]): Pt[] {
  const out: Pt[] = [];
  for (const p of pts) {
    const l = out[out.length - 1];
    if (!l || l.x !== p.x || l.y !== p.y) out.push(p);
    else if (p.wait) l.wait = p.wait;
  }
  return out;
}

/** seat -> point just outside the gate (first point = seat). */
function seatToGate(desk: number, slot: number): Pt[] {
  const s = seatPoint(desk, slot);
  if (desk >= 0) return [s, { x: s.x, y: ROAD_Y }, { ...GATE_OUT }];
  return [s, { x: GATE_OUT.x, y: s.y }, { ...GATE_OUT }];
}

/** Full route door -> board (pause) -> gate -> seat (first point = DOOR). */
export function routeIn(desk: number, slot: number): Pt[] {
  const seatToG = seatToGate(desk, slot); // seat ... GATE_OUT
  const outside = [...seatToG].reverse(); // GATE_OUT ... seat
  return dedupe([
    { ...DOOR }, { ...DOOR_IN }, { ...BOARD, wait: 0.9 }, { x: BOARD.x, y: GATE_Y }, { ...GATE_IN }, ...outside,
  ]);
}

/** camp slot -> battle spot via the branch road (excludes the start). */
export function routePromote(x: number, y: number, desk: number): Pt[] {
  const s = spotOf(desk);
  return dedupe([{ x, y }, { x: GATE_OUT.x, y }, { ...GATE_OUT }, { x: s.x, y: ROAD_Y }, s]).slice(1);
}

/** seat -> tavern stand point (first point = seat). */
export function routeToTavern(desk: number, slot: number, order: number): Pt[] {
  const t = tavernSpot(order);
  return dedupe([...seatToGate(desk, slot), { ...GATE_IN }, { x: t.x, y: GATE_Y }, t]);
}

/** From wherever the character stands -> counter (turn in the quest, pause) -> door. Excludes the start. */
export function routeLeave(x: number, y: number): Pt[] {
  const pts: Pt[] = [];
  if (x >= HALL_W + 1) {
    pts.push(y > 180 ? { x: GATE_OUT.x, y } : { x, y: ROAD_Y });
    pts.push({ ...GATE_OUT }, { ...GATE_IN });
  } else if (y < GATE_Y - 10 && x <= 100) {
    // already in the upper hall: walk straight to the counter (no detour via the gate row)
  } else if (x < BOARD.x && y > GATE_Y) {
    // near the door below the barrels: step out to the aisle first
    pts.push({ x: BOARD.x, y }, { x: BOARD.x, y: GATE_Y });
  } else {
    pts.push({ x: Math.min(x, 100), y: GATE_Y });
  }
  pts.push({ ...COUNTER, wait: 1.4 }, { x: BOARD.x, y: GATE_Y }, { ...DOOR_IN }, { ...DOOR });
  return dedupe(pts);
}

// ---- decor (render only) ----
export const TORCHES: Pt[] = [{ x: 42, y: 30 }, { x: 73, y: 30 }, { x: 122, y: 99 }, { x: 122, y: 150 }, { x: 326, y: 48 }, { x: 358, y: 48 }];
export const HEARTH = { x: 47, y: 14, w: 22, h: 38 };
export const DUNGEON = { x: 342, y: 50 };
export const BRIDGE_X = 340;

// ---- territory: land plots + duels ----
export interface Rect { x: number; y: number; w: number; h: number }
const PLOT_W = [44, 50, 56], PLOT_H = [26, 32, 36];
/** Claimed-land patch around a battle spot. Grows with the number of held files (1-2 small, 3-5 medium, 6+ large). Pass `out` to avoid allocating. */
export function plotRect(desk: number, claims: number, out: Rect = { x: 0, y: 0, w: 0, h: 0 }): Rect {
  const big = claims >= 6 ? 2 : claims >= 3 ? 1 : 0;
  out.x = SPOT_COLS[desk % 4] - 22; out.y = SPOT_ROWS[(desk / 4) | 0] - 14; out.w = PLOT_W[big]; out.h = PLOT_H[big];
  return out;
}
/** Where two adventurers meet to duel (the contested flag stands here). Sideways rows duel just below the monsters. Pass `out` to avoid allocating. */
export function duelMid(a: Pt, b: Pt, out: Pt = { x: 0, y: 0 }): Pt {
  out.x = Math.round((a.x + b.x) / 2); out.y = Math.round((a.y + b.y) / 2) + (Math.abs(a.y - b.y) < 10 ? 14 : 0);
  return out;
}
/** duelMid for two battle spots, allocation-free. */
export function duelMidOfDesks(da: number, db: number, out: Pt): Pt {
  const ax = SPOT_COLS[da % 4], ay = SPOT_ROWS[(da / 4) | 0], bx = SPOT_COLS[db % 4], by = SPOT_ROWS[(db / 4) | 0];
  out.x = Math.round((ax + bx) / 2); out.y = Math.round((ay + by) / 2) + (Math.abs(ay - by) < 10 ? 14 : 0);
  return out;
}
/** Half the gap between two duellists (centre to the meeting point). Sprites are 16 wide, so the open gap is 2*(DUEL_HALF-8) = 28px,
 * enough for a 3px lunge + effects that never touch either sprite box. */
export const DUEL_HALF = 22;
