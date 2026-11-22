import type { ConflictRow } from "@/lib/office/engine";
import { m } from "@/paraglide/messages";

import { SectionHeading } from "./Section";
import type { OfficeRef } from "./types";

function ConflictItem({
  c,
  onSelect,
  onDismiss,
}: {
  c: ConflictRow;
  onSelect: (id: string) => void;
  onDismiss: () => void;
}) {
  const clash = c.level === "clash";
  return (
    <li className={`conflict ${clash ? "clash" : "overlap"}`}>
      <div className="chead">
        <span className="cfile" title={c.file}>
          {c.file}
        </span>
        <button
          type="button"
          className="cdismiss"
          onClick={onDismiss}
          aria-label={m.terr_dismiss_label({ file: c.file })}
          title={m.terr_dismiss_title()}
        >
          ✕
        </button>
      </div>
      <div className="cwho">
        {c.names.map((n, i) => (
          <span key={c.sids[i]}>
            {i > 0 && <span className="vs"> vs </span>}
            <button type="button" className="cname" onClick={() => onSelect(c.sids[i])}>
              {n}
            </button>
          </span>
        ))}
      </div>
      <span className={`clevel ${clash ? "clash" : "overlap"}`}>
        {clash ? m.terr_level_clash() : m.terr_level_overlap()}
      </span>
    </li>
  );
}

export function TerritoryList({
  conflicts,
  hidden,
  onToggle,
  officeRef,
}: {
  conflicts: ConflictRow[];
  hidden: boolean;
  onToggle: () => void;
  officeRef: OfficeRef;
}) {
  return (
    <>
      <SectionHeading id="terr" hidden={hidden} onToggle={onToggle} count={conflicts.length}>
        {m.terr_heading()}
      </SectionHeading>
      <div className="terrsec" id="sec-terr" hidden={hidden}>
        <ul className="conflicts">
          {conflicts.length === 0 && <li className="empty">{m.terr_empty()}</li>}
          {conflicts.map((c) => (
            <ConflictItem
              key={c.key}
              c={c}
              onSelect={(id) => officeRef.current?.select(id)}
              onDismiss={() => officeRef.current?.dismissConflict(c.key)}
            />
          ))}
        </ul>
        <p className="terrnote">{m.terr_note()}</p>
      </div>
    </>
  );
}
