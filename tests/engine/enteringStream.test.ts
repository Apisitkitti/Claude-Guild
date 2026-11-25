import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DESK_COUNT } from "@/lib/office/layout";

import { emp, ev, fixedRandom, newOffice, sid, stubStorage, tick } from "./helpers";

const STEP = 0.05;
const CALL_EVERY_S = 0.4;
/** the longest walk (door, board, gate, far battle spot) takes ~17 s at full speed */
const SEATED_WITHIN_S = 20;

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
  stubStorage();
  fixedRandom(0.5);
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("an entering adventurer with a steady stream of tool events", () => {
  it.each([1, 3, DESK_COUNT, DESK_COUNT + 1])(
    "still reaches its seat within its walk time (%i adventurers)",
    (count) => {
      const office = newOffice();
      const ids = Array.from({ length: count }, () => sid());
      for (const id of ids) office.event(ev(id, "SessionStart"));
      const id = ids[ids.length - 1];
      office.event(ev(id, "UserPromptSubmit"));
      let calls = 0;
      for (let k = 0; k < 40; k++) {
        office.event(ev(id, "PreToolUse", { tool_name: "Read", tool_use_id: `r${k}` }));
        office.event(ev(id, "PostToolUse", { tool_name: "Read", tool_use_id: `r${k}` }));
      }
      let seatedAt = -1;
      for (let elapsed = 0; elapsed < SEATED_WITHIN_S * 2; elapsed += CALL_EVERY_S) {
        const key = `k${calls++}`;
        office.event(ev(id, "PreToolUse", { tool_name: "Bash", tool_use_id: key }));
        office.event(ev(id, "PostToolUse", { tool_name: "Bash", tool_use_id: key }));
        tick(office, CALL_EVERY_S, STEP);
        if (seatedAt < 0 && emp(office, id).state !== "ENTERING") seatedAt = elapsed;
      }
      expect(seatedAt).toBeGreaterThanOrEqual(0);
      expect(seatedAt).toBeLessThan(SEATED_WITHIN_S);
    },
  );
});
