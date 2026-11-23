import { describe, expect, it } from "vitest";

import { AttentionTracker } from "@/lib/attention";

describe("attention limit row", () => {
  it("shows one limit row per limited session with the reset text, and removes it on clear", () => {
    const tracker = new AttentionTracker();
    tracker.setLimit("s1", { since: 5, detail: "3pm (Asia/Bangkok)" });
    tracker.setLimit("s2", { since: 6, detail: null });
    const rows = tracker.queue(10).filter((row) => row.kind === "limit");
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ sid: "s1", since: 5, detail: "3pm (Asia/Bangkok)", key: "s1|limit|5" });
    expect(rows[1]).not.toHaveProperty("detail");
    tracker.setLimit("s1", null);
    expect(tracker.queue(10).filter((row) => row.kind === "limit")).toHaveLength(1);
  });

  it("ranks after asked and before context", () => {
    const tracker = new AttentionTracker();
    tracker.setContext("c", 0.95, 1);
    tracker.setLimit("l", { since: 2, detail: null });
    tracker.ingest({ session_id: "a", hook_event_name: "Stop", last_assistant_message: "Shall I continue?" }, 3);
    tracker.setWaiting("p", 4);
    expect(tracker.queue(5).map((row) => row.kind)).toEqual(["permission", "asked", "limit", "context"]);
  });

  it("a rate_limit StopFailure makes no done row; no StopFailure does", () => {
    const tracker = new AttentionTracker();
    tracker.ingest({ session_id: "s1", hook_event_name: "StopFailure", error: "rate_limit" }, 1);
    expect(tracker.queue(2)).toHaveLength(0);
    tracker.ingest({ session_id: "s2", hook_event_name: "StopFailure", error: "server_error" }, 1);
    expect(tracker.queue(2)).toHaveLength(0);
  });

  it("dropSession removes the limit", () => {
    const tracker = new AttentionTracker();
    tracker.setLimit("s1", { since: 1, detail: null });
    tracker.dropSession("s1");
    expect(tracker.queue(2)).toHaveLength(0);
  });
});
