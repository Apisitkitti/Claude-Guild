import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { KIND_RECEIPT, receiptSummary, type ReceiptMsgRow } from "@/lib/office/engine";

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

const row = (sessionId: string, extra: Partial<ReceiptMsgRow> = {}): ReceiptMsgRow => ({
  id: `r-${sessionId}-${Math.random()}`,
  sid: sessionId,
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
    const office = newOffice();
    const sessionId = sid();
    seat(office, sessionId, { cwd: "/w/alpha" });
    office.setReceipts([
      row(sessionId, { id: "old", closedAt: 1000 }),
      row(sessionId, { id: "new", closedAt: 2000 }),
      { nope: 1 } as unknown as ReceiptMsgRow,
      null as unknown as ReceiptMsgRow,
      row(sessionId, { id: "badverdict", verdict: "bogus" as ReceiptMsgRow["verdict"] }),
      row(sessionId, { id: "", closedAt: 5 }),
      row("", { id: "nosid" }),
      row(sessionId, { id: "nan", closedAt: NaN }),
      row(sessionId, { id: "neg", files: -4, commits: 1e9, tasks: "x" as unknown as number, closedAt: 1500 }),
    ]);
    const rows = office.getView().receipts!;
    expect(rows.map((entry) => entry.id)).toEqual(["new", "neg", "old"]);
    expect(rows[1]).toMatchObject({ files: 0, commits: 99999, tasks: 0 });
    office.setReceipts(null);
    expect(office.getView().receipts).toEqual([]);
    office.setReceipts("junk" as unknown as ReceiptMsgRow[]);
    expect(office.getView().receipts).toEqual([]);
  });

  it("caps rows at 30", () => {
    const office = newOffice();
    const sessionId = sid();
    seat(office, sessionId);
    office.setReceipts(Array.from({ length: 50 }, (_, i) => row(sessionId, { id: "i" + i, closedAt: i })));
    expect(office.getView().receipts).toHaveLength(30);
  });

  it("joins with the adventurer: tag/project/live; unknown sessions stay listed but not live", () => {
    const office = newOffice();
    const sessionId = sid();
    seat(office, sessionId, { cwd: "/w/alpha" });
    office.setReceipts([row(sessionId), row("gone-session", { project: "beta" })]);
    const [r1, r2] = office.getView().receipts!;
    expect(r1).toMatchObject({ live: true, project: "alpha", tag: "#" + sessionId.slice(0, 3) });
    expect(r2).toMatchObject({ live: false, project: "beta", tag: "#gon" });
  });

  it("a fresh receipt with outcomes pops a 📜 bubble and a quest-log line, once; first load (snapshot) stays quiet", () => {
    const office = newOffice();
    const sessionId = sid();
    seat(office, sessionId, { cwd: "/w/alpha" });
    tick(office, 2);
    const old = row(sessionId, { id: "first" });
    office.setReceipts([old]); // first call: seen, no fanfare
    expect(emp(office, sessionId).tempBubble).toBeNull();
    expect(office.getView().log.some((entry) => entry.kind === KIND_RECEIPT)).toBe(false);
    const fresh = row(sessionId, { id: "fresh" });
    office.setReceipts([fresh, old]);
    expect(emp(office, sessionId).tempBubble?.e).toBe("📜");
    const entry = office.getView().log.find((x) => x.kind === KIND_RECEIPT)!;
    expect(entry.detail).toBe("ได้งาน: file 3 · ฟื้น 1 · commit 1");
    office.setReceipts([fresh, old]); // same ids again: nothing new
    expect(office.getView().log.filter((x) => x.kind === KIND_RECEIPT)).toHaveLength(1);
  });

  it("no bubble when nothing came out, or the receipt is not fresh, or the adventurer is gone", () => {
    const office = newOffice();
    const sessionId = sid();
    seat(office, sessionId);
    office.setReceipts([]);
    office.setReceipts([row(sessionId, { id: "n", files: 0, recovered: 0, commits: 0, verdict: "none" })]);
    expect(emp(office, sessionId).tempBubble?.e).not.toBe("📜");
    office.setReceipts([row(sessionId, { id: "stale", closedAt: Date.now() - 5 * 60_000 })]);
    expect(emp(office, sessionId).tempBubble?.e).not.toBe("📜");
    office.setReceipts([row("ghost", { id: "g" })]);
    expect(office.getView().log.filter((x) => x.kind === KIND_RECEIPT)).toHaveLength(0);
  });

  it("loads from a snapshot", () => {
    const office = newOffice();
    const sessionId = sid();
    office.loadSnapshot({ sessions: [{ session_id: sessionId, cwd: "/w/x" }], receipts: [row(sessionId)] });
    expect(office.getView().receipts).toHaveLength(1);
    expect(emp(office, sessionId).tempBubble).toBeNull();
  });

  it("keeps staleRed through validation", () => {
    const office = newOffice();
    const sessionId = sid();
    seat(office, sessionId);
    office.setReceipts([
      row(sessionId, { id: "s", staleRed: true }),
      row(sessionId, { id: "t", staleRed: "yes" as unknown as boolean }),
    ]);
    expect(office.getView().receipts!.map((entry) => entry.staleRed)).toEqual([true, undefined]);
  });

  it("receiptSummary lists only non-zero counts", () => {
    expect(receiptSummary({ files: 3, recovered: 1, commits: 1, amends: 0, tasks: 2 })).toBe(
      "file 3 · ฟื้น 1 · commit 1 · งาน 2",
    );
    expect(receiptSummary({ files: 0, recovered: 0, commits: 0, amends: 0, tasks: 0 })).toBe("");
  });
});
