import { describe, expect, it } from "vitest";

import { normalizeEvent } from "@/lib/adapters";

const SID = "11111111-aaaa-bbbb-cccc-222222222222";

describe("adapters pass the model through", () => {
  it("codex", () => {
    const evt = normalizeEvent(
      { session_id: SID, hook_event_name: "UserPromptSubmit", model: "gpt-5.1-codex" },
      "codex",
    );
    expect(evt).toMatchObject({ model: "gpt-5.1-codex", agent_source: "codex" });
  });
  it("copilot", () => {
    const evt = normalizeEvent({ sessionId: SID, hook_event_name: "sessionStart", model: "gpt-4.1" }, "copilot");
    expect(evt).toMatchObject({ model: "gpt-4.1", agent_source: "copilot" });
  });
  it("cursor", () => {
    const evt = normalizeEvent(
      { conversation_id: SID, hook_event_name: "beforeSubmitPrompt", model: "sonnet-4.5" },
      "cursor",
    );
    expect(evt).toMatchObject({ model: "sonnet-4.5", agent_source: "cursor" });
  });
  it("omits model when the payload has none", () => {
    const evt = normalizeEvent({ session_id: SID, hook_event_name: "UserPromptSubmit" }, "codex");
    expect(evt).not.toHaveProperty("model");
  });
});
