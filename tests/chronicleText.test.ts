import { describe, expect, it } from "vitest";

import {
  chronicleFacts,
  chronicleSentences,
  chronicleStandup,
  isQuietDay,
  NO_LOCAL,
} from "../components/guild/chronicleText";
import type { ChronicleDay } from "../lib/chronicle";

const day = (extra: Partial<ChronicleDay> = {}): ChronicleDay => ({
  date: "2030-01-05",
  sessions: 3,
  projects: ["alpha", "beta"],
  prompts: 10,
  toolCalls: 50,
  tools: [{ tool: "Read", count: 30 }],
  files: 4,
  recovered: 1,
  commits: 2,
  tasks: 3,
  loops: 0,
  longestSessionMs: 600_000,
  busiestHour: 9,
  ...extra,
});

describe("chronicleText", () => {
  it("writes sentences and merges client-only counters for today only", () => {
    const local = { monsters: 5, bosses: 1, raids: 2, levels: 3 };
    const today = chronicleSentences(day(), true, local);
    const yesterday = chronicleSentences(day(), false, local);
    expect(today.length).toBe(yesterday.length + 4);
    expect(today[0]).toContain("3");
    expect(today.join(" ")).toContain("alpha, beta");
  });

  it("builds a facts grid without zero rows", () => {
    const facts = chronicleFacts(day({ loops: 0 }), true, NO_LOCAL);
    expect(facts.some((fact) => fact.value === "0")).toBe(false);
    expect(facts.length).toBeGreaterThan(5);
  });

  it("detects a quiet day", () => {
    expect(isQuietDay(day({ sessions: 0, prompts: 0, toolCalls: 0 }), NO_LOCAL)).toBe(true);
    expect(isQuietDay(day(), NO_LOCAL)).toBe(false);
  });

  it("writes a standup with Yesterday / Today bullets", () => {
    const md = chronicleStandup(
      day({ commits: 7 }),
      day({ sessions: 0, commits: 0, files: 0, recovered: 0, tasks: 0, projects: [] }),
    );
    const lines = md.split("\n");
    expect(lines[0].startsWith("## ")).toBe(true);
    expect(md).toContain("**");
    expect(md).toContain(": 7");
    expect(lines.filter((line) => line.startsWith("- ")).length).toBeGreaterThanOrEqual(2);
  });
});
