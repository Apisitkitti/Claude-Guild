import { describe, expect, it } from "vitest";

import { GM_REASONS, gmReasonLabel } from "../components/guild/gmReport";

describe("gm report limit reason", () => {
  it("ranks limit after permission and question, before loop", () => {
    expect(GM_REASONS.indexOf("limit")).toBe(GM_REASONS.indexOf("question") + 1);
    expect(GM_REASONS.indexOf("limit")).toBeLessThan(GM_REASONS.indexOf("loop"));
    expect(gmReasonLabel("limit").length).toBeGreaterThan(0);
  });
});
