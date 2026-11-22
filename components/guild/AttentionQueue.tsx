import { useState } from "react";
import type { AttentionRow } from "@/lib/office/engine";
import { ageText } from "./format";
import { SectionHeading } from "./Section";
import type { OfficeRef } from "./types";

const ATTN_ICON: Record<AttentionRow["kind"], string> = { permission: "❗", loop: "🔁", asked: "💬", context: "🗜️", done: "✅" };

function AttentionItem({ r, now, selected, onSelect, onDismiss }: { r: AttentionRow; now: number; selected: boolean; onSelect: () => void; onDismiss: () => void }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    if (!r.copy) return;
    try {
      navigator.clipboard.writeText(r.copy).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); }, () => {});
    } catch {}
  };
  return (
    <li className={`attn ${r.kind}${selected ? " hl" : ""}`}>
      <button type="button" className="asel" onClick={onSelect} title={r.detail ? `${r.text} — ${r.detail}` : r.text}>
        <span className="aico" aria-hidden="true">{ATTN_ICON[r.kind]}</span>
        <span className="atxt">
          <b>{r.tag} <span className="aproj">{r.project}</span></b>
          <span className="areason">{r.text}</span>
          {r.detail && <span className="adetail">{r.detail}</span>}
        </span>
        <span className="aage">{ageText(r.since, now)}</span>
      </button>
      <div className="aact">
        {r.copy && <button type="button" className="acopy" onClick={copy} title="คัดลอกข้อความไปแปะให้ Claude session นี้">{copied ? "✓ คัดลอกแล้ว" : "📋 Copy"}</button>}
        <button type="button" className="adismiss" onClick={onDismiss} aria-label={`ปิดแถว ${r.tag}`} title="ปิดแถวนี้">✕</button>
      </div>
    </li>
  );
}

export function AttentionQueue({ rows, now, selectedId, hidden, onToggle, onJump, officeRef }: {
  rows: AttentionRow[]; now: number; selectedId: string | null; hidden: boolean; onToggle: () => void; onJump: (sid: string) => void; officeRef: OfficeRef;
}) {
  return (
    <>
      <SectionHeading id="attn" hidden={hidden} onToggle={onToggle} count={rows.length}>🔔 คิวของคุณ</SectionHeading>
      <div className="attnsec" id="sec-attn" hidden={hidden}>
        <ul className="attns" aria-live="polite">
          {rows.length === 0 && <li className="empty">ไม่มีใครต้องการคุณตอนนี้</li>}
          {rows.map((r) => (
            <AttentionItem
              key={r.key}
              r={r}
              now={now || r.since}
              selected={r.sid === selectedId}
              onSelect={() => onJump(r.sid)}
              onDismiss={() => officeRef.current?.dismissAttention(r.key)}
            />
          ))}
        </ul>
        <p className="terrnote">กด N เพื่อไปคนถัดไปในคิว · “น่าจะรอคำตอบคุณ” เป็นการเดาจากท้ายข้อความ · เตือนได้ แต่ขวางไม่ได้</p>
      </div>
    </>
  );
}
