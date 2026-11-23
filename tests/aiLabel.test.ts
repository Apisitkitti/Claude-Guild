import { describe, expect, it } from "vitest";

import { AI_SOURCES, aiAccent, aiInfo, aiLabel, aiShort } from "../lib/office/aiLabel";
import { PIXEL_CHARS } from "../lib/office/pixelFont";

describe("aiLabel", () => {
  it("names Claude models by family and version", () => {
    expect(aiLabel("claude", "claude-opus-5-5")).toBe("Opus 5.5");
    expect(aiLabel("claude", "claude-sonnet-4-5-20250929")).toBe("Sonnet 4.5");
    expect(aiLabel("claude", "claude-haiku-5-5")).toBe("Haiku 5.5");
    expect(aiLabel("claude", "claude-3-5-haiku-20241022")).toBe("Haiku 3.5");
    expect(aiLabel("claude", "claude-fable-5-2")).toBe("Fable 5.2");
    expect(aiLabel("claude", "claude-opus-4-1-20250805")).toBe("Opus 4.1");
    expect(aiLabel("claude", "claude-opus-5")).toBe("Opus 5");
    expect(aiLabel("claude", "claude-opus-5-5[1m]")).toBe("Opus 5.5");
  });

  it("falls back to the trimmed id for an unknown Claude id", () => {
    expect(aiLabel("claude", "  mystery-model  ")).toBe("mystery-model");
    expect(aiLabel("claude", "x".repeat(40)).length).toBeLessThanOrEqual(18);
  });

  it("shows only the tool name without a model", () => {
    expect(aiLabel("claude", null)).toBe("Claude");
    expect(aiLabel("codex", null)).toBe("Codex");
    expect(aiLabel("copilot", undefined)).toBe("Copilot");
    expect(aiLabel("cursor", "")).toBe("Cursor");
  });

  it("joins tool and model for non-Claude tools, trimming long ids", () => {
    expect(aiLabel("codex", "gpt-5-codex")).toBe("Codex · gpt-5-codex");
    const long = aiLabel("copilot", "a-very-long-model-identifier-v2");
    expect(long.startsWith("Copilot · a-very-long-mode")).toBe(true);
    expect(long.endsWith("…")).toBe(true);
    expect(long.length).toBeLessThanOrEqual("Copilot · ".length + 18);
  });
});

describe("aiShort", () => {
  it("is uppercase and drawable with the pixel font", () => {
    expect(aiShort("claude", "claude-opus-5-5")).toBe("OPUS 5.5");
    expect(aiShort("claude", "claude-sonnet-4-5-20250929")).toBe("SONNET 4.5");
    expect(aiShort("claude", null)).toBe("CLAUDE");
    expect(aiShort("codex", "gpt-5-codex")).toBe("CODEX");
    expect(aiShort("cursor", null)).toBe("CURSOR");
    for (const source of AI_SOURCES)
      for (const char of aiShort(source, "claude-opus-5-5"))
        expect(PIXEL_CHARS.includes(char) || char === ".").toBe(true);
  });
});

describe("aiAccent / aiInfo", () => {
  it("gives every tool its own opaque accent", () => {
    const colors = AI_SOURCES.map((source) => aiAccent(source));
    expect(new Set(colors).size).toBe(AI_SOURCES.length);
    for (const color of colors) expect(color).toMatch(/^#[0-9a-f]{6}$/);
  });

  it("bundles label, short form and a cleaned model", () => {
    expect(aiInfo("claude", " claude-opus-5-5 ")).toEqual({
      source: "claude",
      model: "claude-opus-5-5",
      label: "Opus 5.5",
      short: "OPUS 5.5",
    });
    expect(aiInfo("cursor", "").model).toBeNull();
  });
});
