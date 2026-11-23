import { describe, expect, it } from "vitest";

import { BOARD_SLOTS, BoardNotes, FALL_S, STAMP_S, sanitizeQuests, type QuestMsgRow } from "@/lib/office/questNotes";
import {
  MAX_QUEST_ITEMS,
  MAX_QUEST_SESSIONS,
  QUEST_END_GRACE_MS,
  QUEST_IDLE_TTL_MS,
  QUEST_TEXT_CHARS,
  QuestBoardTracker,
  type QuestEvent,
} from "@/lib/questBoard";

const post = (sid: string, tool: string, input: Record<string, unknown>, extra: QuestEvent = {}): QuestEvent => ({
  session_id: sid,
  hook_event_name: "PostToolUse",
  tool_name: tool,
  tool_input: input,
  cwd: "/w/guild-demo",
  ...extra,
});
const todos = (sid: string, list: Record<string, unknown>[], extra: QuestEvent = {}) =>
  post(sid, "TodoWrite", { todos: list }, extra);

describe("QuestBoardTracker", () => {
  it("TodoWrite replaces the whole list", () => {
    const tracker = new QuestBoardTracker();
    tracker.ingest(
      todos("a", [
        { content: "one", status: "in_progress", activeForm: "Doing one" },
        { content: "two", status: "pending", activeForm: "Doing two" },
      ]),
      1,
    );
    expect(tracker.rows()[0]).toMatchObject({
      sid: "a",
      project: "guild-demo",
      items: [
        { text: "one", status: "in_progress", active: "Doing one" },
        { text: "two", status: "pending" },
      ],
    });
    tracker.ingest(todos("a", [{ content: "three", status: "completed" }]), 2);
    expect(tracker.rows()[0].items).toEqual([{ text: "three", status: "completed" }]);
  });

  it("TaskCreate / TaskUpdate follow sequential ids, delete removes", () => {
    const tracker = new QuestBoardTracker();
    tracker.ingest(post("a", "TaskCreate", { subject: "first", activeForm: "Firsting" }), 1);
    tracker.ingest(post("a", "TaskCreate", { subject: "second" }), 2);
    tracker.ingest(post("a", "TaskUpdate", { taskId: "1", status: "in_progress" }), 3);
    expect(tracker.rows()[0].items).toEqual([
      { text: "first", status: "in_progress", active: "Firsting" },
      { text: "second", status: "pending" },
    ]);
    tracker.ingest(post("a", "TaskUpdate", { taskId: "1", status: "completed" }), 4);
    tracker.ingest(post("a", "TaskUpdate", { taskId: "2", status: "deleted" }), 5);
    tracker.ingest(post("a", "TaskUpdate", { taskId: "99", status: "completed" }), 6);
    expect(tracker.rows()[0].items).toEqual([{ text: "first", status: "completed" }]);
  });

  it("ignores subagents, failures and other tools", () => {
    const tracker = new QuestBoardTracker();
    expect(tracker.ingest(todos("a", [{ content: "x", status: "pending" }], { agent_id: "sq" }), 1)).toBe(false);
    expect(
      tracker.ingest(todos("a", [{ content: "x", status: "pending" }], { hook_event_name: "PreToolUse" }), 1),
    ).toBe(false);
    expect(tracker.ingest(post("a", "Bash", { command: "ls" }), 1)).toBe(false);
    expect(tracker.rows()).toEqual([]);
  });

  it("redacts and caps text, items and sessions", () => {
    const tracker = new QuestBoardTracker();
    const secret = "ghp_" + "a1".repeat(20);
    tracker.ingest(todos("a", [{ content: `deploy with ${secret}`, status: "pending" }]), 1);
    expect(JSON.stringify(tracker.rows())).not.toContain(secret);
    tracker.ingest(todos("a", [{ content: "x".repeat(500), status: "pending" }]), 2);
    expect(tracker.rows()[0].items[0].text.length).toBe(QUEST_TEXT_CHARS);
    const many = Array.from({ length: MAX_QUEST_ITEMS + 30 }, (_, index) => ({
      content: `t${index}`,
      status: "pending",
    }));
    tracker.ingest(todos("a", many), 3);
    expect(tracker.rows()[0].items).toHaveLength(MAX_QUEST_ITEMS);
    for (let index = 0; index < MAX_QUEST_SESSIONS + 5; index++)
      tracker.ingest(todos(`s${index}`, [{ content: "x", status: "pending" }]), 10 + index);
    expect(tracker.rows()).toHaveLength(MAX_QUEST_SESSIONS);
    expect(tracker.size()).toBe(MAX_QUEST_SESSIONS);
  });

  it("keeps a session's board through the SessionEnd grace, then drops it", () => {
    const tracker = new QuestBoardTracker();
    tracker.ingest(todos("a", [{ content: "x", status: "pending" }]), 0);
    tracker.dropSession("a", 1000);
    expect(tracker.sweep(1000 + QUEST_END_GRACE_MS)).toBe(false);
    expect(tracker.rows()).toHaveLength(1);
    expect(tracker.sweep(1000 + QUEST_END_GRACE_MS + 1)).toBe(true);
    expect(tracker.rows()).toEqual([]);
  });

  it("drops idle boards and revives a board that gets new todos after SessionEnd", () => {
    const tracker = new QuestBoardTracker();
    tracker.ingest(todos("a", [{ content: "x", status: "pending" }]), 0);
    expect(tracker.sweep(QUEST_IDLE_TTL_MS + 1)).toBe(true);
    tracker.ingest(todos("b", [{ content: "x", status: "pending" }]), 0);
    tracker.dropSession("b", 10);
    tracker.ingest(todos("b", [{ content: "y", status: "pending" }]), 20);
    expect(tracker.sweep(20 + QUEST_END_GRACE_MS + 5)).toBe(false);
    expect(tracker.rows()).toHaveLength(1);
  });
});

const row = (sid: string, items: [string, "pending" | "in_progress" | "completed"][]): QuestMsgRow => ({
  sid,
  project: "p",
  updatedAt: 0,
  items: items.map(([text, status]) => ({ text, status })),
});

describe("BoardNotes", () => {
  it("pins a note per open quest and none for completed ones", () => {
    const board = new BoardNotes();
    board.update(
      [
        row("a", [
          ["one", "pending"],
          ["two", "in_progress"],
          ["old", "completed"],
        ]),
      ],
      0,
    );
    expect(board.visible(0)).toHaveLength(2);
    expect(board.overflow).toBe(0);
  });

  it("update() reports how many open notes got stamped", () => {
    const board = new BoardNotes();
    expect(
      board.update(
        [
          row("a", [
            ["one", "pending"],
            ["two", "pending"],
          ]),
        ],
        0,
      ),
    ).toBe(0);
    expect(
      board.update(
        [
          row("a", [
            ["one", "completed"],
            ["two", "pending"],
          ]),
        ],
        1,
      ),
    ).toBe(1);
    expect(
      board.update(
        [
          row("a", [
            ["one", "completed"],
            ["two", "pending"],
          ]),
        ],
        2,
      ),
    ).toBe(0);
    const still = new BoardNotes();
    still.update([row("a", [["one", "pending"]])], 0, true);
    expect(still.update([row("a", [["one", "completed"]])], 1, true)).toBe(1);
  });

  it("caps visible notes and counts the overflow", () => {
    const board = new BoardNotes();
    const items = Array.from({ length: BOARD_SLOTS + 5 }, (_, index): [string, "pending"] => [`t${index}`, "pending"]);
    board.update([row("a", items)], 0);
    expect(board.visible(0)).toHaveLength(BOARD_SLOTS);
    expect(board.overflow).toBe(5);
  });

  it("shows in-progress quests first when the board is full", () => {
    const board = new BoardNotes();
    const items = Array.from({ length: BOARD_SLOTS + 2 }, (_, index): [string, "pending" | "in_progress"] => [
      `t${index}`,
      index === BOARD_SLOTS + 1 ? "in_progress" : "pending",
    ]);
    board.update([row("a", items)], 0);
    expect(board.visible(0).some((note) => note.key.includes(`t${BOARD_SLOTS + 1}|`))).toBe(true);
  });

  it("stamps a completed note, then drops it", () => {
    const board = new BoardNotes();
    board.update([row("a", [["one", "in_progress"]])], 0);
    const slot = board.visible(0)[0].slot;
    board.update([row("a", [["one", "completed"]])], 1);
    const stamped = board.visible(1)[0];
    expect(stamped.stampAt).toBe(1);
    expect(stamped.slot).toBe(slot);
    expect(board.visible(1 + STAMP_S)[0].fallAt).toBe(1 + STAMP_S);
    expect(board.visible(1 + STAMP_S + FALL_S + 0.01)).toHaveLength(0);
  });

  it("removes a completed note at once with reduced motion", () => {
    const board = new BoardNotes();
    board.update([row("a", [["one", "in_progress"]])], 0);
    board.update([row("a", [["one", "completed"]])], 1, true);
    expect(board.visible(1)).toHaveLength(0);
  });

  it("keeps slots stable and tells duplicate texts apart", () => {
    const board = new BoardNotes();
    board.update(
      [
        row("a", [
          ["same", "pending"],
          ["same", "pending"],
          ["other", "pending"],
        ]),
      ],
      0,
    );
    const before = board.visible(0).map((note) => [note.key, note.slot]);
    expect(new Set(before.map(([key]) => key)).size).toBe(3);
    board.update(
      [
        row("a", [
          ["same", "pending"],
          ["same", "pending"],
          ["other", "in_progress"],
        ]),
      ],
      1,
    );
    expect(board.visible(1).map((note) => [note.key, note.slot])).toEqual(before);
  });

  it("clear empties the board", () => {
    const board = new BoardNotes();
    board.update([row("a", [["one", "pending"]])], 0);
    board.clear();
    expect(board.visible(0)).toEqual([]);
    expect(board.overflow).toBe(0);
  });
});

describe("sanitizeQuests", () => {
  it("drops malformed rows and items, clips text", () => {
    const rows = sanitizeQuests([
      null,
      { sid: "", items: [] },
      { sid: "a", items: [{ text: "ok", status: "pending" }, { text: "bad", status: "nope" }, { status: "pending" }] },
      { sid: "b", project: "p", updatedAt: 5, items: [{ text: "y".repeat(500), status: "completed", active: "z" }] },
    ]);
    expect(rows).toHaveLength(2);
    expect(rows[0].items).toEqual([{ text: "ok", status: "pending" }]);
    expect(rows[1].items[0].text.length).toBeLessThan(500);
    expect(sanitizeQuests("nope")).toEqual([]);
  });
});
