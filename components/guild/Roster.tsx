import type { OfficeView } from "@/lib/office/engine";
import { m } from "@/paraglide/messages";

import { usePersistedFlags } from "./hooks/usePersistedFlags";
import { useRosterFlash } from "./hooks/useRpgEffects";
import type { SessionFilter } from "./hooks/useSessionFilter";
import { RosterCard } from "./RosterCard";
import { SectionHeading } from "./Section";
import type { OfficeRef } from "./types";

export function Roster({
  view,
  filter,
  hidden,
  onToggle,
  officeRef,
}: {
  view: OfficeView;
  filter: SessionFilter;
  hidden: boolean;
  onToggle: () => void;
  officeRef: OfficeRef;
}) {
  const [internHidden, toggleIntern] = usePersistedFlags("office.internsHidden");
  const lvFlash = useRosterFlash(view.roster);
  const { fq, fStray, saveFilter } = filter;
  return (
    <>
      <SectionHeading id="roster" hidden={hidden} onToggle={onToggle} count={view.roster.length}>
        {m.roster_heading()}
      </SectionHeading>
      <div className="gfilter">
        <div className="gsearch">
          <span className="gsearch-ico" aria-hidden="true">
            🔍
          </span>
          <input
            type="search"
            value={fq}
            onChange={(e) => saveFilter(e.target.value, fStray)}
            placeholder={m.roster_search_placeholder()}
            aria-label={m.roster_search_label()}
            maxLength={80}
          />
        </div>
        <label className="gtoggle" title={m.roster_stray_title()}>
          <input type="checkbox" role="switch" checked={fStray} onChange={(e) => saveFilter(fq, e.target.checked)} />
          <span className="gtoggle-track" aria-hidden="true">
            <span className="gtoggle-knob" />
          </span>
          <span>{m.roster_stray_label()}</span>
        </label>
        {(view.hiddenCount ?? 0) > 0 && (
          <small className="hid" role="status">
            {m.roster_hidden({ count: view.hiddenCount ?? 0 })}
          </small>
        )}
      </div>
      <ul className="roster" id="sec-roster" hidden={hidden}>
        {view.roster.length === 0 && <li className="empty">{m.roster_empty()}</li>}
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
