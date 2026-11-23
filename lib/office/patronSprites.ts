// The hall's regulars (not Claude sessions): a hooded traveller with a lantern staff, a red-braided dwarf in a horned
// helm, and a plump merchant in a feathered hat with a pack on his back. Each is seated, drawn facing RIGHT (render
// mirrors the merchant), built from rect/dot calls, outlined and cached. Every colour is opaque.

import { Bitmap, cachedBitmap, wrapFrame } from "./bitmap";

export const PATRON_W = 16;
export const PATRON_H = 24;
const PAD = 1;
const AREA_W = PATRON_W - PAD * 2;
const AREA_H = PATRON_H - PAD * 2;

export type PatronKind = "traveller" | "dwarf" | "merchant";
export type PatronPose = "idle" | "sip" | "toast" | "alert";
export const PATRON_KINDS: readonly PatronKind[] = ["traveller", "dwarf", "merchant"];
export const PATRON_POSES: readonly PatronPose[] = ["idle", "sip", "toast", "alert"];
export const PATRON_FRAMES = 2;

const COLORS: Record<string, string> = {
  // traveller
  C: "#4f5a7a",
  c: "#6f7ca3",
  D: "#343c58",
  S: "#1c1a2a",
  e: "#f6e7a0",
  n: "#7a5a3a",
  T: "#4fd6c8",
  // shared skin, mugs, boots
  k: "#d9a77c",
  K: "#b8845c",
  x: "#cfd6e0",
  X: "#8793a6",
  w: "#fff6d0",
  m: "#3a2a20",
  E: "#1a1c2c",
  y: "#f2c14e",
  // dwarf
  I: "#9aa4b2",
  V: "#d9e0ea",
  J: "#6a7486",
  h: "#f1ead8",
  R: "#c4452e",
  r: "#e8693f",
  Q: "#8a2a1a",
  v: "#d9726f",
  s: "#8a5430",
  u: "#5e3a20",
  z: "#2e1c10",
  b: "#d8c8a0",
  A: "#d95763",
  a: "#7a5a3a",
  // merchant
  H: "#7a4a2a",
  L: "#9a6a3a",
  f: "#d95763",
  g: "#3f7a58",
  G: "#5fa573",
  d: "#2c5a40",
  M: "#4a3426",
  p: "#b9814f",
  P: "#8a5430",
  W: "#e6e1d2",
};

const cache = new Map<string, HTMLCanvasElement>();

const mug = (bmp: Bitmap, x0: number, y0: number) => {
  bmp.rect(x0, y0, x0 + 2, y0 + 2, "x");
  bmp.rect(x0, y0, x0 + 2, y0, "w");
  bmp.dot(x0 + 3, y0 + 1, "X");
};

const drawTraveller = (bmp: Bitmap, pose: PatronPose, frame: number) => {
  const bob = frame;
  // lantern staff behind the shoulder
  bmp.rect(12, 3, 12, 20, "n");
  bmp.rect(11, 0, 13, 2, "T");
  bmp.dot(12, 1, "w");
  // cloak
  bmp.rect(2, 9, 11, 19, "C");
  bmp.rect(1, 13, 12, 19, "C");
  bmp.rect(2, 9, 2, 18, "c");
  bmp.rect(11, 10, 12, 19, "D");
  for (const x of [2, 4, 6, 8, 10]) bmp.dot(x, 19, "D");
  // boots
  bmp.rect(3, 20, 5, 21, "m");
  bmp.rect(8, 20, 10, 21, "m");
  // hood: dark opening with two glinting eyes
  bmp.rect(3, 1 + bob, 9, 8, "C");
  bmp.rect(5, bob, 7, bob, "C");
  bmp.rect(4, 1 + bob, 8, 1 + bob, "c");
  bmp.rect(4, 3 + bob, 8, 7, "S");
  const eyeHeight = pose === "alert" ? 2 : 1;
  for (const x of [5, 7]) bmp.rect(x, 5 + bob - (eyeHeight - 1), x, 5 + bob, "e");
  bmp.rect(5, 7, 7, 7, "k");
  if (pose === "sip") {
    mug(bmp, 5, 8);
    bmp.dot(4, 9, "k");
    bmp.dot(8, 10, "k");
  } else if (pose === "toast") {
    bmp.rect(10, 8, 10, 12, "C");
    bmp.dot(11, 8, "k");
    mug(bmp, 10, 5);
    bmp.rect(5, 12, 7, 14, "x");
  } else if (pose === "alert") {
    bmp.rect(3, 9, 3, 12, "C");
    bmp.rect(9, 9, 9, 12, "C");
    bmp.dot(3, 8, "k");
    bmp.dot(9, 8, "k");
  } else {
    mug(bmp, 5, 12);
    bmp.rect(4, 13, 4, 14, "k");
    bmp.dot(8, 14, "k");
  }
};

const drawDwarf = (bmp: Bitmap, pose: PatronPose, frame: number) => {
  // sleeves, vest, belt, trousers, boots
  bmp.rect(1, 10, 12, 13, "b");
  bmp.rect(2, 10, 11, 17, "s");
  bmp.rect(1, 11, 2, 14, "b");
  bmp.rect(11, 11, 12, 14, "b");
  bmp.rect(3, 15, 10, 15, "z");
  bmp.dot(6, 15, "y");
  bmp.rect(3, 18, 10, 19, "u");
  bmp.rect(3, 20, 5, 21, "m");
  bmp.rect(8, 20, 10, 21, "m");
  // helm with horns and a nasal guard
  bmp.rect(3, 2, 10, 5, "I");
  bmp.rect(4, 2, 9, 2, "V");
  bmp.rect(9, 3, 10, 5, "J");
  bmp.rect(1, 2, 2, 3, "h");
  bmp.rect(11, 2, 12, 3, "h");
  bmp.dot(0, 1, "h");
  bmp.dot(13, 1, "h");
  bmp.rect(6, 5, 7, 6, "J");
  // face and the big red beard with two braids
  bmp.rect(4, 6, 9, 8, "k");
  bmp.dot(5, 6, "E");
  bmp.dot(8, 6, "E");
  bmp.rect(6, 7, 7, 7, "v");
  bmp.rect(3, 8, 10, 13, "R");
  bmp.rect(4, 8, 5, 12, "r");
  bmp.rect(6, 9, 7, 9, "Q");
  for (const x of [4, 9]) {
    bmp.rect(x, 14, x + 1, 16, "R");
    bmp.dot(x, 17, "y");
    bmp.dot(x + 1, 17, "y");
  }
  if (pose === "idle") {
    // a fan of cards, flipped every other beat
    const top = frame ? 9 : 10;
    bmp.rect(10, top, 12, top + 3, "w");
    bmp.dot(11, top + 1, "A");
    bmp.dot(10, top + 3, "A");
    bmp.dot(10, top + 4, "k");
  } else if (pose === "sip") {
    mug(bmp, 8, 8);
    bmp.dot(7, 10, "k");
  } else if (pose === "toast") {
    bmp.rect(10, 6, 11, 11, "b");
    bmp.dot(11, 6, "k");
    mug(bmp, 10, 3);
  } else {
    // grabs the axe
    bmp.rect(12, 4, 12, 17, "a");
    bmp.rect(10, 4, 11, 7, "I");
    bmp.rect(13, 4, 13, 6, "V");
    bmp.dot(12, 12, "k");
  }
};

const drawMerchant = (bmp: Bitmap, pose: PatronPose, frame: number) => {
  const bob = frame;
  // the pack on his back (left in this right-facing drawing): scroll and flask poking out
  bmp.rect(0, 9, 2, 17, "P");
  bmp.rect(0, 8, 1, 10, "u");
  bmp.rect(0, 6, 1, 8, "W");
  bmp.dot(2, 7, "T");
  // coat with a round belly, buttons and a coin purse
  bmp.rect(2, 10, 11, 17, "g");
  bmp.rect(1, 12, 12, 17, "g");
  bmp.rect(3, 11, 4, 15, "G");
  bmp.rect(10, 11, 12, 17, "d");
  for (const y of [11, 13, 15]) bmp.dot(6, y, "y");
  bmp.rect(9, 15, 11, 17, "p");
  bmp.dot(10, 15, "y");
  // trousers and boots
  bmp.rect(3, 18, 10, 19, "d");
  bmp.rect(3, 20, 5, 21, "m");
  bmp.rect(8, 20, 10, 21, "m");
  // face with a big curled moustache
  bmp.rect(4, 5 + bob, 9, 8, "k");
  bmp.dot(5, 6 + bob, "E");
  bmp.dot(8, 6 + bob, "E");
  bmp.rect(4, 8, 9, 8, "M");
  bmp.dot(3, 7, "M");
  bmp.dot(10, 7, "M");
  bmp.rect(5, 9, 8, 9, "k");
  // wide-brimmed hat with a feather
  bmp.rect(3, 1 + bob, 10, 3 + bob, "H");
  bmp.rect(4, 1 + bob, 8, 1 + bob, "L");
  bmp.rect(3, 3 + bob, 10, 3 + bob, "d");
  bmp.rect(0, 4 + bob, 13, 4 + bob, "H");
  bmp.rect(10, bob, 11, bob, "f");
  bmp.rect(11, 1 + bob, 12, 1 + bob, "f");
  if (pose === "idle") {
    const top = frame ? 10 : 11;
    bmp.rect(9, top, 11, top + 2, "w");
    bmp.dot(10, top + 1, "A");
    bmp.dot(9, top + 3, "k");
  } else if (pose === "sip") {
    mug(bmp, 8, 9);
    bmp.dot(7, 11, "k");
  } else if (pose === "toast") {
    bmp.rect(11, 8, 11, 12, "g");
    bmp.dot(12, 8, "k");
    mug(bmp, 11, 5);
  } else {
    bmp.rect(2, 9, 2, 12, "g");
    bmp.rect(11, 9, 11, 12, "g");
    bmp.dot(2, 8, "k");
    bmp.dot(11, 8, "k");
    bmp.dot(6, 9, "E");
  }
};

const DRAW: Record<PatronKind, (bmp: Bitmap, pose: PatronPose, frame: number) => void> = {
  traveller: drawTraveller,
  dwarf: drawDwarf,
  merchant: drawMerchant,
};

export const patronSprite = (kind: PatronKind, pose: PatronPose, frame: number): HTMLCanvasElement => {
  const index = wrapFrame(frame, PATRON_FRAMES);
  return cachedBitmap(
    cache,
    `${kind}|${pose}|${index}`,
    AREA_W,
    AREA_H,
    COLORS,
    (bmp) => DRAW[kind](bmp, pose, index),
    PAD,
  );
};
