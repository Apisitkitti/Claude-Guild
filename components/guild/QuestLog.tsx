import type { OfficeView } from "@/lib/office/engine";
import { hms, iconFor } from "./format";
import { SectionHeading } from "./Section";

export function QuestLog({ log, hiddenSet, hidden, onToggle }: { log: OfficeView["log"]; hiddenSet: Set<string>; hidden: boolean; onToggle: () => void }) {
  return (
    <>
      <SectionHeading id="log" hidden={hidden} onToggle={onToggle}>บันทึกเควส</SectionHeading>
      <ul className="log" id="sec-log" hidden={hidden}>
        {log.filter((l) => !l.sid || !hiddenSet.has(l.sid)).map((l) => (
          <li key={l.id} className={`${l.bad ? "bad " : ""}${l.intern ? "intern" : ""}`} title={l.text}>
            <time>{hms(l.time)}</time>
            <span className="dot" style={{ background: l.color }} />
            <span className="ic">{iconFor(l.kind)}</span>
            <span className="tx"><b>{l.tag}</b>{l.intern ? <span className="ilab"> 🛡️ {l.internLabel} ›</span> : null} {l.kind}{l.detail ? <em> {l.detail}</em> : null}</span>
          </li>
        ))}
      </ul>
    </>
  );
}
