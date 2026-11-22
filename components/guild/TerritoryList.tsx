import type { ConflictRow } from "@/lib/office/engine";
import { SectionHeading } from "./Section";
import type { OfficeRef } from "./types";

function ConflictItem({ c, onSelect, onDismiss }: { c: ConflictRow; onSelect: (id: string) => void; onDismiss: () => void }) {
  const clash = c.level === "clash";
  return (
    <li className={`conflict ${clash ? "clash" : "overlap"}`}>
      <div className="chead">
        <span className="cfile" title={c.file}>{c.file}</span>
        <button type="button" className="cdismiss" onClick={onDismiss} aria-label={`ปิดการแจ้งเตือน ${c.file}`} title="ปิดการแจ้งเตือนนี้">✕</button>
      </div>
      <div className="cwho">
        {c.names.map((n, i) => (
          <span key={c.sids[i]}>
            {i > 0 && <span className="vs"> vs </span>}
            <button type="button" className="cname" onClick={() => onSelect(c.sids[i])}>{n}</button>
          </span>
        ))}
      </div>
      <span className={`clevel ${clash ? "clash" : "overlap"}`}>{clash ? "🔴 ชนกัน!" : "🟡 แตะไฟล์เดียวกัน"}</span>
    </li>
  );
}

export function TerritoryList({ conflicts, hidden, onToggle, officeRef }: { conflicts: ConflictRow[]; hidden: boolean; onToggle: () => void; officeRef: OfficeRef }) {
  return (
    <>
      <SectionHeading id="terr" hidden={hidden} onToggle={onToggle} count={conflicts.length}>ดินแดน</SectionHeading>
      <div className="terrsec" id="sec-terr" hidden={hidden}>
        <ul className="conflicts">
          {conflicts.length === 0 && <li className="empty">ยังไม่มีศึก</li>}
          {conflicts.map((c) => <ConflictItem key={c.key} c={c} onSelect={(id) => officeRef.current?.select(id)} onDismiss={() => officeRef.current?.dismissConflict(c.key)} />)}
        </ul>
        <p className="terrnote">ตรวจเฉพาะ Edit/Write — คำสั่ง Bash ที่เขียนไฟล์ยังไม่นับ · เตือนได้ แต่ขวางไม่ได้</p>
      </div>
    </>
  );
}
