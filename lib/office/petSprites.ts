// The guild hall's animals: a ginger cat, a beagle that sleeps by the door and a mouse the cat chases. Each pose is
// drawn facing RIGHT (render mirrors it) from rect/dot calls on a tiny grid, outlined and cached. All colours opaque.

import { Bitmap, cachedBitmap, wrapFrame } from "./bitmap";

/** drawing area + 1px of outline room on every side */
const PAD = 1;
export const CAT_W = 16 + PAD * 2;
export const CAT_H = 12 + PAD * 2;
export const DOG_W = 20 + PAD * 2;
export const DOG_H = 12 + PAD * 2;
export const MOUSE_W = 6 + PAD * 2;
export const MOUSE_H = 4 + PAD * 2;

export type CatPose = "walk" | "sit" | "nap" | "chase" | "scared";
export type DogPose = "sleep" | "wag";

export const CAT_FRAMES: Record<CatPose, number> = { walk: 2, sit: 2, nap: 2, chase: 2, scared: 2 };
export const DOG_FRAMES: Record<DogPose, number> = { sleep: 2, wag: 2 };
export const MOUSE_FRAMES = 2;

const PET_COLORS: Record<string, string> = {
  o: "#e8933a", // ginger
  O: "#b4601f", // tabby stripe / tail
  L: "#f7c98b", // belly
  w: "#f7f1e3", // white socks, chest
  p: "#e8808a", // nose / tongue
  E: "#1a1c2c", // eye / dog nose
  G: "#7fe08a", // cat eye
  b: "#a8693a", // beagle brown
  B: "#6e3f20", // beagle ear
  m: "#9aa0aa", // mouse
  M: "#6f7580",
};

const catCache = new Map<string, HTMLCanvasElement>();
const dogCache = new Map<string, HTMLCanvasElement>();
const mouseCache = new Map<string, HTMLCanvasElement>();

const drawCatHead = (bmp: Bitmap, x0: number, y0: number) => {
  bmp.rect(x0, y0 + 1, x0 + 3, y0 + 4, "o");
  bmp.dot(x0, y0, "O");
  bmp.dot(x0 + 3, y0, "O");
  bmp.dot(x0 + 2, y0 + 2, "G");
  bmp.dot(x0 + 3, y0 + 3, "p");
  bmp.dot(x0 + 2, y0 + 4, "w");
};

const drawCat = (bmp: Bitmap, pose: CatPose, frame: number) => {
  if (pose === "walk") {
    bmp.rect(3, 4, 11, 7, "o");
    bmp.rect(4, 7, 10, 7, "L");
    for (const x of [5, 7, 9]) bmp.dot(x, 4, "O");
    drawCatHead(bmp, 11, 2);
    const tail: [number, number][] = frame
      ? [
          [2, 3],
          [1, 2],
          [1, 1],
          [2, 0],
        ]
      : [
          [2, 4],
          [1, 3],
          [1, 2],
          [1, 1],
        ];
    for (const [x, y] of tail) bmp.dot(x, y, "O");
    for (const x of frame ? [4, 6, 8, 10] : [3, 5, 9, 11]) {
      bmp.rect(x, 8, x, 9, "o");
      bmp.dot(x, 10, "w");
    }
  } else if (pose === "sit") {
    bmp.rect(3, 5, 8, 10, "o");
    bmp.rect(8, 6, 9, 10, "w");
    for (const y of [6, 8]) bmp.dot(4, y, "O");
    drawCatHead(bmp, 8, 1);
    bmp.rect(9, 10, 10, 10, "w");
    bmp.rect(3, 10, 5, 10, "w");
    if (frame) bmp.rect(0, 8, 2, 9, "O");
    else bmp.rect(0, 9, 2, 10, "O");
  } else if (pose === "nap") {
    const top = frame ? 5 : 6;
    bmp.rect(2, top, 12, 9, "o");
    bmp.dot(2, top, ".");
    bmp.dot(12, top, ".");
    bmp.rect(2, 9, 9, 9, "O");
    for (const x of [4, 6, 8]) bmp.dot(x, top, "O");
    bmp.rect(10, 5, 13, 8, "o");
    bmp.dot(10, 4, "O");
    bmp.dot(13, 4, "O");
    bmp.dot(12, 6, "O");
    bmp.dot(13, 7, "p");
  } else if (pose === "chase") {
    bmp.rect(2, 5, 10, 7, "o");
    bmp.rect(3, 7, 9, 7, "L");
    for (const x of [4, 6, 8]) bmp.dot(x, 5, "O");
    drawCatHead(bmp, 11, 3);
    bmp.rect(0, 3, 1, 4, "O");
    if (frame) bmp.rect(5, 8, 8, 8, "o");
    else {
      bmp.rect(11, 8, 13, 8, "o");
      bmp.rect(0, 8, 2, 8, "o");
    }
    bmp.dot(frame ? 5 : 13, 9, "w");
  } else {
    // scared: arched back, puffed tail, flat ears, wide eyes
    bmp.rect(4, 3, 10, 7, "o");
    bmp.rect(3, 5, 11, 8, "o");
    for (const x of frame ? [5, 7, 9] : [6, 8]) bmp.dot(x, 2, "O");
    bmp.rect(10, 5, 13, 8, "o");
    bmp.dot(10, 4, "O");
    bmp.dot(12, 4, "O");
    bmp.dot(12, 6, "G");
    bmp.dot(13, 7, "p");
    bmp.rect(1, 1, 2, 6, "O");
    if (frame) bmp.dot(0, 3, "O");
    bmp.rect(3, 9, 4, 10, "w");
    bmp.rect(10, 9, 11, 10, "w");
  }
};

const drawDog = (bmp: Bitmap, pose: DogPose, frame: number) => {
  if (pose === "sleep") {
    const top = frame ? 4 : 5;
    bmp.rect(2, top, 15, 9, "b");
    bmp.dot(2, top, ".");
    bmp.rect(5, 8, 11, 9, "w");
    bmp.rect(7, top, 9, top + 1, "B");
    bmp.rect(14, 6, 18, 9, "b");
    bmp.rect(13, 6, 14, 9, "B");
    bmp.rect(17, 8, 19, 9, "w");
    bmp.dot(19, 8, "E");
    bmp.dot(16, 7, "E");
    bmp.rect(15, 9, 18, 10, "w");
    bmp.rect(0, 6, 2, 7, "b");
  } else {
    // awake, head up, tail thumping
    bmp.rect(2, 6, 13, 10, "b");
    bmp.rect(5, 9, 10, 10, "w");
    bmp.rect(6, 6, 8, 7, "B");
    bmp.rect(13, 3, 17, 7, "b");
    bmp.rect(12, 3, 13, 6, "B");
    bmp.rect(17, 5, 19, 7, "w");
    bmp.dot(19, 5, "E");
    bmp.dot(16, 4, "E");
    bmp.dot(18, 8, "p");
    bmp.rect(12, 10, 17, 10, "w");
    if (frame) bmp.rect(0, 3, 1, 5, "b");
    else bmp.rect(0, 7, 1, 9, "b");
  }
};

const drawMouse = (bmp: Bitmap, frame: number) => {
  bmp.rect(1, 1, 4, 2, "m");
  bmp.dot(4, 0, "m");
  bmp.dot(5, 2, "p");
  bmp.dot(0, 2, "p");
  bmp.dot(0, 3, "p");
  for (const x of frame ? [1, 3] : [2, 4]) bmp.dot(x, 3, "M");
};

export const catSprite = (pose: CatPose, frame: number): HTMLCanvasElement => {
  const index = wrapFrame(frame, CAT_FRAMES[pose]);
  return cachedBitmap(
    catCache,
    `${pose}|${index}`,
    CAT_W - PAD * 2,
    CAT_H - PAD * 2,
    PET_COLORS,
    (bmp) => drawCat(bmp, pose, index),
    PAD,
  );
};

export const dogSprite = (pose: DogPose, frame: number): HTMLCanvasElement => {
  const index = wrapFrame(frame, DOG_FRAMES[pose]);
  return cachedBitmap(
    dogCache,
    `${pose}|${index}`,
    DOG_W - PAD * 2,
    DOG_H - PAD * 2,
    PET_COLORS,
    (bmp) => drawDog(bmp, pose, index),
    PAD,
  );
};

export const mouseSprite = (frame: number): HTMLCanvasElement => {
  const index = wrapFrame(frame, MOUSE_FRAMES);
  return cachedBitmap(
    mouseCache,
    `${index}`,
    MOUSE_W - PAD * 2,
    MOUSE_H - PAD * 2,
    PET_COLORS,
    (bmp) => drawMouse(bmp, index),
    PAD,
  );
};
