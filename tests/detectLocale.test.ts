import { describe, expect, it } from "vitest";

import { pickLocale } from "@/lib/detectLocale";

describe("pickLocale", () => {
  it("the stored choice beats the browser language", () => {
    expect(pickLocale("en", ["th-TH"])).toBe("en");
    expect(pickLocale("th", ["en-US"])).toBe("th");
  });
  it("Thai only when the browser prefers Thai", () => {
    expect(pickLocale(undefined, ["th"])).toBe("th");
    expect(pickLocale(undefined, ["th-TH", "en"])).toBe("th");
    expect(pickLocale(undefined, ["en-US", "th-TH"])).toBe("en");
  });
  it("any other language, none at all, or a junk cookie falls back to English / the browser", () => {
    expect(pickLocale(undefined, ["de-DE"])).toBe("en");
    expect(pickLocale(undefined, ["ja"])).toBe("en");
    expect(pickLocale(undefined, [])).toBe("en");
    expect(pickLocale("fr", ["th"])).toBe("th");
  });
});
