import type { OfficeView } from "@/lib/office/engine";
import { m } from "@/paraglide/messages";

import { hms, iconFor, kindLabel } from "./format";
import { SectionHeading } from "./Section";

export const QuestLog = ({
  log,
  hiddenSet,
  hidden,
  onToggle,
}: {
  log: OfficeView["log"];
  hiddenSet: Set<string>;
  hidden: boolean;
  onToggle: () => void;
}) => {
  return (
    <>
      <SectionHeading id="log" hidden={hidden} onToggle={onToggle}>
        {m.log_heading()}
      </SectionHeading>
      <ul className="log" id="sec-log" hidden={hidden}>
        {log
          .filter((entry) => !entry.sid || !hiddenSet.has(entry.sid))
          .map((entry) => (
            <li
              key={entry.id}
              className={`${entry.bad ? "bad " : ""}${entry.intern ? "intern" : ""}`}
              title={entry.text}
            >
              <time>{hms(entry.time)}</time>
              <span className="dot" style={{ background: entry.color }} />
              <span className="ic">{iconFor(entry.kind)}</span>
              <span className="tx">
                <b>{entry.tag}</b>
                {entry.intern ? <span className="ilab"> 🛡️ {entry.internLabel} ›</span> : null} {kindLabel(entry.kind)}
                {entry.detail ? <em> {entry.detail}</em> : null}
              </span>
            </li>
          ))}
      </ul>
    </>
  );
};
