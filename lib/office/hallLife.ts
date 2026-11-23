// Life in the guild hall that is not a Claude session: a ginger cat (naps by the hearth, wanders, chases a mouse, hides
// from bosses, sleeps when the guild is quiet at night), a beagle by the door that wakes and wags when someone walks
// by, and three regulars (a hooded traveller, a dwarf and a merchant) who sip, raise their mugs when a quest is done
// and jump when a boss shows up. Pure logic: no drawing, randomness injected so tests can seed it.

import { BAR, COUNTER_BOX, FEAST_BLOCK, FEAST_TABLE, HEARTH, KITCHEN_HEARTH, SERVING_COUNTER } from "./layout";
import type { Pt, Rect } from "./layout";
import type { PatronKind, PatronPose } from "./patronSprites";

// ---- where things stand (hall coordinates; feet position for characters) ----
export const HEARTH_RUG: Rect = { x: 44, y: 56, w: 32, h: 15 };
export const CARD_TABLE: Rect = { x: 61, y: 148, w: 16, h: 10 };
export const DOG_POS: Pt = { x: -60, y: 166 };
export const MOUSE_HOLE_A: Pt = { x: 42, y: 58 };
export const MOUSE_HOLE_B: Pt = { x: 76, y: 58 };
export const WINDOW: Rect = { x: -11, y: 6, w: 14, h: 24 };
export const BANNER_POSTS: Pt[] = [
  { x: 36, y: 88 },
  { x: 84, y: 88 },
];
export const PLANT_SPOTS: Pt[] = [
  { x: 42, y: 112 },
  { x: -82, y: 156 },
];
/** cat resting / walking nodes: a line of safe spots, every leg between neighbours is clear of furniture */
export const CAT_NODES: readonly Pt[] = [
  { x: 48, y: 68 },
  { x: 52, y: 96 },
  { x: 50, y: 136 },
  { x: 60, y: 168 },
  { x: 88, y: 170 },
];
export const CAT_NAP = 0;
export const CAT_HIDE = 3;

export interface PatronSpot extends Pt {
  kind: PatronKind;
  face: 1 | -1;
}
export const PATRON_SPOTS: readonly PatronSpot[] = [
  { kind: "traveller", x: 60, y: 73, face: 1 },
  { kind: "dwarf", x: 54, y: 160, face: 1 },
  { kind: "merchant", x: 84, y: 160, face: -1 },
];

// ---- timing ----
const CAT_WALK_SPEED = 17;
const CAT_CHASE_SPEED = 46;
const MOUSE_SPEED = 30;
const NAP_MIN_S = 18;
const NAP_MAX_S = 45;
const SIT_MIN_S = 3;
const SIT_MAX_S = 8;
const WANDER_CHANCE = 0.7;
const MOUSE_GAP_MIN_S = 30;
const MOUSE_GAP_MAX_S = 75;
const CHASE_CHANCE = 0.8;
const POUNCE_S = 1.2;
const SCARED_CLEAR_S = 2.5;
const DOG_ALERT_R = 38;
const DOG_HOLD_S = 1.6;
const SIP_GAP_MIN_S = 5;
const SIP_GAP_MAX_S = 14;
const SIP_S = 1.6;
const TOAST_S = 2.6;
const TOAST_STAGGER_S = 0.28;
const NIGHT_FROM_H = 19;
const NIGHT_TO_H = 5;
const CANDLE_DIM = 0.3;
const CANDLE_RATE = 0.6;

export type CatMode = "nap" | "sit" | "walk" | "chase" | "scared";
export interface Cat {
  x: number;
  y: number;
  face: 1 | -1;
  mode: CatMode;
  /** the cat sleeps deeply (quiet night): render adds the Zzz */
  asleep: boolean;
  path: Pt[];
  until: number;
  node: number;
}
export interface Mouse {
  visible: boolean;
  x: number;
  y: number;
  face: 1 | -1;
  until: number;
}
export interface Dog {
  awake: boolean;
  until: number;
}
export interface Patron {
  kind: PatronKind;
  x: number;
  y: number;
  face: 1 | -1;
  pose: PatronPose;
  /** when the current sip ends / next sip starts */
  until: number;
}

export interface HallInput {
  dt: number;
  /** wall-clock hour 0..24 */
  hour: number;
  reduced: boolean;
  /** a boss is out in the wilderness */
  bossOut: boolean;
  /** at least one adventurer is in the guild */
  busy: boolean;
  /** everybody walking or standing on the field (anything with x, y) */
  walkers: readonly Pt[];
}

export const isNight = (hour: number): boolean => hour >= NIGHT_FROM_H || hour < NIGHT_TO_H;

/** the sky colours seen through the hall window: [top, bottom] at that hour */
const WINDOW_SKY: readonly [number, string, string][] = [
  [0, "#0b1030", "#1f2c63"],
  [5, "#0b1030", "#1f2c63"],
  [6.5, "#6a6fb5", "#ffb27a"],
  [8, "#59b0ee", "#bfe8ff"],
  [16.5, "#59b0ee", "#bfe8ff"],
  [18, "#4f4a94", "#ff8f5c"],
  [19.5, "#0b1030", "#1f2c63"],
  [24, "#0b1030", "#1f2c63"],
];
const HEX = 16;
const lerpHex = (from: string, to: string, amount: number): string => {
  const channel = (color: string, i: number) => parseInt(color.slice(1 + i * 2, 3 + i * 2), HEX);
  return (
    "#" +
    [0, 1, 2]
      .map((i) =>
        Math.round(channel(from, i) + (channel(to, i) - channel(from, i)) * amount)
          .toString(HEX)
          .padStart(2, "0"),
      )
      .join("")
  );
};
export const windowSky = (hour: number): [string, string] => {
  for (let i = 1; i < WINDOW_SKY.length; i++) {
    const before = WINDOW_SKY[i - 1],
      after = WINDOW_SKY[i];
    if (hour <= after[0]) {
      const amount = (hour - before[0]) / (after[0] - before[0] || 1);
      return [lerpHex(before[1], after[1], amount), lerpHex(before[2], after[2], amount)];
    }
  }
  return [WINDOW_SKY[0][1], WINDOW_SKY[0][2]];
};

/** is a point inside a rectangle grown by `margin` */
export const inRect = (point: Pt, box: Rect, margin = 0): boolean =>
  point.x >= box.x - margin &&
  point.x <= box.x + box.w + margin &&
  point.y >= box.y - margin &&
  point.y <= box.y + box.h + margin;

/** furniture nothing may stand in or walk through (the hall's own, plus what this module places) */
export const HALL_BLOCKS: readonly Rect[] = [
  COUNTER_BOX,
  FEAST_TABLE,
  FEAST_BLOCK,
  SERVING_COUNTER,
  BAR,
  HEARTH,
  KITCHEN_HEARTH,
  CARD_TABLE,
];

export class HallLife {
  readonly cat: Cat;
  readonly dog: Dog = { awake: false, until: 0 };
  readonly mouse: Mouse = { visible: false, x: MOUSE_HOLE_A.x, y: MOUSE_HOLE_A.y, face: 1, until: 0 };
  readonly patrons: Patron[];
  /** 0..1 how bright the candles burn (dims on a quiet night) */
  candle = 1;
  /** the guild is empty and it is night: candles low, animals asleep */
  quiet = false;
  /** hall time in seconds (advances with update) */
  elapsed = 0;
  private toastAt = -Infinity;
  private fleeing = false;
  private homeFirst = false;
  private bossGoneAt = -Infinity;
  private readonly rand: () => number;

  constructor(rand: () => number = Math.random) {
    this.rand = rand;
    this.cat = {
      x: CAT_NODES[CAT_NAP].x,
      y: CAT_NODES[CAT_NAP].y,
      face: 1,
      mode: "nap",
      asleep: false,
      path: [],
      until: this.between(NAP_MIN_S, NAP_MAX_S),
      node: CAT_NAP,
    };
    this.patrons = PATRON_SPOTS.map((spot, i) => ({
      kind: spot.kind,
      x: spot.x,
      y: spot.y,
      face: spot.face,
      pose: "idle",
      until: this.between(SIP_GAP_MIN_S, SIP_GAP_MAX_S) + i,
    }));
    this.mouse.until = this.between(MOUSE_GAP_MIN_S, MOUSE_GAP_MAX_S);
  }

  private between(low: number, high: number): number {
    return low + (high - low) * this.rand();
  }

  reset() {
    this.elapsed = 0;
    this.toastAt = -Infinity;
    this.bossGoneAt = -Infinity;
    this.fleeing = false;
    this.homeFirst = false;
    this.candle = 1;
    this.quiet = false;
    this.dog.awake = false;
    this.dog.until = 0;
    this.mouse.visible = false;
    this.mouse.until = this.between(MOUSE_GAP_MIN_S, MOUSE_GAP_MAX_S);
    this.cat.x = CAT_NODES[CAT_NAP].x;
    this.cat.y = CAT_NODES[CAT_NAP].y;
    this.cat.mode = "nap";
    this.cat.asleep = false;
    this.cat.path = [];
    this.cat.node = CAT_NAP;
    this.cat.until = this.between(NAP_MIN_S, NAP_MAX_S);
    for (const patron of this.patrons) {
      patron.pose = "idle";
      patron.until = this.between(SIP_GAP_MIN_S, SIP_GAP_MAX_S);
    }
  }

  /** a quest was handed in (a receipt closed "done"): everyone raises a mug for a moment */
  toast() {
    this.toastAt = this.elapsed;
  }

  update(input: HallInput) {
    const { dt, reduced } = input;
    this.elapsed += dt;
    this.quiet = !input.busy && isNight(input.hour);
    if (input.bossOut) this.bossGoneAt = this.elapsed;
    this.updateCandle(dt);
    if (reduced) {
      this.settle();
      return;
    }
    this.updateDog(input);
    this.updatePatrons(input.bossOut);
    this.updateMouse(dt, input.bossOut);
    this.updateCat(dt, input.bossOut);
  }

  /** reduced motion: static poses, the cat curled up at the hearth, no mouse, no walking */
  private settle() {
    const cat = this.cat;
    cat.x = CAT_NODES[CAT_NAP].x;
    cat.y = CAT_NODES[CAT_NAP].y;
    cat.mode = "nap";
    cat.path = [];
    cat.node = CAT_NAP;
    cat.asleep = this.quiet;
    this.mouse.visible = false;
    this.dog.awake = false;
    for (const patron of this.patrons) patron.pose = "idle";
  }

  private updateCandle(dt: number) {
    const target = this.quiet ? CANDLE_DIM : 1;
    const step = CANDLE_RATE * dt;
    this.candle =
      Math.abs(target - this.candle) <= step ? target : this.candle + Math.sign(target - this.candle) * step;
  }

  private updateDog(input: HallInput) {
    const near = input.walkers.some((walker) => Math.hypot(walker.x - DOG_POS.x, walker.y - DOG_POS.y) < DOG_ALERT_R);
    if (near || input.bossOut) this.dog.until = this.elapsed + DOG_HOLD_S;
    this.dog.awake = this.elapsed < this.dog.until;
  }

  private updatePatrons(bossOut: boolean) {
    this.patrons.forEach((patron, i) => {
      const toastStart = this.toastAt + i * TOAST_STAGGER_S;
      if (bossOut) {
        patron.pose = "alert";
      } else if (this.elapsed >= toastStart && this.elapsed < toastStart + TOAST_S) {
        patron.pose = "toast";
      } else if (patron.pose === "alert" || patron.pose === "toast") {
        patron.pose = "idle";
        patron.until = this.elapsed + this.between(SIP_GAP_MIN_S, SIP_GAP_MAX_S);
      } else if (this.elapsed >= patron.until) {
        if (patron.pose === "sip") {
          patron.pose = "idle";
          patron.until = this.elapsed + this.between(SIP_GAP_MIN_S, SIP_GAP_MAX_S);
        } else {
          patron.pose = "sip";
          patron.until = this.elapsed + SIP_S;
        }
      }
    });
  }

  private updateMouse(dt: number, bossOut: boolean) {
    const mouse = this.mouse;
    if (!mouse.visible) {
      if (this.elapsed < mouse.until || this.quiet || bossOut) return;
      mouse.visible = true;
      mouse.x = MOUSE_HOLE_A.x;
      mouse.y = MOUSE_HOLE_A.y;
      mouse.face = 1;
      const cat = this.cat;
      if (cat.node === CAT_NAP && (cat.mode === "nap" || cat.mode === "sit") && this.rand() < CHASE_CHANCE) {
        cat.mode = "chase";
        cat.asleep = false;
        cat.path = [];
      }
      return;
    }
    mouse.x += MOUSE_SPEED * dt;
    if (mouse.x >= MOUSE_HOLE_B.x) {
      mouse.x = MOUSE_HOLE_B.x;
      mouse.visible = false;
      mouse.until = this.elapsed + this.between(MOUSE_GAP_MIN_S, MOUSE_GAP_MAX_S);
    }
  }

  private setCatPath(toNode: number) {
    const cat = this.cat;
    const from = cat.node < 0 ? CAT_NAP : cat.node;
    const step = toNode > from ? 1 : -1;
    const path: Pt[] = [];
    if (toNode !== from) {
      for (let at = from + step; ; at += step) {
        path.push({ ...CAT_NODES[at] });
        if (at === toNode) break;
      }
    } else path.push({ ...CAT_NODES[toNode] });
    cat.path = path;
    cat.mode = "walk";
  }

  private rest(mode: CatMode, seconds: number) {
    const cat = this.cat;
    cat.mode = mode;
    cat.path = [];
    cat.until = this.elapsed + seconds;
  }

  /** move along cat.path; true once it is empty */
  private walkCat(dt: number, speed: number): boolean {
    const cat = this.cat;
    let remaining = speed * dt;
    while (remaining > 0 && cat.path.length) {
      const target = cat.path[0];
      const dx = target.x - cat.x,
        dy = target.y - cat.y;
      const dist = Math.hypot(dx, dy);
      if (Math.abs(dx) > 0.01) cat.face = dx > 0 ? 1 : -1;
      if (dist <= remaining) {
        cat.x = target.x;
        cat.y = target.y;
        remaining -= dist;
        cat.path.shift();
        cat.node = CAT_NODES.findIndex((node) => node.x === target.x && node.y === target.y);
      } else {
        cat.x += (dx / dist) * remaining;
        cat.y += (dy / dist) * remaining;
        remaining = 0;
      }
    }
    return cat.path.length === 0;
  }

  private updateCat(dt: number, bossOut: boolean) {
    const cat = this.cat;
    if (bossOut) {
      // runs to the hiding spot and stays crouched with its fur up
      cat.asleep = false;
      if (cat.mode === "scared") return;
      if (!this.fleeing) {
        this.fleeing = true;
        this.setCatPath(CAT_HIDE);
      }
      if (this.walkCat(dt, CAT_CHASE_SPEED)) this.rest("scared", SCARED_CLEAR_S);
      return;
    }
    if (this.fleeing) {
      if (cat.mode === "walk" && !this.walkCat(dt, CAT_CHASE_SPEED)) return;
      if (cat.mode === "walk") this.rest("scared", SCARED_CLEAR_S);
      if (this.elapsed - this.bossGoneAt < SCARED_CLEAR_S) return;
      this.fleeing = false;
      this.rest("sit", this.between(SIT_MIN_S, SIT_MAX_S));
      return;
    }
    if (cat.mode === "chase") {
      this.chaseMouse(dt);
      return;
    }
    if (this.quiet) {
      // quiet night: curl up at the hearth for good
      if (cat.node === CAT_NAP && cat.mode !== "walk") {
        cat.mode = "nap";
        cat.asleep = true;
        cat.until = this.elapsed + NAP_MAX_S;
        return;
      }
      if (cat.mode !== "walk") this.setCatPath(CAT_NAP);
    } else cat.asleep = false;
    if (cat.mode === "walk") {
      if (this.walkCat(dt, CAT_WALK_SPEED)) this.rest(cat.node === CAT_NAP ? "nap" : "sit", this.restFor(cat.node));
      return;
    }
    if (this.elapsed < cat.until) return;
    if (this.homeFirst) {
      // after a chase: trot back to the hearth rug before anything else
      this.homeFirst = false;
      this.setCatPath(CAT_NAP);
      return;
    }
    // done resting: wander to another node, or curl up at the hearth
    if (cat.mode === "nap" || this.rand() < WANDER_CHANCE) {
      let target = Math.floor(this.rand() * CAT_NODES.length);
      if (target === cat.node) target = (target + 1) % CAT_NODES.length;
      this.setCatPath(target);
    } else this.setCatPath(CAT_NAP);
  }

  private restFor(node: number): number {
    return node === CAT_NAP ? this.between(NAP_MIN_S, NAP_MAX_S) : this.between(SIT_MIN_S, SIT_MAX_S);
  }

  /** run after the mouse, then sit and stare at its hole */
  private chaseMouse(dt: number) {
    const cat = this.cat;
    const mouse = this.mouse;
    const goal = mouse.visible ? { x: mouse.x - 6, y: mouse.y + 3 } : { x: MOUSE_HOLE_B.x - 7, y: MOUSE_HOLE_B.y + 3 };
    const dx = goal.x - cat.x,
      dy = goal.y - cat.y;
    const dist = Math.hypot(dx, dy);
    if (Math.abs(dx) > 0.01) cat.face = dx > 0 ? 1 : -1;
    const step = CAT_CHASE_SPEED * dt;
    if (dist > step) {
      cat.x += (dx / dist) * step;
      cat.y += (dy / dist) * step;
      return;
    }
    cat.x = goal.x;
    cat.y = goal.y;
    if (mouse.visible) return;
    cat.face = 1;
    cat.node = CAT_NAP;
    this.homeFirst = true;
    this.rest("sit", POUNCE_S);
  }
}
