/**
 * Drawing for the Dungeon Lord boss fight (the state and timing live in lordFight.ts, the rules in engine.ts).
 * Everything is opaque pixel art. Floor effects (telegraphs, shockwave, flame stream, markers) are drawn BEFORE the
 * entity pass, so characters always stand on top of them; nothing translucent is ever drawn over a character.
 * No per-frame arrays or objects: only rect calls driven by deterministic hashes and the fight state's pools.
 */
import { lordSprite } from "./dungeonLordSprite";
import { DUNGEON_FLOORS, dungeonLordPoint } from "./dungeonScene";
import type { Employee, Office } from "./engine";
import {
  ATTACK_ACTIVE_S,
  ATTACK_BREATH,
  ATTACK_METEOR,
  ATTACK_SLAM,
  ATTACK_SUMMON,
  CRIT_FLASH_S,
  DEATH_FLASH_FROM_S,
  DEATH_KNEEL_PX,
  INTRO_S,
  MINION_POOF_S,
  MINION_RISE_S,
  METEOR_FALL_S,
  MINION_SPOTS,
  MOUTH_DX,
  MOUTH_DY,
  SLASH_MAX,
  SLASH_S,
  TAUNTS,
  TAUNT_AT_S,
  TELEGRAPH_S,
  WAVE_DX,
  WAVE_SPEED,
  WAVE_SQUASH,
  crackProgress,
  hash01,
  kneelProgress,
  type DungeonLord,
  type LordMeteor,
  type LordMinion,
} from "./lordFight";
import { monsterSprite, MON_H, MON_W } from "./monsterSprites";
import { GLYPH_H, drawPixelText, measurePixelText } from "./pixelFont";
import { prop } from "./sprites";

type Ctx = CanvasRenderingContext2D;

const INK = "#1a1c2c";
const WARN = "#ff3b2a";
const WARN_HI = "#ffb070";
const FIRE = ["#8a2410", "#d9481f", "#ff8a2a", "#ffd070", "#fff3a0"];
const SHADOW = "#1a0a14";
const CREAM = "#fff6e0";

const rect = (ctx: Ctx, color: string, x: number, y: number, width: number, height: number) => {
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x), Math.round(y), width, height);
};

/** the colour of a warning mark: pulses between two reds (steady under reduced motion) */
const warnColor = (time: number, still: boolean) => (!still && Math.floor(time * 8) % 2 ? WARN_HI : WARN);

/** a dashed ellipse of 2px dashes (marching unless `still`) */
const dashEllipse = (
  ctx: Ctx,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  color: string,
  time: number,
  still: boolean,
) => {
  const steps = Math.max(8, Math.ceil((Math.PI * 2 * Math.max(rx, ry)) / 3));
  const march = still ? 0 : Math.floor(time * 10);
  ctx.fillStyle = color;
  for (let i = 0; i < steps; i++) {
    if ((i + march) % 2) continue;
    const angle = (i / steps) * Math.PI * 2;
    ctx.fillRect(Math.round(cx + Math.cos(angle) * rx), Math.round(cy + Math.sin(angle) * ry), 2, 2);
  }
};

/** a dashed straight line of 2px dashes */
const dashLine = (
  ctx: Ctx,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  color: string,
  time: number,
  still: boolean,
) => {
  const steps = Math.max(1, Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) / 3));
  const march = still ? 0 : Math.floor(time * 10);
  ctx.fillStyle = color;
  for (let i = 0; i <= steps; i++) {
    if ((i + march) % 2) continue;
    ctx.fillRect(Math.round(x0 + ((x1 - x0) * i) / steps), Math.round(y0 + ((y1 - y0) * i) / steps), 2, 2);
  }
};

/** the live raider a special attack was aimed at, or null */
const targetOf = (office: Office, lord: DungeonLord): Employee | null =>
  lord.atk.targetId ? (office.employees.get(lord.atk.targetId) ?? null) : null;

// ---- where the Lord is (his foot point while he fights) ------------------------------------------------------------
/** the point the flame stream aims at: the raider's feet when he is still there, else where the telegraph saw him */
const aimPoint = (office: Office, lord: DungeonLord, out: { x: number; y: number }) => {
  const target = targetOf(office, lord);
  if (target && target.inDungeon && target.floor >= DUNGEON_FLOORS && target.stairsAt < 0) {
    const at = office.raiderPoint(target);
    out.x = at.x;
    out.y = at.y;
  } else {
    out.x = lord.atk.tx;
    out.y = lord.atk.ty;
  }
};
const aim = { x: 0, y: 0 };

// ---- floor layer: telegraphs and the attacks themselves (drawn before the entity pass) ----------------------------------
/** the flame stream: a tapered column of flame blobs from his mouth to the target, flickering */
const drawFlameStream = (
  ctx: Ctx,
  time: number,
  still: boolean,
  mx: number,
  my: number,
  tx: number,
  ty: number,
  reach: number,
  fade: number,
) => {
  const steps = 26;
  const flick = still ? 0 : Math.floor(time * 18);
  const dx = tx - mx,
    dy = ty - my;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len,
    ny = dx / len;
  for (let i = 0; i < steps; i++) {
    const along = i / (steps - 1);
    if (along > reach) break;
    const px = mx + dx * along,
      py = my + dy * along;
    const half = (2 + along * 8) * fade;
    for (let k = 0; k < 3; k++) {
      const jitter = (hash01(i * 7 + k * 13 + flick * 31) - 0.5) * 2;
      const off = jitter * half * (k === 0 ? 1 : 0.6);
      const size = Math.max(1, Math.round((3 + along * 3) * fade * (k === 2 ? 0.45 : k === 1 ? 0.75 : 1)));
      const tone = Math.min(4, Math.max(0, Math.round((k === 2 ? 4 : k === 1 ? 3 : 1 + (i % 2)) - along * 0.8)));
      rect(ctx, FIRE[tone], px + nx * off - size / 2, py + ny * off - size / 2, size, size);
    }
  }
  // a pool of fire where the stream lands
  if (reach >= 1 && fade > 0.2) {
    for (let i = 0; i < 14; i++) {
      const angle = (i / 14) * Math.PI * 2 + (still ? 0 : flick * 0.4);
      const radius = (9 + hash01(i + flick * 5) * 6) * fade;
      rect(ctx, FIRE[1 + (i % 3)], tx + Math.cos(angle) * radius - 1, ty + Math.sin(angle) * radius * 0.45 - 1, 3, 2);
    }
  }
};

/** the shockwave: a thick ring of ember pixels sweeping left from his boots (a flat ellipse on the floor) */
const drawShockwave = (ctx: Ctx, ox: number, oy: number, radius: number, time: number, still: boolean) => {
  const steps = Math.max(10, Math.ceil((Math.PI * radius) / 2.5));
  const flick = still ? 0 : Math.floor(time * 20);
  for (let i = 0; i <= steps; i++) {
    const angle = Math.PI / 2 + (i / steps) * Math.PI; // the left half
    const cx = ox + Math.cos(angle) * radius,
      cy = oy + Math.sin(angle) * radius * WAVE_SQUASH;
    const band = hash01(i + flick * 17);
    rect(ctx, FIRE[0], cx - 1, cy - 1, 4, 4); // dark trailing edge
    rect(ctx, FIRE[2], cx, cy, 2, 2);
    if (band > 0.4) rect(ctx, FIRE[3], cx, cy - 1, 2, 1);
    if (band > 0.8) rect(ctx, FIRE[4], cx - 2 - Math.round(band * 3), cy - 3 - Math.round(band * 3), 1, 1); // a spark thrown off
  }
};

/** the red warnings and the floor effects of the current attack, under the characters */
export const drawLordFloorFx = (ctx: Ctx, office: Office, time: number, still: boolean) => {
  const lord = office.lord;
  const atk = lord.atk;
  if (lord.hp <= 0 || atk.kind < 0) return;
  const feet = dungeonLordPoint();
  const warn = warnColor(time, still);
  const toHit = atk.hitAt - time;
  const telegraphing = time < atk.hitAt;
  switch (atk.kind) {
    case ATTACK_SLAM: {
      const ox = feet.x + WAVE_DX;
      if (telegraphing) {
        const closing = still ? 1 : Math.max(0, toHit / TELEGRAPH_S); // the warning ring closes in on his boots
        dashEllipse(ctx, ox, feet.y, 150, 150 * WAVE_SQUASH, WARN, time, still);
        dashEllipse(ctx, ox, feet.y, 30 + 120 * closing, (30 + 120 * closing) * WAVE_SQUASH, warn, time, still);
      } else {
        const age = time - atk.hitAt;
        if (still) {
          if (age < 0.5) drawShockwave(ctx, ox, feet.y, 110, time, true);
        } else drawShockwave(ctx, ox, feet.y, age * WAVE_SPEED, time, false);
      }
      break;
    }
    case ATTACK_BREATH: {
      aimPoint(office, lord, aim);
      const mx = feet.x + MOUTH_DX,
        my = feet.y + MOUTH_DY;
      if (telegraphing) {
        // the stream's path and a cone edge either side, and a ring round the raider's feet
        dashLine(ctx, mx, my, aim.x, aim.y, warn, time, still);
        dashLine(ctx, mx, my, aim.x - 10, aim.y + 4, WARN, time, still);
        dashLine(ctx, mx, my, aim.x + 10, aim.y - 4, WARN, time, still);
        dashEllipse(ctx, aim.x, aim.y, 14, 6, warn, time, still);
      } else {
        const age = time - atk.hitAt;
        const left = atk.endAt - time;
        const reach = still ? 1 : Math.min(1, age / 0.3);
        drawFlameStream(ctx, time, still, mx, my, aim.x, aim.y, reach, Math.min(1, left / 0.25));
      }
      break;
    }
    case ATTACK_SUMMON:
      if (telegraphing)
        for (let k = 0; k < MINION_SPOTS.length; k++)
          dashEllipse(
            ctx,
            feet.x + MINION_SPOTS[k].dx,
            feet.y + MINION_SPOTS[k].dy,
            12,
            5,
            k % 2 ? WARN : warn,
            time,
            still,
          );
      break;
    case ATTACK_METEOR:
      for (const meteor of lord.meteors) {
        if (!meteor.on) continue;
        if (!meteor.landed) {
          // an opaque shadow that grows as the meteor nears, ringed with a warning
          const grow = still ? 1 : Math.min(1, Math.max(0, 1 - (meteor.at - time) / (TELEGRAPH_S + METEOR_FALL_S)));
          const rx = 5 + Math.round(grow * 7);
          rect(ctx, SHADOW, meteor.x - rx, meteor.y - Math.round(rx * 0.45), rx * 2, Math.max(2, Math.round(rx * 0.9)));
          dashEllipse(ctx, meteor.x, meteor.y, rx + 3, (rx + 3) * 0.45, warn, time, still);
        } else {
          // the scorch and the flames the impact leaves
          const age = time - meteor.at;
          if (age < 0.7) {
            rect(ctx, SHADOW, meteor.x - 9, meteor.y - 3, 18, 6);
            const flick = still ? 0 : Math.floor(time * 16);
            for (let i = 0; i < 7; i++) {
              const tall = Math.max(1, Math.round((5 - age * 6) * (0.5 + hash01(i + flick * 3))));
              rect(ctx, FIRE[1 + (i % 3)], meteor.x - 8 + i * 2.5, meteor.y - 2 - tall, 2, tall);
            }
          }
        }
      }
      break;
    default:
      break;
  }
};

// ---- entities: minions and falling meteors (sorted with the characters) ----------------------------------------------
/** one skeleton minion: rises out of the floor, idles, poofs when a raider's hit clears it */
export const drawMinion = (ctx: Ctx, minion: LordMinion, time: number, still: boolean, index: number) => {
  const x = Math.round(minion.x - MON_W / 2),
    feetY = Math.round(minion.y);
  if (minion.clearedAt >= 0) {
    const age = time - minion.clearedAt;
    if (age >= MINION_POOF_S) return;
    const poof = prop(Math.floor(age * 12) % 2 ? "poof1" : "poof0");
    ctx.drawImage(poof, Math.round(minion.x - poof.width / 2), feetY - MON_H + 2);
    return;
  }
  const age = time - minion.bornAt;
  const rise = still ? 1 : Math.min(1, Math.max(0, age / MINION_RISE_S));
  const shown = Math.max(1, Math.round(MON_H * rise));
  const sprite = monsterSprite("skeleton", still ? 0 : Math.floor(time * 3 + index), false);
  rect(ctx, SHADOW, minion.x - 8, feetY - 1, 16, 2); // the hole it climbs from
  ctx.drawImage(sprite, 0, 0, MON_W, shown, x, feetY - shown, MON_W, shown);
  if (rise < 1) {
    // a ring of loose dirt around it while it climbs
    for (let k = 0; k < 6; k++)
      rect(ctx, k % 2 ? "#6a5440" : "#8a7258", minion.x - 9 + k * 3, feetY - 2 - (k % 3), 2, 2);
  }
};

/** a falling meteor: opaque fireball with a trail, dropped from the ceiling onto its marker */
export const drawMeteor = (ctx: Ctx, meteor: LordMeteor, time: number, still: boolean) => {
  if (meteor.landed || still) return;
  const progress = (time - (meteor.at - METEOR_FALL_S)) / METEOR_FALL_S;
  if (progress < 0 || progress >= 1) return;
  const top = -14;
  const y = top + (meteor.y - top) * progress * progress;
  const x = meteor.x + (1 - progress) * 10; // falls in at a slant
  const flick = Math.floor(time * 24);
  for (let k = 3; k >= 1; k--) rect(ctx, FIRE[k % 2 ? 1 : 0], x + k * 2 - 2, y - k * 4 - 1, 5 - k, 4);
  rect(ctx, INK, x - 5, y - 6, 11, 11);
  rect(ctx, FIRE[1], x - 4, y - 5, 9, 9);
  rect(ctx, FIRE[2], x - 3, y - 4, 7, 7);
  rect(ctx, FIRE[3], x - 2, y - 3, 4, 4);
  rect(ctx, FIRE[4], x - 1 + (flick % 2), y - 2, 2, 2);
};

// ---- the Lord himself ---------------------------------------------------------------------------------------------------
/** a flickering fire tongue: stacked opaque rects (outer red, orange, yellow core), `h` tall, growing up from (x, y) */
const flame = (ctx: Ctx, x: number, y: number, tall: number, width: number, shift: number) => {
  rect(ctx, FIRE[1], x - width / 2 + shift, y - tall, width, tall);
  rect(ctx, FIRE[2], x - width / 2 + 1 + shift, y - tall + 2, Math.max(1, width - 2), Math.max(1, tall - 2));
  if (tall > 4) rect(ctx, FIRE[3], x - 0.5 + shift, y - tall + 4, Math.max(1, width - 4), Math.max(1, tall - 5));
};

/** the enraged Lord's flame aura: tongues of fire around his outline, drawn BEHIND his sprite */
export const drawLordAura = (ctx: Ctx, x: number, y: number, time: number, still: boolean) => {
  const flick = still ? 0 : Math.floor(time * 12);
  const cy = y - 31;
  for (let k = 0; k < 18; k++) {
    const angle = (k / 18) * Math.PI * 2;
    const nx = Math.cos(angle),
      ny = Math.sin(angle);
    const base = 28 + (k % 3) * 2;
    const px = x + nx * base * 1.05,
      py = cy + ny * base * 1.15;
    const tall = 5 + Math.round(hash01(k * 5 + flick * 7) * 6);
    if (ny < -0.2) flame(ctx, px, py, tall, 4, Math.round(nx * 2));
    else {
      // flames along the sides and under him lick outward
      const len = 4 + Math.round(hash01(k * 3 + flick * 11) * 5);
      rect(ctx, FIRE[1], px, py - 2, Math.round(nx * len), 4);
      rect(ctx, FIRE[2], px, py - 1, Math.round(nx * Math.max(1, len - 2)), 2);
    }
  }
};

/** bigger crown and cape flames (drawn in FRONT of the sprite; they only cover his own crown and hem) */
export const drawLordBlaze = (ctx: Ctx, x: number, y: number, time: number, still: boolean) => {
  const flick = still ? 0 : Math.floor(time * 14);
  for (let k = 0; k < 4; k++)
    flame(ctx, x - 10 + k * 3, y - 51, 9 + Math.round(hash01(k + flick * 3) * 8), 3, k % 2 ? 1 : -1);
  for (let k = 0; k < 7; k++) flame(ctx, x - 1 + k * 5, y - 5, 4 + Math.round(hash01(k * 2 + flick * 5) * 6), 3, 0);
};

/** the intro's eye flare: white-hot eyes with a cross of glint */
export const drawEyeFlare = (
  ctx: Ctx,
  lx: number,
  ly: number,
  rx: number,
  ry: number,
  time: number,
  still: boolean,
) => {
  const beat = still ? 1 : 0.6 + 0.4 * Math.abs(Math.sin(time * 14));
  const reach = Math.round(5 * beat);
  for (const [ex, ey] of [
    [lx, ly],
    [rx, ry],
  ]) {
    rect(ctx, WARN, ex - 2, ey - 1, 5, 3);
    rect(ctx, WARN_HI, ex - 1, ey - 1, 3, 3);
    rect(ctx, "#ffffff", ex - 1, ey, 2, 1);
    rect(ctx, WARN, ex - reach, ey, reach * 2 + 1, 1);
    rect(ctx, WARN, ex, ey - reach, 1, reach * 2 + 1);
  }
};

/** where the Lord's eyes are for a pose (left eye, right eye); null when he is walking out of sight */
export const eyePoints = (mode: string, x: number, y: number, frame: number): [number, number, number, number] => {
  if (mode === "seated" || mode === "rising") {
    const lift = mode === "rising" ? (frame === 0 ? 4 : 8) : 0;
    return [x - 5, y - 39 - lift, x + 5, y - 39 - lift];
  }
  return [x - 8, y - 40, x - 0, y - 40];
};

const whiteCopies = new Map<HTMLCanvasElement, HTMLCanvasElement>();
/** an opaque all-white copy of a sprite (for outlines and flashes) */
const whiteOf = (src: HTMLCanvasElement): HTMLCanvasElement => {
  const known = whiteCopies.get(src);
  if (known) return known;
  const copy = document.createElement("canvas");
  copy.width = src.width;
  copy.height = src.height;
  const paint = copy.getContext("2d");
  if (paint) {
    paint.drawImage(src, 0, 0);
    paint.globalCompositeOperation = "source-in";
    paint.fillStyle = "#ffffff";
    paint.fillRect(0, 0, copy.width, copy.height);
  }
  whiteCopies.set(src, copy);
  return copy;
};

/** a critical hit: a 1px white outline round his body (drawn before the sprite) */
export const drawCritOutline = (ctx: Ctx, sprite: HTMLCanvasElement, x: number, y: number) => {
  if (typeof document === "undefined") return;
  const white = whiteOf(sprite);
  ctx.drawImage(white, x - 1, y);
  ctx.drawImage(white, x + 1, y);
  ctx.drawImage(white, x, y - 1);
  ctx.drawImage(white, x, y + 1);
};

export const critActive = (lord: DungeonLord, time: number) =>
  time - lord.critAt >= 0 && time - lord.critAt < CRIT_FLASH_S;

// ---- slash streaks (over the Lord's body, opaque and brief) ----------------------------------------------------------------
const SLASH_FROM = [
  [-14, -16],
  [14, -16],
  [-16, 2],
];
const SLASH_TO = [
  [12, 14],
  [-12, 14],
  [14, -4],
];
export const drawSlashes = (ctx: Ctx, lord: DungeonLord, time: number, x: number, y: number) => {
  const cx = x - 4,
    cy = y - 28;
  for (let i = 0; i < SLASH_MAX; i++) {
    const slash = lord.slashes[i];
    const age = time - slash.at;
    if (age < 0 || age >= SLASH_S) continue;
    const head = Math.min(1, (age / SLASH_S) * 1.6),
      tail = Math.max(0, (age / SLASH_S) * 1.6 - 0.6);
    const from = SLASH_FROM[slash.shape],
      to = SLASH_TO[slash.shape];
    const bx = (from[0] + to[0]) / 2 + (to[1] - from[1]) * 0.18,
      by = (from[1] + to[1]) / 2 - (to[0] - from[0]) * 0.18;
    const size = slash.crit ? 3 : 2;
    for (let seg = 0; seg <= 12; seg++) {
      const along = tail + ((head - tail) * seg) / 12;
      const rest = 1 - along;
      const px = rest * rest * from[0] + 2 * rest * along * bx + along * along * to[0],
        py = rest * rest * from[1] + 2 * rest * along * by + along * along * to[1];
      const thick = seg > 8 ? size : seg > 4 ? size - 1 : 1;
      rect(
        ctx,
        slash.crit ? (seg % 2 ? "#ffe14a" : "#ffffff") : seg > 6 ? "#ffffff" : "#ffd070",
        cx + px,
        cy + py,
        thick,
        thick,
      );
    }
  }
};

// ---- the taunt bubble --------------------------------------------------------------------------------------------------
/** a pixel-font speech bubble beside his head during the intro */
export const drawTaunt = (ctx: Ctx, lord: DungeonLord, time: number, headX: number, headY: number, scale: number) => {
  const age = time - lord.introAt;
  if (age < TAUNT_AT_S || age > INTRO_S + 0.4) return;
  const text = TAUNTS[lord.taunt % TAUNTS.length];
  const width = measurePixelText(text, scale) + 6 * scale;
  const height = GLYPH_H * scale + 4 * scale;
  const pop = age < TAUNT_AT_S + 0.12 ? scale : 0;
  const x = Math.round(headX - width);
  const y = Math.max(2, Math.round(headY - height)) + pop;
  rect(ctx, INK, x - 1, y - 1, width + 2, height + 2);
  rect(ctx, CREAM, x, y, width, height);
  rect(ctx, "#e8d9b5", x, y + height - 1, width, 1);
  rect(ctx, INK, x + width - 6 * scale, y + height + 1, 3 * scale, scale); // the tail points at his head
  rect(ctx, INK, x + width - 5 * scale, y + height + 1 + scale, scale, scale);
  rect(ctx, CREAM, x + width - 5 * scale, y + height, 2 * scale, scale);
  drawPixelText(ctx, text, x + 3 * scale, y + 2 * scale, "#8a1010", { scale });
};

// ---- death -------------------------------------------------------------------------------------------------------------
/** crack paths (sprite-local pixels) the light bursts through, spreading out from the chest */
const CRACK_COUNT = 7;
const CRACK_LEN = 30;
const CRACK_X0 = 30;
const CRACK_Y0 = 30;
const CRACK_XS = new Int16Array(CRACK_COUNT * CRACK_LEN);
const CRACK_YS = new Int16Array(CRACK_COUNT * CRACK_LEN);
for (let crack = 0; crack < CRACK_COUNT; crack++) {
  const heading = (crack / CRACK_COUNT) * Math.PI * 2 + hash01(crack) * 0.5;
  let px = CRACK_X0,
    py = CRACK_Y0 - 3;
  for (let i = 0; i < CRACK_LEN; i++) {
    const wander = (hash01(crack * 41 + i * 3) - 0.5) * 1.4;
    px += Math.cos(heading + wander);
    py += Math.sin(heading + wander) * 1.15;
    CRACK_XS[crack * CRACK_LEN + i] = Math.round(Math.min(60, Math.max(4, px)));
    CRACK_YS[crack * CRACK_LEN + i] = Math.round(Math.min(60, Math.max(4, py)));
  }
}

/**
 * The Lord's death: he drops to his knees, cracks of light spread over his body, he flashes white, and then (at the
 * end of the sequence) the engine bursts him into embers. Returns without drawing before the hit and after the burst.
 */
export const drawLordDeath = (ctx: Ctx, office: Office, time: number, still: boolean, x: number, y: number) => {
  const lord = office.lord;
  const age = time - lord.deadAt;
  if (age < 0 || lord.finaleAt >= 0) return;
  const kneel = kneelProgress(age, still);
  const drop = Math.round(kneel * DEATH_KNEEL_PX);
  const shake = still ? 0 : Math.floor(age * 28) % 2 ? 1 : -1;
  const sprite = lordSprite(0, true);
  const px = Math.round(x - sprite.width / 2 + shake),
    py = Math.round(y - sprite.height + 2);
  rect(ctx, INK, x - 17, y - 1, 34, 2);
  const flash =
    !still && age >= DEATH_FLASH_FROM_S && Math.floor(age * 14) % 2 === 0 && typeof document !== "undefined";
  const body = flash ? whiteOf(sprite) : sprite;
  // the upper body sinks while the boots stay planted (the sprite is cut off at the floor line)
  ctx.drawImage(body, 0, 0, sprite.width, sprite.height - drop, px, py + drop, sprite.width, sprite.height - drop);
  const progress = crackProgress(age, still);
  if (progress <= 0) return;
  const shown = Math.floor(CRACK_LEN * progress);
  const flick = still ? 0 : Math.floor(time * 16);
  for (let crack = 0; crack < CRACK_COUNT; crack++)
    for (let i = 0; i < shown; i++) {
      const cx = px + CRACK_XS[crack * CRACK_LEN + i],
        cy = py + drop + CRACK_YS[crack * CRACK_LEN + i];
      const white = (i + flick + crack) % 3 === 0;
      rect(ctx, white ? "#ffffff" : "#ffe14a", cx, cy, 1, 1);
      if (i % 5 === 0) rect(ctx, white ? "#fff3a0" : "#ffffff", cx - 1, cy, 3, 1);
    }
};

// ---- the live pose helpers ----------------------------------------------------------------------------------------------
/** the sprite frame that shows the attack he is winding up / landing (calm frames otherwise); -1 = none */
export const attackFrame = (lord: DungeonLord, time: number): number => {
  const atk = lord.atk;
  if (atk.kind < 0) return -1;
  if (time < atk.hitAt) return 2; // blade raised while the warning shows
  if (time < atk.hitAt + ATTACK_ACTIVE_S[atk.kind] * 0.35 || time < atk.hitAt + 0.35) return 3; // the slam
  return -1;
};
