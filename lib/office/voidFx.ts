/**
 * Drawing for the secret final boss fight (state: voidTypes.ts, rules and timing: voidFight.ts, scene: voidScene.ts).
 * Everything is opaque pixel art. Floor effects (telegraphs, beam, pits, shockwaves, the eclipse sun, gold rain) are
 * drawn BEFORE the entity pass so characters always stand on top; the arena darkening of the eclipse is applied to
 * the background layers only (voidScene.drawVoidBack, via voidEclipseLevel). Nothing translucent is drawn over a
 * character: afterimages and silhouettes are flat solid colours, fades are ordered dithers. No per-frame arrays:
 * rect calls driven by deterministic hashes and the fight state's own pools.
 */
import { lordSprite } from "./dungeonLordSprite";
import { VIEW_W, VIEW_X0, WORLD_H } from "./layout";
import { hash01 } from "./lordFight";
import { GLYPH_H, drawPixelText, measurePixelText } from "./pixelFont";
import {
  VOID_BLINK_IN_FRAME,
  VOID_BLINK_OUT_FRAME,
  VOID_CAST_FRAME,
  VOID_RAISE_FRAME,
  voidBossDyingSprite,
  voidBossSprite,
  voidFormSize,
  type VoidForm,
} from "./voidBossSprite";
import {
  VOID_ARENA_X0,
  VOID_ARENA_Y0,
  VOID_BEAM_HALF_PX,
  VOID_BEAM_SPEED,
  VOID_COLLAPSE_COLS,
  VOID_COLLAPSE_ROWS,
  VOID_FEET_Y,
  VOID_HOME_X,
  VOID_MINION_LIFT_PX,
  VOID_MINION_POOF_S,
  VOID_RETREAT_S,
  VOID_SHATTER_S,
  VOID_ROAR_S,
  voidFightingPhase,
  VOID_TRUE_FORM_S,
  VOID_VICTORY_S,
  VOID_WIPE_S,
  VOID_ARENA_X1,
  VOID_ARENA_Y1,
  voidAttackPhase,
  voidCollapseCell,
  voidDeathStage,
  voidDeathStageProgress,
  voidHpFrac,
  voidVoice,
} from "./voidFight";
import { drawDitherVeil, type VoidBackView, voidVariantOf } from "./voidScene";
import type { VoidMinion, VoidState } from "./voidTypes";
import {
  BAR_SEGMENTS,
  BAR_SEG_PX,
  DESCEND_S,
  NAME_FROM_S,
  NAME_TO_S,
  SHATTER_CRACK_S,
  WIPE_BLOCK_PX,
  barLitSegments,
  barPanelWidth,
  captionScale,
  descendLift,
  ditherLevelOf,
  dyingStageOf,
  formOfHp,
  formOfPhase,
  nameLetters,
  noise2,
  phasePips,
  wipeBlockCovered,
  wipeBlockT,
  wipeProgress,
  HIT_FX_S,
  OUTLINE_BLINK_S,
  STRIKE_S,
  SLASH_S,
  beamZone,
  bandsOverlap,
  flinchPx,
  hitNumberAt,
  lerpPoint,
  overlayBands,
  plaqueLayout,
  slashPoint,
  spotZone,
  strikeReach,
  BAR_TOP,
  type Zone,
} from "./voidVisualLogic";

type Ctx = CanvasRenderingContext2D;

const INK = "#0a0614";
const VOID_BLACK = "#05020b";
const CYAN = "#5ff5d8";
const CYAN_HI = "#d8fff4";
const VIOLET = "#6a48c8";
const VIOLET_HI = "#c9b3ff";
const GOLD = "#f2c14e";
const GOLD_HI = "#fff0a0";
const GOLD_SH = "#8a6416";
const RED = "#e0243c";
const WARN = "#ff3b5a";
const WARN_HI = "#ffb0c0";
const WHITE = "#ffffff";

const rect = (ctx: Ctx, color: string, x: number, y: number, wide: number, high: number) => {
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x), Math.round(y), wide, high);
};
const ease = (tick: number) => 1 - (1 - Math.min(1, Math.max(0, tick))) ** 2;
const clamp01 = (tick: number) => Math.min(1, Math.max(0, tick));
const SQUASH = 0.62;

/** a dotted ellipse outline (the one ring primitive: telegraph circles, shockwaves, seals) */
const ring = (ctx: Ctx, cx: number, cy: number, rx: number, color: string, thick = 1, step = 0.12, turn = 0) => {
  for (let angle = turn; angle < turn + Math.PI * 2; angle += step)
    rect(ctx, color, cx + Math.cos(angle) * rx, cy + Math.sin(angle) * rx * SQUASH, thick, thick);
};

/** a big opaque warning zone: moving red and violet stripes with a pulsing bright border (never alpha) */
const STRIPE_RED = "#a0182e";
const STRIPE_VIOLET = "#4a2a8a";
const stripedZone = (ctx: Ctx, zone: Zone, time: number, still: boolean, step = 4) => {
  const slide = still ? 0 : Math.floor(time * 24);
  for (let dx = 0; dx < zone.width; dx += step)
    rect(
      ctx,
      Math.floor((dx + slide) / step) % 2 === 0 ? STRIPE_RED : STRIPE_VIOLET,
      zone.x + dx,
      zone.y,
      Math.min(step, zone.width - dx),
      zone.height,
    );
  const hot = still || Math.floor(time * 10) % 2 === 0;
  const edge = hot ? WARN_HI : WARN;
  rect(ctx, edge, zone.x, zone.y, zone.width, 2);
  rect(ctx, edge, zone.x, zone.y + zone.height - 2, zone.width, 2);
  rect(ctx, edge, zone.x, zone.y, 2, zone.height);
  rect(ctx, edge, zone.x + zone.width - 2, zone.y, 2, zone.height);
};

/** a flat solid-colour copy of a sprite (every opaque pixel painted `color`): afterimages and cinematic silhouettes */
const flats = new WeakMap<HTMLCanvasElement, Map<string, HTMLCanvasElement>>();
const flatOf = (src: HTMLCanvasElement, color: string): HTMLCanvasElement => {
  let byColor = flats.get(src);
  if (!byColor) flats.set(src, (byColor = new Map()));
  const known = byColor.get(color);
  if (known) return known;
  const canvas = typeof document === "undefined" ? src : document.createElement("canvas");
  if (canvas !== src) {
    canvas.width = src.width;
    canvas.height = src.height;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.drawImage(src, 0, 0);
      ctx.globalCompositeOperation = "source-in";
      ctx.fillStyle = color;
      ctx.fillRect(0, 0, src.width, src.height);
    }
  }
  byColor.set(color, canvas);
  return canvas;
};

// ---- the boss's pose --------------------------------------------------------------------------------------------------------
export interface VoidBossPose {
  visible: boolean;
  x: number;
  /** sprite bottom edge (feet row + float margin) */
  bottom: number;
  sprite: HTMLCanvasElement | null;
  form: VoidForm;
  lift: number;
  shake: number;
}
const BOSS_VISIBLE = new Set(["reveal", "fight", "phase2", "phase3", "dying", "retreat"]);
/** fields the engine adds to the fight state for the renderer; every one is optional (defaults when absent) */
interface VoidExtras {
  lastHitX: number;
  lastHitY: number;
  lastHitDmg: number;
  lastHitCrit: boolean;
  lastHitMinion: boolean;
  lastHitAt: number;
  hitFlashS: number;
  blockedAt: number;
  menaceAt: number;
  impactAt: number;
  impactX: number;
  impactY: number;
  quakeUntil: number;
  shielded: boolean;
}
const EXTRAS: VoidExtras = {
  lastHitX: 0,
  lastHitY: 0,
  lastHitDmg: 0,
  lastHitCrit: false,
  lastHitMinion: false,
  lastHitAt: -99,
  hitFlashS: 0.08,
  blockedAt: -99,
  menaceAt: -99,
  impactAt: -99,
  impactX: 0,
  impactY: 0,
  quakeUntil: -99,
  shielded: false,
};
/** read the optional engine fields into one shared object (no allocation per frame) */
const extrasOf = (state: VoidState): VoidExtras => {
  const raw = state as unknown as Record<string, unknown>;
  const num = (key: string, fallback: number): number =>
    typeof raw[key] === "number" ? (raw[key] as number) : fallback;
  EXTRAS.lastHitX = num("lastHitX", 0);
  EXTRAS.lastHitY = num("lastHitY", 0);
  EXTRAS.lastHitDmg = num("lastHitDmg", 0);
  EXTRAS.lastHitCrit = raw.lastHitCrit === true;
  EXTRAS.lastHitMinion = raw.lastHitMinion === true;
  EXTRAS.lastHitAt = Math.max(num("lastHitAt", -99), state.hitAt);
  EXTRAS.hitFlashS = num("hitFlashS", 0.08);
  EXTRAS.blockedAt = num("blockedAt", -99);
  EXTRAS.menaceAt = num("menaceAt", -99);
  EXTRAS.impactAt = num("voidImpactAt", num("impactAt", -99));
  EXTRAS.impactX = num("voidImpactX", num("impactX", 0));
  EXTRAS.impactY = num("voidImpactY", num("impactY", 0));
  EXTRAS.quakeUntil = num("quakeUntil", -99);
  EXTRAS.shielded = raw.shielded === true;
  return EXTRAS;
};
/** the id of the raider whose hit landed last ("" when the engine does not say) */
export const voidHitterId = (state: VoidState): string => {
  const raw = state as unknown as Record<string, unknown>;
  const id = raw.lastHitId ?? raw.hitterId ?? raw.lastHitBy ?? raw.lastHitById;
  return typeof id === "string" ? id : "";
};
/** the canvas offset amplitude (px) of a quake; 0 under reduced motion */
export const voidQuakeAmp = (state: VoidState, time: number, still: boolean): number =>
  !still && time < extrasOf(state).quakeUntil ? 2 : 0;
const BLINK_OUT_S = 0.28;
const WINDUP_RISE = 6;
const BLINK_IN_S = 0.3;

export const voidBossX = (state: VoidState): number => (state.x > 0 ? state.x : VOID_HOME_X);
/** the sprite bottom: the Veiled One hovers well above the floor so its tall body stands over the raiders */
export const VOID_HOVER_PX = 30;
const bottomOf = (_form: VoidForm) => VOID_FEET_Y + VOID_HOVER_PX;

/** which sprite / where the Veiled One is right now (the cinematics handle their own phases) */
const setPose = (x: number, bottom: number, sprite: HTMLCanvasElement, form: VoidForm, lift: number, shake: number) => {
  POSE.x = x;
  POSE.bottom = bottom;
  POSE.sprite = sprite;
  POSE.form = form;
  POSE.lift = lift;
  POSE.shake = shake;
  return POSE;
};
const HIDDEN_POSE: VoidBossPose = { visible: false, x: 0, bottom: 0, sprite: null, form: 1, lift: 0, shake: 0 };
/** one shared pose object (read it before the next call): the pose is asked for several times a frame */
const POSE: VoidBossPose = { visible: true, x: 0, bottom: 0, sprite: null, form: 1, lift: 0, shake: 0 };
export const voidBossPose = (state: VoidState, time: number, still: boolean): VoidBossPose => {
  const hidden = HIDDEN_POSE;
  if (!BOSS_VISIBLE.has(state.phase)) return hidden;
  const age = time - state.phaseAt;
  const x = voidBossX(state);
  const idleFrame = still ? 0 : Math.floor(time * 3) % 4;
  const form = formOfPhase(state.phase, voidHpFrac(state));
  const ex = extrasOf(state);
  const vulnerable = voidFightingPhase(state.phase) && time >= state.invulnUntil;
  const sinceHit = time - ex.lastHitAt;
  const hurt = !still && vulnerable && !ex.lastHitMinion && sinceHit >= 0 && sinceHit < ex.hitFlashS;
  let frame = idleFrame;
  let dither = 0;
  let lift = 0;
  let rise = 0;
  let shake = 0;
  let px = x;
  if (state.phase === "reveal") {
    lift = still ? 0 : descendLift(age);
    dither = still ? 0 : ditherLevelOf(1 - age / 0.7);
  } else if (state.phase === "retreat") {
    dither = ditherLevelOf(age / VOID_RETREAT_S);
    shake = still ? 0 : Math.floor(time * 12) % 2 ? 1 : -1;
  } else if (state.phase === "dying") {
    const stage = voidDeathStage(age);
    const index = dyingStageOf(stage, voidDeathStageProgress(age));
    if (index < 0) return hidden;
    shake = still ? 0 : (Math.floor(time * 30) % 2 ? 1 : -1) * (1 + (stage === "implosion" ? 1 : 0));
    return setPose(x, bottomOf(3), voidBossDyingSprite(index), 3, 0, shake);
  } else if (state.attack && !still) {
    const attack = state.attack;
    const phase = voidAttackPhase(state, time);
    if (phase === "telegraph")
      rise = Math.round(clamp01((time - attack.at) / (attack.hitAt - attack.at)) * WINDUP_RISE);
    if (phase === "telegraph" && attack.kind === "eclipse") frame = VOID_RAISE_FRAME;
    else if (
      phase === "telegraph" &&
      form !== 3 &&
      (attack.kind === "beam" || attack.kind === "eyes" || attack.kind === "collapse" || attack.kind === "summon")
    )
      frame = VOID_CAST_FRAME;
    else if (attack.kind === "blink") {
      const sinceBlink = time - state.blinkAt;
      if (form !== 3 && phase === "telegraph" && attack.hitAt - time < BLINK_OUT_S) {
        frame = VOID_BLINK_OUT_FRAME;
        dither = ditherLevelOf(1 - (attack.hitAt - time) / BLINK_OUT_S) / 2;
      } else if (form !== 3 && sinceBlink >= 0 && sinceBlink < BLINK_IN_S) {
        frame = VOID_BLINK_IN_FRAME;
        dither = ditherLevelOf(1 - sinceBlink / BLINK_IN_S) / 2;
      } else if (form === 3 && sinceBlink >= 0 && sinceBlink < BLINK_IN_S)
        dither = ditherLevelOf(1 - sinceBlink / BLINK_IN_S);
    }
  }
  if (!still && vulnerable && !ex.lastHitMinion) px += flinchPx(sinceHit, 1);
  return setPose(
    px + shake,
    bottomOf(form) - lift - rise,
    voidBossSprite(form, frame, hurt, Math.round(dither)),
    form,
    lift,
    shake,
  );
};

/** the darkness (0..1) of the eclipse over the background layers; 0 outside an eclipse */
const STILL_ECLIPSE = 0.5;
export const voidEclipseLevel = (state: VoidState, time: number, still = false): number => {
  const attack = state.attack;
  if (!attack || attack.kind !== "eclipse" || state.phase !== "phase3") return 0;
  if (time < attack.at || time >= attack.endAt) return 0;
  if (still) return STILL_ECLIPSE;
  if (time < attack.hitAt) return ease((time - attack.at) / (attack.hitAt - attack.at));
  const rest = (attack.endAt - time) / (attack.endAt - attack.hitAt);
  return clamp01(rest * 1.6);
};

/** how far the floor cracks have spread: phase 2 grows them, phase 3 has them all */
export const voidCrackGrow = (state: VoidState, time: number): number => {
  if (state.phase === "phase2") return clamp01((time - state.phaseAt) / 2.5);
  if (state.phase === "phase3" || state.phase === "dying") return 1;
  return 0;
};

/** what the scene's back layer needs for this state */
export const voidBackView = (state: VoidState, time: number, still = false): VoidBackView => ({
  variant: voidVariantOf(state.phase),
  crack: voidCrackGrow(state, time),
  eclipse: voidEclipseLevel(state, time, still),
});

// ---- shards and bursts (analytic: no arrays) -----------------------------------------------------------------------------------
const SHARD_COLORS = ["#2c2140", "#53407c", "#b3182c", "#d9a82a", "#ffffff", "#ff8a2a", "#9a7bff"];
const burst = (
  ctx: Ctx,
  cx: number,
  cy: number,
  tick: number,
  count: number,
  speed: number,
  gravity: number,
  life: number,
  colors: readonly string[],
  seed: number,
) => {
  if (tick < 0 || tick > life) return;
  const left = 1 - tick / life;
  for (let i = 0; i < count; i++) {
    const angle = hash01(seed + i * 7) * Math.PI * 2;
    const vel = speed * (0.35 + hash01(seed + i * 13) * 0.65);
    const size = (hash01(seed + i * 17) > 0.7 ? 4 : hash01(seed + i * 19) > 0.4 ? 3 : 2) * (left > 0.35 ? 1 : 0.6);
    const px = cx + Math.cos(angle) * vel * tick,
      py = cy + Math.sin(angle) * vel * tick * 0.75 + gravity * tick * tick;
    rect(ctx, colors[i % colors.length], px, py, Math.max(1, Math.round(size)), Math.max(1, Math.round(size)));
    if (i % 5 === 0) rect(ctx, WHITE, px, py, 1, 1);
  }
};

// ---- the shatter on B3 ------------------------------------------------------------------------------------------------------
const CRACKS = 8;
const CRACK_LEN = 30;
const CRACK_XS = new Int16Array(CRACKS * CRACK_LEN);
const CRACK_YS = new Int16Array(CRACKS * CRACK_LEN);
for (let crack = 0; crack < CRACKS; crack++) {
  const heading = (crack / CRACKS) * Math.PI * 2 + hash01(crack + 90) * 0.5;
  let px = 32,
    py = 29;
  for (let i = 0; i < CRACK_LEN; i++) {
    const wander = (hash01(crack * 41 + i * 3 + 90) - 0.5) * 1.4;
    px += Math.cos(heading + wander);
    py += Math.sin(heading + wander) * 1.15;
    CRACK_XS[crack * CRACK_LEN + i] = Math.round(Math.min(60, Math.max(4, px)));
    CRACK_YS[crack * CRACK_LEN + i] = Math.round(Math.min(60, Math.max(4, py)));
  }
}

/** the shockwave ring of the Lord's explosion: under every character */
export const drawVoidShatterFloor = (
  ctx: Ctx,
  state: VoidState,
  time: number,
  still: boolean,
  x: number,
  y: number,
) => {
  if (state.phase !== "shatter" && state.phase !== "transition") return;
  const age = time - state.phaseAt - (state.phase === "transition" ? VOID_SHATTER_S : 0);
  const tick = age - SHATTER_CRACK_S;
  if (still || tick < 0 || tick > 1) return;
  for (let k = 0; k < 2; k++) {
    const radius = (tick - k * 0.12) * 230;
    if (radius <= 0) continue;
    ring(ctx, x, y - 6, radius, k ? "#ff8a2a" : WHITE, 2, 0.05);
  }
};

/** the Lord's body cracks with glowing lines and shakes, then explodes into shards, embers and a white core */
export const drawVoidShatter = (ctx: Ctx, state: VoidState, time: number, still: boolean, x: number, y: number) => {
  if (state.phase !== "shatter") return;
  const age = time - state.phaseAt;
  const sprite = lordSprite(0, true);
  const px = Math.round(x - sprite.width / 2),
    py = Math.round(y - sprite.height + 2);
  if (age < SHATTER_CRACK_S || still) {
    const progress = still ? 1 : clamp01(age / SHATTER_CRACK_S);
    const shake = still ? 0 : (Math.floor(age * 36) % 2 ? 1 : -1) * (1 + Math.floor(progress * 2));
    rect(ctx, INK, x - 17, y - 1, 34, 2);
    const flash = !still && progress > 0.55 && Math.floor(age * 18) % 3 === 0;
    ctx.drawImage(flash ? flatOf(sprite, WHITE) : sprite, px + shake, py);
    const shown = Math.floor(CRACK_LEN * progress);
    const flick = still ? 0 : Math.floor(time * 16);
    for (let crack = 0; crack < CRACKS; crack++)
      for (let i = 0; i < shown; i++) {
        const cx = px + shake + CRACK_XS[crack * CRACK_LEN + i],
          cy = py + CRACK_YS[crack * CRACK_LEN + i];
        const hot = (i + flick + crack) % 3 === 0;
        rect(ctx, hot ? WHITE : "#ffb030", cx, cy, 1, 1);
        if (i % 4 === 0) rect(ctx, hot ? GOLD_HI : WHITE, cx - 1, cy, 3, 1);
      }
    return;
  }
  const tick = age - SHATTER_CRACK_S;
  const cx = x,
    cy = y - 26;
  if (tick < 0.14) {
    const radius = 10 + tick * 150;
    for (let row = -radius; row <= radius; row += 2) {
      const half = Math.round(Math.sqrt(radius * radius - row * row));
      rect(ctx, tick < 0.07 ? WHITE : GOLD_HI, cx - half, cy + row, half * 2, 2);
    }
  }
  burst(ctx, cx, cy, tick, 64, 190, 150, 1.3, SHARD_COLORS, 301);
  burst(ctx, cx, cy - 6, tick, 28, 70, -45, 1.5, ["#ff8a2a", "#ffd070", "#ff4a2a"], 377);
};

// ---- the pixel-block wipe ---------------------------------------------------------------------------------------------------
const WIPE_COLORS = ["#05020b", "#0a0618", "#120a2a", "#1c1040"];
const WIPE_EDGE = "#9a7bff";
const WIPE_EDGE_BAND = 0.07;

/**
 * Opaque blocks fill the rect (x, y, wide, high) spreading from (originX, originY) and then clear in the same order, which
 * is the scene change from B3 to the Void Sanctum. Under reduced motion it is a plain cut (nothing drawn).
 */
export const drawVoidWipe = (
  ctx: Ctx,
  state: VoidState,
  time: number,
  still: boolean,
  x: number,
  y: number,
  wide: number,
  high: number,
  originX: number,
  originY: number,
) => {
  if (state.phase !== "transition" || still) return;
  const progress = wipeProgress(time - state.phaseAt, VOID_WIPE_S);
  if (progress <= 0 || progress >= 1) return;
  const block = Math.max(3, Math.round((WIPE_BLOCK_PX * wide) / VIEW_W));
  const cols = Math.ceil(wide / block),
    rows = Math.ceil(high / block);
  const originCol = Math.min(cols - 1, Math.max(0, Math.floor((originX - x) / block))),
    originRow = Math.min(rows - 1, Math.max(0, Math.floor((originY - y) / block)));
  const front = progress <= 0.5 ? progress * 2 : (progress - 0.5) * 2;
  for (let row = 0; row < rows; row++)
    for (let col = 0; col < cols; col++) {
      const blockT = wipeBlockT(col, row, cols, rows, originCol, originRow);
      if (!wipeBlockCovered(progress, blockT)) continue;
      const edge = Math.abs(blockT - front) < WIPE_EDGE_BAND;
      const bw = Math.min(block, x + wide - (x + col * block)),
        bh = Math.min(block, y + high - (y + row * block));
      rect(
        ctx,
        edge ? WIPE_EDGE : WIPE_COLORS[Math.floor(noise2(col + 5, row + 9) * WIPE_COLORS.length)],
        x + col * block,
        y + row * block,
        bw,
        bh,
      );
      if (!edge && block > 6) rect(ctx, "#2a1a5a", x + col * block, y + row * block, bw, 1);
    }
};

// ---- floor effects: under every character -----------------------------------------------------------------------------------
const BEAM_ROW_DY = -8;

const drawBeam = (ctx: Ctx, state: VoidState, time: number, still: boolean) => {
  const attack = state.attack;
  if (!attack) return;
  const bossX = voidBossX(state);
  const rowY = attack.targetY + BEAM_ROW_DY;
  const phase = voidAttackPhase(state, time);
  if (phase === "telegraph") {
    // a big striped band along the whole row it will sweep, chevrons pointing the way, a marker on the target
    const zone = beamZone(bossX, attack.targetY, VOID_ARENA_X0, time);
    stripedZone(ctx, zone, time, still);
    const mid = zone.y + (zone.height >> 1);
    for (let dx = 14; dx < zone.width - 10; dx += 36) {
      rect(ctx, WHITE, zone.x + zone.width - dx, mid - 4, 2, 9);
      rect(ctx, WHITE, zone.x + zone.width - dx - 2, mid - 2, 2, 5);
    }
    rect(ctx, WHITE, attack.targetX - 3, attack.targetY + BEAM_ROW_DY - 3, 7, 7);
    rect(ctx, WARN, attack.targetX - 2, attack.targetY + BEAM_ROW_DY - 2, 5, 5);
    return;
  }
  if (phase !== "active") return;
  const life = attack.endAt - attack.hitAt || 1;
  const age = still ? (bossX - 20 - VOID_ARENA_X0) / VOID_BEAM_SPEED : time - attack.hitAt;
  const fade = still ? 1 : clamp01((1 - age / life) * 3);
  const half = Math.max(2, Math.round(VOID_BEAM_HALF_PX * fade));
  const head = Math.max(VOID_ARENA_X0 - 40, bossX - 20 - VOID_BEAM_SPEED * age);
  const len = bossX - 20 - head;
  if (len <= 0) return;
  rect(ctx, VOID_BLACK, head - 2, rowY - half - 2, len + 4, half * 2 + 5);
  rect(ctx, VIOLET, head, rowY - half, len, half * 2 + 1);
  rect(ctx, "#9a7bff", head, rowY - Math.round(half * 0.7), len, Math.round(half * 1.4) + 1);
  rect(ctx, CYAN, head, rowY - Math.round(half * 0.4), len, Math.round(half * 0.8) + 1);
  rect(ctx, CYAN_HI, head, rowY - 2, len, 5);
  rect(ctx, WHITE, head, rowY - 1, len, 3);
  // pulses racing along it and a flaring head
  const spin = still ? 0 : Math.floor(time * 60);
  for (let dx = (spin * 3) % 14; dx < len; dx += 14) {
    rect(ctx, VOID_BLACK, head + dx, rowY - half, 2, 1);
    rect(ctx, VOID_BLACK, head + dx + 4, rowY + half, 2, 1);
  }
  rect(ctx, WHITE, head - 3, rowY - half - 1, 5, half * 2 + 3);
  rect(ctx, CYAN, head - 6, rowY - 3, 3, 7);
  if (!still)
    for (let k = 0; k < 6; k++)
      rect(
        ctx,
        k % 2 ? CYAN_HI : VIOLET_HI,
        head - 8 - hash01(k + Math.floor(time * 20)) * 10,
        rowY - 12 + k * 4,
        2,
        2,
      );
};

const EYE_ROWS = [3, 7, 9, 9, 7, 3];
const drawFloatEye = (ctx: Ctx, x: number, y: number, open: number, look: number, angry: boolean) => {
  const shown = Math.max(1, Math.round(open * EYE_ROWS.length));
  const skip = Math.floor((EYE_ROWS.length - shown) / 2);
  for (let row = skip; row < skip + shown; row++) {
    const width = EYE_ROWS[row];
    const half = width >> 1;
    rect(ctx, VOID_BLACK, x - half - 1, y - 3 + row, width + 2, 1);
    rect(ctx, "#e8dcff", x - half, y - 3 + row, width, 1);
  }
  if (open > 0.5) {
    rect(ctx, angry ? RED : "#ff5a8a", x - 1 + look, y - 2, 3, 4);
    rect(ctx, VOID_BLACK, x + look, y - 2, 1, 4);
    rect(ctx, WHITE, x - 1 + look, y - 2, 1, 1);
  }
  rect(ctx, angry ? WARN : VIOLET, x - 5, y - 4, 11, 1);
};

const BOLT_REACH = 36;
const drawEyes = (ctx: Ctx, state: VoidState, time: number, still: boolean) => {
  const angry = state.phase === "phase3";
  for (const eye of state.eyes) {
    if (!eye.on) continue;
    const born = clamp01((time - eye.bornAt) / 0.3);
    const bob = still ? 0 : Math.round(Math.sin(time * 3 + eye.x) * 2);
    const ground = Math.min(VOID_ARENA_Y1 - 4, eye.y + BOLT_REACH);
    const toFire = eye.fireAt - time;
    if (toFire > 0) {
      // the warning mark on the floor where its bolt will land
      stripedZone(ctx, spotZone(eye.x, ground, time, clamp01((time - eye.bornAt) / 0.3)), time, still, 3);
      rect(ctx, WHITE, eye.x - 1, ground - 1, 3, 3);
    } else if (time - eye.fireAt < 0.3) {
      const jag = still ? 0 : Math.floor(time * 40) % 3;
      for (let step = eye.y; step < ground; step += 2) {
        const sway = ((step >> 1) + jag) % 3 === 0 ? 1 : 0;
        rect(ctx, VIOLET_HI, eye.x - 2 + sway, step, 5, 2);
        rect(ctx, WHITE, eye.x - 1 + sway, step, 3, 2);
      }
      rect(ctx, WHITE, eye.x - 5, ground - 2, 11, 4);
      burst(ctx, eye.x, ground, time - eye.fireAt, 8, 50, 40, 0.3, ["#ff5a8a", "#ffd0e0", WHITE], eye.x);
    }
    const open = toFire > 0 ? Math.min(born, toFire < 0.35 ? 1 : 0.7) : 1;
    drawFloatEye(ctx, eye.x, eye.y + bob, open, still ? 0 : Math.round(Math.sin(time * 2 + eye.y)), angry);
  }
};

const PIT_TONES = ["#05020b", "#0b0618", "#14102a"];
const drawCollapse = (ctx: Ctx, state: VoidState, time: number, still: boolean) => {
  const attack = state.attack;
  if (!attack) return;
  const phase = voidAttackPhase(state, time);
  if (phase === "none") return;
  const cellW = (VOID_ARENA_X1 - VOID_ARENA_X0) / VOID_COLLAPSE_COLS,
    cellH = (VOID_ARENA_Y1 - VOID_ARENA_Y0) / VOID_COLLAPSE_ROWS;
  const age = time - attack.hitAt;
  const life = attack.endAt - attack.hitAt || 1;
  for (let row = 0; row < VOID_COLLAPSE_ROWS; row++)
    for (let col = 0; col < VOID_COLLAPSE_COLS; col++) {
      if (!voidCollapseCell(attack.seed, col, row)) continue;
      const x = VOID_ARENA_X0 + col * cellW,
        y = VOID_ARENA_Y0 + row * cellH;
      if (phase === "telegraph") {
        const hot = still || Math.floor(time * 9 + col + row) % 2 === 0;
        const edge = hot ? "#ffd070" : "#8a2a9a";
        rect(ctx, edge, x + 1, y + 1, cellW - 2, 1);
        rect(ctx, edge, x + 1, y + cellH - 2, cellW - 2, 1);
        rect(ctx, edge, x + 1, y + 1, 1, cellH - 2);
        rect(ctx, edge, x + cellW - 2, y + 1, 1, cellH - 2);
        for (let band = 3; band < cellH - 3; band += 5)
          rect(ctx, hot ? "#8a1a30" : "#3a2278", x + 3, y + band, cellW - 6, 2);
        // a crack running corner to corner
        for (let i = 3; i < cellW - 3; i += 2)
          rect(ctx, hot ? WARN_HI : WARN, x + i, y + 3 + ((i * 7) % (cellH - 8)), 2, 1);
        continue;
      }
      const grow = still ? 1 : clamp01(age / 0.25);
      const restore = still ? 1 : clamp01((life - age) / 0.3);
      const inset = Math.round((1 - Math.min(grow, restore)) * (cellW / 2 - 1));
      const px = x + inset,
        py = y + inset,
        pw = cellW - inset * 2,
        ph = cellH - inset * 2;
      if (pw < 2 || ph < 2) continue;
      rect(ctx, PIT_TONES[0], px, py, pw, ph);
      rect(ctx, PIT_TONES[1], px + 2, py + Math.floor(ph / 2), pw - 4, Math.ceil(ph / 2) - 2);
      rect(ctx, PIT_TONES[2], px + 4, py + ph - 5, pw - 8, 2);
      rect(ctx, "#43377a", px, py, pw, 1);
      rect(ctx, "#43377a", px, py, 1, ph);
      rect(ctx, "#6a48c8", px + 1, py + 1, pw - 2, 1);
      for (let star = 0; star < 3; star++)
        rect(
          ctx,
          star % 2 ? CYAN : VIOLET_HI,
          px + 3 + hash01(col * 9 + row + star) * (pw - 6),
          py + 4 + hash01(star + col) * (ph - 8),
          1,
          1,
        );
      // the slab pieces sinking into it
      if (age < 0.55 && !still)
        for (let piece = 0; piece < 6; piece++) {
          const size = Math.round(6 * (1 - age / 0.55));
          if (size < 1) continue;
          const sx = x + 3 + (piece % 3) * 9,
            sy = y + 3 + Math.floor(piece / 3) * 11 + Math.round(age * 22);
          rect(ctx, piece % 2 ? "#43377a" : "#2a2150", sx, sy, size, size);
        }
    }
};

const ECLIPSE_X = 160;
const ECLIPSE_Y = 38;
const ECLIPSE_FLOOR_Y = 128;
const SUN_R = 36;
const drawEclipse = (ctx: Ctx, state: VoidState, time: number, still: boolean) => {
  const attack = state.attack;
  if (!attack || attack.kind !== "eclipse") return;
  const phase = voidAttackPhase(state, time);
  if (phase === "none") return;
  const spin = still ? 0 : time * 0.8;
  let radius: number;
  let cy = ECLIPSE_Y;
  if (phase === "telegraph")
    radius = Math.max(3, Math.round(SUN_R * ease((time - attack.at) / (attack.hitAt - attack.at))));
  else {
    const age = time - attack.hitAt;
    radius = SUN_R + (still ? 0 : Math.round(clamp01(age / 0.3) * 8));
    cy = ECLIPSE_Y + (still ? 0 : Math.round(clamp01(age / 0.22) ** 2 * (ECLIPSE_FLOOR_Y - ECLIPSE_Y)));
    if (age > 0.5 && !still) radius = Math.round(SUN_R * clamp01(1 - (age - 0.5) / 0.7));
  }
  // corona: alternating red and gold rays around the black disc
  const rays = 24;
  for (let i = 0; i < rays; i++) {
    const angle = spin + (i / rays) * Math.PI * 2;
    const length = radius + 5 + (i % 2 ? 9 : 4) + (still ? 0 : Math.round(Math.sin(time * 6 + i) * 2));
    for (let step = radius - 1; step < length; step += 2)
      rect(
        ctx,
        step > radius + 3 ? (i % 2 ? GOLD : "#d0381c") : "#ff8a2a",
        ECLIPSE_X + Math.cos(angle) * step,
        cy + Math.sin(angle) * step * 0.9,
        2,
        2,
      );
  }
  for (let row = -radius; row <= radius; row++) {
    const half = Math.round(Math.sqrt(Math.max(0, radius * radius - row * row)));
    rect(ctx, VOID_BLACK, ECLIPSE_X - half, cy + row, half * 2 + 1, 1);
  }
  rect(
    ctx,
    "#1c1040",
    ECLIPSE_X - Math.round(radius * 0.5),
    cy - Math.round(radius * 0.6),
    Math.max(1, Math.round(radius * 0.4)),
    1,
  );
  if (phase === "telegraph") {
    // the floor under it: ringed warnings spreading across the arena
    const hot = still || Math.floor(time * 7) % 2 === 0;
    for (let row = -44; row <= 44; row += 4) {
      const half = Math.round(78 * Math.sqrt(1 - (row * row) / (45 * 45)));
      rect(ctx, (row / 4) % 2 === 0 ? STRIPE_RED : STRIPE_VIOLET, ECLIPSE_X - half, ECLIPSE_FLOOR_Y + row, half * 2, 3);
    }
    ring(ctx, ECLIPSE_X, ECLIPSE_FLOOR_Y, 70, hot ? WARN : "#8a2a9a", 2, 0.1);
    ring(ctx, ECLIPSE_X, ECLIPSE_FLOOR_Y, 40, hot ? "#8a2a9a" : WARN, 2, 0.14);
  } else {
    // the crushing shockwave
    const age = time - attack.hitAt - 0.2;
    if (age > 0 && !still)
      for (let k = 0; k < 3; k++) {
        const wave = (age - k * 0.09) * 300;
        if (wave > 0)
          ring(ctx, ECLIPSE_X, ECLIPSE_FLOOR_Y, wave, k === 0 ? WHITE : k === 1 ? GOLD : "#d0381c", 3, 0.04);
      }
  }
};

const drawBlink = (ctx: Ctx, state: VoidState, time: number, still: boolean) => {
  const attack = state.attack;
  if (!attack || attack.kind !== "blink" || state.phase === "none") return;
  const phase = voidAttackPhase(state, time);
  if (phase === "telegraph") {
    // the rune circle where it is about to appear
    const grow = clamp01((time - attack.at) / (attack.hitAt - attack.at));
    const turn = still ? 0 : time * 3;
    stripedZone(ctx, spotZone(attack.targetX, attack.targetY, time, 0.5 + grow * 0.9), time, still, 3);
    ring(ctx, attack.targetX, attack.targetY, 8 + grow * 10, CYAN, 1, 0.25, turn);
    ring(ctx, attack.targetX, attack.targetY, 5 + grow * 7, VIOLET_HI, 1, 0.5, -turn);
    for (let k = 0; k < 4; k++) {
      const angle = turn + (k * Math.PI) / 2;
      rect(ctx, GOLD, attack.targetX + Math.cos(angle) * 16, attack.targetY + Math.sin(angle) * 10, 2, 2);
    }
    return;
  }
  const since = time - state.blinkAt;
  if (since < 0 || since > 0.6 || still) return;
  // flat afterimages along the path, vanishing one after the other (never over a character: this is the floor pass)
  const form = formOfPhase(state.phase, voidHpFrac(state));
  const base = voidBossSprite(form, 0);
  const { wide, high } = voidFormSize(form);
  const to = voidBossX(state);
  for (let image = 0; image < 5; image++) {
    if (since > 0.1 * (image + 2)) continue;
    const ratio = image / 5;
    const ix = state.blinkFromX + (to - state.blinkFromX) * ratio;
    const flat = flatOf(base, image === 0 ? "#2a7a8a" : image % 2 ? "#1a1040" : "#2a1a5a");
    ctx.drawImage(flat, Math.round(ix - wide / 2), Math.round(bottomOf(form) - high));
  }
};

const drawRevealLight = (ctx: Ctx, state: VoidState, time: number, still: boolean) => {
  if (state.phase !== "reveal") return;
  const age = time - state.phaseAt;
  const grow = still ? 1 : clamp01(age / 0.6);
  const fade = still ? 0 : clamp01((age - DESCEND_S) / 0.9);
  const x = voidBossX(state);
  const bottom = VOID_FEET_Y + 4;
  const top = Math.round(bottom * (1 - grow));
  const tone = fade > 0.5 ? "#12204a" : "#1a2c5e";
  for (let y = Math.max(0, top); y < bottom; y++) {
    const half = Math.round(48 - (y / bottom) * 22) * (1 - fade * 0.5);
    const solid = Math.round(half) - 7;
    rect(ctx, tone, x - solid, y, solid * 2, 1);
    for (let dx = solid; dx < half; dx++)
      if ((dx + y * 2) % 4 < Math.round(half - dx) / 2) {
        rect(ctx, tone, x - dx, y, 1, 1);
        rect(ctx, tone, x + dx, y, 1, 1);
      }
  }
  // cold motes drifting down in the light
  if (!still)
    for (let i = 0; i < 16; i++)
      rect(
        ctx,
        i % 3 ? CYAN : CYAN_HI,
        x + (hash01(i + 600) - 0.5) * 60,
        (time * 40 + hash01(i + 700) * bottom) % bottom,
        1,
        2,
      );
  // landing ring
  const land = age - DESCEND_S;
  if (!still && land > 0 && land < 0.6) ring(ctx, x, VOID_FEET_Y + 2, land * 120, CYAN_HI, 2, 0.06);
};

const drawVictoryRain = (ctx: Ctx, state: VoidState, time: number, still: boolean) => {
  if (state.phase !== "victory" || still) return;
  const age = time - state.phaseAt;
  if (age > VOID_VICTORY_S) return;
  for (let i = 0; i < 70; i++) {
    const delay = hash01(i + 800) * 2.5;
    const tick = age - delay;
    if (tick < 0) continue;
    const speed = 50 + hash01(i + 900) * 50;
    const y = -6 + tick * speed;
    if (y > WORLD_H - 6) continue;
    const x = VIEW_X0 + hash01(i + 1000) * VIEW_W + Math.sin(tick * 3 + i) * 3;
    const spin = Math.floor(time * 10 + i) % 3;
    rect(ctx, GOLD_SH, x, y, spin === 1 ? 2 : 4, 4);
    rect(ctx, GOLD, x + 1, y, spin === 1 ? 1 : 2, 3);
    if (spin === 0) rect(ctx, GOLD_HI, x + 1, y, 1, 1);
  }
};

/** the gate of the summon: striped rune zones on the floor in front of the boss where the wisps will rise */
const drawSummonZone = (ctx: Ctx, state: VoidState, time: number, still: boolean) => {
  const attack = state.attack;
  if (!attack || voidAttackPhase(state, time) !== "telegraph") return;
  const x = voidBossX(state);
  const grow = still ? 1 : clamp01((time - attack.at) / (attack.hitAt - attack.at));
  for (let slot = 0; slot < SUMMON_SLOTS; slot++) {
    const cx = x - 34 - slot * 4,
      cy = VOID_FEET_Y + 12 + slot * 22;
    stripedZone(ctx, spotZone(cx, cy, time, 0.5 + grow * 0.7), time, still, 3);
    ring(ctx, cx, cy, 8 + grow * 8, VIOLET_HI, 1, 0.3, still ? 0 : time * 2);
  }
};
const SUMMON_SLOTS = 3;
const BOSS_SHADOW_R = [24, 14];
/** everything that lies on the floor of the Sanctum: warnings, beam, pits, the sun, light, the boss's shadow */
export const drawVoidFloorFx = (ctx: Ctx, state: VoidState, time: number, still: boolean) => {
  drawRevealLight(ctx, state, time, still);
  const pose = voidBossPose(state, time, still);
  if (pose.visible) {
    const rx = pose.form === 3 ? BOSS_SHADOW_R[0] + 22 : BOSS_SHADOW_R[0] + 10;
    const squeeze = pose.lift > 0 ? Math.max(0.4, 1 - pose.lift / 120) : 1;
    const half = Math.round(rx * squeeze);
    for (let row = -3; row <= 3; row++) {
      const wide = Math.round(half * Math.sqrt(1 - (row * row) / 16));
      rect(ctx, VOID_BLACK, pose.x - wide, VOID_FEET_Y + VOID_HOVER_PX - 10 + row, wide * 2, 1);
    }
  }
  const attack = state.attack;
  if (attack && voidAttackPhase(state, time) !== "none") {
    if (attack.kind === "beam") drawBeam(ctx, state, time, still);
    else if (attack.kind === "collapse") drawCollapse(ctx, state, time, still);
    else if (attack.kind === "eclipse") drawEclipse(ctx, state, time, still);
  }
  if (attack?.kind === "blink") drawBlink(ctx, state, time, still);
  if (attack?.kind === "summon") drawSummonZone(ctx, state, time, still);
  drawEyes(ctx, state, time, still);
  drawVictoryRain(ctx, state, time, still);
  const rumble = time - extrasOf(state).menaceAt;
  if (!still && rumble >= 0 && rumble < MENACE_S)
    ring(ctx, voidBossX(state), VOID_FEET_Y + VOID_HOVER_PX - 10, rumble * 170, WARN, 2, 0.05);
  // phase cinematics' ground effects
  const roarAge = time - state.phaseAt;
  if (!still && state.phase === "phase2" && roarAge < VOID_ROAR_S)
    ring(ctx, voidBossX(state), VOID_FEET_Y + 2, ease(roarAge / VOID_ROAR_S) * 110, VIOLET_HI, 2, 0.05);
  if (!still && state.phase === "phase3" && roarAge < VOID_TRUE_FORM_S) {
    const x = voidBossX(state);
    for (let i = 0; i < 10; i++) {
      const height = 20 + hash01(i + 40) * 60 * clamp01(roarAge / 1.2);
      rect(
        ctx,
        i % 2 ? "#3c2878" : "#1a0f33",
        x - 40 + i * 8 + (Math.floor(time * 20) % 2),
        VOID_FEET_Y + 3 - height,
        3,
        height,
      );
    }
    ring(ctx, x, VOID_FEET_Y + 2, clamp01((roarAge - 1.9) / 0.6) * 130, GOLD_HI, 2, 0.04);
  }
};

// ---- the boss and its cinematics: the entity pass -----------------------------------------------------------------------------
const SILHOUETTE = "#0a0418";
const drawSprite = (ctx: Ctx, sprite: HTMLCanvasElement, cx: number, bottom: number) =>
  ctx.drawImage(sprite, Math.round(cx - sprite.width / 2), Math.round(bottom - sprite.height));

/** the phase 2 veil tearing (0..1): cyan rips race across the figure, shreds fly, then the torn form stands */
const drawTearing = (ctx: Ctx, state: VoidState, time: number, still: boolean, age: number) => {
  const tick = clamp01(age / VOID_ROAR_S);
  const x = voidBossX(state);
  const bottom = bottomOf(1);
  const shake = still ? 0 : (Math.floor(time * 32) % 2 ? 1 : -1) * 2;
  if (tick < 0.55 && !still) {
    drawSprite(ctx, voidBossSprite(1, Math.floor(time * 3) % 4), x + shake, bottom);
    for (let rip = 0; rip < 5; rip++) {
      const reach = clamp01(tick * 2.2 - rip * 0.12);
      const sx = x - 20 + rip * 10,
        sy = bottom - 70;
      for (let step = 0; step < reach * 40; step++)
        rect(
          ctx,
          step % 4 === 0 ? CYAN_HI : CYAN,
          sx + step * 0.35 * (rip % 2 ? 1 : -1) + shake,
          sy + step * 1.4,
          1,
          1,
        );
    }
    return;
  }
  drawSprite(
    ctx,
    voidBossSprite(2, still ? 0 : Math.floor(time * 3) % 4),
    x + (still ? 0 : shake * (1 - tick)),
    bottom,
  );
  if (!still)
    burst(
      ctx,
      x,
      bottom - 45,
      (tick - 0.55) * VOID_ROAR_S,
      36,
      110,
      60,
      0.8,
      ["#1d1040", "#3c2878", "#120a28", CYAN, "#d8fff4"],
      501,
    );
};

const drawTransform = (ctx: Ctx, state: VoidState, time: number, still: boolean, age: number) => {
  const x = voidBossX(state);
  const full = voidBossSprite(3, still ? 0 : Math.floor(time * 3) % 4);
  const bottom = bottomOf(3);
  const shake = still ? 0 : Math.floor(time * 30) % 2 ? 1 : -1;
  if (age < 0.5 && !still) {
    drawSprite(ctx, voidBossSprite(2, Math.floor(time * 3) % 4), x + shake * 2, bottomOf(2));
    return;
  }
  const grow = clamp01((age - 0.5) / 0.9);
  const unfold = clamp01((age - 1.4) / 0.6);
  const flat = flatOf(full, SILHOUETTE);
  if (still || age >= 2) {
    drawSprite(ctx, full, x, bottom);
  } else if (unfold <= 0) {
    // a silhouette growing out of the dark, outlined in cold light
    const scale = 0.3 + 0.7 * ease(grow);
    const wide = Math.round(full.width * scale),
      high = Math.round(full.height * scale);
    ctx.drawImage(flatOf(full, CYAN), Math.round(x - wide / 2) - 1, Math.round(bottom - high) - 1, wide, high);
    ctx.drawImage(flat, Math.round(x - wide / 2), Math.round(bottom - high), wide, high);
  } else {
    // the wings unfold: the coloured form is revealed outward from the centre column over the full silhouette
    drawSprite(ctx, flat, x, bottom);
    const shown = Math.max(8, Math.round(full.width * ease(unfold)));
    const left = Math.round((full.width - shown) / 2);
    ctx.drawImage(
      full,
      left,
      0,
      shown,
      full.height,
      Math.round(x - full.width / 2) + left,
      Math.round(bottom - full.height),
      shown,
      full.height,
    );
  }
  if (age >= 2 - 0.01 && age < VOID_TRUE_FORM_S && !still) {
    // the crown ignites: gold flames burst off the thorns
    burst(ctx, x, bottom - 112, age - 2, 30, 60, -50, 0.5, [GOLD, GOLD_HI, WHITE, "#ff8a2a"], 612);
  }
};

const drawDying = (ctx: Ctx, state: VoidState, time: number, still: boolean) => {
  const age = time - state.phaseAt;
  const x = voidBossX(state);
  const stage = voidDeathStage(age);
  const pose = voidBossPose(state, time, still);
  const cx = x,
    cy = bottomOf(3) - 60;
  if (pose.visible && pose.sprite) {
    drawSprite(ctx, pose.sprite, pose.x, pose.bottom);
    if (!still && stage !== "flash") {
      // beams of light leaking out of the cracks
      const power = stage === "cracks" ? voidDeathStageProgress(age) * 0.5 : 0.5 + voidDeathStageProgress(age) * 0.5;
      for (let i = 0; i < 9; i++) {
        const angle = (i / 9) * Math.PI * 2 + age * 0.4;
        const length = 10 + power * 50 * hash01(i + 20);
        for (let step = 8; step < length; step += 2)
          rect(ctx, step % 4 ? GOLD_HI : WHITE, cx + Math.cos(angle) * step, cy + Math.sin(angle) * step * 0.9, 2, 1);
      }
    }
    return;
  }
  if (stage === "flash" && !still) {
    const pt = voidDeathStageProgress(age);
    const radius = 6 + ease(pt) * 44;
    for (let row = -radius; row <= radius; row += 2) {
      const half = Math.round(Math.sqrt(Math.max(0, radius * radius - row * row)));
      rect(ctx, pt > 0.55 ? GOLD_HI : WHITE, cx - half, cy + row, half * 2, 2);
    }
    ring(ctx, cx, cy, ease(pt) * 150, WHITE, 3, 0.04);
    ring(ctx, cx, cy, ease(pt * 0.8) * 120, GOLD, 2, 0.05);
    if (pt > 0.4)
      burst(ctx, cx, cy, (pt - 0.4) * 2.2, 90, 170, 60, 1.4, ["#ffffff", GOLD_HI, GOLD, VIOLET_HI, CYAN], 702);
  }
};

const OUTLINE_DIRS: readonly (readonly [number, number])[] = [
  [-1, 0],
  [1, 0],
  [0, -1],
  [0, 1],
];
const MOTES = 16;
const EYES_TRUE = [5, 11];
const EYES_VEILED = [-8, 8];
const MENACE_S = 0.7;
const SHIELD_DOTS = 44;
/** dark motes rising off the body, the red eye glow of a menace pulse, the rotating rune shield */
const drawBossAmbient = (ctx: Ctx, state: VoidState, pose: VoidBossPose, time: number, still: boolean) => {
  if (!pose.sprite) return;
  const high = pose.sprite.height;
  const ex = extrasOf(state);
  if (!still)
    for (let i = 0; i < MOTES; i++) {
      const climb = (time * 16 + hash01(i + 60) * 110) % 110;
      const size = i % 4 === 0 ? 2 : 1;
      rect(
        ctx,
        i % 3 === 0 ? CYAN : i % 2 ? "#3c2878" : "#1a1040",
        pose.x + (hash01(i + 70) - 0.5) * 80,
        pose.bottom - climb * 1.1,
        size,
        size,
      );
    }
  const menace = time - ex.menaceAt;
  if (!still && menace >= 0 && menace < MENACE_S) {
    const eyeY = pose.bottom - high + (pose.form === 3 ? 41 : 39);
    const xs = pose.form === 3 ? EYES_TRUE : EYES_VEILED;
    for (const dx of xs) {
      rect(ctx, WARN, pose.x + dx - 3, eyeY - 1, 7, 4);
      rect(ctx, WHITE, pose.x + dx - 1, eyeY, 3, 2);
      rect(ctx, WARN, pose.x + dx, eyeY + 4, 1, 5 + Math.round(menace * 12));
    }
  }
  if (ex.shielded) {
    const rx = pose.sprite.width / 2 + 6,
      ry = high / 2 + 6;
    const spin = still ? 0 : time * 0.9;
    for (let i = 0; i < SHIELD_DOTS; i++) {
      const angle = spin + (i / SHIELD_DOTS) * Math.PI * 2;
      const rune = i % 6 === 0;
      rect(
        ctx,
        rune ? GOLD_HI : i % 2 ? CYAN : VIOLET,
        pose.x + Math.cos(angle) * rx,
        pose.bottom - high / 2 + Math.sin(angle) * ry,
        rune ? 3 : 2,
        rune ? 3 : 2,
      );
    }
  }
};

/** the Veiled One itself, its cinematics, its dying; draw at y-sort VOID_FEET_Y */
export const drawVoidBoss = (ctx: Ctx, state: VoidState, time: number, still: boolean) => {
  if (!BOSS_VISIBLE.has(state.phase)) return;
  const age = time - state.phaseAt;
  if (state.phase === "dying") return drawDying(ctx, state, time, still);
  if (state.phase === "phase2" && age < VOID_ROAR_S) return drawTearing(ctx, state, time, still, age);
  if (state.phase === "phase3" && age < VOID_TRUE_FORM_S) return drawTransform(ctx, state, time, still, age);
  const pose = voidBossPose(state, time, still);
  if (pose.visible && pose.sprite) {
    const ex = extrasOf(state);
    const sinceHit = time - ex.lastHitAt;
    if (
      !still &&
      !ex.lastHitMinion &&
      voidFightingPhase(state.phase) &&
      time >= state.invulnUntil &&
      sinceHit >= 0 &&
      sinceHit < OUTLINE_BLINK_S
    ) {
      // a one-frame white outline: the same silhouette, flat white, one pixel out on every side (opaque)
      const flat = flatOf(pose.sprite, WHITE);
      for (const [dx, dy] of OUTLINE_DIRS) drawSprite(ctx, flat, pose.x + dx, pose.bottom + dy);
    }
    drawSprite(ctx, pose.sprite, pose.x, pose.bottom);
    drawBossAmbient(ctx, state, pose, time, still);
  }
  // the cast orb of the eclipse and the glow of a beam charging, drawn on the boss itself
  const attack = state.attack;
  if (!attack || still || voidAttackPhase(state, time) !== "telegraph") return;
  const charge = clamp01((time - attack.at) / (attack.hitAt - attack.at));
  if (attack.kind === "beam") {
    const size = 2 + Math.round(charge * 5);
    rect(ctx, VIOLET_HI, pose.x - 20 - size / 2, pose.bottom - 46 - size / 2, size, size);
    rect(ctx, WHITE, pose.x - 20, pose.bottom - 46, 1, 1);
  }
};

// ---- captions, name card, victory, the bar: over the floor ------------------------------------------------------------------------
const CENTER_X = VIEW_X0 + VIEW_W / 2;
const SIDE_X = VIEW_X0 + 6;
const BANDS = overlayBands();

const drawVoiceCaption = (ctx: Ctx, state: VoidState, time: number, still: boolean) => {
  const line = voidVoice(state, time);
  if (!line) return;
  const age = time - state.voiceAt;
  const scale = captionScale(line, VIEW_W - 24, 2);
  const letters = still ? line.length : Math.min(line.length, Math.floor(age * 38) + 1);
  const width = measurePixelText(line, scale);
  const left = Math.round(CENTER_X - width / 2);
  // an opaque plate keeps the line readable over the floor; it sits in its own band just above the boss bar
  const top = BANDS.voice.y;
  rect(ctx, INK, left - 5, top - 1, width + 10, BANDS.voice.height);
  rect(ctx, VIOLET, left - 4, top, width + 8, 1);
  rect(ctx, VIOLET, left - 4, top + BANDS.voice.height - 2, width + 8, 1);
  drawPixelText(ctx, line.slice(0, letters), left, top + 2, WHITE, { scale, shadow: "#2a0a3a" });
};

const NAME = "THE VEILED ONE";
const SUBTITLE = "THE ONE BEHIND IT ALL";
const drawNameCard = (ctx: Ctx, state: VoidState, time: number, still: boolean) => {
  if (state.phase !== "reveal") return;
  const age = time - state.phaseAt;
  if (age < NAME_FROM_S || age > NAME_TO_S) return;
  const slideOut = clamp01((NAME_TO_S - age) / 0.3);
  const letters = still ? NAME.length : nameLetters(age, NAME.length);
  const scale = captionScale(NAME, 180, 3);
  const width = measurePixelText(NAME, scale);
  const left = SIDE_X - Math.round((1 - slideOut) * (width + 20));
  const top = BANDS.side.y;
  rect(ctx, INK, left - 4, top - 4, width + 8, GLYPH_H * scale + 22);
  rect(ctx, GOLD_SH, left - 3, top - 3, width + 6, 1);
  drawPixelText(ctx, NAME.slice(0, letters), left, top, GOLD_HI, { scale, shadow: "#3a0f16" });
  if (age > NAME_FROM_S + 0.9 || still)
    drawPixelText(ctx, SUBTITLE, left, top + GLYPH_H * scale + 4, VIOLET_HI, { shadow: "#12062a" });
  const bar = Math.round(width * (still ? 1 : clamp01((age - NAME_FROM_S) / 0.9)));
  rect(ctx, GOLD, left, top - 2, bar, 1);
};

const VICTORY = "VICTORY";
const VICTORY_SUB = "THE VEILED ONE HAS FALLEN";
const VICTORY_MAX_W = 200;
const drawVictory = (ctx: Ctx, state: VoidState, time: number, still: boolean) => {
  if (state.phase !== "victory") return;
  const age = time - state.phaseAt;
  const inOut = Math.min(clamp01(age / 0.4), clamp01((VOID_VICTORY_S - age) / 0.5));
  if (inOut <= 0) return;
  const plaque = plaqueLayout(VICTORY, VICTORY_SUB, VICTORY_MAX_W, 4);
  const left = SIDE_X - Math.round((1 - inOut) * (plaque.plateW + 20));
  const top = BANDS.side.y;
  // a properly sized plate: iron frame, gold border, dark field; one crisp pass of text at an integer scale
  rect(ctx, INK, left - 2, top - 2, plaque.plateW + 4, plaque.plateH + 4);
  rect(ctx, GOLD, left - 1, top - 1, plaque.plateW + 2, plaque.plateH + 2);
  rect(ctx, "#0e0820", left, top, plaque.plateW, plaque.plateH);
  rect(ctx, GOLD_SH, left + 2, top + 2, plaque.plateW - 4, 1);
  rect(ctx, GOLD_SH, left + 2, top + plaque.plateH - 3, plaque.plateW - 4, 1);
  const flick = still ? 0 : Math.floor(time * 6) % 2;
  drawPixelText(ctx, VICTORY, left + plaque.titleX, top + plaque.titleY, flick ? GOLD_HI : GOLD, {
    scale: plaque.scale,
    shadow: "#2a1400",
  });
  drawPixelText(ctx, VICTORY_SUB, left + plaque.titleX, top + plaque.lineY, WHITE, { shadow: "#2a1400" });
  if (!still)
    for (let i = 0; i < 6; i++) {
      const sx = left + 4 + hash01(i + 40) * (plaque.plateW - 8),
        sy = top + 4 + hash01(i + 50) * (plaque.plateH - 8);
      if (Math.floor(time * 6 + i) % 4 === 0) {
        rect(ctx, WHITE, sx, sy - 1, 1, 3);
        rect(ctx, WHITE, sx - 1, sy, 3, 1);
      }
    }
};

/** the voice, the name card and the victory banner: screen-level text over the floor */
export const drawVoidTexts = (ctx: Ctx, state: VoidState, time: number, still: boolean) => {
  if (bandsOverlap(BANDS.banner, BANDS.voice) || bandsOverlap(BANDS.side, BANDS.voice)) return;
  drawVoiceCaption(ctx, state, time, still);
  drawNameCard(ctx, state, time, still);
  drawVictory(ctx, state, time, still);
};

// ---- hits: a raider's strike reaching the boss, the shield ripple, attack landings -------------------------------------------------
const NORMAL_SPARKS = [WHITE, CYAN_HI, VIOLET_HI, CYAN];
const CRIT_SPARKS = [WHITE, GOLD_HI, GOLD, "#ff8a2a"];
const IMMUNE = "IMMUNE";
const HIT_RAYS = 6;
const SLASH_SEGS = 14;
const STRIKE_SEGS = 9;
const IMPACT_POPUP_S = 0.7;

/** a filled disc of flat colour (opaque flash cores) */
const disc = (ctx: Ctx, cx: number, cy: number, radius: number, color: string) => {
  for (let row = -radius; row <= radius; row++) {
    const half = Math.round(Math.sqrt(Math.max(0, radius * radius - row * row)));
    rect(ctx, color, cx - half, cy + row, half * 2 + 1, 1);
  }
};

/** the heart of a "-1" popup (7x6) */
const heart = (ctx: Ctx, x: number, y: number) => {
  rect(ctx, WARN, x + 1, y, 2, 1);
  rect(ctx, WARN, x + 4, y, 2, 1);
  rect(ctx, WARN, x, y + 1, 7, 2);
  rect(ctx, WARN, x + 1, y + 3, 5, 1);
  rect(ctx, WARN, x + 2, y + 4, 3, 1);
  rect(ctx, WARN, x + 3, y + 5, 1, 1);
  rect(ctx, WHITE, x + 1, y + 1, 1, 1);
};

const impactPoint = (state: VoidState, ex: VoidExtras, out: { x: number; y: number }) => {
  out.x = ex.lastHitX > 0 ? ex.lastHitX : voidBossX(state) - 16;
  out.y = ex.lastHitY > 0 ? ex.lastHitY : bottomOf(1) - 72;
};
const IMPACT = { x: 0, y: 0 };

/**
 * Every raider hit, readable at a glance: a strike line from the raider (`from`) and a big slash arc on the body, a
 * large spark burst and white-hot core at the impact point, the damage number (2x, crits 3x gold) rising. While the
 * boss is immune a rune ripple and a small IMMUNE tag show instead. Opaque, drawn over the floor (never tinting).
 */
export const drawVoidHits = (
  ctx: Ctx,
  state: VoidState,
  time: number,
  still: boolean,
  fromX: number,
  fromY: number,
  hasFrom: boolean,
) => {
  if (!BOSS_VISIBLE.has(state.phase) || state.phase === "dying") return;
  const ex = extrasOf(state);
  impactPoint(state, ex, IMPACT);
  const blocked = time - ex.blockedAt;
  if (blocked >= 0 && blocked < 0.5) {
    const spread = still ? 12 : 6 + blocked * 60;
    for (let i = 0; i < 24; i++) {
      const angle = (i / 24) * Math.PI * 2;
      rect(
        ctx,
        i % 3 === 0 ? WHITE : i % 2 ? CYAN : VIOLET_HI,
        IMPACT.x + Math.cos(angle) * spread,
        IMPACT.y + Math.sin(angle) * spread,
        2,
        2,
      );
    }
    drawPixelText(ctx, IMMUNE, IMPACT.x, IMPACT.y - 14 - (still ? 0 : Math.round(blocked * 14)), CYAN_HI, {
      align: "center",
      shadow: "#12062a",
      outline: true,
    });
  }
  const age = time - ex.lastHitAt;
  if (ex.lastHitAt < 0 || age < 0 || age >= HIT_FX_S) return;
  const crit = ex.lastHitCrit;
  if (!still) {
    if (hasFrom && age < STRIKE_S * 1.8) {
      const head = strikeReach(age),
        tail = Math.max(0, head - 0.5);
      for (let seg = 0; seg <= STRIKE_SEGS; seg++) {
        const at = lerpPoint(fromX, fromY, IMPACT.x, IMPACT.y, tail + ((head - tail) * seg) / STRIKE_SEGS);
        const size = seg > STRIKE_SEGS * 0.6 ? (crit ? 4 : 3) : 2;
        rect(ctx, seg > 5 ? WHITE : crit ? GOLD : CYAN, at.x - size / 2, at.y - size / 2, size, size);
      }
    }
    if (age < SLASH_S) {
      const dir = hasFrom && fromX > IMPACT.x ? 1 : -1;
      const progress = age / SLASH_S;
      const size = crit ? 5 : 4;
      for (let seg = 0; seg <= SLASH_SEGS; seg++) {
        const ratio = Math.max(0, progress - 0.55) + ((progress - Math.max(0, progress - 0.55)) * seg) / SLASH_SEGS;
        const at = slashPoint(IMPACT.x, IMPACT.y, Math.min(1, ratio), dir);
        rect(ctx, crit ? GOLD_HI : WHITE, at.x - size / 2, at.y - size / 2, size, size);
        rect(ctx, crit ? GOLD : VIOLET_HI, at.x - size / 2 - 1, at.y - size / 2 - 1, 2, 2);
      }
    }
    if (age < 0.08) disc(ctx, IMPACT.x, IMPACT.y, crit ? 14 : 10, age < 0.04 ? WHITE : crit ? GOLD_HI : CYAN_HI);
    if (age < 0.22)
      for (let ray = 0; ray < HIT_RAYS; ray++) {
        const angle = (ray / HIT_RAYS) * Math.PI * 2 + hash01(Math.floor(ex.lastHitAt * 100)) * 3;
        for (let step = 6; step < 10 + age * 80; step += 2)
          rect(ctx, crit ? GOLD_HI : WHITE, IMPACT.x + Math.cos(angle) * step, IMPACT.y + Math.sin(angle) * step, 2, 2);
      }
    burst(
      ctx,
      IMPACT.x,
      IMPACT.y,
      age,
      crit ? 40 : 24,
      crit ? 150 : 110,
      40,
      0.5,
      crit ? CRIT_SPARKS : NORMAL_SPARKS,
      Math.floor(ex.lastHitAt * 100),
    );
  }
  if (ex.lastHitDmg > 0) {
    const num = hitNumberAt(age, crit);
    if (num.shown)
      drawPixelText(
        ctx,
        String(Math.round(ex.lastHitDmg)),
        IMPACT.x,
        IMPACT.y - 14 - (still ? 0 : num.rise),
        crit ? GOLD_HI : WHITE,
        {
          scale: num.scale,
          align: "center",
          shadow: crit ? "#5a2a00" : "#2a0a3a",
          outline: true,
        },
      );
  }
};

/** an attack landing on its target: an impact flash and the "-1" heart popup rising (the full length of the effect when still) */
export const drawVoidImpacts = (ctx: Ctx, state: VoidState, time: number, still: boolean) => {
  const attack = state.attack;
  if (!attack || state.phase === "none") return;
  const ex = extrasOf(state);
  const sinceImpact = time - ex.impactAt;
  const tx = ex.impactX > 0 ? ex.impactX : attack.targetX,
    ty = ex.impactY > 0 ? ex.impactY : attack.targetY;
  const sinceHit = time - attack.hitAt;
  const flash = ex.impactAt >= 0 ? sinceImpact : attack.kind === "eclipse" ? -1 : sinceHit;
  if (flash >= 0 && flash < 0.5 && !still) {
    if (flash < 0.1) disc(ctx, tx, ty - 8, 12, flash < 0.05 ? WHITE : WARN_HI);
    burst(ctx, tx, ty - 8, flash, 22, 120, 50, 0.5, [WHITE, WARN, WARN_HI, VIOLET_HI], Math.floor(attack.hitAt * 100));
    ring(ctx, tx, ty - 8, flash * 90, WARN, 2, 0.12);
  }
  if (ex.impactAt >= 0 && sinceImpact >= 0 && sinceImpact < IMPACT_POPUP_S) {
    const rise = still ? 0 : Math.round(clamp01(sinceImpact / IMPACT_POPUP_S) * 22);
    drawPixelText(ctx, "-1", tx - 4, ty - 34 - rise, WHITE, { scale: 2, shadow: "#5a0614", outline: true });
    heart(ctx, tx + 8, ty - 33 - rise);
  }
};

// ---- minions ------------------------------------------------------------------------------------------------------------------
const WISP_ROWS = [3, 5, 7, 9, 9, 9, 7, 7, 5];
const WISP_POOF = [VIOLET_HI, CYAN, WHITE, "#3c2878"];
/** a small void wisp of the summon attack: rises, drifts, strikes with a flash; a poof of shards when it is cleared */
export const drawVoidMinion = (ctx: Ctx, minion: VoidMinion, time: number, still: boolean, index: number) => {
  const cleared = minion.clearedAt >= 0 ? time - minion.clearedAt : -1;
  const cx = Math.round(minion.x);
  if (cleared >= 0) {
    if (!still && cleared < VOID_MINION_POOF_S) {
      burst(ctx, cx, minion.y - 12, cleared, 16, 80, 40, VOID_MINION_POOF_S, WISP_POOF, index * 17 + 5);
      ring(ctx, cx, minion.y - 12, cleared * 70, WHITE, 2, 0.2);
    }
    return;
  }
  const rise = still ? 1 : clamp01((time - minion.bornAt) / 0.4);
  const bob = still ? 0 : Math.round(Math.sin(time * 4 + index * 2) * 2);
  const top = Math.round(minion.y - VOID_MINION_LIFT_PX - WISP_ROWS.length - 4 + (1 - rise) * 10) + bob;
  rect(ctx, VOID_BLACK, cx - 5, minion.y, 11, 2);
  const shown = Math.ceil(rise * WISP_ROWS.length);
  const sway = still ? 0 : Math.round(Math.sin(time * 6 + index));
  for (let row = 0; row < shown; row++) {
    const width = WISP_ROWS[row];
    const half = width >> 1;
    const lean = row > WISP_ROWS.length - 4 ? sway : 0;
    rect(ctx, VOID_BLACK, cx - half - 1 + lean, top + row, width + 2, 1);
    rect(ctx, "#2a1a5a", cx - half + lean, top + row, width, 1);
    rect(ctx, "#4a3290", cx - half + lean, top + row, 1, 1);
    if (row > 1 && row % 3 === 0) rect(ctx, "#1a0f33", cx + lean, top + row, half, 1);
  }
  if (shown > 4) {
    const struck = !still && time - minion.strikeAt >= 0 && time - minion.strikeAt < 0.25;
    rect(ctx, struck ? WARN : CYAN, cx - 3, top + 3, 2, 2);
    rect(ctx, struck ? WARN : CYAN, cx + 2, top + 3, 2, 2);
    if (struck) ring(ctx, cx, top + 4, (time - minion.strikeAt) * 100, WARN_HI, 2, 0.25);
  }
};

// ---- the boss bar --------------------------------------------------------------------------------------------------------------
const BAR_PHASE_COLORS = [
  { on: "#7a5af0", hi: "#c9b3ff", lo: "#3a2a90" },
  { on: "#c83ad0", hi: "#ffa0f0", lo: "#701a80" },
  { on: "#e0343c", hi: "#ffd070", lo: "#8a1020" },
];
const BAR_MARKS = [0.6, 0.25];
const BAR_PHASES = new Set(["reveal", "fight", "phase2", "phase3", "dying", "retreat"]);
const PANEL_H = 30;
const PIP_COLORS = [CYAN, "#ff5ae0", GOLD];

const diamond = (ctx: Ctx, x: number, y: number, lit: boolean, color: string) => {
  const dark = lit ? color : "#2a1a4a";
  rect(ctx, INK, x - 1, y + 1, 7, 3);
  rect(ctx, INK, x + 1, y - 1, 3, 7);
  rect(ctx, dark, x, y + 2, 5, 1);
  rect(ctx, dark, x + 1, y + 1, 3, 3);
  rect(ctx, dark, x + 2, y, 1, 5);
  if (lit) rect(ctx, WHITE, x + 2, y + 2, 1, 1);
};

/** the ornate boss bar: iron-violet frame with gold corners and an eye emblem, name, phase pips, a 40-segment bar */
export const drawVoidBar = (ctx: Ctx, state: VoidState, time: number, still: boolean) => {
  if (!BAR_PHASES.has(state.phase)) return;
  const age = time - state.phaseAt;
  const slide = state.phase === "reveal" ? ease(age / 0.8) : 1;
  const panelW = barPanelWidth();
  const panelX = Math.round(CENTER_X - panelW / 2);
  const panelY = BAR_TOP + Math.round((1 - slide) * (PANEL_H + 6));
  const pips = phasePips(state.phase);
  const colors = BAR_PHASE_COLORS[Math.max(0, pips - 1)];
  const dying = state.phase === "dying";
  rect(ctx, INK, panelX - 2, panelY - 2, panelW + 4, PANEL_H + 4);
  rect(ctx, "#3a2c78", panelX - 1, panelY - 1, panelW + 2, PANEL_H + 2);
  rect(ctx, "#6a58c0", panelX - 1, panelY - 1, panelW + 2, 1);
  rect(ctx, "#150c2e", panelX, panelY, panelW, PANEL_H);
  rect(ctx, "#1f1342", panelX + 1, panelY + 1, panelW - 2, 1);
  // gold corners
  for (let corner = 0; corner < 4; corner++) {
    const cx = corner % 2 ? panelX + panelW - 2 : panelX - 2,
      cy = corner > 1 ? panelY + PANEL_H - 2 : panelY - 2;
    rect(ctx, GOLD, cx, cy, 4, 4);
    rect(ctx, GOLD_HI, cx, cy, 2, 1);
    rect(ctx, GOLD_SH, cx + 1, cy + 3, 3, 1);
  }
  // the eye emblem crowning the top centre
  const ex = CENTER_X;
  rect(ctx, INK, ex - 9, panelY - 7, 19, 9);
  rect(ctx, "#3a2c78", ex - 8, panelY - 6, 17, 7);
  rect(ctx, "#e8dcff", ex - 6, panelY - 5, 13, 5);
  rect(ctx, INK, ex - 8, panelY - 6, 3, 1);
  rect(ctx, INK, ex + 6, panelY - 6, 3, 1);
  const look = still ? 0 : Math.round(Math.sin(time * 1.5) * 2);
  rect(ctx, pips >= 3 ? RED : CYAN, ex - 2 + look, panelY - 5, 5, 5);
  rect(ctx, VOID_BLACK, ex + look, panelY - 5, 1, 5);
  rect(ctx, WHITE, ex - 2 + look, panelY - 5, 1, 1);
  // name, percent, the three phase pips
  drawPixelText(ctx, NAME, panelX + 8, panelY + 4, dying ? "#c4c9d4" : WHITE, { shadow: INK });
  const pct = dying ? "FALLEN" : `${Math.ceil(voidHpFrac(state) * 100)}%`;
  drawPixelText(ctx, pct, panelX + panelW - 30, panelY + 4, dying ? "#8d93a0" : GOLD_HI, {
    shadow: INK,
    align: "right",
  });
  for (let pip = 0; pip < 3; pip++)
    diamond(ctx, panelX + panelW - 24 + pip * 7, panelY + 3, pip < pips, PIP_COLORS[pip]);
  // the segmented bar
  const barX = panelX + 12,
    barY = panelY + 14;
  const segs = BAR_SEGMENTS;
  rect(ctx, INK, barX - 1, barY - 1, segs * BAR_SEG_PX + 1, 10);
  const fillNow = Math.max(0, state.shown);
  const lit = dying ? 0 : barLitSegments(voidHpFrac(state), segs, state.hp > 0);
  const trail = barLitSegments(fillNow, segs, false);
  const hot = pips >= 3 && !still && Math.floor(time * 6) % 2 === 0;
  for (let seg = 0; seg < segs; seg++) {
    const sx = barX + seg * BAR_SEG_PX;
    const on = seg < lit,
      draining = !on && seg < trail;
    rect(ctx, on ? (hot ? colors.hi : colors.on) : draining ? "#ffe14a" : "#2a1a3a", sx, barY, BAR_SEG_PX - 1, 8);
    if (on || draining) {
      rect(ctx, on ? colors.hi : "#fff4a0", sx, barY, BAR_SEG_PX - 1, 1);
      rect(ctx, on ? colors.lo : "#b8962a", sx, barY + 7, BAR_SEG_PX - 1, 1);
    }
  }
  // the phase thresholds: gold ticks at 60% and 25%
  for (const mark of BAR_MARKS) {
    const mx = barX + Math.round(segs * mark) * BAR_SEG_PX - 1;
    rect(ctx, GOLD, mx, barY - 3, 1, 3);
    rect(ctx, GOLD, mx, barY + 8, 1, 2);
  }
  // a small flourish under the bar
  rect(ctx, GOLD_SH, panelX + 12, panelY + PANEL_H - 5, panelW - 24, 1);
  rect(ctx, GOLD, CENTER_X - 10, panelY + PANEL_H - 5, 20, 1);
  rect(ctx, GOLD_HI, CENTER_X - 1, panelY + PANEL_H - 6, 3, 3);
};

export { formOfHp, ditherLevelOf, drawDitherVeil };
