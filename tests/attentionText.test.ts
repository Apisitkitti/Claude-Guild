import { describe, expect, it } from "vitest";

import { ageText, agoText, kindLabel } from "@/components/guild/format";
import { attentionCopy, attentionDetail, attentionText } from "@/lib/office/attentionText";
import { KIND_CLASH, KIND_RECEIPT } from "@/lib/office/engine";
import { m } from "@/paraglide/messages";

describe("attention wording (th, en)", () => {
  const loop = { kind: "loop", tool: "Bash", target: "npm test", count: 4, error: "boom" } as const;

  it("words every kind in Thai, keeping the original phrases", () => {
    expect(attentionText({ kind: "permission" })).toBe("รออนุญาตจากคุณ (permission)");
    expect(attentionText({ kind: "permission", stale: true })).toBe("อาจอนุญาตแล้ว — ตรวจดู");
    expect(attentionText(loop)).toBe("วน loop: Bash npm test ล้มซ้ำ 4 ครั้ง");
    expect(attentionText({ kind: "asked" })).toBe("น่าจะรอคำตอบคุณ (เดา)");
    expect(attentionText({ kind: "context", pct: 92 })).toBe("Context ใกล้เต็ม 92%");
    expect(attentionText({ kind: "done" })).toBe("เสร็จแล้ว รอ review");
  });
  it("builds detail and copy text from the data", () => {
    expect(attentionDetail(loop)).toBe("boom");
    expect(attentionDetail({ kind: "asked", tail: "…ไหม?" })).toBe("…ไหม?");
    expect(attentionDetail({ kind: "done" })).toBeUndefined();
    expect(attentionCopy(loop)).toBe(
      "คุณ run `npm test` แล้วล้มด้วย error เดิม 4 ครั้ง: boom. หยุดลองซ้ำ อธิบายสาเหตุก่อนแล้วเปลี่ยนวิธี",
    );
    expect(attentionCopy({ ...loop, error: undefined })).toBe(
      "คุณ run `npm test` แล้วล้มด้วย error เดิม 4 ครั้ง. หยุดลองซ้ำ อธิบายสาเหตุก่อนแล้วเปลี่ยนวิธี",
    );
    expect(attentionCopy({ kind: "done" })).toBeUndefined();
  });
  it("falls back to the bare tool when a loop has no target", () => {
    expect(attentionText({ kind: "loop", tool: "Read", count: 3 })).toBe("วน loop: Read ล้มซ้ำ 3 ครั้ง");
  });
  it("English uses plural forms", () => {
    expect(m.queue_loop({ what: "Bash", count: 1 }, { locale: "en" })).toBe("Looping: Bash failed 1 time");
    expect(m.queue_loop({ what: "Bash", count: 4 }, { locale: "en" })).toBe("Looping: Bash failed 4 times");
    expect(m.receipt_calls({ calls: 1 }, { locale: "en" })).toBe("1 tool call");
    expect(m.receipt_calls({ calls: 5 }, { locale: "en" })).toBe("5 tool calls");
    expect(m.receipt_calls({ calls: 1 })).toBe("1 tool calls");
  });
});

describe("time phrases", () => {
  const MIN = 60_000;
  it("keeps the Thai wording", () => {
    expect(ageText(0, 5_000)).toBe("รอ 5 วินาที");
    expect(ageText(0, 3 * MIN)).toBe("รอ 3 นาที");
    expect(ageText(0, 65 * MIN)).toBe("รอ 1 ชม. 5 นาที");
    expect(agoText(0, 5_000)).toBe("เมื่อ 5 วินาทีที่แล้ว");
    expect(agoText(0, 3 * MIN)).toBe("เมื่อ 3 นาทีที่แล้ว");
    expect(agoText(0, 65 * MIN)).toBe("เมื่อ 1 ชม. 5 นาทีที่แล้ว");
  });
  it("kindLabel words the two guild-made kinds only", () => {
    expect(kindLabel(KIND_RECEIPT)).toBe("ใบเสร็จ");
    expect(kindLabel(KIND_CLASH)).toBe("ชนกัน");
    expect(kindLabel("Bash")).toBe("Bash");
    expect(kindLabel("Receipt")).toBe("Receipt"); // a real tool named like a guild kind is not reworded
  });
});
