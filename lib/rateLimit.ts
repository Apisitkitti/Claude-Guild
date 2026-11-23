// Plan usage limit ("You've hit your limit · resets 3pm (Asia/Bangkok)") helpers + model id sanitizing.
import { MS_PER_MINUTE, MS_PER_SECOND } from "@/lib/constants";

export type RateLimit = { since: number; resetText: string | null; resetsAt: number | null };

const RESET_TEXT_MAX = 40;
const MODEL_MAX = 64;
const HOURS_PER_DAY = 24;
const HALF_DAY_HOURS = 12;
const MINUTES_PER_HOUR = 60;
const LIMIT_CAP_HOURS = 6;
const LIMIT_GRACE_MINUTES = 10;
/** a limit with an unknown reset time is kept at most this long after it started */
export const LIMIT_CAP_MS = LIMIT_CAP_HOURS * MINUTES_PER_HOUR * MS_PER_MINUTE;
/** a limit with a known reset time is kept this long past it before its session may be dropped as stale */
export const LIMIT_GRACE_MS = LIMIT_GRACE_MINUTES * MS_PER_MINUTE;

/** "resets <text>" up to the end, a "·" or a newline */
const RESET_TEXT = /\bresets?\s+([^·\n\r]+)/i;
/** a clock time: "3pm", "3:30 pm", "15:00" */
const CLOCK = /(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/gi;
const ZONE = /\(([^()]+)\)/;
const INVISIBLE = /[\p{Cc}\p{Cf}]/gu;
const MODEL_CHARS = /^[A-Za-z0-9._:/@-]+$/;

/** the text after "resets" (e.g. "3pm (Asia/Bangkok)"): control / format chars removed, trimmed, capped */
export const parseResetText = (message: unknown): string | null => {
  if (typeof message !== "string") return null;
  const found = RESET_TEXT.exec(message);
  const text = (found?.[1] ?? "")
    .replace(INVISIBLE, "")
    .trim()
    .replace(/[.\s]+$/, "");
  return text ? text.slice(0, RESET_TEXT_MAX) : null;
};

const validZone = (zone: string): boolean => {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: zone });
    return true;
  } catch {
    return false;
  }
};

type Wall = { year: number; month: number; day: number };

const partsOf = (stamp: number, zone: string): Record<string, number> => {
  const format = new Intl.DateTimeFormat("en-US", {
    timeZone: zone,
    hourCycle: "h23",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
  });
  const out: Record<string, number> = {};
  for (const part of format.formatToParts(new Date(stamp))) out[part.type] = Number(part.value);
  return out;
};

const wallOf = (stamp: number, zone: string): Wall => {
  const parts = partsOf(stamp, zone);
  return { year: parts.year, month: parts.month, day: parts.day };
};

/** zone offset (ms, wall minus UTC) at `stamp` */
const offsetOf = (stamp: number, zone: string): number => {
  const parts = partsOf(stamp, zone);
  const wall = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
  return wall - Math.floor(stamp / MS_PER_SECOND) * MS_PER_SECOND;
};

/** epoch of a wall-clock time in `zone` (day may overflow: Date.UTC normalizes it) */
const zonedEpoch = (wall: Wall, hours: number, minutes: number, zone: string): number => {
  const guess = Date.UTC(wall.year, wall.month - 1, wall.day, hours, minutes);
  const first = guess - offsetOf(guess, zone);
  return guess - offsetOf(first, zone);
};

/** clock time at the end of `text` as [hours, minutes], only when no date part precedes it ("at" is allowed) */
const clockOf = (text: string): [number, number] | null => {
  const matches = [...text.matchAll(CLOCK)];
  const last = matches.at(-1);
  if (!last) return null;
  const prefix = text.slice(0, last.index).replace(/\bat\b/i, "");
  if (/[a-z0-9]/i.test(prefix)) return null; // "Nov 25, 3pm" / "Mon 9am": the date cannot be resolved reliably
  let hours = Number(last[1]);
  const minutes = last[2] === undefined ? 0 : Number(last[2]);
  const meridiem = last[3]?.toLowerCase();
  if (!meridiem && last[2] === undefined) return null;
  if (minutes >= MINUTES_PER_HOUR) return null;
  if (meridiem) {
    if (hours < 1 || hours > HALF_DAY_HOURS) return null;
    hours = (hours % HALF_DAY_HOURS) + (meridiem === "pm" ? HALF_DAY_HOURS : 0);
  } else if (hours >= HOURS_PER_DAY) return null;
  return [hours, minutes];
};

/**
 * next occurrence of the clock time in `resetText` after `messageAt` (when the limit message was written). A valid
 * IANA zone in parentheses is honoured; otherwise server local time. null when unparseable.
 */
export const parseResetsAt = (resetText: string | null, messageAt: number): number | null => {
  if (!resetText) return null;
  const zoneText = ZONE.exec(resetText)?.[1].trim();
  const zone = zoneText && validZone(zoneText) ? zoneText : null;
  const clock = clockOf(resetText.replace(ZONE, " ").trim());
  if (!clock) return null;
  const [hours, minutes] = clock;
  if (zone) {
    const wall = wallOf(messageAt, zone);
    const stamp = zonedEpoch(wall, hours, minutes, zone);
    return stamp > messageAt ? stamp : zonedEpoch({ ...wall, day: wall.day + 1 }, hours, minutes, zone);
  }
  const at = new Date(messageAt);
  at.setHours(hours, minutes, 0, 0);
  if (at.getTime() <= messageAt) {
    at.setDate(at.getDate() + 1);
    at.setHours(hours, minutes, 0, 0);
  }
  return at.getTime();
};

/** the limit of a message written at `messageAt`; null when its reset time is already past `now` (nothing to show) */
export const buildRateLimit = (message: unknown, messageAt: number, now: number = messageAt): RateLimit | null => {
  const resetText = parseResetText(message);
  const resetsAt = parseResetsAt(resetText, messageAt);
  if (resetsAt !== null && resetsAt <= now) return null;
  if (resetsAt === null && now - messageAt > LIMIT_CAP_MS) return null;
  return { since: messageAt, resetText, resetsAt };
};

export const isLimitExpired = (limit: RateLimit | null, now: number): boolean =>
  limit !== null && limit.resetsAt !== null && limit.resetsAt <= now;

/** until when a limited (silent) session must not be dropped as stale */
export const limitHoldUntil = (limit: RateLimit): number =>
  limit.resetsAt === null ? limit.since + LIMIT_CAP_MS : limit.resetsAt + LIMIT_GRACE_MS;

/** model id safe to show: string, max 64 chars, [A-Za-z0-9._:/@-] only; otherwise null ("<synthetic>" excluded) */
export const sanitizeModel = (value: unknown): string | null => {
  if (typeof value !== "string" || value.length === 0 || value.length > MODEL_MAX) return null;
  return MODEL_CHARS.test(value) ? value : null;
};
