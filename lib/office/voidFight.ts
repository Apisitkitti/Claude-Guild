/**
 * The secret final boss: the Veiled One, the mastermind behind the Dungeon Lord. All the timing, scaling and pattern
 * rules live here as pure data and pure functions (no DOM, no engine import) so tests drive them directly; engine.ts
 * owns the Office side (moving raiders, damage, rewards). The renderer reads `office.voidFight` (see voidTypes.ts).
 *
 * Sequence: shatter -> transition -> reveal -> fight (veiled form) -> phase2 (<60% hp, TRUE FORM) -> phase3 (<25% hp,
 * THE VOID AWAKENS: the colossus) -> dying -> victory, or retreat when every raider left the Void Sanctum before the kill.
 */
import { hash01 } from "./lordFight";
import {
  VOID_EYE_MAX,
  voidHandHome,
  type VoidHand,
  type VoidHandState,
  type VoidMinion,
  type VoidAttack,
  type VoidAttackKind,
  type VoidPhase,
  type VoidState,
  voidIdle,
} from "./voidTypes";

export { VOID_HAND_COUNT, VOID_HAND_HOME_X, VOID_HAND_HOME_Y, voidHandHome } from "./voidTypes";

// ---- hp ----------------------------------------------------------------------------------------------------------
/** the Veiled One's pool is the Dungeon Lord's pool (lordMaxHp of the raiders and their tier) times this */
export const VOID_HP_MULT = 3;
/** the bar below which phase 2 / phase 3 begin (fraction of max hp) */
export const VOID_PHASE2_BELOW = 0.6;
export const VOID_PHASE3_BELOW = 0.25;
/** a hit never carries the hp past the next threshold: the boss always plays all three phases */
const VOID_HP_EPSILON = 1e-6;
/** the bar the damage cannot take hp below while the boss is in `phase` (fraction of max hp) */
export const voidDamageFloor = (phase: VoidPhase): number =>
  phase === "fight"
    ? VOID_PHASE2_BELOW - VOID_HP_EPSILON
    : phase === "phase2" || phase === "phase3"
      ? VOID_PHASE3_BELOW - VOID_HP_EPSILON
      : 0;
/** the colossus's own pool, as a multiple of the fight's max hp (tuned: a lone lv 16 raider needs ~50 s for it) */
export const VOID_P3_HP_MULT = 1.5;
/** the phases in which the boss can be hurt (an invulnerable window still blocks it) */
export const voidFightingPhase = (phase: VoidPhase): boolean =>
  phase === "fight" || phase === "phase2" || phase === "phase3";
/** hp as a fraction of the locked pool (0 when there is none) */
export const voidHpFrac = (state: VoidState): number =>
  state.maxHp <= 0
    ? 0
    : state.phase === "phase3" && state.p3MaxHp > 0
      ? (VOID_PHASE3_BELOW * state.p3Hp) / state.p3MaxHp // the bar's last quarter drains with the colossus's own pool
      : state.hp / state.maxHp;

// ---- timings -----------------------------------------------------------------------------------------------------
/** the Lord's corpse cracks and explodes (still on B3) */
export const VOID_SHATTER_S = 1.8;
/** the opaque pixel-block wipe; the raiders move to the Sanctum at its midpoint */
export const VOID_WIPE_S = 1.4;
export const VOID_WIPE_MID_S = VOID_WIPE_S / 2;
/** the wipe is fully opaque for this long around its midpoint */
const VOID_WIPE_HOLD_S = 0.2;
/** the Veiled One descends, taunts, the bar fills; nobody can hurt it yet */
export const VOID_REVEAL_S = 3.5;
/** the old phase 2 roar (kept for the renderer) and the TRUE FORM cinematic that opens phase 2: no damage taken */
export const VOID_ROAR_S = 1.2;
export const VOID_TRUE_FORM_S = 2.5;
/** THE VOID AWAKENS: the boss rises into the sky eye and the floor breaks into shards; no damage taken */
export const VOID_ASCEND_S = 4;
/** cracks, implosion / eye shatter and the final flash */
export const VOID_DYING_S = 5;
/** the victory phase (banner, rewards, the walk home starts after RAID_LINGER_S) */
export const VOID_VICTORY_S = 6;
/** the boss fades out laughing */
export const VOID_RETREAT_S = 1.5;
/** death stages (seconds after the last hit): cracks until, implosion until; the flash is the rest */
export const VOID_DEATH_CRACK_S = 1.6;
export const VOID_DEATH_IMPLODE_S = 3.2;
/** the eye-shatter death (it died as the colossus): the eye cracks until, shatters until; the flash is the rest */
export const VOID_EYE_CRACK_S = 1.8;
export const VOID_EYE_SHATTER_S = 3.6;

/** how long the phase lasts; Infinity for the open-ended fighting phases and none */
export const voidPhaseLength = (phase: VoidPhase): number => {
  switch (phase) {
    case "shatter":
      return VOID_SHATTER_S;
    case "transition":
      return VOID_WIPE_S;
    case "reveal":
      return VOID_REVEAL_S;
    case "dying":
      return VOID_DYING_S;
    case "victory":
      return VOID_VICTORY_S;
    case "retreat":
      return VOID_RETREAT_S;
    default:
      return Infinity;
  }
};
/** seconds since the phase began */
export const voidPhaseAge = (state: VoidState, clock: number): number => clock - state.phaseAt;
/** 0..1 through a timed phase (0 for open-ended phases and none) */
export const voidPhaseProgress = (state: VoidState, clock: number): number => {
  const length = voidPhaseLength(state.phase);
  return Number.isFinite(length) && state.phase !== "none"
    ? Math.min(1, Math.max(0, voidPhaseAge(state, clock) / length))
    : 0;
};
/** the boss takes no damage right now (reveal, the roar, TRUE FORM, dying) */
export const voidInvulnerable = (state: VoidState, clock: number): boolean =>
  !voidFightingPhase(state.phase) || clock < state.invulnUntil;
/** the wipe's coverage 0..1 at `age` seconds into the transition: fully opaque around the midpoint */
export const voidWipeCover = (age: number): number =>
  Math.min(
    1,
    Math.max(0, (VOID_WIPE_MID_S - Math.abs(age - VOID_WIPE_MID_S)) / (VOID_WIPE_MID_S - VOID_WIPE_HOLD_S / 2)),
  );
/** which part of the death sequence `age` seconds after the last hit is in (cracks -> implosion -> flash) */
export type VoidDeathStage = "cracks" | "implosion" | "flash";
export const voidDeathStage = (age: number): VoidDeathStage =>
  age < VOID_DEATH_CRACK_S ? "cracks" : age < VOID_DEATH_IMPLODE_S ? "implosion" : "flash";
/** 0..1 through the current death stage */
export const voidDeathStageProgress = (age: number): number => {
  const stage = voidDeathStage(age);
  if (stage === "cracks") return Math.min(1, Math.max(0, age / VOID_DEATH_CRACK_S));
  if (stage === "implosion")
    return Math.min(1, (age - VOID_DEATH_CRACK_S) / (VOID_DEATH_IMPLODE_S - VOID_DEATH_CRACK_S));
  return Math.min(1, (age - VOID_DEATH_IMPLODE_S) / (VOID_DYING_S - VOID_DEATH_IMPLODE_S));
};
/** the eye-shatter death (state.dyingEye: it died as the phase 3 colossus): cracks -> shatter (glass) -> flash */
export type VoidEyeDeathStage = "cracks" | "shatter" | "flash";
export const voidEyeDeathStage = (age: number): VoidEyeDeathStage =>
  age < VOID_EYE_CRACK_S ? "cracks" : age < VOID_EYE_SHATTER_S ? "shatter" : "flash";
/** 0..1 through the current eye-death stage */
export const voidEyeDeathProgress = (age: number): number => {
  const stage = voidEyeDeathStage(age);
  if (stage === "cracks") return Math.min(1, Math.max(0, age / VOID_EYE_CRACK_S));
  if (stage === "shatter") return Math.min(1, (age - VOID_EYE_CRACK_S) / (VOID_EYE_SHATTER_S - VOID_EYE_CRACK_S));
  return Math.min(1, (age - VOID_EYE_SHATTER_S) / (VOID_DYING_S - VOID_EYE_SHATTER_S));
};

// ---- voice -------------------------------------------------------------------------------------------------------
/** seconds a shouted line stays up */
export const VOID_VOICE_S = 3.2;
/** the lines (drawn in the pixel font: capitals, digits, ! ? . - :) */
export const VOID_LINE_SHATTER = "FOOLS... HE WAS ONLY MY PUPPET.";
export const VOID_LINES_REVEAL = [
  "KNEEL BEFORE THE VEIL.",
  "EVERY CALL YOU MAKE FEEDS MY VOID.",
  "YOU MEET THE TRUE MASTER.",
] as const;
export const VOID_LINE_PHASE2 = "BEHOLD MY TRUE FORM!";
export const VOID_LINE_PHASE3 = "I AM THE VOID ITSELF!";
export const VOID_LINE_DYING = "IMPOSSIBLE... THE VOID... FADES...";
export const VOID_LINE_RETREAT = "HAHAHA... THIS IS NOT THE END.";
/** idle taunts: one every ~6 s while it fights, by phase; the lines cycle */
export const VOID_TAUNT_EVERY_S = 6;
const TAUNT_JITTER = 0.2;
export const VOID_TAUNTS: Record<string, readonly string[]> = {
  fight: ["YOUR TOOLS ARE NOTHING.", "THE VOID HUNGERS.", "RUN. IT WILL NOT HELP."],
  phase2: ["YOU ONLY TORE THE VEIL!", "FEEL THE FLOOR CRUMBLE!", "I WILL WEAR YOUR LEVELS."],
  phase3: [
    "THERE IS NO LIGHT HERE!",
    "DARKNESS! DARKNESS!",
    "I AM THE END OF EVERY CALL.",
    "THE SKY ITSELF WATCHES YOU.",
  ],
};
/** the taunt to say next in `phase` (cycles) */
export const voidTauntLine = (phase: VoidPhase, index: number): string => {
  const lines = VOID_TAUNTS[phase] ?? VOID_TAUNTS.fight;
  return lines[index % lines.length];
};
export const voidNextTaunt = (rnd: number): number => VOID_TAUNT_EVERY_S * (1 - TAUNT_JITTER + 2 * TAUNT_JITTER * rnd);
/** the idle menace pulse the renderer can use */
export const VOID_MENACE_EVERY_S = 1.8;

// ---- beats: banners and voice lines take turns --------------------------------------------------------------------
/** a banner (with its length) or a voice line, due no earlier than `at` */
export interface VoidBeat {
  at: number;
  banner?: { text: string; dur: number };
  line?: string;
}
/** the voice waits this long after an epic banner has gone */
export const VOID_BANNER_VOICE_GAP_S = 0.8;
/** can a voice line start now: no banner is up (plus the gap) and no earlier line is still fresh */
export const voidStageFree = (ctl: VoidCtl, clock: number): boolean =>
  clock >= ctl.voiceUntil && clock >= ctl.bannerUntil + VOID_BANNER_VOICE_GAP_S;
/**
 * the next beat that may play now, or null. A banner never starts while a voice line is fresh; a voice line starts
 * VOID_BANNER_VOICE_GAP_S after the last banner is gone. Banners queue behind each other (the renderer shows one at a time).
 */
export const takeVoidBeat = (ctl: VoidCtl, clock: number): VoidBeat | null => {
  const beat = ctl.beats[0];
  if (!beat || clock < beat.at) return null;
  if (beat.banner) {
    if (clock < ctl.voiceUntil) return null;
    ctl.beats.shift();
    ctl.bannerUntil = Math.max(clock, ctl.bannerUntil) + beat.banner.dur;
    return beat;
  }
  if (!voidStageFree(ctl, clock)) return null;
  ctl.beats.shift();
  ctl.voiceUntil = clock + VOID_VOICE_S;
  return beat;
};
/** a new phase supersedes everything still waiting: cut the voice and drop the queue */
export const cutVoidBeats = (state: VoidState, ctl: VoidCtl, clock: number) => {
  ctl.beats.length = 0;
  state.voice = "";
  state.voiceAt = -99;
  ctl.voiceUntil = clock;
};

/** the line the boss is shouting at `clock`, or "" when it has gone quiet */
export const voidVoice = (state: VoidState, clock: number): string =>
  state.voice && clock >= state.voiceAt && clock - state.voiceAt < VOID_VOICE_S ? state.voice : "";
/** shout a line now */
export const voidSay = (state: VoidState, clock: number, line: string) => {
  state.voice = line;
  state.voiceAt = clock;
};

// ---- the arena ---------------------------------------------------------------------------------------------------
/** where the boss stands, its feet row, the height of its body (pops and hit sparks), its blink offset */
export const VOID_HOME_X = 262;
export const VOID_FEET_Y = 120;
export const VOID_BODY_H = 56;
export const VOID_BLINK_DX = 26;
/** the floor the arena attacks cover */
export const VOID_ARENA_X0 = 70;
export const VOID_ARENA_X1 = 250;
export const VOID_ARENA_Y0 = 70;
export const VOID_ARENA_Y1 = 190;
/** the collapse grid: cells of the arena that fall away */
export const VOID_COLLAPSE_COLS = 6;
export const VOID_COLLAPSE_ROWS = 4;
const COLLAPSE_FRACTION = 0.45;
const COLLAPSE_SEED_STRIDE = 53;
/** is the grid cell (col, row) of collapse pattern `seed` falling */
export const voidCollapseCell = (seed: number, col: number, row: number): boolean =>
  hash01(seed * COLLAPSE_SEED_STRIDE + row * VOID_COLLAPSE_COLS + col) < COLLAPSE_FRACTION;
/** does a raider standing at (x, y) stand on a falling cell */
export const voidCollapseAt = (seed: number, x: number, y: number): boolean => {
  const col = Math.floor(((x - VOID_ARENA_X0) / (VOID_ARENA_X1 - VOID_ARENA_X0)) * VOID_COLLAPSE_COLS);
  const row = Math.floor(((y - VOID_ARENA_Y0) / (VOID_ARENA_Y1 - VOID_ARENA_Y0)) * VOID_COLLAPSE_ROWS);
  if (col < 0 || row < 0 || col >= VOID_COLLAPSE_COLS || row >= VOID_COLLAPSE_ROWS) return false;
  return voidCollapseCell(seed, col, row);
};
/** where floating eye `index` of attack `seed` hovers (writes into `out`) */
const EYE_SEED_STRIDE = 29;
const EYE_SEED_Y = 7;
const EYE_LIFT_PX = 30;
export const voidEyeSpot = (seed: number, index: number, out: { x: number; y: number }) => {
  const base = seed * EYE_SEED_STRIDE + index;
  out.x = Math.round(VOID_ARENA_X0 + hash01(base) * (VOID_ARENA_X1 - VOID_ARENA_X0));
  out.y = Math.round(VOID_ARENA_Y0 - EYE_LIFT_PX + hash01(base + EYE_SEED_Y) * (VOID_ARENA_Y1 - VOID_ARENA_Y0));
};

// ---- attacks -----------------------------------------------------------------------------------------------------
/** the colossus's heavy moves: a long wind-up (the hand's floor shadow, the gaze's dark charge, the roar's inhale) */
export const VOID_HAND_TELEGRAPH_S = 1.4;
export const VOID_GAZE_CHARGE_S = 2;
export const VOID_ROAR_TELEGRAPH_S = 1;
/** the colossus's roar attack: the scream and its sound wave (the older VOID_ROAR_S is the phase 2 roar cinematic) */
export const VOID_ROAR_ATTACK_S = 0.8;
/** seconds of the warning before each attack lands (phase 1 pace) */
const TELEGRAPH_S: Record<VoidAttackKind, number> = {
  beam: 1.2,
  eyes: 1.5,
  blink: 1,
  collapse: 1.4,
  eclipse: 2.6,
  summon: 1,
  hand: VOID_HAND_TELEGRAPH_S,
  gaze: VOID_GAZE_CHARGE_S,
  roar: VOID_ROAR_TELEGRAPH_S,
};
/** no warning is shorter than this, so it always reads */
export const VOID_MIN_TELEGRAPH_S = 0.9;
/** the colossus hand: the slam, then it sinks back; the gaze beam's sweep across the whole floor */
export const VOID_HAND_SLAM_S = 0.3;
export const VOID_HAND_SINK_S = 0.7;
const VOID_HAND_ACTIVE_S = VOID_HAND_SLAM_S + VOID_HAND_SINK_S;
/** the hands rise during the ascend and then hover */
export const VOID_HAND_RISE_S = 3.2;
export const VOID_GAZE_SWEEP_S = 1.2;
/** seconds each attack stays up after it lands */
const ACTIVE_S: Record<VoidAttackKind, number> = {
  beam: 1,
  eyes: 1.5,
  blink: 0.7,
  collapse: 1.6,
  eclipse: 1.8,
  summon: 0.6,
  hand: VOID_HAND_ACTIVE_S,
  gaze: VOID_GAZE_SWEEP_S,
  roar: VOID_ROAR_ATTACK_S,
};
/** telegraphs get shorter as the boss gets angrier (the eclipse and the colossus's hand and gaze keep their charge) */
const PHASE_PACE: Record<string, number> = { fight: 1, phase2: 0.85, phase3: 0.7 };
const FIXED_TELEGRAPH: ReadonlySet<VoidAttackKind> = new Set<VoidAttackKind>(["eclipse", "hand", "gaze", "roar"]);
export const voidTelegraphS = (kind: VoidAttackKind, phase: VoidPhase): number =>
  FIXED_TELEGRAPH.has(kind)
    ? TELEGRAPH_S[kind]
    : Math.max(VOID_MIN_TELEGRAPH_S, TELEGRAPH_S[kind] * (PHASE_PACE[phase] ?? 1));
export const voidActiveS = (kind: VoidAttackKind): number => ACTIVE_S[kind];
/** the first attack after the reveal, after the roar and after TRUE FORM */
export const VOID_FIRST_ATTACK_S = 1.2;
export const VOID_FIRST_ATTACK_P2_S = 1.6;
export const VOID_FIRST_ATTACK_P3_S = 1.5;
/** seconds between attacks per phase (+-15% jitter) */
const GAP_S: Record<string, number> = { fight: 3, phase2: 2.2, phase3: 2.4 };
const GAP_JITTER = 0.1;
export const voidNextGap = (phase: VoidPhase, rnd: number): number =>
  (GAP_S[phase] ?? GAP_S.fight) * (1 - GAP_JITTER + 2 * GAP_JITTER * rnd);
/** every Nth attack of phase 2 and phase 3 is the eclipse */
export const VOID_ECLIPSE_EVERY = 3;
/** the colossus fires its moves in a fixed rotation (hand, gaze, roar) with the eclipse on every 4th attack */
export const VOID_ECLIPSE_EVERY_P3 = 4;
const POOL_P3: readonly VoidAttackKind[] = ["hand", "gaze", "roar"];
const POOL_P1: readonly VoidAttackKind[] = ["beam", "eyes", "blink", "summon"];
const POOL_P2: readonly VoidAttackKind[] = ["beam", "eyes", "blink", "collapse", "summon"];
/**
 * the next attack: phase 1 draws from beam/eyes/blink/summon (no summon while minions live), phase 2 (TRUE FORM) adds
 * collapse, phase 3 (the colossus) rotates hand, gaze, roar with the eclipse on every VOID_ECLIPSE_EVERY_P3-th attack,
 * and every VOID_ECLIPSE_EVERY-th attack of phase 2 is the eclipse. Never the same kind twice in a row
 * otherwise. `phaseCount` = attacks already started in the current phase.
 */
export const pickVoidAttack = (
  phase: VoidPhase,
  prev: VoidAttackKind | null,
  phaseCount: number,
  rnd: number,
  minionsAlive = false,
): VoidAttackKind => {
  if (phase === "phase3") {
    const eclipses = Math.floor((phaseCount + 1) / VOID_ECLIPSE_EVERY_P3);
    if ((phaseCount + 1) % VOID_ECLIPSE_EVERY_P3 === 0) return "eclipse";
    return POOL_P3[(phaseCount - eclipses) % POOL_P3.length];
  }
  if (phase === "phase2" && (phaseCount + 1) % VOID_ECLIPSE_EVERY === 0) return "eclipse";
  const pool = (phase === "fight" ? POOL_P1 : POOL_P2).filter(
    (kind) => kind !== prev && !(minionsAlive && kind === "summon"),
  );
  return pool[Math.min(pool.length - 1, Math.floor(rnd * pool.length))];
};
/** floating eyes per eyes attack */
const EYES_CALM = 3;
const EYES_ANGRY = 4;
export const voidEyeCount = (phase: VoidPhase): number => (phase === "fight" ? EYES_CALM : EYES_ANGRY);
/** seconds between one eye firing and the next */
export const VOID_EYE_GAP_S = 0.25;
/** the beam sweeps left from the boss at this speed; raiders within this half-height of its row are hit */
export const VOID_BEAM_SPEED = 220;
export const VOID_BEAM_HALF_PX = 14;
/** a raider dodges a regular attack or the eclipse with this chance */
export const VOID_DODGE_CHANCE = 0.3;
/** a regular attack never takes a raider below this many hearts; the eclipse leaves dodgers at it, others at 0 */
export const VOID_HEART_FLOOR = 1;
export const VOID_ECLIPSE_DODGED_HEARTS = 1;
export const VOID_ECLIPSE_HIT_HEARTS = 1;
/** seconds a raider stays in the hurt pose after a hit / after the eclipse */
export const VOID_HURT_S = 0.6;
export const VOID_ECLIPSE_HURT_S = 1.4;

/** where the colossus's gaze beam is `clock`: it sweeps from arenaLeft to arenaRight over VOID_GAZE_SWEEP_S after hitAt */
export const voidGazeX = (attack: VoidAttack, clock: number, arenaLeft: number, arenaRight: number): number => {
  const progress = Math.min(1, Math.max(0, (clock - attack.hitAt) / VOID_GAZE_SWEEP_S));
  return arenaLeft + (arenaRight - arenaLeft) * progress;
};

/** where a beam fired from x = `bossX` reaches a raider at `spotX` (seconds after it lands) */
export const voidBeamArrive = (bossX: number, spotX: number): number => Math.max(0, bossX - spotX) / VOID_BEAM_SPEED;

// ---- phase 3 / cinematic feel ------------------------------------------------------------------------------------
/** screen shake amounts (0..1) */
export const VOID_SHAKE_DECAY = 2.4;
export const VOID_SHAKE_SHATTER = 0.8;
export const VOID_SHAKE_WIPE = 0.5;
export const VOID_SHAKE_REVEAL = 0.9;
export const VOID_SHAKE_BEAM = 0.35;
export const VOID_SHAKE_COLLAPSE = 0.55;
export const VOID_SHAKE_ECLIPSE = 0.9;
export const VOID_SHAKE_CRIT = 0.25;
export const VOID_SHAKE_ROAR = 0.7;
/** TRUE FORM keeps the screen at least this shaken for the whole cinematic */
export const VOID_SHAKE_TRUE_FORM = 0.65;
/** THE VOID AWAKENS keeps the screen at least this shaken for the whole ascend */
export const VOID_SHAKE_ASCEND = 0.75;
export const VOID_SHAKE_HAND = 0.85;
/** every raider hit on the colossus's core staggers the eye a little; a crit a lot more */
export const VOID_SHAKE_EYE_HIT = 0.12;
export const VOID_SHAKE_EYE_CRIT = 0.3;
export const VOID_SHAKE_ROAR_ATTACK = 0.6;
export const VOID_SHAKE_GAZE = 0.35;
export const VOID_SHAKE_EYE_SHATTER = 0.9;
export const VOID_SHAKE_DEATH = 0.5;
export const VOID_SHAKE_FLASH = 1;
export const VOID_SHAKE_VICTORY = 0.6;
/** the bar eases toward the real hp at this rate per second */
export const VOID_BAR_EASE = 6;

// ---- rewards -----------------------------------------------------------------------------------------------------
/** per raider on the Void floor when the Veiled One falls (the Dungeon Lord gives 80 gold and 3 kills) */
export const VOID_GOLD = 400;
export const VOID_KILLS = 10;
/** xp per raider; never less than what the next level needs */
export const VOID_XP = 150;
/** the guild master's praise for the slayers */
export const VOID_PRAISE_TEXT = "LEGENDARY";
/** banner seconds (the default banner is 2.5) */
export const VOID_BANNER_S = 2.2;
export const VOID_BANNER_TRUE_FORM_S = 2.4;
export const VOID_BANNER_AWAKENS_S = 2.6;
export const VOID_BANNER_VICTORY_S = 5.5;

// ---- state -------------------------------------------------------------------------------------------------------
/** the engine's private bookkeeping of the fight (not for the renderer) */
export interface VoidCtl {
  /** clock time of the next attack (-1 = none planned) */
  nextAttackAt: number;
  /** kind of the previous attack, attacks started in the current phase */
  prev: VoidAttackKind | null;
  phaseCount: number;
  /** attacks started this fight (seeds the patterns) */
  count: number;
  /** the raiders were moved to the Void floor (the wipe passed its midpoint) */
  moved: boolean;
  /** raider ids this attack already hit or missed, and the raider a blink / the first eye aims at */
  done: Set<string>;
  targetId: string;
  /** the death sequence emitted its stage effects this far (0 = none, 1 = cracks, 2 = implosion, 3 = flash) */
  deathStep: number;
  /** clock time of the last crack burst during the dying cracks stage */
  crackAt: number;
  /** banner / voice beats waiting their turn (one at a time, never overlapping) and when the current one is done */
  beats: VoidBeat[];
  /** clock time the voice line now shouting is done */
  voiceUntil: number;
  /** clock time the last queued banner is expected to be done */
  bannerUntil: number;
  /** next idle taunt, how many were said, next menace pulse */
  nextTauntAt: number;
  tauntN: number;
  nextMenaceAt: number;
  /** clock time the raiders start walking up to the boss (the reveal began) */
  stepAt: number;
  /** clock time of the last fight tick (minion drift) */
  lastAt: number;
  /** the stand ring the raiders are on now and the one they slid back from (see voidSpotOf) */
  ring: VoidSpotRing;
  prevRing: VoidSpotRing;
}
export const freshVoidCtl = (): VoidCtl => ({
  nextAttackAt: -1,
  prev: null,
  phaseCount: 0,
  count: 0,
  moved: false,
  done: new Set<string>(),
  targetId: "",
  deathStep: 0,
  crackAt: -99,
  beats: [],
  voiceUntil: 0,
  bannerUntil: 0,
  nextTauntAt: -1,
  tauntN: 0,
  nextMenaceAt: -1,
  stepAt: -1,
  lastAt: -1,
  ring: 0,
  prevRing: 0,
});

/** back to nothing happening; the defeat count survives (clear() wipes it separately) */
export const resetVoid = (state: VoidState, ctl: VoidCtl) => {
  const idle = voidIdle();
  const kills = state.kills;
  const eyes = state.eyes;
  const attack = state.attack;
  const minions = state.minions;
  const hands = state.hands;
  Object.assign(state, idle, { kills, eyes, attack, minions, hands });
  hands.forEach((hand, index) => Object.assign(hand, idle.hands[index]));
  for (const eye of eyes) eye.on = false;
  for (const minion of minions) minion.on = false;
  if (attack) attack.endAt = -99;
  Object.assign(ctl, freshVoidCtl(), { done: ctl.done });
  ctl.done.clear();
};

/** the phase changes now */
export const setVoidPhase = (state: VoidState, clock: number, phase: VoidPhase) => {
  state.phase = phase;
  state.phaseAt = clock;
};

/** the boss is hurt: true while the hit still counts (the caller checks voidInvulnerable first) */
export const damageVoid = (state: VoidState, dmg: number): void => {
  if (state.phase === "phase3") {
    state.p3Hp = Math.max(0, state.p3Hp - dmg); // the colossus's own pool; hp rests on its 25% floor
    state.eyeCrack = state.p3MaxHp > 0 ? 1 - state.p3Hp / state.p3MaxHp : 1;
    return;
  }
  const floor = voidDamageFloor(state.phase) * state.maxHp;
  state.hp = Math.max(floor, state.hp - dmg);
  if (state.hp < VOID_HP_EPSILON) state.hp = 0; // float residue of many small hits
};

/** an attack record (one object reused for the whole fight) */
export const beginVoidAttack = (
  state: VoidState,
  clock: number,
  kind: VoidAttackKind,
  tx: number,
  ty: number,
  seed: number,
): VoidAttack => {
  const attack: VoidAttack = state.attack ?? {
    kind,
    at: clock,
    targetX: tx,
    targetY: ty,
    hitAt: clock,
    endAt: clock,
    landed: false,
    seed,
  };
  attack.kind = kind;
  attack.at = clock;
  attack.targetX = tx;
  attack.targetY = ty;
  attack.hitAt = clock + voidTelegraphS(kind, state.phase);
  attack.endAt = attack.hitAt + voidActiveS(kind);
  attack.landed = false;
  attack.seed = seed;
  state.attack = attack;
  return attack;
};

/** an attack is on (telegraph or active) at `clock` */
export type VoidAttackPhase = "none" | "telegraph" | "active";
export const voidAttackPhase = (state: VoidState, clock: number): VoidAttackPhase => {
  const attack = state.attack;
  if (!attack || clock >= attack.endAt) return "none";
  return clock < attack.hitAt ? "telegraph" : "active";
};
/** stop the running attack and the eyes (a phase changed, or the fight ended) */
export const stopVoidAttack = (state: VoidState, clock: number) => {
  if (state.attack && state.attack.endAt > clock) state.attack.endAt = clock;
  for (const eye of state.eyes) eye.on = false;
};
/** spawn the eyes of an `eyes` attack at deterministic spots; they fire one after the other from hitAt */
export const spawnVoidEyes = (state: VoidState, clock: number, attack: VoidAttack, count: number) => {
  const spot = { x: 0, y: 0 };
  for (let index = 0; index < VOID_EYE_MAX; index++) {
    const eye = state.eyes[index];
    eye.on = index < count;
    if (!eye.on) continue;
    voidEyeSpot(attack.seed, index, spot);
    eye.x = spot.x;
    eye.y = spot.y;
    eye.bornAt = clock;
    eye.fireAt = attack.hitAt + index * VOID_EYE_GAP_S;
    eye.fired = false;
  }
};

// ---- effects (particle specs; colours are the Sanctum's violets) ----------------------------------------------------
export const VOID_COLS = ["#e8e0ff", "#9a7bff", "#5a3aa8", "#ffffff"];
export const VOID_FX_SHATTER = { n: 48, cols: VOID_COLS, speed: 120, gravity: 70, life: 1.1 };
export const VOID_FX_REVEAL = { n: 40, cols: VOID_COLS, speed: 95, gravity: 0, life: 1.2 };
export const VOID_FX_HIT = { n: 10, cols: ["#ffffff", "#c9b3ff", "#9a7bff"], speed: 65, gravity: 90, life: 0.5 };
export const VOID_FX_CRIT = { n: 18, cols: ["#ffffff", "#ffe14a", "#c9b3ff"], speed: 85, gravity: 90, life: 0.5 };
export const VOID_FX_HURT = { n: 10, cols: ["#c9b3ff", "#ff5a8a", "#ffffff"], speed: 70, gravity: 60, life: 0.5 };
export const VOID_FX_EYE = { n: 8, cols: ["#ff5a8a", "#ffd0e0", "#ffffff"], speed: 55, gravity: 20, life: 0.4 };
export const VOID_FX_CRACK = { n: 8, cols: ["#ffffff", "#c9b3ff"], speed: 60, gravity: 20, life: 0.5 };
export const VOID_FX_IMPLODE = { n: 28, cols: VOID_COLS, speed: 70, life: 0.9 };
export const VOID_FX_FLASH = { n: 90, cols: VOID_COLS, speed: 150, gravity: 40, life: 1.4 };
export const VOID_FX_ROAR = { n: 30, cols: ["#ff5a8a", "#9a7bff", "#ffffff"], speed: 100, gravity: 10, life: 0.9 };
/** death steps already played (the cracks are step 1) */
export const VOID_STEP_IMPLODE = 2;
export const VOID_STEP_FLASH = 3;
/** the cracks of the dying boss: one small burst this often during the first stage */
export const VOID_CRACK_EVERY_S = 0.4;
/** pops and sparks sit this far above the body / this far to the side of its middle */
export const VOID_POP_LIFT = 4;
export const VOID_POP_JITTER = 8;
export const VOID_SPARK_DX = 8;
export const VOID_CRIT_POP_S = 1.2;
export const VOID_CRIT_POP_SCALE = 3;
/** the victory coin shower: bigger than the Lord's */
export const VOID_SHOWER_COINS = 140;
export const VOID_COIN_COUNT = 40;
export const VOID_COIN_SPREAD = 30;
export const VOID_POP_RISE = 40;

// ---- hits, blocks, impacts ---------------------------------------------------------------------------------------
/** the boss renders hurt-white for this long after damage was applied */
export const VOID_HIT_FLASH_S = 0.08;
/** a raider's strike lands on a random point of the body: this wide, between these fractions of its height */
export const VOID_BODY_W = 36;
export const VOID_HIT_Y_MIN = 0.12;
export const VOID_HIT_Y_MAX = 0.92;
/** a blink strike: the boss stays beside the raider this long, then steps back home */
export const VOID_BLINK_STAY_S = 0.7;
/** minions are drawn / hit this far above their feet point */
export const VOID_MINION_LIFT_PX = 6;
/** the eclipse shakes the floor this long */
export const VOID_QUAKE_S = 1.8;

// ---- phase 3: the core and the colossus's hands -----------------------------------------------------------------
/** the core sways across the arena (sinusoidal), floats down from above the screen, and is hit anywhere in this box */
export const VOID_CORE_PERIOD_S = 7;
export const VOID_CORE_SWAY_PX = 58;
export const VOID_CORE_Y = 46;
export const VOID_CORE_Y0 = -24;
export const VOID_CORE_OPEN_S = 1.4;
export const VOID_CORE_HIT_W = 14;
export const VOID_CORE_HIT_H = 10;
const VOID_CORE_CENTER_X = (VOID_ARENA_X0 + VOID_ARENA_X1) / 2;
/** the core's x `clock` seconds in (the sway starts at the centre when the ascend begins) */
export const voidCoreX = (clock: number, ascendAt: number): number =>
  VOID_CORE_CENTER_X + Math.sin(((clock - ascendAt) / VOID_CORE_PERIOD_S) * Math.PI * 2) * VOID_CORE_SWAY_PX;
/** the core's y: above the screen until coreOpenAt, then eased down to VOID_CORE_Y over VOID_CORE_OPEN_S */
export const voidCoreY = (clock: number, coreOpenAt: number): number => {
  const progress = Math.min(1, Math.max(0, (clock - coreOpenAt) / VOID_CORE_OPEN_S));
  return VOID_CORE_Y0 + (VOID_CORE_Y - VOID_CORE_Y0) * (1 - (1 - progress) * (1 - progress));
};
/** the hand that slams a raider at x: the one on that side of the arena (the other when it is busy) */
export const voidHandFor = (state: VoidState, x: number): number => {
  const preferred = x < VOID_CORE_CENTER_X ? 0 : 1;
  const free = (index: number) => state.hands[index].state === "hover";
  if (free(preferred)) return preferred;
  return free(1 - preferred) ? 1 - preferred : preferred;
};
/** one hand goes to its home spot in `stateName` */
export const homeVoidHand = (hand: VoidHand, clock: number, stateName: VoidHandState = "hover") => {
  const home = voidHandHome(hand.side);
  hand.x = home.x;
  hand.y = home.y;
  hand.state = stateName;
  hand.at = clock;
};
/** send every hand back to its side */
export const homeVoidHands = (state: VoidState, clock: number, stateName: VoidHandState = "hover") => {
  for (const hand of state.hands) homeVoidHand(hand, clock, stateName);
};
/** the hand slam shakes the floor this long */
export const VOID_HAND_QUAKE_S = 0.8;
/** the roar's sound wave shakes the floor this long */
export const VOID_ROAR_QUAKE_S = 0.5;
/** the killing blow: game time crawls at this scale for this many REAL seconds (so the clock span is the product) */
export const VOID_FINAL_SLOW_S = 0.6;
export const VOID_FINAL_TIME_SCALE = 0.25;
export const VOID_FINAL_SLOW_CLOCK_S = VOID_FINAL_SLOW_S * VOID_FINAL_TIME_SCALE;
export const VOID_FINAL_CAPTION = "FINAL BLOW";
export const VOID_BANNER_FINAL_S = 1.4;

// ---- minions -----------------------------------------------------------------------------------------------------
export const VOID_MINION_LIFE_S = 8;
export const VOID_MINION_POOF_S = 0.35;
export const VOID_MINION_SPEED = 26;
/** a minion within this many px of a raider strikes it, then waits before it can strike again */
export const VOID_MINION_REACH_PX = 10;
export const VOID_MINION_STRIKE_EVERY_S = 2.5;
/** minions per summon (phase 1, later) and where they rise relative to the boss */
export const VOID_MINIONS_CALM = 2;
export const VOID_MINIONS_ANGRY = 3;
const MINION_SPOTS: readonly { dx: number; dy: number }[] = [
  { dx: -30, dy: 14 },
  { dx: -30, dy: -14 },
  { dx: -42, dy: 0 },
];
export const voidMinionCount = (phase: VoidPhase): number =>
  phase === "fight" ? VOID_MINIONS_CALM : VOID_MINIONS_ANGRY;
/** rise `count` minions beside the boss (free slots only) */
export const raiseVoidMinions = (state: VoidState, clock: number, count: number): number => {
  let raised = 0;
  for (const slot of state.minions) {
    if (raised >= count) break;
    if (slot.on) continue;
    const spot = MINION_SPOTS[raised % MINION_SPOTS.length];
    slot.on = true;
    slot.x = state.x + spot.dx;
    slot.y = VOID_FEET_Y + spot.dy;
    slot.bornAt = clock;
    slot.clearedAt = -99;
    slot.strikeAt = clock;
    raised++;
  }
  return raised;
};
export const voidMinionsAlive = (state: VoidState): number => {
  let alive = 0;
  for (const minion of state.minions) if (minion.on && minion.clearedAt < 0) alive++;
  return alive;
};
/** a raider's hit kills the oldest living minion; returns it or null */
export const clearVoidMinion = (state: VoidState, clock: number): VoidMinion | null => {
  let best: VoidMinion | null = null;
  for (const minion of state.minions)
    if (minion.on && minion.clearedAt < 0 && (!best || minion.bornAt < best.bornAt)) best = minion;
  if (best) best.clearedAt = clock;
  return best;
};

// ---- where the raiders stand in the Sanctum ----------------------------------------------------------------------
/** the arc in front of the boss (left of him): melee classes close in, ranged classes keep a bit back */
const SPOT_R_MELEE = 30;
const SPOT_R_RANGED = 52;
const SPOT_R_RING = 16;
const SPOT_PER_RING = 8;
const SPOT_SPAN_DEG = 62;
const SPOT_SQUASH = 0.62;
const SPOT_FRONT_DX = 12;
const SPOT_ANGLE_ORDER = "34251607".split("").map(Number);
const SPOT_ANGLE_STEPS = 7;
const DEG_PER_PI = 180;
const RANGED_CLASSES = new Set(["mage", "ranger"]);
/** the transformation shockwave (TRUE FORM, THE VOID AWAKENS) pushes the raiders back to a farther stand: ring 1 / 2 */
export type VoidSpotRing = 0 | 1 | 2;
/** ring 1 (phase 2): the arc, much farther from the boss */
const SPOT_R_MELEE_FAR = 80;
const SPOT_R_RANGED_FAR = 105;
/** ring 2 (phase 3): a row along the FRONT edge of the arena (large y, nearest the viewer, below the colossus chest),
 * VOID_FRONT_PER_ROW raiders wide; extra rows stack back toward the colossus */
export const VOID_FRONT_PER_ROW = 6;
const VOID_FRONT_MARGIN_X = 25;
const VOID_FRONT_MARGIN_Y = 12;
export const VOID_FRONT_X0 = VOID_ARENA_X0 + VOID_FRONT_MARGIN_X;
export const VOID_FRONT_DX = 26;
export const VOID_FRONT_Y = VOID_ARENA_Y1 - VOID_FRONT_MARGIN_Y;
export const VOID_FRONT_ROW_DY = 12;
/** seconds the raiders slide back to their new stand */
export const VOID_PUSHBACK_S = 0.6;
/** the Sanctum spot of the raider in slot `slot` of class `cls` on `spotRing` (writes into `out`) */
export const voidSpotOf = (slot: number, cls: string, out: { x: number; y: number }, spotRing: VoidSpotRing = 0) => {
  const index = Math.max(0, Math.floor(slot));
  if (spotRing === 2) {
    out.x = VOID_FRONT_X0 + (index % VOID_FRONT_PER_ROW) * VOID_FRONT_DX;
    out.y = VOID_FRONT_Y - Math.floor(index / VOID_FRONT_PER_ROW) * VOID_FRONT_ROW_DY;
    return;
  }
  const ring = Math.floor(index / SPOT_PER_RING);
  const step = SPOT_ANGLE_ORDER[index % SPOT_PER_RING];
  const angle = (((step / SPOT_ANGLE_STEPS) * 2 - 1) * SPOT_SPAN_DEG * Math.PI) / DEG_PER_PI;
  const ranged = RANGED_CLASSES.has(cls);
  const base = spotRing === 1 ? (ranged ? SPOT_R_RANGED_FAR : SPOT_R_MELEE_FAR) : ranged ? SPOT_R_RANGED : SPOT_R_MELEE;
  const radius = base + ring * SPOT_R_RING;
  out.x = Math.round(VOID_HOME_X - SPOT_FRONT_DX - radius * Math.cos(angle));
  out.y = Math.round(VOID_FEET_Y + radius * Math.sin(angle) * SPOT_SQUASH);
  if (spotRing === 1) {
    out.x = Math.max(VOID_ARENA_X0, out.x);
    out.y = Math.min(VOID_ARENA_Y1, Math.max(VOID_ARENA_Y0, out.y));
  }
};
/** seconds the raiders take to walk from the B3 ring up to their Sanctum spots (from the start of the reveal) */
export const VOID_STEP_S = 2;
