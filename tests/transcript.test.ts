import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { readContext } from "../lib/transcript";

let root: string;
let outside: string;
let proj: string;
const prevEnv = { dir: process.env.CLAUDE_CONFIG_DIR, lim: process.env.CLAUDE_OFFICE_CTX_LIMIT };

const asst = (usage: Record<string, number> | undefined, extra: Record<string, unknown> = {}) =>
  JSON.stringify({ type: "assistant", message: { model: "claude-x", usage }, ...extra });
const used = (result: Awaited<ReturnType<typeof readContext>>) =>
  result && "used" in result ? result.used : undefined;
const write = (name: string, lines: string[], dir = proj) => {
  const file = path.join(dir, name);
  writeFileSync(file, lines.join("\n") + "\n");
  return file;
};

beforeAll(() => {
  root = mkdtempSync(path.join(tmpdir(), "ctx-cfg-"));
  outside = mkdtempSync(path.join(tmpdir(), "ctx-out-"));
  proj = path.join(root, "projects", "p1");
  mkdirSync(proj, { recursive: true });
  process.env.CLAUDE_CONFIG_DIR = root;
});
beforeEach(() => {
  delete process.env.CLAUDE_OFFICE_CTX_LIMIT;
});
afterAll(() => {
  if (prevEnv.dir === undefined) delete process.env.CLAUDE_CONFIG_DIR;
  else process.env.CLAUDE_CONFIG_DIR = prevEnv.dir;
  if (prevEnv.lim !== undefined) process.env.CLAUDE_OFFICE_CTX_LIMIT = prevEnv.lim;
  rmSync(root, { recursive: true, force: true });
  rmSync(outside, { recursive: true, force: true });
});

describe("readContext", () => {
  it("sums input + cache tokens from the latest assistant line", async () => {
    const file = write("a.jsonl", [
      asst({ input_tokens: 1, cache_read_input_tokens: 1, cache_creation_input_tokens: 1 }),
      JSON.stringify({ type: "user", message: {} }),
      asst({ input_tokens: 10, cache_read_input_tokens: 2000, cache_creation_input_tokens: 300 }),
    ]);
    expect(await readContext(file)).toEqual({ used: 2310, limit: 200000, limitGuessed: false });
  });

  it("treats missing fields as 0", async () => {
    const file = write("m.jsonl", [asst({ input_tokens: 5 })]);
    expect(used(await readContext(file))).toBe(5);
  });

  it("skips synthetic and sidechain lines", async () => {
    const file = write("s.jsonl", [
      asst({ input_tokens: 100 }),
      JSON.stringify({ type: "assistant", message: { model: "<synthetic>", usage: { input_tokens: 999 } } }),
      asst({ input_tokens: 888 }, { isSidechain: true }),
    ]);
    expect(used(await readContext(file))).toBe(100);
  });

  it("ignores malformed lines", async () => {
    const file = write("bad.jsonl", [asst({ input_tokens: 42 }), "{not json", "", "[1,2"]);
    expect(used(await readContext(file))).toBe(42);
  });

  it("returns null when nothing usable", async () => {
    expect(await readContext(write("none.jsonl", ["{}", "garbage"]))).toBeNull();
  });

  it("rejects paths outside the base, non-jsonl, and bad input", async () => {
    const out = write("o.jsonl", [asst({ input_tokens: 1 })], outside);
    expect(await readContext(out)).toBeNull();
    const txt = path.join(proj, "x.txt");
    writeFileSync(txt, asst({ input_tokens: 1 }));
    expect(await readContext(txt)).toBeNull();
    expect(await readContext(undefined)).toBeNull();
    expect(await readContext(path.join(proj, "missing.jsonl"))).toBeNull();
    // sibling dir sharing the "projects" prefix must not pass
    const sib = path.join(root, "projects-evil");
    mkdirSync(sib, { recursive: true });
    expect(await readContext(write("e.jsonl", [asst({ input_tokens: 1 })], sib))).toBeNull();
  });

  it("rejects a symlink escaping the base", async () => {
    const target = write("t.jsonl", [asst({ input_tokens: 7 })], outside);
    const link = path.join(proj, "link.jsonl");
    symlinkSync(target, link);
    expect(await readContext(link)).toBeNull();
  });

  it("marks limit guessed as 1M when used exceeds 200k", async () => {
    const file = write("big.jsonl", [asst({ input_tokens: 10, cache_read_input_tokens: 250000 })]);
    expect(await readContext(file)).toEqual({ used: 250010, limit: 1_000_000, limitGuessed: true });
  });

  it("honors CLAUDE_OFFICE_CTX_LIMIT", async () => {
    process.env.CLAUDE_OFFICE_CTX_LIMIT = "500000";
    const file = write("lim.jsonl", [asst({ input_tokens: 250000 })]);
    expect(await readContext(file)).toEqual({ used: 250000, limit: 500000, limitGuessed: false });
  });

  it("reads only the tail window of a large file", async () => {
    const filler = JSON.stringify({ type: "user", message: { content: "x".repeat(1000) } });
    const lines = [asst({ input_tokens: 1 })];
    for (let i = 0; i < 600; i++) lines.push(filler); // ~600KB
    lines.push(asst({ input_tokens: 777 }));
    expect(used(await readContext(write("tail.jsonl", lines)))).toBe(777);
    // latest usage lives outside the tail window -> not found
    const old = [asst({ input_tokens: 1 })];
    for (let i = 0; i < 600; i++) old.push(filler);
    expect(await readContext(write("old.jsonl", old))).toBeNull();
  });

  it("ignores non-finite or non-positive CLAUDE_OFFICE_CTX_LIMIT", async () => {
    const file = write("lim2.jsonl", [asst({ input_tokens: 10 })]);
    for (const value of ["abc", "-5", "0", "Infinity"]) {
      process.env.CLAUDE_OFFICE_CTX_LIMIT = value;
      expect(await readContext(file)).toEqual({ used: 10, limit: 200000, limitGuessed: false });
    }
  });

  it("returns compacted after a compact_boundary with no later usage", async () => {
    const file = write("c1.jsonl", [
      asst({ input_tokens: 150000 }),
      JSON.stringify({ type: "system", subtype: "compact_boundary" }),
    ]);
    expect(await readContext(file)).toEqual({ compacted: true });
  });

  it("returns compacted after an isCompactSummary line", async () => {
    const file = write("c2.jsonl", [
      asst({ input_tokens: 150000 }),
      JSON.stringify({ type: "system", subtype: "compact_boundary" }),
      JSON.stringify({ type: "user", isCompactSummary: true, message: {} }),
    ]);
    expect(await readContext(file)).toEqual({ compacted: true });
  });

  it("uses usage that comes after a compact boundary", async () => {
    const file = write("c3.jsonl", [
      asst({ input_tokens: 150000 }),
      JSON.stringify({ type: "system", subtype: "compact_boundary" }),
      asst({ input_tokens: 5000 }),
    ]);
    expect(await readContext(file)).toEqual({ used: 5000, limit: 200000, limitGuessed: false });
  });
});
