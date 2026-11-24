import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { cleanDoingText, DOING_IDLE_S, DOING_TEXT_MAX, formatDoing } from "@/lib/office/doingText";

import { ev, newOffice, seat, sid, stubStorage, tick } from "./helpers";

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
  stubStorage();
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const pre = (id: string, tool: string, input: Record<string, unknown> = {}, extra: Record<string, unknown> = {}) =>
  ev(id, "PreToolUse", { tool_name: tool, tool_input: input, ...extra });
const doingOf = (office: ReturnType<typeof newOffice>) => office.getView().roster[0].doing;

describe("doing text formatting", () => {
  it("collapses whitespace and strips control chars", () => {
    expect(cleanDoingText("npm \n  test\u0007\u001b[0m   now")).toBe("npm test [0m now");
  });
  it("truncates with an ellipsis", () => {
    const out = cleanDoingText("x".repeat(100));
    expect(out).toHaveLength(DOING_TEXT_MAX);
    expect(out.endsWith("…")).toBe(true);
  });
  it("formats tool + detail, subagent tasks and MCP", () => {
    expect(formatDoing("Edit", "engine.ts")).toBe("Edit engine.ts");
    expect(formatDoing("Task", "review diff")).toBe("Task: review diff");
    expect(formatDoing("mcp__linear__get_issue", "")).toBe("mcp linear · get_issue");
    expect(formatDoing("Glob", "")).toBe("Glob");
  });
});

describe("doing on the roster", () => {
  it("is set on PreToolUse with a basename", () => {
    const office = newOffice();
    const id = sid();
    seat(office, id);
    expect(doingOf(office)).toBeNull();
    office.event(pre(id, "Edit", { file_path: "/work/proj/src/engine.ts" }));
    expect(doingOf(office)).toBe("Edit engine.ts");
    office.event(pre(id, "Bash", { command: "npm   test\n--run" }));
    expect(doingOf(office)).toBe("Bash npm test --run");
  });

  it("is cleared on Stop and StopFailure", () => {
    for (const stop of ["Stop", "StopFailure"]) {
      const office = newOffice();
      const id = sid();
      seat(office, id);
      office.event(pre(id, "Read", { file_path: "/a/README.md" }));
      expect(doingOf(office)).toBe("Read README.md");
      office.event(ev(id, stop));
      expect(doingOf(office)).toBeNull();
    }
  });

  it("goes away after the idle window", () => {
    const office = newOffice();
    const id = sid();
    seat(office, id);
    office.event(pre(id, "Grep", { pattern: "useSound" }, { tool_use_id: "g1" }));
    office.event(ev(id, "PostToolUse", { tool_name: "Grep", tool_use_id: "g1" }));
    tick(office, DOING_IDLE_S - 5);
    expect(doingOf(office)).toBe("Grep useSound");
    tick(office, 10);
    expect(doingOf(office)).toBeNull();
  });

  it("shows the tool a permission request asks for", () => {
    const office = newOffice();
    const id = sid();
    seat(office, id);
    office.event(ev(id, "PermissionRequest", { tool_name: "Bash", tool_input: { command: "rm -rf build" } }));
    expect(doingOf(office)).toBe("Bash"); // no earlier call of that tool: the detail stays out
  });

  it("ignores squire tool events", () => {
    const office = newOffice();
    const id = sid();
    seat(office, id);
    office.event(pre(id, "Edit", { file_path: "/a/main.ts" }));
    office.event(ev(id, "SubagentStart", { agent_id: "sq1", agent_type: "Explore" }));
    office.event(pre(id, "Read", { file_path: "/a/other.ts" }, { agent_id: "sq1", agent_type: "Explore" }));
    expect(doingOf(office)).toBe("Edit main.ts");
  });
});

describe("doing line lifetime and permission requests", () => {
  it("a tool that is still pending keeps its line past the idle expiry", () => {
    const office = newOffice();
    const id = sid();
    seat(office, id);
    office.event(pre(id, "Bash", { command: "npm test" }, { tool_use_id: "long" }));
    tick(office, DOING_IDLE_S + 30);
    expect(doingOf(office)).toBe("Bash npm test");
    office.event(ev(id, "PostToolUse", { tool_name: "Bash", tool_use_id: "long" }));
    tick(office, DOING_IDLE_S + 1);
    expect(doingOf(office)).toBeNull();
  });
  it("a permission request keeps the detail of the matching tool and clears it otherwise", () => {
    const office = newOffice();
    const id = sid();
    seat(office, id);
    office.event(pre(id, "Edit", { file_path: "/work/proj/src/engine.ts" }));
    office.event(ev(id, "PermissionRequest", { tool_name: "Edit", tool_input: { file_path: "/work/proj/other.ts" } }));
    expect(doingOf(office)).toBe("Edit engine.ts");
    office.event(ev(id, "PermissionRequest", { tool_name: "Write", tool_input: { file_path: "/work/proj/other.ts" } }));
    expect(doingOf(office)).toBe("Write");
  });
});

describe("cleanDoingText home dir", () => {
  it("masks the account name in home paths", async () => {
    const { cleanDoingText } = await import("@/lib/office/doingText");
    expect(cleanDoingText("cd /Users/demo/work && ls", 80)).toBe("cd ~/work && ls");
    expect(cleanDoingText("cat /home/sam/notes.md", 80)).toBe("cat ~/notes.md");
    expect(cleanDoingText("ls /Users/demo", 80)).toBe("ls ~");
  });
  it("masks Claude-encoded project paths, Windows drives and lowercase variants", async () => {
    const { cleanDoingText } = await import("@/lib/office/doingText");
    expect(cleanDoingText("/private/tmp/claude-501/-Users-demo-proj/x", 80)).toBe("/private/tmp/claude-501/~/x");
    expect(cleanDoingText("~/.claude/projects/-Users-demo-proj/a.jsonl", 80)).not.toContain("demo");
    expect(cleanDoingText("C:/Users/demo/app", 80)).toBe("~/app");
    expect(cleanDoingText("c:\\users\\demo\\app", 80)).toBe("~\\app");
    expect(cleanDoingText("cd \\users\\demo", 80)).not.toContain("demo");
  });
});
