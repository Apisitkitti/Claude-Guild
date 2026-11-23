import { describe, expect, it } from "vitest";

import {
  LATE_GRACE_MS,
  MAX_CLOSED,
  MAX_FILES,
  MAX_RUNNERS,
  RECEIPT_TTL_MS,
  ReceiptTracker,
  commandShape,
  commitKind,
  runnerOf,
  type ReceiptEvent,
} from "@/lib/receipts";

const MIN = 60_000;
let seq = 0;
const post = (sid: string, tool: string, input: Record<string, unknown>, extra: ReceiptEvent = {}): ReceiptEvent => ({
  session_id: sid,
  hook_event_name: "PostToolUse",
  tool_name: tool,
  tool_input: input,
  tool_use_id: "t" + ++seq,
  cwd: "/w/proj",
  ...extra,
});
const fail = (sid: string, tool: string, input: Record<string, unknown>, extra: ReceiptEvent = {}) =>
  post(sid, tool, input, { hook_event_name: "PostToolUseFailure", error: "boom", ...extra });
const bash = (sid: string, command: string, extra: ReceiptEvent = {}) => post(sid, "Bash", { command }, extra);
const bashFail = (sid: string, command: string, extra: ReceiptEvent = {}) => fail(sid, "Bash", { command }, extra);
const edit = (sid: string, file: string, extra: ReceiptEvent = {}) =>
  post(sid, "Edit", { file_path: file, old_string: "a", new_string: "b" }, extra);
const lifecycle = (sid: string, name: string, extra: ReceiptEvent = {}): ReceiptEvent => ({
  session_id: sid,
  hook_event_name: name,
  cwd: "/w/proj",
  ...extra,
});

const turn = (tracker: ReceiptTracker, sid: string, now: number, events: ReceiptEvent[], close = true) => {
  tracker.ingest(lifecycle(sid, "UserPromptSubmit"), now);
  for (const event of events) tracker.ingest(event, now);
  if (close) tracker.ingest(lifecycle(sid, "Stop"), now + 1);
};

describe("runnerOf / commandShape / commitKind", () => {
  it("recognises test runners at the start of a segment", () => {
    const yes: [string, string][] = [
      ["npm test", "node-test"],
      ["pnpm test", "node-test"],
      ["yarn test", "node-test"],
      ["npm run test:unit", "node-test"],
      ["npm t", "node-test"],
      ["npx vitest run a.test.ts", "node-test"],
      ["vitest", "node-test"],
      ["npx jest --ci", "node-test"],
      ["CI=1 npm test -- --run", "node-test"],
      ["./node_modules/.bin/vitest run", "node-test"],
      ["pytest -q", "pytest"],
      ["python -m pytest tests/", "pytest"],
      ["uv run pytest", "pytest"],
      ["go test ./...", "go"],
      ["cargo test --lib", "cargo"],
      ["cargo +nightly test", "cargo"],
      ["bundle exec rspec", "rspec"],
      ["dotnet test", "dotnet"],
      ["time npm test", "node-test"],
      ["npx playwright test", "playwright"],
    ];
    for (const [command, runner] of yes) expect(runnerOf(command), command).toBe(runner);
    for (const command of [
      "echo vitest",
      "npm run build",
      "npm install jest",
      "cat tests/pytest.ini",
      "git commit -m test",
      "npm testing",
      "tsc --noEmit",
      "go build ./...",
      "ls",
    ])
      expect(runnerOf(command), command).toBeNull();
  });
  it("only trusts plain && chains", () => {
    expect(commandShape("npm test").ok).toBe(true);
    expect(commandShape("cd web && npm test -- --run").segments).toEqual(["cd web", "npm test -- --run"]);
    expect(commandShape("npm test 2>&1").ok).toBe(true);
    expect(commandShape('git commit -m "a; b | c || d"').ok).toBe(true); // operators inside quotes are text
    for (const command of [
      "npm test | tail -20",
      "npm test; echo done",
      "npm test || true",
      "npm test &",
      "npm test\necho hi",
      "npx vitest run | grep fail",
      "x=$(npm test)",
      "`npm test`",
    ])
      expect(commandShape(command).ok, command).toBe(false);
  });
  it("commit parsing: heredoc, amend, commit-tree, chains", () => {
    const k = (command: string) => {
      const shape = commandShape(command);
      return shape.ok ? commitKind(shape.segments) : "unsafe";
    };
    expect(k("git commit -m 'fix x'")).toBe("commit");
    expect(k('git add -A && git commit -m "feat"')).toBe("commit");
    expect(k("git -C /w commit -m x")).toBe("commit");
    expect(k("git commit -m \"$(cat <<'EOF'\nfeat: thing; with | pipes\n\nbody\nEOF\n)\"")).toBe("commit");
    expect(k("git commit --amend --no-edit")).toBe("amend");
    expect(k("git commit-tree abc")).toBeNull();
    expect(k("git status")).toBeNull();
    expect(k("echo git commit")).toBeNull();
    expect(k("git commit -m x | tail")).toBe("unsafe");
    expect(k("git commit -m x || true")).toBe("unsafe");
    expect(k("git commit -m x; git log")).toBe("unsafe");
  });
});

describe("ReceiptTracker outcomes", () => {
  it("counts unique files that changed successfully; failed edits and reads do not count", () => {
    const tracker = new ReceiptTracker();
    turn(tracker, "a", 1000, [
      edit("a", "/w/proj/x.ts"),
      edit("a", "/w/proj/x.ts"),
      post("a", "Write", { file_path: "/w/proj/y.ts", content: "c" }),
      post("a", "MultiEdit", { file_path: "/w/proj/z.ts", edits: [] }),
      post("a", "NotebookEdit", { notebook_path: "/w/n.ipynb" }),
      fail("a", "Edit", { file_path: "/w/proj/never.ts" }),
      post("a", "Read", { file_path: "/w/proj/r.ts" }),
    ]);
    const [row] = tracker.rows(2000);
    expect(row).toMatchObject({
      files: 4,
      recovered: 0,
      commits: 0,
      tasks: 0,
      verdict: "done",
      project: "proj",
      sid: "a",
      calls: 7,
    });
  });

  it("dedupes by tool_use_id and ignores interrupts", () => {
    const tracker = new ReceiptTracker();
    const event = edit("a", "/w/proj/x.ts", { tool_use_id: "same" });
    turn(tracker, "a", 1, [
      event,
      event,
      bashFail("a", "npm test", { is_interrupt: true }),
      bash("a", "git commit -m x", { tool_use_id: "c1" }),
      bash("a", "git commit -m x", { tool_use_id: "c1" }),
    ]);
    expect(tracker.rows(5)[0]).toMatchObject({ files: 1, commits: 1, calls: 2 });
  });

  it("test red -> green = 1 recovery; green repeats and green-without-red add nothing", () => {
    const tracker = new ReceiptTracker();
    turn(tracker, "a", 1, [bash("a", "npm test")]); // never red
    expect(tracker.rows(5)).toHaveLength(1);
    expect(tracker.rows(5)[0]).toMatchObject({ recovered: 0, verdict: "none" });
    turn(tracker, "a", 10, [
      bashFail("a", "npm test"),
      bashFail("a", "npm test"),
      bash("a", "npm test"),
      bash("a", "npm test"),
    ]);
    expect(tracker.rows(20)[0]).toMatchObject({ recovered: 1, verdict: "done" });
    turn(tracker, "a", 30, [bashFail("a", "npm test"), bash("a", "npm test")]);
    expect(tracker.rows(40)[0].recovered).toBe(1); // a second red -> green is a second recovery, in its own turn
  });

  it("matches at runner level: different command, same runner = recovery; other cwd / runner = not", () => {
    const tracker = new ReceiptTracker();
    turn(tracker, "a", 1, [bashFail("a", "npx vitest run tests/a.test.ts"), bash("a", "npm test")]);
    expect(tracker.rows(5)[0].recovered).toBe(1);
    const trackerB = new ReceiptTracker();
    turn(trackerB, "a", 1, [bashFail("a", "npm test", { cwd: "/w/one" }), bash("a", "npm test", { cwd: "/w/two" })]);
    expect(trackerB.rows(5)[0].recovered).toBe(0);
    const trackerC = new ReceiptTracker();
    turn(trackerC, "a", 1, [bashFail("a", "pytest"), bash("a", "npm test")]);
    expect(trackerC.rows(5)[0].recovered).toBe(0);
  });

  it("red state survives across turns (red in turn 1, green in turn 2 = recovery in turn 2)", () => {
    const tracker = new ReceiptTracker();
    turn(tracker, "a", 1, [bashFail("a", "go test ./...")]);
    expect(tracker.rows(5)[0].verdict).toBe("red");
    turn(tracker, "a", 100, [edit("a", "/w/proj/f.go"), bash("a", "go test ./...")]);
    expect(tracker.rows(200)[0]).toMatchObject({ recovered: 1, files: 1, verdict: "done" });
  });

  it("MUST-FIX: piped / chained / `|| true` / background test commands do not count", () => {
    const tracker = new ReceiptTracker();
    turn(tracker, "a", 1, [
      bashFail("a", "npm test | tail -20"),
      bash("a", "npm test | tail -20"),
      bashFail("a", "npm test; echo done"),
      bash("a", "npm test; echo done"),
      bash("a", "npm test || true"),
      bash("a", "vitest run &"),
      bashFail("a", "npm test && echo ok"), // the test is not the last part: a failure may be the echo's
      bash("a", "npm test && echo ok"),
      bash("a", "npx vitest run 2>&1 | grep -c fail"),
    ]);
    const row = tracker.rows(5)[0];
    expect(row.recovered).toBe(0);
    expect(row.verdict).toBe("none");
    // the unreliable runs also did not turn the runner red
    turn(tracker, "a", 10, [bash("a", "cd web && npm test")]);
    expect(tracker.rows(20)[0].verdict).toBe("none");
  });

  it("a trustworthy `cd x && npm test` chain counts, 2>&1 too", () => {
    const tracker = new ReceiptTracker();
    turn(tracker, "a", 1, [bashFail("a", "cd web && npm test 2>&1"), bash("a", "cd web && npm test")]);
    expect(tracker.rows(5)[0].recovered).toBe(1);
  });

  it("echo vitest / not-a-test commands never become a runner", () => {
    const tracker = new ReceiptTracker();
    turn(tracker, "a", 1, [
      bashFail("a", "echo vitest"),
      bash("a", "echo vitest"),
      bashFail("a", "npm run build"),
      bash("a", "npm run build"),
    ]);
    expect(tracker.rows(5)[0]).toMatchObject({ recovered: 0, verdict: "none" });
  });

  it("counts commits (success only), amends apart, no text kept", () => {
    const tracker = new ReceiptTracker();
    turn(tracker, "a", 1, [
      bash("a", "git add -A && git commit -m \"$(cat <<'EOF'\nfeat: secret subject\n\nEOF\n)\""),
      bash("a", "git commit --amend --no-edit"),
      bash("a", "git commit-tree abc"),
      bash("a", "git status"),
      bashFail("a", "git commit -m nope"),
      bash("a", "git commit -m x | tail"),
      bash("a", "git commit -m x || true"),
    ]);
    const row = tracker.rows(5)[0];
    expect(row).toMatchObject({ commits: 1, amends: 1, verdict: "done" });
    expect(JSON.stringify(row)).not.toMatch(/secret subject|git commit/);
  });

  it("tasks done: TaskUpdate completed once per task, TodoWrite completed increments", () => {
    const tracker = new ReceiptTracker();
    turn(tracker, "a", 1, [
      post("a", "TaskUpdate", { taskId: "1", status: "completed" }),
      post("a", "TaskUpdate", { taskId: "1", status: "completed" }),
      post("a", "TaskUpdate", { taskId: "2", status: "in_progress" }),
      post("a", "TaskUpdate", { taskId: "3", status: "completed" }),
      fail("a", "TaskUpdate", { taskId: "9", status: "completed" }),
      post("a", "TaskUpdate", "weird" as unknown as Record<string, unknown>),
    ]);
    expect(tracker.rows(5)[0].tasks).toBe(2);
    const todos = (...st: string[]) => ({ todos: st.map((status, i) => ({ content: "x" + i, status })) });
    turn(tracker, "b", 10, [
      post("b", "TodoWrite", todos("completed", "pending", "pending")),
      post("b", "TodoWrite", todos("completed", "completed", "completed")),
      post("b", "TodoWrite", todos("completed", "completed", "completed")),
      post("b", "TodoWrite", { todos: "nope" }),
      post("b", "TodoWrite", {}),
    ]);
    expect(tracker.rows(20).find((row) => row.sid === "b")!.tasks).toBe(3);
  });

  it("garbage payloads never throw or count", () => {
    const tracker = new ReceiptTracker();
    const junk = [
      {},
      { session_id: 1 },
      { session_id: "a" },
      { session_id: "a", hook_event_name: "PostToolUse" },
      { session_id: "a", hook_event_name: "PostToolUse", tool_name: "Bash", tool_input: 5 },
      { session_id: "a", hook_event_name: "PostToolUse", tool_name: "Edit", tool_input: null },
    ];
    for (const j of junk) expect(() => tracker.ingest(j as ReceiptEvent, 1)).not.toThrow();
    tracker.ingest(lifecycle("a", "Stop"), 2);
    expect(tracker.rows(3).every((row) => row.files + row.commits + row.tasks + row.recovered === 0)).toBe(true);
  });
});

describe("turns, verdicts, closing", () => {
  it("opens on UserPromptSubmit, closes on Stop; open turns are not listed", () => {
    const tracker = new ReceiptTracker();
    tracker.ingest(lifecycle("a", "UserPromptSubmit"), 1);
    tracker.ingest(edit("a", "/w/proj/x.ts"), 2);
    expect(tracker.rows(3)).toEqual([]);
    tracker.ingest(lifecycle("a", "Stop"), 4);
    expect(tracker.rows(5)).toHaveLength(1);
    expect(tracker.rows(5)[0].closedAt).toBe(4);
  });

  it("closes the turn on a main-agent StopFailure", () => {
    const tracker = new ReceiptTracker();
    tracker.ingest(lifecycle("a", "UserPromptSubmit"), 1);
    tracker.ingest(edit("a", "/w/proj/x.ts"), 2);
    tracker.ingest(lifecycle("a", "StopFailure", { agent_id: "sub1" }), 3);
    expect(tracker.rows(4)).toEqual([]);
    tracker.ingest(lifecycle("a", "StopFailure"), 5);
    expect(tracker.rows(6)).toHaveLength(1);
    expect(tracker.rows(6)[0].closedAt).toBe(5);
  });

  it("a turn ended by StopFailure is never labelled done", () => {
    const tracker = new ReceiptTracker();
    tracker.ingest(lifecycle("a", "UserPromptSubmit"), 1);
    tracker.ingest(edit("a", "/w/proj/x.ts"), 2);
    tracker.ingest(lifecycle("a", "StopFailure", { error: "rate_limit" }), 3);
    const rows = tracker.rows(4);
    expect(rows).toHaveLength(1);
    expect(rows[0].files).toBe(1);
    expect(rows[0].verdict).toBe("none");
  });

  it("a turn with no tool call leaves no receipt; activity without outcomes = none", () => {
    const tracker = new ReceiptTracker();
    turn(tracker, "a", 1, []);
    expect(tracker.rows(5)).toEqual([]);
    turn(tracker, "a", 10, [post("a", "Read", { file_path: "/x" }), post("a", "Grep", { pattern: "x" })]);
    expect(tracker.rows(20)[0]).toMatchObject({ verdict: "none", calls: 2 });
  });

  it("works without UserPromptSubmit (first activity opens the turn); a new prompt closes an unfinished turn", () => {
    const tracker = new ReceiptTracker();
    tracker.ingest(edit("a", "/w/proj/x.ts"), 1);
    tracker.ingest(lifecycle("a", "UserPromptSubmit"), 5); // previous turn never Stopped (interrupted)
    expect(tracker.rows(6)).toHaveLength(1);
    expect(tracker.rows(6)[0].files).toBe(1);
  });

  it("verdicts: done / red / none (red wins while a runner is still failing)", () => {
    const tracker = new ReceiptTracker();
    turn(tracker, "d", 1, [edit("d", "/w/proj/a.ts")]);
    turn(tracker, "r", 2, [edit("r", "/w/proj/a.ts"), bashFail("r", "npm test")]);
    turn(tracker, "n", 3, [post("n", "Read", { file_path: "/a" })]);
    const verdicts = Object.fromEntries(tracker.rows(10).map((row) => [row.sid, row.verdict]));
    expect(verdicts).toEqual({ d: "done", r: "red", n: "none" });
  });

  it("subagent outcomes roll up into the parent's receipt and are labelled squire; subagent Stop does not close the turn", () => {
    const tracker = new ReceiptTracker();
    tracker.ingest(lifecycle("a", "UserPromptSubmit"), 1);
    tracker.ingest(edit("a", "/w/proj/m.ts"), 2);
    tracker.ingest(edit("a", "/w/proj/s1.ts", { agent_id: "sub1", agent_type: "Explore" }), 3);
    tracker.ingest(bash("a", "git commit -m x", { agent_id: "sub1" }), 3);
    tracker.ingest(lifecycle("a", "Stop", { agent_id: "sub1" }), 4);
    expect(tracker.rows(5)).toEqual([]);
    tracker.ingest(lifecycle("a", "Stop"), 6);
    expect(tracker.rows(7)).toHaveLength(1);
    expect(tracker.rows(7)[0]).toMatchObject({ files: 2, commits: 1, squire: 2 });
  });

  it("a late async tool event right after Stop lands on that receipt; later ones open a new turn", () => {
    const tracker = new ReceiptTracker();
    turn(tracker, "a", 1000, [edit("a", "/w/proj/x.ts")]);
    tracker.ingest(edit("a", "/w/proj/late.ts"), 1001 + LATE_GRACE_MS - 10);
    expect(tracker.rows(9000)).toHaveLength(1);
    expect(tracker.rows(9000)[0].files).toBe(2);
    tracker.ingest(edit("a", "/w/proj/way-late.ts"), 1001 + LATE_GRACE_MS + 60_000);
    expect(tracker.rows(100_000)).toHaveLength(1); // opened a fresh (still open) turn
    expect(tracker.size().open).toBe(1);
  });

  it("a late failure after Stop can turn the closed receipt red", () => {
    const tracker = new ReceiptTracker();
    turn(tracker, "a", 1000, [edit("a", "/w/proj/x.ts")]);
    tracker.ingest(bashFail("a", "npm test"), 1100);
    expect(tracker.rows(1200)[0].verdict).toBe("red");
  });
});

describe("closed receipts: TTL, cap, independence from dropSession", () => {
  it("survive dropSession; a quiet 15 min changes nothing; gone after 2h", () => {
    const tracker = new ReceiptTracker();
    turn(tracker, "a", 0, [edit("a", "/w/proj/x.ts")]);
    tracker.dropSession("a", 5);
    expect(tracker.rows(15 * MIN)).toHaveLength(1);
    expect(tracker.sweep(15 * MIN)).toBe(false);
    expect(tracker.rows(RECEIPT_TTL_MS + 100)).toEqual([]); // hidden even before sweep
    expect(tracker.sweep(RECEIPT_TTL_MS + 100)).toBe(true);
    expect(tracker.size().closed).toBe(0);
  });

  it("cap 30: the 31st evicts the oldest", () => {
    const tracker = new ReceiptTracker();
    for (let i = 0; i < MAX_CLOSED + 1; i++) turn(tracker, "s" + i, i * 10, [edit("s" + i, "/w/proj/x.ts")]);
    const rows = tracker.rows(1000);
    expect(rows).toHaveLength(MAX_CLOSED);
    expect(rows[0].sid).toBe("s" + MAX_CLOSED); // newest first
    expect(rows.some((row) => row.sid === "s0")).toBe(false);
    expect(rows.at(-1)!.sid).toBe("s1");
  });

  it("rows are newest first; several turns of one session are kept as separate receipts", () => {
    const tracker = new ReceiptTracker();
    turn(tracker, "a", 10, [edit("a", "/w/proj/x.ts")]);
    turn(tracker, "a", 20, [edit("a", "/w/proj/y.ts")]);
    turn(tracker, "b", 15, [edit("b", "/w/proj/z.ts")]);
    expect(tracker.rows(30).map((row) => row.closedAt)).toEqual([21, 16, 11]);
    expect(new Set(tracker.rows(30).map((row) => row.id)).size).toBe(3);
  });

  it("an open turn is dropped with its session unless it already produced something", () => {
    const tracker = new ReceiptTracker();
    tracker.ingest(lifecycle("quiet", "UserPromptSubmit"), 1);
    tracker.ingest(post("quiet", "Read", { file_path: "/a" }), 2);
    tracker.dropSession("quiet", 3);
    expect(tracker.rows(4)).toEqual([]);
    expect(tracker.size()).toEqual({ sessions: 0, closed: 0, open: 0 });
    tracker.ingest(lifecycle("busy", "UserPromptSubmit"), 1);
    tracker.ingest(edit("busy", "/w/proj/x.ts"), 2);
    tracker.dropSession("busy", 3); // SessionEnd with no Stop: the work is not lost
    expect(tracker.rows(4)).toHaveLength(1);
    expect(tracker.size().sessions).toBe(0);
    tracker.dropSession("ghost", 5); // unknown: no-op
  });

  it("sweep forgets long-idle session state", () => {
    const tracker = new ReceiptTracker();
    tracker.ingest(lifecycle("a", "UserPromptSubmit"), 0);
    tracker.sweep(RECEIPT_TTL_MS + 1);
    expect(tracker.size().sessions).toBe(0);
  });
});

describe("bounds", () => {
  it("files per receipt, runners per session, sessions overall are capped", () => {
    const tracker = new ReceiptTracker();
    tracker.ingest(lifecycle("a", "UserPromptSubmit"), 1);
    for (let i = 0; i < MAX_FILES + 50; i++) tracker.ingest(edit("a", `/w/proj/f${i}.ts`), 2);
    tracker.ingest(lifecycle("a", "Stop"), 3);
    expect(tracker.rows(4)[0].files).toBe(MAX_FILES);
    for (let i = 0; i < MAX_RUNNERS + 5; i++) tracker.ingest(bashFail("a", "npm test", { cwd: "/w/p" + i }), 5);
    tracker.ingest(lifecycle("a", "Stop"), 6);
    for (let i = 0; i < 300; i++) tracker.ingest(edit("s" + i, "/w/x"), 7 + i);
    expect(tracker.size().sessions).toBeLessThanOrEqual(200);
  });

  it("keeps no text: rows hold only ids, project name and counters", () => {
    const tracker = new ReceiptTracker();
    turn(tracker, "a", 1, [
      edit("a", "/w/proj/SECRET-FILE.ts"),
      bash("a", "export TOKEN=hunter2 && git commit -m 'private subject'"),
    ]);
    const json = JSON.stringify(tracker.rows(5));
    expect(json).not.toMatch(/SECRET-FILE|hunter2|private subject|git commit/);
    expect(Object.keys(tracker.rows(5)[0]).sort()).toEqual(
      [
        "amends",
        "calls",
        "closedAt",
        "commits",
        "files",
        "id",
        "project",
        "recovered",
        "squire",
        "sid",
        "staleRed",
        "tasks",
        "verdict",
      ].sort(),
    );
  });
});

describe("review fixes", () => {
  it("background Bash (run_in_background) reports launch, not result: no runner / commit accounting", () => {
    const tracker = new ReceiptTracker();
    turn(tracker, "a", 1, [
      post("a", "Bash", { command: "npm test", run_in_background: true }),
      post("a", "Bash", { command: "git commit -m x", run_in_background: true }),
      bashFail("a", "npm test"),
      post("a", "Bash", { command: "npm test", run_in_background: true }),
    ]);
    const row = tracker.rows(5)[0];
    expect(row).toMatchObject({ commits: 0, recovered: 0, verdict: "red" });
  });

  it("TodoWrite progress is tracked per agent", () => {
    const tracker = new ReceiptTracker();
    const todos = (count: number) => ({
      todos: Array.from({ length: 5 }, (_, i) => ({ content: "x", status: i < count ? "completed" : "pending" })),
    });
    turn(tracker, "a", 1, [
      post("a", "TodoWrite", todos(3)),
      post("a", "TodoWrite", todos(1), { agent_id: "s1" }),
      post("a", "TodoWrite", todos(2), { agent_id: "s1" }),
    ]);
    expect(tracker.rows(5)[0].tasks).toBe(3 + 1 + 1);
  });

  it("Stop that beats the turn's PostToolUse: the late edit lands on that receipt, no orphan", () => {
    const tracker = new ReceiptTracker();
    tracker.ingest(lifecycle("a", "UserPromptSubmit"), 1000);
    tracker.ingest(lifecycle("a", "Stop"), 1001);
    expect(tracker.rows(1002)).toEqual([]);
    tracker.ingest(edit("a", "/w/proj/x.ts"), 1002);
    expect(tracker.rows(1003)).toHaveLength(1);
    expect(tracker.rows(1003)[0]).toMatchObject({ files: 1, closedAt: 1001 });
    expect(tracker.size().open).toBe(0);
    // an empty turn stays unlisted when nothing lands on it
    const trackerB = new ReceiptTracker();
    turn(trackerB, "a", 1, []);
    trackerB.ingest(edit("a", "/w/x"), 1 + LATE_GRACE_MS + 10);
    expect(trackerB.rows(99999)).toEqual([]);
  });

  it("git commit --dry-run does not count", () => {
    const tracker = new ReceiptTracker();
    turn(tracker, "a", 1, [bash("a", "git commit --dry-run"), bash("a", "git commit -m x --dry-run")]);
    expect(tracker.rows(5)[0].commits).toBe(0);
  });

  it("runner detection through -C / --prefix / --filter / --cwd", () => {
    for (const command of [
      "pnpm -C web test",
      "npm --prefix web test",
      "pnpm --filter app test",
      "yarn --cwd web test",
      "npm --prefix=web run test",
    ])
      expect(runnerOf(command), command).toBe("node-test");
    expect(runnerOf("pnpm -C web build")).toBeNull();
  });

  it("red from an earlier turn is a note (staleRed), not this turn's verdict", () => {
    const tracker = new ReceiptTracker();
    turn(tracker, "a", 1, [bashFail("a", "npm test")]);
    expect(tracker.rows(5)[0]).toMatchObject({ verdict: "red", staleRed: false });
    turn(tracker, "a", 100, [bash("a", "git commit -m x")]);
    expect(tracker.rows(200)[0]).toMatchObject({ verdict: "done", staleRed: true, commits: 1 });
    turn(tracker, "a", 300, [bashFail("a", "npm test")]); // fails again this turn: red proper
    expect(tracker.rows(400)[0]).toMatchObject({ verdict: "red", staleRed: false });
  });

  it("ids carry a per-tracker nonce so a rebuilt tracker never reuses an id", () => {
    const trackerA = new ReceiptTracker(),
      trackerB = new ReceiptTracker();
    turn(trackerA, "s", 1, [edit("s", "/x")]);
    turn(trackerB, "s", 1, [edit("s", "/x")]);
    expect(trackerA.rows(5)[0].id).toMatch(/^[a-z0-9]+-1$/);
    expect(trackerA.rows(5)[0].id.length).toBeLessThan(40);
  });

  it("heredoc scanning is bounded on adversarial input", () => {
    const bad = "<<A\n".repeat(8000);
    const t0 = Date.now();
    commandShape(bad);
    commandShape("<<A1\n".repeat(50) + "x".repeat(30000));
    expect(Date.now() - t0).toBeLessThan(50);
  });
});
