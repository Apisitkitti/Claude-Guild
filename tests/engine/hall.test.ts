import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ev, fixedRandom, newOffice, sid, stubStorage, tick } from "./helpers";

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-01-01T13:00:00"));
  stubStorage();
  fixedRandom(0.5);
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("hall life in the engine", () => {
  it("the regulars raise their mugs when a quest is done (cheers), then settle", () => {
    const office = newOffice();
    tick(office, 1);
    expect(office.hall.patrons.every((patron) => patron.pose === "idle")).toBe(true);
    office.cheers();
    tick(office, 0.3);
    expect(office.hall.patrons[0].pose).toBe("toast");
    tick(office, 6);
    expect(office.hall.patrons.every((patron) => patron.pose !== "toast")).toBe(true);
  });

  it("an empty guild at night is quiet: candles low, the cat asleep", () => {
    vi.setSystemTime(new Date("2026-01-01T23:30:00"));
    const office = newOffice();
    tick(office, 90);
    expect(office.hall.quiet).toBe(true);
    expect(office.hall.candle).toBeLessThan(0.5);
    expect(office.hall.cat.asleep).toBe(true);
  });

  it("an adventurer in the guild keeps the night lively", () => {
    vi.setSystemTime(new Date("2026-01-01T23:30:00"));
    const office = newOffice();
    office.event(ev(sid(), "SessionStart"));
    tick(office, 30);
    expect(office.hall.quiet).toBe(false);
    expect(office.hall.candle).toBe(1);
  });
});
