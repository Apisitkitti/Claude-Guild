import { beforeEach, describe, expect, it, vi } from "vitest";

const addEvent = vi.fn();
vi.mock("@/lib/store", () => ({ addEvent: (evt: unknown) => addEvent(evt), isForeignOrigin: () => false }));

import { POST } from "@/app/events/route";

const post = (query: string, body: unknown, contentType = "application/json") =>
  POST(
    new Request(`http://localhost:5050/events${query}`, {
      method: "POST",
      headers: { "content-type": contentType, host: "localhost:5050" },
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
  );

beforeEach(() => addEvent.mockReset());

describe("POST /events source handling", () => {
  it("default is Claude Code, unchanged", async () => {
    const payload = { session_id: "abc", hook_event_name: "Stop" };
    expect((await post("", payload)).status).toBe(204);
    expect(addEvent).toHaveBeenCalledWith(payload);
  });
  it("?source=codex normalizes", async () => {
    await post("?source=codex", { session_id: "abc", hook_event_name: "Stop" });
    expect(addEvent).toHaveBeenCalledWith(expect.objectContaining({ session_id: "abc-cx", agent_source: "codex" }));
  });
  it("?source=copilot&event= supplies the event name", async () => {
    await post("?source=copilot&event=preToolUse", { sessionId: "s", toolName: "bash", toolArgs: { command: "ls" } });
    expect(addEvent).toHaveBeenCalledWith(
      expect.objectContaining({ session_id: "s-cp", hook_event_name: "PreToolUse", tool_name: "Bash" }),
    );
  });
  it("auto-detects Cursor and Copilot payloads without ?source", async () => {
    await post("", { conversation_id: "c1", hook_event_name: "stop" });
    expect(addEvent).toHaveBeenLastCalledWith(
      expect.objectContaining({ session_id: "c1-cu", hook_event_name: "Stop" }),
    );
    await post("?event=sessionEnd", { sessionId: "p1" });
    expect(addEvent).toHaveBeenLastCalledWith(
      expect.objectContaining({ session_id: "p1-cp", hook_event_name: "SessionEnd" }),
    );
  });
  it("events the office does not use are ignored with 204", async () => {
    expect((await post("?source=cursor", { conversation_id: "c", hook_event_name: "afterAgentThought" })).status).toBe(
      204,
    );
    expect(addEvent).not.toHaveBeenCalled();
  });
  it("unknown source -> 400, bad json -> 400, wrong content-type -> 415", async () => {
    expect((await post("?source=nope", {})).status).toBe(400);
    expect((await post("?source=cursor", "{oops")).status).toBe(400);
    expect((await post("?source=cursor", [])).status).toBe(400);
    expect((await post("?source=cursor", {}, "text/plain")).status).toBe(415);
    expect(addEvent).not.toHaveBeenCalled();
  });
});
