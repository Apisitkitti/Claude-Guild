import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { receiptSummary, type ReceiptMsgRow } from "@/lib/office/engine";

import { emp, newOffice, seat, sid, stubStorage, tick } from "./helpers";

beforeEach(() => {
  vi.useFakeTimers();
  stubStorage();
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const row = (s: string, extra: Partial<ReceiptMsgRow> = {}): ReceiptMsgRow => ({
  id: `r-${s}-${Math.random()}`,
  sid: s,
  project: "alpha",
  closedAt: Date.now(),
  files: 3,
  recovered: 1,
  commits: 1,
  amends: 0,
  tasks: 0,
  squire: 0,
  calls: 9,
  verdict: "done",
  ...extra,
});

describe("receipts (engine)", () => {
  it("validates rows: bad shapes dropped, counts clamped, newest first", () => {
    const o = newOffice();
    const a = sid();
    seat(o, a, { cwd: "/w/alpha" });
    o.setReceipts([
      row(a, { id: "old", closedAt: 1000 }),
      row(a, { id: "new", closedAt: 2000 }),
      { nope: 1 } as unknown as ReceiptMsgRow,
      null as unknown as ReceiptMsgRow,
      row(a, { id: "badverdict", verdict: "bogus" as ReceiptMsgRow["verdict"] }),
      row(a, { id: "", closedAt: 5 }),
      row("", { id: "nosid" }),
      row(a, { id: "nan", closedAt: NaN }),
      row(a, { id: "neg", files: -4, commits: 1e9, tasks: "x" as unknown as number, closedAt: 1500 }),
    ]);
    const rows = o.getView().receipts!;
    expect(rows.map((r) => r.id)).toEqual(["new", "neg", "old"]);
    expect(rows[1]).toMatchObject({ files: 0, commits: 99999, tasks: 0 });
    o.setReceipts(null);
    expect(o.getView().receipts).toEqual([]);
    o.setReceipts("junk" as unknown as ReceiptMsgRow[]);
    expect(o.getView().receipts).toEqual([]);
  });

  it("caps rows at 30", () => {
    const o = newOffice();
    const a = sid();
    seat(o, a);
    o.setReceipts(Array.from({ length: 50 }, (_, i) => row(a, { id: "i" + i, closedAt: i })));
    expect(o.getView().receipts).toHaveLength(30);
  });

  it("joins with the adventurer: tag/project/live; unknown sessions stay listed but not live", () => {
    const o = newOffice();
    const a = sid();
    seat(o, a, { cwd: "/w/alpha" });
    o.setReceipts([row(a), row("gone-session", { project: "beta" })]);
    const [r1, r2] = o.getView().receipts!;
    expect(r1).toMatchObject({ live: true, project: "alpha", tag: "#" + a.slice(0, 3) });
    expect(r2).toMatchObject({ live: false, project: "beta", tag: "#gon" });
  });

  it("a fresh receipt with outcomes pops a 📜 bubble and a quest-log line, once; first load (snapshot) stays quiet", () => {
    const o = newOffice();
    const a = sid();
    seat(o, a, { cwd: "/w/alpha" });
    tick(o, 2);
    const old = row(a, { id: "first" });
    o.setReceipts([old]); // first call: seen, no fanfare
    expect(emp(o, a).tempBubble).toBeNull();
    expect(o.getView().log.some((l) => l.kind === "ใบเสร็จ")).toBe(false);
    const fresh = row(a, { id: "fresh" });
    o.setReceipts([fresh, old]);
    expect(emp(o, a).tempBubble?.e).toBe("📜");
    const l = o.getView().log.find((x) => x.kind === "ใบเสร็จ")!;
    expect(l.detail).toBe("ได้งาน: ไฟล์ 3 · ฟื้น 1 · commit 1");
    o.setReceipts([fresh, old]); // same ids again: nothing new
    expect(o.getView().log.filter((x) => x.kind === "ใบเสร็จ")).toHaveLength(1);
  });

  it("no bubble when nothing came out, or the receipt is not fresh, or the adventurer is gone", () => {
    const o = newOffice();
    const a = sid();
    seat(o, a);
    o.setReceipts([]);
    o.setReceipts([row(a, { id: "n", files: 0, recovered: 0, commits: 0, verdict: "none" })]);
    expect(emp(o, a).tempBubble?.e).not.toBe("📜");
    o.setReceipts([row(a, { id: "stale", closedAt: Date.now() - 5 * 60_000 })]);
    expect(emp(o, a).tempBubble?.e).not.toBe("📜");
    o.setReceipts([row("ghost", { id: "g" })]);
    expect(o.getView().log.filter((x) => x.kind === "ใบเสร็จ")).toHaveLength(0);
  });

  it("loads from a snapshot", () => {
    const o = newOffice();
    const a = sid();
    o.loadSnapshot({ sessions: [{ session_id: a, cwd: "/w/x" }], receipts: [row(a)] });
    expect(o.getView().receipts).toHaveLength(1);
    expect(emp(o, a).tempBubble).toBeNull();
  });

  it("keeps staleRed through validation", () => {
    const o = newOffice();
    const a = sid();
    seat(o, a);
    o.setReceipts([row(a, { id: "s", staleRed: true }), row(a, { id: "t", staleRed: "yes" as unknown as boolean })]);
    expect(o.getView().receipts!.map((r) => r.staleRed)).toEqual([true, undefined]);
  });

  it("receiptSummary lists only non-zero counts", () => {
    expect(receiptSummary({ files: 3, recovered: 1, commits: 1, amends: 0, tasks: 2 })).toBe(
      "ไฟล์ 3 · ฟื้น 1 · commit 1 · งาน 2",
    );
    expect(receiptSummary({ files: 0, recovered: 0, commits: 0, amends: 0, tasks: 0 })).toBe("");
  });
});
