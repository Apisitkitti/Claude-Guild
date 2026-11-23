import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { readContext } from "../lib/transcript";

let root: string;
let proj: string;
let prevDir: string | undefined;

const real = (model: string) => JSON.stringify({ type: "assistant", message: { model, usage: { input_tokens: 10 } } });
const synthetic = (error: string, text: string, extra: Record<string, unknown> = {}) =>
  JSON.stringify({
    type: "assistant",
    isApiErrorMessage: true,
    error,
    message: { model: "<synthetic>", content: [{ type: "text", text }] },
    ...extra,
  });
const user = JSON.stringify({ type: "user", message: { content: "hi" } });
const write = (name: string, lines: string[]) => {
  const file = path.join(proj, name);
  writeFileSync(file, lines.join("\n") + "\n");
  return file;
};

beforeAll(() => {
  prevDir = process.env.CLAUDE_CONFIG_DIR;
  root = mkdtempSync(path.join(tmpdir(), "ctx-model-"));
  proj = path.join(root, "projects", "p1");
  mkdirSync(proj, { recursive: true });
  process.env.CLAUDE_CONFIG_DIR = root;
});
afterAll(() => {
  if (prevDir === undefined) delete process.env.CLAUDE_CONFIG_DIR;
  else process.env.CLAUDE_CONFIG_DIR = prevDir;
  rmSync(root, { recursive: true, force: true });
});

describe("readContext model", () => {
  it("returns the model of the latest real assistant line, skipping synthetic", async () => {
    const file = write("m1.jsonl", [
      real("claude-sonnet-4-5-20250929"),
      real("claude-opus-5-5"),
      synthetic("server_error", "x"),
    ]);
    expect(await readContext(file)).toMatchObject({ used: 10, model: "claude-opus-5-5" });
  });
  it("drops a model id that fails sanitizing", async () => {
    const file = write("m2.jsonl", [real("bad model!")]);
    expect(await readContext(file)).not.toHaveProperty("model");
  });
});

describe("readContext synthetic rate_limit", () => {
  const text = "You've hit your limit · resets 3pm (Asia/Bangkok)";

  it("reports a newest synthetic rate_limit line with its text", async () => {
    const file = write("r1.jsonl", [real("claude-opus-5-5"), user, synthetic("rate_limit", text)]);
    expect(await readContext(file)).toMatchObject({ model: "claude-opus-5-5", rateLimit: { text, at: null } });
  });
  it("returns the line timestamp", async () => {
    const stamp = "2026-01-10T05:00:00.000Z";
    const file = write("r6.jsonl", [real("m"), synthetic("rate_limit", text, { timestamp: stamp })]);
    expect(await readContext(file)).toMatchObject({ rateLimit: { text, at: Date.parse(stamp) } });
  });
  it("accepts apiErrorStatus 429 without an error name", async () => {
    const file = write("r2.jsonl", [real("m"), synthetic("unknown", text, { apiErrorStatus: 429 })]);
    expect(await readContext(file)).toMatchObject({ rateLimit: { text, at: null } });
  });
  it("ignores other API errors and old errors followed by a user line or a real reply", async () => {
    expect(await readContext(write("r3.jsonl", [real("m"), synthetic("server_error", "boom")]))).not.toHaveProperty(
      "rateLimit",
    );
    expect(await readContext(write("r4.jsonl", [real("m"), synthetic("rate_limit", text), user]))).not.toHaveProperty(
      "rateLimit",
    );
    expect(
      await readContext(write("r5.jsonl", [real("m"), synthetic("rate_limit", text), real("m")])),
    ).not.toHaveProperty("rateLimit");
  });
});
