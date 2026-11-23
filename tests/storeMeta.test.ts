import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const readContext = vi.fn();
vi.mock("@/lib/transcript", () => ({ readContext: (file: unknown) => readContext(file) }));

type StoreMod = typeof import("../lib/store");
let storeModule: StoreMod;
let sent: string[];
let unsub: () => void;

const LIMIT_MESSAGE = "You've hit your limit · resets 3pm (Asia/Bangkok)";
const ev = (session_id: string, hook_event_name: string, extra: Record<string, unknown> = {}) =>
  storeModule.addEvent({ session_id, hook_event_name, transcript_path: `/t/${session_id}.jsonl`, ...extra });
const metas = () =>
  sent.filter((frame) => frame.startsWith("event: session_meta")).map((frame) => JSON.parse(frame.split("data: ")[1]));
const sessionOf = (id: string) => storeModule.snapshot().sessions.find((session) => session.session_id === id);
const limitRows = () => storeModule.snapshot().attention.filter((row) => row.kind === "limit");
const flush = async () => {
  await vi.advanceTimersByTimeAsync(600);
};
const hitLimit = (id: string, message = LIMIT_MESSAGE) =>
  ev(id, "StopFailure", { error: "rate_limit", last_assistant_message: message });

beforeEach(async () => {
  vi.useFakeTimers();
  vi.setSystemTime(Date.UTC(2026, 0, 10, 5, 0, 0)); // 12:00 in Asia/Bangkok
  vi.spyOn(console, "log").mockImplementation(() => {});
  readContext.mockReset();
  readContext.mockResolvedValue(null);
  (globalThis as { __claudeOffice?: unknown }).__claudeOffice = undefined;
  vi.resetModules();
  storeModule = await import("../lib/store");
  sent = [];
  unsub = storeModule.subscribe((frame) => sent.push(frame));
});
afterEach(() => {
  unsub();
  const st = (globalThis as { __claudeOffice?: { timers: { ping: NodeJS.Timeout; sweep: NodeJS.Timeout } } })
    .__claudeOffice;
  if (st) {
    clearInterval(st.timers.ping);
    clearInterval(st.timers.sweep);
  }
  (globalThis as { __claudeOffice?: unknown }).__claudeOffice = undefined;
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("session source and model", () => {
  it("defaults to claude / null / null and sends no frame for defaults", () => {
    ev("s1", "SessionStart");
    expect(sessionOf("s1")).toMatchObject({ source: "claude", model: null, rateLimit: null });
    expect(metas()).toHaveLength(0);
  });

  it("takes agent_source and a sanitized model from events, broadcasting only on change", () => {
    ev("s1-cx", "SessionStart", { agent_source: "codex", model: "gpt-5.1-codex" });
    expect(sessionOf("s1-cx")).toMatchObject({ source: "codex", model: "gpt-5.1-codex" });
    expect(metas()).toEqual([{ session_id: "s1-cx", source: "codex", model: "gpt-5.1-codex", rateLimit: null }]);
    ev("s1-cx", "PreToolUse", { agent_source: "codex", model: "gpt-5.1-codex" });
    ev("s1-cx", "PostToolUse", { agent_source: "codex" });
    expect(metas()).toHaveLength(1);
    ev("s1-cx", "UserPromptSubmit", { agent_source: "codex", model: "not ok!" });
    expect(sessionOf("s1-cx")?.model).toBe("gpt-5.1-codex");
    ev("s1-cx", "UserPromptSubmit", { agent_source: "codex", model: "gpt-5.2" });
    expect(metas()).toHaveLength(2);
  });

  it("learns the model from the transcript read", async () => {
    readContext.mockResolvedValue({ used: 1, limit: 200000, limitGuessed: false, model: "claude-opus-5-5" });
    ev("s1", "SessionStart");
    await flush();
    expect(sessionOf("s1")?.model).toBe("claude-opus-5-5");
    expect(metas()).toEqual([{ session_id: "s1", source: "claude", model: "claude-opus-5-5", rateLimit: null }]);
    ev("s1", "PostToolUse");
    await flush();
    expect(metas()).toHaveLength(1);
  });
});

describe("rate limit", () => {
  it("StopFailure rate_limit sets the limit, broadcasts and adds one attention row (no done row)", () => {
    ev("s1", "SessionStart");
    hitLimit("s1");
    const limit = sessionOf("s1")?.rateLimit;
    expect(limit).toMatchObject({ resetText: "3pm (Asia/Bangkok)", resetsAt: Date.UTC(2026, 0, 10, 8) });
    expect(limit?.since).toBe(Date.now());
    expect(metas()).toHaveLength(1);
    expect(metas()[0].rateLimit).toEqual(limit);
    expect(limitRows()).toHaveLength(1);
    expect(limitRows()[0]).toMatchObject({ sid: "s1", detail: "3pm (Asia/Bangkok)" });
    expect(storeModule.snapshot().attention.some((row) => row.kind === "done")).toBe(false);
  });

  it("a repeated StopFailure does not announce again when the value is the same", () => {
    ev("s1", "SessionStart");
    hitLimit("s1");
    hitLimit("s1");
    expect(metas()).toHaveLength(1);
  });

  it("other errors do not set it, and text without a reset time still limits", () => {
    ev("s1", "SessionStart");
    ev("s1", "StopFailure", { error: "server_error", last_assistant_message: "boom" });
    expect(sessionOf("s1")?.rateLimit).toBeNull();
    hitLimit("s1", "You've hit your limit");
    expect(sessionOf("s1")?.rateLimit).toMatchObject({ resetText: null, resetsAt: null });
  });

  it.each(["UserPromptSubmit", "PreToolUse", "SessionStart", "Stop"])("%s clears it", (name) => {
    ev("s1", "SessionStart");
    hitLimit("s1");
    ev("s1", name);
    expect(sessionOf("s1")?.rateLimit).toBeNull();
    expect(limitRows()).toHaveLength(0);
    expect(metas().at(-1)?.rateLimit).toBeNull();
  });

  it("PostToolUse does not clear it", () => {
    ev("s1", "SessionStart");
    hitLimit("s1");
    ev("s1", "PostToolUse");
    expect(sessionOf("s1")?.rateLimit).not.toBeNull();
  });

  it("clears lazily once resetsAt has passed (snapshot and next event)", () => {
    ev("s1", "SessionStart");
    hitLimit("s1");
    vi.setSystemTime(Date.UTC(2026, 0, 10, 8, 0, 1));
    expect(sessionOf("s1")?.rateLimit).toBeNull();
    expect(limitRows()).toHaveLength(0);
    expect(metas().at(-1)?.rateLimit).toBeNull();
    hitLimit("s1");
    vi.setSystemTime(Date.UTC(2026, 0, 11, 8, 0, 1));
    ev("s1", "PostToolUse");
    expect(sessionOf("s1")?.rateLimit).toBeNull();
  });

  it("falls back to a synthetic rate_limit line from the transcript when not already set", async () => {
    readContext.mockResolvedValue({
      used: 1,
      limit: 200000,
      limitGuessed: false,
      model: "claude-opus-5-5",
      rateLimit: { text: LIMIT_MESSAGE, at: Date.now() },
    });
    ev("s1", "SessionStart");
    ev("s1", "StopFailure", { error: "unknown" });
    await flush();
    expect(sessionOf("s1")?.rateLimit).toMatchObject({ resetText: "3pm (Asia/Bangkok)" });
    expect(limitRows()).toHaveLength(1);
    const since = sessionOf("s1")?.rateLimit?.since;
    vi.setSystemTime(Date.now() + 1000);
    ev("s1", "PostToolUse");
    await flush();
    expect(sessionOf("s1")?.rateLimit?.since).toBe(since);
  });

  it("dropping the session removes the limit row", () => {
    ev("s1", "SessionStart");
    hitLimit("s1");
    ev("s1", "SessionEnd");
    expect(limitRows()).toHaveLength(0);
  });

  it("does not re-set a cleared limit from a stale transcript line", async () => {
    const staleAt = Date.now();
    readContext.mockResolvedValue({
      used: 1,
      limit: 200000,
      limitGuessed: false,
      rateLimit: { text: LIMIT_MESSAGE, at: staleAt },
    });
    ev("s1", "SessionStart");
    hitLimit("s1");
    vi.setSystemTime(staleAt + 1000);
    ev("s1", "UserPromptSubmit");
    await flush();
    expect(sessionOf("s1")?.rateLimit).toBeNull();
  });

  it("ignores a transcript limit whose reset is already past", async () => {
    readContext.mockResolvedValue({
      used: 1,
      limit: 200000,
      limitGuessed: false,
      rateLimit: { text: LIMIT_MESSAGE, at: Date.UTC(2026, 0, 9, 5) },
    });
    ev("s1", "SessionStart");
    await flush();
    expect(sessionOf("s1")?.rateLimit).toBeNull();
  });

  it("sends session_meta after the event frame of a brand-new session", () => {
    ev("s1-cx", "SessionStart", { agent_source: "codex", model: "gpt-5.1-codex" });
    const metaAt = sent.findIndex((frame) => frame.startsWith("event: session_meta"));
    const eventAt = sent.findIndex((frame) => frame.startsWith("data: ") && frame.includes('"SessionStart"'));
    expect(eventAt).toBeGreaterThanOrEqual(0);
    expect(metaAt).toBeGreaterThan(eventAt);
  });

  it("keeps a silent limited session past the 10 minute stale cutoff, until reset plus grace", () => {
    ev("s1", "SessionStart");
    hitLimit("s1");
    vi.advanceTimersByTime(30 * 60_000);
    expect(sessionOf("s1")).toBeDefined(); // still limited: resets in 3 h
    ev("s2", "SessionStart");
    vi.advanceTimersByTime(20 * 60_000);
    expect(sessionOf("s2")).toBeUndefined(); // no limit: dropped as stale
  });
});
