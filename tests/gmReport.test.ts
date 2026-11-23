import { describe, expect, it } from "vitest";

import { GM_REASONS, gmReasonLabel } from "../components/guild/gmReport";

describe("gmReasonLabel", () => {
  it("words every reason, each one different", () => {
    const labels = GM_REASONS.map((reason) => gmReasonLabel(reason));
    expect(labels.every((label) => label.length > 0)).toBe(true);
    expect(new Set(labels).size).toBe(GM_REASONS.length);
  });
});
