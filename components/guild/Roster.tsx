import type { OfficeView } from "@/lib/office/engine";
import { SectionHeading } from "./Section";
import { RosterCard } from "./RosterCard";
import { useRosterFlash } from "./hooks/useRpgEffects";
import { usePersistedFlags } from "./hooks/usePersistedFlags";
import type { SessionFilter } from "./hooks/useSessionFilter";
import type { OfficeRef } from "./types";

export function Roster({ view, filter, hidden, onToggle, officeRef }: { view: OfficeView; filter: SessionFilter; hidden: boolean; onToggle: () => void; officeRef: OfficeRef }) {
  const [internHidden, toggleIntern] = usePersistedFlags("office.internsHidden");
  const lvFlash = useRosterFlash(view.roster);
  const { fq, fStray, saveFilter } = filter;
  return (
    <>
      <SectionHeading id="roster" hidden={hidden} onToggle={onToggle} count={view.roster.length}>นักผจญภัย</SectionHeading>
      <div className="gfilter">
        <div className="gsearch">
          <span className="gsearch-ico" aria-hidden="true">🔍</span>
          <input
            type="search"
            value={fq}
            onChange={(e) => saveFilter(e.target.value, fStray)}
            placeholder="ค้นหาโปรเจกต์…"
            aria-label="กรองโปรเจกต์"
            maxLength={80}
          />
        </div>
        <label className="gtoggle" title="ซ่อน session ที่ไม่ได้เข้ากิลด์ทางประตู (ไม่เห็น SessionStart และมี event น้อย) — ถ้ารอ permission จะยังแสดงเสมอ">
          <input type="checkbox" role="switch" checked={fStray} onChange={(e) => saveFilter(fq, e.target.checked)} />
          <span className="gtoggle-track" aria-hidden="true"><span className="gtoggle-knob" /></span>
          <span>ซ่อนผู้มาเยือนหลงทาง</span>
        </label>
        {(view.hiddenCount ?? 0) > 0 && <small className="hid" role="status">(ซ่อน {view.hiddenCount})</small>}
      </div>
      <ul className="roster" id="sec-roster" hidden={hidden}>
        {view.roster.length === 0 && <li className="empty">ยังไม่มีนักผจญภัย — เปิด Claude Code เพื่อรับเควส</li>}
        {view.roster.map((r) => (
          <RosterCard
            key={r.id}
            r={r}
            highlighted={r.id === view.hoverId || r.id === view.selectedId}
            selected={r.id === view.selectedId}
            flashing={!!lvFlash[r.id]}
            internsHidden={!!internHidden[r.id]}
            onToggleInterns={() => toggleIntern(r.id)}
            officeRef={officeRef}
          />
        ))}
      </ul>
    </>
  );
}
