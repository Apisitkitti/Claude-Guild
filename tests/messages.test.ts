import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import settings from "@/project.inlang/settings.json";

type Pattern = string | { match: Record<string, string> }[];
type Messages = Record<string, Pattern | string>;

const load = (locale: string): Messages =>
  JSON.parse(readFileSync(new URL(`../messages/${locale}.json`, import.meta.url), "utf8"));
const dropSchema = ({ $schema: _schema, ...rest }: Messages) => rest;

/** every `{param}` used in any variant of a message, sorted */
function params(p: Pattern | string): string[] {
  const texts = typeof p === "string" ? [p] : p.flatMap((v) => Object.values(v.match));
  return [...new Set(texts.flatMap((t) => [...t.matchAll(/\{(\w+)\}/g)].map((m) => m[1])))].sort();
}

describe("messages", () => {
  const [base, ...others] = settings.locales.toSorted((a, b) =>
    a === settings.baseLocale ? -1 : b === settings.baseLocale ? 1 : 0,
  );
  const baseMessages = dropSchema(load(base));

  it("th is the base locale and en is the other locale", () => {
    expect(settings.baseLocale).toBe("th");
    expect(settings.locales).toEqual(["th", "en"]);
  });

  for (const locale of others) {
    describe(locale, () => {
      const messages = dropSchema(load(locale));
      it("has exactly the same keys as the base locale", () => {
        expect(Object.keys(messages).sort()).toEqual(Object.keys(baseMessages).sort());
      });
      it("uses the same {param} placeholders per key", () => {
        for (const key of Object.keys(baseMessages))
          expect([key, params(messages[key])]).toEqual([key, params(baseMessages[key])]);
      });
      it("has no empty messages", () => {
        for (const [key, p] of Object.entries(messages)) {
          const texts = typeof p === "string" ? [p] : p.flatMap((v) => Object.values(v.match));
          for (const t of texts) expect([key, t.trim() === ""]).toEqual([key, false]);
        }
      });
    });
  }
});
