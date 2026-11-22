// Hand-drawn sprites for the guild's NPCs (bard, chef, innkeeper). Each is its own character design,
// not a recoloured adventurer: ASCII pixel art stamped onto a 16x24 grid, outlined like the rest of the guild art.
// Every sprite is built once and cached; nothing here is translucent.

export const NPC_W = 16;
export const NPC_H = 24;

export type ChefPose = "walk" | "carry" | "hold" | "stir" | "idle";

const INK = "#14121f";

/** one letter per colour, shared by every NPC drawing below ('.' is empty) */
const COLORS: Record<string, string> = {
  k: "#f0c49a", // skin
  K: "#d49a72",
  L: "#ffe3c4", // skin highlight
  r: "#e8808a", // rosy cheek
  v: "#d9726f", // red nose
  E: "#2a1f3a", // eye
  M: "#8a3446", // mouth
  w: "#ffffff", // white linen
  W: "#e6e1d2",
  g: "#c9c2ae",
  c: "#f5efe0", // cream apron
  R: "#d95763", // red
  f: "#f4f1ea", // feather tip
  T: "#2fa7a0", // teal
  U: "#1f7a78",
  y: "#e8c04e", // gold
  Y: "#b88a2a",
  h: "#6b4a36", // brown hair / beard
  H: "#a8764a",
  m: "#4a3426", // chef moustache and boots
  G: "#d8d4cc", // grey tufts
  o: "#c8793a", // lute body
  O: "#8a4a22",
  q: "#e0954a",
  S: "#14121f", // sound hole
  n: "#6e4a36", // lute neck
  N: "#4a3426",
  B: "#6b4a36", // belt
  p: "#7a8aa8", // chef trousers
  A: "#3f7a58", // innkeeper apron
  a: "#2c5a40",
  t: "#b9814f", // wood
  d: "#8b5e3c",
  x: "#cfd6e0", // pewter mug
  X: "#8793a6",
};

const mixToInk = (color: string): string => {
  const rgb = parseInt(color.slice(1), 16);
  const ink = parseInt(INK.slice(1), 16);
  const blend = (shift: number) => {
    const base = (rgb >>> shift) & 255;
    const target = (ink >>> shift) & 255;
    return Math.round(base * 0.2 + target * 0.8)
      .toString(16)
      .padStart(2, "0");
  };
  return "#" + blend(16) + blend(8) + blend(0);
};

class Pixels {
  cells: (string | null)[] = new Array(NPC_W * NPC_H).fill(null);
  set(x: number, y: number, color: string) {
    if (x >= 0 && x < NPC_W && y >= 0 && y < NPC_H) this.cells[y * NPC_W + x] = color;
  }
  /** stamp ASCII art with its top-left corner at (x0, y0) */
  stamp(x0: number, y0: number, art: readonly string[]) {
    for (let j = 0; j < art.length; j++) {
      for (let i = 0; i < art[j].length; i++) {
        const color = COLORS[art[j][i]];
        if (color) this.set(x0 + i, y0 + j, color);
      }
    }
  }
  /** a single colour-letter pixel */
  dot(x: number, y: number, letter: string) {
    this.set(x, y, COLORS[letter]);
  }
  /** closed 1px outline, a dark shade of the neighbouring fill */
  outline() {
    const out = this.cells.slice();
    for (let y = 0; y < NPC_H; y++) {
      for (let x = 0; x < NPC_W; x++) {
        if (this.cells[y * NPC_W + x]) continue;
        let neighbour: string | null = null;
        for (let dy = -1; dy <= 1 && !neighbour; dy++) {
          for (let dx = -1; dx <= 1 && !neighbour; dx++) {
            const nx = x + dx,
              ny = y + dy;
            if ((dx || dy) && nx >= 0 && nx < NPC_W && ny >= 0 && ny < NPC_H) neighbour = this.cells[ny * NPC_W + nx];
          }
        }
        if (neighbour) out[y * NPC_W + x] = mixToInk(neighbour);
      }
    }
    this.cells = out;
  }
  toCanvas(): HTMLCanvasElement {
    const canvas = document.createElement("canvas");
    canvas.width = NPC_W;
    canvas.height = NPC_H;
    const ctx = canvas.getContext("2d");
    if (!ctx) return canvas;
    for (let y = 0; y < NPC_H; y++) {
      for (let x = 0; x < NPC_W; x++) {
        const color = this.cells[y * NPC_W + x];
        if (color) {
          ctx.fillStyle = color;
          ctx.fillRect(x, y, 1, 1);
        }
      }
    }
    return canvas;
  }
}

const cache = new Map<string, HTMLCanvasElement>();
const cached = (key: string, draw: (pixels: Pixels) => void): HTMLCanvasElement => {
  let sprite = cache.get(key);
  if (!sprite) {
    const pixels = new Pixels();
    draw(pixels);
    pixels.outline();
    sprite = pixels.toCanvas();
    cache.set(key, sprite);
  }
  return sprite;
};

const wrap = (frame: number, count: number): number => {
  const whole = Number.isFinite(frame) ? Math.floor(frame) : 0;
  return ((whole % count) + count) % count;
};

// ---------------------------------------------------------------- chef
const CHEF_HEAD = [
  ".....wwwwww.....",
  "...wwwwwwwwww...",
  "..wwwwwwwwwwww..",
  "..wwwwwwwwwwWW..",
  "...wwwwwwwwWW...",
  "....WWWWWWWW....",
  "....kkkkkkkk....",
  "....kEkkkkEk....",
  "....krkkkkrk....",
  "....mmmmmmmm....",
  ".....kkkkkk.....",
  "......kkkk......",
];
const CHEF_BODY = [
  "...wwwRRRRwww...",
  "...wwwgWWgwww...",
  "...WwwgWWgwwW...",
  "...WwwgWWgwwW...",
  "...WwwgWWgwwW...",
  "...WWWWWWWWWW...",
  "....cccccccc....",
  "....cgcccccc....",
];
const CHEF_LEGS = {
  stand: ["....pppppppp....", "....ppp..ppp....", "....mmmm.mmmm..."],
  liftRight: ["....pppppppp....", "....ppp.mmmm....", "....mmmm........"],
  liftLeft: ["....pppppppp....", "....mmmm.ppp....", "........mmmm...."],
};
const CHEF_ARM_L = ["Ww", "ww", "ww", "ww", "gg", "kk"];
const CHEF_ARM_R = ["wW", "ww", "ww", "ww", "gg", "kk"];
const CHEF_ARM_CARRY = ["wW", "wg", "kk"];
const CHEF_ARM_STIR = ["wW", "ww", "gk"];

const drawLadle = (pixels: Pixels, x: number, topY: number, length: number) => {
  for (let j = 0; j < length; j++) pixels.dot(x, topY + j, "t");
  pixels.dot(x, topY + length, "N");
  pixels.dot(x - 1, topY + length, "N");
  pixels.dot(x - 1, topY + length + 1, "N");
  pixels.dot(x, topY + length + 1, "N");
};

const WALK_LEGS = [CHEF_LEGS.liftRight, CHEF_LEGS.stand, CHEF_LEGS.liftLeft, CHEF_LEGS.stand];
const SWING = [-1, 0, 1, 0];
const STIR_HAND_Y = [0, -1, 0, 1];
const STIR_LADLE_X = [14, 13, 12, 13];

const drawChef = (pixels: Pixels, pose: ChefPose, frame: number) => {
  const walking = pose === "walk" || pose === "carry";
  const bob = walking && frame === 1 ? -1 : 0;
  const legs = walking ? WALK_LEGS[frame] : CHEF_LEGS.stand;
  pixels.stamp(0, 19, ["....pppppppp...."]);
  pixels.stamp(0, 20, legs);
  pixels.stamp(0, 12 + bob, CHEF_BODY);
  // left arm swings
  const swing = walking ? SWING[frame] : 0;
  pixels.stamp(1, 13 + bob + swing, CHEF_ARM_L);
  if (pose === "carry" || pose === "hold") {
    pixels.stamp(13, 13 + bob, CHEF_ARM_CARRY);
  } else if (pose === "stir") {
    const lift = STIR_HAND_Y[frame];
    pixels.stamp(13, 13 + lift, CHEF_ARM_STIR);
    drawLadle(pixels, STIR_LADLE_X[frame], 10 + lift, 7);
  } else {
    pixels.stamp(13, 13 + bob - swing, CHEF_ARM_R);
    drawLadle(pixels, 14, 14 + bob - swing, 5);
  }
  pixels.stamp(0, 1, CHEF_HEAD);
  if (pose === "idle" && frame === 1) {
    pixels.stamp(4, 8, ["kkkkkkkk"]);
    pixels.stamp(4, 9, ["krkkkkrk"]);
  }
};

const CHEF_FRAMES: Record<ChefPose, number> = { walk: 4, carry: 4, hold: 1, stir: 4, idle: 2 };

/** the guild chef: tall toque, white double-breasted jacket, moustache; walks (empty / carrying a plate), stirs at the hearth */
export const chefSprite = (pose: ChefPose, frame: number): HTMLCanvasElement => {
  const index = wrap(frame, CHEF_FRAMES[pose]);
  return cached(`chef|${pose}|${index}`, (pixels) => drawChef(pixels, pose, index));
};

// ---------------------------------------------------------------- bard
const BARD_CAP = [
  ".....TTTTT......",
  "...TTTTTTTTT....",
  "..TTTTTTTTTTT...",
  "..TTTTTTTTTTTT..",
  "...yyyyyyyyyy...",
  "...hkkkkkkkkh...",
  "...hkEkkkkEkh...",
  "...hkrkkkkrkh...",
  "....kkkMMkkk....",
  ".....kkhhkk.....",
  "......khhk......",
];
const BARD_BODY = [
  "...wWwWwWwWwW...",
  "...TTTTTyyyyy...",
  "...TTTTUYyyyy...",
  "...TTTTUYyyyy...",
  "...TTTTUYyyyy...",
  "...TTTTyyTTTT...",
  "..TTTTTTyyyyyy..",
];
const BARD_SEAT = ["..tttttttttttt..", "...d.yyyTTT.d...", "...d.yyyTTT.d...", "...dmmmm.mmmd..."];
const LUTE_BODY = ["..qqoo..", ".qqoooO.", "qooooooO", "qooSSooO", "qooSSooO", ".qooooO.", "..OOOO.."];
const LUTE_NECK: readonly (readonly [number, number])[] = [
  [9, 15],
  [10, 14],
  [11, 14],
  [12, 13],
  [13, 13],
  [14, 12],
];
const FEATHER_A: readonly (readonly [number, number, string])[] = [
  [13, 3, "R"],
  [14, 2, "R"],
  [14, 1, "f"],
];
const FEATHER_B: readonly (readonly [number, number, string])[] = [
  [13, 3, "R"],
  [13, 2, "R"],
  [14, 1, "f"],
];
const STRUM_Y = [17, 18, 19, 18];
const BARD_FRAMES = { playing: 4, resting: 2 };

const drawBard = (pixels: Pixels, playing: boolean, frame: number) => {
  const bob = playing && frame % 2 === 1 ? 1 : 0;
  pixels.stamp(0, 19, BARD_SEAT);
  pixels.stamp(0, 12, BARD_BODY);
  // the lute across the chest: body, then neck angled up to the right
  pixels.stamp(2, 14, LUTE_BODY);
  // left sleeve (puffy) and the strumming forearm
  pixels.stamp(1, 12, ["TTT", "TTT", "UTT"]);
  const handY = playing ? STRUM_Y[frame] : STRUM_Y[0];
  for (let row = 15; row < handY; row++) pixels.stamp(3, row, [row === handY - 1 ? "ww" : "TT"]);
  pixels.stamp(3, handY, ["kk", "kk"]);
  // right sleeve and the fretting hand on the neck
  pixels.stamp(12, 12, ["yyy", "yyY"]);
  for (const [x, y] of LUTE_NECK) pixels.dot(x, y, "n");
  pixels.dot(14, 11, "N");
  pixels.dot(14, 10, "N");
  pixels.dot(13, 10, "y");
  pixels.stamp(12, 14, ["kkw"]);
  // head last so a nod covers the collar
  pixels.stamp(0, 1 + bob, BARD_CAP);
  for (const [x, y, letter] of playing && frame >= 2 ? FEATHER_B : FEATHER_A) pixels.dot(x, y + bob, letter);
  if (!playing && frame === 1) {
    pixels.stamp(4, 7, ["hkkkkkkh"]);
    pixels.stamp(4, 8, ["kkrkkrkk"]);
  }
};

/** the bard on his stool: floppy feathered cap, split teal/gold doublet, lute across the chest */
export const bardSprite = (playing: boolean, frame: number): HTMLCanvasElement => {
  const index = wrap(frame, playing ? BARD_FRAMES.playing : BARD_FRAMES.resting);
  return cached(`bard|${playing ? "play" : "rest"}|${index}`, (pixels) => drawBard(pixels, playing, index));
};

// ---------------------------------------------------------------- innkeeper
const KEEPER_HEAD = [
  ".....kLLkkk.....",
  "....kkLkkkkk....",
  "...GkkkkkkkkG...",
  "...GkhhkkhhkG...",
  "...GkEkkkkEkG...",
  "....kkkvvkkk....",
  "....kkvvvvkk....",
  "...hhhhhhhhhh...",
  "...hhHhMMhHhh...",
  "...hhhhhhhhhh...",
  "....hhHhhHhh....",
  ".....hhhhhh.....",
];
const KEEPER_BODY = [
  "..wwwwwwwwwwww..",
  ".wwwwAwwwwAwwww.",
  ".wwwAAAAAAAAwww.",
  ".WWwAAAAAAAAwWW.",
  "..kkkkAAAAkkkk..",
  "....AAAAAAAA....",
  "....AAAAAAAA....",
  "....aaaaaaaa....",
];
const KEEPER_LEGS = ["....NNN..NNN....", "....NNN..NNN....", "...NNNN..NNNN..."];
const MUG = ["xxxx", "xxxX", "xxXX", "XXXX"];
const CLOTH_X = [6, 7, 8, 7];
const CLOTH_Y = [14, 14, 14, 15];

const drawKeeper = (pixels: Pixels, frame: number) => {
  pixels.stamp(0, 17, KEEPER_LEGS);
  pixels.stamp(0, 12, KEEPER_BODY);
  pixels.stamp(6, 13, MUG);
  pixels.dot(10, 14, "X");
  pixels.dot(10, 15, "X");
  // the cloth wipes across the mug
  pixels.stamp(CLOTH_X[frame], CLOTH_Y[frame], ["cc"]);
  const bob = frame === 3 ? 1 : 0;
  pixels.stamp(0, 1 + bob, KEEPER_HEAD);
};

/** the innkeeper behind the counter: bald, bushy beard, green apron, rolled sleeves, polishing a mug */
export const innkeeperSprite = (frame: number): HTMLCanvasElement => {
  const index = wrap(frame, CLOTH_X.length);
  return cached(`keeper|${index}`, (pixels) => drawKeeper(pixels, index));
};
