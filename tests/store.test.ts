import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const readContext = vi.fn();
vi.mock("@/lib/transcript", () => ({ readContext: (p: unknown) => readContext(p) }));

type StoreMod = typeof import("../lib/store");
let m: StoreMod;
let sent: string[];
let unsub: () => void;

const ctx = (used: number) => ({ used, limit: 200000, limitGuessed: false });
const ev = (session_id: string, hook_event_name: string, extra: Record<string, unknown> = {}) =>
  m.addEvent({ session_id, hook_event_name, transcript_path: `/t/${session_id}.jsonl`, ...extra });
const contexts = () => sent.filter((c) => c.startsWith("event: context")).map((c) => JSON.parse(c.split("data: ")[1]));
const flush = async () => {
  await vi.advanceTimersByTimeAsync(600);
};

beforeEach(async () => {
  vi.useFakeTimers();
  vi.spyOn(console, "log").mockImplementation(() => {});
  readContext.mockReset();
  (globalThis as { __claudeOffice?: unknown }).__claudeOffice = undefined;
  vi.resetModules();
  m = await import("../lib/store");
  sent = [];
  unsub = m.subscribe((c) => sent.push(c));
});
afterEach(() => {
  unsub();
  const st = (globalThis as { __claudeOffice?: { timers: { ping: NodeJS.Timeout; sweep: NodeJS.Timeout } } }).__claudeOffice;
  if (st) {
    clearInterval(st.timers.ping);
    clearInterval(st.timers.sweep);
  }
  (globalThis as { __claudeOffice?: unknown }).__claudeOffice = undefined;
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("store context", () => {
  it("debounces reads into a single call and broadcasts", async () => {
    readContext.mockResolvedValue(ctx(100));
    ev("s1", "SessionStart");
    ev("s1", "PostToolUse");
    ev("s1", "Stop");
    expect(readContext).not.toHaveBeenCalled();
    await flush();
    expect(readContext).toHaveBeenCalledTimes(1);
    expect(contexts()).toEqual([{ session_id: "s1", used: 100, limit: 200000, limitGuessed: false }]);
  });

  it("snapshot includes context", async () => {
    readContext.mockResolvedValue(ctx(42));
    ev("s1", "SessionStart");
    await flush();
    expect(m.snapshot().sessions[0].context).toEqual(ctx(42));
  });

  it("PreCompact resets context and broadcasts null", async () => {
    readContext.mockResolvedValue(ctx(42));
    ev("s1", "SessionStart");
    await flush();
    ev("s1", "PreCompact");
    expect(m.snapshot().sessions[0].context).toBeNull();
    expect(contexts().at(-1)).toMatchObject({ session_id: "s1", used: null, limit: null });
    await flush();
    expect(readContext).toHaveBeenCalledTimes(1); // PreCompact schedules no read
  });

  it("SessionStart(source=compact) resets then re-reads", async () => {
    readContext.mockResolvedValueOnce(ctx(42));
    ev("s1", "SessionStart");
    await flush();
    readContext.mockResolvedValueOnce(ctx(7));
    ev("s1", "SessionStart", { source: "compact" });
    expect(m.snapshot().sessions[0].context).toBeNull();
    await flush();
    expect(m.snapshot().sessions[0].context).toEqual(ctx(7));
  });

  it("a compacted read result keeps context null", async () => {
    readContext.mockResolvedValueOnce(ctx(42));
    ev("s1", "SessionStart");
    await flush();
    readContext.mockResolvedValueOnce({ compacted: true });
    ev("s1", "Stop");
    await flush();
    expect(m.snapshot().sessions[0].context).toBeNull();
    expect(contexts().at(-1)).toMatchObject({ used: null });
  });

  it("drops a stale in-flight result after a reset", async () => {
    let resolve!: (v: unknown) => void;
    readContext.mockReturnValueOnce(new Promise((r) => (resolve = r)));
    ev("s1", "SessionStart");
    await flush(); // read now in flight
    ev("s1", "PreCompact");
    resolve(ctx(999));
    await vi.advanceTimersByTimeAsync(0);
    expect(m.snapshot().sessions[0].context).toBeNull();
    expect(contexts().some((c) => c.used === 999)).toBe(false);
  });

  it("drops an in-flight result superseded by a newer schedule", async () => {
    let resolve!: (v: unknown) => void;
    readContext.mockReturnValueOnce(new Promise((r) => (resolve = r)));
    ev("s1", "SessionStart");
    await flush();
    readContext.mockResolvedValueOnce(ctx(2));
    ev("s1", "Stop");
    resolve(ctx(1));
    await flush();
    expect(m.snapshot().sessions[0].context).toEqual(ctx(2));
  });

  it("SessionEnd clears the pending timer", async () => {
    ev("s1", "SessionStart");
    ev("s1", "SessionEnd");
    await flush();
    expect(readContext).not.toHaveBeenCalled();
    expect(m.snapshot().sessions).toHaveLength(0);
  });

  it("caps sessions, dropping the least recently seen", () => {
    for (let i = 0; i < 205; i++) {
      vi.setSystemTime(1_000_000 + i);
      m.addEvent({ session_id: `s${i}`, hook_event_name: "Notification" });
    }
    const ids = m.snapshot().sessions.map((s) => s.session_id);
    expect(ids).toHaveLength(200);
    expect(ids).not.toContain("s0");
    expect(ids).toContain("s204");
  });

  it("limits concurrent reads to 4, re-scheduling the rest", async () => {
    const resolvers: ((v: unknown) => void)[] = [];
    readContext.mockImplementation(() => new Promise((r) => resolvers.push(r)));
    for (let i = 0; i < 6; i++) ev(`s${i}`, "SessionStart");
    await flush();
    expect(readContext).toHaveBeenCalledTimes(4);
    resolvers.splice(0).forEach((r) => r(ctx(1)));
    await flush();
    await flush();
    expect(readContext).toHaveBeenCalledTimes(6);
  });
});

describe("store waiting flag", () => {
  it("tracks a main-agent permission wait and clears it on the next activity", () => {
    readContext.mockResolvedValue(null);
    ev("w1", "SessionStart");
    ev("w1", "PreToolUse");
    expect(m.snapshot().sessions[0].waiting).toBe(false);
    ev("w1", "PermissionRequest");
    expect(m.snapshot().sessions[0].waiting).toBe(true);
    ev("w1", "PostToolUse");
    expect(m.snapshot().sessions[0].waiting).toBe(false);
  });

  it("ignores squire permission requests and sets waiting on permission_prompt notifications", () => {
    readContext.mockResolvedValue(null);
    ev("w2", "SessionStart");
    ev("w2", "PermissionRequest", { agent_id: "sq1" });
    expect(m.snapshot().sessions[0].waiting).toBe(false);
    ev("w2", "Notification", { notification_type: "permission_prompt" });
    expect(m.snapshot().sessions[0].waiting).toBe(true);
  });
});

describe("store territory", () => {
  const territories = () => sent.filter((c) => c.startsWith("event: territory")).map((c) => JSON.parse(c.split("data: ")[1]));
  const edit = (sid: string, file: string, name = "PreToolUse") =>
    m.addEvent({ session_id: sid, hook_event_name: name, tool_name: "Edit", cwd: "/p", tool_input: { file_path: file } });

  it("broadcasts territory only when it changes", () => {
    ev("t1", "SessionStart");
    expect(territories()).toHaveLength(0);
    edit("t1", "/p/a.ts");
    expect(territories()).toHaveLength(1);
    expect(territories()[0]).toEqual({ claims: [{ sid: "t1", files: ["a.ts"] }], conflicts: [] });
    edit("t1", "/p/a.ts"); // same state
    ev("t1", "PostToolUse", { tool_name: "Read" });
    expect(territories()).toHaveLength(1);
    edit("t2", "/p/a.ts");
    expect(territories()).toHaveLength(2);
    expect(territories()[1].conflicts).toMatchObject([{ file: "a.ts", sids: ["t1", "t2"], level: "overlap" }]);
  });

  it("broadcasts the clash (with the failing sid) BEFORE the failure event itself reaches clients", () => {
    ev("t1", "SessionStart");
    ev("t2", "SessionStart");
    edit("t1", "/p/a.ts");
    edit("t2", "/p/a.ts");
    sent.length = 0;
    edit("t2", "/p/a.ts", "PostToolUseFailure");
    const iTerr = sent.findIndex((c) => c.startsWith("event: territory"));
    const iEvt = sent.findIndex((c) => c.includes("PostToolUseFailure") && !c.startsWith("event: territory"));
    expect(iTerr).toBeGreaterThanOrEqual(0);
    expect(iTerr).toBeLessThan(iEvt);
    expect(JSON.parse(sent[iTerr].split("data: ")[1]).conflicts).toMatchObject([{ level: "clash", failer: "t2" }]);
  });

  it("includes territory in the snapshot and releases on SessionEnd", () => {
    expect(m.snapshot().territory).toEqual({ claims: [], conflicts: [] });
    ev("t1", "SessionStart");
    edit("t1", "/p/a.ts");
    expect(m.snapshot().territory.claims).toEqual([{ sid: "t1", files: ["a.ts"] }]);
    ev("t1", "SessionEnd");
    expect(m.snapshot().territory.claims).toEqual([]);
    expect(territories().at(-1)).toEqual({ claims: [], conflicts: [] });
    const n = territories().length;
    edit("t1", "/p/b.ts"); // late event after SessionEnd must not re-claim
    expect(territories()).toHaveLength(n);
  });

  it("sweep timer expires old claims and broadcasts", async () => {
    edit("t1", "/p/a.ts");
    expect(territories()).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(11 * 60 * 1000);
    expect(territories().at(-1)).toEqual({ claims: [], conflicts: [] });
  });
});
