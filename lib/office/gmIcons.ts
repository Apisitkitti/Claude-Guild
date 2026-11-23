/**
 * The guild master's 9x9 speech-bubble icons (opaque, drawn as world-pixel rects). One per urgency reason plus the
 * dispatcher sword, the thumbs-up, the hand bell and the report scroll.
 */
export type GmIconId =
  "permission" | "question" | "limit" | "loop" | "stuck" | "idle" | "compact" | "sword" | "thumb" | "bell" | "scroll";

export const GM_ICON_SIZE = 9;

type IconCtx = {
  fillStyle: string | CanvasGradient | CanvasPattern;
  fillRect: (x: number, y: number, w: number, h: number) => void;
};

/** nine rows of nine chars; the char picks a colour from the icon's palette, "." is clear */
interface IconArt {
  rows: string[];
  pal: Record<string, string>;
}

const INK = "#2a1810";
const GOLD = "#f2c14e";
const RED = "#d11a2a";
const BLUE = "#2a62c8";
const STEEL = "#aab4c8";
const WOOD = "#8a5a2c";

const ART: Record<GmIconId, IconArt> = {
  // padlock
  permission: {
    rows: [
      "..kkkkk..",
      ".k.....k.",
      ".k.....k.",
      ".k.....k.",
      "ggggggggg",
      "gkkkkkkkg",
      "ggggkgggg",
      "gggkkkggg",
      "ggggggggg",
    ],
    pal: { k: INK, g: GOLD },
  },
  // question mark
  question: {
    rows: [
      "..bbbbb..",
      ".bb...bb.",
      ".bb...bb.",
      ".....bb..",
      "....bb...",
      "...bb....",
      "...bb....",
      ".........",
      "...bb....",
    ],
    pal: { b: BLUE },
  },
  // drained battery
  limit: {
    rows: [
      "...kkk...",
      ".kkkkkkk.",
      ".krrrrrk.",
      ".k.....k.",
      ".k.....k.",
      ".k.....k.",
      ".k.....k.",
      ".k.....k.",
      ".kkkkkkk.",
    ],
    pal: { k: INK, r: RED },
  },
  // circular arrows
  loop: {
    rows: [
      ".rrrrr...",
      "r.....r..",
      "r....rrr.",
      "r.....r..",
      ".........",
      "..r.....r",
      ".rrr....r",
      "..r.....r",
      "...rrrrr.",
    ],
    pal: { r: RED },
  },
  // hourglass
  stuck: {
    rows: [
      "kkkkkkkkk",
      ".kyyyyyk.",
      "..kyyyk..",
      "...kyk...",
      "....k....",
      "...k.k...",
      "..k.yyk..",
      ".kyyyyyk.",
      "kkkkkkkkk",
    ],
    pal: { k: INK, y: GOLD },
  },
  // Zz
  idle: {
    rows: [
      "..bbbbb..",
      "....bb...",
      "...bb....",
      "..bbbbb..",
      ".........",
      ".bbbb....",
      "...b.....",
      "..b......",
      ".bbbb....",
    ],
    pal: { b: BLUE },
  },
  // box
  compact: {
    rows: [
      ".........",
      ".wwwwwww.",
      "wwwwwwwww",
      "wddddddww",
      "wwwwdwwww",
      "wwwwdwwww",
      "wwwwdwwww",
      "wwwwwwwww",
      ".dddddddd",
    ],
    pal: { w: WOOD, d: INK },
  },
  // sword
  sword: {
    rows: [
      "......ss.",
      ".....sss.",
      "....sss..",
      "...sss...",
      "g.sss....",
      ".gss.....",
      "..gg.....",
      ".w.gg....",
      "w........",
    ],
    pal: { s: STEEL, g: GOLD, w: WOOD },
  },
  // thumbs up
  thumb: {
    rows: [
      "....yy...",
      "...yy....",
      "...yy....",
      "..yyyyyy.",
      "yyyyyyyyy",
      "yyyyyyyyy",
      "yyyyyyyyy",
      "yyyyyyyy.",
      ".yyyyyy..",
    ],
    pal: { y: GOLD },
  },
  // hand bell
  bell: {
    rows: [
      "....y....",
      "...yyy...",
      "..yyyyy..",
      "..yyyyy..",
      "..yyyyy..",
      ".yyyyyyy.",
      "yyyyyyyyy",
      "kkkkkkkkk",
      "....k....",
    ],
    pal: { y: GOLD, k: INK },
  },
  // scroll
  scroll: {
    rows: [
      ".wwwwwww.",
      "wwwwwwwww",
      ".wkkkkkw.",
      ".wwwwwww.",
      ".wkkkkkw.",
      ".wwwwwww.",
      ".wkkkw...",
      "wwwwwwwww",
      ".wwwwwww.",
    ],
    pal: { w: "#f5e6b8", k: INK },
  },
};

/** draw icon `id` with its top-left at (x, y); shifting it by (dx, dy) makes the bell shake */
export const drawGmIcon = (ctx: IconCtx, id: GmIconId, x: number, y: number) => {
  const art = ART[id];
  art.rows.forEach((row, ry) => {
    for (let rx = 0; rx < row.length; rx++) {
      const color = art.pal[row[rx]];
      if (!color) continue;
      ctx.fillStyle = color;
      ctx.fillRect(x + rx, y + ry, 1, 1);
    }
  });
};
