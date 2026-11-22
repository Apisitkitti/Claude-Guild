import { describe, expect, it } from "vitest";

import {
  AttentionTracker,
  CTX_PRESSURE,
  DONE_STALE_MS,
  PERM_STALE_MS,
  errorLine,
  LOOP_STALE_MS,
  LOOP_WINDOW_MS,
  MAX_KEYS,
  MAX_ROWS,
  looksAsked,
  normalizeCommand,
  normalizeError,
} from "@/lib/attention";

const MIN = 60_000;
let uid = 0;
const fail = (tracker: AttentionTracker, now: number, overrides: Record<string, unknown> = {}) =>
  tracker.ingest(
    {
      session_id: "s1",
      hook_event_name: "PostToolUseFailure",
      tool_name: "Bash",
      tool_input: { command: "npm test" },
      error: "Command exited with status 1: expected 3 got 2",
      tool_use_id: "u" + uid++,
      ...overrides,
    },
    now,
  );
const loops = (tracker: AttentionTracker, now = 0) => tracker.queue(now).filter((row) => row.kind === "loop");

describe("loop detector", () => {
  it("triggers at 3 same-error failures within 5 minutes", () => {
    const tracker = new AttentionTracker();
    fail(tracker, 0);
    fail(tracker, 10_000);
    expect(loops(tracker)).toHaveLength(0);
    fail(tracker, 20_000);
    const [row] = loops(tracker);
    expect(row.sid).toBe("s1");
    expect(row).toMatchObject({ tool: "Bash", count: 3 });
    expect(row.target).toContain("npm test");
    expect(row.error).toContain("expected");
    fail(tracker, 30_000);
    expect(loops(tracker)[0].count).toBe(4);
  });
  it("normalizes numbers/durations/tmp paths so varying output still counts", () => {
    const tracker = new AttentionTracker();
    fail(tracker, 0, { error: "failed in 120ms at /tmp/abc123/x.js:10 id 0xdeadbeef" });
    fail(tracker, 1000, { error: "failed in 98ms at /tmp/zzz9/x.js:12 id 0xcafe1234" });
    fail(tracker, 2000, { error: "failed in 5s at /private/var/folders/aa/bb/x.js:99 id 0x1" });
    expect(loops(tracker)).toHaveLength(1);
    expect(normalizeCommand("npm test --seed 123 > /tmp/out-9.txt")).toBe(
      normalizeCommand("npm test --seed 456 > /tmp/out-77.txt"),
    );
    expect(normalizeError("took 3.5s")).toBe(normalizeError("took 12ms"));
  });
  it("different errors do not loop", () => {
    const tracker = new AttentionTracker();
    fail(tracker, 0, { error: "alpha problem" });
    fail(tracker, 1000, { error: "beta problem" });
    fail(tracker, 2000, { error: "gamma problem" });
    expect(loops(tracker)).toHaveLength(0);
  });
  it("different commands do not loop together", () => {
    const tracker = new AttentionTracker();
    for (const command of ["npm test", "npm run lint", "npm run build"])
      fail(tracker, 0, { tool_input: { command: command } });
    expect(loops(tracker)).toHaveLength(0);
  });
  it("failures older than 5 minutes fall out of the window", () => {
    const tracker = new AttentionTracker();
    fail(tracker, 0);
    fail(tracker, 1000);
    fail(tracker, LOOP_WINDOW_MS + 5000);
    expect(loops(tracker)).toHaveLength(0);
  });
  it("a successful Edit/Write resets", () => {
    for (const tool of ["Edit", "Write", "MultiEdit", "NotebookEdit"]) {
      const tracker = new AttentionTracker();
      fail(tracker, 0);
      fail(tracker, 1000);
      fail(tracker, 2000);
      expect(loops(tracker)).toHaveLength(1);
      tracker.ingest(
        {
          session_id: "s1",
          hook_event_name: "PostToolUse",
          tool_name: tool,
          tool_input: { file_path: "/a/b.ts", old_string: "x" },
          tool_use_id: "e" + uid++,
        },
        3000,
      );
      expect(loops(tracker)).toHaveLength(0);
      fail(tracker, 4000);
      fail(tracker, 5000);
      expect(loops(tracker)).toHaveLength(0);
    }
  });
  it("a failed Edit does not reset, and Edit failures with same file+old_string loop", () => {
    const tracker = new AttentionTracker();
    const event = {
      tool_name: "Edit",
      tool_input: { file_path: "/a/b.ts", old_string: "foo" },
      error: "String not found",
    };
    fail(tracker, 0, event);
    fail(tracker, 1000, event);
    fail(tracker, 2000, event);
    expect(loops(tracker)[0]).toMatchObject({ tool: "Edit", target: "a/b.ts" });
  });
  it("UserPromptSubmit and Stop reset", () => {
    for (const name of ["UserPromptSubmit", "Stop"]) {
      const tracker = new AttentionTracker();
      fail(tracker, 0);
      fail(tracker, 1000);
      fail(tracker, 2000);
      tracker.ingest({ session_id: "s1", hook_event_name: name }, 3000);
      expect(loops(tracker)).toHaveLength(0);
      fail(tracker, 4000);
      fail(tracker, 5000);
      expect(loops(tracker)).toHaveLength(0);
    }
  });
  it("dedupes by tool_use_id", () => {
    const tracker = new AttentionTracker();
    fail(tracker, 0, { tool_use_id: "same" });
    fail(tracker, 1000, { tool_use_id: "same" });
    fail(tracker, 2000, { tool_use_id: "same" });
    expect(loops(tracker)).toHaveLength(0);
  });
  it("ignores is_interrupt failures", () => {
    const tracker = new AttentionTracker();
    fail(tracker, 0);
    fail(tracker, 1000);
    fail(tracker, 2000, { is_interrupt: true });
    expect(loops(tracker)).toHaveLength(0);
    fail(tracker, 3000);
    expect(loops(tracker)).toHaveLength(1);
  });
  it("keys sessions and agents separately", () => {
    const tracker = new AttentionTracker();
    fail(tracker, 0);
    fail(tracker, 1000, { agent_id: "ag1" });
    fail(tracker, 2000, { session_id: "s2" });
    expect(loops(tracker)).toHaveLength(0);
    fail(tracker, 3000, { agent_id: "ag1" });
    fail(tracker, 4000, { agent_id: "ag1" });
    const row = loops(tracker);
    expect(row).toHaveLength(1);
    expect(row[0].sid).toBe("s1");
    // a main-agent Stop must not erase the squire's loop... but SubagentStop ends it
    tracker.ingest({ session_id: "s1", hook_event_name: "Stop", last_assistant_message: "ok" }, 5000);
    expect(loops(tracker)).toHaveLength(1);
    tracker.ingest({ session_id: "s1", hook_event_name: "SubagentStop", agent_id: "ag1" }, 6000);
    expect(loops(tracker)).toHaveLength(0);
    expect(tracker.size().keys).toBeLessThanOrEqual(2);
  });
  it("loop keys include the agent so two agents looping the same command stay separate", () => {
    const tracker = new AttentionTracker();
    for (let i = 0; i < 3; i++) {
      fail(tracker, i);
      fail(tracker, i, { agent_id: "ag1" });
    }
    const row = loops(tracker);
    expect(row).toHaveLength(2);
    expect(new Set(row.map((x) => x.key)).size).toBe(2);
  });
  it("rows are data only: no server-worded text, detail or copy", () => {
    const tracker = new AttentionTracker();
    for (let i = 0; i < 3; i++) fail(tracker, i);
    tracker.setWaiting("p", 0);
    tracker.setContext("c", 0.9, 0);
    const rows = tracker.queue(1);
    expect(rows).toHaveLength(3);
    for (const row of rows) for (const k of ["text", "detail", "copy"]) expect(row).not.toHaveProperty(k);
  });
  it("the loop error is the first informative line, not a bare Exit code", () => {
    expect(errorLine("Exit code 1\n\nnpm ERR! missing script: test")).toBe("npm ERR! missing script: test");
    expect(errorLine("Error: Exit code 2\n  \nboom")).toBe("boom");
    expect(errorLine("Exit code 127")).toBe("Exit code 127");
    const tracker = new AttentionTracker();
    for (let i = 0; i < 3; i++) fail(tracker, i, { error: "Exit code 1\nTypeError: x is not a function" });
    expect(loops(tracker)[0].error).toBe("TypeError: x is not a function");
  });
  it("long errors sharing a prefix do not collide, and only a short display line is kept", () => {
    const tracker = new AttentionTracker();
    const pre = "same prefix ".repeat(60);
    fail(tracker, 0, { error: pre + "alpha" });
    fail(tracker, 1, { error: pre + "beta" });
    fail(tracker, 2, { error: pre + "gamma" });
    expect(loops(tracker)).toHaveLength(0);
    const t2 = new AttentionTracker();
    for (let i = 0; i < 3; i++) fail(t2, i, { error: pre + "same" });
    expect(loops(t2)[0].error!.length).toBeLessThanOrEqual(120);
  });
  it("normalization keeps tmp-lookalike project paths and path digits distinct", () => {
    expect(normalizeCommand("cat /x/project/tmp/build.log")).toContain("/x/project/tmp/build.log");
    expect(normalizeCommand("cat /tmp/abc/build.log")).toContain("<tmp>");
    expect(normalizeCommand("vitest tests/a1.test.ts")).not.toBe(normalizeCommand("vitest tests/a2.test.ts"));
    expect(normalizeCommand("git diff HEAD~1")).not.toBe(normalizeCommand("git diff HEAD~2"));
    expect(normalizeCommand("sleep 5")).toBe(normalizeCommand("sleep 30"));
  });
  it("a success of the same attempt breaks the streak", () => {
    const tracker = new AttentionTracker();
    fail(tracker, 0);
    fail(tracker, 1000);
    tracker.ingest(
      {
        session_id: "s1",
        hook_event_name: "PostToolUse",
        tool_name: "Bash",
        tool_input: { command: "npm test" },
        tool_use_id: "ok1",
      },
      1500,
    );
    fail(tracker, 2000);
    expect(loops(tracker)).toHaveLength(0);
  });
  it("loop row key is stable per fingerprint, differs for another command", () => {
    const tracker = new AttentionTracker();
    for (let i = 0; i < 3; i++) fail(tracker, i);
    const k1 = loops(tracker)[0].key;
    fail(tracker, 10);
    expect(loops(tracker)[0].key).toBe(k1);
    const t2 = new AttentionTracker();
    for (let i = 0; i < 3; i++) fail(t2, i, { tool_input: { command: "npm run build" } });
    expect(loops(t2)[0].key).not.toBe(k1);
  });
});

describe("asked detector", () => {
  it.each([
    ["Want me to continue?", true],
    ["ทำต่อเลยไหม", true],
    ["ทำต่อเลยไหมครับ", true],
    ["โอเคมั้ย", true],
    ["ใช้ Prisma ดีครับ?", true],
    ["เอาแบบนี้ไหมคะ?", true],
    ["Would you like me to add tests", true],
    ["I fixed it. Let me know if you want more.", true],
    ["Should I proceed with the migration", true],
    ["Done. All 12 tests pass.", false],
    ["เสร็จแล้วครับ", false],
    ["", false],
  ])("looksAsked(%j) = %s", (message, want) => expect(looksAsked(message)).toBe(want));

  const stop = (tracker: AttentionTracker, msg: unknown, now = 0, overrides: Record<string, unknown> = {}) =>
    tracker.ingest(
      {
        session_id: "s1",
        hook_event_name: "Stop",
        ...(msg === undefined ? {} : { last_assistant_message: msg }),
        ...overrides,
      },
      now,
    );
  it("question -> asked row with a tail of at most 80 chars; plain -> done; missing field -> done", () => {
    const tracker = new AttentionTracker();
    stop(tracker, "x".repeat(500) + " ใช้ Prisma ไหม?");
    const [first] = tracker.queue(0);
    expect(first.kind).toBe("asked");
    expect(first.tail!.length).toBeLessThanOrEqual(80);
    expect(first.tail!.endsWith("ไหม?")).toBe(true);
    stop(tracker, "all good.", 10);
    expect(tracker.queue(10)[0].kind).toBe("done");
    stop(tracker, undefined, 20);
    const row = tracker.queue(20)[0];
    expect(row.kind).toBe("done");
    expect(row.tail).toBeUndefined();
  });
  it("ignores SubagentStop for the done queue and clears on the next UserPromptSubmit", () => {
    const tracker = new AttentionTracker();
    stop(tracker, "q?", 0, { agent_id: "ag", hook_event_name: "SubagentStop" });
    expect(tracker.queue(0)).toHaveLength(0);
    stop(tracker, "q?");
    expect(tracker.queue(0)).toHaveLength(1);
    tracker.ingest({ session_id: "s1", hook_event_name: "UserPromptSubmit" }, 5);
    expect(tracker.queue(5)).toHaveLength(0);
  });
});

describe("queue", () => {
  it("orders permission > loop > asked > context > done, ties by longest waiting", () => {
    const tracker = new AttentionTracker();
    tracker.ingest({ session_id: "d", hook_event_name: "Stop", last_assistant_message: "ok" }, 1);
    tracker.ingest({ session_id: "d2", hook_event_name: "Stop", last_assistant_message: "ok" }, 0);
    tracker.setContext("c", 0.9, 5);
    tracker.ingest({ session_id: "q", hook_event_name: "Stop", last_assistant_message: "ok?" }, 7);
    for (let i = 0; i < 3; i++) fail(tracker, 100 + i, { session_id: "l" });
    tracker.setWaiting("p2", 50);
    tracker.setWaiting("p1", 20);
    const queue = tracker.queue(1000);
    expect(queue.map((row) => `${row.kind}:${row.sid}`)).toEqual([
      "permission:p1",
      "permission:p2",
      "loop:l",
      "asked:q",
      "context:c",
      "done:d2",
      "done:d",
    ]);
  });
  it("waiting keeps its first since; clears on null", () => {
    const tracker = new AttentionTracker();
    tracker.setWaiting("p", 10);
    tracker.setWaiting("p", 99);
    expect(tracker.queue(100)[0].since).toBe(10);
    tracker.setWaiting("p", null);
    expect(tracker.queue(100)).toHaveLength(0);
  });
  it("context pressure from 85%", () => {
    const tracker = new AttentionTracker();
    tracker.setContext("c", CTX_PRESSURE - 0.01, 0);
    expect(tracker.queue(0)).toHaveLength(0);
    tracker.setContext("c", 0.86, 1);
    tracker.setContext("c", 0.92, 5);
    const [row] = tracker.queue(5);
    expect(row.kind).toBe("context");
    expect(row.since).toBe(1);
    expect(row.pct).toBe(92);
    tracker.setContext("c", null, 6);
    expect(tracker.queue(6)).toHaveLength(0);
  });
  it("a permission wait older than 90s turns into a soft check-it row ranked below loop", () => {
    const tracker = new AttentionTracker();
    for (let i = 0; i < 3; i++) fail(tracker, 100 + i, { session_id: "l" });
    tracker.setWaiting("p", 0);
    expect(tracker.queue(PERM_STALE_MS - 1)[0]).toMatchObject({ kind: "permission", sid: "p" });
    expect(tracker.queue(PERM_STALE_MS - 1)[0].stale).toBeUndefined();
    const queue = tracker.queue(PERM_STALE_MS + 1);
    expect(queue.map((row) => `${row.kind}:${row.sid}`)).toEqual(["loop:l", "permission:p"]);
    expect(queue[1].stale).toBe(true);
    expect(queue[1].key).toBe(tracker.queue(0).find((row) => row.kind === "permission")!.key);
  });
  it("caps rows", () => {
    const tracker = new AttentionTracker();
    for (let i = 0; i < 50; i++) tracker.setWaiting("p" + i, i);
    expect(tracker.queue(0)).toHaveLength(MAX_ROWS);
  });
});

describe("bounds", () => {
  it("sweep drops stale done rows and loops", () => {
    const tracker = new AttentionTracker();
    tracker.ingest({ session_id: "d", hook_event_name: "Stop", last_assistant_message: "ok" }, 0);
    for (let i = 0; i < 3; i++) fail(tracker, 100 + i);
    expect(tracker.sweep(MIN)).toBe(false);
    expect(tracker.queue(MIN)).toHaveLength(2);
    expect(tracker.sweep(LOOP_STALE_MS + 1000)).toBe(true);
    expect(tracker.queue(0).map((row) => row.kind)).toEqual(["done"]);
    expect(tracker.sweep(DONE_STALE_MS + 1)).toBe(true);
    expect(tracker.queue(0)).toHaveLength(0);
    expect(tracker.size().keys).toBe(0);
  });
  it("dropSession clears everything of that session", () => {
    const tracker = new AttentionTracker();
    for (let i = 0; i < 3; i++) fail(tracker, i);
    tracker.ingest({ session_id: "s1", hook_event_name: "Stop", last_assistant_message: "ok?" }, 1);
    tracker.setWaiting("s1", 1);
    tracker.setContext("s1", 0.9, 1);
    tracker.dropSession("s1");
    expect(tracker.queue(5)).toHaveLength(0);
    expect(tracker.size()).toEqual({ keys: 0, done: 0, waiting: 0, ctx: 0 });
  });
  it("key count is bounded", () => {
    const tracker = new AttentionTracker();
    for (let i = 0; i < MAX_KEYS + 50; i++) fail(tracker, i, { session_id: "x" + i });
    expect(tracker.size().keys).toBeLessThanOrEqual(MAX_KEYS);
  });
});
