import { describe, expect, it } from "vitest";

import { TerritoryTracker, displayPath, resolveTarget, type TerritoryEvent } from "../lib/territory";

const MIN = 60_000;
const T0 = 1_000_000;
const ev = (
  sid: string,
  name: string,
  file: string,
  extra: Partial<TerritoryEvent> = {},
  tool = "Edit",
): TerritoryEvent => ({
  session_id: sid,
  hook_event_name: name,
  tool_name: tool,
  cwd: "/proj",
  tool_input: { file_path: file },
  ...extra,
});

describe("resolveTarget / displayPath", () => {
  it("resolves relative paths against cwd and normalizes", () => {
    expect(resolveTarget("/proj", "src/../lib/a.ts")).toBe("/proj/lib/a.ts");
    expect(resolveTarget(undefined, "a.ts")).toBe("/a.ts");
    expect(resolveTarget("/proj", "")).toBeNull();
    expect(resolveTarget("/proj", 5)).toBeNull();
  });
  it("ignores node_modules, .git, .next and temp dirs", () => {
    for (const ignoredPath of [
      "/proj/node_modules/x/a.js",
      "/proj/.git/config",
      "/proj/.next/a.js",
      "/tmp/a",
      "/private/tmp/x/a",
      "/var/folders/ab/c",
      "/private/var/folders/ab/c",
    ]) {
      expect(resolveTarget("/proj", ignoredPath)).toBeNull();
    }
    expect(resolveTarget("/proj", "/proj/src/a.ts")).toBe("/proj/src/a.ts");
  });
  it("displays relative to cwd, else last two segments", () => {
    expect(displayPath("/proj/src/a.ts", "/proj")).toBe("src/a.ts");
    expect(displayPath("/proj/src/a.ts", "/proj/")).toBe("src/a.ts");
    expect(displayPath("/other/dir/a.ts", "/proj")).toBe("dir/a.ts");
    expect(displayPath("/projx/a.ts", "/proj")).toBe("projx/a.ts");
    expect(displayPath("/a.ts", undefined)).toBe("a.ts");
  });
});

describe("TerritoryTracker claims", () => {
  it("claims on Pre/PostToolUse of edit tools only, with relative display and recency order", () => {
    const tracker = new TerritoryTracker();
    expect(tracker.onEvent(ev("a", "PreToolUse", "/proj/src/one.ts"), T0)).toBe(true);
    expect(tracker.onEvent(ev("a", "PreToolUse", "/proj/two.ts", {}, "Write"), T0 + 1)).toBe(true);
    expect(tracker.onEvent(ev("a", "PostToolUse", "/proj/two.ts", {}, "Write"), T0 + 1)).toBe(false);
    expect(tracker.onEvent(ev("a", "PreToolUse", "/proj/x.ts", {}, "Read"), T0 + 2)).toBe(false);
    expect(tracker.onEvent(ev("a", "PreToolUse", "/proj/node_modules/z.js"), T0 + 3)).toBe(false);
    expect(
      tracker.onEvent(
        {
          session_id: "a",
          hook_event_name: "PreToolUse",
          tool_name: "NotebookEdit",
          cwd: "/proj",
          tool_input: { notebook_path: "n.ipynb" },
        },
        T0 + 4,
      ),
    ).toBe(true);
    expect(tracker.snapshot()).toEqual({
      claims: [{ sid: "a", files: ["n.ipynb", "two.ts", "src/one.ts"] }],
      conflicts: [],
    });
  });

  it("returns false when nothing changed", () => {
    const tracker = new TerritoryTracker();
    tracker.onEvent(ev("a", "PreToolUse", "/proj/a.ts"), T0);
    expect(tracker.onEvent(ev("a", "PreToolUse", "/proj/a.ts"), T0 + 1000)).toBe(false);
    expect(tracker.onEvent({ session_id: "a", hook_event_name: "UserPromptSubmit" }, T0)).toBe(false);
    expect(tracker.onEvent({ hook_event_name: "Stop" }, T0)).toBe(false);
    expect(tracker.onEvent({ session_id: "zzz", hook_event_name: "Stop" }, T0)).toBe(false);
    expect(tracker.sweep(T0 + 1000)).toBe(false);
  });

  it("releases on Stop and SessionEnd, but not for squire events", () => {
    const tracker = new TerritoryTracker();
    tracker.onEvent(ev("a", "PreToolUse", "/proj/a.ts"), T0);
    expect(tracker.onEvent({ session_id: "a", hook_event_name: "Stop", agent_id: "sq" }, T0 + 1)).toBe(false);
    expect(tracker.onEvent({ session_id: "a", hook_event_name: "SubagentStop", agent_id: "sq" }, T0 + 1)).toBe(false);
    expect(tracker.snapshot().claims).toHaveLength(1);
    expect(tracker.onEvent({ session_id: "a", hook_event_name: "Stop" }, T0 + 2)).toBe(true);
    expect(tracker.snapshot().claims).toEqual([]);
    tracker.onEvent(ev("a", "PreToolUse", "/proj/a.ts"), T0 + 3);
    expect(tracker.onEvent({ session_id: "a", hook_event_name: "SessionEnd" }, T0 + 4)).toBe(true);
    expect(tracker.snapshot().claims).toEqual([]);
  });

  it("late PostToolUse after Stop does not re-create a claim; Post refreshes an existing one", () => {
    const tracker = new TerritoryTracker();
    tracker.onEvent(ev("a", "PreToolUse", "/proj/a.ts"), T0);
    tracker.onEvent({ session_id: "a", hook_event_name: "Stop" }, T0 + 1);
    expect(tracker.onEvent(ev("a", "PostToolUse", "/proj/a.ts"), T0 + 2)).toBe(false);
    expect(tracker.snapshot().claims).toEqual([]);
    tracker.onEvent(ev("a", "PreToolUse", "/proj/b.ts"), T0 + 3);
    tracker.onEvent(ev("a", "PostToolUse", "/proj/b.ts"), T0 + 9 * MIN);
    tracker.sweep(T0 + 15 * MIN);
    expect(tracker.snapshot().claims).toHaveLength(1);
  });

  it("expires claims untouched for 10 minutes via sweep", () => {
    const tracker = new TerritoryTracker();
    tracker.onEvent(ev("a", "PreToolUse", "/proj/a.ts"), T0);
    tracker.onEvent(ev("a", "PreToolUse", "/proj/b.ts"), T0 + 5 * MIN);
    expect(tracker.sweep(T0 + 10 * MIN - 1)).toBe(false);
    expect(tracker.sweep(T0 + 10 * MIN)).toBe(true);
    expect(tracker.snapshot().claims).toEqual([{ sid: "a", files: ["b.ts"] }]);
    expect(tracker.sweep(T0 + 15 * MIN)).toBe(true);
    expect(tracker.snapshot().claims).toEqual([]);
  });

  it("squires count as the parent session and never conflict with it", () => {
    const tracker = new TerritoryTracker();
    tracker.onEvent(ev("a", "PreToolUse", "/proj/a.ts"), T0);
    tracker.onEvent(ev("a", "PreToolUse", "/proj/a.ts", { agent_id: "sq" }), T0 + 1);
    tracker.onEvent(ev("a", "PostToolUseFailure", "/proj/a.ts", { agent_id: "sq" }), T0 + 2);
    expect(tracker.snapshot()).toEqual({ claims: [{ sid: "a", files: ["a.ts"] }], conflicts: [] });
  });
});

describe("TerritoryTracker conflicts", () => {
  it("flags overlap when two sessions hold the same file, ends when one releases", () => {
    const tracker = new TerritoryTracker();
    tracker.onEvent(ev("b", "PreToolUse", "/proj/a.ts"), T0);
    tracker.onEvent(ev("a", "PreToolUse", "/proj/a.ts"), T0 + 1000);
    expect(tracker.snapshot().conflicts).toEqual([
      { file: "a.ts", sids: ["a", "b"], level: "overlap", since: T0 + 1000 },
    ]);
    tracker.onEvent(ev("a", "PreToolUse", "/proj/a.ts"), T0 + 2000); // refresh keeps `since`
    expect(tracker.snapshot().conflicts[0].since).toBe(T0 + 1000);
    tracker.onEvent({ session_id: "b", hook_event_name: "Stop" }, T0 + 3000);
    expect(tracker.snapshot().conflicts).toEqual([]);
  });

  it("different files do not overlap", () => {
    const tracker = new TerritoryTracker();
    tracker.onEvent(ev("a", "PreToolUse", "/proj/a.ts"), T0);
    tracker.onEvent(ev("b", "PreToolUse", "/proj/b.ts"), T0);
    expect(tracker.snapshot().conflicts).toEqual([]);
  });

  it("escalates to clash on PostToolUseFailure with a holder, since = escalation time", () => {
    const tracker = new TerritoryTracker();
    tracker.onEvent(ev("a", "PreToolUse", "/proj/a.ts"), T0);
    tracker.onEvent(ev("b", "PreToolUse", "/proj/a.ts"), T0 + 1000);
    expect(tracker.onEvent(ev("b", "PostToolUseFailure", "/proj/a.ts"), T0 + 5000)).toBe(true);
    expect(tracker.snapshot().conflicts).toEqual([
      { file: "a.ts", sids: ["a", "b"], level: "clash", since: T0 + 5000, failer: "b" },
    ]);
    // repeated failure: nothing changes, since preserved
    expect(tracker.onEvent(ev("b", "PostToolUseFailure", "/proj/a.ts"), T0 + 9000)).toBe(false);
  });

  it("clash carries the failing sid, and the message is stable across repeats", () => {
    const tracker = new TerritoryTracker();
    tracker.onEvent(ev("a", "PreToolUse", "/proj/a.ts"), T0);
    tracker.onEvent(ev("b", "PreToolUse", "/proj/a.ts"), T0 + 1000);
    // overlap first: no failer
    expect(tracker.snapshot().conflicts[0]).not.toHaveProperty("failer");
    tracker.onEvent(ev("b", "PostToolUseFailure", "/proj/a.ts"), T0 + 5000);
    const conflict = tracker.snapshot().conflicts[0];
    expect(conflict.failer).toBe("b");
    expect(tracker.sweep(T0 + 6000)).toBe(false);
    expect(tracker.snapshot().conflicts[0]).toEqual(conflict);
  });

  it("clashes when the other session released but touched within 2 minutes", () => {
    const tracker = new TerritoryTracker();
    tracker.onEvent(ev("a", "PreToolUse", "/proj/a.ts"), T0);
    tracker.onEvent({ session_id: "a", hook_event_name: "Stop" }, T0 + 1000);
    tracker.onEvent(ev("b", "PostToolUseFailure", "/proj/a.ts"), T0 + 2 * MIN - 1);
    expect(tracker.snapshot().conflicts).toMatchObject([{ file: "a.ts", level: "clash", sids: ["a", "b"] }]);
  });

  it("no clash when the other touch is older than 2 minutes after release", () => {
    const tracker = new TerritoryTracker();
    tracker.onEvent(ev("a", "PreToolUse", "/proj/a.ts"), T0);
    tracker.onEvent({ session_id: "a", hook_event_name: "Stop" }, T0 + 1000);
    expect(tracker.onEvent(ev("b", "PostToolUseFailure", "/proj/a.ts"), T0 + 2 * MIN)).toBe(false);
    expect(tracker.snapshot().conflicts).toEqual([]);
  });

  it("no clash for a failure on an untouched file or by the only session", () => {
    const tracker = new TerritoryTracker();
    expect(tracker.onEvent(ev("a", "PostToolUseFailure", "/proj/a.ts"), T0)).toBe(false);
    tracker.onEvent(ev("a", "PreToolUse", "/proj/a.ts"), T0);
    expect(tracker.onEvent(ev("a", "PostToolUseFailure", "/proj/a.ts"), T0 + 1)).toBe(false);
    expect(tracker.snapshot().conflicts).toEqual([]);
  });

  it("clash clears when the failing session later edits the file successfully", () => {
    const tracker = new TerritoryTracker();
    tracker.onEvent(ev("a", "PreToolUse", "/proj/a.ts"), T0);
    tracker.onEvent(ev("b", "PostToolUseFailure", "/proj/a.ts"), T0 + 1000);
    expect(tracker.snapshot().conflicts[0].level).toBe("clash");
    tracker.onEvent(ev("b", "PreToolUse", "/proj/a.ts"), T0 + 1500);
    tracker.onEvent(ev("b", "PostToolUse", "/proj/a.ts"), T0 + 2000);
    // b now holds the file too -> falls back to overlap
    expect(tracker.snapshot().conflicts).toMatchObject([{ level: "overlap", sids: ["a", "b"] }]);
  });

  it("clash ends after 2 min once the others released, and after 10 min regardless", () => {
    const tracker = new TerritoryTracker();
    tracker.onEvent(ev("a", "PreToolUse", "/proj/a.ts"), T0);
    tracker.onEvent(ev("b", "PostToolUseFailure", "/proj/a.ts"), T0 + 1000);
    tracker.onEvent({ session_id: "a", hook_event_name: "Stop" }, T0 + 2000);
    expect(tracker.sweep(T0 + 1000 + 2 * MIN - 1)).toBe(false);
    expect(tracker.sweep(T0 + 1000 + 2 * MIN)).toBe(true);
    expect(tracker.snapshot().conflicts).toEqual([]);

    const fresh = new TerritoryTracker();
    fresh.onEvent(ev("a", "PreToolUse", "/proj/a.ts"), T0);
    fresh.onEvent(ev("b", "PostToolUseFailure", "/proj/a.ts"), T0);
    for (let i = 1; i <= 9; i++) fresh.onEvent(ev("a", "PreToolUse", "/proj/a.ts"), T0 + i * MIN); // a keeps holding
    expect(fresh.snapshot().conflicts[0].level).toBe("clash");
    fresh.onEvent(ev("a", "PreToolUse", "/proj/a.ts"), T0 + 10 * MIN);
    expect(fresh.snapshot().conflicts).toEqual([]);
  });

  it("sorts clashes first, then newest since; sids sorted", () => {
    const tracker = new TerritoryTracker();
    tracker.onEvent(ev("b", "PreToolUse", "/proj/o1.ts"), T0);
    tracker.onEvent(ev("a", "PreToolUse", "/proj/o1.ts"), T0 + 1);
    tracker.onEvent(ev("b", "PreToolUse", "/proj/o2.ts"), T0 + 2);
    tracker.onEvent(ev("a", "PreToolUse", "/proj/o2.ts"), T0 + 3);
    tracker.onEvent(ev("b", "PreToolUse", "/proj/c.ts"), T0 + 4);
    tracker.onEvent(ev("a", "PostToolUseFailure", "/proj/c.ts"), T0 + 5);
    expect(tracker.snapshot().conflicts.map((conflict) => [conflict.file, conflict.level])).toEqual([
      ["c.ts", "clash"],
      ["o2.ts", "overlap"],
      ["o1.ts", "overlap"],
    ]);
    expect(tracker.snapshot().conflicts[0].sids).toEqual(["a", "b"]);
  });

  it("never sends absolute paths", () => {
    const tracker = new TerritoryTracker();
    tracker.onEvent(ev("a", "PreToolUse", "/elsewhere/deep/dir/a.ts"), T0);
    tracker.onEvent(ev("b", "PreToolUse", "/elsewhere/deep/dir/a.ts"), T0);
    expect(tracker.snapshot().claims[0].files).toEqual(["dir/a.ts"]);
    expect(tracker.snapshot().conflicts[0].file).toBe("dir/a.ts");
  });

  it("dropSession removes claims and clashes", () => {
    const tracker = new TerritoryTracker();
    tracker.onEvent(ev("a", "PreToolUse", "/proj/a.ts"), T0);
    tracker.onEvent(ev("b", "PostToolUseFailure", "/proj/a.ts"), T0);
    expect(tracker.dropSession("a", T0 + 1)).toBe(true);
    expect(tracker.snapshot()).toEqual({ claims: [], conflicts: [] });
    expect(tracker.dropSession("a", T0 + 2)).toBe(false);
  });
});

describe("TerritoryTracker caps", () => {
  it("keeps at most 50 claims per session, evicting the oldest", () => {
    const tracker = new TerritoryTracker();
    for (let i = 0; i < 60; i++) tracker.onEvent(ev("a", "PreToolUse", `/proj/f${i}.ts`), T0 + i);
    const files = tracker.snapshot().claims[0].files;
    expect(files).toHaveLength(50);
    expect(files[0]).toBe("f59.ts");
    expect(files).not.toContain("f0.ts");
    expect(files).toContain("f10.ts");
  });

  it("keeps at most 2000 claims overall, evicting the oldest globally", () => {
    const tracker = new TerritoryTracker();
    let counter = 0;
    for (let index = 0; index < 41; index++)
      for (let i = 0; i < 50; i++) tracker.onEvent(ev(`s${index}`, "PreToolUse", `/proj/f${i}.ts`), T0 + counter++);
    const total = tracker.snapshot().claims.reduce((total, claim) => total + claim.files.length, 0);
    expect(total).toBe(2000);
    expect(tracker.snapshot().claims.find((conflict) => conflict.sid === "s0")).toBeUndefined(); // the 50 oldest claims were evicted
    expect(tracker.snapshot().claims.find((conflict) => conflict.sid === "s40")!.files).toHaveLength(50);
  });
});
