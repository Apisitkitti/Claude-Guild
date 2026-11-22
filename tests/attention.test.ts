import { describe, expect, it } from "vitest";
import {
  AttentionTracker, CTX_PRESSURE, DONE_STALE_MS, PERM_STALE_MS, errorLine, LOOP_STALE_MS, LOOP_WINDOW_MS, MAX_KEYS, MAX_ROWS,
  looksAsked, normalizeCommand, normalizeError,
} from "@/lib/attention";

const MIN = 60_000;
let uid = 0;
const fail = (t: AttentionTracker, now: number, o: Record<string, unknown> = {}) =>
  t.ingest({ session_id: "s1", hook_event_name: "PostToolUseFailure", tool_name: "Bash", tool_input: { command: "npm test" }, error: "Command exited with status 1: expected 3 got 2", tool_use_id: "u" + uid++, ...o }, now);
const loops = (t: AttentionTracker, now = 0) => t.queue(now).filter((r) => r.kind === "loop");

describe("loop detector", () => {
  it("triggers at 3 same-error failures within 5 minutes", () => {
    const t = new AttentionTracker();
    fail(t, 0); fail(t, 10_000);
    expect(loops(t)).toHaveLength(0);
    fail(t, 20_000);
    const [r] = loops(t);
    expect(r.sid).toBe("s1");
    expect(r.text).toContain("3");
    expect(r.copy).toContain("npm test");
    expect(r.detail).toContain("expected");
    fail(t, 30_000);
    expect(loops(t)[0].text).toContain("4");
  });
  it("normalizes numbers/durations/tmp paths so varying output still counts", () => {
    const t = new AttentionTracker();
    fail(t, 0, { error: "failed in 120ms at /tmp/abc123/x.js:10 id 0xdeadbeef" });
    fail(t, 1000, { error: "failed in 98ms at /tmp/zzz9/x.js:12 id 0xcafe1234" });
    fail(t, 2000, { error: "failed in 5s at /private/var/folders/aa/bb/x.js:99 id 0x1" });
    expect(loops(t)).toHaveLength(1);
    expect(normalizeCommand("npm test --seed 123 > /tmp/out-9.txt")).toBe(normalizeCommand("npm test --seed 456 > /tmp/out-77.txt"));
    expect(normalizeError("took 3.5s")).toBe(normalizeError("took 12ms"));
  });
  it("different errors do not loop", () => {
    const t = new AttentionTracker();
    fail(t, 0, { error: "alpha problem" }); fail(t, 1000, { error: "beta problem" }); fail(t, 2000, { error: "gamma problem" });
    expect(loops(t)).toHaveLength(0);
  });
  it("different commands do not loop together", () => {
    const t = new AttentionTracker();
    for (const c of ["npm test", "npm run lint", "npm run build"]) fail(t, 0, { tool_input: { command: c } });
    expect(loops(t)).toHaveLength(0);
  });
  it("failures older than 5 minutes fall out of the window", () => {
    const t = new AttentionTracker();
    fail(t, 0); fail(t, 1000);
    fail(t, LOOP_WINDOW_MS + 5000);
    expect(loops(t)).toHaveLength(0);
  });
  it("a successful Edit/Write resets", () => {
    for (const tool of ["Edit", "Write", "MultiEdit", "NotebookEdit"]) {
      const t = new AttentionTracker();
      fail(t, 0); fail(t, 1000); fail(t, 2000);
      expect(loops(t)).toHaveLength(1);
      t.ingest({ session_id: "s1", hook_event_name: "PostToolUse", tool_name: tool, tool_input: { file_path: "/a/b.ts", old_string: "x" }, tool_use_id: "e" + uid++ }, 3000);
      expect(loops(t)).toHaveLength(0);
      fail(t, 4000); fail(t, 5000);
      expect(loops(t)).toHaveLength(0);
    }
  });
  it("a failed Edit does not reset, and Edit failures with same file+old_string loop", () => {
    const t = new AttentionTracker();
    const e = { tool_name: "Edit", tool_input: { file_path: "/a/b.ts", old_string: "foo" }, error: "String not found" };
    fail(t, 0, e); fail(t, 1000, e); fail(t, 2000, e);
    expect(loops(t)[0].text).toContain("a/b.ts");
  });
  it("UserPromptSubmit and Stop reset", () => {
    for (const name of ["UserPromptSubmit", "Stop"]) {
      const t = new AttentionTracker();
      fail(t, 0); fail(t, 1000); fail(t, 2000);
      t.ingest({ session_id: "s1", hook_event_name: name }, 3000);
      expect(loops(t)).toHaveLength(0);
      fail(t, 4000); fail(t, 5000);
      expect(loops(t)).toHaveLength(0);
    }
  });
  it("dedupes by tool_use_id", () => {
    const t = new AttentionTracker();
    fail(t, 0, { tool_use_id: "same" }); fail(t, 1000, { tool_use_id: "same" }); fail(t, 2000, { tool_use_id: "same" });
    expect(loops(t)).toHaveLength(0);
  });
  it("ignores is_interrupt failures", () => {
    const t = new AttentionTracker();
    fail(t, 0); fail(t, 1000);
    fail(t, 2000, { is_interrupt: true });
    expect(loops(t)).toHaveLength(0);
    fail(t, 3000);
    expect(loops(t)).toHaveLength(1);
  });
  it("keys sessions and agents separately", () => {
    const t = new AttentionTracker();
    fail(t, 0); fail(t, 1000, { agent_id: "ag1" }); fail(t, 2000, { session_id: "s2" });
    expect(loops(t)).toHaveLength(0);
    fail(t, 3000, { agent_id: "ag1" }); fail(t, 4000, { agent_id: "ag1" });
    const r = loops(t);
    expect(r).toHaveLength(1);
    expect(r[0].sid).toBe("s1");
    // a main-agent Stop must not erase the squire's loop... but SubagentStop ends it
    t.ingest({ session_id: "s1", hook_event_name: "Stop", last_assistant_message: "ok" }, 5000);
    expect(loops(t)).toHaveLength(1);
    t.ingest({ session_id: "s1", hook_event_name: "SubagentStop", agent_id: "ag1" }, 6000);
    expect(loops(t)).toHaveLength(0);
    expect(t.size().keys).toBeLessThanOrEqual(2);
  });
  it("loop keys include the agent so two agents looping the same command stay separate", () => {
    const t = new AttentionTracker();
    for (let i = 0; i < 3; i++) { fail(t, i); fail(t, i, { agent_id: "ag1" }); }
    const r = loops(t);
    expect(r).toHaveLength(2);
    expect(new Set(r.map((x) => x.key)).size).toBe(2);
  });
  it("copy/detail use the first informative error line, not a bare Exit code", () => {
    expect(errorLine("Exit code 1\n\nnpm ERR! missing script: test")).toBe("npm ERR! missing script: test");
    expect(errorLine("Error: Exit code 2\n  \nboom")).toBe("boom");
    expect(errorLine("Exit code 127")).toBe("Exit code 127");
    const t = new AttentionTracker();
    for (let i = 0; i < 3; i++) fail(t, i, { error: "Exit code 1\nTypeError: x is not a function" });
    expect(loops(t)[0].detail).toBe("TypeError: x is not a function");
    expect(loops(t)[0].copy).toContain("TypeError");
  });
  it("long errors sharing a prefix do not collide, and only a short display line is kept", () => {
    const t = new AttentionTracker();
    const pre = "same prefix ".repeat(60);
    fail(t, 0, { error: pre + "alpha" }); fail(t, 1, { error: pre + "beta" }); fail(t, 2, { error: pre + "gamma" });
    expect(loops(t)).toHaveLength(0);
    const t2 = new AttentionTracker();
    for (let i = 0; i < 3; i++) fail(t2, i, { error: pre + "same" });
    expect(loops(t2)[0].detail!.length).toBeLessThanOrEqual(120);
  });
  it("normalization keeps tmp-lookalike project paths and path digits distinct", () => {
    expect(normalizeCommand("cat /x/project/tmp/build.log")).toContain("/x/project/tmp/build.log");
    expect(normalizeCommand("cat /tmp/abc/build.log")).toContain("<tmp>");
    expect(normalizeCommand("vitest tests/a1.test.ts")).not.toBe(normalizeCommand("vitest tests/a2.test.ts"));
    expect(normalizeCommand("git diff HEAD~1")).not.toBe(normalizeCommand("git diff HEAD~2"));
    expect(normalizeCommand("sleep 5")).toBe(normalizeCommand("sleep 30"));
  });
  it("a success of the same attempt breaks the streak", () => {
    const t = new AttentionTracker();
    fail(t, 0); fail(t, 1000);
    t.ingest({ session_id: "s1", hook_event_name: "PostToolUse", tool_name: "Bash", tool_input: { command: "npm test" }, tool_use_id: "ok1" }, 1500);
    fail(t, 2000);
    expect(loops(t)).toHaveLength(0);
  });
  it("loop row key is stable per fingerprint, differs for another command", () => {
    const t = new AttentionTracker();
    for (let i = 0; i < 3; i++) fail(t, i);
    const k1 = loops(t)[0].key;
    fail(t, 10);
    expect(loops(t)[0].key).toBe(k1);
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
  ])("looksAsked(%j) = %s", (m, want) => expect(looksAsked(m)).toBe(want));

  const stop = (t: AttentionTracker, msg: unknown, now = 0, o: Record<string, unknown> = {}) =>
    t.ingest({ session_id: "s1", hook_event_name: "Stop", ...(msg === undefined ? {} : { last_assistant_message: msg }), ...o }, now);
  it("question -> asked row with a tail of at most 80 chars; plain -> done; missing field -> done", () => {
    const t = new AttentionTracker();
    stop(t, "x".repeat(500) + " ใช้ Prisma ไหม?");
    const [a] = t.queue(0);
    expect(a.kind).toBe("asked");
    expect(a.detail!.length).toBeLessThanOrEqual(80);
    expect(a.detail!.endsWith("ไหม?")).toBe(true);
    expect(a.text).toContain("เดา");
    stop(t, "all good.", 10);
    expect(t.queue(10)[0].kind).toBe("done");
    stop(t, undefined, 20);
    const r = t.queue(20)[0];
    expect(r.kind).toBe("done");
    expect(r.detail).toBeUndefined();
  });
  it("ignores SubagentStop for the done queue and clears on the next UserPromptSubmit", () => {
    const t = new AttentionTracker();
    stop(t, "q?", 0, { agent_id: "ag", hook_event_name: "SubagentStop" });
    expect(t.queue(0)).toHaveLength(0);
    stop(t, "q?");
    expect(t.queue(0)).toHaveLength(1);
    t.ingest({ session_id: "s1", hook_event_name: "UserPromptSubmit" }, 5);
    expect(t.queue(5)).toHaveLength(0);
  });
});

describe("queue", () => {
  it("orders permission > loop > asked > context > done, ties by longest waiting", () => {
    const t = new AttentionTracker();
    t.ingest({ session_id: "d", hook_event_name: "Stop", last_assistant_message: "ok" }, 1);
    t.ingest({ session_id: "d2", hook_event_name: "Stop", last_assistant_message: "ok" }, 0);
    t.setContext("c", 0.9, 5);
    t.ingest({ session_id: "q", hook_event_name: "Stop", last_assistant_message: "ok?" }, 7);
    for (let i = 0; i < 3; i++) fail(t, 100 + i, { session_id: "l" });
    t.setWaiting("p2", 50);
    t.setWaiting("p1", 20);
    const q = t.queue(1000);
    expect(q.map((r) => `${r.kind}:${r.sid}`)).toEqual(["permission:p1", "permission:p2", "loop:l", "asked:q", "context:c", "done:d2", "done:d"]);
  });
  it("waiting keeps its first since; clears on null", () => {
    const t = new AttentionTracker();
    t.setWaiting("p", 10); t.setWaiting("p", 99);
    expect(t.queue(100)[0].since).toBe(10);
    t.setWaiting("p", null);
    expect(t.queue(100)).toHaveLength(0);
  });
  it("context pressure from 85%", () => {
    const t = new AttentionTracker();
    t.setContext("c", CTX_PRESSURE - 0.01, 0);
    expect(t.queue(0)).toHaveLength(0);
    t.setContext("c", 0.86, 1); t.setContext("c", 0.92, 5);
    const [r] = t.queue(5);
    expect(r.kind).toBe("context");
    expect(r.since).toBe(1);
    expect(r.text).toContain("92%");
    t.setContext("c", null, 6);
    expect(t.queue(6)).toHaveLength(0);
  });
  it("a permission wait older than 90s turns into a soft check-it row ranked below loop", () => {
    const t = new AttentionTracker();
    for (let i = 0; i < 3; i++) fail(t, 100 + i, { session_id: "l" });
    t.setWaiting("p", 0);
    expect(t.queue(PERM_STALE_MS - 1)[0]).toMatchObject({ kind: "permission", sid: "p", text: expect.stringContaining("รออนุญาต") });
    const q = t.queue(PERM_STALE_MS + 1);
    expect(q.map((r) => `${r.kind}:${r.sid}`)).toEqual(["loop:l", "permission:p"]);
    expect(q[1].text).toContain("อาจอนุญาตแล้ว");
    expect(q[1].key).toBe(t.queue(0).find((r) => r.kind === "permission")!.key);
  });
  it("caps rows", () => {
    const t = new AttentionTracker();
    for (let i = 0; i < 50; i++) t.setWaiting("p" + i, i);
    expect(t.queue(0)).toHaveLength(MAX_ROWS);
  });
});

describe("bounds", () => {
  it("sweep drops stale done rows and loops", () => {
    const t = new AttentionTracker();
    t.ingest({ session_id: "d", hook_event_name: "Stop", last_assistant_message: "ok" }, 0);
    for (let i = 0; i < 3; i++) fail(t, 100 + i);
    expect(t.sweep(MIN)).toBe(false);
    expect(t.queue(MIN)).toHaveLength(2);
    expect(t.sweep(LOOP_STALE_MS + 1000)).toBe(true);
    expect(t.queue(0).map((r) => r.kind)).toEqual(["done"]);
    expect(t.sweep(DONE_STALE_MS + 1)).toBe(true);
    expect(t.queue(0)).toHaveLength(0);
    expect(t.size().keys).toBe(0);
  });
  it("dropSession clears everything of that session", () => {
    const t = new AttentionTracker();
    for (let i = 0; i < 3; i++) fail(t, i);
    t.ingest({ session_id: "s1", hook_event_name: "Stop", last_assistant_message: "ok?" }, 1);
    t.setWaiting("s1", 1); t.setContext("s1", 0.9, 1);
    t.dropSession("s1");
    expect(t.queue(5)).toHaveLength(0);
    expect(t.size()).toEqual({ keys: 0, done: 0, waiting: 0, ctx: 0 });
  });
  it("key count is bounded", () => {
    const t = new AttentionTracker();
    for (let i = 0; i < MAX_KEYS + 50; i++) fail(t, i, { session_id: "x" + i });
    expect(t.size().keys).toBeLessThanOrEqual(MAX_KEYS);
  });
});
