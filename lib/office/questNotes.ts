// Quest board notes (client side): the pinned parchment notes on the guild hall's quest board. Pure state (no canvas,
// no engine import) so it can be unit-tested. The server sends each session's todo list (`quests` frame); this turns
// the lists into notes with a small life cycle: pinned (pending / in progress) -> stamped (completed, red wax) ->
// falling off the board -> gone. Slots are stable: a note keeps its place on the board until it leaves.

/** columns x rows of notes on the board; more open quests than this show as "+N" */
export const BOARD_COLS = 4;
export const BOARD_ROWS = 3;
export const BOARD_SLOTS = BOARD_COLS * BOARD_ROWS;
/** seconds a completed note shows its wax stamp before it falls */
export const STAMP_S = 2;
/** seconds a note takes to fall off the board */
export const FALL_S = 0.8;
/** seconds the pin-in animation of a new note lasts */
export const PIN_S = 0.3;

/** limits on what a `quests` frame may carry (same caps as the server, defence in depth) */
const MAX_ROWS = 12;
const MAX_ITEMS = 40;
const TEXT_MAX = 120;
const PROJECT_MAX = 60;
const SID_MAX = 128;

export type QuestStatus = "pending" | "in_progress" | "completed";
export interface QuestMsgItem {
  text: string;
  status: QuestStatus;
  active?: string;
}
export interface QuestMsgRow {
  sid: string;
  project: string;
  updatedAt: number;
  items: QuestMsgItem[];
}

const STATUSES: readonly string[] = ["pending", "in_progress", "completed"];

/** keep only well-formed rows / items, clipped to the caps */
export const sanitizeQuests = (rows: unknown): QuestMsgRow[] => {
  const out: QuestMsgRow[] = [];
  if (!Array.isArray(rows)) return out;
  for (const row of rows.slice(0, MAX_ROWS)) {
    if (!row || typeof row !== "object" || typeof row.sid !== "string" || !row.sid || !Array.isArray(row.items))
      continue;
    const items: QuestMsgItem[] = [];
    for (const item of row.items.slice(0, MAX_ITEMS)) {
      if (!item || typeof item.text !== "string" || !item.text || !STATUSES.includes(item.status)) continue;
      items.push({
        text: item.text.slice(0, TEXT_MAX),
        status: item.status,
        ...(typeof item.active === "string" && item.active ? { active: item.active.slice(0, TEXT_MAX) } : {}),
      });
    }
    if (!items.length) continue;
    out.push({
      sid: row.sid.slice(0, SID_MAX),
      project: typeof row.project === "string" ? row.project.slice(0, PROJECT_MAX) : "",
      updatedAt: Number.isFinite(Number(row.updatedAt)) ? Number(row.updatedAt) : 0,
      items,
    });
  }
  return out;
};

/** identity of a todo across list rewrites: session + text + how many identical texts came before it */
export const itemKeys = (row: QuestMsgRow): string[] => {
  const seen = new Map<string, number>();
  return row.items.map((item) => {
    const base = `${row.sid}|${item.text}`;
    const count = seen.get(base) ?? 0;
    seen.set(base, count + 1);
    return `${base}|${count}`;
  });
};

export interface BoardNote {
  key: string;
  sid: string;
  status: QuestStatus;
  slot: number;
  /** clock time the note was pinned */
  bornAt: number;
  /** clock time its wax stamp landed (null while open) */
  stampAt: number | null;
  /** clock time it started falling (null until then) */
  fallAt: number | null;
}

export class BoardNotes {
  private notes: BoardNote[] = [];
  /** open quests that did not get a slot */
  private overflowCount = 0;

  clear() {
    this.notes = [];
    this.overflowCount = 0;
  }

  /**
   * Take a new full set of todo lists. `instant` (reduced motion): a completed note is removed at once, no stamp / fall.
   * A completed todo never gets a note of its own: only a note that was open can be stamped.
   * Returns how many open notes got their wax stamp (or, `instant`, were removed as completed) in this update.
   */
  update(rows: QuestMsgRow[], now: number, instant = false): number {
    let stamped = 0;
    const wanted = new Map<string, { sid: string; status: QuestStatus; order: number }>();
    let order = 0;
    for (const row of rows) {
      const keys = itemKeys(row);
      row.items.forEach((item, index) =>
        wanted.set(keys[index], { sid: row.sid, status: item.status, order: order++ }),
      );
    }
    const kept: BoardNote[] = [];
    for (const note of this.notes) {
      const wantedItem = wanted.get(note.key);
      if (note.fallAt !== null || note.stampAt !== null) {
        kept.push(note); // already leaving: let it finish
        continue;
      }
      if (wantedItem && wantedItem.status !== "completed") {
        note.status = wantedItem.status;
        kept.push(note);
      } else if (wantedItem && !instant) {
        note.status = "completed";
        note.stampAt = now;
        stamped++;
        kept.push(note);
      } else if (wantedItem) {
        stamped++; // reduced motion: completed, gone at once
      } else if (!wantedItem && !instant) {
        note.fallAt = now; // the list was rewritten without it: it just drops off
        kept.push(note);
      }
    }
    const taken = new Set(kept.map((note) => note.slot));
    const have = new Set(kept.map((note) => note.key));
    const open = [...wanted.entries()]
      .filter(([key, item]) => item.status !== "completed" && !have.has(key))
      .sort(
        ([, first], [, second]) =>
          Number(second.status === "in_progress") - Number(first.status === "in_progress") ||
          first.order - second.order,
      );
    for (const [key, item] of open) {
      let slot = 0;
      while (slot < BOARD_SLOTS && taken.has(slot)) slot++;
      if (slot >= BOARD_SLOTS) break;
      taken.add(slot);
      kept.push({ key, sid: item.sid, status: item.status, slot, bornAt: now, stampAt: null, fallAt: null });
    }
    this.notes = kept;
    const openTotal = [...wanted.values()].filter((item) => item.status !== "completed").length;
    this.overflowCount = Math.max(
      0,
      openTotal - kept.filter((note) => note.stampAt === null && note.fallAt === null).length,
    );
    return stamped;
  }

  /** "+N" count of open quests without a note */
  get overflow(): number {
    return this.overflowCount;
  }

  /** drop notes that finished falling; returns the notes still on (or falling off) the board */
  visible(now: number): BoardNote[] {
    for (const note of this.notes)
      if (note.stampAt !== null && note.fallAt === null && now - note.stampAt >= STAMP_S) note.fallAt = now;
    if (this.notes.some((note) => note.fallAt !== null && now - note.fallAt >= FALL_S))
      this.notes = this.notes.filter((note) => note.fallAt === null || now - note.fallAt < FALL_S); // only when one left
    return this.notes;
  }

  /** open notes (pending + in progress), for tests / a11y summaries */
  get openCount(): number {
    return this.notes.filter((note) => note.stampAt === null && note.fallAt === null).length;
  }
}
