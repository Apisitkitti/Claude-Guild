// Tiny paint grid for the hall's pets and townsfolk: one letter per colour, rect/dot painters, a closed dark outline,
// a cached canvas. Everything painted is an opaque #rrggbb colour (characters are never translucent or tinted).

const INK = "#14121f";
const OUTLINE_KEEP = 0.2;
const OUTLINE_INK = 0.8;
const HEX_BASE = 16;
const BYTE = 255;
const SHIFTS = [16, 8, 0];

const mixToInk = (color: string): string => {
  const rgb = parseInt(color.slice(1), HEX_BASE);
  const ink = parseInt(INK.slice(1), HEX_BASE);
  return (
    "#" +
    SHIFTS.map((shift) =>
      Math.round(((rgb >>> shift) & BYTE) * OUTLINE_KEEP + ((ink >>> shift) & BYTE) * OUTLINE_INK)
        .toString(HEX_BASE)
        .padStart(2, "0"),
    ).join("")
  );
};

export class Bitmap {
  readonly width: number;
  readonly height: number;
  private cells: (string | null)[];
  private readonly palette: Record<string, string>;
  private readonly pad: number;

  /** `pad` empty cells are kept around the drawing area (painters use drawing coordinates) so the outline never clips */
  constructor(width: number, height: number, palette: Record<string, string>, pad = 0) {
    this.pad = pad;
    this.width = width + pad * 2;
    this.height = height + pad * 2;
    this.palette = palette;
    this.cells = new Array<string | null>(this.width * this.height).fill(null);
  }

  /** paint one cell with a palette letter (out of range is ignored; '.' erases) */
  dot(drawX: number, drawY: number, letter: string) {
    const x = drawX + this.pad,
      y = drawY + this.pad;
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return;
    this.cells[y * this.width + x] = this.palette[letter] ?? null;
  }

  /** fill the inclusive rectangle x0..x1, y0..y1 */
  rect(x0: number, y0: number, x1: number, y1: number, letter: string) {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) this.dot(x, y, letter);
  }

  /** stamp ASCII rows with the top-left corner at (x0, y0); '.' leaves the cell alone */
  stamp(x0: number, y0: number, rows: readonly string[]) {
    rows.forEach((row, j) => {
      for (let i = 0; i < row.length; i++) if (row[i] !== ".") this.dot(x0 + i, y0 + j, row[i]);
    });
  }

  /** closed 1px outline: every empty cell touching a filled one becomes a dark shade of that neighbour */
  outline() {
    const out = this.cells.slice();
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        if (this.cells[y * this.width + x]) continue;
        let neighbour: string | null = null;
        for (let dy = -1; dy <= 1 && !neighbour; dy++) {
          for (let dx = -1; dx <= 1 && !neighbour; dx++) {
            const nx = x + dx,
              ny = y + dy;
            if ((dx || dy) && nx >= 0 && ny >= 0 && nx < this.width && ny < this.height)
              neighbour = this.cells[ny * this.width + nx];
          }
        }
        if (neighbour) out[y * this.width + x] = mixToInk(neighbour);
      }
    }
    this.cells = out;
  }

  toCanvas(): HTMLCanvasElement {
    const canvas = document.createElement("canvas");
    canvas.width = this.width;
    canvas.height = this.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return canvas;
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const color = this.cells[y * this.width + x];
        if (!color) continue;
        ctx.fillStyle = color;
        ctx.fillRect(x, y, 1, 1);
      }
    }
    return canvas;
  }
}

/** a frame number wrapped into 0..count-1 (negatives and NaN safe) */
export const wrapFrame = (frame: number, count: number): number => {
  const whole = Number.isFinite(frame) ? Math.floor(frame) : 0;
  return ((whole % count) + count) % count;
};

/** build once per key, outlined last, then reuse the canvas */
export const cachedBitmap = (
  cache: Map<string, HTMLCanvasElement>,
  key: string,
  width: number,
  height: number,
  palette: Record<string, string>,
  draw: (bitmap: Bitmap) => void,
  pad = 0,
): HTMLCanvasElement => {
  let sprite = cache.get(key);
  if (!sprite) {
    const bitmap = new Bitmap(width, height, palette, pad);
    draw(bitmap);
    bitmap.outline();
    sprite = bitmap.toCanvas();
    cache.set(key, sprite);
  }
  return sprite;
};
