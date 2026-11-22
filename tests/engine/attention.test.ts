import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { nextAttentionId, type AttentionMsgRow } from "@/lib/office/engine";

import { newOffice, seat, sid, stubStorage } from "./helpers";

beforeEach(() => {
  vi.useFakeTimers();
  stubStorage();
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const row = (
  sessionId: string,
  kind: AttentionMsgRow["kind"] = "loop",
  extra: Partial<AttentionMsgRow> = {},
): AttentionMsgRow => ({ key: `${sessionId}|${kind}|x`, sid: sessionId, kind, since: 1, ...extra });

describe("attention (engine)", () => {
  it("joins rows with known adventurers and drops unknown / malformed ones", () => {
    const office = newOffice();
    const sessionId = sid();
    seat(office, sessionId, { cwd: "/w/alpha" });
    office.setAttention([
      row(sessionId),
      row("ghost"),
      { nope: 1 } as unknown as AttentionMsgRow,
      row(sessionId, "bogus" as AttentionMsgRow["kind"]),
    ]);
    const rows = office.getView().attention!;
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ sid: sessionId, project: "alpha", kind: "loop" });
    office.setAttention(null);
    expect(office.getView().attention).toEqual([]);
  });
  it("loop rows mark the session berserk; dismissal hides row + berserk until the row disappears", () => {
    const office = newOffice();
    const sessionId = sid();
    seat(office, sessionId);
    office.setAttention([row(sessionId, "loop", { tool: "Bash", count: 3 })]);
    expect(office.loopIds.has(sessionId)).toBe(true);
    expect(office.bellRinging()).toBe(true);
    office.dismissAttention(`${sessionId}|loop|x`);
    expect(office.getView().attention).toEqual([]);
    expect(office.loopIds.has(sessionId)).toBe(false);
    expect(office.bellRinging()).toBe(false);
    office.setAttention([row(sessionId, "loop")]); // same fingerprint still looping: stays dismissed
    expect(office.getView().attention).toEqual([]);
    office.setAttention([]); // loop ended
    office.setAttention([row(sessionId, "loop")]); // loops again
    expect(office.getView().attention).toHaveLength(1);
  });
  it("bell only rings for permission / loop / asked", () => {
    const office = newOffice();
    const sessionId = sid();
    seat(office, sessionId);
    office.setAttention([row(sessionId, "context"), row(sessionId, "done")]);
    expect(office.bellRinging()).toBe(false);
    office.setAttention([row(sessionId, "asked")]);
    expect(office.bellRinging()).toBe(true);
  });
  it("loads the queue from a snapshot", () => {
    const office = newOffice();
    const sessionId = sid();
    office.loadSnapshot({ sessions: [{ session_id: sessionId, cwd: "/w/x" }], attention: [row(sessionId, "asked")] });
    expect(office.getView().attention).toHaveLength(1);
  });
  describe("setAttention validation of the data fields", () => {
    const view = (rows: unknown[]) => {
      const office = newOffice();
      const sessionId = sid();
      seat(office, sessionId);
      office.setAttention(
        rows.map((override) => ({ ...row(sessionId, "loop"), ...(override as object) })) as AttentionMsgRow[],
      );
      return office.getView().attention!;
    };
    it("caps string lengths", () => {
      const [first] = view([
        { tool: "t".repeat(500), target: "x".repeat(500), error: "e".repeat(500), tail: "a".repeat(500) },
      ]);
      expect(first.tool).toHaveLength(80);
      expect(first.target).toHaveLength(120);
      expect(first.error).toHaveLength(200);
      expect(first.tail).toHaveLength(200);
    });
    it("drops non-string or empty strings", () => {
      const [first] = view([{ tool: 5, target: { a: 1 }, error: null, tail: "" }]);
      for (const k of ["tool", "target", "error", "tail"]) expect(first).not.toHaveProperty(k);
    });
    it("loop count is floored, never negative, and 0 when missing or not a number", () => {
      expect(view([{ count: 4.9 }])[0].count).toBe(4);
      expect(view([{ count: -3 }])[0].count).toBe(0);
      expect(view([{ count: "7" }])[0].count).toBe(0);
      expect(view([{ count: Infinity }])[0].count).toBe(0);
      expect(view([{}])[0].count).toBe(0);
      expect(view([{ kind: "done", count: 4 }])[0]).not.toHaveProperty("count");
    });
    it("context pct is clamped to 0..100 and only kept on context rows", () => {
      expect(view([{ kind: "context", pct: 250 }])[0].pct).toBe(100);
      expect(view([{ kind: "context", pct: -5 }])[0].pct).toBe(0);
      expect(view([{ kind: "context", pct: 92.6 }])[0].pct).toBe(92);
      expect(view([{ kind: "loop", pct: 50 }])[0]).not.toHaveProperty("pct");
    });
    it("stale is kept only when exactly true", () => {
      expect(view([{ kind: "permission", stale: true }])[0].stale).toBe(true);
      for (const value of [false, 1, "true", undefined])
        expect(view([{ kind: "permission", stale: value }])[0]).not.toHaveProperty("stale");
    });
  });
  it("nextAttentionId cycles through distinct sessions and wraps", () => {
    const rows = [{ sid: "a" }, { sid: "b" }, { sid: "a" }, { sid: "c" }];
    expect(nextAttentionId([], null)).toBeNull();
    expect(nextAttentionId(rows, null)).toBe("a");
    expect(nextAttentionId(rows, "a")).toBe("b");
    expect(nextAttentionId(rows, "c")).toBe("a");
    expect(nextAttentionId(rows, "zzz")).toBe("a");
  });
});
