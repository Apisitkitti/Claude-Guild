import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type RouteMod = typeof import("@/app/events/route");
type StoreMod = typeof import("@/lib/store");
let route: RouteMod;
let store: StoreMod;
let sent: string[];
let unsub: () => void;

const post = (query: string, body: unknown, headers: Record<string, string> = {}) =>
  route.POST(
    new Request(`http://localhost:5050/events${query}`, {
      method: "POST",
      headers: { "content-type": "application/json", host: "localhost:5050", ...headers },
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
  );

beforeEach(async () => {
  vi.spyOn(console, "log").mockImplementation(() => {});
  (globalThis as { __claudeOffice?: unknown }).__claudeOffice = undefined;
  vi.resetModules();
  store = await import("@/lib/store");
  route = await import("@/app/events/route");
  sent = [];
  unsub = store.subscribe((frame) => sent.push(frame));
});
afterEach(() => {
  unsub();
  vi.restoreAllMocks();
});

const SECRET = "sk-ant-api03-ABCDEFGH12345678abcdefgh";

describe("adapted events through the real store", () => {
  it("redacts secrets in tool_input before storing and broadcasting", async () => {
    const res = await post("?source=codex", {
      session_id: "redact1",
      hook_event_name: "PreToolUse",
      tool_name: "Bash",
      tool_input: { command: `curl -H "Authorization: Bearer ${SECRET}" x` },
    });
    expect(res.status).toBe(204);
    expect(sent.join("")).toContain("redact1-cx");
    expect(sent.join("")).not.toContain(SECRET);
    expect(JSON.stringify(store.snapshot())).not.toContain(SECRET);
  });
  it("redacts Cursor and Copilot payloads too", async () => {
    await post("?source=cursor", {
      conversation_id: "redact2",
      hook_event_name: "postToolUse",
      tool_name: "Shell",
      tool_input: { command: `export TOKEN=${SECRET}` },
    });
    await post("?source=copilot&event=preToolUse", {
      sessionId: "redact3",
      toolName: "bash",
      toolArgs: JSON.stringify({ command: `echo ${SECRET}` }),
    });
    expect(JSON.stringify(store.snapshot())).toContain("redact2-cu");
    expect(JSON.stringify(store.snapshot())).toContain("redact3-cp");
    expect(JSON.stringify(store.snapshot())).not.toContain(SECRET);
    expect(sent.join("")).not.toContain(SECRET);
  });
  it("guard order: foreign host 403 before content-type 415 before source 400", async () => {
    const foreign = await post("?source=nope", {}, { host: "evil.example", "content-type": "text/plain" });
    expect(foreign.status).toBe(403);
    expect((await post("?source=nope", {}, { "content-type": "text/plain" })).status).toBe(415);
    expect((await post("?source=nope", {})).status).toBe(400);
    expect(store.snapshot().events).toHaveLength(0);
  });
});
