// Pure rules of the tier presence (which overlays a tier wears, tier-up timing, the overhead message, the crest slot).
// The pixels live in tierAura.ts; everything here is plain logic with named constants (and is linted like app code).

import { GEAR_TIER_NAMES, gearTier, type GearTier } from "./gearTier";
import { CH_H } from "./layout";
import { ADV_CLASSES, type AdvClass } from "./palette";
import type { Pose } from "./sprites";

export type BackPiece = "wings" | "runes" | "daggers" | "antlers";
export type GroundMark = "none" | "elite" | "legend";

export interface TierOverlay {
  /** veteran+: a bigger weapon sticking out past the body */
  weapon: boolean;
  /** veteran+: shoulder pads widen the outline by 1px */
  pads: boolean;
  /** elite+: a fluttering cape behind the body */
  cape: boolean;
  /** legend: class-flavoured back piece */
  back: BackPiece | null;
  /** legend: sparkles orbiting outside the body */
  sparkles: boolean;
  /** elite+: ground mark under the feet */
  ground: GroundMark;
  /** legend: spark trail while walking */
  trail: boolean;
  /** adept+: the rank crest floating over the head */
  crest: boolean;
}

const TIER_ADEPT = 1;
const TIER_VETERAN = 2;
const TIER_ELITE = 3;
const TIER_LEGEND = 4;

const BACK_OF: Record<AdvClass, BackPiece> = {
  warrior: "wings",
  cleric: "wings",
  mage: "runes",
  rogue: "daggers",
  ranger: "antlers",
};

const buildOverlay = (cls: AdvClass, tier: number): TierOverlay => ({
  weapon: tier >= TIER_VETERAN,
  pads: tier >= TIER_VETERAN,
  cape: tier >= TIER_ELITE,
  back: tier >= TIER_LEGEND ? BACK_OF[cls] : null,
  sparkles: tier >= TIER_LEGEND,
  ground: tier >= TIER_LEGEND ? "legend" : tier >= TIER_ELITE ? "elite" : "none",
  trail: tier >= TIER_LEGEND,
  crest: tier >= TIER_ADEPT,
});

/** built once: overlayFor() runs per adventurer per frame and must not allocate */
const OVERLAYS: Record<string, readonly TierOverlay[]> = Object.fromEntries(
  ADV_CLASSES.map((cls) => [cls, Array.from({ length: TIER_LEGEND + 1 }, (_, tier) => buildOverlay(cls, tier))]),
);

/** tier -> which overlays an adventurer of that class wears (an unknown class wears the warrior's) */
export const overlayFor = (cls: AdvClass, tier: GearTier): TierOverlay => (OVERLAYS[cls] ?? OVERLAYS.warrior)[tier];

/** poses where the big weapon overlay lines up with the hand; the rest (seated, slumped, hurt) just skip it */
const WEAPON_POSES: readonly Pose[] = ["idle", "walk", "attack", "cast", "cheer", "hand_up"];
export const showsBigWeapon = (pose: Pose): boolean => WEAPON_POSES.includes(pose);

// ---------------------------------------------------------------- animation clocks (static under reduced motion)
const CAPE_FRAMES = 3;
const CAPE_HZ = 5;
/** 0..2: the cape's flutter step */
export const capeFrame = (time: number, still: boolean): number =>
  still ? 0 : Math.floor(Math.max(0, time) * CAPE_HZ) % CAPE_FRAMES;
const FLAP_FRAMES = 2;
const FLAP_HZ = 3;
/** 0..1: the wing flap step */
export const wingFrame = (time: number, still: boolean): number =>
  still ? 0 : Math.floor(Math.max(0, time) * FLAP_HZ) % FLAP_FRAMES;

// ---------------------------------------------------------------- tier-up timing
export const TIER_UP_S = 2;
export const TIER_OLD_GEAR_S = 0.6;
const TIER_RISE_PX = 5;
const TIER_RISE_IN_S = 0.4;
const TIER_HOLD_END_S = 1.4;
const TIER_PILLAR_END_S = 1.6;
const TIER_PILLAR_GROW_S = 0.3;
const TIER_RING_END_S = 1.2;

/** the bits of an employee the tier-up needs (`tierUpAt` is the engine's stamp when present; else the level-up stamp) */
export interface TierUpSource {
  lvlAt: number;
  lvlTo: number;
  tierUpAt?: number;
}
/** engine default for "never" is far below this */
const NO_STAMP = -50;

/** seconds since this adventurer crossed into a new tier, or null when no tier-up is showing */
export const tierUpAge = (emp: TierUpSource, time: number): number | null => {
  const stamped = typeof emp.tierUpAt === "number" && emp.tierUpAt > NO_STAMP;
  const at = stamped ? (emp.tierUpAt as number) : gearTier(emp.lvlTo) > gearTier(emp.lvlTo - 1) ? emp.lvlAt : null;
  if (at === null) return null;
  const age = time - at;
  return age >= 0 && age < TIER_UP_S ? age : null;
};

export interface TierUpPhase {
  active: boolean;
  /** px the character is lifted (0 under reduced motion) */
  rise: number;
  /** still wearing the previous tier's gear (the pop comes after) */
  oldGear: boolean;
  /** 0..1 growth of the light pillar; 0 = none */
  pillar: number;
  /** 0..1 progress of the burst ring, null when not showing */
  ring: number | null;
}
const IDLE_PHASE: TierUpPhase = { active: false, rise: 0, oldGear: false, pillar: 0, ring: null };
const STILL_PHASE: TierUpPhase = { active: true, rise: 0, oldGear: false, pillar: 0, ring: null };

const easeOut = (value: number): number => 1 - (1 - value) * (1 - value);

export const tierUpPhase = (age: number | null, still: boolean): TierUpPhase => {
  if (age === null || age < 0 || age >= TIER_UP_S) return IDLE_PHASE;
  // reduced motion: the new gear at once, no lift / pillar / ring (the banner still shows)
  if (still) return STILL_PHASE;
  let rise = TIER_RISE_PX;
  if (age < TIER_RISE_IN_S) rise = TIER_RISE_PX * easeOut(age / TIER_RISE_IN_S);
  else if (age >= TIER_HOLD_END_S) rise = TIER_RISE_PX * (1 - (age - TIER_HOLD_END_S) / (TIER_UP_S - TIER_HOLD_END_S));
  const ringOn = age >= TIER_OLD_GEAR_S && age < TIER_RING_END_S;
  return {
    active: true,
    rise: Math.round(rise),
    oldGear: age < TIER_OLD_GEAR_S,
    pillar: age < TIER_PILLAR_END_S ? Math.min(1, age / TIER_PILLAR_GROW_S) : 0,
    ring: ringOn ? (age - TIER_OLD_GEAR_S) / (TIER_RING_END_S - TIER_OLD_GEAR_S) : null,
  };
};

/** the tier whose gear is on the sprite right now (the previous one for the first 0.6s of a tier-up) */
export const shownTier = (tier: GearTier, phase: TierUpPhase): GearTier =>
  phase.oldGear ? (Math.max(0, tier - 1) as GearTier) : tier;

// ---------------------------------------------------------------- overhead tier message
export interface TierMessage {
  title: string;
  sub: string;
}
/** the one stacked message of a tier-up: tier name big, "LV.20" small under it (uppercase ASCII for the pixel font) */
export const tierMessage = (level: number): TierMessage => {
  const name = GEAR_TIER_NAMES[gearTier(level)].toUpperCase();
  return { title: `${name}!`, sub: `LV.${level}` };
};
/** centre x for a message `width` wide so it (plus its 1px outline) stays inside [minX, maxX] */
export const clampMessageX = (centerX: number, width: number, minX: number, maxX: number): number => {
  const half = Math.ceil(width / 2) + 1;
  return Math.max(minX + half, Math.min(maxX - half, Math.round(centerX)));
};
/** top of the message: never above the canvas */
export const clampMessageY = (top: number): number => Math.max(1, Math.round(top));

// ---------------------------------------------------------------- crest above the head
export interface CrestBlockers {
  limitSign: boolean;
  bubble: boolean;
  hovered: boolean;
  selected: boolean;
  tierUp: boolean;
  /** a wind-up, lunge or backstab dash is moving the sprite sideways: the crest would be left behind */
  lunging: boolean;
}
/** the crest sits right over the head; the sign, bubbles, tag, arrow and tier banner all take that slot, so it hides */
export const crestVisible = (tier: GearTier, blockers: CrestBlockers): boolean =>
  tier >= TIER_ADEPT &&
  !blockers.limitSign &&
  !blockers.bubble &&
  !blockers.hovered &&
  !blockers.selected &&
  !blockers.tierUp &&
  !blockers.lunging;

const CREST_GAP = 3;
const CREST_SIZE = 5;
const CREST_BOB_HZ = 2;
/**
 * top-left of the 5x5 crest: centred over the head, bobbing by 1px (still under reduced motion). `lift` is how far the
 * sprite is raised (a Lord-attack dodge hop), `rise` the tier-up lift: the crest travels with the head.
 */
export const crestOrigin = (
  x: number,
  y: number,
  time: number,
  still: boolean,
  lift = 0,
): { x: number; y: number } => ({
  x: Math.round(x - CREST_SIZE / 2),
  y: Math.round(y - CH_H - CREST_GAP - CREST_SIZE - lift - (still ? 0 : Math.floor(time * CREST_BOB_HZ) % 2)),
});
