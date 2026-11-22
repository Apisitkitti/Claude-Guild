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
  s: string,
  kind: AttentionMsgRow["kind"] = "loop",
  extra: Partial<AttentionMsgRow> = {},
): AttentionMsgRow => ({ key: `${s}|${kind}|x`, sid: s, kind, since: 1, ...extra });

describe("attention (engine)", () => {
  it("joins rows with known adventurers and drops unknown / malformed ones", () => {
    const o = newOffice();
    const a = sid();
    seat(o, a, { cwd: "/w/alpha" });
    o.setAttention([
      row(a),
      row("ghost"),
      { nope: 1 } as unknown as AttentionMsgRow,
      row(a, "bogus" as AttentionMsgRow["kind"]),
    ]);
    const rows = o.getView().attention!;
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ sid: a, project: "alpha", kind: "loop" });
    o.setAttention(null);
    expect(o.getView().attention).toEqual([]);
  });
  it("loop rows mark the session berserk; dismissal hides row + berserk until the row disappears", () => {
    const o = newOffice();
    const a = sid();
    seat(o, a);
    o.setAttention([row(a, "loop", { tool: "Bash", count: 3 })]);
    expect(o.loopIds.has(a)).toBe(true);
    expect(o.bellRinging()).toBe(true);
    o.dismissAttention(`${a}|loop|x`);
    expect(o.getView().attention).toEqual([]);
    expect(o.loopIds.has(a)).toBe(false);
    expect(o.bellRinging()).toBe(false);
    o.setAttention([row(a, "loop")]); // same fingerprint still looping: stays dismissed
    expect(o.getView().attention).toEqual([]);
    o.setAttention([]); // loop ended
    o.setAttention([row(a, "loop")]); // loops again
    expect(o.getView().attention).toHaveLength(1);
  });
  it("bell only rings for permission / loop / asked", () => {
    const o = newOffice();
    const a = sid();
    seat(o, a);
    o.setAttention([row(a, "context"), row(a, "done")]);
    expect(o.bellRinging()).toBe(false);
    o.setAttention([row(a, "asked")]);
    expect(o.bellRinging()).toBe(true);
  });
  it("loads the queue from a snapshot", () => {
    const o = newOffice();
    const a = sid();
    o.loadSnapshot({ sessions: [{ session_id: a, cwd: "/w/x" }], attention: [row(a, "asked")] });
    expect(o.getView().attention).toHaveLength(1);
  });
  describe("setAttention validation of the data fields", () => {
    const view = (rows: unknown[]) => {
      const o = newOffice();
      const a = sid();
      seat(o, a);
      o.setAttention(rows.map((r) => ({ ...row(a, "loop"), ...(r as object) })) as AttentionMsgRow[]);
      return o.getView().attention!;
    };
    it("caps string lengths", () => {
      const [r] = view([
        { tool: "t".repeat(500), target: "x".repeat(500), error: "e".repeat(500), tail: "a".repeat(500) },
      ]);
      expect(r.tool).toHaveLength(80);
      expect(r.target).toHaveLength(120);
      expect(r.error).toHaveLength(200);
      expect(r.tail).toHaveLength(200);
    });
    it("drops non-string or empty strings", () => {
      const [r] = view([{ tool: 5, target: { a: 1 }, error: null, tail: "" }]);
      for (const k of ["tool", "target", "error", "tail"]) expect(r).not.toHaveProperty(k);
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
      for (const v of [false, 1, "true", undefined])
        expect(view([{ kind: "permission", stale: v }])[0]).not.toHaveProperty("stale");
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
