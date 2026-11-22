import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const readContext = vi.fn();
vi.mock("@/lib/transcript", () => ({ readContext: (file: unknown) => readContext(file) }));

type StoreMod = typeof import("../lib/store");
let storeModule: StoreMod;
let sent: string[];
let unsub: () => void;

const ctx = (used: number) => ({ used, limit: 200000, limitGuessed: false });
const ev = (session_id: string, hook_event_name: string, extra: Record<string, unknown> = {}) =>
  storeModule.addEvent({ session_id, hook_event_name, transcript_path: `/t/${session_id}.jsonl`, ...extra });
const contexts = () =>
  sent.filter((frame) => frame.startsWith("event: context")).map((frame) => JSON.parse(frame.split("data: ")[1]));
const flush = async () => {
  await vi.advanceTimersByTimeAsync(600);
};

beforeEach(async () => {
  vi.useFakeTimers();
  vi.spyOn(console, "log").mockImplementation(() => {});
  readContext.mockReset();
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
    expect(storeModule.snapshot().sessions[0].context).toEqual(ctx(42));
  });

  it("PreCompact resets context and broadcasts null", async () => {
    readContext.mockResolvedValue(ctx(42));
    ev("s1", "SessionStart");
    await flush();
    ev("s1", "PreCompact");
    expect(storeModule.snapshot().sessions[0].context).toBeNull();
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
    expect(storeModule.snapshot().sessions[0].context).toBeNull();
    await flush();
    expect(storeModule.snapshot().sessions[0].context).toEqual(ctx(7));
  });

  it("a compacted read result keeps context null", async () => {
    readContext.mockResolvedValueOnce(ctx(42));
    ev("s1", "SessionStart");
    await flush();
    readContext.mockResolvedValueOnce({ compacted: true });
    ev("s1", "Stop");
    await flush();
    expect(storeModule.snapshot().sessions[0].context).toBeNull();
    expect(contexts().at(-1)).toMatchObject({ used: null });
  });

  it("drops a stale in-flight result after a reset", async () => {
    let resolve!: (v: unknown) => void;
    readContext.mockReturnValueOnce(new Promise((done) => (resolve = done)));
    ev("s1", "SessionStart");
    await flush(); // read now in flight
    ev("s1", "PreCompact");
    resolve(ctx(999));
    await vi.advanceTimersByTimeAsync(0);
    expect(storeModule.snapshot().sessions[0].context).toBeNull();
    expect(contexts().some((frame) => frame.used === 999)).toBe(false);
  });

  it("drops an in-flight result superseded by a newer schedule", async () => {
    let resolve!: (v: unknown) => void;
    readContext.mockReturnValueOnce(new Promise((done) => (resolve = done)));
    ev("s1", "SessionStart");
    await flush();
    readContext.mockResolvedValueOnce(ctx(2));
    ev("s1", "Stop");
    resolve(ctx(1));
    await flush();
    expect(storeModule.snapshot().sessions[0].context).toEqual(ctx(2));
  });

  it("SessionEnd clears the pending timer", async () => {
    ev("s1", "SessionStart");
    ev("s1", "SessionEnd");
    await flush();
    expect(readContext).not.toHaveBeenCalled();
    expect(storeModule.snapshot().sessions).toHaveLength(0);
  });

  it("caps sessions, dropping the least recently seen", () => {
    for (let i = 0; i < 205; i++) {
      vi.setSystemTime(1_000_000 + i);
      storeModule.addEvent({ session_id: `s${i}`, hook_event_name: "Notification" });
    }
    const ids = storeModule.snapshot().sessions.map((snapshot) => snapshot.session_id);
    expect(ids).toHaveLength(200);
    expect(ids).not.toContain("s0");
    expect(ids).toContain("s204");
  });

  it("limits concurrent reads to 4, re-scheduling the rest", async () => {
    const resolvers: ((v: unknown) => void)[] = [];
    readContext.mockImplementation(() => new Promise((done) => resolvers.push(done)));
    for (let i = 0; i < 6; i++) ev(`s${i}`, "SessionStart");
    await flush();
    expect(readContext).toHaveBeenCalledTimes(4);
    resolvers.splice(0).forEach((row) => row(ctx(1)));
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
    expect(storeModule.snapshot().sessions[0].waiting).toBe(false);
    ev("w1", "PermissionRequest");
    expect(storeModule.snapshot().sessions[0].waiting).toBe(true);
    ev("w1", "PostToolUse");
    expect(storeModule.snapshot().sessions[0].waiting).toBe(false);
  });

  it("ignores squire permission requests and sets waiting on permission_prompt notifications", () => {
    readContext.mockResolvedValue(null);
    ev("w2", "SessionStart");
    ev("w2", "PermissionRequest", { agent_id: "sq1" });
    expect(storeModule.snapshot().sessions[0].waiting).toBe(false);
    ev("w2", "Notification", { notification_type: "permission_prompt" });
    expect(storeModule.snapshot().sessions[0].waiting).toBe(true);
  });
});

describe("store territory", () => {
  const territories = () =>
    sent.filter((frame) => frame.startsWith("event: territory")).map((frame) => JSON.parse(frame.split("data: ")[1]));
  const edit = (sid: string, file: string, name = "PreToolUse") =>
    storeModule.addEvent({
      session_id: sid,
      hook_event_name: name,
      tool_name: "Edit",
      cwd: "/p",
      tool_input: { file_path: file },
    });

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
    const iTerr = sent.findIndex((frame) => frame.startsWith("event: territory"));
    const iEvt = sent.findIndex(
      (frame) => frame.includes("PostToolUseFailure") && !frame.startsWith("event: territory"),
    );
    expect(iTerr).toBeGreaterThanOrEqual(0);
    expect(iTerr).toBeLessThan(iEvt);
    expect(JSON.parse(sent[iTerr].split("data: ")[1]).conflicts).toMatchObject([{ level: "clash", failer: "t2" }]);
  });

  it("includes territory in the snapshot and releases on SessionEnd", () => {
    expect(storeModule.snapshot().territory).toEqual({ claims: [], conflicts: [] });
    ev("t1", "SessionStart");
    edit("t1", "/p/a.ts");
    expect(storeModule.snapshot().territory.claims).toEqual([{ sid: "t1", files: ["a.ts"] }]);
    ev("t1", "SessionEnd");
    expect(storeModule.snapshot().territory.claims).toEqual([]);
    expect(territories().at(-1)).toEqual({ claims: [], conflicts: [] });
    const count = territories().length;
    edit("t1", "/p/b.ts"); // late event after SessionEnd must not re-claim
    expect(territories()).toHaveLength(count);
  });

  it("sweep timer expires old claims and broadcasts", async () => {
    edit("t1", "/p/a.ts");
    expect(territories()).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(11 * 60 * 1000);
    expect(territories().at(-1)).toEqual({ claims: [], conflicts: [] });
  });
});

describe("store attention (Lookout Bell)", () => {
  const frames = () =>
    sent
      .filter((frame) => frame.startsWith("event: attention"))
      .map((frame) => JSON.parse(frame.split("data: ")[1]) as { kind: string; sid: string }[]);
  const failBash = (sid: string, i: number) =>
    ev(sid, "PostToolUseFailure", {
      tool_name: "Bash",
      tool_input: { command: "npm test" },
      error: "boom 1",
      tool_use_id: "t" + i,
    });

  it("detects a loop from RAW events, broadcasts an attention frame, never leaks the message", () => {
    readContext.mockResolvedValue(null);
    ev("a1", "SessionStart");
    for (let i = 0; i < 3; i++) failBash("a1", i);
    const last = frames().at(-1)!;
    expect(last.map((row) => row.kind)).toEqual(["loop"]);
    expect(storeModule.snapshot().attention.map((row) => row.kind)).toEqual(["loop"]);
    ev("a1", "UserPromptSubmit");
    expect(frames().at(-1)).toEqual([]);
  });

  it("reads last_assistant_message before it is stripped; stored events never contain it", () => {
    readContext.mockResolvedValue(null);
    ev("a2", "SessionStart");
    ev("a2", "Stop", { last_assistant_message: "ใช้ Prisma ไหมครับ?" });
    expect(storeModule.snapshot().attention[0]).toMatchObject({ kind: "asked", sid: "a2" });
    expect(JSON.stringify(storeModule.snapshot().events)).not.toContain("Prisma");
  });

  it("permission waits become rows with waitingSince and clear on activity", () => {
    readContext.mockResolvedValue(null);
    ev("a3", "SessionStart");
    ev("a3", "PermissionRequest");
    const snapshot = storeModule.snapshot();
    expect(snapshot.sessions[0].waitingSince).toEqual(expect.any(Number));
    expect(snapshot.attention[0]).toMatchObject({ kind: "permission", sid: "a3" });
    ev("a3", "PostToolUse");
    expect(storeModule.snapshot().attention).toEqual([]);
    expect(storeModule.snapshot().sessions[0].waitingSince).toBeNull();
  });

  it("context >= 85% adds a row; SessionEnd drops the session's rows", async () => {
    readContext.mockResolvedValue(ctx(180000));
    ev("a4", "SessionStart");
    await flush();
    expect(storeModule.snapshot().attention.map((row) => row.kind)).toContain("context");
    ev("a4", "SessionEnd");
    expect(storeModule.snapshot().attention).toEqual([]);
  });

  it("a guessed context limit never raises the context row", async () => {
    readContext.mockResolvedValue({ used: 190000, limit: 200000, limitGuessed: true });
    ev("a6", "SessionStart");
    await flush();
    expect(storeModule.snapshot().attention.map((row) => row.kind)).not.toContain("context");
  });

  it("sweep timer expires old done rows", async () => {
    readContext.mockResolvedValue(null);
    ev("a5", "SessionStart");
    ev("a5", "Stop", { last_assistant_message: "ok" });
    expect(storeModule.snapshot().attention).toHaveLength(1);
    ev("a5b", "SessionStart");
    await vi.advanceTimersByTimeAsync(31 * 60 * 1000);
    expect(storeModule.snapshot().attention).toEqual([]);
  });
});

describe("store redaction (no secret is stored, broadcast or kept as tracker text)", () => {
  const SECRET = "sk-proj-abc123def456ghi789jkl012mno345";
  const BEARER = "Bearer eyJhbGciOiJIUzI1NiJ9abcdef123456";

  it("scrubs events (stored, snapshot, SSE) but keeps the useful hint", () => {
    readContext.mockResolvedValue(null);
    ev("x1", "SessionStart");
    ev("x1", "PreToolUse", {
      tool_name: "Bash",
      tool_input: {
        command: `curl -H "Authorization: ${BEARER}" -u bob:hunter22 https://u:p4ss@h.io?token=abc999 && export GH_TOKEN=${SECRET}`,
        env: { API_KEY: "zzz" },
      },
    });
    ev("x1", "PreToolUse", {
      tool_name: "Write",
      tool_input: { file_path: "/w/.env", content: `PASSWORD=hunter2\nDB=postgres://app:s3cr3t@db/x\n${SECRET}` },
    });
    const blob = JSON.stringify(storeModule.snapshot()) + sent.join("");
    for (const leak of [SECRET, "eyJhbGci", "hunter22", "hunter2", "p4ss", "abc999", "s3cr3t", "zzz"])
      expect(blob).not.toContain(leak);
    expect(blob).toContain("‹redacted›");
    expect(storeModule.snapshot().events.at(-2)!.tool_input).toMatchObject({
      command: expect.stringContaining("curl -H"),
    });
  });

  it("attention loop rows (SSE + snapshot) never carry the secret that failed 3 times", () => {
    readContext.mockResolvedValue(null);
    ev("x2", "SessionStart");
    for (let i = 0; i < 3; i++)
      ev("x2", "PostToolUseFailure", {
        tool_name: "Bash",
        tool_input: { command: `curl -H "Authorization: ${BEARER}" https://api.io --token=${SECRET}` },
        error: `401 for Authorization: ${BEARER} key ${SECRET}`,
        tool_use_id: "f" + i,
      });
    expect(storeModule.snapshot().attention.map((row) => row.kind)).toEqual(["loop"]);
    const blob =
      JSON.stringify(storeModule.snapshot().attention) +
      sent.filter((frame) => frame.startsWith("event: attention")).join("");
    expect(blob).not.toMatch(/eyJhbGci|sk-proj/);
    expect(blob).toContain("curl");
  });

  it("the final assistant message tail kept by attention is redacted", () => {
    readContext.mockResolvedValue(null);
    ev("x3", "SessionStart");
    ev("x3", "Stop", { last_assistant_message: `Set GITHUB_TOKEN=ghp_${"a1B2c3D4e5".repeat(4)} ok?` });
    const blob = JSON.stringify(storeModule.snapshot().attention) + sent.join("");
    expect(blob).not.toContain("ghp_");
    expect(storeModule.snapshot().attention[0]).toMatchObject({ kind: "asked" });
  });

  it("a payload that makes redaction itself blow up is reduced to identifiers, not leaked", () => {
    readContext.mockResolvedValue(null);
    const evil: Record<string, unknown> = { session_id: "x4", hook_event_name: "PreToolUse", tool_name: "Bash" };
    Object.defineProperty(evil, "tool_input", {
      enumerable: true,
      get: () => {
        throw new Error("boom");
      },
    });
    expect(() => storeModule.addEvent(evil)).not.toThrow();
    expect(storeModule.snapshot().events.at(-1)).toMatchObject({ session_id: "x4", tool_name: "Bash" });
  });
});

describe("store receipts (Receipt Ledger)", () => {
  const frames = () =>
    sent
      .filter((frame) => frame.startsWith("event: receipts"))
      .map(
        (frame) =>
          JSON.parse(frame.split("data: ")[1]) as { sid: string; verdict: string; files: number; commits: number }[],
      );
  const turnOf = (sid: string, count: number) => {
    ev(sid, "UserPromptSubmit", { cwd: "/w/guild" });
    for (let i = 0; i < count; i++)
      ev(sid, "PostToolUse", {
        tool_name: "Edit",
        tool_input: { file_path: `/w/guild/f${i}.ts` },
        tool_use_id: `${sid}e${i}`,
        cwd: "/w/guild",
      });
    ev(sid, "PostToolUse", {
      tool_name: "Bash",
      tool_input: { command: "git commit -m x" },
      tool_use_id: `${sid}c`,
      cwd: "/w/guild",
    });
  };

  it("snapshot starts with an empty ledger; Stop closes the turn, broadcasts a receipts frame", () => {
    readContext.mockResolvedValue(null);
    expect(storeModule.snapshot().receipts).toEqual([]);
    ev("r1", "SessionStart");
    turnOf("r1", 2);
    expect(frames()).toEqual([]); // open turns are not published
    ev("r1", "Stop");
    expect(frames().at(-1)).toEqual([
      expect.objectContaining({ sid: "r1", files: 2, commits: 1, verdict: "done", project: "guild" }),
    ]);
    expect(storeModule.snapshot().receipts).toEqual(frames().at(-1));
  });

  it("broadcasts only when the ledger changes", () => {
    readContext.mockResolvedValue(null);
    ev("r2", "SessionStart");
    turnOf("r2", 1);
    ev("r2", "Stop");
    const count = frames().length;
    ev("r2", "Notification");
    ev("r2", "PreToolUse", { tool_name: "Read" });
    expect(frames()).toHaveLength(count);
  });

  it("receipts survive SessionEnd and a stale sweep, then expire after 2h", async () => {
    readContext.mockResolvedValue(null);
    ev("r3", "SessionStart");
    turnOf("r3", 1);
    ev("r3", "Stop");
    ev("r3", "SessionEnd");
    expect(storeModule.snapshot().sessions).toEqual([]);
    expect(storeModule.snapshot().receipts).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(15 * 60 * 1000);
    expect(storeModule.snapshot().receipts).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(2 * 60 * 60 * 1000);
    expect(storeModule.snapshot().receipts).toEqual([]);
    expect(frames().at(-1)).toEqual([]);
  });

  it("a session that went stale (no SessionEnd) keeps its closed receipts too", async () => {
    readContext.mockResolvedValue(null);
    ev("r4", "SessionStart");
    turnOf("r4", 1);
    ev("r4", "Stop");
    await vi.advanceTimersByTimeAsync(11 * 60 * 1000);
    expect(storeModule.snapshot().sessions).toEqual([]);
    expect(storeModule.snapshot().receipts).toHaveLength(1);
  });

  it("ledger frames and snapshot carry counters only (no command / file text)", () => {
    readContext.mockResolvedValue(null);
    ev("r5", "SessionStart");
    ev("r5", "UserPromptSubmit", { cwd: "/w/guild" });
    ev("r5", "PostToolUse", {
      tool_name: "Edit",
      tool_input: { file_path: "/w/guild/TOP-SECRET-NAME.ts" },
      tool_use_id: "z1",
      cwd: "/w/guild",
    });
    ev("r5", "PostToolUse", {
      tool_name: "Bash",
      tool_input: { command: "git commit -m 'private subject'" },
      tool_use_id: "z2",
      cwd: "/w/guild",
    });
    ev("r5", "Stop");
    const blob =
      JSON.stringify(storeModule.snapshot().receipts) +
      sent.filter((frame) => frame.startsWith("event: receipts")).join("");
    expect(blob).not.toMatch(/TOP-SECRET|private subject|git commit/);
  });

  it("a red -> green test across events is one recovery in the broadcast", () => {
    readContext.mockResolvedValue(null);
    ev("r6", "SessionStart");
    ev("r6", "UserPromptSubmit", { cwd: "/w/guild" });
    ev("r6", "PostToolUseFailure", {
      tool_name: "Bash",
      tool_input: { command: "npx vitest run a.test.ts" },
      error: "FAIL",
      tool_use_id: "q1",
      cwd: "/w/guild",
    });
    ev("r6", "PostToolUse", {
      tool_name: "Bash",
      tool_input: { command: "npm test" },
      tool_use_id: "q2",
      cwd: "/w/guild",
    });
    ev("r6", "Stop");
    expect(storeModule.snapshot().receipts[0]).toMatchObject({ recovered: 1, verdict: "done" });
  });
});
