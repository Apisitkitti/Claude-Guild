/**
 * The colossus's hand-made art at the colossus's own scale (not a 2.5x upscale of the 160x128 true form): wings of
 * layered feathers, a tattered robe, pauldrons, the chest-eye socket and thorn ring are painted straight at big-pixel
 * resolution with ordered-dither shading; the FACE (hood, mask, void half, crown flames) and the EYE are separate
 * cached overlays so the mask can split open (roar) and the eye can squint and crack (hits). Every colour is an opaque
 * #rrggbb. All coordinates below are "painted units" (the 160x128 true form) multiplied by the scale `scale`.
 */
import { Grid, lighten, mix } from "./sprites";
import { COLOSSUS_PAINT_CHEST_X, COLOSSUS_PAINT_CHEST_Y, COLOSSUS_SCALES, SQUINT_LEVELS } from "./voidVisualLogic";

type Tones = readonly string[];
/** the painted true form (the colossus is this, drawn again at COLOSSUS_SCALES) */
const VOID_TRUE_W = 160;
const VOID_TRUE_H = 128;
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
const TURN = Math.PI * 2;
const clamp01 = (value: number) => Math.min(1, Math.max(0, value));
const hash = (seed: number): number => {
  const raw = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return raw - Math.floor(raw);
};
/** a tone from dark..light `tones`, blended between neighbours with an ordered dither */
const pick = (tones: Tones, tick: number, x: number, y: number): string => {
  const pos = clamp01(tick) * (tones.length - 1);
  const low = Math.floor(pos);
  if (low >= tones.length - 1) return tones[tones.length - 1];
  return (pos - low) * 16 > BAYER[(y & 3) * 4 + (x & 3)] + 0.5 ? tones[low + 1] : tones[low];
};

const VEIL: Tones = ["#05030c", "#120a28", "#1d1040", "#3a2870", "#6a52b8"];
const ROBE: Tones = ["#0a0510", "#190a24", "#2c1238", "#4a2058", "#7a3a8a"];
const PLATE: Tones = ["#08040e", "#17102a", "#2a2150", "#4a3a88", "#7a68c8"];
const GOLD: Tones = ["#4a2a06", "#7a4a0c", "#c28a22", "#f2c14e", "#fff0a0"];
const BLOODS: Tones = ["#3a0410", "#a8102a", "#e0243c", "#ff6a3a", "#ffd070"];
const HOOD: Tones = ["#05030b", "#10091f", "#1b1034", "#3a2870", "#5a46a0"];
const BONE: Tones = ["#4a4030", "#8a7e60", "#b9ac8c", "#ece4cf", "#fffdf2"];
const FLAME: Tones = ["#7a1010", "#d0381c", "#ff8a2a", "#ffd070", "#fffbe0"];
const EMBER = "#ff8a2a";
const BLOOD = "#e0243c";
const RIM_TINT = "#ff7a5a";

const canvasOf = (wide: number, high: number): HTMLCanvasElement | null => {
  if (typeof document === "undefined") return null;
  const cv = document.createElement("canvas");
  cv.width = wide;
  cv.height = high;
  return cv;
};
/** a grid to canvas with horizontal runs merged into single rects (the grids here are large) */
export const gridCanvas = (grid: Grid): HTMLCanvasElement | null => {
  const cv = canvasOf(grid.width, grid.height);
  const ctx = cv?.getContext("2d");
  if (!cv || !ctx) return cv;
  for (let y = 0; y < grid.height; y++) {
    let start = 0;
    for (let x = 1; x <= grid.width; x++) {
      const color = x < grid.width ? grid.cells[y * grid.width + x] : null;
      const first = grid.cells[y * grid.width + start];
      if (color !== first || x === grid.width) {
        if (first) {
          ctx.fillStyle = first;
          ctx.fillRect(start, y, x - start, 1);
        }
        start = x;
      }
    }
  }
  return cv;
};

// ---- toolkit ---------------------------------------------------------------------------------------------------------------------
const dot = (grid: Grid, x: number, y: number, color: string) => grid.set(Math.round(x), Math.round(y), color);
/** a shaded ellipse lit from the upper left */
const shadedEllipse = (grid: Grid, cx: number, cy: number, rx: number, ry: number, tones: Tones, bias = 0) => {
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++)
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      const nx = (x - cx) / rx,
        ny = (y - cy) / ry;
      const dist = nx * nx + ny * ny;
      if (dist > 1) continue;
      const lift = Math.sqrt(1 - dist);
      grid.set(x, y, pick(tones, 0.5 + bias - nx * 0.32 - ny * 0.4 + (lift - 0.5) * 0.35, x, y));
    }
};
const line = (grid: Grid, x0: number, y0: number, x1: number, y1: number, color: string, thick = 1) => {
  const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
  for (let i = 0; i <= steps; i++) {
    const x = x0 + ((x1 - x0) * i) / steps,
      y = y0 + ((y1 - y0) * i) / steps;
    for (let ox = 0; ox < thick; ox++) for (let oy = 0; oy < thick; oy++) dot(grid, x + ox, y + oy, color);
  }
};
const triangle = (grid: Grid, ax: number, ay: number, bx: number, by: number, cx: number, cy: number, tones: Tones) => {
  const side = (px: number, py: number, qx: number, qy: number, rx: number, ry: number) =>
    (px - rx) * (qy - ry) - (qx - rx) * (py - ry);
  const minX = Math.floor(Math.min(ax, bx, cx)),
    maxX = Math.ceil(Math.max(ax, bx, cx));
  for (let y = Math.floor(Math.min(ay, by, cy)); y <= Math.ceil(Math.max(ay, by, cy)); y++)
    for (let x = minX; x <= maxX; x++) {
      const d1 = side(x + 0.5, y + 0.5, ax, ay, bx, by),
        d2 = side(x + 0.5, y + 0.5, bx, by, cx, cy),
        d3 = side(x + 0.5, y + 0.5, cx, cy, ax, ay);
      if ((d1 < 0 || d2 < 0 || d3 < 0) && (d1 > 0 || d2 > 0 || d3 > 0)) continue;
      // lit along the first edge: tone from how far the pixel is toward the tip
      const tick = 0.35 + 0.45 * clamp01(1 - Math.hypot(x - cx, y - cy) / Math.max(1, Math.hypot(ax - cx, ay - cy)));
      grid.set(x, y, pick(tones, tick + (d1 > 0 ? 0.15 : -0.1), x, y));
    }
};
/** a tapering curved blade from (x0, y0) to (x1, y1); `bend` px sideways; tones lit on the upper side, optional barbs */
const blade = (
  grid: Grid,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  bend: number,
  w0: number,
  w1: number,
  tones: Tones,
  edge: string,
  barbs = 0,
  tipTones?: Tones,
) => {
  const len = Math.max(Math.hypot(x1 - x0, y1 - y0), 1);
  let nx = -(y1 - y0) / len,
    ny = (x1 - x0) / len;
  if (ny > 0) {
    nx = -nx;
    ny = -ny;
  }
  const steps = Math.ceil(len * 1.4);
  for (let i = 0; i <= steps; i++) {
    const tick = i / steps;
    const arc = Math.sin(tick * Math.PI) * bend;
    const px = x0 + (x1 - x0) * tick + nx * arc,
      py = y0 + (y1 - y0) * tick + ny * arc;
    const half = Math.max(0.6, w0 + (w1 - w0) * tick ** 0.85);
    for (let off = -half; off <= half; off += 0.7) {
      const across = off / half;
      const x = Math.round(px + nx * off),
        y = Math.round(py + ny * off);
      let color: string;
      if (Math.abs(off) > half - 1.1) color = edge;
      else {
        let shade = 0.5 + across * 0.36 - tick * 0.1;
        if (barbs > 0 && (i * 0.9 + Math.abs(off) * 1.7) % barbs < 1) shade -= 0.3;
        if (Math.abs(off) < 0.7) shade -= 0.18;
        color = pick(tipTones && tick > 0.82 ? tipTones : tones, shade, x, y);
      }
      grid.set(x, y, color);
    }
  }
};

// ---- the body --------------------------------------------------------------------------------------------------------------------
interface WingDef {
  dir: number;
  len: number;
  flap: number;
}
const WINGS: WingDef[] = [
  { dir: 52, len: 54, flap: 1 },
  { dir: 98, len: 60, flap: -0.6 },
  { dir: 138, len: 50, flap: 1 },
];
const SWING = [-5, 0, 5, 0];
export const BOB = [0, 1, 2, 1];
export const COLOSSUS_FRAMES = 4;
const CX = 80;

const wingEye = (grid: Grid, x: number, y: number, size: number, iris: string, open: boolean) => {
  grid.set(Math.round(x), Math.round(y), iris);
  for (let ox = -size; ox <= size; ox++) {
    const half = open ? Math.round((1 - Math.abs(ox) / (size + 1)) * (size * 0.6)) : 0;
    for (let oy = -half; oy <= half; oy++)
      dot(
        grid,
        x + ox,
        y + oy,
        Math.abs(oy) === half && half > 0 ? "#05020b" : Math.abs(ox) < size * 0.4 ? iris : "#dff6ff",
      );
    dot(grid, x + ox, y - half - 1, "#05020b");
    dot(grid, x + ox, y + half + 1, "#05020b");
  }
  if (open) dot(grid, x, y, "#05020b");
};

const paintHalo = (grid: Grid, scale: number, bob: number, frame: number) => {
  const cy = (32 + 4 + bob) * scale;
  const radius = 37 * scale;
  for (let step = 0; step < 360; step++) {
    const angle = (step / 360) * TURN;
    const x = CX * scale + Math.cos(angle) * radius,
      y = cy + Math.sin(angle) * radius * 0.92;
    if (step % 3 !== 2) dot(grid, x, y, step % 9 === 0 ? "#ff6a4a" : "#7a2a50");
  }
  for (let eye = 0; eye < 12; eye++) {
    const angle = ((eye + 0.5) / 12) * TURN;
    wingEye(
      grid,
      CX * scale + Math.cos(angle) * radius,
      cy + Math.sin(angle) * radius * 0.92,
      Math.round(scale * 1.7),
      "#ff5a6a",
      (eye * 2 + frame) % 4 < 3,
    );
  }
};

const paintWings = (grid: Grid, scale: number, bob: number, frame: number) => {
  const sy = (50 + 4 + bob) * scale;
  // far (outer) wings first so the inner feathers overlap them
  for (const def of [...WINGS].reverse())
    for (const side of [-1, 1]) {
      const sx = (CX + side * 14) * scale;
      const swing = SWING[frame] * def.flap;
      for (let feather = 0; feather < 5; feather++) {
        const angle = ((def.dir + swing + (feather - 2) * 13) * Math.PI) / 180;
        const len = def.len * (0.74 + 0.26 * (1 - Math.abs(feather - 2) / 3)) * scale;
        const tx = sx + side * Math.sin(angle) * len,
          ty = sy - Math.cos(angle) * len;
        blade(
          grid,
          sx,
          sy,
          tx,
          ty,
          side * (4 + feather) * scale,
          5.2 * scale,
          0.9 * scale,
          VEIL,
          "#04020a",
          scale * 2.6,
          BLOODS,
        );
        // the glowing tip
        dot(grid, tx, ty, feather % 2 ? EMBER : BLOOD);
        dot(grid, tx - side * Math.sin(angle) * 2, ty + Math.cos(angle) * 2, "#ffd070");
      }
      const mid = ((def.dir + swing) * Math.PI) / 180;
      wingEye(
        grid,
        sx + side * Math.sin(mid) * def.len * 0.6 * scale,
        sy - Math.cos(mid) * def.len * 0.6 * scale,
        Math.round(scale * 1.9),
        "#ff4a5a",
        (frame + (def.dir > 90 ? 1 : 0)) % 3 !== 0,
      );
      wingEye(
        grid,
        sx + side * Math.sin(mid) * def.len * 0.32 * scale,
        sy - Math.cos(mid) * def.len * 0.32 * scale,
        Math.round(scale * 1.6),
        "#f2c14e",
        true,
      );
    }
};

const paintRobe = (grid: Grid, scale: number, bob: number, frame: number) => {
  const top = (44 + 4 + bob) * scale,
    bottom = (124 + 4 + bob) * scale;
  const dyPaint = (4 + bob) * scale;
  for (let y = Math.floor(top); y <= bottom; y++) {
    const py = y / scale - 4 - bob;
    const half = Math.min(30, 14 + (py - 44) * 0.3) * scale;
    for (let x = Math.ceil(CX * scale - half); x <= Math.floor(CX * scale + half); x++) {
      const strand = Math.floor(x / (scale * 1.1));
      const hem =
        dyPaint + (106 + 15 * hash(strand * 1.3) + 2 * Math.sin(((x * 0.16) / scale) * 2.5 + frame * 1.7)) * scale;
      if (y > hem) continue;
      const rel = (x - CX * scale) / half;
      const fold = Math.sin(((x * 0.19) / scale) * 2.5 + Math.sin(y * 0.03) * 2) * 0.5 + 0.5;
      let tick = 0.5 - rel * 0.34 + (fold - 0.5) * 0.45;
      if (Math.abs(rel) > 0.93) tick = -1;
      // darker toward the hem, thinning into the void
      const fade = clamp01((y - (hem - 40 * scale)) / (40 * scale));
      tick -= fade * 0.35;
      let color = pick(ROBE, tick, x, y);
      if (Math.abs(rel) > 0.93) color = GOLD[1];
      else if (Math.abs(rel) > 0.86) color = GOLD[2 - (x & 1)];
      // sparse gold runes down the middle
      if (Math.abs(x - CX * scale) < scale * 0.6 && Math.floor(y / (scale * 3)) % 3 === 0 && fade < 0.4)
        color = GOLD[3];
      if (fade > 0.55 && BAYER[(y & 3) * 4 + (x & 3)] < fade * 14) continue;
      grid.set(x, y, color);
      if (y > hem - scale * 1.2 && x % 2 === 0) grid.set(x, y, BLOODS[1]);
    }
  }
};

const paintPauldrons = (grid: Grid, scale: number, bob: number) => {
  for (const side of [-1, 1]) {
    const cx = (CX + side * 19) * scale,
      cy = (50 + 4 + bob) * scale;
    for (let spike = 0; spike < 3; spike++) {
      const bx = (CX + side * (13 + spike * 5)) * scale;
      const tx = (CX + side * (16 + spike * 7)) * scale,
        ty = (36 - spike * 3 + 4 + bob) * scale;
      blade(grid, bx, cy - 4 * scale, tx, ty, side * 1.5 * scale, 2.4 * scale, 0.5, PLATE, "#04020a", 0);
      dot(grid, tx, ty, GOLD[4]);
    }
    shadedEllipse(grid, cx, cy, 10.5 * scale, 6.4 * scale, PLATE);
    // a gold-trimmed brow and studs
    for (let x = Math.round(cx - 9 * scale); x <= cx + 9 * scale; x++) {
      const along = (x - cx) / (9 * scale);
      dot(grid, x, cy - 4.8 * scale * Math.sqrt(Math.max(0, 1 - along * along)), GOLD[3]);
      dot(grid, x, cy - 4.8 * scale * Math.sqrt(Math.max(0, 1 - along * along)) + 1, GOLD[1]);
    }
    for (let stud = -1; stud <= 1; stud++) dot(grid, cx + stud * 4.5 * scale, cy + scale, GOLD[4]);
  }
};

/** the chest: a dark socket (the live eye covers it) ringed with thorn blades */
const paintChestRing = (grid: Grid, scale: number) => {
  const cx = COLOSSUS_PAINT_CHEST_X * scale,
    cy = COLOSSUS_PAINT_CHEST_Y * scale;
  for (let spike = 0; spike < 14; spike++) {
    const angle = (spike / 14) * TURN;
    const a0 = angle - 0.2,
      a1 = angle + 0.2;
    triangle(
      grid,
      cx + Math.cos(a0) * 14.5 * scale,
      cy + Math.sin(a0) * 10.6 * scale,
      cx + Math.cos(a1) * 14.5 * scale,
      cy + Math.sin(a1) * 10.6 * scale,
      cx + Math.cos(angle) * 22.5 * scale,
      cy + Math.sin(angle) * 16.5 * scale,
      spike % 2 ? PLATE : GOLD,
    );
  }
  shadedEllipse(grid, cx, cy, 16.2 * scale, 12.2 * scale, GOLD);
  for (let y = Math.floor(cy - 11.4 * scale); y <= cy + 11.4 * scale; y++)
    for (let x = Math.floor(cx - 15.4 * scale); x <= cx + 15.4 * scale; x++)
      if (((x - cx) / (15.4 * scale)) ** 2 + ((y - cy) / (11.4 * scale)) ** 2 <= 1) grid.set(x, y, "#14080a");
};

const RIM_STEPS = 2;
/** a dark outline, then a lit rim on the body's own edge (warm light from the chest eye) */
const rimLight = (grid: Grid) => {
  const { width, height, cells, inked } = grid;
  const out = cells.slice();
  for (let y = 1; y < height - 1; y++)
    for (let x = 1; x < width - 1; x++) {
      const at = y * width + x;
      const color = cells[at];
      if (!color || inked.has(at)) continue;
      const near = inked.has(at - 1) || inked.has(at + 1) || inked.has(at - width) || inked.has(at + width);
      if (near) out[at] = lighten(mix(color, RIM_TINT, 0.4), 0.38);
      else {
        // a second, softer rim on the upper-left only
        let deep = false;
        for (let step = 2; step <= RIM_STEPS && !deep; step++)
          deep = inked.has(at - step) || inked.has(at - step * width);
        if (deep) out[at] = lighten(mix(color, RIM_TINT, 0.2), 0.14);
      }
    }
  grid.cells = out;
};

// ---- cracks over the body ------------------------------------------------------------------------------------------------------
const CRACK_COUNTS = [0, 0, 4, 9, 14];
const CRACK_REACH = [0, 0, 22, 44, 68];
/** the stage's cracks spread from the chest eye over painted cells only (stage 1 is the eye alone) */
const paintBodyCracks = (grid: Grid, scale: number, stage: number) => {
  const count = CRACK_COUNTS[stage] ?? 0;
  const reach = (CRACK_REACH[stage] ?? 0) * scale;
  for (let crack = 0; crack < count; crack++) {
    let px = COLOSSUS_PAINT_CHEST_X * scale,
      py = COLOSSUS_PAINT_CHEST_Y * scale;
    const heading = (crack / count) * TURN + (hash(crack * 5.3) - 0.5) * 0.5;
    const length = reach * (0.55 + hash(crack * 2.1) * 0.45);
    for (let step = 0; step < length; step++) {
      const wander = (hash(crack * 31 + Math.floor(step / 3)) - 0.5) * 1.5;
      px += Math.cos(heading + wander);
      py += Math.sin(heading + wander) * 0.85;
      if (step < 16 * scale) continue;
      const x = Math.round(px),
        y = Math.round(py);
      if (!grid.cells[y * grid.width + x]) continue;
      grid.set(x, y, "#05020b");
      grid.set(x + 1, y, "#05020b");
      if (step % 3 !== 0) grid.set(x, y + 1, step % 7 === 0 ? "#ffffff" : GOLD[4]);
      else grid.set(x + 1, y + 1, GOLD[3]);
    }
  }
};

const bodyCache = new Map<string, HTMLCanvasElement | null>();
/** the colossus body without face and eye at COLOSSUS_SCALES[step]: wings, robe, pauldrons, chest socket, rim light, cracks */
export const colossusBodyArt = (step: number, frame: number, stage: number): HTMLCanvasElement | null => {
  const index = Math.min(COLOSSUS_SCALES.length - 1, Math.max(0, step));
  const idle = ((frame % COLOSSUS_FRAMES) + COLOSSUS_FRAMES) % COLOSSUS_FRAMES;
  const key = `${index}|${idle}|${stage}`;
  if (bodyCache.has(key)) return bodyCache.get(key) ?? null;
  const scale = COLOSSUS_SCALES[index];
  const grid = new Grid(Math.round(VOID_TRUE_W * scale), Math.round(VOID_TRUE_H * scale));
  const bob = BOB[idle];
  paintHalo(grid, scale, bob, idle);
  paintWings(grid, scale, bob, idle);
  paintRobe(grid, scale, bob, idle);
  paintPauldrons(grid, scale, bob);
  paintChestRing(grid, scale);
  grid.outline();
  grid.outline();
  rimLight(grid);
  paintBodyCracks(grid, scale, stage);
  const canvas = gridCanvas(grid);
  bodyCache.set(key, canvas);
  return canvas;
};

// ---- the face: hood, mask, void half, crown ---------------------------------------------------------------------------------------
/** the face overlay covers painted x FACE_X0.., y FACE_Y0.. (units), FACE_W x FACE_H of them; the head centre is (80, 40) */
export const FACE_X0 = 51;
export const FACE_Y0 = 0;
export const FACE_W = 58;
export const FACE_H = 62;
const HEAD_Y = 36 + 4;
const faceCache = new Map<string, HTMLCanvasElement | null>();

const maskEdge = (py: number): number => CX - 1 + Math.sin(py * 0.9) * 2.4 + (py - 22) * 0.12;

const paintFace = (grid: Grid, scale: number, frame: number, open: number, stage: number) => {
  const ox = FACE_X0 * scale,
    oy = FACE_Y0 * scale;
  const gap = open * 1.5 * scale;
  for (let y = 0; y < grid.height; y++)
    for (let x = 0; x < grid.width; x++) {
      const px = (x + ox) / scale,
        py = (y + oy) / scale;
      const hx = (px - CX) / 13.5,
        hy = (py - HEAD_Y) / 17;
      if (hx * hx + hy * hy > 1) continue;
      const fx = (px - CX) / 10,
        fy = (py - (HEAD_Y - 1)) / 13;
      const edge = maskEdge(py);
      const inFace = fx * fx + fy * fy <= 1;
      if (!inFace) {
        // the hood: fabric folds, lit on the left
        const fold = Math.sin(px * 1.7 + Math.sin(py * 0.4) * 1.3) * 0.5 + 0.5;
        grid.set(x, y, pick(HOOD, 0.45 - hx * 0.3 - hy * 0.22 + (fold - 0.5) * 0.3, x, y));
        continue;
      }
      const split = open > 0 ? gap : 0;
      if (px < edge - split / scale) {
        // the bone half of the mask (sliding left when it splits)
        const sx = px + split / scale;
        const nx = (sx - CX) / 10;
        let tick = 0.62 - nx * 0.28 - fy * 0.18 + (hash(Math.floor(x / 3) * 3 + Math.floor(y / 3) * 17) - 0.5) * 0.12;
        if (py > 28.6 && py < 29.8 && sx > CX - 9) tick -= 0.4; // brow ridge
        if (Math.abs(sx - (CX - 3.5)) < 0.45 && py > 34 && py < 44) tick -= 0.3; // nose ridge
        if (py > 41 && py < 41.7 && sx > CX - 7) tick -= 0.25; // cheek line
        grid.set(x, y, pick(BONE, tick, x, y));
      } else if (px < edge) {
        // the roar: the glowing maw between the halves
        const across = clamp01((px - (edge - split / scale)) / Math.max(0.01, split / scale));
        const core = 1 - Math.abs(across - 0.5) * 2;
        grid.set(x, y, pick(FLAME, 0.2 + core * 0.95 + (hash(y * 0.7 + frame) - 0.5) * 0.2, x, y));
      } else {
        // the void half
        grid.set(
          x,
          y,
          pick(
            ["#05020b", "#0b0618", "#14102a"],
            hash(Math.floor(x / 2) * 13 + Math.floor(y / 2)) * 0.5 + (open > 0 ? 0.25 : 0),
            x,
            y,
          ),
        );
      }
    }
  // the cyan eye in the mask
  const ex = (CX - 6) * scale - ox,
    ey = 34 * scale - oy;
  const eyeOpen = open > 0 ? 0.6 : 1;
  for (let y = -3.5 * scale; y <= 3.5 * scale; y++)
    for (let x = -4.8 * scale; x <= 4.8 * scale; x++) {
      const nx = x / (4.8 * scale),
        ny = y / (3.2 * scale * eyeOpen + 0.5);
      if (nx * nx + ny * ny > 1) continue;
      const rad = Math.hypot(nx, ny);
      grid.set(
        Math.round(ex + x),
        Math.round(ey + y),
        rad > 0.8 ? "#0b0716" : rad > 0.42 ? "#1d9a8c" : rad > 0.2 ? "#5ff5d8" : "#d8fff4",
      );
    }
  dot(grid, ex - 1, ey - 1, "#ffffff");
  // the gold slashes of the void half
  const slashes = [
    [2, 32, 8, 33],
    [3, 35.5, 8, 36.2],
  ];
  const hot = open > 0 || frame % 2 === 0;
  for (const [x0, y0, x1, y1] of slashes)
    for (let along = 0; along <= 1; along += 0.5 / (6 * scale)) {
      const x = (CX + x0 + (x1 - x0) * along) * scale - ox,
        y = (y0 + (y1 - y0) * along) * scale - oy;
      dot(grid, x, y - 1, GOLD[1]);
      dot(grid, x, y, hot ? GOLD[4] : GOLD[3]);
      dot(grid, x, y + 1, GOLD[2]);
    }
  // the torn mask's rim: dark cracks along the broken edge
  for (let py = 22; py <= 50; py += 0.5) {
    const x = (maskEdge(py) - (open > 0 ? gap / scale : 0)) * scale - ox,
      y = py * scale - oy;
    dot(grid, x, y, "#3a3020");
    if (hash(py * 7) > 0.7) dot(grid, x - 1, y, BONE[0]);
  }
  // a thin crack across the mask from the eye as the damage climbs the body
  if (stage >= 1) {
    const reach = stage >= 2 ? 3 : 1.6;
    const points = [
      [CX - 7, 24],
      [CX - 6, 28],
      [CX - 8, 33],
      [CX - 6, 38],
      [CX - 8, 44],
    ];
    for (let seg = 0; seg < points.length - 1; seg++)
      if (seg < reach) {
        line(
          grid,
          points[seg][0] * scale - ox,
          points[seg][1] * scale - oy,
          points[seg + 1][0] * scale - ox,
          points[seg + 1][1] * scale - oy,
          "#2a2014",
          2,
        );
        line(
          grid,
          points[seg][0] * scale - ox + 1,
          points[seg][1] * scale - oy,
          points[seg + 1][0] * scale - ox + 1,
          points[seg + 1][1] * scale - oy,
          stage >= 2 ? GOLD[4] : "#8a7e60",
        );
      }
  }
  grid.outline();
  // the crown ablaze: nine flame tongues (no outline: they are light)
  for (let k = -4; k <= 4; k++) {
    const dx = k * 3;
    const baseY = (HEAD_Y - 17 * Math.sqrt(Math.max(0, 1 - (dx / 13.5) ** 2)) + 3) * scale - oy;
    const baseX = (CX + dx * 1.2) * scale - ox;
    const tall = (11 + (4 - Math.abs(k)) * 2.6 + ((k + frame) % 2 ? 2.4 : 0)) * scale;
    const lean = (frame % 2 ? 1 : -1) * 1.8 * scale * (1 - Math.abs(k) / 5);
    for (let i = 0; i < tall; i++) {
      const tick = i / tall;
      const half = Math.max(0.5, (1 - tick) ** 0.8 * 3.2 * scale * (1 - Math.abs(k) * 0.08));
      const cx = baseX + lean * tick * tick + Math.sin(i * 0.5 + k + frame) * 0.9 * scale * tick;
      for (let off = -half; off <= half; off++) {
        const across = Math.abs(off) / half;
        grid.set(
          Math.round(cx + off),
          Math.round(baseY - i),
          pick(FLAME, 1 - tick * 0.75 - across * 0.9, Math.round(cx + off), Math.round(baseY - i)),
        );
      }
    }
  }
};

export const colossusFaceArt = (step: number, frame: number, open: number, stage: number): HTMLCanvasElement | null => {
  const index = Math.min(COLOSSUS_SCALES.length - 1, Math.max(0, step));
  const idle = ((frame % COLOSSUS_FRAMES) + COLOSSUS_FRAMES) % COLOSSUS_FRAMES;
  const faceStage = stage >= 4 ? 2 : stage >= 3 ? 1 : 0;
  const key = `${index}|${idle}|${open}|${faceStage}`;
  if (faceCache.has(key)) return faceCache.get(key) ?? null;
  const scale = COLOSSUS_SCALES[index];
  const grid = new Grid(Math.round(FACE_W * scale), Math.round(FACE_H * scale));
  paintFace(grid, scale, idle, open / 4, faceStage + (open > 0 ? 0 : 0));
  const canvas = gridCanvas(grid);
  faceCache.set(key, canvas);
  return canvas;
};

// ---- the eye ----------------------------------------------------------------------------------------------------------------------
export const EYE_RX = 17;
export const EYE_RY = 13;
const eyeCache = new Map<string, HTMLCanvasElement | null>();
const SCLERA: Tones = ["#a8741a", "#e8b84a", "#fff2b8", "#ffffff"];
const SCLERA_HOT: Tones = ["#ffe27a", "#fff2b8", "#ffffff", "#ffffff"];
const IRIS_TONES: Tones = ["#3a0410", "#a8102a", "#e8741a", "#ffb52e", "#ffe27a"];
const IRIS_HOT: Tones = ["#a8300c", "#e8741a", "#ffd070", "#fff0a0", "#ffffff"];
const LIDS: Tones = ["#05030c", "#0b0716", "#1a1030", "#2a1a4a"];

/** how open the lids are at a squint level: 1 wide .. a thin slit */
const lidOpen = (level: number): number => 1 - (level / SQUINT_LEVELS) * 0.9;

/** the live eye: lids close and the iris contracts with `level` (0..SQUINT_LEVELS), `pan` -1..1, `hot` gaze glow, `stage` cracks */
export const colossusEyeArt = (
  step: number,
  level: number,
  pan: number,
  hot: boolean,
  stage: number,
): HTMLCanvasElement | null => {
  const index = Math.min(COLOSSUS_SCALES.length - 1, Math.max(0, step));
  const key = `${index}|${level}|${pan}|${hot ? 1 : 0}|${stage}`;
  if (eyeCache.has(key)) return eyeCache.get(key) ?? null;
  const scale = COLOSSUS_SCALES[index];
  const wide = Math.round(EYE_RX * 2 * scale),
    high = Math.round(EYE_RY * 2 * scale);
  const grid = new Grid(wide, high);
  const cx = wide / 2,
    cy = high / 2;
  const rx = EYE_RX * scale - 1,
    ry = EYE_RY * scale - 1;
  const open = lidOpen(level);
  const contract = 1 - (level / SQUINT_LEVELS) * 0.38;
  const irisRx = 7.4 * scale * contract,
    irisRy = 9 * scale * contract;
  const irisX = cx + pan * 2 * scale;
  const sclera = hot ? SCLERA_HOT : SCLERA;
  const irisTones = hot ? IRIS_HOT : IRIS_TONES;
  for (let y = 0; y < high; y++)
    for (let x = 0; x < wide; x++) {
      const ux = (x + 0.5 - cx) / rx,
        vy = (y + 0.5 - cy) / ry;
      const rad = Math.hypot(ux, vy);
      if (rad > 1) continue;
      if (rad > 0.87) {
        const lit = 0.5 - ux * 0.3 - vy * 0.4;
        grid.set(x, y, rad > 0.96 ? GOLD[0] : pick(GOLD, lit + 0.1, x, y));
        continue;
      }
      const lidEdge = open * 0.86 * Math.max(0, 1 - (ux / 0.87) ** 2) ** 0.55;
      if (Math.abs(vy) > lidEdge) {
        // the lid skin: dark, a gold lash line along the margin
        const margin = Math.abs(vy) - lidEdge;
        grid.set(
          x,
          y,
          margin < 0.05 ? (vy < 0 ? GOLD[2] : GOLD[1]) : pick(LIDS, 0.35 - vy * 0.2 + (rad - 0.6) * 0.1, x, y),
        );
        continue;
      }
      const iu = (x + 0.5 - irisX) / irisRx,
        iv = (y + 0.5 - cy) / irisRy;
      const ir = Math.hypot(iu, iv);
      if (ir <= 1) {
        const spoke = Math.floor(((Math.atan2(iv, iu) + Math.PI) / TURN) * 22) % 2 === 0;
        const pupil = Math.abs(iu) < (0.2 + (1 - contract) * -0.4 + 0.02) * 1.2 && Math.abs(iv) < 0.82;
        if (pupil) grid.set(x, y, "#14080a");
        else grid.set(x, y, pick(irisTones, (1 - ir) * 1.15 + (spoke ? -0.08 : 0.05) - (ir > 0.86 ? 0.2 : 0), x, y));
      } else grid.set(x, y, pick(sclera, 0.55 + (1 - rad) * 0.7 - Math.abs(ux) * 0.2, x, y));
    }
  // blood veins running in from the rim
  for (let vein = 0; vein < 11; vein++) {
    const angle = (vein / 11) * TURN + hash(vein) * 0.4;
    for (let step = 0; step < 14 * scale; step++) {
      const dist = 0.84 - (step / (14 * scale)) * 0.42;
      const x = Math.round(cx + Math.cos(angle) * dist * rx + Math.sin(step * 0.6 + vein) * 0.8);
      const y = Math.round(cy + Math.sin(angle) * dist * ry);
      const ux = (x + 0.5 - cx) / rx,
        vy = (y + 0.5 - cy) / ry;
      const lidEdge = open * 0.86 * Math.max(0, 1 - (ux / 0.87) ** 2) ** 0.55;
      const inIris = ((x + 0.5 - irisX) / irisRx) ** 2 + ((y + 0.5 - cy) / irisRy) ** 2 <= 1;
      if (Math.abs(vy) < lidEdge - 0.04 && !inIris && grid.cells[y * wide + x])
        grid.set(x, y, hot ? "#ff6a4a" : "#b8102a");
    }
  }
  // glints on the iris (only with the eye open enough to catch light)
  if (level < SQUINT_LEVELS) {
    const gx = Math.round(irisX - irisRx * 0.42),
      gy = Math.round(cy - irisRy * 0.42);
    grid.rect(gx, gy, gx + Math.round(scale * 1.4), gy + Math.round(scale), "#ffffff");
    dot(grid, gx + scale * 2.2, gy + scale * 1.9, "#ffffff");
  }
  // cracks over the eye, growing with the stage
  const crackCount = stage <= 0 ? 0 : stage + 1;
  for (let crack = 0; crack < crackCount; crack++) {
    let px = cx + (hash(crack * 3) - 0.5) * 6 * scale,
      py = cy + (hash(crack * 5) - 0.5) * 4 * scale;
    const heading = (crack / crackCount) * TURN + 0.5;
    const length = (8 + stage * 4) * scale;
    for (let step = 0; step < length; step++) {
      px += Math.cos(heading + (hash(crack * 13 + Math.floor(step / 3)) - 0.5) * 1.6);
      py += Math.sin(heading + (hash(crack * 13 + Math.floor(step / 3)) - 0.5) * 1.6) * 0.8;
      const x = Math.round(px),
        y = Math.round(py);
      if (!grid.cells[y * wide + x] || Math.hypot((x - cx) / rx, (y - cy) / ry) > 0.9) continue;
      grid.set(x, y, "#05020b");
      grid.set(x + 1, y, step % 4 ? GOLD[4] : "#ffffff");
    }
  }
  const canvas = gridCanvas(grid);
  eyeCache.set(key, canvas);
  return canvas;
};

/** the body sprite (never null: an empty canvas when the canvas cannot be built) */
export const voidColossusSprite = (step: number, frame: number, stage = 0): HTMLCanvasElement =>
  colossusBodyArt(step, frame, stage) ?? document.createElement("canvas");
