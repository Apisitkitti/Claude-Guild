/**
 * A tiny 3x5 bitmap font drawn as opaque world-pixel rects (crisp at any canvas scale, no system font involved).
 * Upper-case letters, digits and a few marks; lower case is folded to upper, anything else is skipped.
 */
export const GLYPH_W = 3;
export const GLYPH_H = 5;
const GAP = 1;

type PixelCtx = {
  fillStyle: string | CanvasGradient | CanvasPattern;
  fillRect: (x: number, y: number, w: number, h: number) => void;
};

// each glyph: five rows of three chars, "#" = ink
const GLYPH_ART: Record<string, string> = {
  A: "###|#.#|###|#.#|#.#",
  B: "##.|#.#|##.|#.#|##.",
  C: ".##|#..|#..|#..|.##",
  D: "##.|#.#|#.#|#.#|##.",
  E: "###|#..|##.|#..|###",
  F: "###|#..|##.|#..|#..",
  G: ".##|#..|#.#|#.#|.##",
  H: "#.#|#.#|###|#.#|#.#",
  I: "###|.#.|.#.|.#.|###",
  J: "..#|..#|..#|#.#|.#.",
  K: "#.#|#.#|##.|#.#|#.#",
  L: "#..|#..|#..|#..|###",
  M: "#.#|###|###|#.#|#.#",
  N: "##.|#.#|#.#|#.#|#.#",
  O: ".#.|#.#|#.#|#.#|.#.",
  P: "##.|#.#|##.|#..|#..",
  Q: ".#.|#.#|#.#|##.|.##",
  R: "##.|#.#|##.|#.#|#.#",
  S: ".##|#..|.#.|..#|##.",
  T: "###|.#.|.#.|.#.|.#.",
  U: "#.#|#.#|#.#|#.#|###",
  V: "#.#|#.#|#.#|#.#|.#.",
  W: "#.#|#.#|###|###|#.#",
  X: "#.#|#.#|.#.|#.#|#.#",
  Y: "#.#|#.#|.#.|.#.|.#.",
  Z: "###|..#|.#.|#..|###",
  "0": "###|#.#|#.#|#.#|###",
  "1": ".#.|##.|.#.|.#.|###",
  "2": "##.|..#|.#.|#..|###",
  "3": "##.|..#|.#.|..#|##.",
  "4": "#.#|#.#|###|..#|..#",
  "5": "###|#..|##.|..#|##.",
  "6": ".##|#..|###|#.#|###",
  "7": "###|..#|.#.|.#.|.#.",
  "8": "###|#.#|###|#.#|###",
  "9": "###|#.#|###|..#|##.",
  "%": "#.#|..#|.#.|#..|#.#",
  "-": "...|...|###|...|...",
  "·": "...|...|.#.|...|...",
  ".": "...|...|...|...|.#.",
  "!": ".#.|.#.|.#.|...|.#.",
  "?": "##.|..#|.#.|...|.#.",
  ":": "...|.#.|...|.#.|...",
  "+": "...|.#.|###|.#.|...",
  "/": "..#|..#|.#.|#..|#..",
  " ": "...|...|...|...|...",
};
const GLYPHS: Record<string, boolean[][]> = Object.fromEntries(
  Object.entries(GLYPH_ART).map(([ch, art]) => [ch, art.split("|").map((row) => [...row].map((cell) => cell === "#"))]),
);

/** the characters the font can draw (after folding to upper case) */
export const PIXEL_CHARS = Object.keys(GLYPH_ART).join("");

/** glyph of one character after folding to upper case (null = the font lacks it); memoised so drawing allocates nothing */
const glyphCache = new Map<string, boolean[][] | null>();
/** distinct characters remembered before the memo starts over (names may bring any script) */
const GLYPH_CACHE_MAX = 512;
const glyphOf = (ch: string): boolean[][] | null => {
  let glyph = glyphCache.get(ch);
  if (glyph === undefined) {
    glyph = GLYPHS[ch.toUpperCase()] ?? null;
    if (glyphCache.size >= GLYPH_CACHE_MAX) glyphCache.clear();
    glyphCache.set(ch, glyph);
  }
  return glyph;
};
const countGlyphs = (text: string): number => {
  let count = 0;
  for (const ch of text) if (glyphOf(ch)) count++;
  return count;
};

/** width in world px of a text at integer `scale` (unknown characters are skipped; no trailing gap) */
export const measurePixelText = (text: string, scale = 1): number => {
  const count = countGlyphs(text);
  return count ? (count * (GLYPH_W + GAP) - GAP) * scale : 0;
};

export const pixelTextHeight = (scale = 1): number => GLYPH_H * scale;

export interface PixelTextOpts {
  scale?: number;
  /** opaque 1px (scaled) drop shadow or outline colour */
  shadow?: string;
  /** "right" / "center" align on x instead of left */
  align?: "left" | "center" | "right";
  /** draw the shadow on all four sides (a full outline) instead of down-right only */
  outline?: boolean;
}

/** the eight neighbours a full outline is painted at */
const OUTLINE_OFFSETS: readonly (readonly [number, number])[] = [
  [-1, 0],
  [1, 0],
  [0, -1],
  [0, 1],
  [1, 1],
  [-1, -1],
  [-1, 1],
  [1, -1],
];

/** draw text with its top-left at (x, y); returns the drawn width */
export const drawPixelText = (
  ctx: PixelCtx,
  text: string,
  x: number,
  y: number,
  color: string,
  opts: PixelTextOpts = {},
): number => {
  const scale = opts.scale ?? 1;
  const width = measurePixelText(text, scale);
  const left = Math.round(opts.align === "center" ? x - width / 2 : opts.align === "right" ? x - width : x);
  const top = Math.round(y);
  const paint = (ox: number, oy: number, fill: string) => {
    ctx.fillStyle = fill;
    let cx = left;
    for (const ch of text) {
      const glyph = glyphOf(ch);
      if (!glyph) continue;
      for (let gy = 0; gy < GLYPH_H; gy++)
        for (let gx = 0; gx < GLYPH_W; gx++)
          if (glyph[gy][gx]) ctx.fillRect(cx + gx * scale + ox, top + gy * scale + oy, scale, scale);
      cx += (GLYPH_W + GAP) * scale;
    }
  };
  if (opts.shadow) {
    if (opts.outline) for (const [ox, oy] of OUTLINE_OFFSETS) paint(ox * scale, oy * scale, opts.shadow);
    else paint(scale, scale, opts.shadow);
  }
  paint(0, 0, color);
  return width;
};
