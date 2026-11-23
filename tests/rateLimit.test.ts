import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { buildRateLimit, isLimitExpired, parseResetText, parseResetsAt, sanitizeModel } from "@/lib/rateLimit";

describe("parseResetText", () => {
  it("takes the text after resets up to the dot separator", () => {
    expect(parseResetText("You've hit your limit · resets 3pm (Asia/Bangkok)")).toBe("3pm (Asia/Bangkok)");
    expect(parseResetText("Limit reached · resets 3pm (Asia/Bangkok) · /upgrade")).toBe("3pm (Asia/Bangkok)");
  });
  it("stops at a newline, trims, and caps at 40 chars", () => {
    expect(parseResetText("resets  4:30pm \nmore")).toBe("4:30pm");
    expect(parseResetText(`resets ${"x".repeat(80)}`)).toHaveLength(40);
  });
  it("strips control and bidi characters", () => {
    expect(parseResetText("resets 3\u202Epm\u0007 (UTC)")).toBe("3pm (UTC)");
  });
  it("is null without resets or for non-strings", () => {
    expect(parseResetText("You've hit your limit")).toBeNull();
    expect(parseResetText("resets ")).toBeNull();
    expect(parseResetText(undefined)).toBeNull();
  });
});

describe("parseResetsAt", () => {
  const now = new Date(2026, 0, 10, 12, 0, 0).getTime();
  const at = (day: number, hour: number, minute = 0) => new Date(2026, 0, day, hour, minute, 0, 0).getTime();

  it("parses clock times as the next local occurrence and ignores the timezone", () => {
    expect(parseResetsAt("3pm (Asia/Bangkok)", now)).toBe(at(10, 15));
    expect(parseResetsAt("3:30pm", now)).toBe(at(10, 15, 30));
    expect(parseResetsAt("15:00", now)).toBe(at(10, 15));
    expect(parseResetsAt("12am", now)).toBe(at(11, 0));
    expect(parseResetsAt("12pm", now)).toBe(at(11, 12));
  });
  it("rolls to tomorrow when the time already passed", () => {
    expect(parseResetsAt("9am", now)).toBe(at(11, 9));
  });
  it("finds the clock after an at, and refuses dates it cannot resolve", () => {
    expect(parseResetsAt("at 3pm", now)).toBe(at(10, 15));
    expect(parseResetsAt("Nov 25, 3pm", now)).toBeNull();
    expect(parseResetsAt("Mon 9am", now)).toBeNull();
  });
  it("resolves the clock in a valid IANA zone", () => {
    const base = Date.UTC(2026, 0, 10, 5, 0, 0); // 12:00 Bangkok (UTC+7)
    expect(parseResetsAt("3pm (Asia/Bangkok)", base)).toBe(Date.UTC(2026, 0, 10, 8));
    expect(parseResetsAt("9am (Asia/Bangkok)", base)).toBe(Date.UTC(2026, 0, 11, 2));
    expect(parseResetsAt("3pm (America/New_York)", base)).toBe(Date.UTC(2026, 0, 10, 20)); // UTC-5
    expect(parseResetsAt("3pm (America/New_York)", Date.UTC(2026, 6, 10, 5))).toBe(Date.UTC(2026, 6, 10, 19)); // DST
  });
  it("falls back to local time for an unknown zone", () => {
    expect(parseResetsAt("3pm (Not/AZone)", now)).toBe(at(10, 15));
  });
  it("returns null for anything unparseable", () => {
    expect(parseResetsAt(null, now)).toBeNull();
    expect(parseResetsAt("Dec 3, 3pm", now)).toBeNull();
    expect(parseResetsAt("in 2 hours", now)).toBeNull();
    expect(parseResetsAt("13pm", now)).toBeNull();
    expect(parseResetsAt("25:00", now)).toBeNull();
    expect(parseResetsAt("7", now)).toBeNull();
  });
});

describe("buildRateLimit / isLimitExpired", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("builds since / text / resetsAt", () => {
    const now = new Date(2026, 0, 10, 12, 0, 0).getTime();
    const limit = buildRateLimit("You've hit your limit · resets 3pm (Asia/Bangkok)", now);
    expect(limit).toEqual({
      since: now,
      resetText: "3pm (Asia/Bangkok)",
      resetsAt: new Date(2026, 0, 10, 15).getTime(),
    });
    expect(buildRateLimit("nope", now)).toEqual({ since: now, resetText: null, resetsAt: null });
  });
  it("is null when the reset is already past relative to now", () => {
    const written = new Date(2026, 0, 10, 12, 0, 0).getTime();
    expect(buildRateLimit("resets 3pm", written, new Date(2026, 0, 10, 16).getTime())).toBeNull();
    expect(buildRateLimit("resets 3pm", written, new Date(2026, 0, 10, 14).getTime())).not.toBeNull();
    expect(buildRateLimit("no reset", written, written + 7 * 3_600_000)).toBeNull();
  });
  it("expires only once resetsAt has passed", () => {
    expect(isLimitExpired(null, 10)).toBe(false);
    expect(isLimitExpired({ since: 0, resetText: null, resetsAt: null }, 10)).toBe(false);
    expect(isLimitExpired({ since: 0, resetText: "x", resetsAt: 10 }, 10)).toBe(true);
    expect(isLimitExpired({ since: 0, resetText: "x", resetsAt: 11 }, 10)).toBe(false);
  });
});

describe("sanitizeModel", () => {
  it("accepts plain model ids", () => {
    expect(sanitizeModel("claude-opus-5-5")).toBe("claude-opus-5-5");
    expect(sanitizeModel("gpt-5.1:high")).toBe("gpt-5.1:high");
  });
  it("rejects synthetic, long, odd or non-string values", () => {
    expect(sanitizeModel("<synthetic>")).toBeNull();
    expect(sanitizeModel("a".repeat(65))).toBeNull();
    expect(sanitizeModel("has space")).toBeNull();
    expect(sanitizeModel("")).toBeNull();
    expect(sanitizeModel(5)).toBeNull();
  });
});
