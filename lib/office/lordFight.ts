/**
 * The Dungeon Lord boss fight: all the state and timing rules that sit on top of the hp pool (the damage model lives in
 * engine.ts and is untouched). Everything here is cosmetic: telegraphed special attacks, minions, meteors, the enrage,
 * the intro and the death sequence. Pure data and pure functions (no DOM, no engine import), so tests drive it directly.
 * Pools are preallocated: nothing in the per-frame paths creates arrays or objects.
 */

// ---- hp scaling --------------------------------------------------------------------------------------------------
/** damage points a LONE raider needs to bring the Lord down (a raider's hit is 1, a heavy tool 2, a crit doubles) */
export const LORD_HP_BASE = 60;
/** extra damage points for every further raider who has stood on floor 3 this fight */
export const LORD_HP_PER_EXTRA = 30;
/** hp pool for `raiders` raiders on floor 3 this fight */
/**
 * Higher-level raiders hit much harder (tier crit, flat damage, class skills: roughly 2.5x the damage per hit at the
 * legend tier), so the pool grows by this fraction per average gear tier of the raiders. A lone novice is unchanged.
 */
export const LORD_HP_PER_TIER = 0.4;
/** the average tier is compared in steps of 1/this, so a tiny drift never regrows the pool */
export const TIER_STEPS = 4;
export const lordMaxHp = (raiders: number, avgTier = 0): number =>
  Math.round(
    (LORD_HP_BASE + LORD_HP_PER_EXTRA * (Math.max(1, Math.floor(raiders)) - 1)) * (1 + LORD_HP_PER_TIER * avgTier),
  );

// ---- enrage ------------------------------------------------------------------------------------------------------
/** below this fraction of hp the Lord is enraged */
export const ENRAGE_BELOW = 0.5;
/** seconds the lava falls take to surge up after the enrage */
export const ENRAGE_SURGE_S = 0.8;

// ---- intro -------------------------------------------------------------------------------------------------------
/** seconds of the intro: braziers dim, eyes flare, the taunt bubble shows */
export const INTRO_S = 2.4;
const INTRO_DIM_IN_S = 0.3;
const INTRO_DIM_HOLD_S = 1.4;
/** the eyes flare for this long from the start of the intro */
export const INTRO_EYES_S = 1.8;
/** the taunt bubble pops up this long after the intro starts */
export const TAUNT_AT_S = 0.35;
/** the Lord's taunts (drawn in the pixel font: capital letters, digits, ! and ?) */
export const TAUNTS = ["YOU DARE?", "KNEEL!", "MORTALS!", "NO ESCAPE!"] as const;
/** how bright the braziers are during the intro: 1 = normal, 0 = nearly out */
export const introLight = (age: number): number => {
  if (age < 0 || age >= INTRO_S) return 1;
  const dim =
    age < INTRO_DIM_IN_S
      ? age / INTRO_DIM_IN_S
      : age < INTRO_DIM_HOLD_S
        ? 1
        : Math.max(0, 1 - (age - INTRO_DIM_HOLD_S) / (INTRO_S - INTRO_DIM_HOLD_S));
  return 1 - dim;
};

// ---- special attacks ---------------------------------------------------------------------------------------------
export const ATTACKS = ["slam", "breath", "summon", "meteor"] as const;
export type LordAttackKind = (typeof ATTACKS)[number];
export const ATTACK_SLAM = 0;
export const ATTACK_BREATH = 1;
export const ATTACK_SUMMON = 2;
export const ATTACK_METEOR = 3;
/** the red warning on the floor lasts this long before an attack lands */
export const TELEGRAPH_S = 0.9;
/** seconds each attack stays up after it lands (the slam's shockwave takes the longest) */
const SLAM_ACTIVE_S = 1.7;
const BREATH_ACTIVE_S = 0.9;
const SUMMON_ACTIVE_S = 0.9;
const METEOR_ACTIVE_S = 1.5;
export const ATTACK_ACTIVE_S = [SLAM_ACTIVE_S, BREATH_ACTIVE_S, SUMMON_ACTIVE_S, METEOR_ACTIVE_S] as const;
/** the first attack comes this long after the Lord engages (he first has to rise and step down) */
export const FIRST_ATTACK_S = 4;
/** seconds between attacks, calm and enraged (each gets +-15% jitter) */
export const ATTACK_GAP_S = 7;
export const ENRAGED_GAP_S = 4.2;
const GAP_JITTER = 0.15;
/** the shockwave ring sweeps left at this speed (world px per second) and is this much flatter than wide */
export const WAVE_SPEED = 150;
export const WAVE_SQUASH = 0.42;
/** the fire breath: how long the flame stream is, its hurt radius around the stream */
export const BREATH_NEAR_PX = 16;
/** meteors per rain (calm, enraged), the gap between them, how long each one falls, their blast radius */
export const METEORS_CALM = 4;
export const METEORS_ENRAGED = 6;
export const METEOR_GAP_S = 0.18;
export const METEOR_FALL_S = 0.35;
export const METEOR_BLAST_PX = 34;
/** minions per summon, their rise time and life span before they crumble */
export const MINIONS_PER_SUMMON = 3;
export const MINION_RISE_S = 0.6;
export const MINION_LIFE_S = 14;
/** raiders hop this long (and this high) when an attack lands near them */
export const DODGE_S = 0.38;
export const DODGE_HOP_PX = 7;

export const MINION_MAX = 6;
export const METEOR_MAX = 6;
export const SLASH_MAX = 4;
const SLASH_SHAPES = 3;

/** where the Lord's mouth is when he stands at his feet point (his head faces left) */
export const MOUTH_DX = -14;
export const MOUTH_DY = -38;
/** the origin of the shockwave: his boots, a little ahead of him */
export const WAVE_DX = -22;
/** where the three minions rise, relative to the Lord's feet point */
export const MINION_SPOTS: readonly { dx: number; dy: number }[] = [
  { dx: -28, dy: 38 },
  { dx: -28, dy: -38 },
  { dx: -40, dy: 1 },
];
/** the floor the meteor rain can land on (candidates; the ones near a raider's feet are skipped) */
export const METEOR_X0 = 110;
export const METEOR_X1 = 250;
export const METEOR_Y0 = 78;
export const METEOR_Y1 = 176;
const METEOR_COLS = 6;
const METEOR_ROWS = 5;
const METEOR_AVOID_PX = 18;
const METEOR_SEED_STRIDE = 31;
/** two markers closer than this (both axes) count as one spot */
const METEOR_DUP_PX = 8;

/** a deterministic 0..1 value from a counter */
const HASH_A = 0x9e3779b1;
const HASH_B = 0x85ebca6b;
const HASH_C = 0x2c1b3c6d;
const HASH_D = 0x297a2d39;
const HASH_SHIFT_1 = 15;
const HASH_SHIFT_2 = 12;
const HASH_RANGE = 4294967296;
export const hash01 = (seed: number): number => {
  let value = (Math.imul(seed | 0, HASH_A) ^ HASH_B) >>> 0;
  value = Math.imul(value ^ (value >>> HASH_SHIFT_1), HASH_C) >>> 0;
  value = Math.imul(value ^ (value >>> HASH_SHIFT_2), HASH_D) >>> 0;
  return ((value ^ (value >>> HASH_SHIFT_1)) >>> 0) / HASH_RANGE;
};

/** the next attack kind from a random 0..1: never the same twice in a row */
export const pickAttack = (prev: number, rnd: number): number => {
  const choices = ATTACKS.length - (prev >= 0 ? 1 : 0);
  let index = Math.min(choices - 1, Math.floor(rnd * choices));
  if (prev >= 0 && index >= prev) index++;
  return index;
};

/** seconds until the next attack after one ended */
export const nextAttackGap = (enraged: boolean, rnd: number): number =>
  (enraged ? ENRAGED_GAP_S : ATTACK_GAP_S) * (1 - GAP_JITTER + 2 * GAP_JITTER * rnd);

// ---- state -------------------------------------------------------------------------------------------------------
export interface LordMinion {
  on: boolean;
  x: number;
  y: number;
  bornAt: number;
  /** clock time it was cleared (-99 = alive) */
  clearedAt: number;
}
export interface LordMeteor {
  on: boolean;
  x: number;
  y: number;
  /** clock time it lands */
  at: number;
  landed: boolean;
}
export interface LordSlash {
  at: number;
  /** which of three diagonal slash shapes */
  shape: number;
  crit: boolean;
}
export interface LordAttack {
  /** index into ATTACKS; -1 = none */
  kind: number;
  /** clock times: telegraph starts, the attack lands, it is over */
  startAt: number;
  hitAt: number;
  endAt: number;
  /** breath aim (a raider's feet) and who it is at */
  tx: number;
  ty: number;
  targetId: string;
  landed: boolean;
  /** attacks fired since the fight began (also seeds the meteor spread) */
  count: number;
  /** the kind of the last attack (-1 = none): the next one differs */
  prev: number;
}

/** the Dungeon Lord at the bottom of floor 3: one hp pool shared by every raider standing there */
export interface DungeonLord {
  /** 0..1 */
  hp: number;
  hitAt: number;
  deadAt: number;
  /** times it has been slain since the page opened */
  slain: number;
  /** clock time the first raider started fighting it (it rises from the throne); -1 = nobody is fighting, it sits */
  engagedAt: number;
  /** clock time the fight last ended (it sits back down); -99 = never */
  calmAt: number;
  /** the hp the bar shows: eases toward `hp` so a hit drains it smoothly */
  shown: number;
  /** clock time of its last strike back at a raider (cosmetic) and who it hit; -99 / "" = none */
  strikeAt: number;
  strikeId: string;
  /** clock time of its next strike back */
  nextStrikeAt: number;
  /** damage points that bring it down right now: grows with the raiders who have stood on floor 3 this fight */
  maxHp: number;
  /** most raiders on floor 3 at once this fight */
  peak: number;
  /** highest average raider gear tier (in 1/TIER_STEPS) seen this fight */
  peakTier: number;
  /** clock time its intro started (-99 = none yet this fight) and which taunt it shouts */
  introAt: number;
  taunt: number;
  /** intros played since the page opened (picks the taunt) */
  intros: number;
  /** clock time it went below ENRAGE_BELOW hp (-1 = calm) */
  enragedAt: number;
  /** clock time of the next special attack (-1 = not engaged) */
  nextAttackAt: number;
  atk: LordAttack;
  minions: LordMinion[];
  meteors: LordMeteor[];
  slashes: LordSlash[];
  slashN: number;
  /** hit-stop: the Lord's animation clock is frozen from `hsAt` until `hsUntil` */
  hsUntil: number;
  hsAt: number;
  /** clock time of the last critical hit (white outline flash) */
  critAt: number;
  /** 0..1 screen shake of the Lord's floor; decays on its own */
  shake: number;
  /** clock time the death sequence ended (the burst, the loot and the banner fired); -1 = not yet */
  finaleAt: number;
}

export const freshLord = (): DungeonLord => ({
  hp: 1,
  hitAt: -99,
  deadAt: -99,
  slain: 0,
  engagedAt: -1,
  calmAt: -99,
  shown: 1,
  strikeAt: -99,
  strikeId: "",
  nextStrikeAt: 0,
  maxHp: LORD_HP_BASE,
  peak: 0,
  peakTier: 0,
  introAt: -99,
  taunt: 0,
  intros: 0,
  enragedAt: -1,
  nextAttackAt: -1,
  atk: {
    kind: -1,
    startAt: -99,
    hitAt: -99,
    endAt: -99,
    tx: 0,
    ty: 0,
    targetId: "",
    landed: false,
    count: 0,
    prev: -1,
  },
  minions: Array.from({ length: MINION_MAX }, () => ({ on: false, x: 0, y: 0, bornAt: 0, clearedAt: -99 })),
  meteors: Array.from({ length: METEOR_MAX }, () => ({ on: false, x: 0, y: 0, at: 0, landed: false })),
  slashes: Array.from({ length: SLASH_MAX }, () => ({ at: -99, shape: 0, crit: false })),
  slashN: 0,
  hsUntil: 0,
  hsAt: 0,
  critAt: -99,
  shake: 0,
  finaleAt: -1,
});

/** forget the whole fight (a fresh Lord rose, or the page was cleared); `slain` and `intros` survive a respawn */
export const resetFight = (lord: DungeonLord) => {
  lord.maxHp = LORD_HP_BASE;
  lord.peak = 0;
  lord.peakTier = 0;
  lord.introAt = -99;
  lord.enragedAt = -1;
  lord.finaleAt = -1;
  lord.hsUntil = 0;
  lord.critAt = -99;
  lord.shake = 0;
  stopAttacks(lord);
};

/** everything transient the Lord was doing stops (nobody is fighting him any more, or he fell) */
export const stopAttacks = (lord: DungeonLord) => {
  const atk = lord.atk;
  atk.kind = -1;
  atk.landed = false;
  atk.targetId = "";
  lord.nextAttackAt = -1;
  for (const minion of lord.minions) minion.on = false;
  for (const meteor of lord.meteors) meteor.on = false;
};

/** the hp pool grows when more raiders stand on floor 3: the damage already dealt stays, so the bar rises a little. `avgTier` counts only for the first raiders of a fight */
/** a hit pool that grew never leaves the Lord at exactly 0 hp */
const MIN_HP_LEFT = 1e-6;
export const growPool = (lord: DungeonLord, raiders: number, avgTier = 0): boolean => {
  if (raiders <= lord.peak) return false;
  // the tier factor is locked when the fight starts: raiders levelling up mid-fight never grow the pool (that would
  // heal him); later arrivals only grow it by raider count
  if (lord.peak === 0) lord.peakTier = Math.round(avgTier * TIER_STEPS);
  lord.peak = raiders;
  const next = lordMaxHp(lord.peak, lord.peakTier / TIER_STEPS);
  if (next !== lord.maxHp) {
    const dealt = (1 - lord.hp) * lord.maxHp;
    lord.hp = lord.hp > 0 ? Math.max(MIN_HP_LEFT, 1 - dealt / next) : 0;
    lord.maxHp = next;
  }
  return true;
};

/** the phase of the current special attack at `clock` */
export type AttackPhase = "none" | "telegraph" | "active";
export const attackPhase = (atk: LordAttack, clock: number): AttackPhase => {
  if (atk.kind < 0) return "none";
  return clock < atk.hitAt ? "telegraph" : "active";
};

/** start a special attack (the engine picks the target and gives it a random number) */
export const beginAttack = (
  lord: DungeonLord,
  clock: number,
  kind: number,
  tx: number,
  ty: number,
  targetId: string,
) => {
  const atk = lord.atk;
  atk.kind = kind;
  atk.startAt = clock;
  atk.hitAt = clock + TELEGRAPH_S;
  atk.endAt = atk.hitAt + ATTACK_ACTIVE_S[kind];
  atk.tx = tx;
  atk.ty = ty;
  atk.targetId = targetId;
  atk.landed = false;
  atk.prev = kind;
  atk.count++;
};

/** plan the meteor rain: markers at floor points away from the raiders' feet; `avoid` says whether a point is taken */
export const planMeteors = (
  lord: DungeonLord,
  hitAt: number,
  count: number,
  avoid: (x: number, y: number, radius: number) => boolean,
) => {
  for (const meteor of lord.meteors) meteor.on = false;
  const cells = METEOR_COLS * METEOR_ROWS;
  let placed = 0;
  for (let tries = 0; tries < cells * 2 && placed < Math.min(count, METEOR_MAX); tries++) {
    const cell = Math.floor(hash01(lord.atk.count * METEOR_SEED_STRIDE + tries) * cells);
    const x = METEOR_X0 + ((cell % METEOR_COLS) / (METEOR_COLS - 1)) * (METEOR_X1 - METEOR_X0);
    const y = METEOR_Y0 + (Math.floor(cell / METEOR_COLS) / (METEOR_ROWS - 1)) * (METEOR_Y1 - METEOR_Y0);
    if (avoid(x, y, METEOR_AVOID_PX)) continue;
    let dup = false;
    for (let i = 0; i < placed; i++)
      if (Math.abs(lord.meteors[i].x - x) < METEOR_DUP_PX && Math.abs(lord.meteors[i].y - y) < METEOR_DUP_PX)
        dup = true;
    if (dup) continue;
    const meteor = lord.meteors[placed++];
    meteor.on = true;
    meteor.x = Math.round(x);
    meteor.y = Math.round(y);
    meteor.at = hitAt + placed * METEOR_GAP_S;
    meteor.landed = false;
  }
};

/** raise `count` skeletons at the minion spots around the Lord's feet (a free slot each; none when the pool is full) */
export const raiseMinions = (lord: DungeonLord, clock: number, feetX: number, feetY: number): number => {
  let raised = 0;
  for (let k = 0; k < MINIONS_PER_SUMMON; k++) {
    const slot = lord.minions.find((minion) => !minion.on);
    if (!slot) break;
    const spot = MINION_SPOTS[k % MINION_SPOTS.length];
    slot.on = true;
    slot.x = feetX + spot.dx;
    slot.y = feetY + spot.dy;
    slot.bornAt = clock;
    slot.clearedAt = -99;
    raised++;
  }
  return raised;
};

export const liveMinions = (lord: DungeonLord): number => {
  let standing = 0;
  for (const minion of lord.minions) if (minion.on && minion.clearedAt < 0) standing++;
  return standing;
};

/** a raider's hit clears the oldest standing minion; returns it (for the poof) or null when none stands */
export const clearMinion = (lord: DungeonLord, clock: number): LordMinion | null => {
  let best: LordMinion | null = null;
  for (const minion of lord.minions)
    if (minion.on && minion.clearedAt < 0 && (!best || minion.bornAt < best.bornAt)) best = minion;
  if (best) best.clearedAt = clock;
  return best;
};

/** seconds a cleared minion's poof stays drawn */
export const MINION_POOF_S = 0.35;

/** record a slash streak for the renderer */
export const addSlash = (lord: DungeonLord, clock: number, crit: boolean) => {
  const slash = lord.slashes[lord.slashN % SLASH_MAX];
  slash.at = clock;
  slash.shape = lord.slashN % SLASH_SHAPES;
  slash.crit = crit;
  lord.slashN++;
};

// ---- hit feel ----------------------------------------------------------------------------------------------------
/** the Lord's animation freezes this long on every hit */
export const LORD_HITSTOP_S = 0.06;
/** the white outline of a critical hit */
export const CRIT_FLASH_S = 0.22;
/** a slash streak lasts this long */
export const SLASH_S = 0.16;
/** the Lord's own animation clock: frozen during a hit-stop */
export const lordClock = (lord: DungeonLord, time: number): number => (lord.hsUntil > time ? lord.hsAt : time);

// ---- death sequence ----------------------------------------------------------------------------------------------
/** from the last hit to the burst */
export const LORD_DEATH_S = 2.5;
/** reduced motion: a short beat instead */
export const LORD_DEATH_REDUCED_S = 0.5;
/** the Lord kneels over this long, the cracks of light spread over this window, the white flash is the last of it */
export const DEATH_KNEEL_S = 0.5;
export const DEATH_CRACK_FROM_S = 0.25;
export const DEATH_CRACK_TO_S = 2.1;
export const DEATH_FLASH_FROM_S = 1.7;
/** how deep he sinks when kneeling (px) */
export const DEATH_KNEEL_PX = 12;
/** seconds the throne takes to go dark after the burst */
export const THRONE_DARK_S = 0.8;

/** how long the death sequence runs */
export const deathLength = (reduced: boolean): number => (reduced ? LORD_DEATH_REDUCED_S : LORD_DEATH_S);

/** 0..1 progress of the cracks of light at `age` seconds after the last hit */
export const crackProgress = (age: number, reduced: boolean): number => {
  if (reduced) return age >= 0 ? 1 : 0;
  return Math.min(1, Math.max(0, (age - DEATH_CRACK_FROM_S) / (DEATH_CRACK_TO_S - DEATH_CRACK_FROM_S)));
};

/** 0..1 kneel depth at `age` */
export const kneelProgress = (age: number, reduced: boolean): number =>
  reduced ? 1 : Math.min(1, Math.max(0, age / DEATH_KNEEL_S));

/** is the throne dark at `clock`: from the burst until the Lord rises again (0 = lit, 1 = dark) */
export const throneDarkness = (lord: DungeonLord, clock: number): number => {
  if (lord.hp > 0 || lord.finaleAt < 0) return 0;
  return Math.min(1, Math.max(0, (clock - lord.finaleAt) / THRONE_DARK_S));
};

/** the lava falls surge after the enrage (1 = calm, up to 0..1 extra) */
export const lavaSurge = (lord: DungeonLord, clock: number): number => {
  if (lord.enragedAt < 0 || lord.hp <= 0) return 0;
  return Math.min(1, (clock - lord.enragedAt) / ENRAGE_SURGE_S);
};

/** how high a raider hops (px) when an attack reaches them at `dodgeAt`; never under reduced motion */
export const dodgeLift = (clock: number, dodgeAt: number, reduced: boolean): number => {
  if (reduced) return 0;
  const age = clock - dodgeAt;
  if (age < 0 || age >= DODGE_S) return 0;
  return Math.round(Math.sin((Math.PI * age) / DODGE_S) * DODGE_HOP_PX);
};
