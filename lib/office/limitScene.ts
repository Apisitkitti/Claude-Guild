import { MS_PER_MINUTE } from "@/lib/constants";

/**
 * Wording of the "out of stamina" sign over a rate-limited adventurer: pure text helpers (canvas drawing is in
 * render.ts). Everything returned is uppercase ASCII the pixel font can draw.
 */
export const LIMIT_TITLE = "OUT OF STAMINA";

/** the server's view of a plan-limit hit */
export interface RateLimitInfo {
  /** wall-clock ms the limit was hit */
  since: number;
  /** the tool's own words for the reset, e.g. "3pm (Asia/Bangkok)" */
  resetText: string | null;
  /** wall-clock ms the limit resets (null = unknown) */
  resetsAt: number | null;
}

const MINUTES_PER_HOUR = 60;
const HOURS_PER_DAY = 24;
/** the reset line is cut to this many characters so the sign stays small */
const RESET_MAX = 16;
const RESET_TEXT_MAX = 60;

/** "1H 20M", "45M", "2D 3H" for a positive duration in ms (under a minute counts as "1M") */
export const countdownText = (ms: number): string => {
  const minutes = Math.max(1, Math.ceil(ms / MS_PER_MINUTE));
  const days = Math.floor(minutes / (MINUTES_PER_HOUR * HOURS_PER_DAY));
  const hours = Math.floor((minutes % (MINUTES_PER_HOUR * HOURS_PER_DAY)) / MINUTES_PER_HOUR);
  const rest = minutes % MINUTES_PER_HOUR;
  if (days > 0) return `${days}D ${hours}H`;
  if (hours > 0) return `${hours}H ${rest}M`;
  return `${rest}M`;
};

/** "resets 3pm (Asia/Bangkok)" -> "3PM": no "resets" prefix, no parentheses, only characters the font has */
export const resetClock = (resetText: string | null | undefined): string => {
  if (!resetText) return "";
  const text = resetText
    .replace(/\(.*?\)/g, " ")
    .replace(/\bresets?\b/gi, " ")
    .toUpperCase()
    .replace(/[^A-Z0-9 :.\-/]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return text.slice(0, RESET_MAX).trim();
};

/** the second line of the sign (null = nothing to say): a live countdown when the reset time is known, else the text */
export const limitLine = (limit: RateLimitInfo, nowMs: number): string | null => {
  if (limit.resetsAt !== null && limit.resetsAt > nowMs) return `RESETS IN ${countdownText(limit.resetsAt - nowMs)}`;
  const clock = resetClock(limit.resetText);
  return clock ? `RESETS ${clock}` : null;
};

/** both lines of the sign */
export const limitSignLines = (limit: RateLimitInfo, nowMs: number): string[] => {
  const line = limitLine(limit, nowMs);
  return line ? [LIMIT_TITLE, line] : [LIMIT_TITLE];
};

/** coerce an unknown wire value into a RateLimitInfo (null when absent or malformed) */
export const parseRateLimit = (value: unknown): RateLimitInfo | null => {
  if (!value || typeof value !== "object") return null;
  const raw = value as { since?: unknown; resetText?: unknown; resetsAt?: unknown };
  const finite = (num: unknown): num is number => typeof num === "number" && Number.isFinite(num);
  return {
    since: finite(raw.since) ? raw.since : 0,
    resetText:
      typeof raw.resetText === "string" && raw.resetText.trim() ? raw.resetText.trim().slice(0, RESET_TEXT_MAX) : null,
    resetsAt: finite(raw.resetsAt) && raw.resetsAt > 0 ? raw.resetsAt : null,
  };
};
