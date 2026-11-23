import { describe, expect, it } from "vitest";

import { countdownText, limitLine, limitSignLines, parseRateLimit, resetClock } from "../lib/office/limitScene";
import { PIXEL_CHARS } from "../lib/office/pixelFont";

const NOW = 1_700_000_000_000;
const HOUR = 3_600_000;
const MINUTE = 60_000;
const hit = { since: NOW - MINUTE, resetText: "3pm (Asia/Bangkok)", resetsAt: null };

describe("limit sign wording", () => {
  it("formats countdowns", () => {
    expect(countdownText(80 * MINUTE)).toBe("1H 20M");
    expect(countdownText(45 * MINUTE)).toBe("45M");
    expect(countdownText(5_000)).toBe("1M");
    expect(countdownText(51 * HOUR)).toBe("2D 3H");
  });

  it("builds the reset line from the reset text", () => {
    expect(resetClock("resets 3pm (Asia/Bangkok)")).toBe("3PM");
    expect(limitLine(hit, NOW)).toBe("RESETS 3PM");
    expect(limitSignLines(hit, NOW)).toEqual(["OUT OF STAMINA", "RESETS 3PM"]);
  });

  it("prefers a live countdown when the reset time is in the future", () => {
    expect(limitLine({ ...hit, resetsAt: NOW + 80 * MINUTE }, NOW)).toBe("RESETS IN 1H 20M");
    // already past: back to the text
    expect(limitLine({ ...hit, resetsAt: NOW - 1 }, NOW)).toBe("RESETS 3PM");
  });

  it("shows only the title when nothing about the reset is known", () => {
    expect(limitSignLines({ since: NOW, resetText: null, resetsAt: null }, NOW)).toEqual(["OUT OF STAMINA"]);
    expect(limitLine({ since: NOW, resetText: "(UTC)", resetsAt: null }, NOW)).toBeNull();
  });

  it("only produces characters the pixel font draws, and keeps the line short", () => {
    const lines = limitSignLines(
      { since: NOW, resetText: "Resets Mon 9:00am — weekly «limit» reached", resetsAt: null },
      NOW,
    );
    for (const line of lines) for (const char of line) expect(PIXEL_CHARS.includes(char)).toBe(true);
    expect(lines[1].length).toBeLessThanOrEqual("RESETS ".length + 16);
  });

  it("parses wire values defensively", () => {
    expect(parseRateLimit(null)).toBeNull();
    expect(parseRateLimit("x")).toBeNull();
    expect(parseRateLimit({ since: 5, resetText: "  4pm ", resetsAt: 9 })).toEqual({
      since: 5,
      resetText: "4pm",
      resetsAt: 9,
    });
    expect(parseRateLimit({ since: "no", resetText: 3, resetsAt: -1 })).toEqual({
      since: 0,
      resetText: null,
      resetsAt: null,
    });
  });
});
