import { RECEIPT_VERDICT_TEXT, receiptSummary, type ReceiptRow } from "@/lib/office/engine";

import { agoText } from "./format";
import { useReceiptDismissals } from "./hooks/useReceiptDismissals";
import { SectionHeading } from "./Section";

function ReceiptItem({
  r,
  now,
  selected,
  onSelect,
  onDismiss,
}: {
  r: ReceiptRow;
  now: number;
  selected: boolean;
  onSelect: () => void;
  onDismiss: () => void;
}) {
  const chips: [string, string, number, string][] = [
    ["📝", "ไฟล์", r.files, "แก้ไฟล์สำเร็จ (ไม่ซ้ำ)"],
    ["✅", "ฟื้น", r.recovered, "test แดง → เขียว"],
    ["📦", "commit", r.commits, "git commit สำเร็จ"],
    ["↩", "amend", r.amends, "git commit --amend"],
    ["☑", "งาน", r.tasks, "งานที่ติ๊กเสร็จ"],
  ];
  const sum = receiptSummary(r);
  return (
    <li className={`rcpt ${r.verdict}${selected ? " hl" : ""}`}>
      <button
        type="button"
        className="rsel"
        onClick={onSelect}
        disabled={!r.live}
        title={`${sum || "ไม่มีผลลัพธ์"} · ${r.calls} tool calls · ตามที่ hook รายงาน${r.live ? "" : " · นักผจญภัยออกจากกิลด์แล้ว"}`}
      >
        <span className="rhead">
          <b>
            {r.tag} <span className="rproj">{r.project}</span>
          </b>
          <span className={`rverdict ${r.verdict}`}>{RECEIPT_VERDICT_TEXT[r.verdict]}</span>
        </span>
        <span className="rchips">
          {chips
            .filter((c) => c[2] > 0)
            .map((c) => (
              <span key={c[1]} className="rchip" title={c[3]}>
                <span aria-hidden="true">{c[0]}</span> {c[1]} {c[2]}
              </span>
            ))}
          {sum === "" && <span className="rnone">{r.calls} tool calls ไม่มีผลลัพธ์</span>}
        </span>
        <span className="rage">
          {agoText(r.closedAt, now)}
          {r.squire > 0 ? ` · squire ${r.squire}` : ""}
          {r.staleRed && r.verdict !== "red" ? " · ยังแดงจากรอบก่อน" : ""}
        </span>
      </button>
      <button
        type="button"
        className="rdismiss"
        onClick={onDismiss}
        aria-label={`ซ่อนใบเสร็จ ${r.tag}`}
        title="ซ่อนใบนี้"
      >
        ✕
      </button>
    </li>
  );
}

export function ReceiptList({
  rows,
  now,
  selectedId,
  hidden,
  onToggle,
  onJump,
}: {
  rows: ReceiptRow[];
  now: number;
  selectedId: string | null;
  hidden: boolean;
  onToggle: () => void;
  onJump: (sid: string) => void;
}) {
  const { visible, dismiss, clearAll } = useReceiptDismissals(rows);
  return (
    <>
      <SectionHeading id="rcpt" hidden={hidden} onToggle={onToggle} count={visible.length}>
        📜 ใบเสร็จ
      </SectionHeading>
      <div className="rcptsec" id="sec-rcpt" hidden={hidden}>
        {visible.length > 0 && (
          <div className="rcptbar">
            <button
              type="button"
              className="rclear"
              onClick={clearAll}
              title="ซ่อนใบเสร็จทั้งหมดตอนนี้ ใบใหม่จะยังขึ้นตามปกติ"
            >
              ล้างทั้งหมด
            </button>
          </div>
        )}
        <ul className="rcpts">
          {visible.length === 0 && <li className="empty">ยังไม่มีใบเสร็จ — ออกเมื่อ session จบรอบ (Stop)</li>}
          {visible.map((r) => (
            <ReceiptItem
              key={r.id}
              r={r}
              now={now || r.closedAt}
              selected={r.sid === selectedId}
              onSelect={() => onJump(r.sid)}
              onDismiss={() => dismiss(r.id)}
            />
          ))}
        </ul>
        <p className="terrnote">นับ “ผลลัพธ์” ไม่ใช่ความยุ่ง · ตามที่ hook รายงาน · เก็บ 2 ชม. ในหน่วยความจำเท่านั้น</p>
      </div>
    </>
  );
}
