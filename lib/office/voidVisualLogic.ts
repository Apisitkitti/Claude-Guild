// Pure helpers of the Void Sanctum visuals (no canvas): the pixel-block wipe, the boss bar layout, caption sizing and
// which boss form / sprite stage a state shows. Kept out of the drawing files so the numbers here are named.
import { GLYPH_H, measurePixelText } from "./pixelFont";
import type { VoidForm } from "./voidBossSprite";
import { VOID_DYING_S, VOID_PHASE2_BELOW, VOID_PHASE3_BELOW } from "./voidFight";
import type { VoidPhase } from "./voidTypes";

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
const FORM_TRUE: VoidForm = 3;
const FORM_MID: VoidForm = 2;
/** the boss form for a hp fraction (used when only the fraction is known, like the retreat fade) */
export const formOfHp = (hpFrac: number): VoidForm =>
  hpFrac > VOID_PHASE2_BELOW ? 1 : hpFrac > VOID_PHASE3_BELOW ? FORM_MID : FORM_TRUE;
/** the form shown in `phase` (the hp fraction decides for the phases without their own form) */
export const formOfPhase = (phase: VoidPhase, hpFrac: number): VoidForm =>
  phase === "phase3" || phase === "dying"
    ? FORM_TRUE
    : phase === "phase2"
      ? FORM_MID
      : phase === "fight" || phase === "reveal"
        ? 1
        : formOfHp(hpFrac);

const DITHER_STEPS = 8;
/** dither level 0..8 of a fade that is `progress` (0..1) of the way out */
export const ditherLevelOf = (progress: number): number =>
  Math.min(DITHER_STEPS, Math.max(0, Math.round(progress * DITHER_STEPS)));

const CRACK_STAGES = 4;
const IMPLODE_STAGES = 3;
/** dying sprite stage 0..6 from the death stage and its progress; -1 once only the flash is left */
export const dyingStageOf = (stage: "cracks" | "implosion" | "flash", progress: number): number => {
  if (stage === "flash") return -1;
  const steps = stage === "cracks" ? CRACK_STAGES : IMPLODE_STAGES;
  const base = stage === "cracks" ? 0 : CRACK_STAGES;
  return base + Math.min(steps - 1, Math.max(0, Math.floor(progress * steps)));
};
export const DYING_TOTAL_S = VOID_DYING_S;

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
export const BAR_TOP = 182;
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
  voice: { y: BAR_TOP - VOICE_GAP - VOICE_BAND_H, height: VOICE_BAND_H },
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
