import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ChronicleTracker, dayKey } from "../lib/chronicle";

const at = (day: number, hour: number, minute = 0) => new Date(2030, 0, day, hour, minute, 0).getTime();
const MS_MINUTE = 60_000;
let seq = 0;
const post = (
  tracker: ChronicleTracker,
  now: number,
  tool: string,
  input: Record<string, unknown>,
  extra: Record<string, unknown> = {},
  sid = "s1",
) =>
  tracker.ingest(
    {
      session_id: sid,
      cwd: "/work/my-project",
      hook_event_name: "PostToolUse",
      tool_name: tool,
      tool_input: input,
      tool_use_id: `t${++seq}`,
      ...extra,
    },
    now,
  );

describe("ChronicleTracker", () => {
  it("counts sessions, projects, prompts, tools, files, commits, tasks", () => {
    const tracker = new ChronicleTracker();
    tracker.ingest({ session_id: "a", cwd: "/x/alpha", hook_event_name: "SessionStart" }, at(5, 9));
    tracker.ingest({ session_id: "b", cwd: "/x/beta", hook_event_name: "SessionStart" }, at(5, 9, 5));
    tracker.ingest({ session_id: "a", hook_event_name: "UserPromptSubmit" }, at(5, 9, 6));
    post(tracker, at(5, 10), "Edit", { file_path: "/x/a.ts" }, {}, "a");
    post(tracker, at(5, 10, 1), "Edit", { file_path: "/x/a.ts" }, {}, "a");
    post(tracker, at(5, 10, 2), "Write", { file_path: "/x/b.ts" }, {}, "a");
    post(tracker, at(5, 10, 3), "Edit", { file_path: "/x/fail.ts" }, { hook_event_name: "PostToolUseFailure" }, "a");
    post(tracker, at(5, 10, 4), "Bash", { command: 'git commit -m "x"' }, {}, "a");
    post(
      tracker,
      at(5, 10, 5),
      "Bash",
      { command: 'git commit -m "y"' },
      { hook_event_name: "PostToolUseFailure" },
      "a",
    );
    post(tracker, at(5, 10, 6), "TaskUpdate", { taskId: "1", status: "completed" }, {}, "a");
    post(tracker, at(5, 10, 7), "TaskUpdate", { taskId: "1", status: "completed" }, {}, "a");
    post(tracker, at(5, 10, 8), "TodoWrite", { todos: [{ status: "completed" }, { status: "pending" }] }, {}, "a");
    const { today } = tracker.view(at(5, 11));
    expect(today.sessions).toBe(2);
    expect(today.projects.sort()).toEqual(["alpha", "beta", "my-project"]);
    expect(today.prompts).toBe(1);
    expect(today.files).toBe(2);
    expect(today.commits).toBe(1);
    expect(today.tasks).toBe(2);
    expect(today.tools.find((entry) => entry.tool === "Edit")?.count).toBe(3);
    expect(today.toolCalls).toBe(9);
  });

  it("counts a red to green test recovery once", () => {
    const tracker = new ChronicleTracker();
    post(tracker, at(5, 10), "Bash", { command: "npm test" }, { hook_event_name: "PostToolUseFailure" });
    post(tracker, at(5, 10, 1), "Bash", { command: "npm test" });
    post(tracker, at(5, 10, 2), "Bash", { command: "npm test" });
    expect(tracker.view(at(5, 11)).today.recovered).toBe(1);
  });

  it("finds the busiest hour and the longest session", () => {
    const tracker = new ChronicleTracker();
    post(tracker, at(5, 9), "Read", {}, {}, "a");
    for (let i = 0; i < 4; i++) post(tracker, at(5, 14, i), "Read", {}, {}, "a");
    post(tracker, at(5, 9), "Read", {}, {}, "b");
    post(tracker, at(5, 9, 20), "Read", {}, {}, "b");
    const { today } = tracker.view(at(5, 15));
    expect(today.busiestHour).toBe(14);
    expect(today.longestSessionMs).toBe((5 * 60 + 3) * MS_MINUTE);
  });

  it("is quiet on an empty day", () => {
    const view = new ChronicleTracker().view(at(5, 10));
    expect(view.today.busiestHour).toBeNull();
    expect(view.today.sessions).toBe(0);
  });

  it("counts distinct loop rows once and ignores other kinds", () => {
    const tracker = new ChronicleTracker();
    tracker.noteLoops(
      [
        { key: "l1", kind: "loop" },
        { key: "p1", kind: "permission" },
      ],
      at(5, 10),
    );
    tracker.noteLoops(
      [
        { key: "l1", kind: "loop" },
        { key: "l2", kind: "loop" },
      ],
      at(5, 10, 1),
    );
    expect(tracker.view(at(5, 11)).today.loops).toBe(2);
  });

  it("rolls over at local midnight, keeping only today and yesterday", () => {
    const tracker = new ChronicleTracker();
    post(tracker, at(5, 23, 59), "Edit", { file_path: "/x/a.ts" });
    post(tracker, at(6, 0, 1), "Edit", { file_path: "/x/b.ts" });
    let view = tracker.view(at(6, 0, 2));
    expect(view.today.date).toBe(dayKey(at(6, 12)));
    expect(view.today.files).toBe(1);
    expect(view.yesterday.files).toBe(1);
    post(tracker, at(7, 8), "Edit", { file_path: "/x/c.ts" });
    view = tracker.view(at(7, 9));
    expect(view.yesterday.files).toBe(1);
    expect(view.today.files).toBe(1);
    view = tracker.view(at(9, 9));
    expect(view.today.files).toBe(0);
    expect(view.yesterday.files).toBe(0);
  });
});

describe("chronicle in the store", () => {
  let storeModule: typeof import("../lib/store");
  let sent: string[];

  beforeEach(async () => {
    vi.useFakeTimers();
    vi.setSystemTime(at(5, 10));
    vi.spyOn(console, "log").mockImplementation(() => {});
    (globalThis as { __claudeOffice?: unknown }).__claudeOffice = undefined;
    vi.resetModules();
    storeModule = await import("../lib/store");
    sent = [];
    storeModule.subscribe((frame) => sent.push(frame));
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  const frames = () => sent.filter((frame) => frame.startsWith("event: chronicle"));
  const edit = (file: string) =>
    storeModule.addEvent({
      session_id: "s1",
      hook_event_name: "PostToolUse",
      tool_name: "Edit",
      tool_input: { file_path: file },
      tool_use_id: file,
      cwd: "/work/demo",
    });

  it("is in the snapshot and throttles frames to one per 5 s", async () => {
    edit("/a");
    expect(frames()).toHaveLength(1);
    edit("/b");
    edit("/c");
    expect(frames()).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(5_100);
    expect(frames()).toHaveLength(2);
    const last = JSON.parse(frames()[1].split("data: ")[1]);
    expect(last.today.files).toBe(3);
    expect(storeModule.snapshot().chronicle.today.files).toBe(3);
  });

  it("rolls the day over while running (fake timers across midnight)", async () => {
    edit("/a");
    vi.setSystemTime(at(6, 0, 5));
    await vi.advanceTimersByTimeAsync(31_000);
    const snap = storeModule.snapshot().chronicle;
    expect(snap.today.files).toBe(0);
    expect(snap.yesterday.files).toBe(1);
    expect(frames().length).toBeGreaterThanOrEqual(2);
  });
});
