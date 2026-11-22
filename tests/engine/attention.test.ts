import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { nextAttentionId, type AttentionMsgRow } from "@/lib/office/engine";
import { newOffice, seat, sid, stubStorage } from "./helpers";

beforeEach(() => { vi.useFakeTimers(); stubStorage(); });
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

const row = (s: string, kind: AttentionMsgRow["kind"] = "loop", extra: Partial<AttentionMsgRow> = {}): AttentionMsgRow =>
  ({ key: `${s}|${kind}|x`, sid: s, kind, since: 1, text: "t", ...extra });

describe("attention (engine)", () => {
  it("joins rows with known adventurers and drops unknown / malformed ones", () => {
    const o = newOffice(); const a = sid();
    seat(o, a, { cwd: "/w/alpha" });
    o.setAttention([row(a), row("ghost"), { nope: 1 } as unknown as AttentionMsgRow, row(a, "bogus" as AttentionMsgRow["kind"])]);
    const rows = o.getView().attention!;
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ sid: a, project: "alpha", kind: "loop" });
    o.setAttention(null);
    expect(o.getView().attention).toEqual([]);
  });
  it("loop rows mark the session berserk; dismissal hides row + berserk until the row disappears", () => {
    const o = newOffice(); const a = sid();
    seat(o, a);
    o.setAttention([row(a, "loop", { copy: "c" })]);
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
    const o = newOffice(); const a = sid();
    seat(o, a);
    o.setAttention([row(a, "context"), row(a, "done")]);
    expect(o.bellRinging()).toBe(false);
    o.setAttention([row(a, "asked")]);
    expect(o.bellRinging()).toBe(true);
  });
  it("loads the queue from a snapshot", () => {
    const o = newOffice(); const a = sid();
    o.loadSnapshot({ sessions: [{ session_id: a, cwd: "/w/x" }], attention: [row(a, "asked")] });
    expect(o.getView().attention).toHaveLength(1);
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
