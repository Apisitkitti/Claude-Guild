import { m } from "@/paraglide/messages";

import { ToolTally, type DungeonStats } from "./dungeon";
import {
  ALLY_GATE_MOUTH,
  DESK_COUNT,
  DUEL_HALF,
  WORLD_H,
  HALL_W,
  WORLD_W,
  CH_H,
  CH_W,
  DOOR,
  GATE_MOUTH,
  HEARTH,
  campSquirePoint,
  duelMidOfDesks,
  monsterSpot,
  routeBoss,
  routeFromAllyGate,
  routeIn,
  routeLeave,
  routePromote,
  routeToAllyGate,
  routeToTavern,
  seatPoint,
  squirePoint,
  type Pt,
} from "./layout";
import { BOSS_KINDS, lookFor, MONSTER_KINDS, type BossKind, type Look, type MonsterKind } from "./palette";
import { drawScene } from "./render";

// ---------------------------------------------------------------------------
// Tuning constants. Every value below used to be an inline literal; names say what it means.
// ---------------------------------------------------------------------------

// -- time units
const MS_PER_SECOND = 1000;
const SECONDS_PER_MINUTE = 60;
const SECONDS_PER_HOUR = 3600;
const HOURS_PER_DAY = 24;
const PERCENT = 100;
const DISMISS_TTL_MINUTES = 10;
const PROGRESS_TTL_DAYS = 7;
const ENDED_TTL_S = 30;

// -- engine loop / housekeeping
const MAX_FRAME_DT = 0.1;
const EMIT_INTERVAL_MS = 200;
const ERROR_LOG_INTERVAL_MS = 5000;
const PRUNE_INTERVAL_S = 15;
const IDLE_GRACE_S = 600;
const RECENT_WINDOW_S = 120;
const EDIT_FAIL_TTL_S = 120;
const SELECT_HOLD_S = 3;
const TAG_LEN = 3;
const DETAIL_MAX = 24;
const BANNER_FILE_MAX = 30;
const LOG_MAX = 100;
const MAX_BANNERS = 4;
const QUEUE_MAX = 5;
const DISMISSED_MAX = 200;
const CTX_MAP_MAX = 300;
const STRAY_EVENT_MIN = 3;
const QUEST_MIN_TOOLS = 3;

// -- incoming message limits (receipts, territory)
const MAX_RECEIPT_ROWS = 50;
const RECEIPT_KEY_MAX = 200;
const ATTN_TOOL_MAX = 80;
const ATTN_TARGET_MAX = 120;
const ATTN_ERROR_MAX = 200;
const ATTN_TAIL_MAX = 200;
const RECEIPT_COUNT_MAX = 99999;
const RECEIPT_ID_MAX = 64;
const RECEIPT_PROJECT_MAX = 60;
const RECEIPT_SEEN_MAX = 500;
const RECEIPT_BUBBLE_S = 2.5;
const MAX_CLAIMS = 300;
const MAX_CONFLICTS = 100;
const MAX_CONFLICT_SIDS = 8;
const MAX_NEW_GLARES = 3;
const MAX_NEW_DUELS = 3;
const MAX_CLASH_SMOKES = 4;
const MAX_TUGS = 6;
const TUG_S = 2.4;
const GLARE_BUBBLE_S = 2.5;

// -- levelling / FNV hash
const XP_BASE = 10;
const XP_GROWTH = 1.5;
const FNV_PRIME = 0x01000193;
const XP_ROLL_MAX = 3;
const GOLD_ROLL_MAX = 3;
const KILL_XP = 5;
const BOSS_XP = 25;
const CRIT_CHANCE = 0.1;
const COIN_FLIP = 0.5;

// -- duel script (seconds unless noted)
type DuelAct = 0 | 1 | 2 | 3;
type DuelStage = 0 | 1 | 2 | 3 | 4;
const STAGE_WINDUP = 1;
const STAGE_DASH = 2;
const STAGE_HITSTOP = 3;
const STAGE_AFTERMATH = 4;
const SMOOTHSTEP_A = 3;
const DUEL_EX_FLOURISH = 5; // exchange index of the victory flourish
const DUEL_INTRO_IDLE_CUTOFF = 0.25;
const DUEL_IDLE_FPS = 4;
const DUEL_CHEER_FPS = 5;
const DUEL_KO_RECOVER_HALF = 0.5;
const DUEL_REC = 0.22;
const DUEL_REC_FINAL = 0.3;
const DUEL_RET = 0.3;
const DUEL_RET_FINAL = 0.4;
const DUEL_BACKOFF = 3;
const DUEL_BACKOFF_FINAL = 5;
const DUEL_SHAKE_HZ = 60;
const DUEL_HURT_HOLD_S = 0.1;
const DUEL_HURT_FPS = 10;
const DUEL_KO_DELAY_S = 0.12;
const DUEL_KO_FALL_S = 0.3;
const DUEL_KO_AT_REC = 0.8;
const DUEL_FINAL_KO_DELAY_S = 0.3;
const CLASH_LOCK_S = 0.25;
const CLASH_SHOVE_S = 0.15;
const CLASH_SETTLE_S = 0.12;
const CLASH_BACKOFF = 3;
const CLASH_RECOIL = 6;
const CLASH_JITTER_HZ = 50;
const DUEL_CLASH_CONTACT_LIFT = 14;
const DUEL_MELEE_CONTACT_DEPTH = 8;
const DUEL_RANGED_CONTACT_DEPTH = 4;
const DUEL_CONTACT_LIFT = 13;
const DUEL_ICON_LIFT = 12;

// -- duel effects (px, px/s, seconds). Bit flags of Duel.fxm: which one-shot effects already fired.
const FXM_FINAL_KO = 4;
const FXM_KO_SHOWN = 8;
const POP_LIFT = 12;
const POP_DUR_WIN = 1.1;
const POP_DUR_KO = 1.2;
const POP_DUR_CRIT = 1.1;
const POP_DUR_HIT = 0.7;
const CLANG_POP_LIFT = 16;
const CLANG_POP_DUR = 0.9;
const HIT_BURST_UP = 60;
const HIT_BURST_LIFE = 0.4;
const TRAUMA_CLANG = 0.2;
const TRAUMA_KO = 0.2;
const TRAUMA_HIT = 0.12;
const TRAUMA_HIT_BIG = 0.55;
const TRAUMA_QUEST = 0.35;
const TRAUMA_CRIT = 0.75;
const TRAUMA_KILL = 0.6;
const TRAUMA_HURT = 0.6;
const TRAUMA_DECAY = 2.2;
const FX_DUEL_START = { lift: 10, n: 6, speed: 40, up: 40, life: 0.4 };
const FX_WIN_RING = { lift: 4, n: 8, speed: 22, life: 0.7 };
const FX_KO_RING = { lift: 6, n: 8, speed: 24, life: 0.6 };
const FX_CLASH_DUST = { dx: 6, n: 3, speed: 30, up: 40, life: 0.3 };
const FX_LUNGE_DUST = { dx: 6, n: 4, speed: 34, up: 40, life: 0.3 };
const FX_SHOT_MUZZLE = { dx: 11, lift: 15, n: 4, speed: 40, life: 0.25 };
const FX_CLANG_SPARKS = { n: 12, speed: 70, up: 60, life: 0.4 };
const FX_CLANG_RING = { n: 8, speed: 30, life: 0.35 };
const FX_HIT = { n: 8, speed: 60 };
const FX_HIT_BIG = { n: 16, speed: 85 };
const FX_CLASH_SMOKE = { lift: 4, n: 3, speed: 26, up: 60, life: 0.4 };

// -- particles
const BURST_SPEED_MIN = 0.5;
const BURST_LIFT = 0.4;
const BURST_LIFE_MIN = 0.7;
const BURST_LIFE_MAX = 1.1;
const RING_SQUASH = 0.7;
const RING_BIG_EVERY = 3;

// -- ambience: butterflies, fireflies, birds, smoke, rain, dust
const PHASE_MAX = 6;
const BUTTERFLY_MIN = 3;
const BUTTERFLY_VARIANCE = 3;
const BUTTERFLY_MARGIN = 20;
const BUTTERFLY_Y_MIN = 70;
const BUTTERFLY_Y_MAX = 200;
const BUTTERFLY_ARRIVE_DIST = 3;
const BUTTERFLY_PAD_R = 8;
const BUTTERFLY_PAD_L = 10;
const BUTTERFLY_WANDER_X = 50;
const BUTTERFLY_ROAM_Y_MAX = 205;
const BUTTERFLY_ROAM_Y_MIN = 62;
const BUTTERFLY_WANDER_Y = 30;
const BUTTERFLY_SPEED = 15;
const FIREFLY_MARGIN = 12;
const FIREFLY_Y_MIN = 72;
const FIREFLY_Y_MAX = 204;
const FIREFLY_FREQ_X = 0.5;
const FIREFLY_PHASE_X = 3;
const FIREFLY_AMP_X = 12;
const FIREFLY_FREQ_Y = 0.7;
const FIREFLY_PHASE_Y = 5;
const FIREFLY_AMP_Y = 8;
const FIRST_BIRD_S = 12;
const BIRD_OFFSCREEN = 12;
const BIRD_INTERVAL_MIN_S = 20;
const BIRD_INTERVAL_MAX_S = 40;
const BIRD_EDGE = 8;
const BIRD_Y_MIN = 10;
const BIRD_Y_MAX = 26;
const BIRD_VX_MIN = 26;
const BIRD_VX_MAX = 38;
const SMOKE_RISE = 6;
const SMOKE_SWAY = 3;
const MAX_SMOKE = 8;
const SMOKE_X = 11;
const SMOKE_JITTER = 2;
const SMOKE_INTERVAL_S = 0.7;
const RAIN_DEMO_FIRST_S = 50;
const RAIN_DEMO_S = 120;
const RAIN_FIRST_S = 300;
const RAIN_S = 420;
const RAIN_SPREAD_DEMO = 1.6;
const RAIN_SPREAD = 1.8;
const RAIN_DURATION_S = 60;
const RAIN_FADE_S = 3;
const DUST_STEP = 0.16;
const DUST_BEHIND = 3;
const DUST_VX_MAX = 6;
const DUST_VY_UP = 8;
const DUST_VY_DOWN = 3;
const DUST_LIFE = 0.35;

// -- employee behaviour
const STRETCH_S = 1.2;
const DRINK_S = 3;
const THOUGHT_BUBBLE_S = 1.5;
const THOUGHT_MIN_S = 4;
const THOUGHT_MAX_S = 8;
const SPARK_S = 0.5;
const WINDUP_S = 0.15;
const HEART_COUNT = 3;
const HEART_SPACING = 6;
const HEART_LIFT = 22;
const HEART_VX = 4;
const HEART_VY_MAX = 16;
const HEART_VY_MIN = 10;
const HEART_LIFE = 0.9;

// -- monsters, combat and loot
const MON_KIND_STRIDE = 3;
const MON_INSTANT_BACKDATE_S = 10;
const MON_RESPAWN_BASE_S = 1.5;
const MON_HITTABLE_AFTER_S = 0.3;
const MON_HIT_LIFT = 8;
const MON_KNOCK_S = 0.15;
const MON_LUNGE_S = 0.4;
const FLASH_S = 0.07;
const HITSTOP_S = 0.06;
const LUNGE_S = 0.18;
const SLASH_S = 0.2;
const HURT_S = 0.8;
const RED_S = 0.5;
const HURT_BUBBLE_S = 1.5;
const HURT_POP_DX = 4;
const HURT_POP_LIFT = 30;
const HURT_POP_DUR = 0.9;
const DMG_POP_JITTER = 3;
const DMG_POP_LIFT = 6;
const HIT_SPARK_N = 8;
const HIT_SPARK_SPEED = 34;
const HIT_SPARK_SPEED_CRIT = 46;
const XP_POP_DX = 4;
const XP_POP_LIFT = 22;
const GOLD_POP_DX = 6;
const GOLD_POP_LIFT = 14;
const LOOT_POP_DUR = 1.1;
const COIN_COUNT = 5;
const COIN_SPREAD_X = 4;
const COIN_LIFT = 8;
const COIN_VX = 20;
const COIN_VY_MAX = 60;
const COIN_VY_MIN = 35;
const COIN_GRAVITY = 160;
const COIN_LIFE = 0.7;
const BOSS_RESPAWN_S = 2.5;
const BOSS_POP_LIFT = 30;
const BOSS_POP_DUR = 1.4;
const BOSS_XP_POP_DX = 8;
const BOSS_XP_POP_LIFT = 20;
const BOSS_GOLD_POP_DX = 10;
const BOSS_GOLD_POP_LIFT = 14;
const BOSS_COIN_COUNT = 14;
const BOSS_COIN_DX = 4;
const BOSS_COIN_SPREAD_X = 8;
const BOSS_COIN_LIFT = 12;
const BOSS_COIN_VX = 34;
const BOSS_COIN_VY_MAX = 90;
const BOSS_COIN_VY_MIN = 40;
const BOSS_COIN_GRAVITY = 170;
const FX_LEVELUP_RING = { lift: 12, n: 24, speed: 34, life: 0.8 };
const FX_HURT_BURST = { lift: 12, n: 6, speed: 30 };
const FX_MON_DEATH = { dx: 4, lift: 12, n: 14, speed: 50, up: 60, life: 0.7 };
const FX_BOSS_BURST = { dx: 4, lift: 12, n: 16, speed: 56 };
const FX_MON_FLEE = { dx: 4, lift: 12, n: 10, speed: 36 };

// -- the two gates: boss walk, ally gate, squires, compact trip
const BOSS_SPEED = 48;
const SQUIRE_SPEED = 46;
/** squires step out of the tent at most this often (sim seconds) so a swarm never piles up */
const SQUIRE_STAGGER_S = 0.7;
/** squires walking at once (in + out); the rest wait inside the gate */
const SQUIRE_WALK_MAX = 6;
const SQUIRE_SLOTS = 2;
const SQUIRE_SNAP_DIST = 0.5;
const ALLY_DOORS_S = 0.6;
const ALLY_GLOW_S = 4;
const COMPACT_REST_S = 3;
const COMPACT_BUBBLE_S = 2;
const MANA_FLASH_S = 1.2;
const GATE_BURST = { n: 12, speed: 40, up: 30, life: 0.7 };
const GATE_PUFF = { n: 6, speed: 18, up: 14, life: 0.5, lift: 3 };
const ARRIVE_SPARKS = { n: 8, speed: 24, up: 30, life: 0.6, lift: 6 };
const DUST_PUFF_COLS = ["#d8c8a0", "#b59a6a", "#f2e8cf"];
const GATE_COLS = ["#ff5a5a", "#ffb870", "#6a2a7a"];
const WARM_COLS = ["#f2c14e", "#ffe9a0", "#ffb050", "#ffffff"];
const MANA_REFILL_BURST = { n: 10, speed: 30, lift: 10 };
const LEAVER_MAX = 12;

export interface HookEvt {
  session_id?: string;
  hook_event_name?: string;
  cwd?: string;
  agent_id?: string;
  agent_type?: string;
  tool_name?: string;
  tool_input?: unknown;
  message?: string;
  notification_type?: string;
  reason?: string;
  trigger?: string;
  receivedAt?: number;
  [k: string]: unknown;
}

export interface CtxMsg {
  used: number | null;
  limit: number | null;
  limitGuessed?: boolean;
}
export interface Ctx {
  used: number;
  limit: number;
  guessed: boolean;
}
export interface GuildFilter {
  query: string;
  hideStray: boolean;
}

export interface TerritoryConflict {
  file: string;
  sids: string[];
  level: "overlap" | "clash";
  since: number;
  failer?: string;
}
const DISMISS_TTL_MS = DISMISS_TTL_MINUTES * SECONDS_PER_MINUTE * MS_PER_SECOND;
export interface TerritoryMsg {
  claims: { sid: string; files: string[] }[];
  conflicts: TerritoryConflict[];
}
/** a live (non-dismissed) conflict between >= 2 sessions the client knows */
export interface ConflictRow {
  key: string;
  file: string;
  sids: string[];
  names: string[];
  level: "overlap" | "clash";
  since: number;
}
export const conflictKey = (conflict: { file: string; level: string }): string => `${conflict.file}|${conflict.level}`;

export type AttentionKind = "permission" | "loop" | "asked" | "context" | "done";
/** a row of the server's Lookout Bell queue */
export interface AttentionMsgRow {
  key: string;
  sid: string;
  kind: AttentionKind;
  since: number;
  /** permission: waiting long enough that it may already have been granted */
  stale?: boolean;
  /** loop: failing tool, short target, failure count, first informative error line */
  tool?: string;
  target?: string;
  count?: number;
  error?: string;
  /** asked: tail of the final message */
  tail?: string;
  /** context: percent of the window used */
  pct?: number;
}
/** a queue row joined with the adventurer it is about (only sessions the guild knows) */
export interface AttentionRow extends AttentionMsgRow {
  tag: string;
  project: string;
}
/** rows that make the bell ring (the tab title leaves permission out: the ❗ already counts it) */
export const bellCount = (rows: readonly { kind: AttentionKind }[], withPermission = true): number => {
  let count = 0;
  for (const row of rows)
    if (row.kind === "loop" || row.kind === "asked" || (withPermission && row.kind === "permission")) count++;
  return count;
};
const ATTN_KINDS: readonly string[] = ["permission", "loop", "asked", "context", "done"];
/** ids of the next queue row after the selected one (wraps); first row when nothing in the queue is selected */
export const nextAttentionId = (rows: readonly { sid: string }[], selectedId: string | null): string | null => {
  const ids: string[] = [];
  for (const row of rows) if (!ids.includes(row.sid)) ids.push(row.sid);
  if (!ids.length) return null;
  const i = selectedId ? ids.indexOf(selectedId) : -1;
  return ids[(i + 1) % ids.length];
};

/** quest-log kinds made by the guild itself; the prefix keeps them from colliding with real tool / hook names */
export const KIND_RECEIPT = "guild:receipt";
export const KIND_CLASH = "guild:clash";

export type ReceiptVerdict = "done" | "red" | "none";
/** a closed turn of the server's Receipt Ledger (counts only) */
export interface ReceiptMsgRow {
  id: string;
  sid: string;
  project: string;
  closedAt: number;
  files: number;
  recovered: number;
  commits: number;
  amends: number;
  tasks: number;
  squire: number;
  calls: number;
  verdict: ReceiptVerdict;
  /** a runner is still red from an earlier turn (this turn did not run it) */
  staleRed?: boolean;
}
/** a receipt joined with the adventurer: `live` = that adventurer is still in the guild (click selects them) */
export interface ReceiptRow extends ReceiptMsgRow {
  tag: string;
  live: boolean;
}
const RECEIPT_VERDICTS: readonly string[] = ["done", "red", "none"];
const MAX_RECEIPTS = 30;
/** a receipt that closed this recently (and was not seen before) gets the 📜 bubble + quest-log line */
const RECEIPT_FRESH_MS = 20_000;
/** outcome counts as chips text in the viewer's language, e.g. "files 3 · recovered 1 · commit 1" (empty when nothing) */
export const receiptSummary = (
  receipt: Pick<ReceiptMsgRow, "files" | "recovered" | "commits" | "amends" | "tasks">,
): string => {
  const parts: string[] = [];
  if (receipt.files) parts.push(`${m.receipt_label_files()} ${receipt.files}`);
  if (receipt.recovered) parts.push(`${m.receipt_label_recovered()} ${receipt.recovered}`);
  if (receipt.commits) parts.push(`${m.receipt_label_commits()} ${receipt.commits}`);
  if (receipt.amends) parts.push(`${m.receipt_label_amends()} ${receipt.amends}`);
  if (receipt.tasks) parts.push(`${m.receipt_label_tasks()} ${receipt.tasks}`);
  return parts.join(" · ");
};
export const receiptVerdictText = (verdict: ReceiptVerdict): string =>
  verdict === "done"
    ? m.receipt_verdict_done()
    : verdict === "red"
      ? m.receipt_verdict_red()
      : m.receipt_verdict_none();

export interface SnapshotMsg {
  attention?: AttentionMsgRow[];
  receipts?: ReceiptMsgRow[];
  territory?: TerritoryMsg;
  sessions?: { session_id: string; cwd?: string; interns?: string[]; context?: CtxMsg | null; waiting?: boolean }[];
  events?: HookEvt[];
}

export type Act = "thinking" | "reading" | "typing" | "bash" | "phone" | "mcp" | "sticky" | "handup";
export type EState =
  | "ENTERING"
  | "SEATED"
  | "STRETCH"
  | "TO_COFFEE"
  | "DRINK"
  | "FROM_COFFEE"
  | "LEAVING"
  | "DUEL"
  | "TO_ALLY_GATE"
  | "IN_ALLY_GATE"
  | "FROM_ALLY_GATE";

// ---- territory duels ----
export type DuelStyle = "sword" | "magic" | "arrow";
/** which fight this is, from the two styles: sword/sword, magic/magic (orb), arrow/arrow, or one side attacking a defender */
export type DuelKind = "sword" | "orb" | "arrows" | "magic_sword" | "arrow_sword" | "arrow_magic";
export interface Duel {
  /** left / right fighter ids (left = smaller x) */
  l: string;
  r: string;
  kind: DuelKind;
  styleL: DuelStyle;
  styleR: DuelStyle;
  /** attacking side for the mixed kinds (0 = left, 1 = right) */
  agg: 0 | 1;
  /** walk to a meeting point (true) or fight from their spots (false) */
  walk: boolean;
  /** reduced motion: only a static VS badge + emotes */
  still: boolean;
  phase: "go" | "fight" | "back";
  start: number;
  /** clock when the fight began */
  t0: number;
  /** 0 = left fighter holds the file and wins, 1 = right (re-decided at the flourish) */
  winner: 0 | 1;
  /** sid whose edit failed, from the server (loser), if known */
  failer: string | null;
  /** current impact point (beam end / orb / clang) for the renderer */
  ix: number;
  iy: number;
  /** last exchange whose one-shot effects were handled (-1 intro .. 4 final, 5 flourish) */
  beat: number;
  /** one-shot effect bits already fired in the current exchange (1 launch, 2 impact, 4 KO) */
  fxm: number;
  /** the winner was decided (at the start of the final blow) */
  decided: boolean;
  flourished: boolean;
}
// ---- duel choreography (shared by the engine fx and the renderer) ----
/** face-off before the first exchange (VS plate) */
export const DUEL_INTRO = 0.8;
/** one regular exchange: wind-up, dash / projectile, impact (+ hit-stop), recoil, settle */
export const DUEL_EX = 1.1;
export const DUEL_EXCHANGES = 4;
/** the final blow + KO */
export const DUEL_FINAL = 1.6;
/** start of the final exchange */
export const DUEL_FINAL_AT = DUEL_INTRO + DUEL_EXCHANGES * DUEL_EX;
/** start of the flourish (winner cheers + crown, loser is KO'd) */
export const DUEL_FLOURISH = DUEL_FINAL_AT + DUEL_FINAL;
export const DUEL_FLOURISH_LEN = 2;
/** whole fight (walking duels): intro + exchanges + final + flourish ~ 8.8s */
export const DUEL_FIGHT = DUEL_FLOURISH + DUEL_FLOURISH_LEN;
/** "still" duels (camp / reduced motion): VS badge + emotes only */
export const DUEL_STILL = 4.4;
/** the loser gets up again during the last bit of the flourish */
export const DUEL_RECOVER = 0.4;
export const DUEL_PIPS = 3;
/** which regular exchange is the sword-vs-sword blade lock */
export const DUEL_CLASH_EX = 2;
/** seconds of dash / projectile flight before the impact */
export const DUEL_DASH = 0.25;
/** impact time inside a regular / the final exchange, and the hit-stop that follows it */
export const DUEL_IMPACT = 0.5;
export const DUEL_IMPACT_FINAL = 0.7;
export const DUEL_STOP = 0.08;
export const DUEL_STOP_FINAL = 0.12;
/** px: melee dash distance, blade-lock reach (each), recoil / KO knock-back, KO sink */
export const DUEL_REACH = 32;
export const DUEL_CLASH_REACH = 17;
export const DUEL_KNOCK = 7;
export const DUEL_KNOCK_KO = 12;
export const DUEL_KO_DROP = 3;

export type DuelPose = "idle" | "attack" | "cast" | "hurt" | "cheer";
/** One fighter's scripted state at fight time u (+ the exchange info both fighters share). Offsets are screen px from the walk spot. */
export interface DuelScript {
  dx: number;
  dy: number;
  pose: DuelPose;
  frame: number;
  /** pips left (already counting a blow that has landed) */
  hp: number;
  /** -1 face-off, 0..3 regular exchange, 4 final blow, 5 flourish */
  ex: number;
  /** seconds into the exchange */
  q: number;
  /** attacking side of this exchange (-1 = blade lock / none) */
  atk: number;
  /** 0 none, 1 melee dash, 2 ranged projectile, 3 clash */
  act: DuelAct;
  /** 0 none, 1 wind-up, 2 dash / flight, 3 hit-stop, 4 aftermath */
  stage: DuelStage;
  /** projectile progress 0..1 while in flight, else -1 */
  fly: number;
  big: boolean;
  /** knocked out: stars circle the head */
  ko: boolean;
  /** this fighter has been struck in this exchange */
  hit: boolean;
  stop: boolean;
}
export const newDuelScript = (): DuelScript => ({
  dx: 0,
  dy: 0,
  pose: "idle",
  frame: 0,
  hp: DUEL_PIPS,
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
const DS_SCRATCH = newDuelScript();
const FX0 = newDuelScript(),
  FX1 = newDuelScript();
const sstep = (x: number): number => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (SMOOTHSTEP_A - 2 * x));

/** exchange index at fight time u: -1 face-off, 0..3 regular, 4 final, 5 flourish */
export const duelExchangeAt = (elapsed: number): number => {
  if (elapsed < DUEL_INTRO) return -1;
  if (elapsed >= DUEL_FLOURISH) return DUEL_EX_FLOURISH;
  if (elapsed >= DUEL_FINAL_AT) return DUEL_EXCHANGES;
  return Math.min(DUEL_EXCHANGES - 1, Math.floor((elapsed - DUEL_INTRO) / DUEL_EX));
};
/** attacking side of exchange k (-1 = clash). Mixed kinds alternate who attacks, starting with `agg`; the last blow is the winner's. */
const exAtk = (duel: Duel, exchange: number): number => {
  if (exchange >= DUEL_EXCHANGES) return duel.winner;
  if (exchange === DUEL_CLASH_EX && duel.kind === "sword") return -1;
  return (exchange & 1) === 0 ? duel.agg : 1 - duel.agg;
};
const duelHp = (duel: Duel, side: number, exchange: number, landed: boolean): number => {
  let taken = 0;
  const capped = Math.min(exchange, DUEL_EXCHANGES);
  for (let j = 0; j < capped; j++) {
    const atk = exAtk(duel, j);
    if (atk >= 0 && atk !== side) taken++;
  }
  if (exchange < DUEL_EXCHANGES && landed) {
    const atk = exAtk(duel, exchange);
    if (atk >= 0 && atk !== side) taken++;
  }
  if (exchange >= DUEL_EXCHANGES && (exchange > DUEL_EXCHANGES || landed) && side !== duel.winner) return 0;
  return Math.max(0, DUEL_PIPS - taken);
};

/**
 * The fight script: a pure, allocation-free function of (duel, side, fight time u). Writes into `o` (module scratch by default)
 * and returns it. Regular exchange (1.1s): wind-up pull-back -> dash / projectile -> impact + hit-stop -> recoil (defender knocked back
 * and shaking) -> both ease home. The sword-vs-sword exchange #2 is a blade lock. The final blow is the winner's; the loser is KO'd.
 * Only the final exchange and later read d.winner, so it can be decided at the start of the final blow.
 */
export const duelScript = (duel: Duel, side: 0 | 1, elapsed: number, out: DuelScript = DS_SCRATCH): DuelScript => {
  const dir = side === 0 ? 1 : -1,
    style = side === 0 ? duel.styleL : duel.styleR;
  out.dx = 0;
  out.dy = 0;
  out.pose = style === "magic" ? "cast" : "attack";
  out.frame = 0;
  out.hp = DUEL_PIPS;
  out.ex = -1;
  out.q = 0;
  out.atk = -1;
  out.act = 0;
  out.stage = 0;
  out.fly = -1;
  out.big = false;
  out.ko = false;
  out.hit = false;
  out.stop = false;
  if (elapsed < DUEL_INTRO) {
    if (elapsed < DUEL_INTRO - DUEL_INTRO_IDLE_CUTOFF) {
      out.pose = "idle";
      out.frame = Math.floor(elapsed * DUEL_IDLE_FPS) & 1;
    }
    return out;
  }
  if (elapsed >= DUEL_FLOURISH) {
    out.ex = 5;
    out.q = elapsed - DUEL_FLOURISH;
    out.hp = duelHp(duel, side, DUEL_EX_FLOURISH, true);
    if (side === duel.winner) {
      out.pose = "cheer";
      out.frame = Math.floor(elapsed * DUEL_CHEER_FPS) & 1;
      return out;
    }
    const rec = sstep((elapsed - (DUEL_FIGHT - DUEL_RECOVER)) / DUEL_RECOVER);
    out.dx = Math.round(-dir * DUEL_KNOCK_KO * (1 - rec));
    out.dy = Math.round(DUEL_KO_DROP * (1 - rec));
    out.ko = rec < DUEL_KO_RECOVER_HALF;
    out.pose = rec < DUEL_KO_RECOVER_HALF ? "hurt" : "idle";
    out.frame = 1;
    return out;
  }
  const exchange = duelExchangeAt(elapsed),
    fin = exchange === DUEL_EXCHANGES;
  const phase = Math.max(0, fin ? elapsed - DUEL_FINAL_AT : elapsed - DUEL_INTRO - exchange * DUEL_EX);
  const imp = fin ? DUEL_IMPACT_FINAL : DUEL_IMPACT,
    stopLen = fin ? DUEL_STOP_FINAL : DUEL_STOP;
  const wind = imp - DUEL_DASH,
    rec = fin ? DUEL_REC_FINAL : DUEL_REC,
    ret = fin ? DUEL_RET_FINAL : DUEL_RET;
  const stopped = phase >= imp && phase < imp + stopLen;
  const q2 = phase < imp ? phase : stopped ? imp : phase - stopLen; // game time: frozen during the hit-stop
  const atk = exAtk(duel, exchange);
  out.ex = exchange;
  out.q = phase;
  out.atk = atk;
  out.big = fin;
  out.stop = stopped;
  out.stage = phase < wind ? STAGE_WINDUP : phase < imp ? STAGE_DASH : stopped ? STAGE_HITSTOP : STAGE_AFTERMATH;
  out.hp = duelHp(duel, side, exchange, phase >= imp);
  let forward = 0; // px toward the opponent
  if (atk < 0) {
    // blade lock
    out.act = 3;
    out.pose = "attack";
    const reach = DUEL_CLASH_REACH,
      lockEnd = imp + CLASH_LOCK_S,
      shoveEnd = lockEnd + CLASH_SHOVE_S;
    if (q2 < wind) {
      forward = -CLASH_BACKOFF * sstep(q2 / wind);
    } else if (q2 < imp) {
      forward = -CLASH_BACKOFF + (reach + CLASH_BACKOFF) * sstep((q2 - wind) / DUEL_DASH);
      out.frame = 1;
    } else if (q2 < lockEnd) {
      forward = reach + (stopped ? 0 : ((Math.floor(phase * CLASH_JITTER_HZ) + side) & 1) * 2 - 1);
      out.frame = 1;
    } else if (q2 < shoveEnd) {
      forward = reach - (reach + CLASH_RECOIL) * sstep((q2 - lockEnd) / CLASH_SHOVE_S);
      out.pose = "hurt";
    } else forward = -CLASH_RECOIL * (1 - sstep((q2 - shoveEnd) / CLASH_SETTLE_S));
  } else if (side === atk) {
    const melee = style === "sword",
      back = fin ? DUEL_BACKOFF_FINAL : DUEL_BACKOFF;
    out.act = melee ? 1 : 2;
    if (melee) {
      if (q2 < wind) forward = -back * sstep(q2 / wind);
      else if (q2 < imp) {
        forward = -back + (DUEL_REACH + back) * sstep((q2 - wind) / DUEL_DASH);
        out.frame = 1;
      } else if (q2 < imp + rec) {
        forward = DUEL_REACH - 2 * sstep((q2 - imp) / rec);
        out.frame = 1;
      } else forward = (DUEL_REACH - 2) * (1 - sstep((q2 - imp - rec) / ret));
    } else {
      forward = q2 < wind ? -back * sstep(q2 / wind) : -back * (1 - sstep((q2 - wind) / DUEL_DASH));
      if (phase >= wind && phase < imp) out.fly = (phase - wind) / DUEL_DASH;
      out.frame = style === "magic" ? (q2 >= wind && q2 < imp + rec ? 1 : 0) : q2 < wind ? 1 : 0;
    }
  } else {
    // defender
    out.act = (side === 0 ? duel.styleR : duel.styleL) === "sword" ? 1 : 2;
    const knock = fin ? DUEL_KNOCK_KO : DUEL_KNOCK;
    if (q2 >= imp) {
      out.hit = true;
      const away =
        q2 < imp + rec ? knock * sstep((q2 - imp) / rec) : fin ? knock : knock * (1 - sstep((q2 - imp - rec) / ret));
      forward = -away;
      if (!stopped && q2 < imp + rec) forward += (Math.floor(phase * DUEL_SHAKE_HZ) & 1) * 2 - 1; // shake
      if (fin || q2 < imp + rec + DUEL_HURT_HOLD_S) {
        out.pose = "hurt";
        out.frame = fin && q2 >= imp + rec ? 1 : Math.floor(q2 * DUEL_HURT_FPS) & 1;
      }
      if (fin) {
        out.dy = Math.round(DUEL_KO_DROP * sstep((q2 - imp - DUEL_KO_DELAY_S) / DUEL_KO_FALL_S));
        out.ko = q2 >= imp + rec * DUEL_KO_AT_REC;
      }
    }
  }
  out.dx = Math.round(forward * dir);
  return out;
};

const POINT_SCRATCH: Pt = { x: 0, y: 0 };
/** where this exchange's blow lands (the blade lock sits between the two; otherwise on the defender's front). Allocation-free. */
export const duelContact = (
  left: { x: number; y: number },
  right: { x: number; y: number },
  script: DuelScript,
  out: Pt = POINT_SCRATCH,
): Pt => {
  if (script.atk < 0) {
    out.x = (left.x + right.x) / 2;
    out.y = (left.y + right.y) / 2 - DUEL_CLASH_CONTACT_LIFT;
    return out;
  }
  const dir = script.atk === 0 ? 1 : -1,
    defender = script.atk === 0 ? right : left;
  out.x = defender.x - dir * (script.act === 1 ? DUEL_MELEE_CONTACT_DEPTH : DUEL_RANGED_CONTACT_DEPTH);
  out.y = defender.y - DUEL_CONTACT_LIFT;
  return out;
};
const DUEL_COOLDOWN = 60;
/** a clash that could not duel yet (participant still walking in, etc.) keeps trying this long (sim seconds) */
const DUEL_WAIT = 30;
const GLARE_COOLDOWN = 60;
/** two adventurers closer than this share a spot: no duel */
const DUEL_MIN_DIST = 12;
const pairKey = (first: string, second: string): string =>
  first < second ? first + "|" + second : second + "|" + first;
const DUEL_MAX = 2;
const DUEL_WALK_MAX = 130;
const DUEL_RANGE_MAX = 200;
const SPARK_COLS = ["#ffffff", "#ffe14a", "#ffffff", "#ffb347"];
const MAGIC_COLS = ["#ffffff", "#b07bff", "#8fd3ff", "#ffffff"];
const HOLY_COLS = ["#ffffff", "#ffe27a", "#fff6c0", "#ffd24a"];
const ARROW_COLS = ["#ffffff", "#c69c6d", "#d8dde8", "#ffe14a"];
const CLASH_COLS = ["#ff4a4a", "#ffd94a", "#ffffff"];
const GOLD_COLS = ["#ffe14a", "#ffffff", "#f2c14e"];
const DUST_COLS = ["#d8c9a0", "#b59a6a", "#ffffff"];

const styleOf = (cls: string): DuelStyle =>
  cls === "mage" || cls === "cleric" ? "magic" : cls === "ranger" ? "arrow" : "sword";

/** wait = still inside the ally gate; snap = placed straight at its spot (no walk); in = walking out to its master; here = standing at its spot */
export type InternPhase = "wait" | "snap" | "in" | "here";
export interface Intern {
  id: string;
  label: string;
  born: number;
  act: "idle" | "typing" | "reading" | "handup";
  tool?: string;
  detail?: string;
  since: number;
  count: number;
  failed?: boolean;
  /** where it stands now (px) and the walk it is on */
  x: number;
  y: number;
  face: 1 | -1;
  phase: InternPhase;
  path: Pt[];
}
/** a squire that is done (SubagentStop) and walks back into the ally gate */
export interface Leaver {
  id: string;
  x: number;
  y: number;
  face: 1 | -1;
  path: Pt[];
}
export interface InternRow {
  id: string;
  label: string;
  act: Intern["act"];
  tool: string;
  detail: string;
  count: number;
  needsYou: boolean;
  failed: boolean;
}
const newIntern = (id: string, label: string, clock: number, born = clock, phase: InternPhase = "wait"): Intern => ({
  id,
  label: label || "squire",
  born,
  act: "idle",
  since: clock,
  count: 0,
  x: ALLY_GATE_MOUTH.x,
  y: ALLY_GATE_MOUTH.y,
  face: 1,
  phase,
  path: [],
});

export interface Employee {
  id: string;
  tag: string;
  project: string;
  cwd: string;
  look: Look;
  order: number;
  deskIdx: number;
  slot: number;
  x: number;
  y: number;
  path: Pt[];
  trail: Pt[];
  state: EState;
  act: Act;
  actSince: number;
  /** real-time (Office.realTime) when the current hand-up began; the ledger counts waiting on the user in real seconds */
  handAt: number;
  stateSince: number;
  bubble: string | null;
  tempBubble: { e: string; until: number } | null;
  note: "idle" | "agent" | null;
  interns: Map<string, Intern>;
  lastEventAt: number;
  queue: HookEvt[];
  facing: 1 | -1;
  hasPaper: boolean;
  paperAt: number;
  sparkUntil: number;
  sticky: boolean;
  nextThought: number;
  returning: boolean;
  /** pause (clock seconds) at a waypoint with `wait` (quest board / counter). */
  holdUntil: number;
  /** timestamps used by the renderer */
  noteAt: number;
  lootAt: number;
  hurtUntil: number;
  /** monster at the battle spot */
  monKind: MonsterKind;
  monPos: Pt | null;
  monAppearAt: number;
  monDead: boolean;
  monDeadAt: number;
  monRespawnAt: number;
  monLoot: boolean;
  monN: number;
  monHp: number;
  monHpMax: number;
  /** boss currently standing in for the monster (a tool that ran > 30s) */
  boss: BossKind | null;
  bossAt: number;
  /** Office.realTime when the boss appeared (the longest-fight record is real seconds) */
  bossReal: number;
  /** the boss is still walking out of the dungeon gate: remaining waypoints (monPos is its current position) */
  bossPath: Pt[];
  /** +1 while the walking boss heads right (its sprite faces left by default) */
  bossFace: 1 | -1;
  /** progression */
  lv: number;
  xp: number;
  gold: number;
  kills: number;
  hearts: number;
  /** in-flight tools (key = tool_use_id, else a synthetic key) -> clock time of their PreToolUse; capped */
  pending: Map<string, number>;
  toolCalls: number;
  qKills: number;
  qGold: number;
  resting: boolean;
  /** juice timestamps (clock seconds) */
  windupUntil: number;
  hsUntil: number;
  hsAt: number;
  lungeUntil: number;
  flashUntil: number;
  monLungeUntil: number;
  monKnockUntil: number;
  redUntil: number;
  slashUntil: number;
  lvlAt: number;
  lvlTo: number;
  dustAcc: number;
  /** active territory duel this adventurer is part of */
  duel: Duel | null;
  /** a Stop arrived mid-duel: go to the tavern once back at the spot */
  coffeeAfter: boolean;
  /** a live/snapshot SessionStart was seen for this session */
  sawStart: boolean;
  /** events observed for this session (snapshot events included) */
  evCount: number;
  /** the server listed this session in a snapshot `sessions` array (a real, tracked session) */
  known: boolean;
  /** PreCompact seen: the next context reading is the post-compact one (mana bar flashes when it lands) */
  compactPending: boolean;
  manaFlashUntil: number;
}

export interface Particle {
  on: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  g: number;
  age: number;
  life: number;
  col: string;
  size: number;
  spr: string | null;
  /** drawn BEFORE the entity pass (duel effects: they may fade, so they must never sit over a character) */
  under: boolean;
}
export interface Popup {
  x: number;
  y: number;
  text: string;
  col: string;
  big: boolean;
  born: number;
  dur: number;
  star: boolean;
}
export interface Banner {
  kind: "quest" | "boss";
  text: string;
  start: number;
  dur: number;
}
export interface Butterfly {
  x: number;
  y: number;
  tx: number;
  ty: number;
  col: string;
  ph: number;
}
export interface Bird {
  x: number;
  y: number;
  vx: number;
  ph: number;
}
export interface Firefly {
  x: number;
  y: number;
  sx: number;
  sy: number;
  ph: number;
}
export interface Smoke {
  x: number;
  y: number;
  age: number;
  life: number;
}

export const MAX_HEARTS = 3;
export const xpNeed = (lv: number): number =>
  Math.max(1, Math.round(XP_BASE * Math.pow(XP_GROWTH, Math.max(1, lv) - 1)));
const MON_HP: Record<MonsterKind, number> = { slime: 3, bat: 3, mushroom: 4, goblin: 5, skeleton: 6 };
const HEAVY_TOOLS = new Set(["Bash", "Edit", "Write", "MultiEdit", "NotebookEdit"]);
const BOSS_AFTER = 30;
const REST_AFTER = 60;
const PROGRESS_KEY = "guild.progress.v1";
const PROGRESS_TTL = PROGRESS_TTL_DAYS * HOURS_PER_DAY * SECONDS_PER_HOUR * MS_PER_SECOND;
interface Saved {
  xp: number;
  lv: number;
  gold: number;
  kills: number;
  seen: number;
}
const BF_COLORS = ["#ff9ad5", "#ffd94a", "#8ad0ff", "#c8a0ff", "#ff9a6a"];
const MAX_PARTICLES = 150;
const MAX_POPUPS = 20;

export interface LogRow {
  id: number;
  color: string;
  text: string;
  bad?: boolean;
  time: number;
  tag: string;
  project: string;
  kind: string;
  detail: string;
  intern: boolean;
  internLabel: string;
  /** full session id (lets the UI hide rows of filtered sessions) */
  sid?: string;
}
/** an adventurer waiting on the user, regardless of the session filter */
export interface WaitingRow {
  id: string;
  tag: string;
  project: string;
  status: string;
  hidden: boolean;
}
export type RosterAct = Act | "enter" | "leave" | "stretch" | "coffee" | "compact" | "intern_handup";
export interface RosterRow {
  id: string;
  tag: string;
  project: string;
  color: string;
  status: string;
  interns: number;
  internList: InternRow[];
  desk: number;
  look: Look;
  act: RosterAct;
  level?: number;
  xp?: number;
  xpNext?: number;
  gold?: number;
  kills?: number;
  hp?: number;
  hpMax?: number;
  ctxUsed?: number;
  ctxLimit?: number;
  ctxGuessed?: boolean;
  /** files this session currently holds (territory claims) */
  claims?: number;
  /** strongest live, non-dismissed conflict this session is part of */
  conflict?: "overlap" | "clash";
}
export interface OfficeView {
  roster: RosterRow[];
  log: LogRow[];
  hoverId: string | null;
  selectedId: string | null;
  treasury?: number;
  /** employees hidden by the session filter */
  hiddenCount?: number;
  /** ids hidden by the session filter */
  hiddenIds?: string[];
  /** everyone waiting on the user, unfiltered */
  waiting?: WaitingRow[];
  /** live territory conflicts (non-dismissed), unfiltered like `waiting` */
  conflicts?: ConflictRow[];
  /** Lookout Bell queue (non-dismissed rows of adventurers the guild knows, already ordered) */
  attention?: AttentionRow[];
  /** Receipt Ledger: closed turns, newest first */
  receipts?: ReceiptRow[];
  /** counters behind the dungeon-gate card */
  dungeon: DungeonStats;
}
export const EMPTY_DUNGEON: DungeonStats = {
  since: 0,
  entered: 0,
  left: 0,
  live: 0,
  monsters: 0,
  bosses: 0,
  bossesAlive: 0,
  longestBossS: 0,
  waitS: 0,
  topTools: [],
};
export const EMPTY_VIEW: OfficeView = {
  roster: [],
  log: [],
  hoverId: null,
  selectedId: null,
  hiddenCount: 0,
  hiddenIds: [],
  waiting: [],
  conflicts: [],
  attention: [],
  receipts: [],
  dungeon: EMPTY_DUNGEON,
};

declare global {
  interface Window {
    officeEvent?: (evt: HookEvt) => void;
  }
}

const SPEED = 40;
const h32 = (text: string): number => {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, FNV_PRIME) >>> 0;
  }
  return hash >>> 0;
};
const rand = (min: number, max: number) => min + Math.random() * (max - min);

const str = (value: unknown): string => (typeof value === "string" ? value : "");
const obj = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" ? (value as Record<string, unknown>) : {};
const base = (path: string) => {
  const trimmed = path.replace(/\/+$/, "");
  const i = trimmed.lastIndexOf("/");
  return i >= 0 ? trimmed.slice(i + 1) : trimmed;
};
const trunc = (text: string, max: number) => {
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length > max ? flat.slice(0, max - 1) + "…" : flat;
};

export const toolDetail = (evt: HookEvt): string => {
  const input = obj(evt.tool_input);
  const file = str(input.file_path) || str(input.path) || str(input.notebook_path);
  if (file) return base(file);
  if (str(input.command)) return trunc(str(input.command), DETAIL_MAX);
  if (str(input.pattern)) return trunc(str(input.pattern), DETAIL_MAX);
  if (str(input.url)) return trunc(str(input.url).replace(/^https?:\/\//, ""), DETAIL_MAX);
  if (str(input.query)) return trunc(str(input.query), DETAIL_MAX);
  if (str(input.description)) return trunc(str(input.description), DETAIL_MAX);
  if (str(input.prompt)) return trunc(str(input.prompt), DETAIL_MAX);
  return "";
};

const READ_TOOLS = new Set(["Read", "Grep", "Glob", "LS"]);
const EDIT_TOOLS = new Set(["Edit", "Write", "MultiEdit", "NotebookEdit"]);
const STICKY_TOOLS = new Set(["TodoWrite", "TaskCreate", "TaskUpdate"]);
const AGENT_TOOLS = new Set(["Agent", "Task", "Workflow"]);
const USER_WAIT_TOOLS = new Set(["AskUserQuestion", "ExitPlanMode", "EnterPlanMode"]);
const MAX_PENDING = 16;
const HANDUP_NOTIFS = new Set(["permission_prompt", "agent_needs_input", "elicitation_dialog"]);

const projectOf = (cwd: string | undefined): string => {
  const proj = base(cwd ?? "");
  return proj || "unknown";
};

const internRow = (intern: Intern): InternRow => {
  return {
    id: intern.id,
    label: intern.label,
    act: intern.act,
    tool: intern.tool ?? "",
    detail: intern.detail ?? "",
    count: intern.count,
    needsYou: intern.act === "handup",
    failed: !!intern.failed,
  };
};

export class Office {
  readonly ctx: CanvasRenderingContext2D;
  readonly employees = new Map<string, Employee>();
  clock = 0;
  speed = 1;
  paused = false;
  hoverId: string | null = null;
  selectedId: string | null = null;
  selectedUntil = 0;
  realTime = 0;
  private log: LogRow[] = [];
  private logSeq = 0;
  private seq = 0;
  private raf = 0;
  private running = false;
  private last = 0;
  private lastEmit = 0;
  private dirty = true;
  private lastSig = "";
  private lastErrorLog = 0;
  private ended = new Map<string, number>();
  private endedAgents = new Map<string, number>();
  private listeners = new Set<(v: OfficeView) => void>();
  private sim: { update(): void; addSession(): void } | null = null;
  /** context-window usage per session id; survives leave/re-enter, dropped on reset (null) */
  private ctxMap = new Map<string, Ctx>();
  /** territory (server state, full replacement). Dismissals are per conflictKey; never persisted. */
  private claimN = new Map<string, number>();
  private conflicts: TerritoryConflict[] = [];
  /** Lookout Bell queue (server state, full replacement) and per-row-key dismissals; never persisted */
  private attn: AttentionMsgRow[] = [];
  private attnDismissed = new Set<string>();
  private attnVer = 0;
  /** sessions with a live, non-dismissed loop row (drawn as "berserk") */
  readonly loopIds = new Set<string>();
  private attnRowsCache: AttentionRow[] | null = null;
  /** Receipt Ledger (server state, full replacement); ids already shown, so a receipt bubbles only once. Never persisted. */
  private rcpts: ReceiptMsgRow[] = [];
  private rcptSeen = new Set<string>();
  private rcptInit = false;
  private rcptVer = 0;
  /** key -> Infinity while the conflict is live, else the time its dismissal expires (kept briefly so clash->overlap flaps stay dismissed) */
  private dismissed = new Map<string, number>();
  /** clash conflictKeys already fought out by a finished duel: their contested strip / flag / link are no longer drawn */
  private settled = new Set<string>();
  private pendingClash = new Map<string, TerritoryConflict>();
  private rowsCache: ConflictRow[] | null = null;
  private seenClash = new Set<string>();
  private seenOverlap = new Set<string>();
  /** live duels (<= DUEL_MAX), read by the renderer */
  readonly duels: Duel[] = [];
  private duelAt = new Map<string, number>();
  /** live clashes waiting for both fighters to be free (key -> conflict + deadline) */
  private duelWait = new Map<string, { c: TerritoryConflict; until: number }>();
  /** flag-tug animations after a new overlap */
  private tugs: { a: string; b: string; until: number }[] = [];
  /** clock time of the last failed edit tool per session (the failing side loses a duel) */
  private editFailAt = new Map<string, number>();
  private glareAt = new Map<string, number>();
  private pruneAt = 0;
  private tmpPt: Pt = { x: 0, y: 0 };
  private terrFxAt = 0;
  private terrVer = 0;
  private bumpTerr() {
    this.terrVer++;
    this.rowsCache = null;
    this.attnRowsCache = null;
  }
  // ---- the two gates (render reads these) ----
  /** hover / open state of the dungeon card: the gate gets a highlight */
  gateLit = false;
  /** bosses on the field right now (the dungeon gate glows red while > 0) */
  bossAlive = 0;
  /** squires walking back into the ally gate */
  readonly leavers: Leaver[] = [];
  /** the ally gate doors stand open until this clock time (someone passes) / the doorway glows (a compact event) */
  allyDoorsUntil = 0;
  allyGlowUntil = 0;
  private allyNextAt = 0;
  private stats = {
    since: Date.now(),
    entered: 0,
    left: 0,
    monsters: 0,
    bosses: 0,
    longestBossS: 0,
    waitS: 0,
  };
  private tools = new ToolTally();
  private statsVer = 0;
  private filter: GuildFilter = { query: "", hideStray: false };
  /** isHidden cache; invalidated by bumping hidVer (filter/events/snapshot) or when the act changes */
  private hidVer = 0;
  private hidCache = new Map<string, { v: number; act: string; h: boolean; proj: string }>();

  // ---- effects (render reads these) ----
  readonly particles: Particle[] = Array.from({ length: MAX_PARTICLES }, () => ({
    on: false,
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    g: 0,
    age: 0,
    life: 1,
    col: "#fff",
    size: 1,
    spr: null,
    under: false,
  }));
  private pIdx = 0;
  popups: Popup[] = [];
  banners: Banner[] = [];
  trauma = 0;
  /** full-screen flash request (render draws one frame and clears it) */
  flash = 0;
  // ---- ambient (real-time, frozen while paused) ----
  ambT = 0;
  butterflies: Butterfly[] = [];
  bird: Bird | null = null;
  private nextBird = FIRST_BIRD_S;
  fireflies: Firefly[] = [];
  smoke: Smoke[] = [];
  private nextSmoke = 0;
  rain = 0;
  private rainStart = -1;
  private rainEnd = 0;
  private nextRain = 0;
  // ---- progression ----
  treasury = 0;
  private progress: Record<string, Saved> = {};
  private demo = false;
  private progDirty = false;
  private lastSave = 0;
  private onHide = () => this.saveProgress(true);
  /** prefers-reduced-motion: no screen shake / full-screen flash */
  reducedMotion = false;
  private mq: MediaQueryList | null = null;
  private onMq = () => {
    this.reducedMotion = !!this.mq?.matches;
  };
  /** another tab wrote progress: merge (higher xp/lv per session, max treasury) instead of overwriting it */
  private onStorage = (ev: StorageEvent) => {
    if (ev.key !== PROGRESS_KEY || this.demo || !ev.newValue) return;
    try {
      const j = JSON.parse(ev.newValue) as { sessions?: Record<string, Saved>; treasury?: number };
      const now = Date.now();
      for (const [id, saved] of Object.entries(j.sessions ?? {})) {
        if (!saved || typeof saved !== "object" || !(now - Number(saved.seen) < PROGRESS_TTL)) continue;
        const entry = {
          xp: Math.max(0, Number(saved.xp) || 0),
          lv: Math.max(1, Number(saved.lv) || 1),
          gold: Math.max(0, Number(saved.gold) || 0),
          kills: Math.max(0, Number(saved.kills) || 0),
          seen: Number(saved.seen),
        };
        const mine = this.progress[id];
        if (
          !mine ||
          entry.lv > mine.lv ||
          (entry.lv === mine.lv && entry.xp > mine.xp) ||
          (entry.lv === mine.lv && entry.xp === mine.xp && entry.seen > mine.seen)
        ) {
          this.progress[id] = entry;
        }
      }
      this.treasury = Math.max(this.treasury, Math.max(0, Number(j.treasury) || 0));
    } catch {
      /* corrupt */
    }
  };

  constructor(readonly canvas: HTMLCanvasElement) {
    canvas.width = WORLD_W;
    canvas.height = WORLD_H;
    this.ctx = canvas.getContext("2d")!;
    this.ctx.imageSmoothingEnabled = false;
    this.loadProgress();
    this.initAmbient();
  }

  private initAmbient() {
    const count = BUTTERFLY_MIN + Math.floor(Math.random() * BUTTERFLY_VARIANCE);
    this.butterflies = Array.from({ length: count }, (_, i) => {
      const x = rand(HALL_W + BUTTERFLY_MARGIN, WORLD_W - BUTTERFLY_MARGIN),
        y = rand(BUTTERFLY_Y_MIN, BUTTERFLY_Y_MAX);
      return { x, y, tx: x, ty: y, col: BF_COLORS[i % BF_COLORS.length], ph: rand(0, PHASE_MAX) };
    });
    this.fireflies = Array.from({ length: 12 }, () => {
      const x = rand(HALL_W + FIREFLY_MARGIN, WORLD_W - FIREFLY_MARGIN),
        y = rand(FIREFLY_Y_MIN, FIREFLY_Y_MAX);
      return { x, y, sx: x, sy: y, ph: rand(0, PHASE_MAX) };
    });
    this.scheduleRain(true);
  }

  private scheduleRain(first = false) {
    const delay = this.demo ? (first ? RAIN_DEMO_FIRST_S : RAIN_DEMO_S) : first ? RAIN_FIRST_S : RAIN_S;
    this.nextRain = this.ambT + rand(delay, delay * (this.demo ? RAIN_SPREAD_DEMO : RAIN_SPREAD));
    this.rainStart = -1;
  }
  startRain() {
    this.nextRain = this.ambT;
  }

  // ---------- persistence ----------
  private loadProgress() {
    this.progress = {};
    this.treasury = 0;
    try {
      const raw = typeof localStorage !== "undefined" ? localStorage.getItem(PROGRESS_KEY) : null;
      if (!raw) return;
      const j = JSON.parse(raw) as { sessions?: Record<string, Saved>; treasury?: number };
      const now = Date.now();
      for (const [id, saved] of Object.entries(j.sessions ?? {})) {
        if (!saved || typeof saved !== "object" || !(now - Number(saved.seen) < PROGRESS_TTL)) continue;
        this.progress[id] = {
          xp: Math.max(0, Number(saved.xp) || 0),
          lv: Math.max(1, Number(saved.lv) || 1),
          gold: Math.max(0, Number(saved.gold) || 0),
          kills: Math.max(0, Number(saved.kills) || 0),
          seen: Number(saved.seen),
        };
      }
      this.treasury = Math.max(0, Number(j.treasury) || 0);
    } catch {
      /* storage unavailable or corrupt */
    }
  }

  private saveProgress(force = false) {
    if (this.demo || !this.progDirty) return;
    if (!force && this.realTime - this.lastSave < 2) return;
    this.lastSave = this.realTime;
    this.progDirty = false;
    try {
      const now = Date.now();
      for (const key of Object.keys(this.progress))
        if (now - this.progress[key].seen > PROGRESS_TTL) delete this.progress[key];
      localStorage.setItem(PROGRESS_KEY, JSON.stringify({ sessions: this.progress, treasury: this.treasury }));
    } catch {
      /* quota / private mode */
    }
  }

  private touch(emp: Employee) {
    if (this.demo) return;
    this.progress[emp.id] = { xp: emp.xp, lv: emp.lv, gold: emp.gold, kills: emp.kills, seen: Date.now() };
    this.progDirty = true;
  }

  private pxScale = 0;
  /** Resize backing store to s device px per logical px; drawing stays in logical coords. */
  setPixelScale(scale: number) {
    const factor = Math.max(1, Math.round(scale));
    if (factor === this.pxScale) return;
    this.pxScale = factor;
    this.canvas.width = WORLD_W * factor;
    this.canvas.height = WORLD_H * factor;
    this.ctx.setTransform(factor, 0, 0, factor, 0, 0);
    this.ctx.imageSmoothingEnabled = false;
  }

  // ---------- lifecycle ----------
  start() {
    if (this.running) return;
    this.running = true;
    window.officeEvent = (evt) => this.event(evt);
    this.last = performance.now();
    if (typeof window !== "undefined") {
      window.removeEventListener("pagehide", this.onHide);
      window.addEventListener("pagehide", this.onHide);
      window.removeEventListener("storage", this.onStorage);
      window.addEventListener("storage", this.onStorage);
      try {
        this.mq?.removeEventListener("change", this.onMq);
        this.mq = window.matchMedia("(prefers-reduced-motion: reduce)");
        this.reducedMotion = this.mq.matches;
        this.mq.addEventListener("change", this.onMq);
      } catch {
        /* no matchMedia */
      }
    }
    const loop = (now: number) => {
      if (!this.running) return;
      // Schedule first: one bad frame (e.g. odd live event data) must never freeze the office.
      this.raf = requestAnimationFrame(loop);
      const dt = Math.min(MAX_FRAME_DT, (now - this.last) / MS_PER_SECOND);
      this.last = now;
      try {
        this.update(dt);
        this.ctx.save();
        try {
          drawScene(this.ctx, this);
        } finally {
          this.ctx.restore(); // drops any clip/alpha left behind by a throw mid-draw
        }
        if (now - this.lastEmit > EMIT_INTERVAL_MS) {
          this.lastEmit = now;
          this.emit();
        }
      } catch (err) {
        if (now - this.lastErrorLog > ERROR_LOG_INTERVAL_MS) {
          this.lastErrorLog = now;
          console.error("[office] frame error", err);
        }
      }
    };
    this.raf = requestAnimationFrame(loop);
  }

  stop() {
    this.running = false;
    cancelAnimationFrame(this.raf);
    if (typeof window !== "undefined") {
      delete window.officeEvent;
      window.removeEventListener("pagehide", this.onHide);
      window.removeEventListener("storage", this.onStorage);
    }
    this.mq?.removeEventListener("change", this.onMq);
    this.saveProgress(true);
    this.listeners.clear();
  }

  subscribe(cb: (v: OfficeView) => void): () => void {
    this.listeners.add(cb);
    cb(this.getView());
    this.lastSig = this.signature();
    return () => this.listeners.delete(cb);
  }

  attachSim(sim: { update(): void; addSession(): void } | null) {
    if (sim && !this.demo) this.saveProgress(true);
    this.sim = sim;
    this.demo = !!sim;
    if (sim)
      this.treasury = 0; // demo has its own throw-away treasury; nothing is persisted
    else this.loadProgress();
    this.scheduleRain(true);
  }
  addSession() {
    this.sim?.addSession();
  }
  setSpeed(speed: number) {
    this.speed = speed;
  }
  setPaused(paused: boolean) {
    this.paused = paused;
  }
  /** Replace the Lookout Bell queue. Malformed rows are skipped; dismissals of rows that vanished are forgotten. */
  setAttention(rows: AttentionMsgRow[] | null | undefined) {
    const out: AttentionMsgRow[] = [];
    if (Array.isArray(rows)) {
      for (const row of rows.slice(0, MAX_RECEIPT_ROWS)) {
        if (
          !row ||
          typeof row !== "object" ||
          typeof row.sid !== "string" ||
          !row.sid ||
          typeof row.key !== "string" ||
          !row.key
        )
          continue;
        if (!ATTN_KINDS.includes(row.kind)) continue;
        const text = (value: unknown, max: number) =>
          typeof value === "string" && value ? value.slice(0, max) : undefined;
        const count = (value: unknown) =>
          typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
        const tool = text(row.tool, ATTN_TOOL_MAX);
        const target = text(row.target, ATTN_TARGET_MAX);
        const error = text(row.error, ATTN_ERROR_MAX);
        const tail = text(row.tail, ATTN_TAIL_MAX);
        out.push({
          key: row.key.slice(0, RECEIPT_KEY_MAX),
          sid: row.sid,
          kind: row.kind,
          since: Number.isFinite(Number(row.since)) ? Number(row.since) : 0,
          ...(row.stale === true ? { stale: true } : {}),
          ...(tool ? { tool } : {}),
          ...(target ? { target } : {}),
          ...(row.kind === "loop" ? { count: count(row.count) } : {}),
          ...(error ? { error } : {}),
          ...(tail ? { tail } : {}),
          ...(row.kind === "context" ? { pct: Math.min(PERCENT, count(row.pct)) } : {}),
        });
      }
    }
    const keys = new Set(out.map((row) => row.key));
    for (const key of this.attnDismissed) if (!keys.has(key)) this.attnDismissed.delete(key);
    this.attn = out;
    this.bumpAttn();
  }
  /** Replace the Receipt Ledger. Malformed rows are skipped. A receipt that just closed with outcomes pops a 📜 bubble + quest-log line. */
  setReceipts(rows: ReceiptMsgRow[] | null | undefined) {
    const num = (value: unknown) =>
      typeof value === "number" && Number.isFinite(value)
        ? Math.min(RECEIPT_COUNT_MAX, Math.max(0, Math.floor(value)))
        : 0;
    const out: ReceiptMsgRow[] = [];
    if (Array.isArray(rows)) {
      for (const receipt of rows.slice(0, MAX_RECEIPTS)) {
        if (
          !receipt ||
          typeof receipt !== "object" ||
          typeof receipt.id !== "string" ||
          !receipt.id ||
          typeof receipt.sid !== "string" ||
          !receipt.sid
        )
          continue;
        if (!RECEIPT_VERDICTS.includes(receipt.verdict) || !Number.isFinite(Number(receipt.closedAt))) continue;
        out.push({
          id: receipt.id.slice(0, RECEIPT_ID_MAX),
          sid: receipt.sid,
          project: typeof receipt.project === "string" ? receipt.project.slice(0, RECEIPT_PROJECT_MAX) : "",
          closedAt: Number(receipt.closedAt),
          files: num(receipt.files),
          recovered: num(receipt.recovered),
          commits: num(receipt.commits),
          amends: num(receipt.amends),
          tasks: num(receipt.tasks),
          squire: num(receipt.squire),
          calls: num(receipt.calls),
          verdict: receipt.verdict,
          ...(receipt.staleRed === true ? { staleRed: true } : {}),
        });
      }
    }
    out.sort((older, newer) => newer.closedAt - older.closedAt);
    const first = !this.rcptInit;
    this.rcptInit = true;
    for (const receipt of out) {
      if (this.rcptSeen.has(receipt.id)) continue;
      this.rcptSeen.add(receipt.id);
      if (first || Date.now() - receipt.closedAt > RECEIPT_FRESH_MS) continue;
      const sum = receiptSummary(receipt);
      const emp = this.employees.get(receipt.sid);
      if (!sum || !emp) continue;
      if (emp.state === "SEATED" && !emp.bubble) emp.tempBubble = { e: "📜", until: this.clock + RECEIPT_BUBBLE_S };
      this.log.unshift({
        id: this.logSeq++,
        sid: receipt.sid,
        color: lookFor(receipt.sid).shirt,
        bad: receipt.verdict === "red",
        text: m.log_receipt({
          tag: `#${receipt.sid.slice(0, TAG_LEN)}`,
          project: emp.project,
          verdict: receiptVerdictText(receipt.verdict),
          summary: sum,
        }),
        time: Date.now(),
        tag: emp.tag,
        project: emp.project,
        intern: false,
        internLabel: "",
        kind: KIND_RECEIPT,
        detail: `${receiptVerdictText(receipt.verdict)}: ${sum}`,
      });
      if (this.log.length > LOG_MAX) this.log.length = LOG_MAX;
    }
    if (this.rcptSeen.size > RECEIPT_SEEN_MAX) this.rcptSeen = new Set(out.map((receipt) => receipt.id));
    this.rcpts = out;
    this.rcptVer++;
    this.dirty = true;
  }
  /** receipts to show: newest first, joined with the adventurer when the guild still knows them */
  receiptRows(): ReceiptRow[] {
    return this.rcpts.map((receipt) => {
      const emp = this.employees.get(receipt.sid);
      return {
        ...receipt,
        tag: emp ? emp.tag : "#" + receipt.sid.slice(0, TAG_LEN),
        project: emp ? emp.project : receipt.project || "unknown",
        live: !!emp,
      };
    });
  }
  dismissAttention(key: string) {
    if (this.attn.some((row) => row.key === key)) {
      this.attnDismissed.add(key);
      this.bumpAttn();
    }
  }
  private bumpAttn() {
    this.attnVer++;
    this.attnRowsCache = null;
    this.loopIds.clear();
    for (const row of this.attn) if (row.kind === "loop" && !this.attnDismissed.has(row.key)) this.loopIds.add(row.sid);
    this.dirty = true;
  }
  /** rows to show: not dismissed, session known to the guild */
  attentionRows(): AttentionRow[] {
    if (this.attnRowsCache) return this.attnRowsCache;
    const out: AttentionRow[] = [];
    for (const row of this.attn) {
      const emp = this.employees.get(row.sid);
      if (!emp || this.attnDismissed.has(row.key)) continue;
      out.push({ ...row, tag: emp.tag, project: emp.project });
    }
    return (this.attnRowsCache = out);
  }
  /** the bell rings while someone needs the user right now */
  bellRinging(): boolean {
    return bellCount(this.attentionRows()) > 0;
  }
  setHover(id: string | null) {
    if (this.hoverId !== id) {
      this.hoverId = id;
      this.dirty = true;
    }
  }
  setGateLit(lit: boolean) {
    this.gateLit = lit;
  }
  select(id: string | null) {
    this.selectedId = id;
    this.selectedUntil = this.realTime + SELECT_HOLD_S;
    this.dirty = true;
  }

  clear() {
    this.employees.clear();
    this.log = [];
    this.hoverId = null;
    this.selectedId = null;
    this.ended.clear();
    this.endedAgents.clear();
    this.ctxMap.clear();
    this.attn = [];
    this.attnDismissed.clear();
    this.bumpAttn();
    this.rcpts = [];
    this.rcptSeen.clear();
    this.rcptInit = false;
    this.rcptVer++;
    this.claimN.clear();
    this.conflicts = [];
    this.dismissed.clear();
    this.seenClash.clear();
    this.seenOverlap.clear();
    this.pendingClash.clear();
    this.bumpTerr();
    this.duels.length = 0;
    this.duelAt.clear();
    this.duelWait.clear();
    this.glareAt.clear();
    this.tugs.length = 0;
    this.editFailAt.clear();
    for (const particle of this.particles) particle.on = false;
    this.popups = [];
    this.banners = [];
    this.trauma = 0;
    this.flash = 0;
    this.leavers.length = 0;
    this.bossAlive = 0;
    this.allyDoorsUntil = 0;
    this.allyGlowUntil = 0;
    this.allyNextAt = 0;
    this.stats = { since: Date.now(), entered: 0, left: 0, monsters: 0, bosses: 0, longestBossS: 0, waitS: 0 };
    this.tools.clear();
    this.statsVer++;
    this.dirty = true;
    this.emit(true);
  }

  setContext(sid: string, used: number | null | undefined, limit: number | null | undefined, guessed = false) {
    if (!sid) return;
    if (
      typeof used !== "number" ||
      typeof limit !== "number" ||
      !Number.isFinite(used) ||
      !Number.isFinite(limit) ||
      limit <= 0 ||
      used < 0
    ) {
      if (this.ctxMap.delete(sid)) this.dirty = true;
      return;
    }
    this.ctxMap.delete(sid); // re-insert = most recent
    this.ctxMap.set(sid, { used, limit, guessed: !!guessed });
    const compacting = this.employees.get(sid);
    if (compacting?.compactPending) {
      // the first reading after a PreCompact is the real post-compact context: flash the mana bar, invent nothing
      compacting.compactPending = false;
      compacting.manaFlashUntil = this.clock + MANA_FLASH_S;
      this.burst(
        compacting.x,
        compacting.y + MANA_REFILL_BURST.lift,
        MANA_REFILL_BURST.n,
        WARM_COLS,
        MANA_REFILL_BURST.speed,
        0,
        ARRIVE_SPARKS.life,
        1,
        true,
      );
    }
    if (this.ctxMap.size > CTX_MAP_MAX) this.ctxMap.delete(this.ctxMap.keys().next().value as string);
    this.dirty = true;
  }
  /** used/limit clamped to 0..1, or null when unknown */
  ctxFrac(id: string): number | null {
    const ctx = this.ctxMap.get(id);
    return ctx ? Math.max(0, Math.min(1, ctx.used / ctx.limit)) : null;
  }
  ctxOf(id: string): Ctx | null {
    return this.ctxMap.get(id) ?? null;
  }

  /**
   * Replace territory state (claims + conflicts). New clashes (key not seen before) raise a banner/log/light shake
   * unless `quiet` (snapshot on (re)connect). Malformed input is ignored field by field.
   */
  setTerritory(msg: TerritoryMsg | null | undefined, quiet = false) {
    const claims = new Map<string, number>();
    const conflicts: TerritoryConflict[] = [];
    if (msg && typeof msg === "object") {
      for (const claim of (Array.isArray(msg.claims) ? msg.claims : []).slice(0, MAX_CLAIMS)) {
        if (claim && typeof claim.sid === "string" && Array.isArray(claim.files) && claim.files.length > 0)
          claims.set(claim.sid, claim.files.length);
      }
      for (const conflict of (Array.isArray(msg.conflicts) ? msg.conflicts : []).slice(0, MAX_CONFLICTS)) {
        if (
          !conflict ||
          typeof conflict.file !== "string" ||
          !Array.isArray(conflict.sids) ||
          (conflict.level !== "overlap" && conflict.level !== "clash")
        )
          continue;
        const sids = conflict.sids.filter((x): x is string => typeof x === "string" && !!x).slice(0, MAX_CONFLICT_SIDS);
        if (sids.length < 2) continue;
        const failer =
          typeof conflict.failer === "string" && sids.includes(conflict.failer) ? conflict.failer : undefined;
        conflicts.push(
          failer
            ? { file: conflict.file, sids, level: conflict.level, since: Number(conflict.since) || 0, failer }
            : { file: conflict.file, sids, level: conflict.level, since: Number(conflict.since) || 0 },
        );
      }
    }
    this.claimN = claims;
    this.conflicts = conflicts;
    const keys = new Set(conflicts.map(conflictKey));
    for (const key of this.settled) if (!keys.has(key)) this.settled.delete(key);
    const now = Date.now();
    for (const [key, exp] of [...this.dismissed]) {
      if (keys.has(key)) this.dismissed.set(key, Infinity);
      else if (exp === Infinity) this.dismissed.set(key, now + DISMISS_TTL_MS);
      else if (exp < now) this.dismissed.delete(key);
    }
    const nextSeen = new Set<string>();
    const nextOverlap = new Set<string>();
    this.pendingClash.clear();
    const fresh: TerritoryConflict[] = [];
    const freshOv: TerritoryConflict[] = [];
    for (const conflict of conflicts) {
      if (conflict.level === "overlap") {
        const key = conflictKey(conflict);
        nextOverlap.add(key);
        if (!quiet && !this.seenOverlap.has(key) && this.clashEligible(conflict)) freshOv.push(conflict);
        continue;
      }
      const key = conflictKey(conflict);
      if (this.seenClash.has(key) || quiet) {
        nextSeen.add(key);
        continue;
      }
      if (!this.clashEligible(conflict)) {
        this.pendingClash.set(key, conflict);
        continue;
      } // not eligible yet: alert when sessions arrive
      nextSeen.add(key);
      fresh.push(conflict);
    }
    this.seenClash = nextSeen;
    this.seenOverlap = nextOverlap;
    for (const conflict of fresh.slice(0, MAX_NEW_GLARES)) {
      this.alertClash(conflict);
      this.startDuel(conflict);
    }
    for (const conflict of freshOv.slice(0, MAX_NEW_GLARES)) this.glare(conflict);
    this.bumpTerr();
    this.hidVer++;
    this.dirty = true;
  }

  // ---------- territory duels ----------
  /** can this adventurer start/join a duel right now */
  private duelReady(emp: Employee | undefined): emp is Employee {
    return (
      !!emp &&
      emp.state === "SEATED" &&
      !emp.duel &&
      !this.isHidden(emp) &&
      !this.isWaiting(emp) &&
      emp.x >= 0 &&
      emp.x <= WORLD_W &&
      emp.y >= 0 &&
      emp.y <= WORLD_H
    );
  }

  /**
   * Who holds the file and wins (0 = left, 1 = right). The server names the session whose edit failed (`failer`) and that one loses.
   * Without it: the one whose edit failed recently loses (client-seen failures); else more claims; else a stable hash.
   */
  private duelWinner(left: Employee, right: Employee, failer: string | null): 0 | 1 {
    if (failer === left.id) return 1;
    if (failer === right.id) return 0;
    const failLeft = this.editFailAt.get(left.id) ?? -Infinity,
      failRight = this.editFailAt.get(right.id) ?? -Infinity;
    const recent = (stamp: number) => this.clock - stamp < RECENT_WINDOW_S;
    if (recent(failLeft) !== recent(failRight)) return recent(failLeft) ? 1 : 0;
    if (recent(failLeft) && recent(failRight) && failLeft !== failRight) return failLeft > failRight ? 1 : 0;
    const cl = this.claimsOf(left.id),
      cr = this.claimsOf(right.id);
    if (cl !== cr) return cl > cr ? 0 : 1;
    return h32(left.id) <= h32(right.id) ? 0 : 1;
  }

  /**
   * a NEW clash: the two adventurers duel for ~9s (walking to the flag when both sit at battle spots).
   * When a pair is blocked only by a transient condition (someone still walking in / at the tavern / mid-duel, or both duel slots busy)
   * the clash waits in `duelWait` and is retried every frame for DUEL_WAIT seconds while it stays live.
   */
  private startDuel(conflict: TerritoryConflict) {
    const result = this.tryDuel(conflict);
    const key = conflictKey(conflict);
    if (result === "wait") {
      if (!this.duelWait.has(key)) this.duelWait.set(key, { c: conflict, until: this.clock + DUEL_WAIT });
    } else this.duelWait.delete(key);
  }
  /** "started" | "wait" (retry later) | "none" (nothing to do for this clash) */
  private tryDuel(conflict: TerritoryConflict): "started" | "wait" | "none" {
    const ids = [...new Set(conflict.sids)];
    let wait = false;
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const first = this.employees.get(ids[i]),
          second = this.employees.get(ids[j]);
        if (!first || !second || first === second || first.state === "LEAVING" || second.state === "LEAVING") continue;
        const key = pairKey(first.id, second.id);
        const last = this.duelAt.get(key);
        if (last !== undefined && this.clock - last < DUEL_COOLDOWN) continue; // per pair, not per person
        if (!this.duelReady(first) || !this.duelReady(second)) {
          if (!this.isHidden(first) && !this.isHidden(second) && !this.isWaiting(first) && !this.isWaiting(second))
            wait = true;
          continue;
        }
        if (this.duels.length >= DUEL_MAX) {
          wait = true;
          continue;
        }
        if (this.beginDuel(first, second, conflict.failer ?? null)) {
          this.duelAt.set(key, this.clock);
          return "started";
        }
      }
    }
    return wait ? "wait" : "none";
  }
  /** retry clashes that could not duel yet; drop them once expired or no longer a live clash */
  private retryDuels() {
    for (const [key, waiting] of this.duelWait) {
      const live = this.conflicts.find((conflict) => conflict.level === "clash" && conflictKey(conflict) === key);
      if (!live || this.clock > waiting.until) {
        this.duelWait.delete(key);
        continue;
      }
      if (this.duels.length >= DUEL_MAX) continue;
      const result = this.tryDuel(live);
      if (result === "started" || result === "none") this.duelWait.delete(key);
    }
  }

  private beginDuel(first: Employee, second: Employee, failer: string | null): boolean {
    const dist = Math.hypot(first.x - second.x, first.y - second.y);
    if (dist < DUEL_MIN_DIST) return false; // stacked on the same camp slot: nothing to draw between them
    const bothSpots = first.deskIdx >= 0 && second.deskIdx >= 0;
    let walk = !this.reducedMotion && bothSpots && dist <= DUEL_WALK_MAX;
    if (walk) {
      // a bystander standing in the fight's movement band would be run through: duel in place instead
      const mid = duelMidOfDesks(first.deskIdx, second.deskIdx, this.tmpPt),
        reach = DUEL_HALF + DUEL_KNOCK_KO + CH_W; // fighters' sprite boxes + a bystander's box
      for (const other of this.employees.values()) {
        if (other === first || other === second || other.state === "LEAVING" || this.isHidden(other)) continue;
        if (Math.abs(other.x - mid.x) < reach && Math.abs(other.y - mid.y) < CH_H) {
          walk = false;
          break;
        }
      }
    }
    if (!walk && dist > DUEL_RANGE_MAX) return false;
    // in-place duels (camp / far apart / reduced motion) are "still": a VS badge + emotes, no effects between the sprites
    const still = !walk;
    const [left, right] =
      first.x < second.x || (first.x === second.x && first.y <= second.y) ? [first, second] : [second, first];
    const leftStyle = styleOf(left.look.cls),
      rightStyle = styleOf(right.look.cls);
    let kind: DuelKind,
      agg: 0 | 1 = 0;
    if (leftStyle === rightStyle) kind = leftStyle === "sword" ? "sword" : leftStyle === "magic" ? "orb" : "arrows";
    else if (leftStyle === "arrow" || rightStyle === "arrow") {
      const other = leftStyle === "arrow" ? rightStyle : leftStyle;
      kind = other === "sword" ? "arrow_sword" : "arrow_magic";
      agg = leftStyle === "arrow" ? 0 : 1;
    } else {
      kind = "magic_sword";
      agg = leftStyle === "magic" ? 0 : 1;
    }
    const duel: Duel = {
      l: left.id,
      r: right.id,
      kind,
      styleL: leftStyle,
      styleR: rightStyle,
      agg,
      walk,
      still,
      phase: walk ? "go" : "fight",
      start: this.clock,
      t0: walk ? -1 : this.clock,
      winner: this.duelWinner(left, right, failer),
      failer,
      ix: (left.x + right.x) / 2,
      iy: (left.y + right.y) / 2 - DUEL_ICON_LIFT,
      beat: -1,
      fxm: 0,
      decided: false,
      flourished: false,
    };
    this.duels.push(duel);
    left.duel = duel;
    right.duel = duel;
    if (walk) {
      const mid = duelMidOfDesks(left.deskIdx, right.deskIdx, this.tmpPt);
      this.startWalk(left, mid.x - DUEL_HALF, mid.y);
      this.startWalk(right, mid.x + DUEL_HALF, mid.y);
    } else {
      if (!left.bubble) left.tempBubble = { e: "💢", until: this.clock + GLARE_BUBBLE_S };
      if (!right.bubble) right.tempBubble = { e: "💢", until: this.clock + GLARE_BUBBLE_S };
    }
    this.dirty = true;
    return true;
  }
  private startWalk(emp: Employee, x: number, y: number) {
    emp.state = "DUEL";
    emp.stateSince = this.clock;
    emp.path = [{ x, y }];
    emp.trail = [];
    emp.holdUntil = 0;
    emp.tempBubble = null;
  }

  /** a NEW overlap: both glare (💢) and the flag between them gets tugged (at most once per pair per cooldown) */
  private glare(conflict: TerritoryConflict) {
    const emps = conflict.sids
      .map((x) => this.employees.get(x))
      .filter((emp): emp is Employee => !!emp && emp.state !== "LEAVING");
    if (emps.length < 2) return;
    const [first, second] = emps;
    const key = pairKey(first.id, second.id);
    const last = Math.max(this.glareAt.get(key) ?? -Infinity, this.duelAt.get(key) ?? -Infinity);
    if (this.clock - last < GLARE_COOLDOWN) return;
    this.glareAt.set(key, this.clock);
    if (first.state === "SEATED" && !first.bubble && first.act !== "handup")
      first.tempBubble = { e: "💢", until: this.clock + 2 };
    if (second.state === "SEATED" && !second.bubble && second.act !== "handup")
      second.tempBubble = { e: "💢", until: this.clock + 2 };
    this.tugs.push({ a: first.id, b: second.id, until: this.clock + TUG_S });
    if (this.tugs.length > MAX_TUGS) this.tugs.shift();
  }
  /** the duel was fought to the end: every clash between these two counts as settled */
  private settle(duel: Duel) {
    for (const conflict of this.conflicts)
      if (conflict.level === "clash" && conflict.sids.includes(duel.l) && conflict.sids.includes(duel.r))
        this.settled.add(conflictKey(conflict));
  }
  /** true once a finished duel has settled this clash (the arena between the plots is cleared) */
  isSettled(conflict: { file: string; level: string }): boolean {
    return this.settled.has(conflictKey(conflict));
  }

  /** end time of the flag tug between two sessions (0 when none) */
  tugUntil(sidA: string, sidB: string): number {
    for (const tug of this.tugs)
      if ((tug.a === sidA && tug.b === sidB) || (tug.a === sidB && tug.b === sidA)) return tug.until;
    return 0;
  }

  /** fight over for this adventurer: back to the spot (walking duel) or just release */
  private sendHome(emp: Employee | undefined, duel: Duel) {
    if (!emp || emp.duel !== duel) return;
    if (emp.state === "DUEL") {
      const spot = seatPoint(emp.deskIdx, emp.slot);
      emp.path = [{ x: spot.x, y: spot.y }];
      emp.trail = [];
      emp.holdUntil = 0;
    } else {
      emp.duel = null;
      emp.facing = 1;
    }
  }
  /** one adventurer of a duel in its "back" phase; true while still walking home */
  private backStep(emp: Employee | undefined, duel: Duel): boolean {
    if (!emp || emp.duel !== duel) return false;
    if (emp.state !== "DUEL") {
      emp.duel = null;
      return false;
    }
    if (emp.path.length) return true;
    emp.duel = null;
    this.sit(emp);
    return false;
  }

  private updateDuels() {
    if (this.clock - this.pruneAt > PRUNE_INTERVAL_S) this.pruneMaps();
    for (let i = this.duels.length - 1; i >= 0; i--) {
      const duel = this.duels[i];
      const left = this.employees.get(duel.l),
        right = this.employees.get(duel.r);
      const lOk = !!left && left.duel === duel,
        rOk = !!right && right.duel === duel;
      const okState = (emp: Employee) => emp.state === (duel.walk ? "DUEL" : "SEATED");
      // stand both down: someone left / drank / got hidden by the filter / needs the user (❗ must show), or reduced motion switched on mid-walk
      const stop =
        duel.phase !== "back" &&
        (!lOk ||
          !rOk ||
          !okState(left!) ||
          !okState(right!) ||
          this.isHidden(left) ||
          this.isHidden(right) ||
          this.isWaiting(left!) ||
          this.isWaiting(right!) ||
          (this.reducedMotion && !duel.still));
      if (stop) {
        if (duel.walk) {
          duel.phase = "back";
          this.sendHome(left, duel);
          this.sendHome(right, duel);
        } else {
          if (left && left.duel === duel) {
            left.duel = null;
            left.facing = 1;
          }
          if (right && right.duel === duel) {
            right.duel = null;
            right.facing = 1;
          }
          this.duels.splice(i, 1);
          this.dirty = true;
          continue;
        }
      }
      if ((duel.phase as Duel["phase"]) === "go") {
        if (!left!.path.length && !right!.path.length) {
          duel.phase = "fight";
          duel.t0 = this.clock;
          if (!this.reducedMotion)
            this.burst(
              (left!.x + right!.x) / 2,
              left!.y - FX_DUEL_START.lift,
              FX_DUEL_START.n,
              GOLD_COLS,
              FX_DUEL_START.speed,
              FX_DUEL_START.up,
              FX_DUEL_START.life,
              1,
              true,
            );
        }
      }
      if ((duel.phase as Duel["phase"]) === "fight") {
        const elapsed = this.clock - duel.t0;
        left!.facing = 1;
        right!.facing = -1;
        if (elapsed >= (duel.still ? DUEL_STILL : DUEL_FIGHT)) {
          this.settle(duel);
          if (duel.walk) {
            duel.phase = "back";
            this.sendHome(left, duel);
            this.sendHome(right, duel);
          } else {
            left!.duel = null;
            right!.duel = null;
            left!.facing = 1;
            right!.facing = 1;
            this.duels.splice(i, 1);
            this.dirty = true;
            continue;
          }
        } else if (!duel.still) this.duelFx(duel, left!, right!, elapsed);
      }
      if ((duel.phase as Duel["phase"]) === "back") {
        let live = 0;
        if (this.backStep(left, duel)) live++;
        if (this.backStep(right, duel)) live++;
        if (!live) {
          this.duels.splice(i, 1);
          this.dirty = true;
        }
      }
    }
  }

  /**
   * One-shot effects of the choreography (see duelScript): dust / muzzle flash at the launch, impact burst + damage pop + trauma at the
   * hit, K.O. text, the winner flourish. Particles are flagged `under` (they fade, so never over a character). No per-frame allocation.
   */
  private duelFx(duel: Duel, left: Employee, right: Employee, elapsed: number) {
    if (this.reducedMotion) return;
    if (!duel.decided && elapsed >= DUEL_FINAL_AT) {
      duel.decided = true;
      duel.winner = this.duelWinner(left, right, duel.failer);
    } // decided now, so a failure that arrived during the fight still counts
    const s0 = duelScript(duel, 0, elapsed, FX0),
      s1 = duelScript(duel, 1, elapsed, FX1);
    if (s0.ex !== duel.beat) {
      duel.beat = s0.ex;
      duel.fxm &= 8;
    } // bit 8 (K.O. shown) survives the beat change
    if (s0.ex < 0) return;
    if (s0.ex === DUEL_EX_FLOURISH) {
      if (!duel.flourished) {
        duel.flourished = true;
        const winner = duel.winner === 0 ? left : right;
        this.ring(
          winner.x,
          winner.y - CH_H - FX_WIN_RING.lift,
          FX_WIN_RING.n,
          GOLD_COLS,
          FX_WIN_RING.speed,
          FX_WIN_RING.life,
          true,
        );
        this.pop(winner.x, winner.y - CH_H - POP_LIFT, "WIN!", "#ffe14a", false, true, POP_DUR_WIN);
        if (!(duel.fxm & FXM_KO_SHOWN)) {
          // a long frame jumped over the final exchange: still show the K.O.
          duel.fxm |= 8;
          const loser = duel.winner === 0 ? right : left,
            so = duelScript(duel, duel.winner === 0 ? 1 : 0, elapsed, FX1);
          this.ring(
            loser.x + so.dx,
            loser.y - CH_H - FX_KO_RING.lift,
            FX_KO_RING.n,
            GOLD_COLS,
            FX_KO_RING.speed,
            FX_KO_RING.life,
            true,
          );
          this.pop(loser.x + so.dx, loser.y - CH_H - POP_LIFT, "K.O.!", "#ffffff", true, false, POP_DUR_KO);
        }
      }
      return;
    }
    const attacker = s0.atk === 0 ? left : s0.atk === 1 ? right : null,
      dirA = s0.atk === 1 ? -1 : 1;
    const aStyle = s0.atk === 0 ? duel.styleL : duel.styleR;
    if (!(duel.fxm & 1) && s0.stage >= 2) {
      // launch
      duel.fxm |= 1;
      if (!attacker) {
        this.burst(
          left.x + FX_CLASH_DUST.dx,
          left.y - 1,
          FX_CLASH_DUST.n,
          DUST_COLS,
          FX_CLASH_DUST.speed,
          FX_CLASH_DUST.up,
          FX_CLASH_DUST.life,
          1,
          true,
        );
        this.burst(
          right.x - FX_CLASH_DUST.dx,
          right.y - 1,
          FX_CLASH_DUST.n,
          DUST_COLS,
          FX_CLASH_DUST.speed,
          FX_CLASH_DUST.up,
          FX_CLASH_DUST.life,
          1,
          true,
        );
      } else if (s0.act === 1)
        this.burst(
          attacker.x - dirA * FX_LUNGE_DUST.dx,
          attacker.y - 1,
          FX_LUNGE_DUST.n,
          DUST_COLS,
          FX_LUNGE_DUST.speed,
          FX_LUNGE_DUST.up,
          FX_LUNGE_DUST.life,
          1,
          true,
        );
      else
        this.burst(
          attacker.x + dirA * FX_SHOT_MUZZLE.dx,
          attacker.y - FX_SHOT_MUZZLE.lift,
          FX_SHOT_MUZZLE.n,
          aStyle === "magic" ? (attacker.look.cls === "cleric" ? HOLY_COLS : MAGIC_COLS) : ARROW_COLS,
          FX_SHOT_MUZZLE.speed,
          0,
          FX_SHOT_MUZZLE.life,
          1,
          true,
        );
    }
    if (!(duel.fxm & 2) && s0.stage >= STAGE_HITSTOP) {
      // impact
      duel.fxm |= 2;
      const contact = duelContact(left, right, s0, POINT_SCRATCH);
      duel.ix = contact.x;
      duel.iy = contact.y;
      if (!attacker) {
        this.pop(contact.x, contact.y - CLANG_POP_LIFT, "CLANG!", "#ffe14a", true, true, CLANG_POP_DUR);
        this.burst(
          contact.x,
          contact.y,
          FX_CLANG_SPARKS.n,
          SPARK_COLS,
          FX_CLANG_SPARKS.speed,
          FX_CLANG_SPARKS.up,
          FX_CLANG_SPARKS.life,
          1,
          true,
        );
        this.ring(contact.x, contact.y, FX_CLANG_RING.n, CLASH_COLS, FX_CLANG_RING.speed, FX_CLANG_RING.life, true);
        this.addTrauma(TRAUMA_CLANG);
      } else {
        const defender = s0.atk === 0 ? right : left,
          big = s0.big;
        const cols =
          aStyle === "sword"
            ? SPARK_COLS
            : aStyle === "magic"
              ? attacker.look.cls === "cleric"
                ? HOLY_COLS
                : MAGIC_COLS
              : ARROW_COLS;
        this.burst(
          contact.x,
          contact.y,
          big ? FX_HIT_BIG.n : FX_HIT.n,
          cols,
          big ? FX_HIT_BIG.speed : FX_HIT.speed,
          HIT_BURST_UP,
          HIT_BURST_LIFE,
          1,
          true,
        );
        this.pop(
          defender.x,
          defender.y - CH_H - POP_LIFT,
          big ? "CRIT!" : "-1",
          big ? "#ff4a4a" : "#ffb347",
          big,
          big,
          big ? POP_DUR_CRIT : POP_DUR_HIT,
        );
        this.addTrauma(big ? TRAUMA_HIT_BIG : TRAUMA_HIT);
      }
    }
    if (s0.big && !(duel.fxm & FXM_FINAL_KO) && s0.q >= DUEL_IMPACT_FINAL + DUEL_STOP_FINAL + DUEL_FINAL_KO_DELAY_S) {
      // knocked out
      duel.fxm |= 12;
      const loser = duel.winner === 0 ? right : left,
        so = duel.winner === 0 ? s1 : s0;
      this.ring(
        loser.x + so.dx,
        loser.y - CH_H - FX_KO_RING.lift,
        FX_KO_RING.n,
        GOLD_COLS,
        FX_KO_RING.speed,
        FX_KO_RING.life,
        true,
      );
      this.pop(loser.x + so.dx, loser.y - CH_H - POP_LIFT, "K.O.!", "#ffffff", true, false, POP_DUR_KO);
      this.addTrauma(TRAUMA_KO);
    }
  }

  /** sparks on the contested flag while a clash is live (the flag is knocked over) */
  private updateTerritoryFx(dt: number) {
    for (let i = this.tugs.length - 1; i >= 0; i--) if (this.tugs[i].until < this.clock) this.tugs.splice(i, 1);
    if (this.reducedMotion || !this.conflicts.length) return;
    this.terrFxAt -= dt;
    if (this.terrFxAt > 0) return;
    this.terrFxAt = 0.8;
    let count = 0;
    for (const row of this.conflictRows()) {
      if (row.level !== "clash" || count >= MAX_CLASH_SMOKES || this.settled.has(conflictKey(row))) continue;
      const first = this.employees.get(row.sids[0]),
        second = this.employees.get(row.sids[1]);
      if (!first || !second || first.deskIdx < 0 || second.deskIdx < 0 || this.isHidden(first) || this.isHidden(second))
        continue;
      const mid = duelMidOfDesks(first.deskIdx, second.deskIdx, this.tmpPt);
      this.burst(
        mid.x,
        mid.y - FX_CLASH_SMOKE.lift,
        FX_CLASH_SMOKE.n,
        CLASH_COLS,
        FX_CLASH_SMOKE.speed,
        FX_CLASH_SMOKE.up,
        FX_CLASH_SMOKE.life,
        1,
        true,
      );
      count++;
    }
  }

  /** drop duel/glare/failure bookkeeping that can no longer matter */
  private pruneMaps() {
    this.pruneAt = this.clock;
    for (const [key, stamp] of this.duelAt) if (this.clock - stamp > DUEL_COOLDOWN) this.duelAt.delete(key);
    for (const [key, stamp] of this.glareAt) if (this.clock - stamp > GLARE_COOLDOWN) this.glareAt.delete(key);
    for (const [key, stamp] of this.editFailAt) if (this.clock - stamp > EDIT_FAIL_TTL_S) this.editFailAt.delete(key);
  }
  private forgetFighter(id: string) {
    this.editFailAt.delete(id);
    for (const stamps of [this.duelAt, this.glareAt])
      for (const key of stamps.keys()) if (key.startsWith(id + "|") || key.endsWith("|" + id)) stamps.delete(key);
  }

  private clashEligible(conflict: TerritoryConflict): boolean {
    return conflict.sids.filter((x) => this.employees.has(x)).length >= 2;
  }
  /** fire clash alerts that were waiting for their sessions to become known */
  private recheckPending() {
    if (!this.pendingClash.size) return;
    let count = 0;
    for (const [key, conflict] of [...this.pendingClash]) {
      if (!this.clashEligible(conflict)) continue;
      this.pendingClash.delete(key);
      this.seenClash.add(key);
      if (count++ < MAX_NEW_DUELS) {
        this.alertClash(conflict);
        this.startDuel(conflict);
      }
    }
  }

  private alertClash(conflict: TerritoryConflict) {
    const known = conflict.sids.map((x) => this.employees.get(x)).filter((emp): emp is Employee => !!emp);
    this.addBanner("quest", `⚔️ ${trunc(conflict.file, BANNER_FILE_MAX)}`);
    if (!this.reducedMotion) this.addTrauma(TRAUMA_QUEST);
    const first = known[0];
    const others = known
      .slice(1)
      .map((emp) => emp.tag)
      .join(", ");
    this.log.unshift({
      id: this.logSeq++,
      sid: first.id,
      color: first.look.shirt,
      bad: true,
      text: m.log_clash({ tag: first.tag, project: first.project, file: conflict.file, others }),
      time: Date.now(),
      tag: first.tag,
      project: first.project,
      intern: false,
      internLabel: "",
      kind: KIND_CLASH,
      detail: `${conflict.file} vs ${others}`,
    });
    if (this.log.length > LOG_MAX) this.log.length = LOG_MAX;
  }

  /** live, non-dismissed conflicts between >= 2 sessions this client knows (unfiltered by the session filter) */
  conflictRows(): ConflictRow[] {
    if (this.rowsCache) return this.rowsCache;
    const out: ConflictRow[] = [];
    for (const conflict of this.conflicts) {
      const key = conflictKey(conflict);
      if (this.dismissed.has(key)) continue;
      const emps = conflict.sids.map((x) => this.employees.get(x)).filter((emp): emp is Employee => !!emp);
      if (emps.length < 2) continue;
      out.push({
        key,
        file: conflict.file,
        sids: emps.map((emp) => emp.id),
        names: emps.map((emp) => `${emp.tag} ${emp.project}`),
        level: conflict.level,
        since: conflict.since,
      });
    }
    return (this.rowsCache = out);
  }
  /** non-dismissed clashes (tab title) */
  clashCount(): number {
    let count = 0;
    for (const row of this.conflictRows()) if (row.level === "clash") count++;
    return count;
  }
  claimsOf(id: string): number {
    return this.claimN.get(id) ?? 0;
  }
  dismissConflict(key: string) {
    if (this.dismissed.get(key) === Infinity) return;
    this.dismissed.set(key, Infinity);
    if (this.dismissed.size > DISMISSED_MAX) this.dismissed.delete(this.dismissed.keys().next().value as string);
    this.bumpTerr();
    this.dirty = true;
  }

  setFilter(patch: Partial<GuildFilter>) {
    const next = {
      query: (patch.query ?? this.filter.query).trim(),
      hideStray: patch.hideStray ?? this.filter.hideStray,
    };
    if (next.query === this.filter.query && next.hideStray === this.filter.hideStray) return;
    this.filter = next;
    this.hidVer++;
    if (this.hoverId && this.isHidden(this.employees.get(this.hoverId))) this.hoverId = null;
    if (this.selectedId && this.isHidden(this.employees.get(this.selectedId))) this.selectedId = null;
    this.dirty = true;
  }
  getFilter(): GuildFilter {
    return { ...this.filter };
  }
  /** waiting on the user (main handup, or a squire with a raised hand) */
  private isWaiting(emp: Employee): boolean {
    if (emp.state === "LEAVING") return false;
    if (emp.act === "handup") return true;
    for (const intern of emp.interns.values()) if (intern.act === "handup") return true;
    return false;
  }
  /** Everyone waiting on the user, regardless of the session filter (tab title, notifications). */
  waitingIds(): string[] {
    const out: string[] = [];
    for (const emp of this.employees.values()) if (this.isWaiting(emp)) out.push(emp.id);
    return out;
  }
  /**
   * Hidden by the session filter. State keeps updating and the spot stays reserved; only drawing/roster/hit-testing skip it.
   * "Stray" = a session first seen live without SessionStart, never listed in a server snapshot's `sessions`,
   * with fewer than 3 observed events. Snapshot-listed sessions and anyone waiting on the user (handup) are never stray.
   * Result is cached per employee (see hidVer).
   */
  isHidden(emp: Employee | undefined): boolean {
    if (!emp) return false;
    const cached = this.hidCache.get(emp.id);
    if (cached && cached.v === this.hidVer && cached.act === emp.act) return cached.h;
    const proj = cached && cached.v === this.hidVer ? cached.proj : emp.project.toLowerCase();
    const query = this.filter.query.toLowerCase();
    let hidden = false;
    if (query && !proj.includes(query)) hidden = true;
    else if (
      this.filter.hideStray &&
      !emp.sawStart &&
      !emp.known &&
      emp.evCount < STRAY_EVENT_MIN &&
      !this.isWaiting(emp)
    )
      hidden = true;
    this.hidCache.set(emp.id, { v: this.hidVer, act: emp.act, h: hidden, proj });
    return hidden;
  }

  private signature(): string {
    let sig = `${this.logSeq}|${this.log.length}|${this.hoverId}|${this.selectedId}|${this.treasury}`;
    sig += `|${this.filter.query}|${this.filter.hideStray ? 1 : 0}|T${this.terrVer}|A${this.attnVer}|R${this.rcptVer}`;
    sig += `|D${this.statsVer}:${this.bossAlive}`;
    for (const emp of this.employees.values()) {
      if (this.isHidden(emp)) {
        sig += `;h${emp.id}${this.isWaiting(emp) ? "w" + this.statusOf(emp) : ""}`;
        continue;
      }
      const cf = this.ctxFrac(emp.id);
      sig += `;${emp.id}${cf === null ? "" : "c" + Math.round(cf * PERCENT) + (this.ctxMap.get(emp.id)!.guessed ? "g" : "")},${this.statusOf(emp)},${emp.interns.size},${emp.deskIdx},${emp.lv}:${emp.xp}:${emp.gold}:${emp.kills}:${emp.hearts}`;
      for (const intern of emp.interns.values())
        sig += `,${intern.id}:${intern.label}:${intern.act}:${intern.detail ?? ""}:${intern.count}:${intern.failed ? 1 : 0}`;
    }
    return sig;
  }

  /** push the view to subscribers if it changed (the frame loop calls this ~5x/s) */
  publish() {
    this.emit();
  }

  private emit(force = false) {
    if (!this.listeners.size) return;
    const sig = this.signature();
    if (!force && sig === this.lastSig) return;
    this.lastSig = sig;
    const view = this.getView();
    for (const listener of this.listeners) listener(view);
    this.dirty = false;
  }

  getView(): OfficeView {
    let hiddenCount = 0;
    const hiddenIds: string[] = [];
    const waiting: WaitingRow[] = [];
    for (const emp of this.employees.values()) {
      if (this.isWaiting(emp))
        waiting.push({
          id: emp.id,
          tag: emp.tag,
          project: emp.project,
          status: this.statusOf(emp),
          hidden: this.isHidden(emp),
        });
    }
    const conflicts = this.conflictRows();
    const confOf = new Map<string, "overlap" | "clash">();
    for (const row of conflicts)
      for (const id of row.sids) if (row.level === "clash" || !confOf.has(id)) confOf.set(id, row.level);
    const roster = [...this.employees.values()]
      .filter((emp) => {
        if (this.isHidden(emp)) {
          hiddenCount++;
          hiddenIds.push(emp.id);
          return false;
        }
        return true;
      })
      .sort((first, second) => first.order - second.order)
      .map((emp) => {
        const cx = this.ctxMap.get(emp.id);
        const cl = this.claimN.get(emp.id),
          cf = confOf.get(emp.id);
        return {
          ...(cx ? { ctxUsed: cx.used, ctxLimit: cx.limit, ctxGuessed: cx.guessed } : {}),
          ...(cl ? { claims: cl } : {}),
          ...(cf ? { conflict: cf } : {}),
          id: emp.id,
          tag: emp.tag,
          project: emp.project,
          color: emp.look.shirt,
          status: this.statusOf(emp),
          interns: emp.interns.size,
          internList: [...emp.interns.values()].map(internRow),
          desk: emp.deskIdx,
          look: emp.look,
          act: this.rosterAct(emp),
          level: emp.lv,
          xp: emp.xp,
          xpNext: xpNeed(emp.lv),
          gold: emp.gold,
          kills: emp.kills,
          hp: emp.hearts,
          hpMax: MAX_HEARTS,
        };
      });
    return {
      roster,
      log: this.log.slice(),
      hoverId: this.hoverId,
      selectedId: this.selectedId,
      treasury: this.treasury,
      hiddenCount,
      hiddenIds,
      waiting,
      conflicts,
      attention: this.attentionRows(),
      receipts: this.receiptRows(),
      dungeon: this.dungeonStats(),
    };
  }

  /** finished waits on the user (permission hand-ups) + the ones still going, in real seconds */
  private waitTotal(): number {
    let total = this.stats.waitS;
    for (const emp of this.employees.values())
      if (emp.act === "handup" && emp.state !== "LEAVING") total += this.realTime - emp.handAt;
    return total;
  }
  /** counters behind the dungeon-gate card; everything counts since the page opened (or the last Live/Demo switch) */
  dungeonStats(): DungeonStats {
    let live = 0,
      bossesAlive = 0;
    for (const emp of this.employees.values()) {
      if (emp.state !== "LEAVING") live++;
      if (emp.boss) bossesAlive++;
    }
    return {
      since: this.stats.since,
      entered: this.stats.entered,
      left: this.stats.left,
      live,
      monsters: this.stats.monsters,
      bosses: this.stats.bosses,
      bossesAlive,
      longestBossS: this.stats.longestBossS,
      waitS: this.waitTotal(),
      topTools: this.tools.top(),
    };
  }
  private bumpStats() {
    this.statsVer++;
    this.dirty = true;
  }

  private rosterAct(emp: Employee): RosterAct {
    if (emp.act === "handup" && this.onTrip(emp)) return "handup"; // waiting on you beats the walk
    switch (emp.state) {
      case "ENTERING":
        return "enter";
      case "LEAVING":
        return "leave";
      case "STRETCH":
        return "stretch";
      case "TO_COFFEE":
      case "FROM_COFFEE":
      case "DRINK":
        return "coffee";
      case "TO_ALLY_GATE":
      case "IN_ALLY_GATE":
      case "FROM_ALLY_GATE":
        return "compact";
    }
    if (emp.act !== "handup")
      for (const intern of emp.interns.values()) if (intern.act === "handup") return "intern_handup";
    return emp.act;
  }

  /** walking to / from the tavern or the ally gate, or in its doorway */
  private onTrip(emp: Employee): boolean {
    switch (emp.state) {
      case "TO_COFFEE":
      case "DRINK":
      case "FROM_COFFEE":
      case "TO_ALLY_GATE":
      case "IN_ALLY_GATE":
      case "FROM_ALLY_GATE":
        return true;
      default:
        return false;
    }
  }

  statusOf(emp: Employee): string {
    if (emp.act === "handup" && this.onTrip(emp)) return m.status_handup();
    switch (emp.state) {
      case "ENTERING":
        return m.status_enter();
      case "LEAVING":
        return m.status_leave();
      case "STRETCH":
        return m.status_stretch();
      case "TO_COFFEE":
        return m.status_to_coffee();
      case "FROM_COFFEE":
        return m.status_from_coffee();
      case "DRINK":
        return m.status_drink();
      case "DUEL":
        return m.status_duel();
      case "TO_ALLY_GATE":
        return m.status_to_ally_gate();
      case "IN_ALLY_GATE":
        return m.status_in_ally_gate();
      case "FROM_ALLY_GATE":
        return m.status_from_ally_gate();
    }
    if (emp.hurtUntil > this.clock) return m.status_hurt();
    if (emp.boss && emp.act !== "handup") return m.status_boss();
    if (emp.resting && emp.act !== "handup") return m.status_resting();
    if (emp.act !== "handup")
      for (const intern of emp.interns.values()) if (intern.act === "handup") return m.status_squire_handup();
    switch (emp.act) {
      case "typing":
        return m.status_typing();
      case "reading":
        return m.status_reading();
      case "bash":
        return m.status_bash();
      case "phone":
        return m.status_phone();
      case "mcp":
        return m.status_mcp();
      case "sticky":
        return m.status_sticky();
      case "handup":
        return m.status_handup();
      default:
        if (emp.note === "agent") return m.status_agent();
        if (emp.note === "idle") return m.status_idle();
        return m.status_thinking();
    }
  }

  // ---------- hit testing ----------
  hit(lx: number, ly: number): string | null {
    let best: Employee | null = null;
    for (const emp of this.employees.values()) {
      if (this.isHidden(emp)) continue;
      if (lx >= emp.x - CH_W / 2 && lx <= emp.x + CH_W / 2 && ly >= emp.y - CH_H && ly <= emp.y) {
        if (!best || emp.y >= best.y) best = emp;
      }
    }
    return best ? best.id : null;
  }

  testHand() {
    const list = [...this.employees.values()].filter((emp) => emp.state !== "LEAVING");
    if (!list.length) return;
    const emp = list[Math.floor(Math.random() * list.length)];
    this.event({
      session_id: emp.id,
      hook_event_name: "Notification",
      cwd: emp.cwd,
      notification_type: "permission_prompt",
      message: "Claude needs your permission",
    });
  }

  // ---------- update ----------
  update(rawDt: number) {
    this.realTime += rawDt;
    if (this.selectedId && this.realTime > this.selectedUntil) {
      this.selectedId = null;
      this.dirty = true;
    }
    if (
      this.banners.length &&
      this.banners[0].start >= 0 &&
      this.realTime - this.banners[0].start > this.banners[0].dur
    )
      this.banners.shift();
    this.saveProgress();
    if (this.trauma > 0) this.trauma = Math.max(0, this.trauma - rawDt * TRAUMA_DECAY);
    if (this.flash > 0) this.flash = Math.max(0, this.flash - rawDt * 2);
    const dt = this.paused ? 0 : rawDt * this.speed;
    if (dt <= 0) return;
    this.clock += dt;
    this.updateFx(dt);
    this.updateAmbient(rawDt);
    this.sim?.update();
    this.promoteOverflow();
    this.retryDuels();
    this.updateDuels();
    this.updateTerritoryFx(dt);
    for (const emp of [...this.employees.values()]) this.updateEmployee(emp, dt);
    if (this.reducedMotion !== this.motionApplied) {
      this.motionApplied = this.reducedMotion;
      if (this.reducedMotion) this.settleMotion();
    }
    this.updateSquires(dt);
    let bosses = 0;
    for (const emp of this.employees.values()) if (emp.boss) bosses++;
    this.bossAlive = bosses;
  }

  // ---------- effects ----------
  addTrauma(amount: number) {
    this.trauma = Math.min(1, this.trauma + amount);
  }

  private emitP(
    x: number,
    y: number,
    vx: number,
    vy: number,
    gravity: number,
    life: number,
    col: string,
    size = 1,
    spr: string | null = null,
    under = false,
  ) {
    let particle = this.particles[this.pIdx];
    for (let i = 0; i < MAX_PARTICLES; i++) {
      const candidate = this.particles[(this.pIdx + i) % MAX_PARTICLES];
      if (!candidate.on) {
        particle = candidate;
        this.pIdx = (this.pIdx + i + 1) % MAX_PARTICLES;
        break;
      }
      if (i === MAX_PARTICLES - 1) this.pIdx = (this.pIdx + 1) % MAX_PARTICLES; // pool full: recycle the next slot
    }
    particle.on = true;
    particle.x = x;
    particle.y = y;
    particle.vx = vx;
    particle.vy = vy;
    particle.g = gravity;
    particle.age = 0;
    particle.life = life;
    particle.col = col;
    particle.size = size;
    particle.spr = spr;
    particle.under = under;
  }

  private burst(
    x: number,
    y: number,
    count: number,
    cols: string[],
    speed: number,
    gravity = 90,
    life = 0.5,
    size = 1,
    under = false,
  ) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2,
        velocity = speed * rand(BURST_SPEED_MIN, 1);
      this.emitP(
        x,
        y,
        Math.cos(angle) * velocity,
        Math.sin(angle) * velocity - speed * BURST_LIFT,
        gravity,
        life * rand(BURST_LIFE_MIN, BURST_LIFE_MAX),
        cols[i % cols.length],
        size,
        null,
        under,
      );
    }
  }

  private ring(x: number, y: number, count: number, cols: string[], speed: number, life: number, under = false) {
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      this.emitP(
        x,
        y,
        Math.cos(angle) * speed,
        Math.sin(angle) * speed * RING_SQUASH,
        0,
        life,
        cols[i % cols.length],
        i % RING_BIG_EVERY === 0 ? 2 : 1,
        null,
        under,
      );
    }
  }

  private pop(x: number, y: number, text: string, col: string, big = false, star = false, dur = 0.8) {
    this.popups.push({ x, y, text, col, big, born: this.clock, dur, star });
    if (this.popups.length > MAX_POPUPS) this.popups.splice(0, this.popups.length - MAX_POPUPS);
  }

  private addBanner(kind: Banner["kind"], text: string) {
    this.banners.push({ kind, text, start: -1, dur: 2.5 });
    if (this.banners.length > MAX_BANNERS) this.banners.splice(1, this.banners.length - MAX_BANNERS);
  }

  private updateFx(dt: number) {
    for (const particle of this.particles) {
      if (!particle.on) continue;
      particle.age += dt;
      if (particle.age >= particle.life) {
        particle.on = false;
        continue;
      }
      particle.vy += particle.g * dt;
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
    }
    for (let i = this.popups.length - 1; i >= 0; i--)
      if (this.clock - this.popups[i].born > this.popups[i].dur) this.popups.splice(i, 1);
  }

  private updateAmbient(dt: number) {
    this.ambT += dt;
    const stamp = this.ambT;
    for (const butterfly of this.butterflies) {
      const dx = butterfly.tx - butterfly.x,
        dy = butterfly.ty - butterfly.y,
        dist = Math.hypot(dx, dy);
      if (dist < BUTTERFLY_ARRIVE_DIST) {
        butterfly.tx = Math.min(
          WORLD_W - BUTTERFLY_PAD_R,
          Math.max(HALL_W + BUTTERFLY_PAD_L, butterfly.x + rand(-BUTTERFLY_WANDER_X, BUTTERFLY_WANDER_X)),
        );
        butterfly.ty = Math.min(
          BUTTERFLY_ROAM_Y_MAX,
          Math.max(BUTTERFLY_ROAM_Y_MIN, butterfly.y + rand(-BUTTERFLY_WANDER_Y, BUTTERFLY_WANDER_Y)),
        );
      } else {
        const stepLen = BUTTERFLY_SPEED * dt;
        butterfly.x += (dx / dist) * stepLen;
        butterfly.y += (dy / dist) * stepLen;
      }
    }
    for (const firefly of this.fireflies) {
      firefly.x = firefly.sx + Math.sin(stamp * FIREFLY_FREQ_X + firefly.ph * FIREFLY_PHASE_X) * FIREFLY_AMP_X;
      firefly.y = firefly.sy + Math.sin(stamp * FIREFLY_FREQ_Y + firefly.ph * FIREFLY_PHASE_Y) * FIREFLY_AMP_Y;
    }
    if (this.bird) {
      const bird = this.bird;
      bird.x += bird.vx * dt;
      bird.ph += dt;
      if (bird.x < HALL_W - BIRD_OFFSCREEN || bird.x > WORLD_W + BIRD_OFFSCREEN) {
        this.bird = null;
        this.nextBird = stamp + rand(BIRD_INTERVAL_MIN_S, BIRD_INTERVAL_MAX_S);
      }
    } else if (stamp >= this.nextBird) {
      const dir = Math.random() < COIN_FLIP ? 1 : -1;
      this.bird = {
        x: dir > 0 ? HALL_W - BIRD_EDGE : WORLD_W + BIRD_EDGE,
        y: rand(BIRD_Y_MIN, BIRD_Y_MAX),
        vx: dir * rand(BIRD_VX_MIN, BIRD_VX_MAX),
        ph: 0,
      };
    }
    // chimney / hearth smoke
    for (let i = this.smoke.length - 1; i >= 0; i--) {
      const puff = this.smoke[i];
      puff.age += dt;
      puff.y -= SMOKE_RISE * dt;
      puff.x += Math.sin(puff.age * 2 + i) * SMOKE_SWAY * dt;
      if (puff.age > puff.life) this.smoke.splice(i, 1);
    }
    if (stamp >= this.nextSmoke && this.smoke.length < MAX_SMOKE) {
      this.smoke.push({
        x: HEARTH.x + SMOKE_X + rand(-SMOKE_JITTER, SMOKE_JITTER),
        y: HEARTH.y - 1,
        age: 0,
        life: 2.4,
      });
      this.nextSmoke = stamp + SMOKE_INTERVAL_S;
    }
    // rain
    if (this.rainStart < 0) {
      if (stamp >= this.nextRain) {
        this.rainStart = stamp;
        this.rainEnd = stamp + RAIN_DURATION_S;
      }
      this.rain = 0;
    } else {
      if (stamp > this.rainEnd + RAIN_FADE_S) {
        this.rain = 0;
        this.scheduleRain();
      } else
        this.rain = Math.max(
          0,
          Math.min(1, (stamp - this.rainStart) / RAIN_FADE_S, (this.rainEnd + RAIN_FADE_S - stamp) / RAIN_FADE_S),
        );
    }
  }

  private move(emp: Employee, dt: number): boolean {
    if (emp.holdUntil > this.clock) return false;
    let rem = SPEED * dt;
    while (rem > 0 && emp.path.length) {
      const target = emp.path[0];
      const dx = target.x - emp.x,
        dy = target.y - emp.y;
      const dist = Math.hypot(dx, dy);
      if (dx !== 0) emp.facing = dx > 0 ? 1 : -1;
      emp.dustAcc += Math.min(dist, rem) / SPEED;
      if (emp.dustAcc > DUST_STEP) {
        emp.dustAcc = 0;
        this.emitP(
          emp.x - emp.facing * DUST_BEHIND + rand(-1, 1),
          emp.y - 1,
          -emp.facing * rand(2, DUST_VX_MAX),
          rand(-DUST_VY_UP, -DUST_VY_DOWN),
          0,
          DUST_LIFE,
          "#d8c8a0",
          1,
          Math.random() < COIN_FLIP ? "dust0" : "dust1",
        );
      }
      if (dist <= rem) {
        emp.x = target.x;
        emp.y = target.y;
        rem -= dist;
        emp.path.shift();
        if (emp.state === "TO_COFFEE" || emp.state === "TO_ALLY_GATE") emp.trail.push(target);
        if (target.wait && emp.path.length) {
          emp.holdUntil = this.clock + target.wait;
          if (emp.state === "LEAVING") emp.lootAt = this.clock;
          else emp.noteAt = this.clock;
          break;
        }
      } else {
        emp.x += (dx / dist) * rem;
        emp.y += (dy / dist) * rem;
        rem = 0;
      }
    }
    return emp.path.length === 0;
  }

  private updateEmployee(emp: Employee, dt: number) {
    // a duel is not a stall: in-flight tools must not age into a boss while the adventurer is busy dueling
    if (emp.duel && emp.pending.size) for (const [key, t0] of emp.pending) emp.pending.set(key, t0 + dt);
    // idle timeout is ~10 real minutes: the sim clock is speed-scaled, and waiting on a permission prompt is not idle.
    if (
      emp.state !== "LEAVING" &&
      emp.act !== "handup" &&
      emp.pending.size === 0 &&
      this.clock - emp.lastEventAt > IDLE_GRACE_S * Math.max(1, this.speed)
    )
      this.leave(emp);
    if (emp.boss && emp.bossPath.length) this.walkBoss(emp, dt);
    switch (emp.state) {
      case "ENTERING":
        if (this.move(emp, dt)) this.sit(emp);
        break;
      case "FROM_COFFEE":
      case "FROM_ALLY_GATE":
        if (this.move(emp, dt)) this.sit(emp);
        break;
      case "TO_ALLY_GATE":
        if (this.move(emp, dt)) {
          emp.state = "IN_ALLY_GATE";
          emp.stateSince = this.clock;
          emp.facing = 1;
          this.allyDoorsUntil = this.clock + COMPACT_REST_S + ALLY_DOORS_S; // the doors stand open while they rest
          this.burst(
            ALLY_GATE_MOUTH.x,
            ALLY_GATE_MOUTH.y - ARRIVE_SPARKS.lift,
            ARRIVE_SPARKS.n,
            WARM_COLS,
            ARRIVE_SPARKS.speed,
            ARRIVE_SPARKS.up,
            ARRIVE_SPARKS.life,
            1,
            true,
          );
        }
        break;
      case "IN_ALLY_GATE":
        if (this.clock - emp.stateSince >= COMPACT_REST_S) {
          emp.state = "FROM_ALLY_GATE";
          emp.stateSince = this.clock;
          emp.path = [...emp.trail].reverse();
          emp.trail = [];
        }
        break;
      case "DUEL":
        if (emp.path.length) this.move(emp, dt); // updateDuels() owns the phase changes
        break;
      case "TO_COFFEE":
        if (this.move(emp, dt)) {
          emp.state = "DRINK";
          emp.stateSince = this.clock;
          emp.facing = 1;
          emp.hearts = MAX_HEARTS;
          for (let k = 0; k < HEART_COUNT; k++)
            this.emitP(
              emp.x - HEART_SPACING + k * HEART_SPACING,
              emp.y - HEART_LIFT,
              rand(-HEART_VX, HEART_VX),
              rand(-HEART_VY_MAX, -HEART_VY_MIN),
              0,
              HEART_LIFE,
              "#ff5a6a",
              1,
              "heart",
            );
        }
        break;
      case "LEAVING":
        if (this.move(emp, dt)) {
          if (emp.returning) this.reenter(emp);
          else {
            this.employees.delete(emp.id);
            this.forgetFighter(emp.id);
            this.bumpTerr();
            this.dirty = true;
          }
        }
        break;
      case "STRETCH":
        if (this.clock - emp.stateSince >= STRETCH_S) {
          emp.state = "TO_COFFEE";
          emp.stateSince = this.clock;
          const route = routeToTavern(emp.deskIdx, emp.slot, emp.order);
          emp.trail = [route[0]];
          emp.path = route.slice(1);
        }
        break;
      case "DRINK":
        if (this.clock - emp.stateSince >= DRINK_S) {
          emp.state = "FROM_COFFEE";
          emp.path = [...emp.trail].reverse();
          emp.trail = [];
        }
        break;
      case "SEATED":
        if (emp.tempBubble && this.clock > emp.tempBubble.until) emp.tempBubble = null;
        if (emp.act === "thinking" && !emp.bubble && !emp.tempBubble && this.clock >= emp.nextThought) {
          emp.tempBubble = { e: "…", until: this.clock + THOUGHT_BUBBLE_S };
          emp.nextThought = this.clock + rand(THOUGHT_MIN_S, THOUGHT_MAX_S);
        }
        if (emp.act === "handup") {
          for (const key of emp.pending.keys()) emp.pending.set(key, this.clock);
        } // waiting on the user is not a boss fight
        if (emp.pending.size > 0 && !emp.boss && emp.deskIdx >= 0 && emp.monPos) {
          let oldest = Infinity;
          for (const t0 of emp.pending.values()) if (t0 < oldest) oldest = t0;
          if (this.clock - oldest > BOSS_AFTER) this.spawnBoss(emp);
        }
        break;
    }
    emp.resting =
      emp.state === "SEATED" &&
      emp.deskIdx >= 0 &&
      emp.act === "thinking" &&
      emp.pending.size === 0 &&
      !emp.boss &&
      this.clock - emp.lastEventAt > REST_AFTER;
    if (emp.state !== "LEAVING" && emp.deskIdx >= 0 && emp.monDead && emp.monRespawnAt <= this.clock)
      this.spawnMonster(emp);
    if (emp.state !== "SEATED" && emp.tempBubble && this.clock > emp.tempBubble.until) emp.tempBubble = null;
  }

  private motionApplied = false;
  /** reduced motion was switched on mid-walk: everything on the move snaps to where it was heading */
  private settleMotion() {
    this.leavers.length = 0;
    for (const emp of [...this.employees.values()]) {
      if (emp.boss && emp.bossPath.length && emp.deskIdx >= 0) {
        emp.monPos = monsterSpot(emp.deskIdx);
        emp.bossPath = [];
        emp.bossFace = -1;
      }
      for (const intern of emp.interns.values()) if (intern.phase === "in") intern.phase = "snap";
      if (emp.state === "TO_ALLY_GATE" || emp.state === "IN_ALLY_GATE" || emp.state === "FROM_ALLY_GATE") {
        emp.path = [];
        emp.trail = [];
        this.sit(emp);
      }
    }
    this.dirty = true;
  }

  /** the boss walks out of the dungeon gate along the bridge and road to its fight spot (monPos follows it) */
  private walkBoss(emp: Employee, dt: number) {
    const pos = emp.monPos;
    if (!pos) {
      emp.bossPath = [];
      return;
    }
    let rem = BOSS_SPEED * dt;
    while (rem > 0 && emp.bossPath.length) {
      const target = emp.bossPath[0];
      const dx = target.x - pos.x,
        dy = target.y - pos.y;
      const dist = Math.hypot(dx, dy);
      if (dx !== 0) emp.bossFace = dx > 0 ? 1 : -1;
      if (dist <= rem) {
        pos.x = target.x;
        pos.y = target.y;
        rem -= dist;
        emp.bossPath.shift();
      } else {
        pos.x += (dx / dist) * rem;
        pos.y += (dy / dist) * rem;
        rem = 0;
      }
    }
    if (!emp.bossPath.length) emp.bossFace = -1; // arrived: face the adventurer
  }

  private sit(emp: Employee) {
    const spot = seatPoint(emp.deskIdx, emp.slot);
    emp.x = spot.x;
    emp.y = spot.y;
    emp.facing = 1;
    emp.trail = [];
    if (emp.deskIdx >= 0 && !emp.monPos) this.spawnMonster(emp);
    emp.state = "SEATED";
    emp.stateSince = this.clock;
    const queue = emp.queue;
    emp.queue = [];
    for (let i = 0; i < queue.length; i++) {
      if (emp.state !== "SEATED") {
        emp.queue = queue.slice(i);
        break;
      }
      this.applyEvent(emp, queue[i], i === queue.length - 1);
    }
    if (emp.coffeeAfter) {
      // a Stop arrived while dueling: take the break now
      emp.coffeeAfter = false;
      if (emp.state === "SEATED") {
        emp.state = "STRETCH";
        emp.stateSince = this.clock;
      }
    }
  }

  private leave(emp: Employee) {
    if (emp.state === "LEAVING") return;
    this.stats.left++;
    if (emp.act === "handup") this.stats.waitS += this.realTime - emp.handAt;
    this.bumpStats();
    this.sendSquiresHome(emp);
    emp.duel = null;
    emp.coffeeAfter = false; // updateDuels() sends the opponent home
    const path: Pt[] = routeLeave(emp.x, emp.y);
    emp.state = "LEAVING";
    emp.returning = false;
    emp.path = path;
    emp.trail = [];
    emp.holdUntil = 0;
    if (emp.monPos && !emp.monDead) {
      emp.monDead = true;
      emp.monDeadAt = this.clock;
      emp.monLoot = false;
      emp.monRespawnAt = Infinity;
    }
    emp.bubble = null;
    emp.tempBubble = null;
    emp.queue = [];
    emp.act = "thinking";
    emp.actSince = this.clock;
    emp.note = null;
    emp.hasPaper = false;
    emp.sticky = false;
    emp.hurtUntil = 0;
    emp.boss = null;
    emp.bossPath = [];
    emp.compactPending = false;
    emp.pending.clear();
    emp.resting = false;
    emp.toolCalls = 0;
    emp.qKills = 0;
    emp.qGold = 0;
    emp.interns.clear();
    emp.deskIdx = -1;
    emp.slot = -1;
    this.dirty = true;
  }

  /** A battle spot is free and someone is waiting at camp: send the longest-waiting seated one to it. */
  private promoteOverflow() {
    let waiting: Employee | null = null;
    for (const other of this.employees.values()) {
      if (other.deskIdx < 0 && other.slot >= 0 && other.state === "SEATED" && (!waiting || other.order < waiting.order))
        waiting = other;
    }
    if (!waiting) return;
    const { desk } = this.pickSeat(waiting.id);
    if (desk < 0) return;
    const emp = waiting;
    emp.path = routePromote(emp.x, emp.y, desk);
    emp.deskIdx = desk;
    emp.slot = -1;
    emp.state = "FROM_COFFEE";
    emp.stateSince = this.clock;
    emp.trail = [];
    emp.holdUntil = 0;
    emp.monAppearAt = -1;
    emp.monPos = null;
    emp.monDead = false;
    emp.monRespawnAt = Infinity;
    emp.boss = null;
    emp.pending.clear();
    this.dirty = true;
  }

  // ---------- spawning ----------
  private pickSeat(exclude?: string): { desk: number; slot: number } {
    const used = new Set<number>(),
      slots = new Set<number>();
    for (const other of this.employees.values()) {
      if (other.id === exclude) continue;
      if (other.deskIdx >= 0) used.add(other.deskIdx);
      else if (other.slot >= 0) slots.add(other.slot);
    }
    let desk = -1,
      slot = -1;
    for (let i = 0; i < DESK_COUNT; i++)
      if (!used.has(i)) {
        desk = i;
        break;
      }
    if (desk < 0) {
      slot = 0;
      while (slots.has(slot)) slot++;
    }
    return { desk, slot };
  }

  private reenter(emp: Employee) {
    this.stats.entered++;
    this.bumpStats();
    const { desk, slot } = this.pickSeat(emp.id);
    emp.deskIdx = desk;
    emp.slot = slot;
    emp.returning = false;
    emp.state = "ENTERING";
    emp.stateSince = this.clock;
    emp.trail = [];
    emp.holdUntil = 0;
    emp.monAppearAt = -1;
    emp.monPos = null;
    emp.monDead = false;
    emp.monRespawnAt = Infinity;
    emp.boss = null;
    emp.pending.clear();
    emp.resting = false;
    emp.path = routeIn(desk, slot).slice(1);
    this.dirty = true;
  }

  private spawnMonster(emp: Employee, instant = false) {
    const kinds = MONSTER_KINDS as readonly MonsterKind[];
    emp.monKind = kinds[(h32(emp.id) + emp.monN * MON_KIND_STRIDE) % kinds.length];
    emp.monN++;
    emp.monHp = emp.monHpMax = MON_HP[emp.monKind];
    emp.boss = null;
    emp.monPos = emp.deskIdx >= 0 ? monsterSpot(emp.deskIdx) : null;
    emp.monAppearAt = instant ? this.clock - MON_INSTANT_BACKDATE_S : this.clock;
    emp.monDead = false;
    emp.monDeadAt = -99;
    emp.monRespawnAt = Infinity;
    emp.monLoot = false;
  }

  private defeatMonster(emp: Employee) {
    emp.monDead = true;
    emp.monDeadAt = this.clock;
    emp.monLoot = true;
    emp.monRespawnAt = this.clock + MON_RESPAWN_BASE_S + Math.random();
  }

  private spawn(id: string, cwd: string | undefined, seated: boolean): Employee {
    const { desk, slot } = this.pickSeat();
    const seat = seatPoint(desk, slot);
    const emp: Employee = {
      id,
      tag: "#" + id.slice(0, TAG_LEN),
      project: projectOf(cwd),
      cwd: cwd ?? "",
      look: lookFor(id),
      order: this.seq++,
      deskIdx: desk,
      slot,
      x: seated ? seat.x : DOOR.x,
      y: seated ? seat.y : DOOR.y,
      path: [],
      trail: [],
      state: seated ? "SEATED" : "ENTERING",
      act: "thinking",
      actSince: this.clock,
      handAt: 0,
      stateSince: this.clock,
      bubble: null,
      tempBubble: null,
      note: null,
      interns: new Map(),
      lastEventAt: this.clock,
      queue: [],
      facing: 1,
      returning: false,
      hasPaper: false,
      paperAt: -9,
      sparkUntil: 0,
      sticky: false,
      nextThought: this.clock + rand(THOUGHT_MIN_S, THOUGHT_MAX_S),
      holdUntil: 0,
      noteAt: -9,
      lootAt: -9,
      hurtUntil: 0,
      monKind: "slime",
      monPos: null,
      monAppearAt: -1,
      monDead: false,
      monDeadAt: -99,
      monRespawnAt: Infinity,
      monLoot: false,
      monN: 0,
      monHp: 3,
      monHpMax: 3,
      boss: null,
      bossAt: -1,
      bossReal: 0,
      bossPath: [],
      bossFace: -1,
      lv: 1,
      xp: 0,
      gold: 0,
      kills: 0,
      hearts: MAX_HEARTS,
      pending: new Map(),
      toolCalls: 0,
      qKills: 0,
      qGold: 0,
      resting: false,
      windupUntil: 0,
      hsUntil: 0,
      hsAt: 0,
      lungeUntil: 0,
      flashUntil: 0,
      monLungeUntil: 0,
      monKnockUntil: 0,
      redUntil: 0,
      slashUntil: 0,
      lvlAt: -99,
      lvlTo: 1,
      dustAcc: 0,
      duel: null,
      coffeeAfter: false,
      sawStart: false,
      evCount: 0,
      known: false,
      compactPending: false,
      manaFlashUntil: 0,
    };
    const sv = this.demo ? undefined : this.progress[id];
    if (sv) {
      emp.lv = sv.lv;
      emp.xp = sv.xp;
      emp.gold = sv.gold;
      emp.kills = sv.kills;
    }
    if (!seated) emp.path = routeIn(desk, slot).slice(1);
    else if (desk >= 0) this.spawnMonster(emp, true);
    this.employees.set(id, emp);
    if (!seated) this.stats.entered++; // sessions found already seated in a snapshot were in the guild before
    this.bumpStats();
    this.bumpTerr(); // conflict rows depend on who is present
    this.recheckPending();
    this.dirty = true;
    return emp;
  }

  loadSnapshot(snap: SnapshotMsg) {
    const ids = new Set<string>();
    const seen = new Map<string, { n: number; start: boolean }>();
    for (const ev of snap.events ?? []) {
      const sid = str(ev?.session_id);
      if (!sid) continue;
      const tally = seen.get(sid) ?? { n: 0, start: false };
      tally.n++;
      if (ev.hook_event_name === "SessionStart") tally.start = true;
      seen.set(sid, tally);
    }
    for (const session of snap.sessions ?? []) {
      if (!session.session_id) continue;
      ids.add(session.session_id);
      if (session.context === null) this.setContext(session.session_id, null, null);
      else if (session.context)
        this.setContext(
          session.session_id,
          session.context.used,
          session.context.limit,
          !!session.context.limitGuessed,
        );
      this.ended.delete(session.session_id);
      let emp = this.employees.get(session.session_id);
      if (!emp) emp = this.spawn(session.session_id, session.cwd, true);
      emp.known = true;
      const sn = seen.get(session.session_id);
      if (sn) {
        emp.evCount = Math.max(emp.evCount, sn.n);
        if (sn.start) emp.sawStart = true;
      }
      if (emp.state === "LEAVING") {
        emp.returning = true;
        emp.lastEventAt = this.clock;
        continue;
      }
      if (session.waiting && emp.act !== "handup") {
        this.cutTrip(emp);
        this.setAct(emp, "handup", "❗");
      }
      const want = new Set(session.interns ?? []);
      for (const key of [...emp.interns.keys()]) if (!want.has(key)) this.removeIntern(emp, key);
      for (const agent of want)
        if (!emp.interns.has(agent))
          emp.interns.set(agent, newIntern(agent, "squire", this.clock, this.clock - 1, "snap"));
    }
    for (const emp of [...this.employees.values()])
      if (!ids.has(emp.id)) {
        emp.returning = false;
        this.leave(emp);
      }
    if (!this.log.length) for (const ev of [...(snap.events ?? [])]) this.pushLog(ev);
    if (snap.territory !== undefined) this.setTerritory(snap.territory, true);
    if (snap.attention !== undefined) this.setAttention(snap.attention);
    if (snap.receipts !== undefined) this.setReceipts(snap.receipts);
    this.hidVer++;
    this.dirty = true;
  }

  // ---------- events ----------
  private pushLog(evt: HookEvt) {
    const name = str(evt.hook_event_name);
    if (name === "PostToolUse") return;
    const sid = str(evt.session_id);
    if (!sid) return;
    const emp = this.employees.get(sid);
    const tag = "#" + sid.slice(0, TAG_LEN);
    const project = emp ? emp.project : projectOf(evt.cwd);
    let what: string;
    const tool = str(evt.tool_name);
    const detail = toolDetail(evt);
    let bad = false;
    if (name === "PreToolUse") what = `${tool} ${detail}`.trim();
    else if (name === "PostToolUseFailure") {
      what = `✗ ${tool} ${detail}`.trim();
      bad = true;
    } else if (name === "Notification") what = `Notification ${str(evt.notification_type)}`.trim();
    else if (name === "PermissionRequest") what = `PermissionRequest ${tool}`.trim();
    else if (name === "SessionEnd") what = `SessionEnd${str(evt.reason) ? " (" + str(evt.reason) + ")" : ""}`;
    else if (name === "PreCompact") what = `PreCompact ${str(evt.trigger)}`.trim();
    else what = name || "event";
    const who =
      evt.agent_id && name !== "SubagentStart" && name !== "SubagentStop"
        ? `${tag} › squire ${str(evt.agent_type) || "agent"}`
        : tag;
    const detailTxt =
      name === "SubagentStart" || name === "SubagentStop" ? `${name} ${str(evt.agent_type)}`.trim() : what;
    this.log.unshift({
      id: this.logSeq++,
      sid,
      color: lookFor(sid).shirt,
      bad,
      text: `${who} · ${project} · ${detailTxt}`,
      time: Date.now(),
      tag,
      project,
      intern: !!evt.agent_id && name !== "SubagentStart" && name !== "SubagentStop",
      internLabel: str(evt.agent_type) || "agent",
      kind: name === "PreToolUse" || name === "PostToolUseFailure" ? tool || name : name || "event",
      detail:
        name === "PreToolUse" || name === "PostToolUseFailure"
          ? detail
          : name === "Notification"
            ? str(evt.notification_type)
            : name === "SubagentStart" || name === "SubagentStop"
              ? str(evt.agent_type)
              : name === "PermissionRequest"
                ? tool
                : "",
    });
    if (this.log.length > LOG_MAX) this.log.length = LOG_MAX;
    this.dirty = true;
  }

  event(evt: HookEvt) {
    if (!evt || typeof evt !== "object") return;
    const sid = str(evt.session_id);
    const name = str(evt.hook_event_name);
    if (!sid) return;
    const nowMs = Date.now();
    for (const stamps of [this.ended, this.endedAgents])
      for (const [key, stamp] of stamps) if (nowMs - stamp > ENDED_TTL_S * MS_PER_SECOND) stamps.delete(key);
    if (name === "SessionStart") this.ended.delete(sid);
    else if (this.ended.has(sid)) return;
    const aid = str(evt.agent_id);
    if (aid) {
      if (name === "SubagentStart") this.endedAgents.delete(aid);
      else if (this.endedAgents.has(aid)) return;
    }
    let emp = this.employees.get(sid);

    if (name === "SessionEnd") {
      this.ended.set(sid, nowMs);
      this.pushLog(evt);
      if (emp) {
        emp.returning = false;
        this.leave(emp);
      }
      return;
    }
    if (name === "SessionStart" && emp) {
      emp.sawStart = true;
      if (emp.state === "LEAVING") {
        emp.returning = true;
        emp.lastEventAt = this.clock;
        this.pushLog(evt);
      }
      return;
    }
    const fresh = !emp;
    if (!emp) emp = this.spawn(sid, evt.cwd, false);
    if (name === "SessionStart") emp.sawStart = true;
    emp.evCount++;
    this.hidVer++;
    if (evt.cwd && (fresh || emp.project === "unknown")) {
      emp.cwd = evt.cwd;
      emp.project = projectOf(evt.cwd);
    }
    this.pushLog(evt);
    emp.lastEventAt = this.clock;
    if (name === "PostToolUseFailure" && EDIT_TOOLS.has(str(evt.tool_name))) this.editFailAt.set(sid, this.clock);
    if (emp.state === "LEAVING") {
      emp.returning = true;
      return;
    }

    const agentId = str(evt.agent_id);
    if (name === "SubagentStart" || name === "SubagentStop") {
      this.internLifecycle(emp, evt);
      return;
    }
    if (agentId) {
      this.internEvent(emp, evt);
      return;
    }

    // a hand going up is shown at once, even mid-walk (tavern or ally gate): the walk turns back, the rest queues as before
    if (this.isHandupEvt(evt) && this.cutTrip(emp)) {
      this.setAct(emp, "handup", "❗");
      return;
    }
    switch (emp.state) {
      case "SEATED":
        this.applyEvent(emp, evt);
        break;
      case "STRETCH":
        emp.state = "SEATED";
        this.applyEvent(emp, evt);
        break;
      case "DUEL": // never queued: apply state-only (no coffee walk), the adventurer keeps dueling; updateDuels() aborts on a ❗
        this.applyEvent(emp, evt, false);
        emp.coffeeAfter = name === "Stop";
        break;
      case "TO_COFFEE":
      case "DRINK":
        emp.state = "FROM_COFFEE";
        emp.path = [...emp.trail].reverse();
        emp.trail = [];
        emp.tempBubble = null;
        this.enqueue(emp, evt);
        break;
      case "TO_ALLY_GATE":
      case "IN_ALLY_GATE": // the session is moving again: cut the trip short and walk back
        emp.state = "FROM_ALLY_GATE";
        emp.path = [...emp.trail].reverse();
        emp.trail = [];
        emp.tempBubble = null;
        this.enqueue(emp, evt);
        break;
      default:
        this.enqueue(emp, evt);
    }
  }

  /** PermissionRequest, or a Notification that asks for permission (what applyEvent turns into a raised hand) */
  private isHandupEvt(evt: HookEvt): boolean {
    const name = str(evt.hook_event_name);
    if (name === "PermissionRequest") return true;
    return (
      name === "Notification" &&
      (HANDUP_NOTIFS.has(str(evt.notification_type)) || str(evt.message).toLowerCase().includes("permission"))
    );
  }
  /** Turn a tavern / ally gate walk around (back to the seat). True when the adventurer is on such a trip. */
  private cutTrip(emp: Employee): boolean {
    switch (emp.state) {
      case "TO_COFFEE":
      case "DRINK":
        emp.state = "FROM_COFFEE";
        break;
      case "TO_ALLY_GATE":
      case "IN_ALLY_GATE":
        emp.state = "FROM_ALLY_GATE";
        break;
      case "FROM_COFFEE":
      case "FROM_ALLY_GATE":
        return true;
      default:
        return false;
    }
    emp.path = [...emp.trail].reverse();
    emp.trail = [];
    emp.tempBubble = null;
    return true;
  }

  private enqueue(emp: Employee, evt: HookEvt) {
    emp.queue.push(evt);
    if (emp.queue.length > QUEUE_MAX) emp.queue.splice(0, emp.queue.length - QUEUE_MAX);
  }

  private setAct(emp: Employee, act: Act, bubble: string | null = null, note: Employee["note"] = null) {
    if (emp.act === "handup" && act !== "handup") {
      this.stats.waitS += this.realTime - emp.handAt;
      this.bumpStats();
    }
    if (act === "handup" && emp.act !== "handup") emp.handAt = this.realTime;
    if (emp.act !== act) emp.actSince = this.clock;
    emp.act = act;
    emp.bubble = bubble;
    emp.note = note;
    emp.tempBubble = null;
  }

  private applyEvent(emp: Employee, evt: HookEvt, coffee = true) {
    const name = str(evt.hook_event_name);
    const clock = this.clock;
    switch (name) {
      case "UserPromptSubmit":
        emp.hasPaper = true;
        emp.paperAt = clock;
        emp.sparkUntil = clock + SPARK_S;
        emp.toolCalls = 0;
        emp.qKills = 0;
        emp.qGold = 0;
        this.clearPending(emp);
        this.setAct(emp, "thinking");
        emp.nextThought = clock + rand(THOUGHT_MIN_S, THOUGHT_MAX_S);
        break;
      case "PreToolUse": {
        const tool = str(evt.tool_name);
        this.tools.add(tool);
        this.bumpStats();
        if (!AGENT_TOOLS.has(tool) && !USER_WAIT_TOOLS.has(tool)) {
          const id = str(evt.tool_use_id) || `#${this.pendSeq++}`;
          if (!emp.pending.has(id) && emp.pending.size >= MAX_PENDING)
            emp.pending.delete(emp.pending.keys().next().value as string);
          emp.pending.set(id, clock);
        }
        emp.windupUntil = clock + WINDUP_S;
        if (READ_TOOLS.has(tool)) this.setAct(emp, "reading", "📜");
        else if (EDIT_TOOLS.has(tool)) this.setAct(emp, "typing");
        else if (tool === "Bash") this.setAct(emp, "bash", "⚔️");
        else if (tool === "WebSearch" || tool === "WebFetch") this.setAct(emp, "phone", "🦉");
        else if (AGENT_TOOLS.has(tool)) this.setAct(emp, "thinking", "🛡️", "agent");
        else if (tool.startsWith("mcp__")) this.setAct(emp, "mcp", "🌀");
        else if (STICKY_TOOLS.has(tool)) {
          this.setAct(emp, "sticky", "📝");
          emp.sticky = true;
        } else this.setAct(emp, "typing");
        break;
      }
      case "PostToolUse": {
        this.setAct(emp, "thinking");
        emp.nextThought = clock + rand(THOUGHT_MIN_S, THOUGHT_MAX_S);
        this.donePending(emp, evt);
        emp.toolCalls++;
        this.onHit(emp, str(evt.tool_name));
        break;
      }
      case "PostToolUseFailure":
        this.setAct(emp, "thinking");
        emp.nextThought = clock + rand(THOUGHT_MIN_S, THOUGHT_MAX_S);
        this.donePending(emp, evt);
        emp.toolCalls++;
        this.onFail(emp);
        break;
      case "PermissionRequest":
        this.setAct(emp, "handup", "❗");
        break;
      case "PreCompact":
        this.onCompact(emp, coffee);
        break;
      case "Notification": {
        const nt = str(evt.notification_type);
        const msg = str(evt.message).toLowerCase();
        if (HANDUP_NOTIFS.has(nt) || msg.includes("permission")) this.setAct(emp, "handup", "❗");
        else if (nt === "idle_prompt") {
          this.clearPending(emp);
          this.setAct(emp, "thinking", "💤", "idle");
        } else emp.tempBubble = { e: "🔔", until: clock + 2 };
        break;
      }
      case "Stop":
        emp.hasPaper = false;
        this.setAct(emp, "thinking");
        this.clearPending(emp);
        if (emp.boss) this.bossLeaves(emp);
        if (emp.toolCalls >= QUEST_MIN_TOOLS) {
          this.addBanner("quest", m.banner_quest_done({ calls: emp.toolCalls, gold: emp.qGold }));
        }
        emp.toolCalls = 0;
        emp.qKills = 0;
        emp.qGold = 0;
        if (emp.hearts < MAX_HEARTS) {
          emp.hearts = MAX_HEARTS;
          for (let k = 0; k < HEART_COUNT; k++)
            this.emitP(
              emp.x - HEART_SPACING + k * HEART_SPACING,
              emp.y - HEART_LIFT,
              rand(-HEART_VX, HEART_VX),
              rand(-HEART_VY_MAX, -HEART_VY_MIN),
              0,
              HEART_LIFE,
              "#ff5a6a",
              1,
              "heart",
            );
        }
        if (coffee) {
          emp.state = "STRETCH";
          emp.stateSince = clock;
        }
        break;
      default:
        break;
    }
  }

  private pendSeq = 0;
  private clearPending(emp: Employee) {
    emp.pending.clear();
    if (emp.boss) this.bossLeaves(emp);
  }
  /** a tool finished: drop it from the in-flight set (by id, else the oldest keyless one) */
  private donePending(emp: Employee, evt: HookEvt) {
    const tool = str(evt.tool_name);
    if (AGENT_TOOLS.has(tool) || USER_WAIT_TOOLS.has(tool)) return;
    const id = str(evt.tool_use_id);
    if (id && emp.pending.delete(id)) return;
    for (const key of emp.pending.keys())
      if (key.startsWith("#") || !id) {
        emp.pending.delete(key);
        return;
      }
  }

  // ---------- combat / progression ----------
  private onHit(emp: Employee, tool: string) {
    const clock = this.clock;
    if (emp.boss) {
      this.bossDown(emp);
      return;
    }
    const mp = emp.monPos;
    const xp = 1 + Math.floor(Math.random() * XP_ROLL_MAX);
    if (mp && emp.deskIdx >= 0 && !emp.monDead && clock - emp.monAppearAt > MON_HITTABLE_AFTER_S) {
      const crit = Math.random() < CRIT_CHANCE;
      let dmg = HEAVY_TOOLS.has(tool) ? 2 : 1;
      if (crit) dmg *= 2;
      emp.monHp -= dmg;
      emp.flashUntil = clock + FLASH_S;
      emp.hsUntil = clock + HITSTOP_S;
      emp.hsAt = clock;
      emp.lungeUntil = clock + LUNGE_S;
      emp.monKnockUntil = clock + MON_KNOCK_S;
      emp.slashUntil = clock + SLASH_S;
      const hx = mp.x,
        hy = mp.y - MON_HIT_LIFT;
      this.pop(
        hx + rand(-DMG_POP_JITTER, DMG_POP_JITTER),
        hy - DMG_POP_LIFT,
        crit ? `${dmg}!` : `${dmg}`,
        crit ? "#ffe14a" : "#ffffff",
        crit,
        crit,
      );
      this.burst(
        hx,
        hy,
        HIT_SPARK_N,
        crit ? ["#ffe14a", "#ffffff", "#ff9a3a"] : ["#ffffff", "#f2c14e", "#ffb870"],
        crit ? HIT_SPARK_SPEED_CRIT : HIT_SPARK_SPEED,
      );
      if (crit) this.addTrauma(TRAUMA_CRIT);
      if (emp.monHp <= 0) this.killMonster(emp);
    }
    this.gainXp(emp, xp);
  }

  private killMonster(emp: Employee) {
    const mp = emp.monPos!;
    const gold = 1 + Math.floor(Math.random() * GOLD_ROLL_MAX);
    emp.kills++;
    emp.gold += gold;
    emp.qKills++;
    emp.qGold += gold;
    this.treasury += gold;
    this.stats.monsters++;
    this.bumpStats();
    this.defeatMonster(emp);
    this.pop(mp.x - XP_POP_DX, mp.y - XP_POP_LIFT, "+5xp", "#8ee8ff", false, false, LOOT_POP_DUR);
    this.pop(mp.x + GOLD_POP_DX, mp.y - GOLD_POP_LIFT, `+${gold}g`, "#f2c14e", false, false, LOOT_POP_DUR);
    for (let k = 0; k < COIN_COUNT; k++)
      this.emitP(
        mp.x + rand(-COIN_SPREAD_X, COIN_SPREAD_X),
        mp.y - COIN_LIFT,
        rand(-COIN_VX, COIN_VX),
        rand(-COIN_VY_MAX, -COIN_VY_MIN),
        COIN_GRAVITY,
        COIN_LIFE,
        "#f2c14e",
        1,
        "coin",
      );
    this.addTrauma(TRAUMA_KILL);
    this.gainXp(emp, KILL_XP);
  }

  private gainXp(emp: Employee, amount: number) {
    emp.xp += amount;
    let up = false;
    while (emp.xp >= xpNeed(emp.lv)) {
      emp.xp -= xpNeed(emp.lv);
      emp.lv++;
      up = true;
    }
    if (up) {
      emp.lvlAt = this.clock;
      emp.lvlTo = emp.lv;
      this.ring(
        emp.x,
        emp.y - FX_LEVELUP_RING.lift,
        FX_LEVELUP_RING.n,
        ["#f2c14e", "#ffffff", "#8ee8ff"],
        FX_LEVELUP_RING.speed,
        FX_LEVELUP_RING.life,
      );
      this.flash = 0.3;
    }
    this.touch(emp);
  }

  private loseHeart(emp: Employee) {
    emp.hearts = Math.max(0, emp.hearts - 1);
    emp.hurtUntil = this.clock + HURT_S;
    emp.redUntil = this.clock + RED_S;
    this.pop(emp.x - HURT_POP_DX, emp.y - HURT_POP_LIFT, "-1", "#ff5a5a", false, false, HURT_POP_DUR);
    this.burst(emp.x, emp.y - FX_HURT_BURST.lift, FX_HURT_BURST.n, ["#ff5a5a", "#ff9a9a"], FX_HURT_BURST.speed);
    this.addTrauma(TRAUMA_HURT);
  }

  private onFail(emp: Employee) {
    const clock = this.clock;
    emp.tempBubble = { e: "💥", until: clock + HURT_BUBBLE_S };
    if (emp.boss) {
      this.bossLeaves(emp);
      this.loseHeart(emp);
      return;
    }
    if (emp.monPos && emp.deskIdx >= 0 && !emp.monDead) emp.monLungeUntil = clock + MON_LUNGE_S;
    this.loseHeart(emp);
  }

  private spawnBoss(emp: Employee) {
    const kinds = BOSS_KINDS as readonly BossKind[];
    emp.boss = kinds[(h32(emp.id) + emp.monN) % kinds.length];
    emp.bossAt = this.clock;
    emp.bossReal = this.realTime;
    emp.monDead = false;
    emp.monAppearAt = this.clock;
    emp.monRespawnAt = Infinity;
    emp.monLoot = false;
    const pos = emp.monPos!;
    this.burst(
      pos.x + FX_MON_DEATH.dx,
      pos.y - FX_MON_DEATH.lift,
      FX_MON_DEATH.n,
      ["#ff5a5a", "#ffb870", "#6a2a7a"],
      FX_MON_DEATH.speed,
      FX_MON_DEATH.up,
      FX_MON_DEATH.life,
    );
    emp.bossPath = [];
    emp.bossFace = -1;
    if (!this.reducedMotion) {
      // the boss comes out of the dungeon gate and walks the bridge + road to the fight; monPos follows it
      emp.monPos = { x: GATE_MOUTH.x, y: GATE_MOUTH.y };
      emp.bossPath = routeBoss(emp.deskIdx);
      this.burst(
        GATE_MOUTH.x,
        GATE_MOUTH.y - FX_MON_DEATH.lift,
        GATE_BURST.n,
        GATE_COLS,
        GATE_BURST.speed,
        GATE_BURST.up,
        GATE_BURST.life,
        1,
        true,
      );
    }
    this.addBanner("boss", `BOSS! ${emp.boss.toUpperCase()}`);
    this.addTrauma(1);
    this.bumpStats();
  }

  private endBossFight(emp: Employee) {
    this.stats.longestBossS = Math.max(this.stats.longestBossS, this.realTime - emp.bossReal);
    emp.bossPath = [];
    emp.bossFace = -1;
    this.bumpStats();
  }

  private bossDown(emp: Employee) {
    const pos = emp.monPos!;
    emp.kills++;
    emp.gold += 10;
    emp.qKills++;
    emp.qGold += 10;
    this.treasury += 10;
    this.stats.bosses++;
    this.endBossFight(emp);
    emp.boss = null;
    emp.monDead = true;
    emp.monDeadAt = this.clock;
    emp.monLoot = true;
    emp.monRespawnAt = this.clock + BOSS_RESPAWN_S;
    this.pop(pos.x, pos.y - BOSS_POP_LIFT, "BOSS DOWN!", "#ffe14a", true, true, BOSS_POP_DUR);
    this.pop(pos.x - BOSS_XP_POP_DX, pos.y - BOSS_XP_POP_LIFT, "+25xp", "#8ee8ff", false, false, BOSS_POP_DUR);
    this.pop(pos.x + BOSS_GOLD_POP_DX, pos.y - BOSS_GOLD_POP_LIFT, "+10g", "#f2c14e", false, false, BOSS_POP_DUR);
    for (let k = 0; k < BOSS_COIN_COUNT; k++)
      this.emitP(
        pos.x + BOSS_COIN_DX + rand(-BOSS_COIN_SPREAD_X, BOSS_COIN_SPREAD_X),
        pos.y - BOSS_COIN_LIFT,
        rand(-BOSS_COIN_VX, BOSS_COIN_VX),
        rand(-BOSS_COIN_VY_MAX, -BOSS_COIN_VY_MIN),
        BOSS_COIN_GRAVITY,
        1.0,
        "#f2c14e",
        1,
        "coin",
      );
    this.burst(
      pos.x + FX_BOSS_BURST.dx,
      pos.y - FX_BOSS_BURST.lift,
      FX_BOSS_BURST.n,
      ["#ffe14a", "#ffffff", "#ff9a3a"],
      FX_BOSS_BURST.speed,
    );
    this.addTrauma(1);
    this.gainXp(emp, BOSS_XP);
  }

  /** boss runs away (tool failed / interrupted): no loot */
  private bossLeaves(emp: Employee) {
    this.endBossFight(emp);
    emp.boss = null;
    emp.monDead = true;
    emp.monDeadAt = this.clock;
    emp.monLoot = false;
    emp.monRespawnAt = this.clock + 2;
    if (emp.monPos)
      this.burst(
        emp.monPos.x + FX_MON_FLEE.dx,
        emp.monPos.y - FX_MON_FLEE.lift,
        FX_MON_FLEE.n,
        ["#cfd2de", "#6a2a7a"],
        FX_MON_FLEE.speed,
      );
  }

  // ---------- compact trip (ally gate) ----------
  /** can this adventurer walk to the ally gate now: seated, no fight in flight, nobody waiting on the user */
  private compactReady(emp: Employee): boolean {
    return (
      emp.state === "SEATED" &&
      (emp.deskIdx >= 0 || emp.slot >= 0) &&
      !emp.duel &&
      !emp.boss &&
      emp.pending.size === 0 &&
      emp.act !== "handup" &&
      !this.isWaiting(emp)
    );
  }

  /**
   * PreCompact: the ally gate's doorway glows. A free adventurer walks there, rests inside for a moment and walks
   * back (any event that arrives cuts the rest short). A busy one (tool in flight, boss, duel, hand up) stays put and
   * just gets the 💤 bubble. The mana bar is never touched: it follows the next real context reading.
   */
  private onCompact(emp: Employee, canWalk: boolean) {
    const walk = canWalk && !this.reducedMotion && this.compactReady(emp);
    this.allyGlowUntil = this.clock + ALLY_GLOW_S;
    emp.compactPending = true;
    this.setAct(emp, "thinking");
    if (!walk) {
      emp.tempBubble = { e: "💤", until: this.clock + COMPACT_BUBBLE_S };
      return;
    }
    const route = routeToAllyGate(emp.x, emp.y);
    emp.state = "TO_ALLY_GATE";
    emp.stateSince = this.clock;
    emp.trail = [{ x: emp.x, y: emp.y }];
    emp.path = route;
    emp.holdUntil = 0;
    this.dirty = true;
  }

  // ---------- interns (squires) ----------
  /** where squire number `slot` of this adventurer stands */
  private squireSpot(emp: Employee, slot: number): Pt {
    return emp.deskIdx >= 0 ? squirePoint(emp.deskIdx, slot) : campSquirePoint(emp.slot, slot);
  }

  /** squires that were standing out walk back into the ally gate (they never pile up: capped, the rest just vanish) */
  private sendSquiresHome(emp: Employee) {
    if (this.reducedMotion || this.isHidden(emp) || (emp.deskIdx < 0 && emp.slot < 0)) return;
    let slot = 0;
    for (const intern of emp.interns.values()) {
      if (slot++ >= SQUIRE_SLOTS) break;
      this.squireLeaves(intern);
    }
  }
  private squireLeaves(intern: Intern) {
    if (intern.phase === "wait" || intern.phase === "snap" || this.reducedMotion) return;
    if (this.leavers.length >= LEAVER_MAX) return;
    this.leavers.push({
      id: intern.id,
      x: intern.x,
      y: intern.y,
      face: intern.face,
      path: routeToAllyGate(intern.x, intern.y),
    });
  }
  private removeIntern(emp: Employee, id: string) {
    let slot = 0;
    for (const key of emp.interns.keys()) {
      if (key === id) break;
      slot++;
    }
    const intern = emp.interns.get(id);
    if (intern && slot < SQUIRE_SLOTS && !this.isHidden(emp)) this.squireLeaves(intern);
    emp.interns.delete(id);
  }

  private gatePuff() {
    this.allyDoorsUntil = this.clock + ALLY_DOORS_S;
    this.burst(
      ALLY_GATE_MOUTH.x,
      ALLY_GATE_MOUTH.y - GATE_PUFF.lift,
      GATE_PUFF.n,
      DUST_PUFF_COLS,
      GATE_PUFF.speed,
      GATE_PUFF.up,
      GATE_PUFF.life,
      1,
      true,
    );
  }

  /** Squires step out of the ally gate (staggered, capped) and walk to their master; finished ones walk back in. */
  private updateSquires(dt: number) {
    let walking = this.leavers.length;
    for (const emp of this.employees.values()) {
      if (emp.state === "LEAVING" || (emp.deskIdx < 0 && emp.slot < 0)) continue;
      const calm = this.reducedMotion || this.isHidden(emp); // no walk, no gate effects
      let slot = 0;
      for (const intern of emp.interns.values()) {
        if (slot >= SQUIRE_SLOTS) break; // the rest wait inside the gate (the +N badge counts them)
        const target = this.squireSpot(emp, slot++);
        if (intern.phase === "in") walking++;
        else if (intern.phase === "snap" || (intern.phase === "here" && calm)) {
          intern.x = target.x;
          intern.y = target.y;
          intern.phase = "here";
        } else if (intern.phase === "wait") {
          if (calm) intern.phase = "snap";
          else if (this.clock >= this.allyNextAt && walking < SQUIRE_WALK_MAX) {
            intern.x = ALLY_GATE_MOUTH.x;
            intern.y = ALLY_GATE_MOUTH.y;
            intern.path = routeFromAllyGate(target.x, target.y);
            intern.phase = "in";
            walking++;
            this.allyNextAt = this.clock + SQUIRE_STAGGER_S;
            this.gatePuff();
          }
        } else if (Math.hypot(target.x - intern.x, target.y - intern.y) > SQUIRE_SNAP_DIST) {
          // standing, but its slot moved (a squire before it left, or the master changed spot): walk over
          intern.path = [{ x: target.x, y: target.y }];
          intern.phase = "in";
          walking++;
        }
        if (intern.phase === "in") this.stepSquire(intern, target, dt);
      }
    }
    for (let i = this.leavers.length - 1; i >= 0; i--) {
      const leaver = this.leavers[i];
      this.stepWalker(leaver, dt);
      if (!leaver.path.length) {
        this.leavers.splice(i, 1);
        this.gatePuff();
      }
    }
  }
  private stepSquire(intern: Intern, target: Pt, dt: number) {
    if (intern.path.length) intern.path[intern.path.length - 1] = { x: target.x, y: target.y }; // the master may have moved
    this.stepWalker(intern, dt);
    if (!intern.path.length) {
      intern.x = target.x;
      intern.y = target.y;
      intern.phase = "here";
    }
  }
  private stepWalker(walker: { x: number; y: number; face: 1 | -1; path: Pt[] }, dt: number) {
    let rem = SQUIRE_SPEED * dt;
    while (rem > 0 && walker.path.length) {
      const target = walker.path[0];
      const dx = target.x - walker.x,
        dy = target.y - walker.y;
      const dist = Math.hypot(dx, dy);
      if (dx !== 0) walker.face = dx > 0 ? 1 : -1;
      if (dist <= rem) {
        walker.x = target.x;
        walker.y = target.y;
        rem -= dist;
        walker.path.shift();
      } else {
        walker.x += (dx / dist) * rem;
        walker.y += (dy / dist) * rem;
        rem = 0;
      }
    }
  }

  private internLifecycle(emp: Employee, evt: HookEvt) {
    const id = str(evt.agent_id);
    if (str(evt.hook_event_name) === "SubagentStart") {
      if (id && !emp.interns.has(id)) emp.interns.set(id, newIntern(id, str(evt.agent_type), this.clock));
    } else {
      if (id) this.endedAgents.set(id, Date.now());
      if (id && emp.interns.has(id)) this.removeIntern(emp, id);
      else if (!id) {
        const firstKey = emp.interns.keys().next();
        if (!firstKey.done) this.removeIntern(emp, firstKey.value);
      }
    }
    this.dirty = true;
  }

  private internEvent(emp: Employee, evt: HookEvt) {
    const id = str(evt.agent_id);
    const name = str(evt.hook_event_name);
    let intern = emp.interns.get(id);
    if (name === "PreToolUse") {
      if (!intern) {
        intern = newIntern(id, str(evt.agent_type), this.clock);
        emp.interns.set(id, intern);
      }
      const tn = str(evt.tool_name);
      this.tools.add(tn);
      this.bumpStats();
      intern.act = READ_TOOLS.has(tn) ? "reading" : "typing";
      intern.tool = tn;
      intern.detail = toolDetail(evt);
      intern.since = this.clock;
      intern.count++;
      intern.failed = false;
      this.dirty = true;
      return;
    }
    if (!intern) return;
    if (name === "PostToolUse" || name === "PostToolUseFailure") {
      intern.act = "idle";
      intern.since = this.clock;
      intern.failed = name === "PostToolUseFailure";
    } else if (name === "PermissionRequest") intern.act = "handup";
    else if (name === "Notification") {
      if (HANDUP_NOTIFS.has(str(evt.notification_type)) || str(evt.message).toLowerCase().includes("permission"))
        intern.act = "handup";
    }
  }
}
