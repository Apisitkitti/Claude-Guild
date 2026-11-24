// Shared contract for the secret boss after the Dungeon Lord falls: the engine (voidFight.ts + engine.ts) writes this
// state, the renderer (voidScene.ts / voidBossSprite.ts / voidFx.ts + render.ts) only reads it.

/** hidden fourth floor: never reached by normal descent (DUNGEON_FLOORS stays 3), only through the Lord's death */
export const VOID_FLOOR = 4;

/**
 * none       — nothing secret is happening
 * shatter    — the Lord's corpse cracks, glows and explodes into pixel shards (still on B3)
 * transition — opaque pixel-block wipe from B3 to the Void Sanctum; raiders on B3 are moved to VOID_FLOOR mid-wipe
 * reveal     — the arena is shown; the Veiled One descends, taunts, the HP bar appears
 * fight      — phase 1
 * phase2     — below 60% hp: the veil tears, faster and harder attacks
 * phase3     — below 25% hp: TRUE FORM — the boss transforms into a towering shape that fills the arena; desperate,
 *              arena-wide attacks; the floor itself starts breaking
 * dying      — death animation, no damage taken
 * victory    — banner + rewards, then raiders walk home and the state returns to none
 * retreat    — every raider left before the kill: the boss fades out of the arena, state returns to none
 */
export type VoidPhase =
  "none" | "shatter" | "transition" | "reveal" | "fight" | "phase2" | "phase3" | "dying" | "victory" | "retreat";

/** beam: sweeping void beam across the floor · eyes: floating eyes spawn and fire · blink: teleports behind a raider
 *  and strikes · collapse: the floor tiles fall away in a pattern (phase2 only) */
export type VoidAttackKind = "beam" | "eyes" | "blink" | "collapse" | "eclipse" | "summon";
// summon (phase 1+): 2-3 void minions rise next to the boss and drift to the raiders; while any lives the boss is
// `shielded` (raider hits kill a minion instead of hurting it).
// eclipse (phase3 only): the boss raises both arms, the arena darkens to its palette (opaque, never over characters),
// a giant void sun forms above and crashes down on every raider at once; raiders that dodge survive with 1 heart.

export interface VoidAttack {
  kind: VoidAttackKind;
  /** clock time the telegraph started; the hit lands at at + telegraph seconds */
  at: number;
  /** world x the attack aims at (raider position), for drawing the telegraph */
  targetX: number;
  // ---- additive fields (engine-written, free for the renderer to read) ----
  /** world y of the aimed raider's feet (the beam sweeps along this row, the blink lands here) */
  targetY: number;
  /** clock time the hit lands (at + telegraph) and the time the attack is over */
  hitAt: number;
  endAt: number;
  /** false during the telegraph, true once the attack has landed */
  landed: boolean;
  /** counter-based seed: feeds the deterministic patterns (voidEyeSpots, voidCollapseCells) */
  seed: number;
}

/** a floating eye of the `eyes` attack: it spawns at the telegraph and fires at fireAt */
export interface VoidEye {
  on: boolean;
  x: number;
  y: number;
  bornAt: number;
  fireAt: number;
  fired: boolean;
}
/** eyes alive at once */
export const VOID_EYE_MAX = 4;

/** a void minion of the `summon` attack: drifts to the nearest raider, strikes on contact, despawns after 8 s */
export interface VoidMinion {
  on: boolean;
  x: number;
  y: number;
  bornAt: number;
  /** clock time it was killed or crumbled (-99 = alive); the poof is drawn for VOID_MINION_POOF_S after it */
  clearedAt: number;
  /** clock time it last struck a raider (-99 = never) */
  strikeAt: number;
}
export const VOID_MINION_MAX = 3;

export interface VoidState {
  phase: VoidPhase;
  /** clock time the current phase began */
  phaseAt: number;
  hp: number;
  maxHp: number;
  /** clock time of the last hit taken (flash / knock), -99 = none */
  hitAt: number;
  /** current or last attack, null before the first */
  attack: VoidAttack | null;
  /** the boss's x in the arena (it blinks around); y is fixed by the renderer */
  x: number;
  /** number of times the Veiled One has been defeated this session (shown on the card) */
  kills: number;
  // ---- additive fields (engine-written, free for the renderer to read) ----
  /** the hp the bar shows: eases toward hp / maxHp (0..1) */
  shown: number;
  /** the line the boss is shouting (pixel font: capitals, digits, ! ? . - :) and when it started; see voidVoice() */
  voice: string;
  voiceAt: number;
  /** the boss takes no damage until this clock time (phase2 roar, TRUE FORM, reveal, dying) */
  invulnUntil: number;
  /** clock time phase2 / phase3 / the death began (-1 = not reached this fight) */
  phase2At: number;
  phase3At: number;
  dyingAt: number;
  /** clock time of the last blink landing and the x it left (the renderer fades out at blinkFromX, in at x) */
  blinkAt: number;
  blinkFromX: number;
  /** 0..1 screen shake of the Void Sanctum; decays on its own, always 0 under reduced motion */
  shake: number;
  /** floating eyes of the `eyes` attack */
  eyes: VoidEye[];
  /** where the Dungeon Lord stood (his feet, in his floor's world) when the killing blow landed, and whether he was
   *  enraged: the shatter cracks and explodes him from that pose, in place (B3, not the throne). Set at the start of shatter. */
  lordX: number;
  lordY: number;
  lordEnraged: boolean;
  /** void minions of the `summon` attack */
  minions: VoidMinion[];
  /** true while any minion lives: raider hits kill minions instead of hurting the boss */
  shielded: boolean;
  /** clock time a hit was blocked (invulnerable window, reveal, or the shield): draw a shield ripple */
  blockedAt: number;
  /** the idle menace pulse: set every ~1.8 s while the boss fights */
  menaceAt: number;
  /** the last raider strike: a point on the boss body (or on the minion it killed), the damage, crit, time, the hitter */
  lastHitX: number;
  lastHitY: number;
  lastHitDmg: number;
  lastHitCrit: boolean;
  lastHitAt: number;
  lastHitId: string;
  /** that strike killed a minion instead of hurting the boss */
  lastHitMinion: boolean;
  /** the last raider an attack landed on (not dodged), when, and how many hearts they have left */
  lastHurtId: string;
  lastHurtAt: number;
  lastHurtHearts: number;
  /** the last attack impact (big fx): when and where; eclipse also sets quakeUntil */
  voidImpactAt: number;
  voidImpactX: number;
  voidImpactY: number;
  quakeUntil: number;
}

export const voidIdle = (): VoidState => ({
  phase: "none",
  phaseAt: -99,
  hp: 0,
  maxHp: 0,
  hitAt: -99,
  attack: null,
  x: 0,
  kills: 0,
  shown: 0,
  voice: "",
  voiceAt: -99,
  invulnUntil: 0,
  phase2At: -1,
  phase3At: -1,
  dyingAt: -1,
  blinkAt: -99,
  blinkFromX: 0,
  shake: 0,
  eyes: Array.from({ length: VOID_EYE_MAX }, () => ({ on: false, x: 0, y: 0, bornAt: 0, fireAt: 0, fired: false })),
  lordX: 0,
  lordY: 0,
  lordEnraged: false,
  minions: Array.from({ length: VOID_MINION_MAX }, () => ({
    on: false,
    x: 0,
    y: 0,
    bornAt: 0,
    clearedAt: -99,
    strikeAt: -99,
  })),
  shielded: false,
  blockedAt: -99,
  menaceAt: -99,
  lastHitX: 0,
  lastHitY: 0,
  lastHitDmg: 0,
  lastHitCrit: false,
  lastHitAt: -99,
  lastHitId: "",
  lastHitMinion: false,
  lastHurtId: "",
  lastHurtAt: -99,
  lastHurtHearts: 0,
  voidImpactAt: -99,
  voidImpactX: 0,
  voidImpactY: 0,
  quakeUntil: 0,
});
