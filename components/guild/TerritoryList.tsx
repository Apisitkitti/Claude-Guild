import type { ConflictRow } from "@/lib/office/engine";
import { m } from "@/paraglide/messages";

import { SectionHeading } from "./Section";
import type { OfficeRef } from "./types";

const ConflictItem = ({
  conflict,
  onSelect,
  onDismiss,
}: {
  conflict: ConflictRow;
  onSelect: (id: string) => void;
  onDismiss: () => void;
}) => {
  const clash = conflict.level === "clash";
  return (
    <li className={`conflict ${clash ? "clash" : "overlap"}`}>
      <div className="chead">
        <span className="cfile" title={conflict.file}>
          {conflict.file}
        </span>
        <button
          type="button"
          className="cdismiss"
          onClick={onDismiss}
          aria-label={m.terr_dismiss_label({ file: conflict.file })}
          title={m.terr_dismiss_title()}
        >
          ✕
        </button>
      </div>
      <div className="cwho">
        {conflict.names.map((name, i) => (
          <span key={conflict.sids[i]}>
            {i > 0 && <span className="vs"> vs </span>}
            <button type="button" className="cname" onClick={() => onSelect(conflict.sids[i])}>
              {name}
            </button>
          </span>
        ))}
      </div>
      <span className={`clevel ${clash ? "clash" : "overlap"}`}>
        {clash ? m.terr_level_clash() : m.terr_level_overlap()}
      </span>
    </li>
  );
};

export const TerritoryList = ({
  conflicts,
  hidden,
  onToggle,
  officeRef,
}: {
  conflicts: ConflictRow[];
  hidden: boolean;
  onToggle: () => void;
  officeRef: OfficeRef;
}) => {
  return (
    <>
      <SectionHeading id="terr" hidden={hidden} onToggle={onToggle} count={conflicts.length}>
        {m.terr_heading()}
      </SectionHeading>
      <div className="terrsec" id="sec-terr" hidden={hidden}>
        <ul className="conflicts">
          {conflicts.length === 0 && <li className="empty">{m.terr_empty()}</li>}
          {conflicts.map((conflict) => (
            <ConflictItem
              key={conflict.key}
              conflict={conflict}
              onSelect={(id) => officeRef.current?.select(id)}
              onDismiss={() => officeRef.current?.dismissConflict(conflict.key)}
            />
          ))}
        </ul>
        <p className="terrnote">{m.terr_note()}</p>
      </div>
    </>
  );
};
