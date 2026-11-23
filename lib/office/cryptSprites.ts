import { Grid, lighten, luma, mix } from "./sprites";

/**
 * Floor 2 (the flooded crypt) foes: four undead, 24x24, facing LEFT. Frames 0-1 are the idle pair, 2-3 the attack
 * pair. Feet / hem sit on row 22 (outline on row 23); ghosts hover and bob. Every colour is opaque #rrggbb:
 * wraith wisps are dithered pixels, never alpha. `hurt` is an opaque lighter variant with the outline kept.
 */
export const CRYPT_W = 24;
export const CRYPT_H = 24;
export const CRYPT_FRAMES = 4;
export const CRYPT_KINDS = ["wraith", "ghoul", "banshee", "revenant"] as const;
export type CryptKind = (typeof CRYPT_KINDS)[number];

const cache = new Map<string, HTMLCanvasElement>();
type Pt = [number, number];

const VOID = "#0a0e18";
const BONE = "#e6dcb8";
const BONE_SH = "#b4aa88";

const line = (grid: Grid, from: Pt, to: Pt, color: string) => {
  const steps = Math.max(Math.abs(to[0] - from[0]), Math.abs(to[1] - from[1]), 1);
  for (let i = 0; i <= steps; i++)
    grid.set(
      Math.round(from[0] + ((to[0] - from[0]) * i) / steps),
      Math.round(from[1] + ((to[1] - from[1]) * i) / steps),
      color,
    );
};
const blob = (
  grid: Grid,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  pick: (light: number, edge: number) => string | null,
) => {
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      const nx = (x + 0.5 - cx) / rx,
        ny = (y + 0.5 - cy) / ry;
      const edge = nx * nx + ny * ny;
      if (edge > 1) continue;
      const color = pick(-(nx * 0.6 + ny * 0.8), edge);
      if (color) grid.set(x, y, color);
    }
  }
};

// ---------------------------------------------------------------- wraith
const WRAITH_HOOD: Array<[number, number, number]> = [
  [1, 9, 13],
  [2, 8, 14],
  [3, 7, 15],
  [4, 6, 16],
  [5, 5, 16],
  [6, 5, 17],
  [7, 5, 17],
  [8, 5, 17],
  [9, 5, 18],
  [10, 4, 18],
  [11, 4, 19],
  [12, 4, 19],
  [13, 4, 19],
  [14, 4, 19],
  [15, 4, 19],
  [16, 3, 19],
];
const drawWraith = (grid: Grid, frame: number) => {
  const base = "#4a5a78",
    hi = "#7d8fb0",
    sh = "#2c3650",
    dk = "#1a2036";
  const eye = "#59f0ff",
    eyeHalo = "#1f8aa0";
  const attack = frame >= 2;
  grid.dy = [1, 0, 1, 1][frame];
  // chains trailing behind (drawn first so the cloak covers the anchor)
  const sway = [0, 1, 2, 1][frame];
  for (let i = 0; i < 7; i++) {
    const cx = 19 + Math.round((sway * i) / 3);
    grid.rect(cx, 12 + i * 1, cx, 12 + i * 1, i % 2 ? "#aeb8c8" : "#5c667a");
    if (i % 2 === 0) grid.set(cx + 1, 12 + i, "#5c667a");
  }
  grid.rect(20 + Math.round(sway / 2), 19, 22 + Math.round(sway / 2), 20, "#8d99ad"); // a heavy shackle ring
  grid.rect(21 + Math.round(sway / 2), 19, 21 + Math.round(sway / 2), 20, "#2c3650");
  // hooded cloak
  for (const [y, x0, x1] of WRAITH_HOOD) {
    for (let x = x0; x <= x1; x++) {
      let color = x < x0 + 3 ? hi : x > x1 - 4 ? sh : base;
      if (y > 10 && (x + y) % 6 === 0) color = sh;
      grid.set(x, y, color);
    }
  }
  // ragged dithered hem: opaque wisps getting sparser toward the tips
  for (let y = 17; y <= 21; y++) {
    const cut = y - 16;
    for (let x = 3; x <= 20; x++) {
      if ((x * 5 + y * 3 + frame * 2) % 7 < cut + 1) continue;
      grid.set(x, y, y > 19 ? dk : x < 8 ? hi : (x + y) % 3 === 0 ? sh : base);
    }
  }
  // face void in the hood, glowing eyes and fangs
  grid.rect(6, 4, 11, 8, VOID);
  grid.row(3, 8, 11, dk);
  grid.set(8, 5, eyeHalo);
  grid.set(10, 5, eyeHalo);
  grid.row(6, 7, 8, eye);
  grid.row(6, 10, 11, eye);
  grid.set(7, 6, "#e8ffff");
  grid.set(10, 6, "#e8ffff");
  grid.set(6, 4, hi);
  for (const x of [7, 9, 11]) grid.set(x, 8, "#cfeff0");
  if (attack) {
    grid.rect(7, 8, 10, 9, VOID);
    grid.set(7, 8, "#cfeff0");
    grid.set(9, 8, "#cfeff0");
    grid.set(8, 9, "#cfeff0");
    grid.set(10, 9, "#cfeff0");
  }
  // sleeves and bony claws: hanging when idle, reaching out when attacking
  if (attack) {
    const reach = frame === 2 ? 0 : 1;
    grid.rect(2 + reach, 10, 6, 12, base);
    grid.row(10, 2 + reach, 5, hi);
    grid.row(12, 3 + reach, 6, sh);
    for (const [cx, cy] of [
      [1 + reach, 9],
      [1 + reach, 11],
      [1 + reach, 13],
    ])
      grid.row(cy, cx, cx + 1, "#d8e8ec");
    grid.set(2 + reach, 10, "#d8e8ec");
    grid.set(2 + reach, 12, "#d8e8ec");
  } else {
    grid.rect(3, 11, 5, 14, base);
    grid.rect(3, 11, 3, 14, hi);
    grid.rect(5, 13, 5, 14, sh);
    grid.set(3, 15, "#d8e8ec");
    grid.set(4, 15, "#d8e8ec");
    grid.set(5, 15, "#d8e8ec");
    grid.set(3, 16, "#d8e8ec");
  }
  grid.dy = 0;
};

// ---------------------------------------------------------------- ghoul
const drawGhoul = (grid: Grid, frame: number) => {
  const skin = "#7d8f6a",
    skinHi = "#a3b58a",
    skinSh = "#56684c",
    skinDk = "#37452f";
  const attack = frame >= 2;
  const drool = [1, 2, 3, 2][frame];
  grid.dx = attack ? (frame === 2 ? -1 : 0) : 0;
  // rags
  grid.rect(8, 16, 15, 18, "#5c4630");
  grid.row(16, 8, 15, "#7a5e40");
  grid.row(18, 9, 12, "#3e2e20");
  grid.set(11, 19, "#5c4630");
  grid.set(14, 19, "#3e2e20");
  // legs (bent) and clawed feet
  grid.rect(8, 18, 9, 21, skinSh);
  grid.rect(14, 18, 15, 21, skinSh);
  grid.set(8, 18, skin);
  grid.set(14, 18, skin);
  grid.row(22, 5, 9, skinDk);
  grid.row(22, 12, 16, skinDk);
  for (const x of [5, 6, 12, 13]) grid.set(x, 22, "#e8e0c0");
  grid.dy = frame === 1 ? -1 : 0; // the upper body breathes; the feet stay planted
  // far arm (dark) hanging behind
  line(grid, [16, 11], [18, 19], skinDk);
  line(grid, [17, 11], [19, 19], skinSh);
  grid.set(19, 20, "#bfb48e");
  grid.set(18, 20, "#bfb48e");
  // hunched torso
  blob(grid, 12.5, 12, 7.5, 6, (lit, edge) => {
    if (edge > 0.8 && lit < 0) return skinDk;
    return lit > 0.45 ? skinHi : lit > -0.15 ? skin : skinSh;
  });
  // spine knobs along the back
  for (const [x, y] of [
    [13, 6],
    [16, 7],
    [18, 9],
    [19, 12],
  ] as Pt[]) {
    grid.set(x, y, BONE);
    grid.set(x + 1, y + 1, BONE_SH);
  }
  // exposed ribs on the belly
  grid.rect(8, 10, 13, 16, skinDk);
  for (const y of [10, 12, 14, 16]) grid.row(y, 8, 12, y === 16 ? BONE_SH : BONE);
  grid.rect(8, 10, 8, 16, BONE_SH);
  grid.set(10, 11, BONE_SH);
  grid.set(11, 13, BONE_SH);
  // head low on the shoulders
  blob(grid, 5.5, 10.5, 4, 3.5, (lit) => (lit > 0.4 ? skinHi : lit > -0.2 ? skin : skinSh));
  grid.set(8, 6, skinSh);
  grid.set(9, 5, skin);
  grid.set(9, 6, skin);
  grid.set(10, 4, skinSh);
  // glowing yellow eyes under a heavy brow
  grid.row(8, 3, 6, skinDk);
  grid.row(9, 2, 3, "#ffe14a");
  grid.row(9, 5, 6, "#ffe14a");
  grid.set(2, 9, "#fff6a0");
  grid.set(5, 9, "#fff6a0");
  grid.set(3, 10, "#3a2a00");
  grid.set(6, 10, "#3a2a00");
  // gaping jaw, fangs and drool
  const open = attack ? 3 : 2;
  grid.rect(2, 12, 6, 12 + open - 1, "#2a0e12");
  for (const x of [2, 4, 6]) grid.set(x, 12, "#f4eed0");
  for (const x of [3, 5]) grid.set(x, 12 + open - 1, "#f4eed0");
  for (let i = 0; i < drool; i++) grid.set(3, 12 + open + i, "#bfe8a8");
  grid.set(3, 12 + open + drool, "#e6ffd8");
  // long arm: dragging when idle, raised for a swipe when attacking
  if (attack) {
    const up = frame === 2 ? 0 : 3;
    line(grid, [9, 11], [4, 7 + up], skinSh);
    line(grid, [9, 12], [4, 8 + up], skin);
    line(grid, [4, 7 + up], [2, 4 + up], skinSh);
    for (const [cx, cy] of [
      [1, 3 + up],
      [0, 5 + up],
      [1, 7 + up],
    ] as Pt[])
      line(grid, [3, 6 + up], [cx, cy], "#f0e8c8");
  } else {
    line(grid, [9, 13], [5, 17], skinSh);
    line(grid, [9, 14], [5, 18], skin);
    line(grid, [5, 18], [3, 21], skinSh);
    grid.rect(2, 20, 4, 21, skin);
    for (const [cx, cy] of [
      [0, 20],
      [0, 22],
      [1, 22],
      [3, 22],
    ] as Pt[])
      grid.set(cx, cy, "#f0e8c8");
    grid.set(1, 21, "#f0e8c8");
  }
  grid.dx = 0;
  grid.dy = 0;
};

// ---------------------------------------------------------------- shared stamping
type Palette = Record<string, string>;
/** Stamp a small ASCII picture (one char per cell, "." or an unknown char = leave empty). */
const stamp = (grid: Grid, x0: number, y0: number, rows: string[], pal: Palette) => {
  rows.forEach((row, j) => {
    for (let i = 0; i < row.length; i++) {
      const color = pal[row[i]];
      if (color) grid.set(x0 + i, y0 + j, color);
    }
  });
};

// ---------------------------------------------------------------- banshee
const BANSHEE_PAL: Palette = {
  s: "#e8f0fa",
  S: "#a9b6d6",
  k: "#0d0a1c",
  c: "#5ff0ff",
  m: "#1a0a2a",
  T: "#f4f8ff",
  g: "#a9b8e6",
  w: "#d6defa",
  G: "#6a77b8",
  D: "#3b3f80",
};
const BANSHEE_HEAD_IDLE = [
  "..sssss..",
  ".sssssssS",
  ".kkssskkS",
  ".kcsSsckS",
  ".sSsssSS.",
  ".SmTmTmS.",
  ".SmmmmmS.",
  "..SmmmS..",
  "...sss...",
];
const BANSHEE_HEAD_ATTACK = [
  "..sssss..",
  ".sssssssS",
  ".kkssskkS",
  ".kcsSsckS",
  ".sSsssSS.",
  ".SmTmTmS.",
  "SmmmmmmmS",
  "SmmmmmmmS",
  ".SmmmmmS.",
  "..SsssS..",
  "...sss...",
];
const BANSHEE_GOWN = [
  "..wwgggGGD......",
  "..wggggggGD.....",
  "..wgggggggGD....",
  "...wgggggggGD...",
  "...wggggggggGDD.",
  "..wgggGggggggGD.",
  "..wggggGgggggGGD",
  ".wgggGgggGggggGD",
  ".wgggGgggGgggGGD",
  ".wgggGgggGggGGD.",
  ".wgggGgggGgGGGD.",
];
const BANSHEE_TATTERS = [
  [".wg..gG..gG..GD.", ".w....g....G..D."],
  [".wg.gG..gG..GGD.", ".w..g....G...D.."],
];
const drawBanshee = (grid: Grid, frame: number) => {
  const attack = frame >= 2;
  const hx = attack ? 8 : 6,
    hy = attack ? 2 : 1;
  const ox = attack ? 2 : 0;
  grid.dy = [1, 0, 0, 1][frame];
  // long flowing locks: solid ribbons (highlight / mid / dark inner band) streaming back and up, tapering to a point
  const hairHi = "#f4f6ff",
    hairMid = "#aab4ee",
    hairDk = "#5a5fb0";
  const ribbon = (x0: number, y0: number, x1: number, y1: number, phase: number, amp: number) => {
    for (let x = x0; x <= x1; x++) {
      const along = (x - x0) / (x1 - x0);
      const y = Math.round(y0 + (y1 - y0) * along + Math.sin(along * Math.PI * 1.4 + phase) * amp * along);
      if (along < 0.45) {
        grid.set(x, y - 1, hairHi);
        grid.set(x, y, hairMid);
        grid.set(x, y + 1, hairDk);
      } else if (along < 0.8) {
        grid.set(x, y, hairHi);
        grid.set(x, y + 1, hairDk);
      } else grid.set(x, y, hairMid);
    }
  };
  const phase = frame * 1.1;
  const ax = hx + 7;
  const reach = attack ? 22 : 23;
  ribbon(ax, hy + 7, reach - 2, hy + (attack ? 14 : 16), phase + 3, 1.2);
  ribbon(ax, hy + 5, reach, hy + (attack ? 9 : 10), phase + 2, 1.2);
  ribbon(ax, hy + 3, reach, hy + (attack ? 3 : 4), phase + 1, 1.2);
  ribbon(ax, hy + 1, reach - 2, hy - (attack ? 1 : 2) - 1, phase, 1.2);
  grid.rect(ax - 1, hy + 1, ax, hy + 8, hairMid); // the mass of hair behind the skull
  grid.rect(ax, hy + 1, ax, hy + 8, hairDk);
  // tattered gown ending in a few clean pointed tatters
  stamp(grid, 6 + ox, 10, BANSHEE_GOWN, BANSHEE_PAL);
  stamp(grid, 6 + ox, 21, [BANSHEE_TATTERS[frame % 2][0]], BANSHEE_PAL);
  grid.row(10, 9 + ox, 14 + ox, "#3b3f80"); // collar shadow
  // skull-like face
  stamp(grid, hx, hy, attack ? BANSHEE_HEAD_ATTACK : BANSHEE_HEAD_IDLE, BANSHEE_PAL);
  // thin clawed arms reaching forward
  const claw = (x: number, y: number, tips: Pt[]) => {
    for (const tip of tips) line(grid, [x, y], tip, "#ffffff");
  };
  if (attack) {
    const lift = frame === 3 ? 1 : 0;
    line(grid, [12, 12], [8, 16 - lift], "#a9b6d6");
    line(grid, [8, 16 - lift], [4, 17 - lift], "#e8f0fa");
    claw(4, 17 - lift, [
      [2, 15 - lift],
      [2, 19 - lift],
    ]);
    line(grid, [14, 12], [11, 18], "#6a77b8");
    line(grid, [11, 18], [8, 20], "#a9b6d6");
    // sound arcs: solid two-pixel bands leaving the mouth
    const cy = hy + 7;
    const arc = (cx: number, half: number, inner: string, outer: string) => {
      for (let k = -half; k <= half; k++) {
        const x = cx + Math.round((k * k) / (2 * half));
        grid.set(x, cy + k, inner);
        if (Math.abs(k) < half) grid.set(x - 1, cy + k, outer);
      }
    };
    arc(6, 2, "#e6fbff", "#8fd8ff");
    arc(3, 4, "#bff0ff", "#5fb8e8");
    if (frame === 3) arc(0, 6, "#8fd8ff", "#3f7cc0");
  } else {
    const up = frame === 0 ? 0 : 1;
    line(grid, [8, 11], [5, 14 - up], "#a9b6d6");
    line(grid, [5, 14 - up], [2, 12 - up], "#e8f0fa");
    claw(2, 12 - up, [
      [0, 10 - up],
      [0, 14 - up],
    ]);
    line(grid, [12, 12], [9, 16], "#6a77b8");
    line(grid, [9, 16], [6, 17], "#a9b6d6");
    claw(6, 17, [[4, 19]]);
  }
  grid.dy = 0;
};

// ---------------------------------------------------------------- revenant
const REV_PAL: Palette = {
  I: "#5c5c62",
  J: "#8c8e90",
  K: "#2e2a2c",
  R: "#8a4a2a",
  V: "#4fa08a",
  v: "#2e6a5c",
  B: "#e8e0c8",
  b: "#b8ae90",
  d: "#7a7258",
  k: "#0a0e18",
  t: "#1fb8b0",
  T: "#6ffff0",
  Z: "#f4eedc",
};
const REV_HELM = [
  "..JJJJJJ..",
  ".JJIIIIIK.",
  "JIIIVVIIIK",
  "KKKKKKKKKK",
  "IBkkBBkkBI",
  "IBtTbbTtBI",
  "IbBBkkBBbI",
  ".IZdZdZdI.",
  "..bBbbBb..",
  "...bBBb...",
];
const REV_TORSO = ["JJIbbbbIIK", ".IbBBBBbI.", ".IkbdbdkI.", ".IbBBBBbI.", "..kbdbdk..", "..bBBBBb..", ".KKKRRKKK."];
const drawRevenant = (grid: Grid, frame: number) => {
  const attack = frame >= 2;
  const cloak = "#2b2f4c",
    cloakHi = "#414a73",
    cloakDk = "#171a2e";
  const weed = "#2f6a3a",
    weedHi = "#4a9a52";
  const water = "#58e0f0";
  const sway = [0, 1, 0, -1][frame];
  // tattered dark cloak behind everything, ending in pointed tatters
  const cloakRows: Array<[number, number, number]> = [
    [10, 16, 18],
    [11, 15, 19],
    [12, 15, 20],
    [13, 15, 20],
    [14, 15, 21],
    [15, 15, 21],
    [16, 15, 22],
    [17, 15, 22],
    [18, 15, 22],
    [19, 15, 22],
    [20, 15, 22],
  ];
  for (const [y, x0, x1] of cloakRows) {
    for (let x = x0; x <= x1; x++)
      grid.set(x, y, x <= x0 + 1 ? cloakHi : x >= x1 - 1 || (x + y) % 5 === 0 ? cloakDk : cloak);
  }
  for (const [x, ys] of [
    [16, 21],
    [17, 22],
    [19, 21],
    [20, 22],
    [22, 21],
  ] as Pt[]) {
    grid.set(x + (sway > 0 && x > 18 ? 1 : 0), ys, x % 2 ? cloakDk : cloak);
    if (ys === 22) grid.set(x, 21, cloak);
  }
  // legs: bone thighs, corroded greaves, boots
  grid.row(18, 10, 11, BONE);
  grid.row(18, 14, 15, BONE);
  grid.row(18, 12, 13, BONE_SH);
  for (const x0 of [10, 14]) {
    grid.rect(x0, 19, x0 + 1, 21, REV_PAL.I);
    grid.rect(x0, 19, x0, 21, REV_PAL.J);
    grid.set(x0 + 1, 20, REV_PAL.V);
    grid.row(22, x0 - 1, x0 + 2, REV_PAL.K);
  }
  // upper body
  grid.dy = attack ? 0 : frame === 1 ? 1 : 0;
  grid.dx = frame === 3 ? -1 : 0;
  stamp(grid, 8, 11, REV_TORSO, REV_PAL);
  stamp(grid, 9, 13, ["IIVI", "IVII", "KIIK"], REV_PAL); // broken breastplate fragment
  stamp(grid, 15, 9, [".JJJ.", "JIIIK", "IIVIK", ".KKK."], REV_PAL); // pauldron
  // seaweed strands off the pauldron
  for (let i = 0; i < 5; i++) grid.set(18 + (i % 2 ? sway : 0), 13 + i, i % 2 ? weedHi : weed);
  // skeletal knight's head in a corroded open-faced helm
  stamp(grid, 8, 1, REV_HELM, REV_PAL);
  grid.set(10, 3, REV_PAL.v);
  // seaweed hanging off the helm
  for (let i = 0; i < 6; i++) grid.set(17 + (i % 2 ? sway : 0), 5 + i, i % 2 ? weedHi : weed);
  for (let i = 0; i < 4; i++) grid.set(7 - (i % 2 ? sway : 0), 4 + i, i % 2 ? weed : weedHi);
  // barnacled round shield (front)
  const cx = 4.5,
    cy = 15.5;
  blob(grid, cx, cy, 4.5, 5, (lit, edge) => {
    if (edge > 0.7) return REV_PAL.K;
    if (edge < 0.12) return REV_PAL.V;
    if (edge < 0.3) return REV_PAL.v;
    return lit > 0.3 ? "#8a9298" : (Math.floor(cx * 2) + Math.floor(lit * 4)) % 4 === 0 ? REV_PAL.V : "#6b7078";
  });
  for (const [x, y] of [
    [1, 13],
    [2, 19],
    [7, 12],
    [8, 17],
    [4, 20],
    [1, 16],
  ] as Pt[]) {
    grid.set(x, y, "#e4e6d8");
    grid.set(x + 1, y, "#9aa498");
  }
  // sword arm and a rusty notched blade
  const hand: Pt = attack ? (frame === 2 ? [17, 7] : [13, 12]) : [18, 11 + (frame ? 1 : 0)];
  const tip: Pt = attack ? (frame === 2 ? [22, 0] : [2, 21]) : [21, 1 + (frame ? 1 : 0)];
  line(grid, [16, 12], hand, BONE);
  line(grid, [hand[0], hand[1] - 1], tip, "#c4bcaa");
  line(grid, [hand[0] + 1, hand[1] - 1], [tip[0] + 1, tip[1]], "#7a5a44");
  const mid: Pt = [Math.round((hand[0] * 2 + tip[0]) / 3), Math.round((hand[1] * 2 + tip[1]) / 3)];
  grid.set(mid[0], mid[1], REV_PAL.K); // chips knocked out of the edge
  grid.set(Math.round((hand[0] + tip[0] * 2) / 3) + 1, Math.round((hand[1] + tip[1] * 2) / 3), REV_PAL.K);
  grid.row(hand[1], hand[0] - 1, hand[0] + 2, REV_PAL.R); // crossguard
  grid.set(hand[0], hand[1], BONE);
  // water dripping off the bones
  grid.set(16, 16 + frame, water);
  grid.set(4, 21 - (frame % 2), water);
  grid.set(11, 17 + (frame % 3), "#b8f4ff");
  grid.dx = 0;
  grid.dy = 0;
};

// ---------------------------------------------------------------- assembly
const hurtTone = (color: string): string =>
  luma(color) < 55 ? mix(color, "#ffffff", 0.2) : lighten(mix(color, "#ff6a6a", 0.25), 0.55);

const buildCrypt = (kind: CryptKind, frame: number, hurt: boolean): HTMLCanvasElement => {
  const grid = new Grid(CRYPT_W, CRYPT_H);
  if (kind === "wraith") drawWraith(grid, frame);
  else if (kind === "ghoul") drawGhoul(grid, frame);
  else if (kind === "banshee") drawBanshee(grid, frame);
  else drawRevenant(grid, frame);
  grid.outline();
  if (hurt) grid.recolorFill(hurtTone);
  return grid.toCanvas();
};

const normFrame = (frame: number): number => {
  const whole = Number.isFinite(frame) ? Math.floor(frame) : 0;
  return ((whole % CRYPT_FRAMES) + CRYPT_FRAMES) % CRYPT_FRAMES;
};

/** Crypt foe sprite, facing LEFT. Frames 0-1 idle, 2-3 attack. hurt=true is an opaque, lighter flash variant. */
export const cryptSprite = (kind: CryptKind, frame: number, hurt: boolean): HTMLCanvasElement => {
  const frameIdx = normFrame(frame);
  const key = `c|${kind}|${frameIdx}|${hurt ? 1 : 0}`;
  let sprite = cache.get(key);
  if (!sprite) {
    sprite = buildCrypt(kind, frameIdx, hurt);
    cache.set(key, sprite);
  }
  return sprite;
};
