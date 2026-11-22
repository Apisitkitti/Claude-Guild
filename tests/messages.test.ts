import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import settings from "@/project.inlang/settings.json";

type Pattern = string | { match: Record<string, string> }[];
type Messages = Record<string, Pattern | string>;

const load = (locale: string): Messages =>
  JSON.parse(readFileSync(new URL(`../messages/${locale}.json`, import.meta.url), "utf8"));
const dropSchema = ({ $schema: _schema, ...rest }: Messages) => rest;

/** every `{param}` used in any variant of a message, sorted */
const params = (pattern: Pattern | string): string[] => {
  const texts = typeof pattern === "string" ? [pattern] : pattern.flatMap((variant) => Object.values(variant.match));
  return [...new Set(texts.flatMap((text) => [...text.matchAll(/\{(\w+)\}/g)].map((match) => match[1])))].sort();
};

describe("messages", () => {
  const [base, ...others] = settings.locales.toSorted((left, right) =>
    left === settings.baseLocale ? -1 : right === settings.baseLocale ? 1 : 0,
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
        for (const [key, pattern] of Object.entries(messages)) {
          const texts =
            typeof pattern === "string" ? [pattern] : pattern.flatMap((variant) => Object.values(variant.match));
          for (const text of texts) expect([key, text.trim() === ""]).toEqual([key, false]);
        }
      });
    });
  }
});
