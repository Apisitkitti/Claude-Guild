import { describe, expect, it } from "vitest";

import { detectSource, normalizeEvent } from "@/lib/adapters";

const SID = "11111111-aaaa-bbbb-cccc-222222222222";

describe("claude passthrough", () => {
  it("returns the payload untouched", () => {
    const raw = { session_id: SID, hook_event_name: "PreToolUse", tool_name: "Bash" };
    expect(normalizeEvent(raw, "claude")).toBe(raw);
  });
});

describe("codex", () => {
  const base = { session_id: SID, cwd: "/w", model: "gpt", turn_id: "t1" };
  it("keeps Claude-like events and suffixes the session id", () => {
    const evt = normalizeEvent(
      { ...base, hook_event_name: "PreToolUse", tool_name: "Bash", tool_use_id: "u1", tool_input: { command: "ls" } },
      "codex",
    );
    expect(evt).toMatchObject({
      session_id: `${SID}-cx`,
      hook_event_name: "PreToolUse",
      tool_name: "Bash",
      tool_input: { command: "ls" },
      cwd: "/w",
      agent_source: "codex",
    });
    expect(evt).not.toHaveProperty("turn_id");
  });
  it("never forwards transcript_path (not Claude's format)", () => {
    expect(normalizeEvent({ ...base, hook_event_name: "Stop", transcript_path: "/t" }, "codex")).not.toHaveProperty(
      "transcript_path",
    );
  });
  it("Stop keeps last_assistant_message; Interrupt becomes Stop", () => {
    expect(normalizeEvent({ ...base, hook_event_name: "Stop", last_assistant_message: "done" }, "codex")).toMatchObject(
      { hook_event_name: "Stop", last_assistant_message: "done" },
    );
    expect(normalizeEvent({ ...base, hook_event_name: "Interrupt" }, "codex")?.hook_event_name).toBe("Stop");
  });
  it("subagents keep agent_id", () => {
    expect(
      normalizeEvent({ ...base, hook_event_name: "SubagentStart", agent_id: "a1", agent_type: "worker" }, "codex"),
    ).toMatchObject({ hook_event_name: "SubagentStart", agent_id: "a1", agent_type: "worker" });
  });
  it("apply_patch becomes an Edit on the first patched file", () => {
    const patch = "*** Begin Patch\n*** Update File: src/a.ts\n@@\n-x\n+y\n*** End Patch";
    expect(
      normalizeEvent(
        { ...base, hook_event_name: "PostToolUse", tool_name: "apply_patch", tool_input: { command: patch } },
        "codex",
      ),
    ).toMatchObject({ tool_name: "Edit", tool_input: { file_path: "src/a.ts" } });
  });
  it("a Bash PostToolUse with non-zero exit code becomes PostToolUseFailure", () => {
    expect(
      normalizeEvent(
        {
          ...base,
          hook_event_name: "PostToolUse",
          tool_name: "Bash",
          tool_input: { command: "false" },
          tool_response: { exit_code: 1, stderr: "boom" },
        },
        "codex",
      ),
    ).toMatchObject({ hook_event_name: "PostToolUseFailure", error: "boom" });
  });
  it("ignores model-request and unknown events", () => {
    for (const name of ["PreModelRequest", "PostModelRequest", "PostCompact", "Whatever"])
      expect(normalizeEvent({ ...base, hook_event_name: name }, "codex")).toBeNull();
  });
  it("needs a session id", () => {
    expect(normalizeEvent({ hook_event_name: "Stop" }, "codex")).toBeNull();
  });
});

describe("copilot", () => {
  it("maps camelCase events and payload (event name from hint)", () => {
    const evt = normalizeEvent(
      { sessionId: "s1", timestamp: 1, cwd: "/w", toolName: "bash", toolArgs: '{"command":"ls"}' },
      "copilot",
      { event: "preToolUse" },
    );
    expect(evt).toMatchObject({
      session_id: "s1-cp",
      hook_event_name: "PreToolUse",
      tool_name: "Bash",
      tool_input: { command: "ls" },
      agent_source: "copilot",
    });
  });
  it("maps PascalCase + snake_case payload", () => {
    expect(
      normalizeEvent(
        {
          hook_event_name: "PostToolUse",
          session_id: "s2",
          cwd: "/w",
          tool_name: "edit",
          tool_input: { path: "a.ts", old_str: "a", new_str: "b" },
          tool_result: { result_type: "success" },
        },
        "copilot",
      ),
    ).toMatchObject({
      session_id: "s2-cp",
      hook_event_name: "PostToolUse",
      tool_name: "Edit",
      tool_input: { file_path: "a.ts", old_string: "a", new_string: "b" },
    });
  });
  it("renames user prompt / agentStop / failure", () => {
    const hint = (event: string) => normalizeEvent({ sessionId: "s", prompt: "hi" }, "copilot", { event });
    expect(hint("userPromptSubmitted")?.hook_event_name).toBe("UserPromptSubmit");
    expect(hint("agentStop")?.hook_event_name).toBe("Stop");
    expect(
      normalizeEvent({ sessionId: "s", toolName: "view", toolArgs: { path: "/a" }, error: "no" }, "copilot", {
        event: "postToolUseFailure",
      }),
    ).toMatchObject({
      hook_event_name: "PostToolUseFailure",
      tool_name: "Read",
      error: "no",
      tool_input: { file_path: "/a" },
    });
  });
  it("a postToolUse whose result failed becomes PostToolUseFailure", () => {
    expect(
      normalizeEvent(
        {
          sessionId: "s",
          toolName: "bash",
          toolArgs: {},
          toolResult: { resultType: "failure", textResultForLlm: "bad" },
        },
        "copilot",
        { event: "postToolUse" },
      ),
    ).toMatchObject({ hook_event_name: "PostToolUseFailure", error: "bad" });
  });
  it("subagent events carry an agent id (id, else name)", () => {
    expect(
      normalizeEvent({ sessionId: "s", agentName: "explore" }, "copilot", { event: "subagentStart" }),
    ).toMatchObject({ hook_event_name: "SubagentStart", agent_id: "explore" });
    expect(
      normalizeEvent({ sessionId: "s", agentId: "a9", agentType: "x", response: "ok" }, "copilot", {
        event: "subagentStop",
      }),
    ).toMatchObject({ hook_event_name: "SubagentStop", agent_id: "a9", last_assistant_message: "ok" });
  });
  it("ignores errorOccurred, unknown and nameless events", () => {
    expect(normalizeEvent({ sessionId: "s" }, "copilot", { event: "errorOccurred" })).toBeNull();
    expect(normalizeEvent({ sessionId: "s" }, "copilot")).toBeNull();
  });
});

describe("cursor", () => {
  const base = { conversation_id: "conv-1", generation_id: "g", workspace_roots: ["/ws", "/other"], model: "m" };
  it("uses conversation_id as session id and the first workspace root as cwd", () => {
    expect(normalizeEvent({ ...base, hook_event_name: "sessionStart", session_id: "x" }, "cursor")).toMatchObject({
      session_id: "conv-1-cu",
      hook_event_name: "SessionStart",
      cwd: "/ws",
      agent_source: "cursor",
    });
  });
  it("maps generic tool events and names", () => {
    expect(
      normalizeEvent(
        {
          ...base,
          hook_event_name: "postToolUse",
          tool_name: "Shell",
          tool_input: { command: "ls" },
          tool_use_id: "t",
        },
        "cursor",
      ),
    ).toMatchObject({
      hook_event_name: "PostToolUse",
      tool_name: "Bash",
      tool_input: { command: "ls" },
      tool_use_id: "t",
    });
    expect(
      normalizeEvent(
        { ...base, hook_event_name: "postToolUse", tool_name: "MCP:search", mcp_server_name: "ctx" },
        "cursor",
      ),
    ).toMatchObject({ tool_name: "mcp__ctx__search" });
  });
  it("failures carry the error", () => {
    expect(
      normalizeEvent(
        {
          ...base,
          hook_event_name: "postToolUseFailure",
          tool_name: "Shell",
          error_message: "denied",
          is_interrupt: true,
        },
        "cursor",
      ),
    ).toMatchObject({ hook_event_name: "PostToolUseFailure", error: "denied" });
  });
  it("maps shell / MCP / read / file edit hooks", () => {
    expect(
      normalizeEvent({ ...base, hook_event_name: "beforeShellExecution", command: "npm test", cwd: "/c" }, "cursor"),
    ).toMatchObject({
      hook_event_name: "PreToolUse",
      tool_name: "Bash",
      tool_input: { command: "npm test" },
      cwd: "/c",
    });
    expect(
      normalizeEvent({ ...base, hook_event_name: "afterShellExecution", command: "ls", output: "x" }, "cursor"),
    ).toMatchObject({
      hook_event_name: "PostToolUse",
      tool_name: "Bash",
    });
    expect(
      normalizeEvent(
        { ...base, hook_event_name: "beforeMCPExecution", tool_name: "q", mcp_server_name: "db", tool_input: {} },
        "cursor",
      ),
    ).toMatchObject({ hook_event_name: "PreToolUse", tool_name: "mcp__db__q" });
    expect(normalizeEvent({ ...base, hook_event_name: "beforeReadFile", file_path: "/a.ts" }, "cursor")).toMatchObject({
      hook_event_name: "PreToolUse",
      tool_name: "Read",
      tool_input: { file_path: "/a.ts" },
    });
    expect(
      normalizeEvent(
        {
          ...base,
          hook_event_name: "afterFileEdit",
          file_path: "/a.ts",
          edits: [{ old_string: "a", new_string: "b" }],
        },
        "cursor",
      ),
    ).toMatchObject({
      hook_event_name: "PostToolUse",
      tool_name: "Edit",
      tool_input: { file_path: "/a.ts", old_string: "a", new_string: "b" },
    });
  });
  it("maps prompt, stop, compact, subagents", () => {
    expect(
      normalizeEvent({ ...base, hook_event_name: "beforeSubmitPrompt", prompt: "go" }, "cursor")?.hook_event_name,
    ).toBe("UserPromptSubmit");
    expect(normalizeEvent({ ...base, hook_event_name: "stop", status: "completed" }, "cursor")?.hook_event_name).toBe(
      "Stop",
    );
    expect(normalizeEvent({ ...base, hook_event_name: "preCompact", trigger: "auto" }, "cursor")?.hook_event_name).toBe(
      "PreCompact",
    );
    expect(
      normalizeEvent(
        { ...base, hook_event_name: "subagentStart", subagent_id: "sa", subagent_type: "explore" },
        "cursor",
      ),
    ).toMatchObject({ hook_event_name: "SubagentStart", agent_id: "sa", agent_type: "explore" });
  });
  it("ignores events the office does not use", () => {
    for (const name of [
      "afterAgentResponse",
      "afterAgentThought",
      "beforeTabFileRead",
      "afterTabFileEdit",
      "workspaceOpen",
    ])
      expect(normalizeEvent({ ...base, hook_event_name: name }, "cursor")).toBeNull();
  });
});

describe("session ids", () => {
  it("never collide across sources and keep the first characters (UI tag) of the native id", () => {
    const ids = [
      normalizeEvent({ session_id: SID, hook_event_name: "SessionStart" }, "codex")?.session_id,
      normalizeEvent({ sessionId: SID }, "copilot", { event: "sessionStart" })?.session_id,
      normalizeEvent({ conversation_id: SID, hook_event_name: "sessionStart" }, "cursor")?.session_id,
    ];
    expect(new Set(ids).size).toBe(3);
    for (const id of ids) expect(id?.startsWith("111")).toBe(true);
  });
});

describe("detectSource", () => {
  it("detects Cursor, Copilot camelCase and defaults to claude", () => {
    expect(detectSource({ conversation_id: "c" })).toBe("cursor");
    expect(detectSource({ sessionId: "s" })).toBe("copilot");
    expect(detectSource({ session_id: "s", hook_event_name: "Stop" })).toBe("claude");
    expect(detectSource({})).toBe("claude");
  });
});

describe("inherited keys", () => {
  const evil = ["constructor", "toString", "__proto__", "hasOwnProperty", "valueOf"];
  it("never resolve event, tool or rename tables through the prototype", () => {
    for (const name of evil) {
      expect(normalizeEvent({ session_id: "s", hook_event_name: name }, "codex")).toBeNull();
      expect(normalizeEvent({ sessionId: "s" }, "copilot", { event: name })).toBeNull();
      expect(normalizeEvent({ conversation_id: "c", hook_event_name: name }, "cursor")).toBeNull();
      const copilot = normalizeEvent({ sessionId: "s", toolName: name }, "copilot", { event: "preToolUse" });
      expect(copilot?.tool_name).toBe(name);
      const cursor = normalizeEvent(
        { conversation_id: "c", hook_event_name: "postToolUse", tool_name: name },
        "cursor",
      );
      expect(cursor?.tool_name).toBe(name);
      expect(typeof cursor?.tool_name).toBe("string");
    }
  });
  it("drops prototype-polluting keys from tool input", () => {
    const input = JSON.parse('{"__proto__":{"polluted":1},"constructor":"x","path":"/a","command":"ls"}');
    for (const evt of [
      normalizeEvent({ session_id: "s", hook_event_name: "PreToolUse", tool_name: "Bash", tool_input: input }, "codex"),
      normalizeEvent({ sessionId: "s", toolName: "bash", toolArgs: input }, "copilot", { event: "preToolUse" }),
    ]) {
      const toolInput = evt?.tool_input as Record<string, unknown>;
      expect(Object.keys(toolInput)).not.toContain("__proto__");
      expect(Object.keys(toolInput)).not.toContain("constructor");
      expect(toolInput.command).toBe("ls");
      expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    }
  });
});

describe("subagent ids", () => {
  it("copilot start and stop share one id (the agent name)", () => {
    const start = normalizeEvent({ sessionId: "s", agentName: "explore" }, "copilot", { event: "subagentStart" });
    const stop = normalizeEvent({ sessionId: "s", agentId: "uuid-1", agentName: "explore" }, "copilot", {
      event: "subagentStop",
    });
    expect(start?.agent_id).toBe("explore");
    expect(stop?.agent_id).toBe("explore");
  });
  it("cursor stop without any id is unique per generation, not per type", () => {
    const stop = (generation: string) =>
      normalizeEvent(
        { conversation_id: "c", hook_event_name: "subagentStop", subagent_type: "explore", generation_id: generation },
        "cursor",
      )?.agent_id;
    expect(stop("g1")).not.toBe(stop("g2"));
    expect(
      normalizeEvent(
        { conversation_id: "c", hook_event_name: "subagentStop", subagent_id: "sa-1", subagent_type: "explore" },
        "cursor",
      )?.agent_id,
    ).toBe("sa-1");
  });
});
