import type { Office } from "./engine";
import { lookFor } from "./palette";
import { BOARD_COLS, FALL_S, PIN_S, type BoardNote } from "./questNotes";

// Draws the pinned notes on the guild hall's quest board (the board itself is part of the static hall decor).
// Everything is opaque (no alpha): pending notes are parchment tinted with the session's colour, an in-progress note
// has a pulsing gold border, a completed one wears a red wax stamp and then drops off the board.

type Ctx = CanvasRenderingContext2D;

const CELL_X0 = 8;
const CELL_Y0 = 14;
const CELL_W = 7;
const CELL_H = 9;
const NOTE_W = 5;
const NOTE_H = 6;
const PARCHMENT = "#f1e0b0";
const INK = "#5a3a1e";
const EDGE = "#7b5236";
const GLOW_A = "#ffd24a";
const GLOW_B = "#fff3b0";
const WAX = "#c0303a";
const WAX_HI = "#e8636d";
const PIN = "#d95763";
const STAMP_POP_S = 0.18;
const FALL_DIST = 34;
const SWAY = 2.5;
const OVERFLOW_X = 22;
const OVERFLOW_Y = 49;
const PULSE_HZ = 3;
/** how much of the session's colour shows on its note (0 = plain parchment) */
const TINT = 0.45;

const rect = (ctx: Ctx, color: string, x: number, y: number, width: number, height: number) => {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, width, height);
};

const channel = (hex: string, offset: number) => parseInt(hex.slice(offset, offset + 2), 16);
/** opaque blend of two #rrggbb colours */
const mix = (base: string, over: string, amount: number): string => {
  const parts = [1, 3, 5].map((offset) =>
    Math.round(channel(base, offset) * (1 - amount) + channel(over, offset) * amount)
      .toString(16)
      .padStart(2, "0"),
  );
  return `#${parts.join("")}`;
};

/** note colour per session, cached (drawn every frame); cleared when it grows past the board's session cap */
const BODY_CACHE_MAX = 64;
const bodyCache = new Map<string, string>();
const bodyColor = (sid: string): string => {
  const hit = bodyCache.get(sid);
  if (hit) return hit;
  const shirt = lookFor(sid).shirt;
  const color = /^#[0-9a-f]{6}$/i.test(shirt) ? mix(PARCHMENT, shirt, TINT) : PARCHMENT;
  if (bodyCache.size >= BODY_CACHE_MAX) bodyCache.clear();
  bodyCache.set(sid, color);
  return color;
};

const drawNote = (ctx: Ctx, note: BoardNote, time: number, reduced: boolean) => {
  const col = note.slot % BOARD_COLS;
  const row = Math.floor(note.slot / BOARD_COLS);
  let x = CELL_X0 + col * CELL_W + 1;
  let y = CELL_Y0 + row * CELL_H + 1;
  if (note.fallAt !== null) {
    const fell = Math.min(1, (time - note.fallAt) / FALL_S);
    y += Math.round(fell * fell * FALL_DIST);
    if (!reduced) x += Math.round(Math.sin(fell * 6) * SWAY * fell);
  } else if (!reduced && time - note.bornAt < PIN_S) {
    y -= Math.round((1 - (time - note.bornAt) / PIN_S) * 3); // drops onto its pin
  }
  if (note.status === "in_progress") {
    const bright = reduced || Math.sin(time * PULSE_HZ * Math.PI) > 0;
    rect(ctx, bright ? GLOW_B : GLOW_A, x - 1, y - 1, NOTE_W + 2, NOTE_H + 2);
  }
  rect(ctx, EDGE, x, y, NOTE_W, NOTE_H);
  rect(ctx, bodyColor(note.sid), x + 1, y + 1, NOTE_W - 2, NOTE_H - 2);
  rect(ctx, INK, x + 1, y + 2, NOTE_W - 2, 1);
  rect(ctx, INK, x + 1, y + 4, NOTE_W - 3, 1);
  rect(ctx, PIN, x + 2, y - 1, 1, 1);
  if (note.stampAt !== null) {
    const big = !reduced && time - note.stampAt < STAMP_POP_S;
    rect(ctx, WAX, x + (big ? 0 : 1), y + (big ? 0 : 1), big ? NOTE_W : NOTE_W - 2, big ? NOTE_H : NOTE_H - 2);
    rect(ctx, WAX_HI, x + 1, y + 1, 1, 1);
  }
};

const drawOverflow = (ctx: Ctx, count: number) => {
  const text = `+${count}`;
  ctx.font = '700 6px ui-sans-serif, system-ui, "Sukhumvit Set", "Noto Sans Thai", sans-serif';
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const width = Math.ceil(ctx.measureText(text).width) + 4;
  rect(ctx, INK, OVERFLOW_X - width / 2, OVERFLOW_Y - 4, width, 8);
  ctx.fillStyle = PARCHMENT;
  ctx.fillText(text, OVERFLOW_X, OVERFLOW_Y + 0.5);
};

export const drawQuestBoard = (ctx: Ctx, office: Office, time: number) => {
  const notes = office.board.visible(time);
  for (const note of notes) drawNote(ctx, note, time, office.reducedMotion);
  if (office.board.overflow > 0) drawOverflow(ctx, office.board.overflow);
};
