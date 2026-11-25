// Pure helpers of the Void Sanctum visuals (no canvas): the pixel-block wipe, the boss bar layout, caption sizing and
// which boss form / sprite stage a state shows. Kept out of the drawing files so the numbers here are named.
import { GLYPH_H, measurePixelText } from "./pixelFont";
import type { VoidForm } from "./voidBossSprite";
import {
  VOID_ARENA_X0,
  VOID_ARENA_X1,
  VOID_ARENA_Y0,
  VOID_ARENA_Y1,
  VOID_ASCEND_S,
  VOID_DYING_S,
  VOID_EYE_CRACK_S,
  VOID_EYE_SHATTER_S,
  VOID_HAND_RISE_S,
  VOID_HAND_SINK_S,
  VOID_HAND_SLAM_S,
  VOID_PHASE2_BELOW,
  VOID_PHASE3_BELOW,
  VOID_ROAR_ATTACK_S,
  voidTelegraphS,
} from "./voidFight";
import type { VoidHandState, VoidPhase, VoidState } from "./voidTypes";

// ---- the pixel-block wipe -------------------------------------------------------------------------------------------
/** one wipe block is this many px square */
export const WIPE_BLOCK_PX = 12;
const WIPE_MID = 0.5;
const WIPE_SPIRAL_WEIGHT = 0.12;
const WIPE_DIAMOND_WEIGHT = 0.4;
const WIPE_JITTER = 0.06;
const WIPE_T_MAX = 0.999;
const WIPE_SWIRL_GAIN = 10;
const PIPS_ALL = 3;
const NAME_TYPE_S = 0.9;
const HASH_A = 127.1;
const HASH_B = 311.7;
const HASH_C = 43758.5453;
const TURN = Math.PI * 2;

/** deterministic 0..1 noise of an integer pair */
export const noise2 = (col: number, row: number): number => {
  const raw = Math.sin(col * HASH_A + row * HASH_B) * HASH_C;
  return raw - Math.floor(raw);
};

const wipeMetric = (col: number, row: number, originCol: number, originRow: number): number => {
  const dCol = col - originCol,
    dRow = row - originRow;
  const ring =
    Math.max(Math.abs(dCol), Math.abs(dRow)) * (1 - WIPE_DIAMOND_WEIGHT) +
    (Math.abs(dCol) + Math.abs(dRow)) * WIPE_DIAMOND_WEIGHT;
  const swirl =
    ((Math.atan2(dRow, dCol) + Math.PI) / TURN) *
    WIPE_SPIRAL_WEIGHT *
    Math.max(1, ring) *
    WIPE_JITTER *
    WIPE_SWIRL_GAIN;
  return ring + swirl;
};

/**
 * When block (col, row) of a cols x rows grid is reached by the wipe spreading from (originCol, originRow): 0 = the
 * origin block, just under 1 = the farthest corner. A diamond/square blend with a slight spiral and jitter.
 */
let farKey = "";
let farValue = 0;
const farCorner = (cols: number, rows: number, originCol: number, originRow: number): number => {
  const key = `${cols}|${rows}|${originCol}|${originRow}`;
  if (key !== farKey) {
    farKey = key;
    farValue = Math.max(
      wipeMetric(0, 0, originCol, originRow),
      wipeMetric(cols - 1, 0, originCol, originRow),
      wipeMetric(0, rows - 1, originCol, originRow),
      wipeMetric(cols - 1, rows - 1, originCol, originRow),
    );
  }
  return farValue;
};
export const wipeBlockT = (
  col: number,
  row: number,
  cols: number,
  rows: number,
  originCol: number,
  originRow: number,
): number => {
  const far = farCorner(cols, rows, originCol, originRow);
  const base = far > 0 ? wipeMetric(col, row, originCol, originRow) / far : 0;
  return Math.min(WIPE_T_MAX, Math.max(0, base * (1 - WIPE_JITTER) + noise2(col, row) * WIPE_JITTER));
};

/**
 * Is a block with arrival time `blockT` covered at wipe progress 0..1? Nothing at 0 and 1, every block at the
 * midpoint: the first half fills the blocks from the origin out, the second half clears them in the same order.
 */
export const wipeBlockCovered = (progress: number, blockT: number): boolean => {
  if (!(progress > 0) || progress >= 1) return false;
  return progress <= WIPE_MID ? blockT < progress * 2 : blockT >= (progress - WIPE_MID) * 2;
};

/** blocks covered at `progress` over a cols x rows grid (test and coverage helper) */
export const wipeCoveredCount = (
  progress: number,
  cols: number,
  rows: number,
  originCol: number,
  originRow: number,
): number => {
  let count = 0;
  for (let row = 0; row < rows; row++)
    for (let col = 0; col < cols; col++)
      if (wipeBlockCovered(progress, wipeBlockT(col, row, cols, rows, originCol, originRow))) count++;
  return count;
};

/** wipe progress 0..1 of a transition that is `age` seconds old and `length` seconds long */
export const wipeProgress = (age: number, length: number): number =>
  length > 0 ? Math.min(1, Math.max(0, age / length)) : 0;

// ---- the boss bar -----------------------------------------------------------------------------------------------------
export const BAR_SEGMENTS = 40;
export const BAR_SEG_PX = 5;
const SEG_EPSILON = 1e-6;
/** lit segments for a fraction 0..1 (a living boss always shows at least one) */
export const barLitSegments = (fill: number, segs = BAR_SEGMENTS, alive = true): number => {
  const clamped = Math.min(1, Math.max(0, Number.isFinite(fill) ? fill : 0));
  const lit = Math.ceil(clamped * segs - SEG_EPSILON);
  return alive ? Math.max(1, lit) : Math.max(0, lit);
};
/** the panel's outer width for a bar of `segs` segments of BAR_SEG_PX (gap included) */
export const BAR_PANEL_PAD = 24;
export const barPanelWidth = (segs = BAR_SEGMENTS): number => segs * BAR_SEG_PX - 1 + BAR_PANEL_PAD;

/** how many of the three phase pips are lit */
export const phasePips = (phase: VoidPhase): number => {
  switch (phase) {
    case "reveal":
    case "fight":
      return 1;
    case "phase2":
      return 2;
    case "phase3":
    case "dying":
    case "retreat":
      return PIPS_ALL;
    default:
      return 0;
  }
};

// ---- which sprite -------------------------------------------------------------------------------------------------------
/** form 1 = veiled (phase 1), 2 = torn veil (only the mid-frame of the phase 2 transformation), 3 = TRUE FORM */
const FORM_TRUE: VoidForm = 3;
/** the boss form for a hp fraction (used when only the fraction is known, like the retreat fade) */
export const formOfHp = (hpFrac: number): VoidForm => (hpFrac > VOID_PHASE2_BELOW ? 1 : FORM_TRUE);
/**
 * the form shown in `phase`: veiled in phase 1, the TRUE FORM from phase 2 on. In phase 3 the true form only appears
 * for the ascend (it rises into the sky eye) and for a death that is not the colossus's; then the colossus takes over.
 */
export const formOfPhase = (phase: VoidPhase, hpFrac: number): VoidForm =>
  phase === "phase2" || phase === "phase3" || phase === "dying"
    ? FORM_TRUE
    : phase === "fight" || phase === "reveal"
      ? 1
      : formOfHp(hpFrac);

const DITHER_STEPS = 8;
/** dither level 0..8 of a fade that is `progress` (0..1) of the way out */
export const ditherLevelOf = (progress: number): number =>
  Math.min(DITHER_STEPS, Math.max(0, Math.round(progress * DITHER_STEPS)));

// ---- captions -----------------------------------------------------------------------------------------------------------
/** the biggest integer scale (down to 1) at which `text` fits `maxWidth` px */
export const captionScale = (text: string, maxWidth: number, maxScale: number): number => {
  for (let scale = Math.max(1, Math.floor(maxScale)); scale > 1; scale--)
    if (measurePixelText(text, scale) <= maxWidth) return scale;
  return 1;
};

// ---- shatter / reveal timing --------------------------------------------------------------------------------------------
/** the Lord cracks for this long, then bursts */
export const SHATTER_CRACK_S = 0.9;
/** the name card is up between these ages of the reveal */
export const NAME_FROM_S = 1.5;
export const NAME_TO_S = 3.3;
/** the boss lands this long into the reveal; before that it descends */
export const DESCEND_S = 1.8;
const DESCEND_HEIGHT = 90;
/** height above its feet the boss is while descending (0 once landed) */
export const descendLift = (age: number): number => {
  const ratio = Math.min(1, Math.max(0, age / DESCEND_S));
  return Math.round((1 - ratio) * (1 - ratio) * DESCEND_HEIGHT);
};
/** letters of a name card shown at `age` (types in over NAME_TYPE_S from NAME_FROM_S) */
export const nameLetters = (age: number, total: number): number => {
  const ratio = Math.min(1, Math.max(0, (age - NAME_FROM_S) / NAME_TYPE_S));
  return Math.ceil(ratio * total);
};

// ---- strikes: a raider's hit reaching the boss ----------------------------------------------------------------------------------
export const STRIKE_S = 0.14;
export const SLASH_S = 0.22;
export const HIT_FX_S = 0.7;
export const FLINCH_S = 0.1;
export const FLINCH_PX = 3;
export const OUTLINE_BLINK_S = 0.1;
const SLASH_RADIUS = 24;
const SLASH_SWEEP = 2.2;
const SLASH_TILT = 0.5;
const SLASH_WOBBLE = 4;
const NUMBER_RISE_PX = 26;
const CRIT_SCALE = 3;
const HIT_SCALE = 2;

/** the point a fraction `ratio` (0..1) of the way from (fromX, fromY) to (toX, toY) */
export const lerpPoint = (
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  ratio: number,
): { x: number; y: number } => ({
  x: fromX + (toX - fromX) * ratio,
  y: fromY + (toY - fromY) * ratio,
});

/** how far the strike line has travelled 0..1 `age` seconds after the hit (it arrives at STRIKE_S) */
export const strikeReach = (age: number): number => Math.min(1, Math.max(0, age / STRIKE_S));

/** a point of the slash arc through the impact: `ratio` 0..1 along it, `dir` = -1 (hitter on the left) or 1 */
export const slashPoint = (centerX: number, centerY: number, ratio: number, dir: number): { x: number; y: number } => {
  const angle = -SLASH_SWEEP / 2 + SLASH_SWEEP * ratio;
  return {
    x: centerX - dir * Math.cos(angle) * SLASH_RADIUS * SLASH_TILT + Math.sin(angle) * SLASH_WOBBLE,
    y: centerY + Math.sin(angle) * SLASH_RADIUS,
  };
};

/** damage number: the scale (2, crit 3), its rise in px and whether it is still up `age` seconds after the hit */
export const hitNumberAt = (age: number, crit: boolean): { scale: number; rise: number; shown: boolean } => ({
  scale: crit ? CRIT_SCALE : HIT_SCALE,
  rise: Math.round(Math.min(1, Math.max(0, age / HIT_FX_S)) * NUMBER_RISE_PX),
  shown: age >= 0 && age < HIT_FX_S,
});

/** the boss's flinch: px of push away from the hitter (dir = which side the push goes) `age` seconds after the hit */
export const flinchPx = (age: number, dir: number): number => (age >= 0 && age < FLINCH_S ? dir * FLINCH_PX : 0);

// ---- warning zones ----------------------------------------------------------------------------------------------------------------
const ZONE_BEAM_HALF = 16;
const ZONE_BEAM_PULSE = 3;
const ZONE_BEAM_TAIL = 30;
const ZONE_BEAM_START = 20;
const ZONE_BEAM_ROW_DY = -8;
const ZONE_SPOT_W = 34;
const ZONE_SPOT_H = 20;
const ZONE_PULSE_HZ = 6;
const ZONE_SPOT_PULSE = 0.12;
export interface Zone {
  x: number;
  y: number;
  width: number;
  height: number;
}
/** the big striped warning rect of a beam: from the boss to past the arena's left edge, pulsing in thickness */
export const beamZone = (bossX: number, targetY: number, arenaX0: number, time: number): Zone => {
  const half = ZONE_BEAM_HALF + Math.round(Math.sin(time * ZONE_PULSE_HZ) * ZONE_BEAM_PULSE);
  const left = arenaX0 - ZONE_BEAM_TAIL;
  return { x: left, y: targetY + ZONE_BEAM_ROW_DY - half, width: bossX - ZONE_BEAM_START - left, height: half * 2 + 1 };
};
/** the warning rect on the floor spot an eye bolt or a blink lands on */
export const spotZone = (cx: number, cy: number, time: number, grow = 1): Zone => {
  const pulse = 1 + Math.sin(time * ZONE_PULSE_HZ) * ZONE_SPOT_PULSE;
  const width = Math.round(ZONE_SPOT_W * pulse * grow),
    height = Math.round(ZONE_SPOT_H * pulse * grow);
  return { x: Math.round(cx - width / 2), y: Math.round(cy - height / 2), width, height };
};

// ---- screen bands: banners, name card, voice and bar never overlap ------------------------------------------------------------
export const BANNER_BAND_Y = 22;
export const BANNER_BAND_H = 18;
export const SIDE_BAND_Y = 46;
export const SIDE_BAND_H = 34;
/** the boss bar's panel top (a slim 26 px panel: it ends at 214, inside the 216 px world) */
export const BAR_TOP = 188;
/** the voice caption band sits just above this row (the old bar top), clear of the stand row's feet */
const VOICE_ANCHOR = 182;
export const VOICE_BAND_H = 14;
const VOICE_GAP = 4;
export interface Band {
  y: number;
  height: number;
}
/** the vertical bands of the overlays: banner (top), side cards (left, below it), voice caption (just above the bar) */
export const overlayBands = (): { banner: Band; side: Band; voice: Band } => ({
  banner: { y: BANNER_BAND_Y, height: BANNER_BAND_H },
  side: { y: SIDE_BAND_Y, height: SIDE_BAND_H },
  voice: { y: VOICE_ANCHOR - VOICE_GAP - VOICE_BAND_H, height: VOICE_BAND_H },
});
export const bandsOverlap = (first: Band, second: Band): boolean =>
  first.y < second.y + second.height && second.y < first.y + first.height;

const PLAQUE_PAD_X = 8;
const PLAQUE_PAD_Y = 6;
const PLAQUE_GAP = 4;
/**
 * A plate sized for a big word and a small line under it, both drawn at integer scales: the title scale shrinks until
 * both fit `maxWidth`; returns the plate rect size and where the texts start inside it.
 */
export const plaqueLayout = (
  title: string,
  line: string,
  maxWidth: number,
  maxScale: number,
): { scale: number; plateW: number; plateH: number; titleX: number; titleY: number; lineY: number } => {
  const lineW = measurePixelText(line, 1);
  let scale = Math.max(1, Math.floor(maxScale));
  while (scale > 1 && Math.max(measurePixelText(title, scale), lineW) + PLAQUE_PAD_X * 2 > maxWidth) scale--;
  const titleW = measurePixelText(title, scale);
  const plateW = Math.max(titleW, lineW) + PLAQUE_PAD_X * 2;
  const titleH = GLYPH_H * scale;
  return {
    scale,
    plateW,
    plateH: PLAQUE_PAD_Y * 2 + titleH + PLAQUE_GAP + GLYPH_H,
    titleX: Math.round((plateW - titleW) / 2),
    titleY: PLAQUE_PAD_Y,
    lineY: PLAQUE_PAD_Y + titleH + PLAQUE_GAP,
  };
};

/** `text` clipped to `maxWidth` px at `scale` with an ellipsis (for floor captions in the canvas) */
export const clipPixelText = (text: string, maxWidth: number, scale = 1): string => {
  if (measurePixelText(text, scale) <= maxWidth) return text;
  let out = text;
  while (out.length > 1 && measurePixelText(`${out}...`, scale) > maxWidth) out = out.slice(0, -1);
  return `${out}...`;
};

// ---- raider knockback ----------------------------------------------------------------------------------------------------------------
export const KNOCK_S = 0.28;
const KNOCK_PX = 8;
/** horizontal px a raider is thrown `age` seconds after an attack landed on it (dir = -1 left, 1 right); 0 once settled */
export const knockDx = (age: number, dir: number): number => {
  if (!(age >= 0) || age >= KNOCK_S) return 0;
  const ratio = age / KNOCK_S;
  return Math.round(dir * KNOCK_PX * Math.sin(ratio * Math.PI)) + 0;
};

// ---- phase 3: THE VOID AWAKENS ----------------------------------------------------------------------------------------------------
/** the sky eye of phase 2 (it flies into the colossus's chest during the ascend) */
export const COLOSSUS_EYE_X = 160;
export const COLOSSUS_EYE_Y = 50;
/** the colossus is the true form, enlarged in three steps; its chest eye (the core) sits at this row, behind the arena */
export const COLOSSUS_CHEST_Y = 120;
/** where the chest eye is in the phase 2 true form (1.5x, hem at 192): the ascend starts from there */
export const COLOSSUS_START_Y = 108;
/** half the painted chest eye's height (rows): the eye's lower edge is CHEST_Y + this * scale, clear of the front-edge raider spots */
export const COLOSSUS_EYE_HALF_H = 11;
/** the boss, its cinematics, the colossus's hands and arms are y-sorted at this row: behind every raider */
export const VOID_BOSS_SORT_Y = -1;
/** the transformation shockwave: seconds it runs and how far it reaches (px) */
export const PUSHBACK_S = 0.9;
export const PUSHBACK_REACH = 260;
export const pushbackRadius = (age: number): number =>
  age >= 0 && age < PUSHBACK_S ? (age / PUSHBACK_S) * PUSHBACK_REACH : -1;
export const COLOSSUS_SCALE_A = 1.5;
export const COLOSSUS_SCALE_B = 2;
export const COLOSSUS_SCALE_C = 2.5;
export const COLOSSUS_SCALES: readonly number[] = [COLOSSUS_SCALE_A, COLOSSUS_SCALE_B, COLOSSUS_SCALE_C];
/** the painted chest eye centre in the 160x128 true form, and its shoulders (offsets from it, in painted px) */
export const COLOSSUS_PAINT_CHEST_X = 80;
export const COLOSSUS_PAINT_CHEST_Y = 72;
export const COLOSSUS_SHOULDER_DX = 19;
export const COLOSSUS_SHOULDER_DY = -18;
const clamp01 = (value: number): number => Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0));
const SMOOTH_A = 3;
const SMOOTH_B = 2;
const smooth = (value: number): number => {
  const tick = clamp01(value);
  return tick * tick * (SMOOTH_A - SMOOTH_B * tick);
};
/** 0..1 through the window [from, to] (fractions of the ascend) at `ratio` */
const windowAt = (ratio: number, from: number, to: number): number => clamp01((ratio - from) / (to - from));

/** the ascend cinematic as parallel 0..1 beats (fractions of VOID_ASCEND_S) */
export interface AscendBeat {
  /** the true form grows (1.5x -> 2x -> 2.5x) and settles into place */
  rise: number;
  /** the sky eye flies into its chest */
  merge: number;
  /** the broken floor falls away, only the shards under the raiders stay */
  split: number;
  /** the whole ascend, 0..1 */
  all: number;
}
const BEAT_RISE_END = 0.5;
const BEAT_MERGE_FROM = 0.3;
const BEAT_MERGE_TO = 0.5;
const BEAT_SPLIT_FROM = 0.45;
const BEAT_SPLIT_TO = 0.95;
const GROW_B_AT = 0.14;
const GROW_C_AT = 0.28;
/** the beats `age` seconds after the ascend began (all 1 once it is over) */
export const ascendBeat = (age: number, out: AscendBeat): AscendBeat => {
  const ratio = clamp01(age / VOID_ASCEND_S);
  out.rise = windowAt(ratio, 0, BEAT_RISE_END);
  out.merge = windowAt(ratio, BEAT_MERGE_FROM, BEAT_MERGE_TO);
  out.split = windowAt(ratio, BEAT_SPLIT_FROM, BEAT_SPLIT_TO);
  out.all = ratio;
  return out;
};
/** the beats of the finished ascend (reduced motion, and everything after the first four seconds) */
export const ASCEND_DONE: AscendBeat = { rise: 1, merge: 1, split: 1, all: 1 };

export interface ColossusPlace {
  /** the chest eye's centre and the index into COLOSSUS_SCALES */
  x: number;
  y: number;
  step: number;
}
/** where the colossus's chest is and how big it is: it grows in steps while it settles onto the core's x */
export const colossusPlace = (beat: AscendBeat, bossX: number, chestX: number, out: ColossusPlace): ColossusPlace => {
  const move = smooth(beat.rise);
  out.x = bossX + (chestX - bossX) * move;
  out.y = COLOSSUS_START_Y + (COLOSSUS_CHEST_Y - COLOSSUS_START_Y) * move;
  out.step = beat.all >= GROW_C_AT ? COLOSSUS_SCALES.length - 1 : beat.all >= GROW_B_AT ? 1 : 0;
  return out;
};
/** the sky eye flying into the chest: its centre and size factor `merge` 0..1 of the way in */
export const eyeFlight = (
  merge: number,
  chest: { x: number; y: number },
  out: { x: number; y: number; scale: number },
) => {
  const tick = smooth(merge);
  out.x = COLOSSUS_EYE_X + (chest.x - COLOSSUS_EYE_X) * tick;
  out.y = COLOSSUS_EYE_Y + (chest.y - COLOSSUS_EYE_Y) * tick;
  out.scale = 1 - (1 - EYE_FLIGHT_END) * tick;
};
const EYE_FLIGHT_END = 0.12;

// ---- the shards of the broken floor ----------------------------------------------------------------------------------------------
/** raiders stand within SHARD_FREE_R of this point; shards inside it hardly move so the raiders stay on them */
export const SHARD_HOME_X = 210;
export const SHARD_HOME_Y = 125;
export const SHARD_FREE_R = 56;
const SHARD_RANGE = 130;
export const SHARD_NEAR_PX = 4;
export const SHARD_FAR_PX = 34;
const SHARD_ROW_SQUASH = 1.5;
/** how far (px) a shard centred at (cx, cy) has drifted once the floor has split `split` (0..1); away from the arena */
export const shardDrift = (cx: number, cy: number, split: number, out: { x: number; y: number }) => {
  const dx = cx - SHARD_HOME_X,
    dy = (cy - SHARD_HOME_Y) * SHARD_ROW_SQUASH;
  const dist = Math.hypot(dx, dy);
  const reach = SHARD_NEAR_PX + (SHARD_FAR_PX - SHARD_NEAR_PX) * clamp01((dist - SHARD_FREE_R) / SHARD_RANGE);
  const ease = smooth(split);
  const inv = dist > 0 ? 1 / dist : 0;
  out.x = dx * inv * reach * ease;
  out.y = (dy / SHARD_ROW_SQUASH) * inv * reach * ease;
};
/** the floor that stays under the raiders: an ellipse (rx, ry) around the raiders' home; every other shard falls into the abyss */
const KEEP_RX = 66;
const KEEP_RY = 40;
export const shardStays = (cx: number, cy: number): boolean =>
  ((cx - SHARD_HOME_X) / KEEP_RX) ** 2 + ((cy - SHARD_HOME_Y) / KEEP_RY) ** 2 <= 1;
const FALL_DELAY_MAX = 0.55;
const FALL_DELAY_RANGE = 220;
/** a falling shard lets go this fraction of the split later the nearer it is to the raiders (0..FALL_DELAY_MAX) */
export const shardFallDelay = (cx: number, cy: number): number =>
  FALL_DELAY_MAX * (1 - clamp01(Math.hypot(cx - SHARD_HOME_X, cy - SHARD_HOME_Y) / FALL_DELAY_RANGE));
/** 0..1 of a shard's own fall at the floor's `split`, given its delay */
export const shardFallProgress = (split: number, delay: number): number => clamp01((split - delay) / (1 - delay));

// ---- the colossus's hands ------------------------------------------------------------------------------------------------------------
export const HAND_W = 72;
export const HAND_H = 84;
/** the hand's palm centre this far above the floor point it works on when it slams (claws touch the floor) */
export const HAND_REACH = 34;
/** how high above the floor point the hand is raised in the windup */
export const HAND_RAISE = 108;
const HAND_SINK_DROP = 120;
const HAND_RISE_FROM = 150;
const HAND_RECOVER_S = 0.45;
const HAND_RECOVER_DROP = 90;
const HAND_BOB_PX = 3;
const HAND_BOB_HZ = 1.7;
const HAND_CLAW_AT = 0.3;
const MIN_WINDUP_S = 0.1;
/** the raised hand keeps to its own side of the arena (this share of the way to the target) so it never covers the mask face */
const WINDUP_SIDE = 0.35;
const SINK_OPEN_AT = 0.5;
const STILL_SINK_AT = 0.3;
export interface HandPlace {
  x: number;
  y: number;
  /** the claw pose (fingers down) instead of the open hand */
  claw: boolean;
  /** 0..1 how far through the slam (1 = the impact frame) */
  slam: number;
}
/**
 * where a hand is (palm centre) and which pose it shows. `home` is where it hovers; for windup / slam / sink the hand's
 * own x, y is the floor point it works on. `windupS` is how long the windup lasts; `fromSink` = the previous state was
 * the sink (the hand climbs back from below).
 */
export const handPlace = (
  hand: { state: VoidHandState; x: number; y: number; at: number },
  home: { x: number; y: number },
  time: number,
  windupS: number,
  still: boolean,
  fromSink: boolean,
  out: HandPlace,
): HandPlace => {
  // reduced motion holds each state's key pose: risen, raised, slammed, half sunk
  const age = still
    ? hand.state === "rise"
      ? VOID_HAND_RISE_S
      : hand.state === "windup"
        ? windupS
        : hand.state === "slam"
          ? VOID_HAND_SLAM_S
          : VOID_HAND_SINK_S * STILL_SINK_AT
    : time - hand.at;
  out.claw = false;
  out.slam = 0;
  out.x = home.x;
  out.y = home.y;
  if (hand.state === "rise") {
    out.y = home.y + (1 - smooth(age / VOID_HAND_RISE_S)) * (HAND_RISE_FROM + HAND_H);
  } else if (hand.state === "hover") {
    const bob = still ? 0 : Math.sin(time * HAND_BOB_HZ + home.x) * HAND_BOB_PX;
    const recover = fromSink && !still ? (1 - smooth(age / HAND_RECOVER_S)) * HAND_RECOVER_DROP : 0;
    out.y = home.y + bob + recover;
  } else if (hand.state === "windup") {
    const tick = smooth(age / Math.max(MIN_WINDUP_S, windupS));
    out.x = home.x + (hand.x - home.x) * tick * WINDUP_SIDE;
    out.y = home.y + (hand.y - HAND_RAISE - home.y) * tick;
    out.claw = tick > HAND_CLAW_AT;
  } else if (hand.state === "slam") {
    const tick = clamp01(age / VOID_HAND_SLAM_S);
    const raisedX = home.x + (hand.x - home.x) * WINDUP_SIDE;
    out.x = raisedX + (hand.x - raisedX) * tick;
    out.y = hand.y - HAND_RAISE + (HAND_RAISE - HAND_REACH) * tick * tick;
    out.claw = true;
    out.slam = tick;
  } else {
    const tick = smooth(age / VOID_HAND_SINK_S);
    out.x = hand.x + (home.x - hand.x) * tick;
    out.y = hand.y - HAND_REACH + (home.y + HAND_SINK_DROP - (hand.y - HAND_REACH)) * tick;
    out.claw = tick < SINK_OPEN_AT;
  }
  return out;
};
/** the windup length of a hand attack (the telegraph) */
export const handWindupS = (): number => voidTelegraphS("hand", "phase3");

// ---- the gaze ----------------------------------------------------------------------------------------------------------------------
export const GAZE_HALF_W = 9;
/** the beam from the chest eye ends on the floor at this row */
export const GAZE_FLOOR_Y = 134;
/** the floor column of the gaze beam at `gx`: it spans the whole depth of the arena */
export const gazeColumn = (gx: number): Zone => ({
  x: Math.round(gx - GAZE_HALF_W),
  y: VOID_ARENA_Y0,
  width: GAZE_HALF_W * 2 + 1,
  height: VOID_ARENA_Y1 - VOID_ARENA_Y0,
});
/** a point `ratio` (0..1) of the way along the beam from the chest eye (originX, originY) to the floor column `gx` */
export const gazeBeamPoint = (
  originX: number,
  originY: number,
  gx: number,
  ratio: number,
  out: { x: number; y: number },
) => {
  out.x = originX + (gx - originX) * ratio;
  out.y = originY + (GAZE_FLOOR_Y - originY) * ratio;
};
/** the arena's left / right edge the gaze sweeps between */
export const GAZE_LEFT = VOID_ARENA_X0;
export const GAZE_RIGHT = VOID_ARENA_X1;

// ---- the chest eye (the core) ----------------------------------------------------------------------------------------------------------
const CORE_PULSE_S = 0.35;
const CORE_PULSE_GAIN = 0.45;
/** the chest eye's corona size factor `sinceHit` seconds after a raider's strike (a pulse that settles) */
export const corePulse = (sinceHit: number): number =>
  sinceHit >= 0 && sinceHit < CORE_PULSE_S ? 1 + CORE_PULSE_GAIN * (1 - sinceHit / CORE_PULSE_S) : 1;
/** the damage numbers on the colossus are one scale bigger */
export const COLOSSUS_NUMBER_BONUS = 1;

// ---- the death of the colossus -------------------------------------------------------------------------------------------------------
export interface DeathBeat {
  /** the face cracks (0..1) */
  crack: number;
  /** the glass falls away (0..1) */
  shatter: number;
  /** the final flash (0..1) */
  flash: number;
}
/** the beats of the eye-shatter death `age` seconds after the last hit */
export const deathBeat = (age: number, out: DeathBeat): DeathBeat => {
  out.crack = clamp01(age / VOID_EYE_CRACK_S);
  out.shatter = clamp01((age - VOID_EYE_CRACK_S) / (VOID_EYE_SHATTER_S - VOID_EYE_CRACK_S));
  out.flash = clamp01((age - VOID_EYE_SHATTER_S) / (VOID_DYING_S - VOID_EYE_SHATTER_S));
  return out;
};
const FALL_PX = 260;
const FALL_BASE = 0.55;
const FALL_SPREAD = 0.9;
/** how far (px) a face fragment with random `rnd` 0..1 has fallen `shatter` (0..1) into the shatter stage; it accelerates */
export const fragmentFall = (shatter: number, rnd: number): number =>
  Math.round(shatter * shatter * FALL_PX * (FALL_BASE + FALL_SPREAD * rnd));

// ---- phase 3 punch: the eye's reaction, crack stages, the heavy moves ---------------------------------------------------------------
export const HIT_RECOIL_S = 0.15;
export const HIT_RECOIL_PX = 3;
export const CRIT_RECOIL_S = 0.26;
export const CRIT_RECOIL_PX = 6;
export const SQUINT_S = 0.2;
export const CRIT_SQUINT_S = 0.34;
/** squint steps of the cached eye sprites: 0 open .. SQUINT_LEVELS shut */
export const SQUINT_LEVELS = 3;
export const CRIT_FLASH_S = 0.16;
export const CRIT_SHARD_S = 0.55;
export const CRIT_SHARDS = 16;
const RECOIL_PEAK = 0.3;

/** 0..1 jolt profile: a fast kick out to the peak, a slower settle */
export const recoilProfile = (age: number, duration: number): number => {
  if (!(age >= 0) || age >= duration) return 0;
  const ratio = age / duration;
  return ratio < RECOIL_PEAK ? ratio / RECOIL_PEAK : 1 - (ratio - RECOIL_PEAK) / (1 - RECOIL_PEAK);
};
export interface EyeReaction {
  /** 0..1 lids closed / iris contracted */
  squint: number;
  /** px the whole colossus is kicked up (positive = up) */
  recoil: number;
  /** 0..1 the opaque flash band over the eye after a crit (1 = just landed) */
  flash: number;
  /** 0..1 progress of the shard burst after a crit, -1 = none */
  shard: number;
}
/** how the colossus reacts `hitAge` / `critAge` seconds after a hit / crit on the eye (all zero under reduced motion) */
export const eyeReaction = (hitAge: number, critAge: number, still: boolean, out: EyeReaction): EyeReaction => {
  out.squint = 0;
  out.recoil = 0;
  out.flash = 0;
  out.shard = -1;
  if (still) return out;
  out.squint = Math.max(
    recoilProfile(hitAge, SQUINT_S) > 0 ? 1 - hitAge / SQUINT_S : 0,
    critAge >= 0 && critAge < CRIT_SQUINT_S ? 1 - critAge / CRIT_SQUINT_S : 0,
  );
  out.recoil = Math.max(
    recoilProfile(hitAge, HIT_RECOIL_S) * HIT_RECOIL_PX,
    recoilProfile(critAge, CRIT_RECOIL_S) * CRIT_RECOIL_PX,
  );
  out.flash = critAge >= 0 && critAge < CRIT_FLASH_S ? 1 - critAge / CRIT_FLASH_S : 0;
  out.shard = critAge >= 0 && critAge < CRIT_SHARD_S ? critAge / CRIT_SHARD_S : -1;
  return out;
};
export const squintLevel = (squint: number): number =>
  Math.min(SQUINT_LEVELS, Math.max(0, Math.round(squint * SQUINT_LEVELS)));

/** eyeCrack (0..1) crosses these: stage 1-2 crack the eye, 3-4 spread over the body */
const CRACK_AT_A = 0.1;
const CRACK_AT_B = 0.3;
const CRACK_AT_C = 0.55;
const CRACK_AT_D = 0.8;
export const CRACK_STAGE_AT: readonly number[] = [CRACK_AT_A, CRACK_AT_B, CRACK_AT_C, CRACK_AT_D];
export const CRACK_STAGES = CRACK_STAGE_AT.length;
export const crackStageOf = (crack: number): number => {
  let stage = 0;
  for (const at of CRACK_STAGE_AT) if (crack >= at) stage++;
  return stage;
};

// the gaze: the arena goes dark on the BACK layers only (raiders, floor effects and the front stay as they are)
/** dither level of the sky and far air; the body gets only a light veil so its silhouette stays readable */
export const GAZE_DARK_LEVEL = 15;
export const GAZE_BODY_DARK_LEVEL = 6;
/** the gaze's layer order: the sky is darkened BEFORE the body is drawn, then the body (lightly veiled), then the eye on top */
export const GAZE_LAYER_ORDER: readonly string[] = ["sky", "skyVeil", "body", "bodyVeil", "chest"];
export const GAZE_DARK_RAMP = 0.7;
export const GAZE_DARK_FADE_S = 0.45;
export const STILL_GAZE_DARK = 0.7;
export const GAZE_DARK_TARGETS: Readonly<{ back: boolean; characters: boolean; front: boolean }> = {
  back: true,
  characters: false,
  front: false,
};
/** 0..1 darkness of the back layers: ramps up through the charge, holds through the sweep, fades after it */
export const gazeDarkness = (now: number, at: number, hitAt: number, endAt: number, still: boolean): number => {
  if (now < at) return 0;
  if (now >= endAt + GAZE_DARK_FADE_S) return 0;
  if (still) return STILL_GAZE_DARK;
  if (now >= endAt) return 1 - (now - endAt) / GAZE_DARK_FADE_S;
  return clamp01((now - at) / Math.max(MIN_WINDUP_S, (hitAt - at) * GAZE_DARK_RAMP));
};

// the hand: a huge floor shadow for the telegraph, the sky blotted by the raised hand, a heavy slam
export const HAND_SHADOW_RX = 48;
export const HAND_SHADOW_RY = 26;
export const HAND_SHADOW_MIN = 14;
export const SKY_BLOT_RX = 46;
export const SKY_BLOT_RY = 58;
export const SKY_BLOT_MAX = 12;
/** 0..1 growth of the hand's floor shadow `age` seconds into the telegraph */
export const handShadowGrow = (age: number, telegraphS: number): number =>
  clamp01(1 - (1 - clamp01(age / Math.max(MIN_WINDUP_S, telegraphS))) ** 2);
export const SLAM_RING_SPEED = 420;
export const SLAM_RING_GAP_S = 0.07;
export const SLAM_RINGS = 3;
export const SLAM_FX_S = 0.9;
export const SLAM_SAG_PX = 3;
export const SLAM_SAG_S = 0.22;
export const DUST_RISE_PX = 74;
export const DUST_S = 1.1;
export const DEBRIS_CHUNKS = 22;
/** radius of slam ring `index` `age` seconds after the impact (-1 = not out yet or gone) */
export const slamRingRadius = (age: number, index: number): number => {
  const run = age - index * SLAM_RING_GAP_S;
  return run > 0 && age < SLAM_FX_S ? run * SLAM_RING_SPEED : -1;
};
/** 0..1 how high the dust wall stands and its dissolve level 0..SKY_BLOT_MAX */
export const dustWall = (age: number): { rise: number; dissolve: number } => ({
  rise: age < 0 ? 0 : 1 - (1 - clamp01(age / (DUST_S * RECOIL_PEAK))) ** 2,
  dissolve:
    age < DUST_S * RECOIL_PEAK
      ? 0
      : Math.round(clamp01((age - DUST_S * RECOIL_PEAK) / (DUST_S * (1 - RECOIL_PEAK))) * SKY_BLOT_MAX),
});
/** body sag (px, down) of the colossus when a hand lands */
export const slamSag = (age: number): number => recoilProfile(age, SLAM_SAG_S) * SLAM_SAG_PX;

// the roar: the mask splits, sound-wave rings expand from it, floor debris lifts
export const ROAR_RING_COUNT = 5;
export const ROAR_RING_GAP_S = 0.16;
export const ROAR_RING_SPEED = 190;
export const ROAR_RING_REACH = 330;
export const ROAR_RING_SQUASH = 0.55;
export const ROAR_LIFT_PX = 26;
const LIFT_MIN = 0.4;
export const ROAR_CLOSE_S = 0.25;
export const MASK_OPEN_LEVELS = 4;
const STILL_RING_A = 60;
const STILL_RING_B = 110;
const STILL_RING_C = 160;
export const STILL_RING_RADII: readonly number[] = [STILL_RING_A, STILL_RING_B, STILL_RING_C];
/** radius (px) of roar ring `index` `age` seconds into the active scream (-1 = not out) */
export const roarRingRadius = (age: number, index: number): number => {
  const run = age - index * ROAR_RING_GAP_S;
  const radius = run * ROAR_RING_SPEED;
  return run > 0 && radius < ROAR_RING_REACH ? radius : -1;
};
/** the roar's schedule from the attack (telegraph at..hitAt, scream hitAt..hitAt + VOID_ROAR_ATTACK_S): mask open 0..1 */
export const roarOpen = (now: number, at: number, hitAt: number, still: boolean): number => {
  if (now < at || now >= hitAt + VOID_ROAR_ATTACK_S + ROAR_CLOSE_S) return 0;
  if (still) return 1;
  if (now < hitAt) return clamp01((now - at) / Math.max(MIN_WINDUP_S, hitAt - at));
  if (now < hitAt + VOID_ROAR_ATTACK_S) return 1;
  return 1 - (now - hitAt - VOID_ROAR_ATTACK_S) / ROAR_CLOSE_S;
};
export const maskOpenLevel = (open: number): number =>
  Math.min(MASK_OPEN_LEVELS, Math.max(0, Math.round(open * MASK_OPEN_LEVELS)));
/** a floor chunk's lift (px) `age` seconds into the roar: it rises and settles */
export const roarLift = (age: number, rnd: number): number =>
  age < 0 || age > VOID_ROAR_ATTACK_S + ROAR_CLOSE_S
    ? 0
    : Math.sin(clamp01(age / (VOID_ROAR_ATTACK_S + ROAR_CLOSE_S)) * Math.PI) *
      ROAR_LIFT_PX *
      (LIFT_MIN + rnd * (1 - LIFT_MIN));

// the final blow: a white-gold crack across the eye
export const FINAL_CRACK_S = 0.4;
export const finalCrack = (age: number, still: boolean): number =>
  age < 0 ? 0 : still ? 1 : clamp01(age / FINAL_CRACK_S);

// the phase 3 bar
export const P3_BAR_TRAIL_S = 1.6;
/** 0..1 of the colossus's own hp pool (a full bar at the start of phase 3) */
export const p3Fraction = (state: VoidState): number =>
  state.p3MaxHp > 0
    ? clamp01(state.p3Hp / state.p3MaxHp)
    : state.maxHp > 0
      ? clamp01(state.hp / state.maxHp / VOID_PHASE3_BELOW)
      : 0;
export const P3_LOW = 0.25;
/** skill plates at once in phase 3 */
export const P3_PLATE_LIMIT = 1;

/** a phase 3 skill name plate lives this long (s): the plates stay short, near the caster, never parked over the chest eye */
export const P3_PLATE_LIFE_S = 0.9;
