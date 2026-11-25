import type { ChronicleSnapshot } from "@/lib/chronicle";
import { m } from "@/paraglide/messages";

import { aiInfo, isAiSource, type AiInfo, type AiSource } from "./aiLabel";
import type { SfxCue } from "./audio";
import { bossCenterX, BOSS_H, BOSS_W } from "./bossSprites";
import { CRYPT_KINDS, type CryptKind } from "./cryptSprites";
import { doingLine, type Doing } from "./doingText";
import { ToolTally, type DungeonStats } from "./dungeon";
import { LORD_H } from "./dungeonLordSprite";
import {
  DUNGEON_FLOORS,
  dungeonLordPoint,
  dungeonSpotIndex,
  dungeonMonsterPoint,
  dungeonSpotOf,
  dungeonStairsPoint,
} from "./dungeonScene";
import { GEAR_TIER_LEVELS, gearTier } from "./gearTier";
import type { GmIconId } from "./gmIcons";
import { HallLife } from "./hallLife";
import {
  ALLY_GATE_MOUTH,
  DESK_COUNT,
  DUEL_HALF,
  WORLD_H,
  HALL_W,
  WORLD_W,
  CH_H,
  CH_W,
  BARD_POS,
  CHEF_HOME,
  FEAST_TABLE,
  CHEF_PICKUP,
  CHEF_SERVE,
  DOOR,
  FEAST_SEATS,
  GATE_MOUTH,
  GUILD_MASTER_HOME,
  HEARTH,
  VIEW_W,
  VIEW_X0,
  duelMidOfDesks,
  guildMasterStand,
  monsterSpot,
  routeBoss,
  routeFromAllyGate,
  routeIn,
  routeLeave,
  routeFromDungeon,
  routeToAllyGate,
  routeToDungeon,
  routeChefServe,
  routeGuildMaster,
  routeGuildMasterAnnounce,
  routeGuildMasterDoor,
  routeGuildMasterEscort,
  routeGuildMasterGate,
  routeGuildMasterHome,
  routeToBreak,
  seatPoint,
  squirePoint,
  type Pt,
} from "./layout";
import { parseRateLimit, type RateLimitInfo } from "./limitScene";
import {
  ATTACK_BREATH,
  ATTACK_METEOR,
  ATTACK_SLAM,
  ATTACK_SUMMON,
  BREATH_NEAR_PX,
  ENRAGE_BELOW,
  FIRST_ATTACK_S,
  LORD_HITSTOP_S,
  METEORS_CALM,
  METEORS_ENRAGED,
  METEOR_BLAST_PX,
  MINION_LIFE_S,
  MINION_POOF_S,
  MOUTH_DX,
  MOUTH_DY,
  TAUNTS,
  WAVE_DX,
  WAVE_SPEED,
  WAVE_SQUASH,
  addSlash,
  beginAttack,
  clearMinion,
  deathLength,
  freshLord,
  growPool,
  LORD_HP_BASE,
  lordMaxHp,
  nextAttackGap,
  pickAttack,
  planMeteors,
  raiseMinions,
  resetFight,
  stopAttacks,
  type DungeonLord,
} from "./lordFight";
import { MON_H, MON_W } from "./monsterSprites";
import {
  BOSS_KINDS,
  lookFor,
  MONSTER_KINDS,
  type AdvClass,
  type BossKind,
  type Look,
  type MonsterKind,
} from "./palette";
import { BoardNotes, sanitizeQuests, type QuestMsgRow } from "./questNotes";
import { drawScene } from "./render";
import {
  VOID_ASCEND_S,
  VOID_BANNER_AWAKENS_S,
  VOID_BANNER_S,
  VOID_BANNER_TRUE_FORM_S,
  VOID_BANNER_VICTORY_S,
  VOID_BAR_EASE,
  VOID_BEAM_HALF_PX,
  VOID_BLINK_DX,
  VOID_BODY_H,
  VOID_COIN_COUNT,
  VOID_CORE_HIT_H,
  VOID_CORE_HIT_W,
  VOID_CORE_OPEN_S,
  VOID_COIN_SPREAD,
  VOID_CRACK_EVERY_S,
  VOID_CRIT_POP_S,
  VOID_CRIT_POP_SCALE,
  VOID_DEATH_CRACK_S,
  VOID_DEATH_IMPLODE_S,
  VOID_DODGE_CHANCE,
  VOID_DYING_S,
  VOID_ECLIPSE_DODGED_HEARTS,
  VOID_ECLIPSE_HIT_HEARTS,
  VOID_ECLIPSE_HURT_S,
  VOID_EYE_CRACK_S,
  VOID_EYE_SHATTER_S,
  VOID_FEET_Y,
  VOID_FIRST_ATTACK_P2_S,
  VOID_FIRST_ATTACK_P3_S,
  VOID_FIRST_ATTACK_S,
  VOID_FX_CRACK,
  VOID_FX_CRIT,
  VOID_FX_EYE,
  VOID_FX_FLASH,
  VOID_FX_HIT,
  VOID_FX_HURT,
  VOID_FX_IMPLODE,
  VOID_FX_REVEAL,
  VOID_FX_ROAR,
  VOID_FX_SHATTER,
  VOID_GOLD,
  VOID_HAND_RISE_S,
  VOID_HAND_SINK_S,
  VOID_HAND_SLAM_S,
  VOID_HEART_FLOOR,
  VOID_HOME_X,
  VOID_HP_MULT,
  VOID_HURT_S,
  VOID_KILLS,
  VOID_LINE_DYING,
  VOID_LINE_PHASE2,
  VOID_LINE_PHASE3,
  VOID_LINE_RETREAT,
  VOID_LINE_SHATTER,
  VOID_LINES_REVEAL,
  VOID_PHASE2_BELOW,
  VOID_PHASE3_BELOW,
  VOID_POP_JITTER,
  VOID_POP_LIFT,
  VOID_POP_RISE,
  VOID_PRAISE_TEXT,
  VOID_REVEAL_S,
  VOID_RETREAT_S,
  VOID_SHAKE_ASCEND,
  VOID_SHAKE_BEAM,
  VOID_SHAKE_COLLAPSE,
  VOID_SHAKE_CRIT,
  VOID_SHAKE_DEATH,
  VOID_SHAKE_DECAY,
  VOID_SHAKE_ECLIPSE,
  VOID_SHAKE_EYE_SHATTER,
  VOID_SHAKE_GAZE,
  VOID_SHAKE_HAND,
  VOID_SHAKE_FLASH,
  VOID_SHAKE_REVEAL,
  VOID_SHAKE_SHATTER,
  VOID_SHAKE_TRUE_FORM,
  VOID_SHAKE_VICTORY,
  VOID_SHAKE_WIPE,
  VOID_SHATTER_S,
  VOID_SHOWER_COINS,
  VOID_STEP_FLASH,
  VOID_STEP_IMPLODE,
  VOID_TRUE_FORM_S,
  VOID_VICTORY_S,
  VOID_WIPE_MID_S,
  VOID_WIPE_S,
  VOID_XP,
  beginVoidAttack,
  damageVoid,
  homeVoidHand,
  homeVoidHands,
  freshVoidCtl,
  pickVoidAttack,
  resetVoid,
  setVoidPhase,
  spawnVoidEyes,
  stopVoidAttack,
  voidAttackPhase,
  voidBeamArrive,
  voidCollapseAt,
  voidCoreX,
  voidCoreY,
  voidGazeX,
  voidHandFor,
  voidEyeCount,
  voidFightingPhase,
  voidHpFrac,
  voidInvulnerable,
  voidNextGap,
  voidPhaseAge,
  voidPhaseProgress,
  voidSay,
  voidVoice,
  VOID_ARENA_X0,
  VOID_ARENA_X1,
  VOID_ARENA_Y0,
  VOID_ARENA_Y1,
  VOID_BLINK_STAY_S,
  VOID_BODY_W,
  VOID_HIT_Y_MAX,
  VOID_HIT_Y_MIN,
  VOID_MENACE_EVERY_S,
  VOID_MINION_LIFE_S,
  VOID_MINION_LIFT_PX,
  VOID_MINION_POOF_S,
  VOID_MINION_REACH_PX,
  VOID_MINION_SPEED,
  VOID_MINION_STRIKE_EVERY_S,
  VOID_PUSHBACK_S,
  VOID_QUAKE_S,
  VOID_HAND_QUAKE_S,
  VOID_STEP_S,
  VOID_TAUNT_EVERY_S,
  clearVoidMinion,
  cutVoidBeats,
  raiseVoidMinions,
  takeVoidBeat,
  voidStageFree,
  voidMinionCount,
  voidMinionsAlive,
  voidNextTaunt,
  voidSpotOf,
  voidTauntLine,
  type VoidCtl,
} from "./voidFight";
import { VOID_FLOOR, voidIdle, type VoidMinion, type VoidState } from "./voidTypes";

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

// -- level tiers (gearTier.ts): crit chance, flat damage and the class skill every few hits
const CRIT_PER_TIER = 0.03;
/** flat bonus damage = floor(tier / this): T2 +1, T4 +2 */
const BONUS_TIER_DIV = 2;
const SKILL_MIN_TIER = 1;
/** a hit is the class skill every N hits: 6 at the low tiers, 4 from the elite tier up */
const SKILL_EVERY_LOW = 6;
const SKILL_EVERY_HIGH = 4;
const SKILL_HIGH_FROM_TIER = 3;
const LEGEND_TIER = 4;
const SKILL_DAMAGE_MULT = 2;
const SMITE_BONUS = 1;
const VOLLEY_ARROWS = 3;
const SMITE_HEAL = 1;
/** seconds each skill effect lives (its popup name floats the whole time) */
const SKILL_FX_S = 1;
const SKILL_FX_S_LEGEND = 1.25;
/** impact: the caster and target freeze this long (not under reduced motion) */
const SKILL_HITSTOP_S = 0.08;
const TRAUMA_SKILL = 0.3;
const TRAUMA_SKILL_LEGEND = 0.45;
const SKILL_FX_MAX = 16;
/** a cleave knocks a field monster back this many times longer than a normal hit */
const CLEAVE_KNOCK_MULT = 3;
const SKILL_BURST = { n: 10, speed: 70, gravity: 80, life: 0.45 };
const SKILL_BURST_LEGEND_N = 18;
const TIER_RING_N = 36;
const TIER_RING_SPEED = 80;
const TIER_RING_LIFE = 1;
const DEMO_LV_NOVICE = 3;
const DEMO_LV_ADEPT = 7;
const DEMO_LV_VETERAN = 12;
const DEMO_LV_ELITE = 17;
const DEMO_LV_LEGEND = 22;
/** demo adventurers cycle through these levels so every tier's gear and skills show up */
const DEMO_LEVELS: readonly number[] = [DEMO_LV_NOVICE, DEMO_LV_ADEPT, DEMO_LV_VETERAN, DEMO_LV_ELITE, DEMO_LV_LEGEND];

export type SkillKind = "cleave" | "fireball" | "backstab" | "smite" | "volley";
/** the class skill each adventurer class unlocks at the adept tier */
export const CLASS_SKILL: Record<AdvClass, SkillKind> = {
  warrior: "cleave",
  mage: "fireball",
  rogue: "backstab",
  cleric: "smite",
  ranger: "volley",
};
const SKILL_SFX: Record<SkillKind, SfxCue> = {
  cleave: "skillCleave",
  fireball: "skillFire",
  backstab: "skillStab",
  smite: "skillSmite",
  volley: "skillVolley",
};
const SKILL_NAME: Record<SkillKind, string> = {
  cleave: "CLEAVE!",
  fireball: "FIREBALL!",
  backstab: "BACKSTAB!",
  smite: "SMITE!",
  volley: "VOLLEY!",
};
/** banner / overhead text when an adventurer crosses into a tier (index = tier; novice never fires) */
const TIER_UP_TEXT: readonly string[] = ["", "ADEPT!", "VETERAN!", "ELITE!", "LEGEND!"];
/** what the guild master says when he walks over to congratulate a tier-up (by class) */
const TIER_PRAISE_TEXT: Record<AdvClass, string> = {
  warrior: "WELL FOUGHT",
  mage: "WELL CAST",
  rogue: "SMOOTH WORK",
  cleric: "BLESSED",
  ranger: "TRUE AIM",
};

export interface TierStats {
  /** crit chance per hit */
  crit: number;
  /** flat damage added to every hit (before the crit doubles it) */
  bonus: number;
  /** every Nth hit is the class skill (0 = no skill yet) */
  every: number;
}
/** combat stats per gear tier (0 novice .. 4 legend): tier 0 is exactly the old 10% crit, +0 damage, no skill */
export const TIER_STATS: readonly TierStats[] = GEAR_TIER_LEVELS.map((_, tier) => ({
  crit: CRIT_CHANCE + CRIT_PER_TIER * tier,
  bonus: Math.floor(tier / BONUS_TIER_DIV),
  every: tier < SKILL_MIN_TIER ? 0 : tier >= SKILL_HIGH_FROM_TIER ? SKILL_EVERY_HIGH : SKILL_EVERY_LOW,
}));
export const tierStats = (level: number): TierStats => TIER_STATS[gearTier(level)];

/** one class-skill or tier-up visual (opaque pixels, drawn by lordFx.drawSkillFx); the damage is already applied */
export interface SkillFx {
  kind: SkillKind;
  /** pixel-font text floating over the caster */
  text: string;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  born: number;
  dur: number;
  /** legend tier: the bigger, gold variant */
  gold: boolean;
  /** cleric healed a heart */
  heal: boolean;
  /** id of the adventurer who cast it (one name plate at a time per adventurer) */
  owner: string;
  /** a newer skill of the same owner took over the name plate: this one draws no text any more */
  noText: boolean;
  /** dungeon floor the effect lives on (0 = the field) */
  dungeon: number;
}
/** the result of one hit roll */
export interface HitRoll {
  dmg: number;
  crit: boolean;
  skill: SkillKind | null;
}
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
const DRINK_S = 7;
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
/** a pop above a raider's head */
const POP_ABOVE_HEAD = 28;
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
const COMPACT_REST_S = 7;
const COMPACT_BUBBLE_S = 2;
const MANA_FLASH_S = 1.2;
const GATE_BURST = { n: 12, speed: 40, up: 30, life: 0.7 };
const GATE_PUFF = { n: 6, speed: 18, up: 14, life: 0.5, lift: 3 };
const REFILL_LIFE = 0.6;
const DUST_PUFF_COLS = ["#d8c8a0", "#b59a6a", "#f2e8cf"];
const GATE_COLS = ["#ff5a5a", "#ffb870", "#6a2a7a"];
const WARM_COLS = ["#f2c14e", "#ffe9a0", "#ffb050", "#ffffff"];
const MANA_REFILL_BURST = { n: 10, speed: 30, lift: 10 };
const LEAVER_MAX = 12;

// -- the guild hall's west wing: feast table, chef, cheers, feast, bard
/** sim seconds of "busy" the chef looks back over, and how a busy guild shortens the wait between two plates */
const BUSY_WINDOW_S = 120;
const SERVE_IDLE_S = 40;
const SERVE_MIN_S = 8;
const SERVE_PER_EVENT_S = 0.8;
const SERVE_FEAST_S = 3;
const SERVE_RETRY_S = 2;
/** a plate stays on the table this long (or until its diner leaves) */
const DISH_LIFE_S = 16;
const DISH_KINDS = 4;
/** how long mugs stay up (sim seconds) and the Cheers! pill stays on screen (real seconds) */
export const CHEERS_S = 2.6;
const CHEERS_SPARKS = { n: 10, speed: 34, gravity: 60, life: 0.9, lift: 30 };
/** "done" receipts from this many different sessions inside FEAST_WINDOW_S start a feast */
const FEAST_MIN_DONE = 2;
const FEAST_WINDOW_S = 60;
const FEAST_S = 16;
const FEAST_COOLDOWN_S = 90;
const CONFETTI_COLS = ["#d95763", "#f2c14e", "#4a6fa5", "#5fa55a", "#ffffff", "#7b5ea7"];
const CONFETTI_PER_S = 22;
const CONFETTI_X0 = -90;
const CONFETTI_X1 = -8;
const CONFETTI_Y = 54;
const CONFETTI_VY = 22;
const CONFETTI_LIFE = 3.2;
const NOTE_EVERY_S = 0.9;
const NOTE_JITTER_MIN = 0.7;
const NOTE_JITTER_MAX = 1.3;
const NEVER_S = -99;
const MINUTES_PER_HOUR = 60;
const NOTE_VX = 6;
const NOTE_VY_MIN = 10;
const NOTE_VY_MAX = 14;
const NOTE_LIFE = 1.6;
const NOTE_LIFT = 30;
const NOTE_DX = 6;
const BARD_REST_COUNT = 1;
const BUSY_EVENTS = new Set(["PreToolUse", "PostToolUse", "UserPromptSubmit"]);
const BUSY_MAX = 600;
const CHEF_FACE_HOME = 1;

// -- the guild master: waits at home, now and then walks out to talk to an adventurer
/** sim seconds he waits at home between two visits (jittered), and how soon he looks again when nobody can be visited */
const GM_IDLE_MIN_S = 12;
const GM_IDLE_MAX_S = 20;
const GM_RETRY_S = 3;
/** sim seconds he stands and talks */
const GM_TALK_S = 4;
/** a duel closer than this to his stand point makes the visit unsafe */
const GM_CLEAR_R = 34;
/** rows above a monster / boss sprite taken by its HP bar (plus the outline) */
const GM_MON_BAR_H = 6;
const GM_BOSS_BAR_H = 7;
const GM_FACE_HOME = 1;
/** the first visit comes sooner than the later ones: after a visit he waits this long (jittered) before a calm patrol */
const GM_CALM_MIN_S = 25;
const GM_CALM_MAX_S = 40;
/** a tool in flight longer than this makes its adventurer "stuck" */
const GM_STUCK_S = 90;
/** a stopped session waiting for a prompt longer than this is "idle" */
const GM_IDLE_REPORT_S = 300;
/** permission / question pending longer than this makes him ring the door bell; the ring repeats at this gap */
const GM_BELL_AFTER_S = 120;
/** the same wait in whole minutes, for the desktop notification text */
export const GM_BELL_AFTER_MIN = GM_BELL_AFTER_S / SECONDS_PER_MINUTE;
const GM_BELL_EVERY_S = 20;
/** pause between two urgent trips, and how long before he visits the same session for the same reason again */
const GM_URGENT_GAP_S = 6;
const GM_REVISIT_S = 90;
const GM_REVISIT_LOW_S = 240;
/** how often the report is rebuilt (clock seconds) */
const GM_SCAN_S = 0.5;
const GM_REPORT_DETAIL_MAX = 48;
const GM_ANNOUNCE_S = 5;
const GM_ANNOUNCE_TEXT = "DAILY REPORT";
const GM_EVENING_HOUR = 18;
const GM_QUIET_S = 300;
const GM_PRAISE_FRESH_S = 60;
const GM_PRAISE_MAX = 4;
/** tier-up praise rides in front of the receipt praise, so the whole queue may hold twice as many */
const GM_PRAISE_CAP = GM_PRAISE_MAX * 2;
/** dispatcher: he talks to a raid-ready adventurer this long; the raid never waits longer than DISPATCH_MAX_S for him */
const GM_DISPATCH_TALK_S = 1.5;
const GM_DISPATCH_MAX_S = 9;
const GM_ESCORT_POINT_S = 1.5;
const GM_RANK: Record<GmReason, number> = {
  permission: 0,
  question: 1,
  limit: 2,
  loop: 3,
  stuck: 4,
  idle: 5,
  compact: 6,
};
const GM_LAST_URGENT = 4;

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
  /** StopFailure: what ended the turn (e.g. "rate_limit") */
  error?: string;
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

export type AttentionKind = "permission" | "loop" | "asked" | "context" | "done" | "limit";
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
  /** limit: the reset text ("3pm (Asia/Bangkok)") */
  detail?: string;
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
const SFX_QUEUE_MAX = 32;
/** seconds a banner stays up unless it asks for longer */
const BANNER_DEFAULT_S = 2.5;
const ATTN_KINDS: readonly string[] = ["permission", "loop", "asked", "context", "done", "limit"];
const ATTN_DETAIL_MAX = 60;
/** longest model id kept per adventurer */
const MODEL_MAX = 80;
const META_PENDING_MAX = 64;
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
  chronicle?: ChronicleSnapshot;
  attention?: AttentionMsgRow[];
  receipts?: ReceiptMsgRow[];
  /** Quest Board: each session's todo list (full replacement) */
  quests?: QuestMsgRow[];
  territory?: TerritoryMsg;
  sessions?: {
    session_id: string;
    cwd?: string;
    interns?: string[];
    context?: CtxMsg | null;
    waiting?: boolean;
    /** which agent tool the session belongs to */
    source?: AiSource;
    /** raw model id, e.g. "claude-opus-5-5" */
    model?: string | null;
    /** plan usage limit the session hit (null / absent = none) */
    rateLimit?: RateLimitInfo | null;
  }[];
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
  | "TO_TAVERN_REST"
  | "AT_TAVERN_REST"
  | "FROM_TAVERN_REST"
  | "TO_RAID"
  | "FROM_RAID";

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
  /** clock time the raider last hopped out of the way of a Dungeon Lord attack (-99 = never) */
  dodgeAt: number;
  /** clock time a Veiled One attack last landed on this raider (-99 = never) and which way they are knocked (-1 left, 1 right) */
  voidHitAt: number;
  voidKnock: number;
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
  /** clock time of the last tier-up (-99 = never); the rise / pillar / gear-pop animation reads it */
  tierUpAt: number;
  lungeUntil: number;
  flashUntil: number;
  monLungeUntil: number;
  monKnockUntil: number;
  /** a cleave knocks the field monster back further until then */
  monFarKnockUntil: number;
  /** hits landed since the last class skill */
  skillHits: number;
  /** rogue backstab dash started at (clock; -99 = never) */
  dashAt: number;
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
  /** name of the last tool this session started (for the guild master's report) */
  lastTool: string;
  /** main agent's current/last tool (squire tools never land here); null once the turn ends */
  doing: Doing | null;
  /** PreCompact seen: the next context reading is the post-compact one (mana bar flashes when it lands) */
  compactPending: boolean;
  /** seated overflow adventurer that has arrived inside the dungeon (hidden on the field, drawn in the dungeon scene) */
  inDungeon: boolean;
  /** a battle-spot adventurer that walked into the dungeon after heavy work: keeps deskIdx, stands inside (state SEATED) */
  raidIn: boolean;
  /** dungeon spot index of a desk raider (overflow raiders use their slot; -1 = none) */
  raidSlot: number;
  /** tool calls since this adventurer last raided (or arrived): enough of them send it raiding */
  raidCalls: number;
  /** clock time the adventurer last came back from a raid (or arrived) */
  raidSince: number;
  /** clock time the raider went inside (desk raiders only; -1 = not raiding) */
  raidEnteredAt: number;
  /** clock time the Dungeon Lord fell (or was found down) while this raider stood on B3; -1 = not yet */
  raidDoneAt: number;
  /** the foe a raider is fighting inside (null unless inDungeon): kind = index into MONSTER_KINDS (CRYPT_KINDS on B2), hp 0..1, clock times of the last hit / death */
  raid: RaidFoe | null;
  /** dungeon floor the raider is on, 1..3 (reset to 1 whenever they leave the dungeon) */
  floor: number;
  /** kills on the current floor (the Kth one sends them down the stairs) */
  floorKills: number;
  /** clock time the raider started walking to the stairs (-1 = not descending) */
  stairsAt: number;
  /** index into FEAST_SEATS used by a break / rest trip (-1 = beside the counter) */
  restSpot: number;
  manaFlashUntil: number;
  /** raising a mug at the feast table until this clock time */
  cheerUntil: number;
  /** which agent tool + model this session runs */
  source: AiSource;
  model: string | null;
  /** plan usage limit the session is stuck behind (null = none): the adventurer sits exhausted until it clears */
  rateLimit: RateLimitInfo | null;
}

/** a raider's current dungeon foe */
export interface RaidFoe {
  /** index into MONSTER_KINDS (B1) or, when `crypt` is set, into CRYPT_KINDS (B2) */
  kind: number;
  hp: number;
  hitAt: number;
  deadAt: number;
  /** a floor 2 undead (kind indexes CRYPT_KINDS) */
  crypt: boolean;
}

export type { DungeonLord } from "./lordFight";

/** the guild's cook: stirs at the hearth, carries a plate to the feast table now and then */
export interface Chef {
  x: number;
  y: number;
  face: 1 | -1;
  /** waypoints still to walk (empty = at the hearth) */
  path: Pt[];
  holdUntil: number;
  /** kind of the dish in the chef's hands (-1 = empty-handed) */
  plate: number;
  /** feast seat the plate is for */
  target: number;
}
/** why the guild master wants an adventurer's attention, most urgent first */
export type GmReason = "permission" | "question" | "limit" | "loop" | "stuck" | "idle" | "compact";
/** one line of the guild master's report */
export interface GmReportRow {
  id: string;
  tag: string;
  project: string;
  reason: GmReason;
  /** office clock seconds when the reason began */
  since: number;
  /** short, already redacted tool name or attention text */
  detail: string;
}
/** Office.hit() returns this when the pointer is over the guild master on the guild scene */
export const GM_HIT_ID = "__guild_master__";
/** one planned trip of the guild master (`text` = what he says on a praise visit, "" = just the thumbs-up) */
interface GmPlan {
  mission: GmMission;
  emp: Employee | null;
  reason: GmReason | null;
  text?: string;
}
export type GmMission = "none" | "visit" | "praise" | "gate" | "door" | "announce" | "dispatch" | "escort";
/** the guild master: stands at his post, walks out to an adventurer (the Lookout Bell's first), talks, walks back */
export interface GuildMaster {
  x: number;
  y: number;
  face: 1 | -1;
  /** waypoints still to walk (empty = standing still) */
  path: Pt[];
  phase: "home" | "out" | "talk" | "back" | "escort";
  /** what the current trip is for */
  mission: GmMission;
  /** why (null = a calm patrol) */
  reason: GmReason | null;
  /** what his bubble shows ("dots" = a calm "..."; null = no bubble) */
  icon: GmIconId | "dots" | null;
  /** pixel-font text of the announcement bubble ("" = none) */
  text: string;
  /** session he is visiting ("" = none) */
  targetId: string;
  /** battle spot of that session when he set out (-1 = none): a reseat sends him home */
  targetDesk: number;
  /** the visit is for someone who needs the user (draws "!" instead of "...") */
  alert: boolean;
  /** clock time he next sets out (while home) / stops talking (while talking) */
  until: number;
}
/** a plate on the feast table in front of one seat */
export interface Dish {
  kind: number;
  at: number;
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
  /** raider effect: the dungeon floor (1..3) it lives on, drawn only there; 0 = the field */
  dungeon: number;
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
  /** bitmap-font scale of a dungeon popup (0 = by `big`: 1 or 2) */
  scale: number;
  /** raider effect: the dungeon floor (1..3) it lives on; 0 = the field */
  dungeon: number;
}
export interface Banner {
  kind: "quest" | "boss" | "tier";
  text: string;
  /** drawn in the bitmap font (when it can draw the text) */
  pixel?: boolean;
  start: number;
  dur: number;
  /** the secret boss's banners: drawn bigger than any other (the renderer decides how) */
  epic?: boolean;
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
/** seconds a slain dungeon foe lies there before the next one steps up */
const RAID_RESPAWN_S = 1.2;
/** kills on a floor that send a raider down to the next one */
export const RAID_FLOOR_KILLS = 3;
/** seconds a raider spends walking to the stairs before they appear one floor down */
export const RAID_STAIRS_S = 1.4;
/** floor 2 foes have this many times a monster's base hp */
/** floor 2 undead hp (tougher than any B1 monster; the mix averages 7.5, the same effort B2 always cost) */
const CRYPT_HP: Record<CryptKind, number> = { wraith: 6, ghoul: 8, banshee: 6, revenant: 10 };
/** tool calls since the last raid that send a battle-spot adventurer into the dungeon */
export const RAID_READY_CALLS = 40;
/** sim seconds of work since the last raid that send it in even with fewer calls (~25 minutes) */
export const RAID_READY_S = 1500;
/** a seated adventurer must have sat this long before it can set out raiding (sim seconds) */
const RAID_SETTLE_S = 2;
/** the timed trigger needs at least this many tool calls (an idle session never raids on time alone) */
const RAID_TIMED_MIN_CALLS = 10;
/** a desk raider walks home this long after the Lord fell (or after it found him down) */
export const RAID_LINGER_S = 4;
/** a desk raider walks home after this long inside, whatever happened (sim seconds) */
export const RAID_MAX_S = 900;
/** ... or when its session sent nothing for this long (sim seconds) */
export const RAID_IDLE_S = 75;
/** floor 2 draws its foes from the scarier half of the bestiary */
/** damage points a LONE raider needs to bring the Dungeon Lord down (+LORD_HP_PER_EXTRA for every further raider on B3; see lordFight.ts) */
export const LORD_HP = LORD_HP_BASE;
/** seconds the Lord stays down before it rises again */
export const LORD_RESPAWN_S = 90;
/** gold every raider standing on floor 3 gets when the Lord falls */
export const LORD_GOLD = 80;
/** seconds between the Lord's strikes back at a raider (cosmetic), and how long the ember slam lasts */
export const LORD_STRIKE_EVERY_S = 3.2;
export const LORD_STRIKE_S = 0.6;
const LORD_STRIKE_HURT_S = 0.5;
const LORD_STRIKE_SPARKS = { n: 10, speed: 70, gravity: 60, life: 0.5 };
const LORD_HIT_SPARKS = { n: 10, speed: 65, gravity: 90, life: 0.5 };
const LORD_HIT_POP_LIFT = 4;
/** the hp bar eases at this rate per second */
const LORD_BAR_EASE = 8;
/** the Lord's floor shake fades at this rate per second; how hard each moment shakes it (0..1) */
const LORD_SHAKE_DECAY = 2.4;
const LORD_INTRO_SHAKE = 0.7;
const LORD_SLAM_SHAKE = 0.6;
const LORD_METEOR_SHAKE = 0.3;
const LORD_CRIT_SHAKE = 0.3;
const LORD_ENRAGE_SHAKE = 0.6;
const LORD_DEATH_SHAKE = 0.35;
const LORD_FINALE_SHAKE = 0.9;
/** seconds after the enrage before his next attack at the latest */
const ENRAGED_FIRST_S = 1.6;
/** the breath's flame stream takes this long to run from his mouth to its target */
const LORD_BREATH_REACH_S = 0.3;
const LORD_SLAM_RING = { n: 16, cols: ["#ff8a2a", "#ffd070", "#ff4a2a"], speed: 70, life: 0.5 };
const LORD_DUST = { n: 8, cols: ["#8a7a68", "#c4b8a4", "#5a4a3c"], speed: 30, gravity: 40, life: 0.5 };
const LORD_IMPACT = { n: 14, cols: ["#ff8a2a", "#ffd070", "#ff4a2a", "#fff3a0"], speed: 80, gravity: 70, life: 0.55 };
const LORD_BONE_BURST = { n: 8, cols: ["#efe6c8", "#c9b27a", "#ffffff"], speed: 60, gravity: 120, life: 0.5 };
const LORD_ENRAGE_BURST = { n: 22, cols: ["#ff4a2a", "#ff8a2a", "#ffd070"], speed: 95, gravity: 40, life: 0.7 };
const LORD_EMBERS = { n: 50, cols: ["#ff4a2a", "#ff8a2a", "#ffd070", "#fff3a0"], speed: 110, gravity: 60, life: 1.1 };
const LORD_BONE_LIFT = 8;
const LORD_HP_EPSILON = 1e-9;
const LORD_CRIT_SPARKS = { n: 18, speed: 85 };
const LORD_HIT_SPARK_DX = 8;
const LORD_CRIT_POP_S = 1.2;
const LORD_CRIT_POP_SCALE = 3;
const LORD_SHOWER_COINS = 56;
const LORD_SHOWER_HEIGHT = 70;
const LORD_SHOWER_VY_MIN = 10;
const LORD_SHOWER_VY_MAX = 40;
const LORD_SHOWER_GRAVITY = 130;
const LORD_SHOWER_LIFE = 2.4;
/** seconds the live Lord inset stays up after the Lord fell */
const LORD_PIP_AFTER_S = 5;
/** kills credited to each of them */
export const LORD_KILLS = 3;
const LORD_POP_LIFT = 30;
const LORD_COIN_COUNT = 24;
const LORD_COIN_SPREAD = 22;
/** the guild log kind of that event */
export const KIND_LORD = "guild:lord";
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
const MAX_PARTICLES = 300;
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
  /** the AI behind the adventurer: agent tool + model with ready-made display labels */
  ai: AiInfo;
  /** plan usage limit the session is stuck behind (null = none) */
  rateLimit: RateLimitInfo | null;
  /** "now doing" line of the main agent ("Edit engine.ts"), null when idle or the turn is over */
  doing: string | null;
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
  /** Quest Board: todo lists per session, most recently updated first */
  quests?: QuestView[];
  /** counters behind the dungeon-gate card */
  dungeon: DungeonStats;
  /** which view the canvas shows (the UI mirrors it: selecting a raider switches the scene) */
  scene: "guild" | "dungeon";
  /** the dungeon floor the scene shows (1..3) */
  dungeonFloor: number;
}
/** a session's todo list joined with the adventurer: `live` = that adventurer is still in the guild */
export interface QuestView extends QuestMsgRow {
  tag: string;
  /** the session's class colour (shirt) */
  color: string;
  look: Look;
  live: boolean;
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
  raiders: 0,
  raidersShown: 0,
  floorRaiders: [0, 0, 0],
  lordAlive: true,
  lordHp: 1,
  lordSlain: 0,
  lordFight: false,
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
  quests: [],
  dungeon: EMPTY_DUNGEON,
  scene: "guild",
  dungeonFloor: 1,
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
const dayKey = (date: Date): string => `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
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
  /** Quest Board (server state, full replacement) and the pinned notes drawn from it. Never persisted. */
  private quests: QuestMsgRow[] = [];
  private questVer = 0;
  readonly board = new BoardNotes();
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
  /** which view the canvas shows: the guild grounds or the inside of the dungeon */
  scene: "guild" | "dungeon" = "guild";
  /** sound cues waiting for the React sound hook (capped; the hook drains it, or clears it while sound is off) */
  readonly sfxQueue: SfxCue[] = [];
  private sfx(cue: SfxCue) {
    if (this.sfxQueue.length < SFX_QUEUE_MAX) this.sfxQueue.push(cue);
  }
  /** attention keys that were ringing the bell at the last snapshot (null until the first one: no ring on load) */
  private bellKeys: Set<string> | null = null;
  setScene(next: "guild" | "dungeon") {
    if (this.scene === next) return;
    if (next === "dungeon") this.dungeonFloor = this.busiestFloor(); // open on the floor with the most raiders
    this.scene = next;
    this.sfx(next === "dungeon" ? "enterDungeon" : "door");
    this.hoverId = null; // the hovered adventurer is not in the other scene
    this.dirty = true;
  }
  /** the dungeon floor on screen, 1..3 (default: the floor with the most raiders when the scene opens) */
  dungeonFloor = 1;
  setDungeonFloor(floor: number) {
    const next = Math.min(Math.max(1, Math.round(floor) || 1), this.voidOnFloor() ? VOID_FLOOR : DUNGEON_FLOORS);
    if (next === this.dungeonFloor) return;
    this.dungeonFloor = next;
    this.hoverId = null;
    this.bumpStats();
  }
  /** the floor holding the most visible raiders (ties go to the shallower one; B1 when nobody is inside) */
  busiestFloor(): number {
    const counts = this.floorCounts();
    let best = 1;
    for (let floor = 2; floor <= counts.length; floor++) if (counts[floor - 1] > counts[best - 1]) best = floor;
    return best;
  }
  /** visible raiders per floor (index 0 = B1) */
  floorCounts(): number[] {
    const counts = new Array<number>(this.voidOnFloor() ? VOID_FLOOR : DUNGEON_FLOORS).fill(0);
    for (const emp of this.employees.values())
      if (emp.inDungeon && !this.isHidden(emp) && emp.floor <= counts.length) counts[emp.floor - 1]++;
    return counts;
  }
  private pipShown = false;
  /** the Dungeon Lord on floor 3 */
  readonly lord: DungeonLord = freshLord();
  /** the secret final boss in the Void Sanctum (floor 4); only the engine writes it (rules: voidFight.ts) */
  readonly voidFight: VoidState = voidIdle();
  private voidCtl: VoidCtl = freshVoidCtl();
  /** the secret boss follows the Dungeon Lord's fall (tests of the Lord's own death sequence switch it off) */
  voidEnabled = true;
  private readonly lordBuf: Employee[] = [];
  private readonly voidBuf: Employee[] = [];
  /** where a raider stands right now: their spot on their floor, or on the way to the stairs while descending */
  raiderPoint(emp: Employee): Pt {
    if (emp.floor === VOID_FLOOR && emp.stairsAt < 0) return this.voidSpot(emp);
    const spot = dungeonSpotOf(this.raidSpotIndex(emp), emp.floor);
    if (emp.stairsAt < 0) return spot;
    const stairs = dungeonStairsPoint(emp.floor);
    const progress = Math.min(1, Math.max(0, (this.clock - emp.stairsAt) / RAID_STAIRS_S));
    return { x: spot.x + (stairs.x - spot.x) * progress, y: spot.y + (stairs.y - spot.y) * progress };
  }
  /** adventurers raiding inside the dungeon, in slot order (then arrival order) */
  dungeonRaiders(): Employee[] {
    const out: Employee[] = [];
    for (const emp of this.employees.values()) if (emp.inDungeon) out.push(emp);
    return out.sort(
      (first, second) => this.raidSpotIndex(first) - this.raidSpotIndex(second) || first.order - second.order,
    );
  }
  /** squires walking back into the ally gate */
  readonly leavers: Leaver[] = [];
  // ---- the west wing (render reads these) ----
  readonly chef: Chef = { x: CHEF_HOME.x, y: CHEF_HOME.y, face: 1, path: [], holdUntil: 0, plate: -1, target: -1 };
  readonly guildMaster: GuildMaster = {
    x: GUILD_MASTER_HOME.x,
    y: GUILD_MASTER_HOME.y,
    face: GM_FACE_HOME,
    path: [],
    phase: "home",
    mission: "none",
    reason: null,
    icon: null,
    text: "",
    targetId: "",
    targetDesk: -1,
    alert: false,
    until: GM_IDLE_MIN_S,
  };
  /** true while he rings the hand bell at the guild door (reduced motion: while the bell is due) */
  gmBellRinging = false;
  private gmRows: GmReportRow[] = [];
  private gmRowsAt = -Infinity;
  private gmBellDue = false;
  private gmNextRing = 0;
  private gmUrgentAt = 0;
  private readonly gmSeen = new Map<string, number>();
  private readonly gmCool = new Map<string, number>();
  private gmDispatch: { sid: string; deadline: number } | null = null;
  private gmPraise: { sid: string; at: number; text?: string }[] = [];
  /** what his bubble says during the current praise visit */
  private gmSayText = "";
  private gmDay = dayKey(new Date());
  private gmActiveDay = false;
  private gmEveningDay = "";
  private gmAnnounceAt = -Infinity;
  private gmAnnouncePending = false;
  private gmDayReadAt = -Infinity;
  /** the guild hall's cat, dog and regulars (render reads these) */
  readonly hall = new HallLife();
  private readonly hallWalkers: Pt[] = [];
  /** the local hour the hall life last saw, and the realTime it was read at */
  private hallHour = 0;
  private hallHourAt = -Infinity;
  /** reusable scratch points for the guild master's safety check (runs every frame while he is out) */
  private gmStandPt: Pt = { x: 0, y: 0 };
  private gmDuelPt: Pt = { x: 0, y: 0 };
  /** one slot per feast seat: the plate in front of it, if any */
  readonly dishes: (Dish | null)[] = FEAST_SEATS.map(() => null);
  /** reusable: the diners on screen and who sits in each feast seat (see feastDiners) */
  private readonly diners: Employee[] = [];
  readonly dinerSlots: (Employee | null)[] = FEAST_SEATS.map(() => null);
  /** clock time of the last cheers (and its text in the language it was raised in) */
  cheersAt = NEVER_S;
  /** realTime of the last cheers: the pill's lifetime follows the wall clock, so it never sticks while paused */
  cheersReal = NEVER_S;
  cheersText = "";
  /** the feast: clock time it started / ends (confetti, extra food) */
  feastAt = NEVER_S;
  feastUntil = 0;
  /** the bard plays while someone is resting or at the table */
  bardOn = false;
  private nextServeAt = 0;
  private nextNoteAt = 0;
  private confettiAcc = 0;
  private busyStamps: number[] = [];
  private doneStamps: { sid: string; at: number }[] = [];
  /** the ally gate doors stand open until this clock time (someone passes) / the doorway glows (a compact event) */
  allyDoorsUntil = 0;
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
  /** daily chronicle from the server (or the demo simulator) */
  private chron: ChronicleSnapshot | null = null;
  /** chronicle counters only the client can know, since the page opened (or the last Live/Demo switch) */
  private chronLocal = { levels: 0, raids: 0 };
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
    dungeon: 0,
  }));
  private pIdx = 0;
  /** while > 0, emitted particles / popups are tagged as effects of that dungeon floor (set by raider effect helpers) */
  private fxDungeon = 0;
  popups: Popup[] = [];
  /** class-skill and tier-up visuals (capped; render draws them with the popups) */
  skillFx: SkillFx[] = [];
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
    canvas.width = VIEW_W;
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
    this.canvas.width = VIEW_W * factor;
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
        const detail = row.kind === "limit" ? text(row.detail ?? row.error ?? row.tail, ATTN_DETAIL_MAX) : undefined;
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
          ...(detail ? { detail } : {}),
        });
      }
    }
    const keys = new Set(out.map((row) => row.key));
    for (const key of this.attnDismissed) if (!keys.has(key)) this.attnDismissed.delete(key);
    this.attn = out;
    const ringing = new Set(
      out.filter((row) => bellCount([row]) > 0 && this.employees.has(row.sid)).map((row) => row.key),
    );
    if (this.bellKeys && [...ringing].some((key) => !this.bellKeys!.has(key))) this.sfx("bell");
    this.bellKeys = ringing;
    this.bumpAttn();
  }
  /** Replace the daily chronicle (server frame or demo). Malformed input is ignored. */
  setChronicle(next: ChronicleSnapshot | null | undefined) {
    if (!next || typeof next !== "object" || !next.today || !next.yesterday) return;
    this.chron = next;
  }
  /** the daily chronicle plus the client-only counters (monsters slain, bosses defeated, raiders, levels gained) */
  chronicleView(): {
    server: ChronicleSnapshot | null;
    monsters: number;
    bosses: number;
    raids: number;
    levels: number;
  } {
    return {
      server: this.chron,
      monsters: this.stats.monsters,
      bosses: this.stats.bosses,
      raids: this.chronLocal.raids,
      levels: this.chronLocal.levels,
    };
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
      if (receipt.verdict === "done" || receipt.commits > 0) this.cheers();
      if (receipt.verdict === "done") this.noteDone(receipt.sid);
      if (receipt.verdict === "done" && this.gmPraise.length < GM_PRAISE_MAX)
        this.gmPraise.push({ sid: receipt.sid, at: this.clock });
      if (receipt.verdict === "done") this.sfx("questDone");
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
  /** Replace the Quest Board (every session's todo list). Malformed rows are skipped; the notes on the board follow. */
  setQuests(rows: unknown) {
    this.quests = sanitizeQuests(rows);
    if (this.board.update(this.quests, this.clock, this.reducedMotion) > 0) this.sfx("questDone"); // a wax stamp landed
    this.questVer++;
    this.dirty = true;
  }
  /** todo lists joined with the adventurer (colour, tag), most recently updated first */
  questViews(): QuestView[] {
    return this.quests.map((row) => {
      const emp = this.employees.get(row.sid);
      return {
        ...row,
        tag: emp ? emp.tag : "#" + row.sid.slice(0, TAG_LEN),
        project: emp ? emp.project : row.project || "unknown",
        color: lookFor(row.sid).shirt,
        look: emp ? emp.look : lookFor(row.sid),
        live: !!emp,
      };
    });
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
    this.gmRowsAt = -Infinity;
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
    if (id === GM_HIT_ID) return; // the guild master is not an adventurer; the UI opens his report
    this.selectedId = id;
    const target = id ? this.employees.get(id) : undefined;
    if (target && !this.isHidden(target)) {
      this.setScene(target.inDungeon ? "dungeon" : "guild"); // show where they are
      if (target.inDungeon) this.setDungeonFloor(target.floor); // after setScene: it opens on the busiest floor
    }
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
    this.bellKeys = null;
    this.sfxQueue.length = 0;
    this.attnDismissed.clear();
    this.bumpAttn();
    this.rcpts = [];
    this.rcptSeen.clear();
    this.rcptInit = false;
    this.rcptVer++;
    this.quests = [];
    this.questVer++;
    this.board.clear();
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
    this.skillFx = [];
    this.banners = [];
    this.trauma = 0;
    this.flash = 0;
    this.leavers.length = 0;
    this.bossAlive = 0;
    this.allyDoorsUntil = 0;
    this.allyNextAt = 0;
    this.resetWing();
    this.scene = "guild";
    this.dungeonFloor = 1;
    Object.assign(this.lord, freshLord());
    Object.assign(this.voidFight, voidIdle());
    this.voidCtl = freshVoidCtl();
    this.pipShown = false;
    this.stats = { since: Date.now(), entered: 0, left: 0, monsters: 0, bosses: 0, longestBossS: 0, waitS: 0 };
    this.tools.clear();
    this.chron = null;
    this.chronLocal = { levels: 0, raids: 0 };
    this.statsVer++;
    this.dirty = true;
    this.emit(true);
  }

  /**
   * Which AI a session belongs to and whether it hit its plan limit (server `session_meta` frame). Absent fields keep
   * their value; `rateLimit: null` clears the limit and the adventurer gets up again. Unknown sessions are ignored.
   */
  setSessionMeta(sid: string, meta: { source?: unknown; model?: unknown; rateLimit?: unknown } | null | undefined) {
    if (!meta || typeof meta !== "object") return;
    const emp = this.employees.get(sid);
    if (!emp) {
      // the session has not spawned yet (the meta frame beat its first event): keep it for spawn()
      const kept = this.metaPending.get(sid) ?? {};
      this.metaPending.delete(sid);
      this.metaPending.set(sid, { ...kept, ...meta });
      if (this.metaPending.size > META_PENDING_MAX)
        this.metaPending.delete(this.metaPending.keys().next().value as string);
      return;
    }
    this.applySessionMeta(emp, meta, true);
  }
  /** session_meta frames that arrived before their adventurer (capped, applied in spawn) */
  private metaPending = new Map<string, { source?: unknown; model?: unknown; rateLimit?: unknown }>();
  private applySessionMeta(
    emp: Employee,
    meta: { source?: unknown; model?: unknown; rateLimit?: unknown },
    announce = false,
  ) {
    if (isAiSource(meta.source) && emp.source !== meta.source) {
      emp.source = meta.source;
      this.dirty = true;
    }
    if (meta.model !== undefined) {
      const model = typeof meta.model === "string" && meta.model.trim() ? meta.model.trim().slice(0, MODEL_MAX) : null;
      if (emp.model !== model) {
        emp.model = model;
        this.dirty = true;
      }
    }
    if (meta.rateLimit === undefined) return;
    const next = parseRateLimit(meta.rateLimit);
    const current = emp.rateLimit;
    if (!next && !current) return;
    if (next && current && next.since === current.since) {
      emp.rateLimit = next; // the same hit, maybe with a better reset time
      if (next.resetText !== current.resetText || next.resetsAt !== current.resetsAt) {
        this.gmRowsAt = -Infinity;
        this.dirty = true;
      }
      return;
    }
    emp.rateLimit = next;
    this.gmRowsAt = -Infinity;
    this.dirty = true;
    if (!next) return;
    // the adventurer drops what it was doing: back to the desk, no tavern break
    this.cutTrip(emp);
    if (emp.state === "STRETCH") emp.state = "SEATED";
    emp.coffeeAfter = false;
    if (announce && emp.state === "SEATED") this.sfx("limit");
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
        REFILL_LIFE,
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
    if (first.inDungeon || second.inDungeon) return false; // raiders are inside the dungeon: nothing to draw on the field
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
    sig += `|${this.filter.query}|${this.filter.hideStray ? 1 : 0}|T${this.terrVer}|A${this.attnVer}|R${this.rcptVer}|Q${this.questVer}`;
    sig += `|D${this.statsVer}:${this.bossAlive}|S${this.scene}${this.dungeonFloor}`;
    for (const emp of this.employees.values()) {
      if (this.isHidden(emp)) {
        sig += `;h${emp.id}${this.isWaiting(emp) ? "w" + this.statusOf(emp) : ""}`;
        continue;
      }
      const cf = this.ctxFrac(emp.id);
      sig += `;${emp.id}${cf === null ? "" : "c" + Math.round(cf * PERCENT) + (this.ctxMap.get(emp.id)!.guessed ? "g" : "")},${this.statusOf(emp)},${emp.interns.size},${emp.deskIdx},${emp.lv}:${emp.xp}:${emp.gold}:${emp.kills}:${emp.hearts},${emp.source}:${emp.model ?? ""}:${emp.rateLimit ? emp.rateLimit.since : 0}|${this.doingText(emp) ?? ""}`;
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
          ai: aiInfo(emp.source, emp.model),
          rateLimit: emp.rateLimit,
          doing: this.doingText(emp),
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
      quests: this.questViews(),
      dungeon: this.dungeonStats(),
      scene: this.scene,
      dungeonFloor: this.dungeonFloor,
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
      bossesAlive = 0,
      raiders = 0,
      raidersShown = 0;
    const floorRaiders = new Array<number>(DUNGEON_FLOORS).fill(0);
    for (const emp of this.employees.values()) {
      if (emp.state !== "LEAVING") live++;
      if (emp.inDungeon) {
        raiders++;
        if (!this.isHidden(emp)) {
          raidersShown++;
          floorRaiders[Math.min(emp.floor, DUNGEON_FLOORS) - 1]++; // the Void Sanctum counts with B3
        }
      }
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
      raiders,
      raidersShown,
      floorRaiders,
      lordAlive: this.lord.hp > 0,
      lordHp: this.lord.hp,
      lordSlain: this.lord.slain,
      lordFight: this.lordPip(),
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
      case "TO_TAVERN_REST":
      case "AT_TAVERN_REST":
      case "FROM_TAVERN_REST":
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
      case "TO_TAVERN_REST":
      case "AT_TAVERN_REST":
      case "FROM_TAVERN_REST":
      case "TO_RAID":
      case "FROM_RAID":
        return true;
      default:
        return false;
    }
  }

  /** formatted "now doing" line, null while on a break / leaving, after the turn ended or when it went stale */
  doingText(emp: Employee): string | null {
    if (emp.state === "LEAVING" || emp.state === "ENTERING" || this.onBreak(emp)) return null;
    return doingLine(emp.doing, this.clock, emp.pending.size > 0);
  }

  /** remember the main agent's tool (PreToolUse, or the tool a PermissionRequest asks for) */
  private noteDoing(emp: Employee, evt: HookEvt) {
    const tool = str(evt.tool_name);
    if (!tool) return;
    // a permission request keeps the detail of the tool call it belongs to (the quest log row shows no detail for it)
    const detail =
      evt.hook_event_name === "PermissionRequest"
        ? emp.doing?.tool === tool
          ? emp.doing.detail
          : ""
        : toolDetail(evt);
    emp.doing = { tool, detail, at: this.clock };
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
        return emp.restSpot >= 0 ? m.status_feasting() : m.status_drink();
      case "DUEL":
        return m.status_duel();
      case "TO_TAVERN_REST":
        return m.status_to_tavern_rest();
      case "AT_TAVERN_REST":
        return emp.restSpot >= 0 ? m.status_feasting() : m.status_at_tavern_rest();
      case "FROM_TAVERN_REST":
        return m.status_from_tavern_rest();
      case "TO_RAID":
        return m.dungeon_lord_status_to_raid();
      case "FROM_RAID":
        return m.dungeon_lord_status_from_raid();
    }
    if (emp.inDungeon && emp.floor === VOID_FLOOR && emp.act !== "handup") return m.dungeon_lord_status_void();
    if (emp.raidIn && emp.act !== "handup") return m.dungeon_lord_status_raiding();
    if (emp.hurtUntil > this.clock) return m.status_hurt();
    if (emp.boss && emp.act !== "handup") return m.status_boss();
    if (emp.rateLimit && emp.act !== "handup") return m.status_limit();
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
  /** who is under the pointer in the current scene: field adventurers on the grounds, raiders at their dungeon spots inside */
  hit(lx: number, ly: number): string | null {
    const inside = this.scene === "dungeon";
    let best: string | null = null,
      bestY = -Infinity;
    for (const emp of this.employees.values()) {
      if (this.isHidden(emp) || emp.inDungeon !== inside || (inside && emp.floor !== this.dungeonFloor)) continue;
      const pos = inside ? this.raiderPoint(emp) : emp;
      if (lx >= pos.x - CH_W / 2 && lx <= pos.x + CH_W / 2 && ly >= pos.y - CH_H && ly <= pos.y && pos.y >= bestY) {
        best = emp.id;
        bestY = pos.y;
      }
    }
    if (!inside && this.scene === "guild") {
      const master = this.guildMaster;
      if (
        lx >= master.x - CH_W / 2 &&
        lx <= master.x + CH_W / 2 &&
        ly >= master.y - CH_H &&
        ly <= master.y &&
        master.y >= bestY
      )
        return GM_HIT_ID;
    }
    return best;
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
    this.updateDungeon();
    this.updateVoid();
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
    if (this.lord.shake > 0) this.lord.shake = Math.max(0, this.lord.shake - rawDt * LORD_SHAKE_DECAY);
    if (this.voidFight.shake > 0) this.voidFight.shake = Math.max(0, this.voidFight.shake - rawDt * VOID_SHAKE_DECAY);
    const ease = this.reducedMotion ? 1 : Math.min(1, rawDt * LORD_BAR_EASE);
    this.lord.shown += (this.lord.hp - this.lord.shown) * ease;
    const voidEase = this.reducedMotion ? 1 : Math.min(1, rawDt * VOID_BAR_EASE);
    this.voidFight.shown += (voidHpFrac(this.voidFight) - this.voidFight.shown) * voidEase;
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
    this.updateWing(dt);
    let bosses = 0;
    for (const emp of this.employees.values()) if (emp.boss) bosses++;
    this.bossAlive = bosses;
  }

  // ---------- effects ----------
  /** shake: take the strongest pending hit instead of summing, so many adventurers hitting at once don't pin it at max */
  addTrauma(amount: number) {
    this.trauma = Math.min(1, Math.max(this.trauma, amount));
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
    particle.dungeon = this.fxDungeon;
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

  /** run `emit` with raider effects tagged to the dungeon scene (no-op tagging for field adventurers) */
  private fxFor(emp: Employee, emit: () => void) {
    const prev = this.fxDungeon;
    this.fxDungeon = emp.inDungeon ? emp.floor : 0;
    try {
      emit();
    } finally {
      this.fxDungeon = prev;
    }
  }

  private pop(x: number, y: number, text: string, col: string, big = false, star = false, dur = 0.8, scale = 0) {
    this.popups.push({ x, y, text, col, big, born: this.clock, dur, star, scale, dungeon: this.fxDungeon });
    if (this.popups.length > MAX_POPUPS) this.popups.splice(0, this.popups.length - MAX_POPUPS);
  }

  private addBanner(kind: Banner["kind"], text: string, pixel = false, dur = BANNER_DEFAULT_S, epic = false) {
    this.banners.push({ kind, text, pixel, start: -1, dur, epic });
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
    for (let i = this.skillFx.length - 1; i >= 0; i--)
      if (this.clock - this.skillFx[i].born > this.skillFx[i].dur) this.skillFx.splice(i, 1);
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
        if (emp.state === "TO_COFFEE" || emp.state === "TO_TAVERN_REST" || emp.state === "TO_RAID")
          emp.trail.push(target);
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
      !emp.rateLimit &&
      this.clock - emp.lastEventAt > IDLE_GRACE_S * Math.max(1, this.speed)
    )
      this.leave(emp);
    if (emp.boss && emp.bossPath.length) this.walkBoss(emp, dt);
    switch (emp.state) {
      case "ENTERING":
        if (this.move(emp, dt)) this.sit(emp);
        break;
      case "FROM_COFFEE":
      case "FROM_TAVERN_REST":
      case "FROM_RAID":
        if (this.move(emp, dt)) this.sit(emp);
        break;
      case "TO_RAID":
        if (this.move(emp, dt)) this.arriveRaid(emp);
        break;
      case "TO_TAVERN_REST":
        if (this.move(emp, dt)) {
          emp.state = "AT_TAVERN_REST";
          emp.stateSince = this.clock;
          emp.facing = this.seatFacing(emp);
        }
        break;
      case "AT_TAVERN_REST":
        if (this.clock - emp.stateSince >= COMPACT_REST_S) {
          emp.state = "FROM_TAVERN_REST";
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
          emp.facing = this.seatFacing(emp);
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
          const route = routeToBreak(emp.deskIdx, emp.slot, this.freeFeastSeat(emp));
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
        if (emp.raidIn) this.raidTick(emp);
        else if (emp.deskIdx >= 0 && emp.slot < 0) this.raidReadyCheck(emp);
        if (emp.pending.size > 0 && !emp.boss && emp.deskIdx >= 0 && emp.monPos && !emp.raidIn) {
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
    if (emp.state !== "LEAVING" && emp.deskIdx >= 0 && !emp.raidIn && emp.monDead && emp.monRespawnAt <= this.clock)
      this.spawnMonster(emp);
    if (emp.state !== "SEATED" && emp.tempBubble && this.clock > emp.tempBubble.until) emp.tempBubble = null;
    this.syncRaid(emp);
    this.respawnRaid(emp);
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
      if (emp.state === "TO_TAVERN_REST" || emp.state === "AT_TAVERN_REST" || emp.state === "FROM_TAVERN_REST") {
        emp.path = [];
        emp.trail = [];
        this.sit(emp);
      }
      if (emp.state === "TO_RAID") {
        emp.path = [];
        this.arriveRaid(emp);
      } else if (emp.state === "FROM_RAID") {
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
    emp.restSpot = -1; // the break is over: the table seat is free
    if (emp.deskIdx >= 0 && !emp.monPos) this.spawnMonster(emp);
    emp.state = "SEATED";
    emp.stateSince = this.clock;
    this.syncRaid(emp);
    this.drainQueue(emp);
  }

  /** events that arrived on the way are applied once the adventurer stands at their spot */
  private drainQueue(emp: Employee) {
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
      if (emp.state === "SEATED" && !emp.raidIn) {
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
    emp.doing = null;
    this.resetSkillState(emp);
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
    emp.raidIn = false;
    emp.raidSlot = -1;
    emp.raidEnteredAt = -1;
    this.syncRaid(emp);
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
    emp.path = routeFromDungeon(desk);
    emp.deskIdx = desk;
    emp.slot = -1;
    this.syncRaid(emp);
    emp.state = "FROM_COFFEE";
    emp.stateSince = this.clock;
    emp.restSpot = -1; // a raid walk, not a table break
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
      if (other.raidSlot >= 0) slots.add(other.raidSlot); // a battle-spot raider holds its dungeon spot index too
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
    emp.restSpot = -1;
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

  /** the dungeon spot index of a raider: the overflow slot, or the spot a battle-spot raider reserved */
  raidSpotIndex(emp: Employee): number {
    return emp.slot >= 0 ? emp.slot : Math.max(0, emp.raidSlot);
  }

  /** a seated battle-spot adventurer that has worked hard since its last raid walks to the dungeon gate */
  private raidReadyCheck(emp: Employee) {
    if (emp.raidIn || !this.compactReady(emp) || emp.stateSince > this.clock - RAID_SETTLE_S) return;
    const hard = emp.raidCalls >= RAID_READY_CALLS;
    const long = emp.raidCalls >= RAID_TIMED_MIN_CALLS && this.clock - emp.raidSince >= RAID_READY_S;
    if (!hard && !long) return;
    if (this.gmHoldRaid(emp)) return;
    this.beginRaid(emp);
  }

  private beginRaid(emp: Employee) {
    const taken = new Set<number>();
    for (const other of this.employees.values()) {
      if (other.slot >= 0) taken.add(other.slot);
      if (other.raidSlot >= 0) taken.add(other.raidSlot);
    }
    let slot = 0;
    while (taken.has(slot)) slot++;
    emp.raidSlot = slot;
    emp.raidCalls = 0;
    emp.raidSince = this.clock;
    emp.raidDoneAt = -1;
    emp.restSpot = -1;
    emp.holdUntil = 0;
    emp.tempBubble = null;
    // its field fight is over: the spot stays empty until it is back (a fresh monster steps up then)
    emp.monPos = null;
    emp.monDead = false;
    emp.monRespawnAt = Infinity;
    emp.monAppearAt = -1;
    if (this.reducedMotion) {
      emp.x = GATE_MOUTH.x;
      emp.y = GATE_MOUTH.y;
      this.arriveRaid(emp);
      return;
    }
    emp.state = "TO_RAID";
    emp.stateSince = this.clock;
    emp.trail = [{ x: emp.x, y: emp.y }];
    emp.path = routeToDungeon(emp.deskIdx);
    this.dirty = true;
  }

  /** the raider steps through the gate: it is inside from here on (hidden on the field, drawn in the dungeon scene) */
  private arriveRaid(emp: Employee) {
    emp.x = GATE_MOUTH.x;
    emp.y = GATE_MOUTH.y;
    emp.facing = 1;
    emp.path = [];
    emp.trail = [];
    emp.raidIn = true;
    emp.raidEnteredAt = this.clock;
    emp.raidDoneAt = -1;
    emp.state = "SEATED";
    emp.stateSince = this.clock;
    this.syncRaid(emp);
    this.sfx("enterDungeon");
    this.drainQueue(emp);
  }

  /** a desk raider inside: walks home when it is done, tired, idle or needs the user */
  private raidTick(emp: Employee) {
    if (emp.act === "handup") {
      this.endRaid(emp);
      return;
    }
    if (
      emp.floor === DUNGEON_FLOORS &&
      this.lord.hp <= 0 &&
      emp.raidDoneAt < 0 &&
      !(this.voidActive() && !this.voidCtl.moved)
    )
      emp.raidDoneAt = this.clock;
    const done = emp.raidDoneAt >= 0 && this.clock - emp.raidDoneAt >= RAID_LINGER_S;
    const tired = this.clock - emp.raidEnteredAt >= RAID_MAX_S;
    const idle = emp.pending.size === 0 && this.clock - emp.lastEventAt > RAID_IDLE_S;
    if (done || tired || idle) this.endRaid(emp);
  }

  /** the raider leaves the dungeon and walks back out to its battle spot */
  private endRaid(emp: Employee) {
    if (!emp.raidIn) return;
    if (emp.floor === VOID_FLOOR) emp.hearts = MAX_HEARTS; // the Veiled One's blows do not follow them home
    emp.raidIn = false;
    emp.raidSlot = -1;
    emp.raidEnteredAt = -1;
    emp.raidDoneAt = -1;
    emp.raidCalls = 0;
    emp.raidSince = this.clock;
    emp.holdUntil = 0;
    emp.trail = [];
    emp.state = "FROM_RAID";
    emp.stateSince = this.clock;
    emp.path = routeFromDungeon(emp.deskIdx);
    this.syncRaid(emp);
    this.sfx("door");
    if (this.selectedId === emp.id && this.scene === "dungeon") this.setScene("guild"); // follow them out
    if (this.reducedMotion) {
      emp.path = [];
      this.sit(emp);
    }
    this.dirty = true;
  }

  /** raid state follows the seat: inDungeon only while SEATED in an overflow slot (arrived inside); the foe lives as long as that holds */
  private syncRaid(emp: Employee) {
    const inside = emp.state === "SEATED" && ((emp.deskIdx < 0 && emp.slot >= 0) || emp.raidIn);
    if (inside === emp.inDungeon) return;
    emp.inDungeon = inside;
    emp.floor = 1; // every raid starts on B1 and a promotion starts the next one from scratch
    emp.floorKills = 0;
    emp.stairsAt = -1;
    this.resetSkillState(emp);
    if (inside) {
      this.chronLocal.raids++;
      this.newRaidFoe(emp);
    } else emp.raid = null;
    this.bumpStats();
  }

  private newRaidFoe(emp: Employee) {
    const kinds = MONSTER_KINDS as readonly MonsterKind[];
    const pick = (h32(emp.id) + emp.monN * MON_KIND_STRIDE) % kinds.length;
    emp.monN++;
    if (emp.floor >= DUNGEON_FLOORS) {
      emp.raid = null; // the Dungeon Lord is the only foe down here
      return;
    }
    const deeper = emp.floor >= 2;
    const kind = deeper ? pick % CRYPT_KINDS.length : pick;
    emp.raid = { kind, hp: 1, hitAt: -99, deadAt: -99, crypt: deeper };
  }

  /** the stair walk ends: the raider appears on the next floor with a fresh foe (or in the Lord's hall) */
  private arriveOnNextFloor(emp: Employee) {
    const from = emp.floor;
    emp.floor = Math.min(DUNGEON_FLOORS, emp.floor + 1);
    emp.floorKills = 0;
    emp.stairsAt = -1;
    this.newRaidFoe(emp);
    this.sfx("enterDungeon");
    if (emp.floor >= DUNGEON_FLOORS && this.lord.hp > 0 && !this.lordFighters(emp).length) {
      this.addBanner("boss", m.dungeon_lord_banner_raid());
      this.sfx("bossAppear");
      this.startLordIntro();
    }
    // the camera follows a selected raider down the stairs
    if (this.selectedId === emp.id && this.scene === "dungeon" && this.dungeonFloor === from)
      this.setDungeonFloor(emp.floor);
    this.bumpStats();
  }

  /** a floor foe fell: count it, and send the raider down once enough have */
  private floorKill(emp: Employee) {
    emp.floorKills++;
    if (emp.floorKills >= RAID_FLOOR_KILLS && emp.floor < DUNGEON_FLOORS) emp.stairsAt = this.clock;
  }

  /** the live Lord inset is up: a visible raider fights a live Lord, or it fell a moment ago */
  lordPip(): boolean {
    if (this.voidActive())
      return this.dungeonRaiders().some((emp) => emp.floor >= DUNGEON_FLOORS && !this.isHidden(emp));
    if (this.lord.hp > 0) return this.lordFighters().some((emp) => !this.isHidden(emp));
    return this.lord.slain > 0 && this.clock - this.lord.deadAt < LORD_PIP_AFTER_S;
  }

  /** raiders standing on B3 (not on the stairs), other than `except` (a reused buffer: valid until the next call) */
  lordFighters(except?: Employee): Employee[] {
    const out = this.lordBuf;
    out.length = 0;
    for (const emp of this.employees.values())
      if (emp !== except && emp.inDungeon && emp.floor === DUNGEON_FLOORS && emp.stairsAt < 0) out.push(emp);
    return out;
  }

  /** average gear tier of the raiders standing on B3 (the Lord's pool takes it once, when the fight starts) */
  private lordTierAvg(): number {
    const fighters = this.lordFighters();
    let total = 0;
    for (const fighter of fighters) total += gearTier(fighter.lv);
    return fighters.length ? total / fighters.length : 0;
  }

  /** the Lord's fight runs while raiders stand on B3, he rises again after his rest, and a fall plays out its sequence */
  private updateDungeon() {
    const lord = this.lord;
    let fighting = 0;
    if (lord.hp > 0)
      for (const emp of this.employees.values())
        if (emp.inDungeon && emp.floor === DUNGEON_FLOORS && emp.stairsAt < 0) fighting++;
    if (fighting && this.clock >= lord.nextStrikeAt) this.lordStrike();
    if (fighting && lord.engagedAt < 0) {
      lord.engagedAt = this.clock;
      lord.nextAttackAt = this.clock + FIRST_ATTACK_S;
    } else if (!fighting && lord.engagedAt >= 0) {
      lord.engagedAt = -1;
      lord.calmAt = this.clock;
      stopAttacks(lord);
    }
    if (fighting) {
      if (growPool(lord, fighting, this.lordTierAvg())) this.bumpStats();
      this.updateLordFight();
    }
    const pip = this.lordPip();
    if (pip !== this.pipShown) {
      this.pipShown = pip;
      this.bumpStats();
    }
    if (lord.hp > 0) return;
    if (lord.finaleAt < 0 && lord.deadAt >= 0 && this.clock - lord.deadAt >= deathLength(this.reducedMotion))
      this.lordFinale();
    if (this.clock - lord.deadAt >= LORD_RESPAWN_S) {
      lord.hp = 1;
      resetFight(lord);
      this.bumpStats();
    }
  }

  /** shake the Lord's floor (and the inset that shows it); never under reduced motion */
  private lordShake(amount: number) {
    if (this.reducedMotion) return;
    this.lord.shake = Math.min(1, this.lord.shake + amount);
  }

  /** run `emit` with its effects tagged to floor 3 */
  private onLordFloor(emit: () => void) {
    this.onFloor(DUNGEON_FLOORS, emit);
  }

  /** run `emit` with its effects tagged to `floor` */
  private onFloor(floor: number, emit: () => void) {
    const prev = this.fxDungeon;
    this.fxDungeon = floor;
    try {
      emit();
    } finally {
      this.fxDungeon = prev;
    }
  }

  /** the raider standing on B3 in position `index` (arrival order), or null */
  private lordFighterAt(index: number): Employee | null {
    let at = 0;
    for (const emp of this.employees.values())
      if (emp.inDungeon && emp.floor === DUNGEON_FLOORS && emp.stairsAt < 0 && at++ === index) return emp;
    return null;
  }

  /** the Lord's intro: the first raider of a fight steps into his hall */
  private startLordIntro() {
    const lord = this.lord;
    lord.introAt = this.clock;
    lord.taunt = (lord.slain + lord.intros) % TAUNTS.length;
    lord.intros++;
    this.lordShake(LORD_INTRO_SHAKE);
  }

  /** the special attacks, the minions and the enrage tick (while raiders stand on B3 and he is up) */
  private updateLordFight() {
    const lord = this.lord,
      atk = lord.atk,
      clock = this.clock;
    for (const minion of lord.minions) {
      if (!minion.on) continue;
      if (minion.clearedAt < 0) {
        if (clock - minion.bornAt > MINION_LIFE_S) minion.clearedAt = clock; // crumbles
      } else if (clock - minion.clearedAt > MINION_POOF_S) minion.on = false;
    }
    if (atk.kind < 0) {
      if (lord.engagedAt >= 0 && clock >= lord.nextAttackAt) this.startLordAttack();
      return;
    }
    if (!atk.landed && clock >= atk.hitAt) {
      atk.landed = true;
      this.landLordAttack();
    }
    if (atk.landed) this.tickLordAttack();
    if (clock >= atk.endAt) {
      atk.kind = -1;
      atk.landed = false;
      for (const meteor of lord.meteors) meteor.on = false;
      lord.nextAttackAt = clock + nextAttackGap(lord.enragedAt >= 0, Math.random());
    }
  }

  /** pick a special attack and its target and start the red telegraph */
  private startLordAttack() {
    const lord = this.lord;
    let fighters = 0;
    for (const emp of this.employees.values())
      if (emp.inDungeon && emp.floor === DUNGEON_FLOORS && emp.stairsAt < 0) fighters++;
    if (!fighters) return;
    const kind = pickAttack(lord.atk.prev, Math.random());
    const victim = this.lordFighterAt(Math.floor(Math.random() * fighters) % fighters);
    if (!victim) return;
    const at = this.raiderPoint(victim);
    beginAttack(lord, this.clock, kind, at.x, at.y, victim.id);
    if (kind === ATTACK_METEOR)
      planMeteors(lord, lord.atk.hitAt, lord.enragedAt >= 0 ? METEORS_ENRAGED : METEORS_CALM, (x, y, radius) => {
        for (const emp of this.employees.values()) {
          if (!emp.inDungeon || emp.floor !== DUNGEON_FLOORS) continue;
          const spot = this.raiderPoint(emp);
          if (Math.abs(spot.x - x) < radius && Math.abs(spot.y - y) < radius) return true;
        }
        return false;
      });
  }

  /** the telegraph ran out: the attack lands */
  private landLordAttack() {
    const lord = this.lord,
      feet = dungeonLordPoint();
    switch (lord.atk.kind) {
      case ATTACK_SLAM:
        this.sfx("lordSlam");
        this.lordShake(LORD_SLAM_SHAKE);
        this.onLordFloor(() =>
          this.ring(
            feet.x + WAVE_DX,
            feet.y,
            LORD_SLAM_RING.n,
            LORD_SLAM_RING.cols,
            LORD_SLAM_RING.speed,
            LORD_SLAM_RING.life,
            true,
          ),
        );
        break;
      case ATTACK_BREATH:
        this.sfx("lordFlame");
        break;
      case ATTACK_SUMMON:
        this.sfx("lordSummon");
        raiseMinions(lord, this.clock, feet.x, feet.y);
        this.onLordFloor(() => {
          for (const minion of lord.minions)
            if (minion.on && minion.bornAt === this.clock)
              this.burst(
                minion.x,
                minion.y - 2,
                LORD_DUST.n,
                LORD_DUST.cols,
                LORD_DUST.speed,
                LORD_DUST.gravity,
                LORD_DUST.life,
                1,
                true,
              );
        });
        break;
      default:
        break;
    }
  }

  /** a raider hops out of the way (and the one the attack was aimed at flinches) */
  private lordDodge(emp: Employee, victim: boolean) {
    emp.dodgeAt = this.clock;
    if (!victim) return;
    emp.hurtUntil = this.clock + LORD_STRIKE_HURT_S;
    const at = this.raiderPoint(emp);
    this.fxFor(emp, () => {
      this.pop(at.x, at.y - POP_ABOVE_HEAD, "!", "#ff6a3a", false, false);
      this.burst(
        at.x,
        at.y - LORD_HIT_POP_LIFT * 2,
        LORD_STRIKE_SPARKS.n,
        ["#ff8a2a", "#ffd070", "#ff4a2a"],
        LORD_STRIKE_SPARKS.speed,
        LORD_STRIKE_SPARKS.gravity,
        LORD_STRIKE_SPARKS.life,
      );
    });
  }

  /** while an attack is up: raiders it reaches hop; meteors land one by one */
  private tickLordAttack() {
    const lord = this.lord,
      atk = lord.atk,
      clock = this.clock,
      feet = dungeonLordPoint();
    if (atk.kind === ATTACK_METEOR) {
      for (const meteor of lord.meteors) {
        if (!meteor.on || meteor.landed || clock < meteor.at) continue;
        meteor.landed = true;
        this.sfx("lordSlam");
        this.lordShake(LORD_METEOR_SHAKE);
        this.onLordFloor(() =>
          this.burst(
            meteor.x,
            meteor.y - 2,
            LORD_IMPACT.n,
            LORD_IMPACT.cols,
            LORD_IMPACT.speed,
            LORD_IMPACT.gravity,
            LORD_IMPACT.life,
          ),
        );
        for (const emp of this.employees.values()) {
          if (!emp.inDungeon || emp.floor !== DUNGEON_FLOORS || emp.stairsAt >= 0) continue;
          const spot = this.raiderPoint(emp);
          if (Math.hypot(spot.x - meteor.x, (spot.y - meteor.y) / WAVE_SQUASH / 2) < METEOR_BLAST_PX)
            this.lordDodge(emp, emp.id === atk.targetId && emp.dodgeAt < atk.hitAt);
        }
      }
      return;
    }
    if (atk.kind !== ATTACK_SLAM && atk.kind !== ATTACK_BREATH) return;
    const mouthX = feet.x + MOUTH_DX,
      mouthY = feet.y + MOUTH_DY;
    for (const emp of this.employees.values()) {
      if (!emp.inDungeon || emp.floor !== DUNGEON_FLOORS || emp.stairsAt >= 0 || emp.dodgeAt >= atk.hitAt) continue;
      const spot = this.raiderPoint(emp);
      let arrive: number;
      if (atk.kind === ATTACK_SLAM) {
        const ox = feet.x + WAVE_DX;
        arrive = atk.hitAt + Math.hypot(ox - spot.x, (feet.y - spot.y) / WAVE_SQUASH) / WAVE_SPEED;
      } else {
        // the breath reaches whoever stands on the stream from his mouth to the raider it was aimed at
        const dx = atk.tx - mouthX,
          dy = atk.ty - mouthY;
        const along = Math.min(
          1,
          Math.max(0, ((spot.x - mouthX) * dx + (spot.y - mouthY) * dy) / (dx * dx + dy * dy || 1)),
        );
        const near = Math.hypot(spot.x - (mouthX + dx * along), spot.y - (mouthY + dy * along));
        if (near > BREATH_NEAR_PX && emp.id !== atk.targetId) continue;
        arrive = atk.hitAt + LORD_BREATH_REACH_S * along;
      }
      if (clock >= arrive) this.lordDodge(emp, emp.id === atk.targetId);
    }
  }

  /** the Lord slams a raider (cosmetic: nobody loses anything): an ember burst and a small hurt pop on them */
  private lordStrike() {
    const fighters = this.lordFighters();
    if (!fighters.length) return;
    this.lord.nextStrikeAt = this.clock + LORD_STRIKE_EVERY_S;
    if (this.lord.atk.kind >= 0) return; // a special attack is busy
    if (this.clock - this.lord.engagedAt < LORD_STRIKE_EVERY_S / 2 && this.lord.engagedAt >= 0) return;
    const victim = fighters[Math.floor(this.clock / LORD_STRIKE_EVERY_S) % fighters.length];
    this.lord.strikeAt = this.clock;
    this.lord.strikeId = victim.id;
    victim.hurtUntil = this.clock + LORD_STRIKE_HURT_S;
    const at = this.raiderPoint(victim);
    this.fxFor(victim, () => {
      this.pop(at.x, at.y - POP_ABOVE_HEAD, "!", "#ff6a3a", false, false);
      this.burst(
        at.x,
        at.y - LORD_HIT_POP_LIFT * 2,
        LORD_STRIKE_SPARKS.n,
        ["#ff8a2a", "#ffd070", "#ff4a2a"],
        LORD_STRIKE_SPARKS.speed,
        LORD_STRIKE_SPARKS.gravity,
        LORD_STRIKE_SPARKS.life,
      );
    });
  }

  /** every raider on floor 3 hits the one Lord: the damage pools into a single hp bar; the kill rewards them all */
  private lordHit(emp: Employee, dmg: number, crit: boolean) {
    const lord = this.lord;
    if (lord.hp <= 0) return;
    let standing = 0;
    for (const other of this.employees.values())
      if (other.inDungeon && other.floor === DUNGEON_FLOORS && other.stairsAt < 0) standing++;
    if (growPool(lord, standing, this.lordTierAvg())) this.bumpStats();
    lord.hp = Math.max(0, lord.hp - dmg / lord.maxHp);
    if (lord.hp < LORD_HP_EPSILON) lord.hp = 0; // float residue of many small hits
    lord.hitAt = this.clock;
    if (!this.reducedMotion) {
      lord.hsAt = this.clock; // hit-stop: his animation clock freezes for a beat
      lord.hsUntil = this.clock + LORD_HITSTOP_S;
    }
    if (crit) lord.critAt = this.clock;
    addSlash(lord, this.clock, crit);
    this.sfx("hit");
    const body = dungeonLordPoint();
    const cleared = clearMinion(lord, this.clock);
    this.fxFor(emp, () => {
      this.pop(
        body.x + rand(-DMG_POP_JITTER, DMG_POP_JITTER),
        body.y - LORD_H - LORD_HIT_POP_LIFT,
        `-${dmg}`,
        crit ? "#ffe14a" : "#ffffff",
        crit,
        crit,
        crit ? LORD_CRIT_POP_S : undefined,
        crit ? LORD_CRIT_POP_SCALE : 0,
      );
      const sparks = crit ? LORD_CRIT_SPARKS : LORD_HIT_SPARKS;
      this.burst(
        body.x - LORD_HIT_SPARK_DX,
        body.y - LORD_H / 2,
        sparks.n,
        crit ? ["#ffffff", "#ffe14a", "#ff9a3a"] : ["#ffffff", "#f2c14e", "#ffb870"],
        sparks.speed,
        LORD_HIT_SPARKS.gravity,
        LORD_HIT_SPARKS.life,
      );
      if (cleared)
        this.burst(
          cleared.x,
          cleared.y - LORD_BONE_LIFT,
          LORD_BONE_BURST.n,
          LORD_BONE_BURST.cols,
          LORD_BONE_BURST.speed,
          LORD_BONE_BURST.gravity,
          LORD_BONE_BURST.life,
        );
    });
    if (crit) this.lordShake(LORD_CRIT_SHAKE);
    if (lord.hp > 0) {
      if (lord.enragedAt < 0 && lord.hp < ENRAGE_BELOW) this.enrageLord();
      return;
    }
    // raiders on B3 when he falls: his corpse was only a puppet, the shatter IS his death (no finale of his own)
    const toVoid = this.voidEnabled && this.voidFight.phase === "none" && this.lordFighters().length > 0;
    lord.deadAt = this.clock;
    lord.finaleAt = toVoid ? this.clock : -1;
    lord.slain++;
    this.stats.bosses++;
    stopAttacks(lord);
    if (!toVoid) {
      this.sfx("lordDeath");
      this.lordShake(LORD_DEATH_SHAKE);
    }
    const finale = deathLength(this.reducedMotion);
    for (const raider of this.dungeonRaiders()) {
      if (raider.floor !== DUNGEON_FLOORS) continue;
      raider.kills += LORD_KILLS;
      raider.qKills += LORD_KILLS;
      raider.gold += LORD_GOLD;
      raider.qGold += LORD_GOLD;
      this.treasury += LORD_GOLD;
      raider.raidDoneAt = toVoid ? -1 : this.clock + finale; // they linger after the burst, not before it
    }
    const slayer = this.dungeonRaiders().find((raider) => raider.floor === DUNGEON_FLOORS) ?? emp;
    this.log.unshift({
      id: this.logSeq++,
      sid: slayer.id,
      color: slayer.look.shirt,
      bad: false,
      text: m.dungeon_floor_lord_slain({ tag: slayer.tag, project: slayer.project }),
      time: Date.now(),
      tag: slayer.tag,
      project: slayer.project,
      intern: false,
      internLabel: "",
      kind: KIND_LORD,
      detail: m.dungeon_floor_lord_slain_detail({ count: lord.slain }),
    });
    if (this.log.length > LOG_MAX) this.log.length = LOG_MAX;
    this.bumpStats();
    if (toVoid) this.beginVoid();
  }

  /** below half hp: flame aura, bigger flames, a surge of lava, faster attacks, a banner and a roar */
  private enrageLord() {
    const lord = this.lord;
    lord.enragedAt = this.clock;
    this.addBanner("boss", "ENRAGED!", true);
    this.sfx("lordEnrage");
    this.lordShake(LORD_ENRAGE_SHAKE);
    if (lord.atk.kind < 0) lord.nextAttackAt = Math.min(lord.nextAttackAt, this.clock + ENRAGED_FIRST_S);
    const at = dungeonLordPoint();
    this.onLordFloor(() =>
      this.burst(
        at.x,
        at.y - LORD_H / 2,
        LORD_ENRAGE_BURST.n,
        LORD_ENRAGE_BURST.cols,
        LORD_ENRAGE_BURST.speed,
        LORD_ENRAGE_BURST.gravity,
        LORD_ENRAGE_BURST.life,
      ),
    );
  }

  /** the death sequence ends: he bursts into embers, a coin shower falls, the party is cheered, the throne goes dark */
  private lordFinale() {
    const lord = this.lord;
    lord.finaleAt = this.clock;
    const at = dungeonLordPoint();
    this.sfx("bossDown");
    this.sfx("fanfare");
    this.addBanner("boss", m.dungeon_lord_banner_slain());
    this.cheers(); // the hall patrons raise a mug
    this.lordShake(LORD_FINALE_SHAKE);
    this.onLordFloor(() => {
      this.pop(at.x, at.y - LORD_POP_LIFT, `+${LORD_GOLD}g`, "#f2c14e", true, true, LOOT_POP_DUR);
      this.burst(
        at.x,
        at.y - LORD_H / 2,
        LORD_EMBERS.n,
        LORD_EMBERS.cols,
        LORD_EMBERS.speed,
        LORD_EMBERS.gravity,
        LORD_EMBERS.life,
      );
      for (let k = 0; k < LORD_COIN_COUNT; k++)
        this.emitP(
          at.x + rand(-LORD_COIN_SPREAD, LORD_COIN_SPREAD),
          at.y - LORD_POP_LIFT,
          rand(-COIN_VX, COIN_VX),
          rand(-COIN_VY_MAX, -COIN_VY_MIN),
          COIN_GRAVITY,
          COIN_LIFE,
          "#f2c14e",
          1,
          "coin",
        );
      // the shower: coins fall across the whole hall from above the ceiling line
      for (let k = 0; k < LORD_SHOWER_COINS; k++)
        this.emitP(
          VIEW_X0 + ((k + rand(0, 1)) / LORD_SHOWER_COINS) * VIEW_W,
          -rand(0, LORD_SHOWER_HEIGHT),
          rand(-COIN_VX, COIN_VX),
          rand(LORD_SHOWER_VY_MIN, LORD_SHOWER_VY_MAX),
          LORD_SHOWER_GRAVITY,
          LORD_SHOWER_LIFE,
          "#f2c14e",
          1,
          "coin",
        );
    });
  }

  // ---------- the secret final boss: the Veiled One (timings, scaling and patterns: voidFight.ts) ----------
  /** the secret fight is on (or about to begin), from the Lord's fall to the last beat of the victory or retreat */
  voidActive(): boolean {
    return this.voidFight.phase !== "none";
  }

  /** the raiders were moved to the Void Sanctum: floor 4 can be viewed (from the wipe's midpoint to the end) */
  voidOnFloor(): boolean {
    return this.voidFight.phase !== "none" && this.voidCtl.moved;
  }

  /** the floor the live inset shows: the Sanctum while the secret fight is on it, B3 otherwise */
  pipFloor(): number {
    return this.voidOnFloor() ? VOID_FLOOR : DUNGEON_FLOORS;
  }

  /** the line the Veiled One is shouting right now ("" when quiet) */
  voidLine(): string {
    return voidVoice(this.voidFight, this.clock);
  }

  /** seconds into the current secret phase */
  voidAge(): number {
    return voidPhaseAge(this.voidFight, this.clock);
  }

  /** 0..1 through the current timed phase (shatter, transition, reveal, dying, victory, retreat) */
  voidProgress(): number {
    return voidPhaseProgress(this.voidFight, this.clock);
  }

  /** the boss cannot be hurt right now (reveal, the roar, TRUE FORM, the death) */
  voidInvulnerable(): boolean {
    return voidInvulnerable(this.voidFight, this.clock);
  }

  /** raiders standing in the Void Sanctum (a reused buffer: valid until the next call) */
  voidFighters(): Employee[] {
    const out = this.voidBuf;
    out.length = 0;
    for (const emp of this.employees.values()) if (emp.inDungeon && emp.floor === VOID_FLOOR) out.push(emp);
    return out;
  }

  /** a Sanctum raider's spot: they walk from the B3 ring up to the arc in front of the boss when the reveal begins */
  private voidSpot(emp: Employee): Pt {
    const slot = dungeonSpotIndex(this.raidSpotIndex(emp));
    const to = { x: 0, y: 0 };
    voidSpotOf(slot, emp.look.cls, to);
    const ctl = this.voidCtl;
    if (ctl.stepAt < 0) return dungeonSpotOf(slot, DUNGEON_FLOORS);
    if (ctl.ring !== 0) {
      // pushed back by a transformation shockwave: slide from the previous ring to the new one
      const prev = { x: 0, y: 0 };
      voidSpotOf(slot, emp.look.cls, prev, ctl.prevRing);
      voidSpotOf(slot, emp.look.cls, to, ctl.ring);
      const slide = this.reducedMotion
        ? 1
        : Math.min(1, Math.max(0, (this.clock - this.voidFight.pushbackAt) / VOID_PUSHBACK_S));
      return { x: prev.x + (to.x - prev.x) * slide, y: prev.y + (to.y - prev.y) * slide };
    }
    const progress = this.reducedMotion ? 1 : Math.min(1, Math.max(0, (this.clock - ctl.stepAt) / VOID_STEP_S));
    const from = dungeonSpotOf(slot, DUNGEON_FLOORS);
    return { x: from.x + (to.x - from.x) * progress, y: from.y + (to.y - from.y) * progress };
  }

  private voidTierAvg(fighters: Employee[]): number {
    let total = 0;
    for (const fighter of fighters) total += gearTier(fighter.lv);
    return fighters.length ? total / fighters.length : 0;
  }

  /** shake the Sanctum (and the inset that shows it); never under reduced motion */
  private voidShake(amount: number, atLeast = false) {
    if (this.reducedMotion) return;
    const boss = this.voidFight;
    boss.shake = atLeast ? Math.max(boss.shake, amount) : Math.min(1, boss.shake + amount);
  }

  /** the transformation shockwave: knock every raider away from the boss (no heart lost) and move their stand back */
  private voidPushback(ring: 1 | 2) {
    const boss = this.voidFight,
      ctl = this.voidCtl,
      origin = this.voidBody();
    for (const emp of this.voidFighters()) {
      const at = this.raiderPoint(emp); // where they stand now: the slide starts from here
      emp.voidHitAt = this.clock;
      emp.voidKnock = at.x <= origin.x ? -1 : 1;
      emp.hurtUntil = this.clock + VOID_HURT_S;
    }
    ctl.prevRing = ctl.ring;
    ctl.ring = ring;
    boss.pushbackAt = this.clock;
    boss.pushbackX = origin.x;
    boss.pushbackY = origin.y;
    this.voidImpact(origin.x, origin.y);
  }

  /** the boss's body centre, for effects */
  private voidBody(): Pt {
    return { x: this.voidFight.x, y: VOID_FEET_Y - VOID_BODY_H / 2 };
  }

  /** record a big attack impact for the renderer */
  private voidImpact(x: number, y: number) {
    const boss = this.voidFight;
    boss.voidImpactAt = this.clock;
    boss.voidImpactX = x;
    boss.voidImpactY = y;
  }

  /** queue a banner (and then a voice line): they take turns and never overlap */
  private voidBeats(banner: { text: string; dur: number } | null, line: string | null) {
    const ctl = this.voidCtl;
    if (banner) ctl.beats.push({ at: this.clock, banner });
    if (line) ctl.beats.push({ at: this.clock, line });
    this.playVoidBeats();
  }

  private playVoidBeats() {
    const boss = this.voidFight,
      ctl = this.voidCtl;
    for (let beat = takeVoidBeat(ctl, this.clock); beat; beat = takeVoidBeat(ctl, this.clock)) {
      if (beat.banner) this.addBanner("boss", beat.banner.text, true, beat.banner.dur, true);
      if (beat.line) voidSay(boss, this.clock, beat.line);
    }
  }

  /** the Lord is gone and raiders still stand on B3: his corpse shatters */
  private beginVoid() {
    const fighters = this.lordFighters();
    if (!fighters.length || this.voidFight.phase !== "none") return;
    const boss = this.voidFight;
    resetVoid(boss, this.voidCtl);
    setVoidPhase(boss, this.clock, "shatter");
    boss.x = VOID_HOME_X;
    const lordAt = dungeonLordPoint();
    boss.lordX = lordAt.x;
    boss.lordY = lordAt.y;
    boss.lordEnraged = this.lord.enragedAt >= 0;
    this.voidBeats(null, VOID_LINE_SHATTER);
    for (const raider of fighters) raider.raidDoneAt = -1; // nobody walks home: the raid goes on below
    this.sfx("voidShatter");
    this.voidShake(VOID_SHAKE_SHATTER);
    const at = dungeonLordPoint();
    this.onFloor(DUNGEON_FLOORS, () =>
      this.burst(
        at.x,
        at.y - LORD_H / 2,
        VOID_FX_SHATTER.n,
        VOID_FX_SHATTER.cols,
        VOID_FX_SHATTER.speed,
        VOID_FX_SHATTER.gravity,
        VOID_FX_SHATTER.life,
        1,
        true,
      ),
    );
    this.bumpStats();
  }

  /** advance the secret fight's phases; called every frame */
  private updateVoid() {
    const boss = this.voidFight,
      ctl = this.voidCtl,
      clock = this.clock,
      age = voidPhaseAge(boss, clock);
    if (boss.phase === "none") return;
    this.playVoidBeats();
    switch (boss.phase) {
      case "shatter":
        if (!this.lordFighters().length) this.endVoid();
        else if (age >= VOID_SHATTER_S) this.startVoidWipe();
        return;
      case "transition":
        if (!ctl.moved) {
          if (age >= VOID_WIPE_MID_S) {
            if (this.lordFighters().length) this.moveRaidersToVoid();
            else this.endVoid();
          }
          return;
        }
        if (!this.voidFighters().length) this.endVoid();
        else if (age >= VOID_WIPE_S) this.startVoidReveal();
        return;
      case "reveal":
        if (!this.voidFighters().length || this.voidAllIdle()) this.startVoidRetreat();
        else if (age >= VOID_REVEAL_S) this.startVoidFight();
        return;
      case "fight":
      case "phase2":
      case "phase3":
        if (!this.voidFighters().length || this.voidAllIdle()) this.startVoidRetreat();
        else this.tickVoidFight();
        return;
      case "dying":
        this.tickVoidDeath(age);
        if (age >= VOID_DYING_S) this.voidVictory();
        return;
      case "victory":
        if (age >= VOID_VICTORY_S) this.endVoid();
        return;
      case "retreat":
        if (age >= VOID_RETREAT_S) this.endVoid();
        return;
    }
  }

  /** every raider in the Sanctum went quiet (its session sent nothing for RAID_IDLE_S): the boss gives up */
  private voidAllIdle(): boolean {
    for (const emp of this.voidFighters()) if (this.clock - emp.lastEventAt <= RAID_IDLE_S) return false;
    return true;
  }

  /** the secret fight is over (or never began): raiders still down there go back to B3, the camera follows */
  private endVoid() {
    for (const emp of this.employees.values()) {
      if (!emp.inDungeon || emp.floor !== VOID_FLOOR) continue;
      emp.floor = DUNGEON_FLOORS;
      emp.floorKills = 0;
      emp.stairsAt = -1;
      emp.raid = null;
      emp.hearts = MAX_HEARTS;
    }
    resetVoid(this.voidFight, this.voidCtl);
    if (this.dungeonFloor === VOID_FLOOR) this.setDungeonFloor(DUNGEON_FLOORS);
    this.bumpStats();
  }

  private startVoidWipe() {
    setVoidPhase(this.voidFight, this.clock, "transition");
    this.sfx("voidWipe");
    this.voidShake(VOID_SHAKE_WIPE);
    this.bumpStats();
  }

  /** the wipe is opaque: every B3 raider appears in the Sanctum, and the camera follows */
  private moveRaidersToVoid() {
    this.voidCtl.moved = true;
    for (const emp of this.lordFighters()) {
      emp.floor = VOID_FLOOR;
      emp.floorKills = 0;
      emp.stairsAt = -1;
      emp.raid = null;
      emp.raidDoneAt = -1;
      emp.dodgeAt = -99;
      emp.voidHitAt = -99;
    }
    if (this.scene === "dungeon" && this.dungeonFloor === DUNGEON_FLOORS) this.setDungeonFloor(VOID_FLOOR);
    this.hoverId = null;
    this.bumpStats();
  }

  /** the Veiled One descends: the pool is locked now, and nobody can hurt it yet */
  private startVoidReveal() {
    const boss = this.voidFight,
      ctl = this.voidCtl,
      clock = this.clock,
      fighters = this.voidFighters();
    setVoidPhase(boss, clock, "reveal");
    ctl.stepAt = clock; // the raiders walk up to the boss
    boss.maxHp = Math.max(1, Math.round(lordMaxHp(fighters.length, this.voidTierAvg(fighters)) * VOID_HP_MULT));
    boss.hp = boss.maxHp;
    boss.shown = 0;
    boss.x = VOID_HOME_X;
    boss.invulnUntil = clock + VOID_REVEAL_S;
    cutVoidBeats(boss, ctl, clock);
    this.voidBeats(
      { text: m.void_banner_reveal(), dur: VOID_BANNER_S },
      VOID_LINES_REVEAL[boss.kills % VOID_LINES_REVEAL.length],
    );
    this.sfx("voidReveal");
    this.voidShake(VOID_SHAKE_REVEAL);
    const body = this.voidBody();
    this.onFloor(VOID_FLOOR, () =>
      this.burst(
        body.x,
        body.y,
        VOID_FX_REVEAL.n,
        VOID_FX_REVEAL.cols,
        VOID_FX_REVEAL.speed,
        VOID_FX_REVEAL.gravity,
        VOID_FX_REVEAL.life,
        1,
        true,
      ),
    );
    this.bumpStats();
  }

  private startVoidFight() {
    const ctl = this.voidCtl;
    setVoidPhase(this.voidFight, this.clock, "fight");
    ctl.nextAttackAt = this.clock + VOID_FIRST_ATTACK_S;
    ctl.nextTauntAt = this.clock + VOID_TAUNT_EVERY_S / 2;
    ctl.nextMenaceAt = this.clock;
    this.bumpStats();
  }

  /** every minion crumbles (a phase changed, or the fight ended) */
  private clearVoidMinions() {
    const boss = this.voidFight;
    for (const minion of boss.minions) if (minion.on && minion.clearedAt < 0) minion.clearedAt = this.clock;
    boss.shielded = false;
  }

  /** below 60% hp: the TRUE FORM cinematic (invulnerable, shaking), then harder attacks with the collapse and the eclipse */
  private startVoidPhase2() {
    const boss = this.voidFight,
      ctl = this.voidCtl,
      clock = this.clock;
    setVoidPhase(boss, clock, "phase2");
    boss.phase2At = clock;
    boss.invulnUntil = clock + VOID_TRUE_FORM_S;
    stopVoidAttack(boss, clock);
    this.clearVoidMinions();
    ctl.nextAttackAt = boss.invulnUntil + VOID_FIRST_ATTACK_P2_S;
    ctl.nextTauntAt = boss.invulnUntil + VOID_TAUNT_EVERY_S / 2;
    ctl.phaseCount = 0;
    this.voidPushback(1);
    cutVoidBeats(boss, ctl, clock);
    this.voidBeats({ text: m.void_banner_true_form(), dur: VOID_BANNER_TRUE_FORM_S }, VOID_LINE_PHASE2);
    this.sfx("voidTrueForm");
    this.voidShake(VOID_SHAKE_TRUE_FORM, true);
    const body = this.voidBody();
    this.onFloor(VOID_FLOOR, () =>
      this.burst(
        body.x,
        body.y,
        VOID_FX_FLASH.n,
        VOID_FX_FLASH.cols,
        VOID_FX_FLASH.speed,
        VOID_FX_FLASH.gravity,
        VOID_FX_FLASH.life,
        1,
        true,
      ),
    );
    this.bumpStats();
  }

  /**
   * below 25% hp: THE VOID AWAKENS. The boss rises into the sky eye (invulnerable ascend, shaking), the core floats
   * down between the colossus's hands, then the hands slam and the eye sweeps a gaze beam (no minions).
   */
  private startVoidPhase3() {
    const boss = this.voidFight,
      ctl = this.voidCtl,
      clock = this.clock;
    setVoidPhase(boss, clock, "phase3");
    boss.phase3At = clock;
    boss.ascendAt = clock;
    boss.invulnUntil = clock + VOID_ASCEND_S;
    boss.coreOpenAt = boss.invulnUntil - VOID_CORE_OPEN_S;
    boss.x = VOID_HOME_X;
    this.tickVoidCore();
    stopVoidAttack(boss, clock);
    this.clearVoidMinions();
    homeVoidHands(boss, clock, "rise");
    ctl.nextAttackAt = boss.invulnUntil + VOID_FIRST_ATTACK_P3_S;
    ctl.nextTauntAt = boss.invulnUntil + VOID_TAUNT_EVERY_S / 2;
    ctl.phaseCount = 0;
    this.voidPushback(2);
    cutVoidBeats(boss, ctl, clock);
    this.voidBeats({ text: m.void_banner_awakens(), dur: VOID_BANNER_AWAKENS_S }, VOID_LINE_PHASE3);
    this.sfx("voidAscend");
    this.voidShake(VOID_SHAKE_ASCEND, true);
    const body = this.voidBody();
    this.onFloor(VOID_FLOOR, () =>
      this.burst(
        body.x,
        body.y,
        VOID_FX_FLASH.n,
        VOID_FX_FLASH.cols,
        VOID_FX_FLASH.speed,
        VOID_FX_FLASH.gravity,
        VOID_FX_FLASH.life,
        1,
        true,
      ),
    );
    this.bumpStats();
  }

  /** the core drifts across the arena and floats down from above (phase 3, until it dies) */
  private tickVoidCore() {
    const boss = this.voidFight;
    boss.coreX = voidCoreX(this.clock, boss.ascendAt);
    boss.coreY = voidCoreY(this.clock, boss.coreOpenAt);
  }

  /** the colossus's hands: rise -> hover, slam -> sink -> hover */
  private tickVoidHands() {
    const boss = this.voidFight,
      clock = this.clock;
    for (const hand of boss.hands) {
      const age = clock - hand.at;
      if (hand.state === "rise" && age >= VOID_HAND_RISE_S) homeVoidHand(hand, clock, "hover");
      else if (hand.state === "slam" && age >= VOID_HAND_SLAM_S) {
        hand.state = "sink";
        hand.at = clock;
      } else if (hand.state === "sink" && age >= VOID_HAND_SINK_S) homeVoidHand(hand, clock, "hover");
    }
  }

  /** the pool is spent: the multi-stage death (no victory plaque until it has played out) */
  private startVoidDying() {
    const boss = this.voidFight,
      ctl = this.voidCtl,
      clock = this.clock;
    boss.hp = 0;
    setVoidPhase(boss, clock, "dying");
    boss.dyingAt = clock;
    boss.dyingEye = boss.ascendAt >= 0; // it died as the colossus: the eye shatters
    if (boss.dyingEye) homeVoidHands(boss, clock, "sink");
    boss.invulnUntil = Infinity;
    stopVoidAttack(boss, clock);
    this.clearVoidMinions();
    ctl.nextAttackAt = -1;
    ctl.deathStep = 0;
    ctl.crackAt = clock;
    cutVoidBeats(boss, ctl, clock);
    this.voidBeats(null, VOID_LINE_DYING);
    this.sfx("voidDeath");
    this.voidShake(VOID_SHAKE_DEATH);
    this.bumpStats();
  }

  /** every raider left the Sanctum before the kill: the boss fades out laughing */
  private startVoidRetreat() {
    const boss = this.voidFight,
      ctl = this.voidCtl,
      clock = this.clock;
    setVoidPhase(boss, clock, "retreat");
    stopVoidAttack(boss, clock);
    homeVoidHands(boss, clock);
    this.clearVoidMinions();
    ctl.nextAttackAt = -1;
    cutVoidBeats(boss, ctl, clock);
    this.voidBeats({ text: m.void_banner_retreat(), dur: VOID_BANNER_S }, VOID_LINE_RETREAT);
    this.sfx("voidBlink");
    this.bumpStats();
  }

  /** a tool finished with a raider in the Sanctum: the same hit rules as the Lord (tier crit and damage, class skills) */
  private voidRaidHit(emp: Employee, tool: string) {
    const boss = this.voidFight;
    if (boss.phase === "reveal" || (voidFightingPhase(boss.phase) && this.clock < boss.invulnUntil)) {
      boss.blockedAt = this.clock; // the shield ripple: the hit is blocked and nothing was applied
      return;
    }
    if (!voidFightingPhase(boss.phase)) return;
    const roll = this.rollHit(emp, tool);
    const minion = boss.shielded ? clearVoidMinion(boss, this.clock) : null;
    if (minion) this.voidHitMinion(emp, minion, roll.crit);
    else this.voidHit(emp, roll.dmg, roll.crit);
    if (roll.skill) {
      const target = minion
        ? { x: minion.x, y: minion.y - VOID_MINION_LIFT_PX }
        : { x: boss.lastHitX, y: boss.lastHitY };
      this.castSkill(emp, roll.skill, this.raiderPoint(emp), target);
    }
  }

  /** the shield: a hit kills a minion instead of hurting the boss */
  private voidHitMinion(emp: Employee, minion: VoidMinion, crit: boolean) {
    const boss = this.voidFight;
    boss.shielded = voidMinionsAlive(boss) > 0;
    boss.blockedAt = this.clock;
    boss.lastHitX = minion.x;
    boss.lastHitY = minion.y - VOID_MINION_LIFT_PX;
    boss.lastHitDmg = 0;
    boss.lastHitCrit = crit;
    boss.lastHitAt = this.clock;
    boss.lastHitId = emp.id;
    boss.lastHitMinion = true;
    this.sfx("hit");
    this.fxFor(emp, () =>
      this.burst(
        minion.x,
        minion.y - VOID_MINION_LIFT_PX,
        VOID_FX_CRACK.n,
        VOID_FX_CRACK.cols,
        VOID_FX_CRACK.speed,
        VOID_FX_CRACK.gravity,
        VOID_FX_CRACK.life,
      ),
    );
  }

  /** damage pools into the one hp bar; phase thresholds and the death follow */
  private voidHit(emp: Employee, dmg: number, crit: boolean) {
    const boss = this.voidFight;
    damageVoid(boss, dmg);
    boss.hitAt = this.clock; // only when damage was applied
    const colossus = boss.phase === "phase3";
    const body = colossus ? { x: boss.coreX, y: boss.coreY + VOID_BODY_H / 2 } : this.voidBody(); // the core is the weak point
    const hitX = colossus
      ? boss.coreX + rand(-VOID_CORE_HIT_W / 2, VOID_CORE_HIT_W / 2)
      : boss.x + rand(-VOID_BODY_W / 2, VOID_BODY_W / 2);
    const hitY = colossus
      ? boss.coreY + rand(-VOID_CORE_HIT_H / 2, VOID_CORE_HIT_H / 2)
      : VOID_FEET_Y - VOID_BODY_H * rand(VOID_HIT_Y_MIN, VOID_HIT_Y_MAX);
    boss.lastHitX = hitX;
    boss.lastHitY = hitY;
    boss.lastHitDmg = dmg;
    boss.lastHitCrit = crit;
    boss.lastHitAt = this.clock;
    boss.lastHitId = emp.id;
    boss.lastHitMinion = false;
    this.sfx("hit");
    this.fxFor(emp, () => {
      this.pop(
        hitX + rand(-VOID_POP_JITTER, VOID_POP_JITTER),
        body.y - VOID_BODY_H / 2 - VOID_POP_LIFT,
        `-${dmg}`,
        crit ? "#ffe14a" : "#ffffff",
        crit,
        crit,
        crit ? VOID_CRIT_POP_S : undefined,
        crit ? VOID_CRIT_POP_SCALE : 0,
      );
      const sparks = crit ? VOID_FX_CRIT : VOID_FX_HIT;
      this.burst(hitX, hitY, sparks.n, sparks.cols, sparks.speed, sparks.gravity, sparks.life);
    });
    if (crit) this.voidShake(VOID_SHAKE_CRIT);
    if (boss.hp <= 0) this.startVoidDying();
    else if (boss.phase === "fight" && voidHpFrac(boss) < VOID_PHASE2_BELOW) this.startVoidPhase2();
    else if (boss.phase === "phase2" && voidHpFrac(boss) < VOID_PHASE3_BELOW) this.startVoidPhase3();
  }

  /** attacks, minions, taunts and the menace pulse while the boss fights */
  private tickVoidFight() {
    const boss = this.voidFight,
      ctl = this.voidCtl,
      clock = this.clock;
    const dt = ctl.lastAt < 0 ? 0 : Math.min(MAX_FRAME_DT, clock - ctl.lastAt);
    ctl.lastAt = clock;
    if (boss.phase === "phase2" && clock < boss.invulnUntil) this.voidShake(VOID_SHAKE_TRUE_FORM, true);
    if (boss.phase === "phase3") {
      if (clock < boss.invulnUntil) this.voidShake(VOID_SHAKE_ASCEND, true);
      this.tickVoidCore();
      this.tickVoidHands();
    }
    if (clock >= ctl.nextMenaceAt) {
      boss.menaceAt = clock;
      ctl.nextMenaceAt = clock + VOID_MENACE_EVERY_S;
    }
    this.tickVoidMinions(dt);
    if (
      clock >= ctl.nextTauntAt &&
      clock >= boss.invulnUntil &&
      !ctl.beats.length &&
      voidStageFree(ctl, clock) &&
      ctl.nextTauntAt >= 0
    ) {
      this.voidBeats(null, voidTauntLine(boss.phase, ctl.tauntN++));
      ctl.nextTauntAt = clock + voidNextTaunt(Math.random());
    }
    const attack = boss.attack;
    if (
      attack &&
      attack.kind === "blink" &&
      attack.landed &&
      boss.x !== VOID_HOME_X &&
      clock >= attack.hitAt + VOID_BLINK_STAY_S
    ) {
      boss.blinkFromX = boss.x; // it steps back home once the strike is done
      boss.blinkAt = clock;
      boss.x = VOID_HOME_X;
    }
    const attackPhase = voidAttackPhase(boss, clock);
    if (attackPhase === "none") {
      for (const eye of boss.eyes) eye.on = false;
      if (clock >= boss.invulnUntil && ctl.nextAttackAt >= 0 && clock >= ctl.nextAttackAt) this.startVoidAttack();
      return;
    }
    if (!attack) return;
    if (!attack.landed && clock >= attack.hitAt) {
      attack.landed = true;
      this.landVoidAttack();
    }
    if (attack.landed) this.tickVoidAttack();
  }

  /** minions drift to the nearest raider, strike on contact, and crumble after VOID_MINION_LIFE_S */
  private tickVoidMinions(dt: number) {
    const boss = this.voidFight,
      clock = this.clock;
    const fighters = this.voidFighters();
    for (const minion of boss.minions) {
      if (!minion.on) continue;
      if (minion.clearedAt >= 0) {
        if (clock - minion.clearedAt > VOID_MINION_POOF_S) minion.on = false;
        continue;
      }
      if (clock - minion.bornAt > VOID_MINION_LIFE_S) {
        minion.clearedAt = clock;
        continue;
      }
      let nearest: Employee | null = null,
        best = Infinity,
        goal = { x: minion.x, y: minion.y };
      for (const emp of fighters) {
        const spot = this.raiderPoint(emp);
        const dist = Math.hypot(spot.x - minion.x, spot.y - minion.y);
        if (dist < best) {
          best = dist;
          nearest = emp;
          goal = spot;
        }
      }
      if (!nearest) continue;
      if (best > VOID_MINION_REACH_PX) {
        const step = Math.min(best, VOID_MINION_SPEED * dt);
        minion.x += ((goal.x - minion.x) / best) * step;
        minion.y += ((goal.y - minion.y) / best) * step;
      } else if (clock - minion.strikeAt >= VOID_MINION_STRIKE_EVERY_S) {
        minion.strikeAt = clock;
        this.voidStrike(nearest, "direct");
      }
    }
    boss.shielded = voidMinionsAlive(boss) > 0;
  }

  /** pick an attack and its target and start the warning */
  private startVoidAttack() {
    const boss = this.voidFight,
      ctl = this.voidCtl,
      fighters = this.voidFighters();
    if (!fighters.length) return;
    const kind = pickVoidAttack(boss.phase, ctl.prev, ctl.phaseCount, Math.random(), voidMinionsAlive(boss) > 0);
    const victim = fighters[Math.floor(Math.random() * fighters.length) % fighters.length];
    const at =
      kind === "gaze" ? { x: VOID_ARENA_X0, y: (VOID_ARENA_Y0 + VOID_ARENA_Y1) / 2 } : this.raiderPoint(victim);
    ctl.count++;
    ctl.prev = kind;
    if (boss.phase === "phase2" || boss.phase === "phase3") ctl.phaseCount++;
    ctl.targetId = victim.id;
    ctl.done.clear();
    const attack = beginVoidAttack(boss, this.clock, kind, at.x, at.y, ctl.count);
    if (kind === "eyes") spawnVoidEyes(boss, this.clock, attack, voidEyeCount(boss.phase));
    if (kind === "eclipse") this.sfx("voidEclipse");
    if (kind === "hand") {
      const hand = boss.hands[voidHandFor(boss, at.x)];
      hand.state = "windup";
      hand.at = this.clock;
      hand.x = at.x;
      hand.y = at.y;
    }
    ctl.nextAttackAt = attack.endAt + voidNextGap(boss.phase, Math.random());
  }

  /** the warning ran out: the attack lands */
  private landVoidAttack() {
    const boss = this.voidFight,
      ctl = this.voidCtl,
      attack = boss.attack;
    if (!attack) return;
    switch (attack.kind) {
      case "beam":
        this.sfx("voidBeam");
        this.voidShake(VOID_SHAKE_BEAM);
        this.voidImpact(attack.targetX, attack.targetY);
        break;
      case "blink": {
        const victim = this.employees.get(ctl.targetId);
        boss.blinkFromX = boss.x;
        boss.blinkAt = this.clock;
        boss.x = (victim ? this.raiderPoint(victim).x : attack.targetX) + VOID_BLINK_DX;
        this.sfx("voidBlink");
        this.voidImpact(boss.x, attack.targetY);
        if (victim && victim.inDungeon && victim.floor === VOID_FLOOR) this.voidStrike(victim, "attack");
        break;
      }
      case "collapse":
        this.sfx("lordSlam");
        this.voidShake(VOID_SHAKE_COLLAPSE);
        this.voidImpact((VOID_ARENA_X0 + VOID_ARENA_X1) / 2, (VOID_ARENA_Y0 + VOID_ARENA_Y1) / 2);
        for (const emp of this.voidFighters()) {
          const spot = this.raiderPoint(emp);
          if (voidCollapseAt(attack.seed, spot.x, spot.y)) this.voidStrike(emp, "attack");
        }
        break;
      case "eclipse":
        this.voidShake(VOID_SHAKE_ECLIPSE);
        boss.quakeUntil = this.clock + VOID_QUAKE_S;
        this.voidImpact((VOID_ARENA_X0 + VOID_ARENA_X1) / 2, (VOID_ARENA_Y0 + VOID_ARENA_Y1) / 2);
        for (const emp of this.voidFighters()) this.voidStrike(emp, "eclipse");
        break;
      case "hand": {
        this.sfx("voidHandSlam");
        this.voidShake(VOID_SHAKE_HAND);
        if (!this.reducedMotion) boss.quakeUntil = this.clock + VOID_HAND_QUAKE_S;
        this.voidImpact(attack.targetX, attack.targetY);
        for (const hand of boss.hands)
          if (hand.state === "windup") {
            hand.state = "slam";
            hand.at = this.clock;
          }
        const victim = this.employees.get(ctl.targetId);
        if (victim && victim.inDungeon && victim.floor === VOID_FLOOR) this.voidStrike(victim, "attack");
        break;
      }
      case "gaze":
        this.sfx("voidGaze");
        this.voidShake(VOID_SHAKE_GAZE);
        this.voidImpact(VOID_ARENA_X0, attack.targetY);
        break;
      case "summon": {
        this.sfx("lordSummon");
        const body = this.voidBody();
        this.voidImpact(body.x, body.y);
        raiseVoidMinions(boss, this.clock, voidMinionCount(boss.phase));
        boss.shielded = voidMinionsAlive(boss) > 0;
        this.onFloor(VOID_FLOOR, () => {
          for (const minion of boss.minions)
            if (minion.on && minion.bornAt === this.clock)
              this.burst(
                minion.x,
                minion.y - VOID_MINION_LIFT_PX,
                VOID_FX_ROAR.n,
                VOID_FX_ROAR.cols,
                VOID_FX_ROAR.speed,
                VOID_FX_ROAR.gravity,
                VOID_FX_ROAR.life,
                1,
                true,
              );
        });
        break;
      }
      default:
        break;
    }
  }

  /** while an attack is up: the beam reaches raiders on its row, the eyes fire one by one */
  private tickVoidAttack() {
    const boss = this.voidFight,
      ctl = this.voidCtl,
      attack = boss.attack,
      clock = this.clock;
    if (!attack) return;
    if (attack.kind === "beam") {
      for (const emp of this.voidFighters()) {
        if (ctl.done.has(emp.id)) continue;
        const spot = this.raiderPoint(emp);
        if (Math.abs(spot.y - attack.targetY) > VOID_BEAM_HALF_PX) continue;
        if (clock >= attack.hitAt + voidBeamArrive(boss.x, spot.x)) this.voidStrike(emp, "attack");
      }
    } else if (attack.kind === "gaze") {
      const sweepX = voidGazeX(attack, clock, VOID_ARENA_X0, VOID_ARENA_X1);
      for (const emp of this.voidFighters())
        if (!ctl.done.has(emp.id) && this.raiderPoint(emp).x <= sweepX) this.voidStrike(emp, "attack");
    } else if (attack.kind === "eyes") {
      for (const eye of boss.eyes) {
        if (!eye.on || eye.fired || clock < eye.fireAt) continue;
        eye.fired = true;
        this.sfx("voidBeam");
        this.voidImpact(eye.x, eye.y);
        this.onFloor(VOID_FLOOR, () =>
          this.burst(
            eye.x,
            eye.y,
            VOID_FX_EYE.n,
            VOID_FX_EYE.cols,
            VOID_FX_EYE.speed,
            VOID_FX_EYE.gravity,
            VOID_FX_EYE.life,
          ),
        );
        let nearest: Employee | null = null,
          best = Infinity;
        for (const emp of this.voidFighters()) {
          const spot = this.raiderPoint(emp);
          const dist = Math.hypot(spot.x - eye.x, spot.y - eye.y);
          if (dist < best) {
            best = dist;
            nearest = emp;
          }
        }
        if (nearest) this.voidStrike(nearest, "direct"); // each eye is its own shot
      }
    }
  }

  /**
   * an attack reaches a raider. A raider dodges with VOID_DODGE_CHANCE (the hop); a hit costs a heart but never the
   * last one, knocks them back and is recorded for the renderer. The eclipse hits everybody: dodgers survive at 1
   * heart, the rest are left at 0 (cosmetic: nobody leaves). "direct" skips the once-per-attack bookkeeping.
   */
  private voidStrike(emp: Employee, mode: "attack" | "eclipse" | "direct") {
    const boss = this.voidFight,
      ctl = this.voidCtl,
      eclipse = mode === "eclipse";
    if (mode === "attack" && ctl.done.has(emp.id)) return;
    ctl.done.add(emp.id);
    const dodged = Math.random() < VOID_DODGE_CHANCE;
    const at = this.raiderPoint(emp);
    if (dodged) emp.dodgeAt = this.clock;
    else {
      emp.voidHitAt = this.clock;
      emp.voidKnock = at.x <= boss.x ? -1 : 1;
    }
    if (eclipse) {
      emp.hearts = dodged ? VOID_ECLIPSE_DODGED_HEARTS : VOID_ECLIPSE_HIT_HEARTS;
      if (!dodged) {
        emp.hurtUntil = this.clock + VOID_ECLIPSE_HURT_S;
        emp.redUntil = this.clock + VOID_ECLIPSE_HURT_S;
      }
    } else if (!dodged) {
      if (emp.hearts > VOID_HEART_FLOOR) this.loseHeart(emp);
      else emp.hurtUntil = this.clock + VOID_HURT_S;
    }
    if (!dodged) {
      boss.lastHurtId = emp.id;
      boss.lastHurtAt = this.clock;
      boss.lastHurtHearts = emp.hearts;
      this.voidImpact(at.x, at.y);
    }
    this.fxFor(emp, () => {
      this.pop(at.x, at.y - POP_ABOVE_HEAD, dodged ? "!" : "!!", dodged ? "#9ad8ff" : "#ff6a8a", false, false);
      if (!dodged)
        this.burst(
          at.x,
          at.y - LORD_HIT_POP_LIFT * 2,
          VOID_FX_HURT.n,
          VOID_FX_HURT.cols,
          VOID_FX_HURT.speed,
          VOID_FX_HURT.gravity,
          VOID_FX_HURT.life,
        );
    });
  }

  /** the dying boss: cracks of light, then the implosion, then the final flash */
  private tickVoidDeath(age: number) {
    const ctl = this.voidCtl,
      boss = this.voidFight,
      eye = boss.dyingEye,
      body = eye ? { x: boss.coreX, y: boss.coreY } : this.voidBody();
    const crackS = eye ? VOID_EYE_CRACK_S : VOID_DEATH_CRACK_S;
    const implodeS = eye ? VOID_EYE_SHATTER_S : VOID_DEATH_IMPLODE_S;
    if (age < crackS) {
      if (this.clock - ctl.crackAt >= VOID_CRACK_EVERY_S) {
        ctl.crackAt = this.clock;
        this.voidShake(VOID_SHAKE_CRIT);
        this.onFloor(VOID_FLOOR, () =>
          this.burst(
            body.x + rand(-VOID_POP_JITTER, VOID_POP_JITTER),
            body.y + rand(-VOID_BODY_H / 2, VOID_BODY_H / 2),
            VOID_FX_CRACK.n,
            VOID_FX_CRACK.cols,
            VOID_FX_CRACK.speed,
            VOID_FX_CRACK.gravity,
            VOID_FX_CRACK.life,
          ),
        );
      }
      return;
    }
    if (age < implodeS) {
      if (ctl.deathStep < VOID_STEP_IMPLODE) {
        ctl.deathStep = VOID_STEP_IMPLODE;
        if (eye) this.sfx("voidShatterEye");
        this.voidShake(eye ? VOID_SHAKE_EYE_SHATTER : VOID_SHAKE_DEATH);
        this.onFloor(VOID_FLOOR, () =>
          this.ring(
            body.x,
            body.y,
            VOID_FX_IMPLODE.n,
            VOID_FX_IMPLODE.cols,
            VOID_FX_IMPLODE.speed,
            VOID_FX_IMPLODE.life,
            true,
          ),
        );
      }
      return;
    }
    if (ctl.deathStep < VOID_STEP_FLASH) {
      ctl.deathStep = VOID_STEP_FLASH;
      this.voidShake(VOID_SHAKE_FLASH);
      this.onFloor(VOID_FLOOR, () =>
        this.burst(
          body.x,
          body.y,
          VOID_FX_FLASH.n,
          VOID_FX_FLASH.cols,
          VOID_FX_FLASH.speed,
          VOID_FX_FLASH.gravity,
          VOID_FX_FLASH.life,
          1,
          true,
        ),
      );
    }
  }

  /** the Veiled One is gone: the biggest banner, the biggest reward, and the walk home */
  private voidVictory() {
    const boss = this.voidFight,
      clock = this.clock,
      raiders = this.voidFighters();
    if (!raiders.length) {
      this.endVoid(); // everybody left during the death: no plaque, no counters
      return;
    }
    setVoidPhase(boss, clock, "victory");
    boss.kills++;
    this.stats.bosses++;
    for (const raider of raiders) {
      raider.kills += VOID_KILLS;
      raider.qKills += VOID_KILLS;
      raider.gold += VOID_GOLD;
      raider.qGold += VOID_GOLD;
      this.treasury += VOID_GOLD;
      raider.hearts = MAX_HEARTS;
      this.gainXp(raider, Math.max(VOID_XP, xpNeed(raider.lv) - raider.xp));
      raider.raidDoneAt = clock; // desk raiders walk home after the usual linger; the rest go back to B3 at the end
      const at = this.raiderPoint(raider);
      this.fxFor(raider, () =>
        this.pop(at.x, at.y - VOID_POP_RISE, `+${VOID_GOLD}g`, "#f2c14e", true, true, LOOT_POP_DUR),
      );
      this.gmPraise.unshift({ sid: raider.id, at: clock, text: VOID_PRAISE_TEXT });
    }
    if (this.gmPraise.length > GM_PRAISE_CAP) this.gmPraise.length = GM_PRAISE_CAP;
    this.sfx("bossDown");
    this.sfx("voidVictory");
    this.cheers();
    this.voidShake(VOID_SHAKE_VICTORY);
    const slayer = raiders[0];
    if (slayer) {
      cutVoidBeats(boss, this.voidCtl, clock); // the plaque never waits for a lingering line
      this.voidBeats(
        { text: m.void_banner_slain({ tag: slayer.tag, project: slayer.project }), dur: VOID_BANNER_VICTORY_S },
        null,
      );
      this.log.unshift({
        id: this.logSeq++,
        sid: slayer.id,
        color: slayer.look.shirt,
        bad: false,
        text: m.void_banner_slain({ tag: slayer.tag, project: slayer.project }),
        time: Date.now(),
        tag: slayer.tag,
        project: slayer.project,
        intern: false,
        internLabel: "",
        kind: KIND_LORD,
        detail: m.void_log_slain_detail({ count: boss.kills }),
      });
      if (this.log.length > LOG_MAX) this.log.length = LOG_MAX;
    }
    const body = this.voidBody();
    this.onFloor(VOID_FLOOR, () => {
      for (let k = 0; k < VOID_COIN_COUNT; k++)
        this.emitP(
          body.x + rand(-VOID_COIN_SPREAD, VOID_COIN_SPREAD),
          body.y,
          rand(-COIN_VX, COIN_VX),
          rand(-COIN_VY_MAX, -COIN_VY_MIN),
          COIN_GRAVITY,
          COIN_LIFE,
          "#f2c14e",
          1,
          "coin",
          true,
        );
      for (let k = 0; k < VOID_SHOWER_COINS; k++)
        this.emitP(
          VIEW_X0 + ((k + rand(0, 1)) / VOID_SHOWER_COINS) * VIEW_W,
          -rand(0, LORD_SHOWER_HEIGHT),
          rand(-COIN_VX, COIN_VX),
          rand(LORD_SHOWER_VY_MIN, LORD_SHOWER_VY_MAX),
          LORD_SHOWER_GRAVITY,
          LORD_SHOWER_LIFE,
          "#f2c14e",
          1,
          "coin",
          true,
        );
    });
    this.bumpStats();
  }

  /** a dead foe is replaced by a new kind after a short beat */
  private respawnRaid(emp: Employee) {
    if (emp.stairsAt >= 0) {
      if (this.clock - emp.stairsAt >= RAID_STAIRS_S) this.arriveOnNextFloor(emp);
      return;
    }
    const foe = emp.raid;
    if (foe && foe.hp <= 0 && this.clock - foe.deadAt >= RAID_RESPAWN_S) this.newRaidFoe(emp);
  }

  /** a tool finished inside the dungeon: the same damage rules as a field monster, scaled to the foe's hp */
  private raidHit(emp: Employee, tool: string) {
    if (emp.stairsAt >= 0) return; // on the stairs: no fighting
    emp.lungeUntil = this.clock + LUNGE_S;
    emp.hsUntil = this.clock + HITSTOP_S;
    emp.hsAt = this.clock;
    if (emp.floor === VOID_FLOOR) {
      this.voidRaidHit(emp, tool);
      return;
    }
    if (emp.floor >= DUNGEON_FLOORS) {
      if (this.lord.hp <= 0) return;
      const lordRoll = this.rollHit(emp, tool);
      this.lordHit(emp, lordRoll.dmg, lordRoll.crit);
      const body = dungeonLordPoint();
      if (lordRoll.skill) {
        this.castSkill(emp, lordRoll.skill, this.raiderPoint(emp), {
          x: body.x - LORD_HIT_SPARK_DX,
          y: body.y - LORD_H / 2,
        });
        if (!this.reducedMotion) {
          this.lord.hsAt = this.clock; // the Lord freezes with the caster for the impact
          this.lord.hsUntil = Math.max(this.lord.hsUntil, this.clock + SKILL_HITSTOP_S);
        }
      }
      return;
    }
    const foe = emp.raid;
    if (!foe || foe.hp <= 0) return;
    const { dmg, skill } = this.rollHit(emp, tool);
    if (skill) {
      const target = dungeonMonsterPoint(dungeonSpotOf(this.raidSpotIndex(emp), emp.floor));
      this.castSkill(emp, skill, this.raiderPoint(emp), { x: target.x, y: target.y - MON_HIT_LIFT });
    }
    foe.hp = Math.max(
      0,
      foe.hp - dmg / (foe.crypt ? CRYPT_HP[CRYPT_KINDS[foe.kind]] : MON_HP[MONSTER_KINDS[foe.kind]]),
    );
    foe.hitAt = this.clock;
    this.sfx("hit");
    if (foe.hp > 0) return;
    foe.deadAt = this.clock;
    this.sfx("kill");
    const gold = 1 + Math.floor(Math.random() * GOLD_ROLL_MAX);
    emp.kills++;
    emp.gold += gold;
    emp.qKills++;
    emp.qGold += gold;
    this.treasury += gold;
    this.stats.monsters++;
    this.bumpStats();
    const foePos = dungeonMonsterPoint(dungeonSpotOf(this.raidSpotIndex(emp), emp.floor));
    this.floorKill(emp);
    this.fxFor(emp, () => {
      this.pop(foePos.x, foePos.y - GOLD_POP_LIFT, `+${gold}g`, "#f2c14e", false, false, LOOT_POP_DUR);
      for (let k = 0; k < COIN_COUNT; k++)
        this.emitP(
          foePos.x + rand(-COIN_SPREAD_X, COIN_SPREAD_X),
          foePos.y - COIN_LIFT,
          rand(-COIN_VX, COIN_VX),
          rand(-COIN_VY_MAX, -COIN_VY_MIN),
          COIN_GRAVITY,
          COIN_LIFE,
          "#f2c14e",
          1,
          "coin",
        );
    });
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
      tierUpAt: -99,
      lungeUntil: 0,
      dodgeAt: -99,
      voidHitAt: -99,
      voidKnock: -1,
      flashUntil: 0,
      monLungeUntil: 0,
      monKnockUntil: 0,
      monFarKnockUntil: 0,
      skillHits: 0,
      dashAt: -99,
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
      lastTool: "",
      doing: null,
      inDungeon: false,
      raidIn: false,
      raidSlot: -1,
      raidCalls: 0,
      raidSince: this.clock,
      raidEnteredAt: -1,
      raidDoneAt: -1,
      raid: null,
      floor: 1,
      floorKills: 0,
      stairsAt: -1,
      restSpot: -1,
      manaFlashUntil: 0,
      cheerUntil: 0,
      source: "claude",
      model: null,
      rateLimit: null,
    };
    const early = this.metaPending.get(id);
    if (early) {
      this.metaPending.delete(id);
      this.applySessionMeta(emp, early);
    }
    const sv = this.demo ? undefined : this.progress[id];
    if (this.demo) emp.lv = DEMO_LEVELS[this.stats.entered % DEMO_LEVELS.length]; // demo only: show every tier's gear and skills
    if (sv) {
      emp.lv = sv.lv;
      emp.xp = sv.xp;
      emp.gold = sv.gold;
      emp.kills = sv.kills;
    }
    if (!seated) emp.path = routeIn(desk, slot).slice(1);
    else if (desk >= 0) this.spawnMonster(emp, true);
    this.syncRaid(emp);
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
      this.applySessionMeta(emp, session);
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
    if (snap.chronicle !== undefined) this.setChronicle(snap.chronicle);
    if (snap.quests !== undefined) this.setQuests(snap.quests);
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
    if (BUSY_EVENTS.has(name)) this.noteBusy();
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
      if (name === "PermissionRequest") this.noteDoing(emp, evt);
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
        emp.coffeeAfter = name === "Stop" || false;
        break;
      case "TO_COFFEE":
      case "DRINK":
        emp.state = "FROM_COFFEE";
        emp.path = [...emp.trail].reverse();
        emp.trail = [];
        emp.tempBubble = null;
        this.enqueue(emp, evt);
        break;
      case "TO_TAVERN_REST":
      case "AT_TAVERN_REST": // the session is moving again: cut the trip short and walk back
        emp.state = "FROM_TAVERN_REST";
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
      case "TO_TAVERN_REST":
      case "AT_TAVERN_REST":
        emp.state = "FROM_TAVERN_REST";
        break;
      case "TO_RAID":
        emp.state = "FROM_RAID";
        emp.raidSlot = -1; // the raid never began: free its dungeon spot for camp arrivals
        break;
      case "FROM_COFFEE":
      case "FROM_TAVERN_REST":
      case "FROM_RAID":
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
    this.gmRowsAt = -Infinity;
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
        emp.lastTool = tool.slice(0, GM_REPORT_DETAIL_MAX);
        this.noteDoing(emp, evt);
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
        emp.raidCalls++;
        this.onHit(emp, str(evt.tool_name));
        break;
      }
      case "PostToolUseFailure":
        this.setAct(emp, "thinking");
        emp.nextThought = clock + rand(THOUGHT_MIN_S, THOUGHT_MAX_S);
        this.donePending(emp, evt);
        emp.toolCalls++;
        emp.raidCalls++;
        this.onFail(emp);
        break;
      case "PermissionRequest":
        this.noteDoing(emp, evt);
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
          this.setAct(emp, "thinking", "🍺", "idle");
        } else emp.tempBubble = { e: "🔔", until: clock + 2 };
        break;
      }
      case "Stop":
      case "StopFailure":
        emp.doing = null;
        emp.hasPaper = false;
        this.setAct(emp, "thinking");
        this.clearPending(emp);
        if (emp.boss) this.bossLeaves(emp);
        if (name === "Stop" && emp.toolCalls >= QUEST_MIN_TOOLS) {
          this.addBanner("quest", m.banner_quest_done({ calls: emp.toolCalls, gold: emp.qGold }));
        }
        emp.toolCalls = 0;
        emp.qKills = 0;
        emp.qGold = 0;
        if (emp.hearts < MAX_HEARTS && !(name === "StopFailure" && this.limitedStop(emp, evt))) {
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
        if (coffee && !emp.raidIn && name === "Stop") {
          emp.state = "STRETCH";
          emp.stateSince = clock;
        }
        break;
      default:
        break;
    }
  }

  /** a StopFailure caused by a plan limit (the session cannot go on): the adventurer stays at the desk */
  private limitedStop(emp: Employee, evt: HookEvt): boolean {
    return !!emp.rateLimit || str(evt.error).toLowerCase().includes("rate_limit");
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
  /** one landed hit: tier crit chance, flat damage, and (every Nth hit from the adept tier) the class skill's damage */
  private rollHit(emp: Employee, tool: string): HitRoll {
    const stats = tierStats(emp.lv);
    let crit = Math.random() < stats.crit;
    let dmg = (HEAVY_TOOLS.has(tool) ? 2 : 1) + stats.bonus;
    if (crit) dmg *= 2;
    let skill: SkillKind | null = null;
    if (stats.every > 0 && ++emp.skillHits >= stats.every) {
      emp.skillHits = 0;
      skill = CLASS_SKILL[emp.look.cls];
      if (skill === "cleave" || skill === "fireball") dmg *= SKILL_DAMAGE_MULT;
      else if (skill === "backstab") {
        if (!crit) dmg *= 2; // a guaranteed crit
        crit = true;
        dmg += 1;
      } else if (skill === "smite") dmg += SMITE_BONUS;
      else dmg += VOLLEY_ARROWS; // volley: three arrows, +1 each
    }
    return { dmg, crit, skill };
  }

  /** the skill's look (opaque pixels, drawn by lordFx.drawSkillFx), sound and side effects; the damage was rolled already */
  private castSkill(emp: Employee, skill: SkillKind, from: Pt, to: Pt) {
    const gold = gearTier(emp.lv) >= LEGEND_TIER;
    let heal = false;
    if (skill === "smite" && emp.hearts > 0 && emp.hearts < MAX_HEARTS) {
      emp.hearts = Math.min(MAX_HEARTS, emp.hearts + SMITE_HEAL);
      heal = true;
    }
    this.pushSkillFx({
      kind: skill,
      text: SKILL_NAME[skill],
      x0: from.x,
      y0: from.y,
      x1: to.x,
      y1: to.y,
      born: this.clock,
      dur: gold ? SKILL_FX_S_LEGEND : SKILL_FX_S,
      gold,
      heal,
      owner: emp.id,
      noText: false,
      dungeon: emp.inDungeon ? emp.floor : 0,
    });
    this.sfx(SKILL_SFX[skill]);
    if (this.reducedMotion) return;
    emp.hsUntil = Math.max(emp.hsUntil, this.clock + SKILL_HITSTOP_S);
    emp.hsAt = this.clock;
    if (!emp.inDungeon && !this.isHidden(emp) && this.scene === "guild")
      this.addTrauma(gold ? TRAUMA_SKILL_LEGEND : TRAUMA_SKILL);
    if (skill === "backstab") emp.dashAt = this.clock;
    if (skill === "cleave" && !emp.inDungeon) emp.monFarKnockUntil = this.clock + MON_KNOCK_S * CLEAVE_KNOCK_MULT;
    if (skill === "cleave" || skill === "smite" || skill === "backstab")
      this.fxFor(emp, () =>
        this.burst(
          to.x,
          to.y,
          gold ? SKILL_BURST_LEGEND_N : SKILL_BURST.n,
          gold ? ["#ffffff", "#ffe14a", "#f2c14e"] : ["#ffffff", "#ffd070", "#ffb870"],
          SKILL_BURST.speed,
          SKILL_BURST.gravity,
          SKILL_BURST.life,
        ),
      );
  }

  /** skill hit counter and skill-only animation state start fresh with every raid and when leaving */
  private resetSkillState(emp: Employee) {
    emp.skillHits = 0;
    emp.dashAt = -99;
    emp.monFarKnockUntil = 0;
  }

  private pushSkillFx(fx: SkillFx) {
    for (const old of this.skillFx) if (old.owner === fx.owner) old.noText = true; // one name plate at a time
    this.skillFx.push(fx);
    if (this.skillFx.length > SKILL_FX_MAX) this.skillFx.splice(0, this.skillFx.length - SKILL_FX_MAX);
  }

  /** crossing into adept / veteran / elite / legend: a bigger celebration than a plain level-up */
  private tierUp(emp: Employee, tier: number) {
    const text = TIER_UP_TEXT[tier];
    const at = emp.inDungeon ? this.raiderPoint(emp) : emp;
    this.addBanner("tier", `LV.${emp.lv} ${text}`, true);
    this.sfx("tierUp");
    emp.tierUpAt = this.clock;
    // the guild master walks over to congratulate (first in line; he skips it while he is on an urgent report)
    if (!emp.inDungeon && !emp.raidIn) {
      this.gmPraise.unshift({ sid: emp.id, at: this.clock, text: TIER_PRAISE_TEXT[emp.look.cls] });
      if (this.gmPraise.length > GM_PRAISE_CAP) this.gmPraise.length = GM_PRAISE_CAP;
    }
    if (!this.reducedMotion)
      this.fxFor(emp, () =>
        this.ring(
          at.x,
          at.y - FX_LEVELUP_RING.lift,
          TIER_RING_N,
          ["#ffe14a", "#ffffff", "#f2c14e"],
          TIER_RING_SPEED,
          TIER_RING_LIFE,
        ),
      );
  }

  private onHit(emp: Employee, tool: string) {
    const clock = this.clock;
    if (emp.boss) {
      this.bossDown(emp);
      return;
    }
    const mp = emp.monPos;
    const xp = 1 + Math.floor(Math.random() * XP_ROLL_MAX);
    if (emp.inDungeon) this.raidHit(emp, tool);
    if (mp && emp.deskIdx >= 0 && !emp.raidIn && !emp.monDead && clock - emp.monAppearAt > MON_HITTABLE_AFTER_S) {
      const { dmg, crit, skill } = this.rollHit(emp, tool);
      emp.monHp -= dmg;
      this.sfx("hit");
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
      if (skill) this.castSkill(emp, skill, emp, { x: hx, y: hy });
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
    this.sfx("kill");
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
    const tierBefore = gearTier(emp.lv);
    let up = false;
    while (emp.xp >= xpNeed(emp.lv)) {
      emp.xp -= xpNeed(emp.lv);
      emp.lv++;
      this.chronLocal.levels++;
      up = true;
    }
    if (up) {
      this.sfx("levelUp");
      emp.lvlAt = this.clock;
      emp.lvlTo = emp.lv;
      const at = emp.inDungeon ? this.raiderPoint(emp) : emp;
      this.fxFor(emp, () =>
        this.ring(
          at.x,
          at.y - FX_LEVELUP_RING.lift,
          FX_LEVELUP_RING.n,
          ["#f2c14e", "#ffffff", "#8ee8ff"],
          FX_LEVELUP_RING.speed,
          FX_LEVELUP_RING.life,
        ),
      );
      if (gearTier(emp.lv) > tierBefore) this.tierUp(emp, gearTier(emp.lv));
    }
    this.touch(emp);
  }

  private loseHeart(emp: Employee) {
    emp.hearts = Math.max(0, emp.hearts - 1);
    emp.hurtUntil = this.clock + HURT_S;
    emp.redUntil = this.clock + RED_S;
    const at = emp.inDungeon ? this.raiderPoint(emp) : emp;
    this.fxFor(emp, () => {
      this.pop(at.x - HURT_POP_DX, at.y - HURT_POP_LIFT, "-1", "#ff5a5a", false, false, HURT_POP_DUR);
      this.burst(at.x, at.y - FX_HURT_BURST.lift, FX_HURT_BURST.n, ["#ff5a5a", "#ff9a9a"], FX_HURT_BURST.speed);
    });
    if (!emp.inDungeon) this.addTrauma(TRAUMA_HURT);
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
    this.sfx("bossAppear");
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
    this.sfx("bossDown");
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
      !emp.raidIn &&
      !emp.duel &&
      !emp.boss &&
      emp.pending.size === 0 &&
      emp.act !== "handup" &&
      !this.isWaiting(emp)
    );
  }

  /**
   * PreCompact: a free adventurer walks to a free tavern spot, sits and has a beer for a moment and walks
   * back (any event that arrives cuts the rest short). A busy one (tool in flight, boss, duel, hand up) stays put and
   * just gets the 🍺 bubble. The mana bar is never touched: it follows the next real context reading.
   */
  /** a feast seat nobody is using (walkers and diners both hold theirs), else -1 = stand beside the counter; remembered in restSpot */
  private freeFeastSeat(emp: Employee): number {
    const taken = new Set<number>();
    for (const other of this.employees.values()) {
      if (other === emp) continue;
      if (other.restSpot >= 0 && this.holdsFeastSeat(other)) taken.add(other.restSpot);
    }
    emp.restSpot = -1;
    for (let i = 0; i < FEAST_SEATS.length; i++) {
      if (taken.has(i)) continue;
      emp.restSpot = i;
      break;
    }
    return emp.restSpot;
  }
  private seatFacing(emp: Employee): 1 | -1 {
    return emp.restSpot >= 0 ? FEAST_SEATS[emp.restSpot].face : 1;
  }
  /** a seat stays taken while its owner is on a break, and while a leaver is still walking out of the wing */
  private holdsFeastSeat(emp: Employee): boolean {
    return this.onBreak(emp) || (emp.state === "LEAVING" && emp.x < 0);
  }
  /** on a coffee or beer break (walking there, sitting, or walking back) */
  private onBreak(emp: Employee): boolean {
    switch (emp.state) {
      case "TO_COFFEE":
      case "DRINK":
      case "FROM_COFFEE":
        return true;
      default:
        return this.onTavernRestState(emp);
    }
  }
  private onTavernRestState(emp: Employee): boolean {
    return emp.state === "TO_TAVERN_REST" || emp.state === "AT_TAVERN_REST" || emp.state === "FROM_TAVERN_REST";
  }

  private onCompact(emp: Employee, canWalk: boolean) {
    const walk = canWalk && !this.reducedMotion && this.compactReady(emp);
    emp.compactPending = true;
    emp.doing = null;
    this.setAct(emp, "thinking");
    if (!walk) {
      emp.tempBubble = { e: "🍺", until: this.clock + COMPACT_BUBBLE_S };
      return;
    }
    const route = routeToBreak(emp.deskIdx, emp.slot, this.freeFeastSeat(emp)).slice(1);
    emp.state = "TO_TAVERN_REST";
    emp.stateSince = this.clock;
    emp.trail = [{ x: emp.x, y: emp.y }];
    emp.path = route;
    emp.holdUntil = 0;
    this.dirty = true;
  }

  // ---------- the west wing: feast table, chef, cheers, feast, bard ----------
  private resetWing() {
    this.chef.x = CHEF_HOME.x;
    this.chef.y = CHEF_HOME.y;
    this.chef.face = CHEF_FACE_HOME;
    this.chef.path = [];
    this.chef.holdUntil = 0;
    this.chef.plate = -1;
    this.chef.target = -1;
    this.resetGuildMaster();
    this.hall.reset();
    this.dishes.fill(null);
    this.cheersAt = NEVER_S;
    this.cheersReal = NEVER_S;
    this.cheersText = "";
    this.feastAt = NEVER_S;
    this.feastUntil = 0;
    this.bardOn = false;
    this.nextServeAt = 0;
    this.nextNoteAt = 0;
    this.confettiAcc = 0;
    this.busyStamps = [];
    this.doneStamps = [];
  }

  /** a tool call / prompt just happened: the busier the guild, the more often the chef carries a plate out */
  private noteBusy() {
    this.busyStamps.push(this.clock);
    if (this.busyStamps.length > BUSY_MAX) this.busyStamps.splice(0, this.busyStamps.length - BUSY_MAX);
  }
  /** tool calls / prompts seen in the last BUSY_WINDOW_S sim seconds */
  recentBusy(): number {
    while (this.busyStamps.length && this.clock - this.busyStamps[0] > BUSY_WINDOW_S) this.busyStamps.shift();
    return this.busyStamps.length;
  }
  /** sim seconds between two plates: long when the guild is quiet, short when it is busy, shortest during a feast */
  serveEvery(): number {
    if (this.feasting()) return SERVE_FEAST_S;
    return Math.max(SERVE_MIN_S, SERVE_IDLE_S - this.recentBusy() * SERVE_PER_EVENT_S);
  }
  feasting(): boolean {
    return this.clock < this.feastUntil;
  }
  /** sitting at the long table right now (arrived, not walking) */
  atFeast(emp: Employee): boolean {
    return (emp.state === "DRINK" || emp.state === "AT_TAVERN_REST") && emp.restSpot >= 0;
  }
  /**
   * who sits at the table and is on screen (a hidden session keeps its seat but is not drawn, toasted to or served).
   * Refills one reusable array and the seat -> diner slots in place: no allocation per call, call it once per tick/frame.
   */
  feastDiners(): Employee[] {
    this.diners.length = 0;
    this.dinerSlots.fill(null);
    for (const emp of this.employees.values())
      if (this.atFeast(emp) && !this.isHidden(emp)) {
        this.diners.push(emp);
        this.dinerSlots[emp.restSpot] = emp;
      }
    return this.diners;
  }
  /** the bard plays while anyone is at the table or resting at their post; silent when everyone is working */
  private bardShouldPlay(diners: Employee[]): boolean {
    if (diners.length >= BARD_REST_COUNT) return true;
    for (const emp of this.employees.values()) if (emp.resting) return true;
    return false;
  }

  /** a receipt closed "done" (or a commit landed): everyone at the table raises a mug */
  cheers() {
    this.hall.toast();
    const diners = this.feastDiners();
    if (!diners.length) return;
    this.cheersAt = this.clock;
    this.cheersReal = this.realTime;
    this.cheersText = m.cheers_pop();
    this.sfx("cheers");
    let sumX = 0;
    for (const emp of diners) {
      emp.cheerUntil = this.clock + CHEERS_S;
      sumX += emp.x;
    }
    if (!this.reducedMotion)
      this.burst(
        sumX / diners.length,
        FEAST_TABLE.y - CHEERS_SPARKS.lift,
        CHEERS_SPARKS.n,
        WARM_COLS,
        CHEERS_SPARKS.speed,
        CHEERS_SPARKS.gravity,
        CHEERS_SPARKS.life,
        1,
        true,
      );
    this.dirty = true;
  }
  /** a "done" receipt closed: two different sessions inside FEAST_WINDOW_S start a feast */
  private noteDone(sid: string) {
    this.doneStamps.push({ sid, at: this.clock });
    this.doneStamps = this.doneStamps.filter((stamp) => this.clock - stamp.at <= FEAST_WINDOW_S);
    const recentSessions = new Set(this.doneStamps.map((stamp) => stamp.sid)).size;
    if (recentSessions >= FEAST_MIN_DONE && this.clock - this.feastAt > FEAST_COOLDOWN_S) this.startFeast();
  }
  private startFeast() {
    this.feastAt = this.clock;
    this.feastUntil = this.clock + FEAST_S;
    this.nextServeAt = this.clock;
    this.doneStamps = [];
    this.addBanner("quest", m.banner_feast());
    for (const emp of this.feastDiners()) this.dishes[emp.restSpot] = { kind: this.dishKind(), at: this.clock };
    this.dirty = true;
  }

  private dishKind(): number {
    return Math.floor(Math.random() * DISH_KINDS);
  }
  private updateWing(dt: number) {
    const diners = this.feastDiners();
    for (let i = 0; i < this.dishes.length; i++) {
      const dish = this.dishes[i];
      if (dish && (this.clock - dish.at > DISH_LIFE_S || !this.dinerSlots[i])) this.dishes[i] = null;
    }
    this.updateChef(dt, diners);
    this.updateGuildMaster(dt);
    this.updateHall(dt);
    this.bardOn = this.bardShouldPlay(diners);
    if (this.reducedMotion) return;
    if (this.bardOn && this.clock >= this.nextNoteAt) {
      this.nextNoteAt = this.clock + NOTE_EVERY_S * rand(NOTE_JITTER_MIN, NOTE_JITTER_MAX);
      this.emitP(
        BARD_POS.x + rand(-NOTE_DX, NOTE_DX),
        BARD_POS.y - NOTE_LIFT,
        rand(-NOTE_VX, NOTE_VX),
        -rand(NOTE_VY_MIN, NOTE_VY_MAX),
        0,
        NOTE_LIFE,
        "#f2c14e",
        1,
        Math.random() < COIN_FLIP ? "note0" : "note1",
        true,
      );
    }
    if (this.feasting()) {
      this.confettiAcc += dt * CONFETTI_PER_S;
      while (this.confettiAcc >= 1) {
        this.confettiAcc -= 1;
        this.emitP(
          rand(CONFETTI_X0, CONFETTI_X1),
          CONFETTI_Y,
          rand(-NOTE_VX, NOTE_VX),
          rand(CONFETTI_VY, CONFETTI_VY * 2),
          0,
          CONFETTI_LIFE,
          CONFETTI_COLS[Math.floor(Math.random() * CONFETTI_COLS.length)],
          2,
          null,
          true,
        );
      }
    }
  }

  private updateHall(dt: number) {
    const walkers = this.hallWalkers;
    walkers.length = 0;
    for (const emp of this.employees.values()) if (!emp.inDungeon && !this.isHidden(emp)) walkers.push(emp);
    if (this.realTime - this.hallHourAt >= 1 || this.realTime < this.hallHourAt) {
      const now = new Date(); // the wall clock changes slowly: read it once a second, not every frame
      this.hallHour = now.getHours() + now.getMinutes() / MINUTES_PER_HOUR;
      this.hallHourAt = this.realTime;
    }
    this.hall.update({
      dt,
      hour: this.hallHour,
      reduced: this.reducedMotion,
      bossOut: this.bossAlive > 0,
      busy: this.employees.size > 0,
      walkers,
    });
  }
  private updateChef(dt: number, diners: Employee[]) {
    const chef = this.chef;
    if (this.reducedMotion) {
      // no walking: the plate just appears
      chef.path = [];
      chef.plate = -1;
      chef.x = CHEF_HOME.x;
      chef.y = CHEF_HOME.y;
      if (diners.length && this.clock >= this.nextServeAt) {
        this.dishes[this.pickDiner(diners).restSpot] = { kind: this.dishKind(), at: this.clock };
        this.nextServeAt = this.clock + this.serveEvery();
      }
      return;
    }
    if (chef.path.length) {
      this.walkChef(dt);
      return;
    }
    if (this.clock < this.nextServeAt) return;
    if (!diners.length) {
      this.nextServeAt = this.clock + SERVE_RETRY_S;
      return;
    }
    chef.target = this.pickDiner(diners).restSpot;
    chef.path = routeChefServe();
    chef.holdUntil = 0;
    this.nextServeAt = this.clock + this.serveEvery();
  }
  /** who gets the next plate: someone without one, else anyone */
  private pickDiner(diners: Employee[]): Employee {
    let hungry = 0;
    for (const emp of diners) if (!this.dishes[emp.restSpot]) hungry++;
    let pick = Math.floor(Math.random() * (hungry || diners.length));
    for (const emp of diners) {
      if (hungry && this.dishes[emp.restSpot]) continue;
      if (pick-- === 0) return emp;
    }
    return diners[0];
  }
  private walkChef(dt: number) {
    const chef = this.chef;
    if (chef.holdUntil > this.clock) return;
    let rem = SPEED * dt;
    while (rem > 0 && chef.path.length) {
      const target = chef.path[0];
      const dx = target.x - chef.x,
        dy = target.y - chef.y;
      const dist = Math.hypot(dx, dy);
      if (dx !== 0) chef.face = dx > 0 ? 1 : -1;
      if (dist <= rem) {
        chef.x = target.x;
        chef.y = target.y;
        rem -= dist;
        chef.path.shift();
        this.chefArrived(target);
        if (target.wait && chef.path.length) {
          chef.holdUntil = this.clock + target.wait;
          break;
        }
      } else {
        chef.x += (dx / dist) * rem;
        chef.y += (dy / dist) * rem;
        rem = 0;
      }
    }
  }
  /** the chef reached a waypoint: take a plate at the serving counter, set it down at the table */
  private chefArrived(point: Pt) {
    const chef = this.chef;
    if (point.x === CHEF_PICKUP.x && point.y === CHEF_PICKUP.y) chef.plate = this.dishKind();
    else if (point.x === CHEF_SERVE.x && point.y === CHEF_SERVE.y) {
      if (chef.plate >= 0 && this.dinerSlots[chef.target])
        this.dishes[chef.target] = { kind: chef.plate, at: this.clock };
      chef.plate = -1;
    } else if (!chef.path.length) chef.face = CHEF_FACE_HOME;
  }
  // ---------- the guild master ----------
  private resetGuildMaster() {
    const master = this.guildMaster;
    master.x = GUILD_MASTER_HOME.x;
    master.y = GUILD_MASTER_HOME.y;
    master.face = GM_FACE_HOME;
    master.path = [];
    master.phase = "home";
    master.mission = "none";
    master.reason = null;
    master.icon = null;
    master.text = "";
    master.targetId = "";
    master.targetDesk = -1;
    master.alert = false;
    master.until = this.clock + rand(GM_IDLE_MIN_S, GM_IDLE_MAX_S);
    this.gmDispatch = null;
    this.gmBellRinging = false;
    this.gmUrgentAt = 0;
    this.gmCool.clear();
    this.gmPraise = [];
    this.gmRowsAt = -Infinity;
  }
  /** the triage report: who needs him and why, most urgent first (then oldest first). Rebuilt at most every 0.5 s. */
  guildMasterReport(): GmReportRow[] {
    this.gmScan();
    return this.gmRows;
  }
  /** the session he is heading to / talking to for a reason (null = none) */
  gmTarget(): string | null {
    this.gmScan();
    const master = this.guildMaster;
    if (this.reducedMotion) {
      const top = this.gmRows[0];
      return top && GM_RANK[top.reason] <= GM_LAST_URGENT ? top.id : null;
    }
    const going = master.phase === "out" || master.phase === "talk";
    const mission = master.mission;
    return going && master.reason && master.targetId && (mission === "visit" || mission === "gate")
      ? master.targetId
      : null;
  }
  private gmScan() {
    if (this.clock >= this.gmRowsAt && this.clock - this.gmRowsAt < GM_SCAN_S) return;
    this.gmRowsAt = this.clock;
    const rows: GmReportRow[] = [];
    const live = new Set<string>();
    const add = (emp: Employee, reason: GmReason, natural: number | null, detail: string) => {
      const key = `${emp.id}|${reason}`;
      if (live.has(key)) return;
      live.add(key);
      let since = natural ?? this.gmSeen.get(key);
      if (since === undefined) since = this.clock;
      this.gmSeen.set(key, since);
      rows.push({
        id: emp.id,
        tag: emp.tag,
        project: emp.project,
        reason,
        since,
        detail: detail.slice(0, GM_REPORT_DETAIL_MAX),
      });
    };
    // a queue row's `since` is wall-clock ms: turn it into office-clock seconds (never before the page opened)
    const wallNow = Date.now();
    const fromWall = (sinceMs: number) =>
      sinceMs > 0 ? this.clock - Math.min(this.clock, Math.max(0, (wallNow - sinceMs) / MS_PER_SECOND)) : null;
    const asked = new Set<string>();
    for (const row of this.attentionRows()) {
      const emp = this.employees.get(row.sid);
      if (!emp || emp.state === "LEAVING") continue;
      const began = fromWall(row.since);
      if (row.kind === "permission") add(emp, "permission", began, emp.lastTool);
      else if (row.kind === "asked") {
        asked.add(row.sid);
        add(emp, "question", began, row.tail ?? "");
      } else if (row.kind === "loop") add(emp, "loop", began, `${row.tool ?? ""} ${row.target ?? ""}`.trim());
      else if (row.kind === "limit") add(emp, "limit", began, row.detail ?? emp.rateLimit?.resetText ?? "");
    }
    for (const emp of this.employees.values()) {
      if (emp.state === "LEAVING") continue;
      // a raised hand began at realTime `handAt`; the office clock may run at another speed, so count back real seconds
      const handBegan = emp.act === "handup" ? this.clock - Math.min(this.clock, this.realTime - emp.handAt) : null;
      if (emp.rateLimit) add(emp, "limit", fromWall(emp.rateLimit.since), emp.rateLimit.resetText ?? "");
      if (this.isWaiting(emp) && !asked.has(emp.id)) add(emp, "permission", handBegan, emp.lastTool);
      if (emp.act !== "handup" && emp.pending.size > 0) {
        let oldest = Infinity;
        for (const t0 of emp.pending.values()) if (t0 < oldest) oldest = t0;
        if (this.clock - oldest > GM_STUCK_S) add(emp, "stuck", oldest, emp.lastTool);
      }
      if (
        emp.pending.size === 0 &&
        emp.act === "thinking" &&
        !emp.raidIn &&
        !emp.compactPending &&
        emp.state === "SEATED" &&
        !emp.rateLimit &&
        this.clock - emp.lastEventAt > GM_IDLE_REPORT_S
      )
        add(emp, "idle", emp.lastEventAt, "");
      if (emp.compactPending && emp.state.endsWith("TAVERN_REST")) add(emp, "compact", null, "");
    }
    for (const key of this.gmSeen.keys()) if (!live.has(key)) this.gmSeen.delete(key);
    for (const [key, at] of this.gmCool) if (this.clock - at >= GM_REVISIT_LOW_S) this.gmCool.delete(key);
    rows.sort((rowA, rowB) => GM_RANK[rowA.reason] - GM_RANK[rowB.reason] || rowA.since - rowB.since);
    this.gmRows = rows;
    let due = false;
    for (const row of rows)
      if ((row.reason === "permission" || row.reason === "question") && this.clock - row.since > GM_BELL_AFTER_S)
        due = true;
    this.gmBellDue = due;
  }
  private gmIconOf(reason: GmReason | null, mission: GmMission): GmIconId | "dots" {
    if (mission === "door") return "bell";
    if (mission === "announce") return "scroll";
    if (mission === "praise") return "thumb";
    if (mission === "dispatch" || mission === "escort") return "sword";
    return reason ?? "dots";
  }
  /** once a second: new local day, the quiet evening */
  private gmDayTick() {
    if (this.realTime - this.gmDayReadAt < 1 && this.realTime >= this.gmDayReadAt) return;
    this.gmDayReadAt = this.realTime;
    const now = new Date();
    const key = dayKey(now);
    const busy = this.employees.size > 0;
    if (key !== this.gmDay) {
      if (!busy) return;
      this.gmDay = key;
      this.gmActiveDay = true;
      this.gmEveningDay = "";
      this.gmAnnouncePending = true;
      this.gmAnnounceAt = this.clock;
      return;
    }
    if (busy) this.gmActiveDay = true;
    if (now.getHours() < GM_EVENING_HOUR || !this.gmActiveDay || this.gmEveningDay === key) return;
    for (const emp of this.employees.values())
      if (emp.pending.size > 0 || this.clock - emp.lastEventAt <= GM_QUIET_S) return;
    this.gmEveningDay = key;
    this.gmAnnouncePending = true;
    this.gmAnnounceAt = this.clock;
  }
  private gmPlanVisit(emp: Employee, mission: GmMission, reason: GmReason | null, text = ""): GmPlan {
    return { mission, emp, reason, text };
  }
  /** what he does next, or null to stay home */
  private gmPlan(): GmPlan | null {
    const master = this.guildMaster;
    if (this.gmBellDue) return { mission: "door", emp: null, reason: "permission" };
    for (const row of this.gmRows) {
      const urgent = GM_RANK[row.reason] <= GM_LAST_URGENT;
      if (this.clock < (urgent ? this.gmUrgentAt : master.until)) continue;
      const cooled = this.gmCool.get(`${row.id}|${row.reason}`);
      if (cooled !== undefined && this.clock - cooled < (urgent ? GM_REVISIT_S : GM_REVISIT_LOW_S)) continue;
      const emp = this.employees.get(row.id);
      if (!emp) continue;
      if (emp.raidIn || emp.inDungeon || emp.deskIdx < 0) {
        if (urgent) return this.gmPlanVisit(emp, "gate", row.reason);
        continue;
      }
      if (this.canVisit(emp)) return this.gmPlanVisit(emp, "visit", row.reason);
    }
    if (this.clock < master.until) return null;
    if (this.gmAnnouncePending) return { mission: "announce", emp: null, reason: null };
    for (let idx = 0; idx < this.gmPraise.length;) {
      const praise = this.gmPraise[idx];
      const emp = this.employees.get(praise.sid);
      if (!emp || this.clock - praise.at > GM_PRAISE_FRESH_S) {
        this.gmPraise.splice(idx, 1);
        continue;
      }
      if (this.canVisit(emp)) {
        this.gmPraise.splice(idx, 1);
        return this.gmPlanVisit(emp, "praise", null, praise.text ?? "");
      }
      idx++; // not visitable right now (away, busy, hidden): it waits, the others go first
    }
    const calm: Employee[] = [];
    for (const emp of this.employees.values()) if (this.canVisit(emp)) calm.push(emp);
    if (!calm.length) return null;
    return this.gmPlanVisit(calm[Math.floor(Math.random() * calm.length)], "visit", null);
  }
  private gmStart(plan: GmPlan) {
    const master = this.guildMaster;
    master.mission = plan.mission;
    master.reason = plan.reason;
    master.icon = null;
    master.text = "";
    this.gmSayText = plan.text ?? "";
    master.phase = "out";
    master.alert = plan.reason !== null && GM_RANK[plan.reason] <= GM_LAST_URGENT;
    master.targetId = plan.emp ? plan.emp.id : "";
    master.targetDesk = plan.mission === "visit" || plan.mission === "praise" ? plan.emp!.deskIdx : -1;
    if (plan.emp && plan.reason) this.gmCool.set(`${plan.emp.id}|${plan.reason}`, this.clock);
    if (plan.mission === "door") master.path = routeGuildMasterDoor();
    else if (plan.mission === "gate") master.path = routeGuildMasterGate();
    else if (plan.mission === "announce") {
      this.gmAnnouncePending = false;
      master.path = routeGuildMasterAnnounce();
    } else master.path = routeGuildMaster(plan.emp!.deskIdx);
  }
  /** the straight-line walk time of a route from (x, y) */
  private gmWalkS(x: number, y: number, path: Pt[]): number {
    let len = 0,
      px = x,
      py = y;
    for (const pt of path) {
      len += Math.hypot(pt.x - px, pt.y - py);
      px = pt.x;
      py = pt.y;
    }
    return len / SPEED;
  }
  /**
   * Dispatcher: a raid-ready adventurer is first visited by the guild master, who then escorts it to the gate.
   * true = hold the raid for now (he is on his way; it never waits longer than GM_DISPATCH_MAX_S).
   */
  private gmHoldRaid(emp: Employee): boolean {
    const master = this.guildMaster;
    const held = this.gmDispatch;
    if (held) {
      if (held.sid === emp.id && this.clock <= held.deadline) return true;
      if (held.sid === emp.id)
        this.guildMasterGoesHome(); // too slow: the raid goes without him
      else return false;
      return false;
    }
    if (this.reducedMotion || master.phase !== "home" || master.mission !== "none" || this.gmBellDue) return false;
    this.gmScan();
    for (const row of this.gmRows) if (GM_RANK[row.reason] <= GM_LAST_URGENT) return false;
    if (!this.canVisit(emp)) return false;
    const route = routeGuildMaster(emp.deskIdx);
    if (this.gmWalkS(master.x, master.y, route) + GM_DISPATCH_TALK_S > GM_DISPATCH_MAX_S) return false;
    this.gmDispatch = { sid: emp.id, deadline: this.clock + GM_DISPATCH_MAX_S };
    this.gmStart({ mission: "dispatch", emp, reason: null });
    master.targetDesk = emp.deskIdx;
    return true;
  }
  /** reduced motion: no walking; his bubble shows the top reason above his post and the bell stays still */
  private gmReduced() {
    const master = this.guildMaster;
    if (master.phase !== "home") this.resetGuildMaster();
    this.gmScan();
    const top = this.gmRows[0];
    master.reason = top ? top.reason : null;
    master.alert = !!top && GM_RANK[top.reason] <= GM_LAST_URGENT;
    master.mission = "none";
    master.text = "";
    if (this.gmBellDue) master.icon = "bell";
    else if (top) master.icon = top.reason;
    else if (this.gmAnnouncePending && this.clock - this.gmAnnounceAt < GM_ANNOUNCE_S) {
      master.icon = "scroll";
      master.text = GM_ANNOUNCE_TEXT;
    } else {
      master.icon = null;
      this.gmAnnouncePending = false;
    }
    this.gmRing(this.gmBellDue);
  }
  private gmRing(ringing: boolean) {
    if (!ringing) {
      this.gmBellRinging = false;
      return;
    }
    if (!this.gmBellRinging) {
      this.gmBellRinging = true;
      this.gmNextRing = this.clock + GM_BELL_EVERY_S;
      this.sfx("bell");
    } else if (this.clock >= this.gmNextRing) {
      this.gmNextRing += GM_BELL_EVERY_S;
      this.sfx("bell");
    }
  }
  /**
   * a battle-spot adventurer he can walk up to: seated, working, on screen, not in a duel or boss fight, no boss still
   * walking out (its lane and road cross his route) and no duel fighter / meeting point / boss near his stand point
   */
  private canVisit(emp: Employee): boolean {
    if (
      emp.state !== "SEATED" ||
      emp.deskIdx < 0 ||
      emp.raidIn ||
      emp.duel ||
      emp.boss ||
      emp.resting ||
      this.isHidden(emp)
    )
      return false;
    const stand = guildMasterStand(emp.deskIdx, this.gmStandPt);
    for (const other of this.employees.values()) {
      if (other === emp) continue;
      if (other.boss && other.bossPath.length) return false;
      if (other.monPos && !other.monDead && this.monsterHitsStand(stand, other.monPos, !!other.boss)) return false;
      if (other.duel && this.nearStand(stand, other.x, other.y)) return false;
    }
    for (const duel of this.duels) {
      const left = this.employees.get(duel.l),
        right = this.employees.get(duel.r);
      if (!left || !right || left.deskIdx < 0 || right.deskIdx < 0) continue;
      const mid = duelMidOfDesks(left.deskIdx, right.deskIdx, this.gmDuelPt);
      if (this.nearStand(stand, mid.x, mid.y)) return false;
    }
    return true;
  }
  /** does a monster / boss at `pos` (sprite + HP bar) touch the 16x24 box he occupies at `stand`? */
  private monsterHitsStand(stand: Pt, pos: Pt, boss: boolean): boolean {
    const half = boss ? BOSS_W / 2 : MON_W / 2;
    const top = pos.y - (boss ? BOSS_H + GM_BOSS_BAR_H : MON_H + GM_MON_BAR_H);
    const cx = boss ? bossCenterX(pos.x) : pos.x;
    return Math.abs(cx - stand.x) < half + CH_W / 2 && stand.y - CH_H < pos.y && top < stand.y;
  }
  private nearStand(stand: Pt, x: number, y: number): boolean {
    return Math.hypot(x - stand.x, y - stand.y) < GM_CLEAR_R;
  }
  private updateGuildMaster(dt: number) {
    const master = this.guildMaster;
    this.gmScan();
    this.gmDayTick();
    if (this.reducedMotion) {
      this.gmReduced();
      return;
    }
    if (master.phase === "home") {
      this.gmRing(false);
      const plan = this.gmPlan();
      if (!plan) {
        if (this.clock >= master.until) master.until = this.clock + GM_RETRY_S;
        return;
      }
      this.gmStart(plan);
      return;
    }
    const mission = master.mission;
    if (master.phase === "out" || master.phase === "talk") {
      if (mission === "door") {
        if (!this.gmBellDue) {
          this.guildMasterGoesHome();
          return;
        }
      } else if (mission !== "announce" && mission !== "escort") {
        const target = this.employees.get(master.targetId);
        const seated = mission === "visit" || mission === "praise" || mission === "dispatch";
        const gone = !target || (seated && (target.deskIdx !== master.targetDesk || !this.canVisit(target)));
        const solved =
          !!master.reason &&
          (mission === "visit" || mission === "gate") &&
          !this.gmRows.some((row) => row.id === master.targetId && row.reason === master.reason);
        if (gone || solved) {
          this.guildMasterGoesHome();
          return;
        }
      }
      // a door bell that became due outranks calm errands
      const calmErrand =
        mission === "announce" || mission === "praise" || (mission === "visit" && (!master.reason || !master.alert));
      if (this.gmBellDue && calmErrand) {
        this.guildMasterGoesHome();
        return;
      }
      if (master.phase === "talk") {
        if (mission === "door") this.gmRing(true);
        else if (this.clock >= master.until) this.gmTalkDone();
        return;
      }
    }
    this.walkGuildMaster(dt);
    if (master.path.length) return;
    if (master.phase === "out") {
      master.phase = "talk";
      master.face = mission === "door" || mission === "gate" ? -1 : 1;
      master.icon = this.gmIconOf(master.reason, mission);
      if (mission === "announce") master.text = GM_ANNOUNCE_TEXT;
      else if (mission === "praise") master.text = this.gmSayText;
      master.until =
        this.clock + (mission === "announce" ? GM_ANNOUNCE_S : mission === "dispatch" ? GM_DISPATCH_TALK_S : GM_TALK_S);
      if (mission === "door") this.gmRing(true);
    } else if (master.phase === "escort") {
      master.phase = "talk";
      master.face = -1;
      master.icon = "sword";
      master.until = this.clock + GM_ESCORT_POINT_S;
    } else {
      master.phase = "home";
      master.mission = "none";
      master.reason = null;
      master.icon = null;
      master.text = "";
      master.alert = false;
      master.face = GM_FACE_HOME;
      master.targetId = "";
      master.targetDesk = -1;
      master.until = this.clock + rand(GM_CALM_MIN_S, GM_CALM_MAX_S);
      this.gmUrgentAt = this.clock + GM_URGENT_GAP_S;
    }
  }
  /** his talk is over: a dispatch sends the raider off and he escorts it; anything else walks him home */
  private gmTalkDone() {
    const master = this.guildMaster;
    if (master.mission === "dispatch") {
      const target = this.employees.get(master.targetId);
      this.gmDispatch = null;
      // re-check: a hand may have gone up or a tool started during his talk
      if (target && this.compactReady(target) && target.deskIdx >= 0) {
        const desk = target.deskIdx;
        this.beginRaid(target);
        master.phase = "escort";
        master.mission = "escort";
        master.icon = null;
        master.targetId = "";
        master.targetDesk = -1;
        master.path = routeGuildMasterEscort(desk);
        return;
      }
    }
    this.guildMasterGoesHome();
  }
  private guildMasterGoesHome() {
    const master = this.guildMaster;
    master.phase = "back";
    master.icon = null;
    master.text = "";
    master.targetId = "";
    master.targetDesk = -1;
    master.alert = false;
    this.gmDispatch = null;
    this.gmRing(false);
    master.path = routeGuildMasterHome(master.x, master.y);
  }
  private walkGuildMaster(dt: number) {
    const master = this.guildMaster;
    let rem = SPEED * dt;
    while (rem > 0 && master.path.length) {
      const target = master.path[0];
      const dx = target.x - master.x,
        dy = target.y - master.y;
      const dist = Math.hypot(dx, dy);
      if (dx !== 0) master.face = dx > 0 ? 1 : -1;
      if (dist <= rem) {
        master.x = target.x;
        master.y = target.y;
        rem -= dist;
        master.path.shift();
      } else {
        master.x += (dx / dist) * rem;
        master.y += (dy / dist) * rem;
        rem = 0;
      }
    }
  }
  // ---------- interns (squires) ----------
  /** where squire number `slot` of this adventurer stands */
  private squireSpot(emp: Employee, slot: number): Pt {
    return squirePoint(Math.max(0, emp.deskIdx), slot);
  }

  /** squires that were standing out walk back into the ally gate (they never pile up: capped, the rest just vanish) */
  private sendSquiresHome(emp: Employee) {
    if (this.reducedMotion || this.isHidden(emp) || emp.deskIdx < 0) return; // raiders have no squires out
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
      if (emp.state === "LEAVING" || emp.deskIdx < 0) continue; // raiders keep their squires inside the ally gate
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
