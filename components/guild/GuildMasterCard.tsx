import { useEffect, useRef, useState } from "react";

import { MS_PER_SECOND } from "@/lib/constants";
import type { GmReportRow, RosterRow } from "@/lib/office/engine";
import { m } from "@/paraglide/messages";

import { ageText } from "./format";
import { gmReasonLabel } from "./gmReport";
import type { OfficeRef } from "./types";

const REFRESH_MS = MS_PER_SECOND;
const FALLBACK_COLOR = "var(--color-ink-dim)";

/**
 * The Guild Master's report: a parchment dialog opened by clicking him on the canvas (or `G`). Lists every session that
 * is waiting on the user, most urgent first, with a "Go" button that selects the session. Re-reads the engine each second.
 */
export const GuildMasterCard = ({
  officeRef,
  roster,
  onGo,
  onClose,
}: {
  officeRef: OfficeRef;
  roster: RosterRow[];
  onGo: (id: string) => void;
  onClose: () => void;
}) => {
  const closeRef = useRef<HTMLButtonElement>(null);
  const cardRef = useRef<HTMLElement>(null);
  const [rows, setRows] = useState<GmReportRow[]>([]);
  const [clock, setClock] = useState(0);

  const colorOf = (id: string) => roster.find((row) => row.id === id)?.color ?? FALLBACK_COLOR;

  // keep Tab inside the dialog (it is modal)
  const trapTab = (ev: React.KeyboardEvent<HTMLElement>) => {
    if (ev.key !== "Tab") return;
    const items = [...(cardRef.current?.querySelectorAll<HTMLElement>("button:not([disabled])") ?? [])];
    if (items.length === 0) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (ev.shiftKey && document.activeElement === first) {
      ev.preventDefault();
      last.focus();
    } else if (!ev.shiftKey && document.activeElement === last) {
      ev.preventDefault();
      first.focus();
    }
  };

  useEffect(() => {
    closeRef.current?.focus({ preventScroll: true });
  }, []);
  useEffect(() => {
    const read = () => {
      const office = officeRef.current;
      if (!office) return;
      setRows(office.guildMasterReport());
      setClock(office.clock);
    };
    read();
    const timer = setInterval(read, REFRESH_MS);
    return () => clearInterval(timer);
  }, [officeRef]);
  useEffect(() => {
    // capture + stop: the modal owns Escape
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key !== "Escape") return;
      ev.preventDefault();
      ev.stopPropagation();
      onClose();
    };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [onClose]);

  return (
    <div
      className="gm-backdrop"
      onMouseDown={(ev) => {
        if (ev.target === ev.currentTarget) onClose();
      }}
    >
      <section
        className="gm"
        role="dialog"
        aria-modal="true"
        aria-labelledby="gm-title"
        ref={cardRef}
        onKeyDown={trapTab}
      >
        <header>
          <h2 id="gm-title">{m.gm_report_title()}</h2>
          <button
            type="button"
            ref={closeRef}
            onClick={onClose}
            aria-label={m.gm_report_close()}
            title={m.gm_report_close()}
          >
            ✕
          </button>
        </header>
        {rows.length === 0 ? (
          <div className="gm-empty" role="status">
            <p>{m.gm_report_empty()}</p>
            <p className="gm-calm">{m.gm_report_empty_calm()}</p>
          </div>
        ) : (
          <>
            <p className="gm-summary" role="status">
              {m.gm_report_summary({ count: rows.length })}
            </p>
            <ul className="gm-rows" aria-label={m.gm_report_list_label()}>
              {rows.map((row) => (
                <li key={`${row.id}|${row.reason}`} className="gm-row">
                  <span className="gm-dot" style={{ background: colorOf(row.id) }} aria-hidden="true" />
                  <div className="gm-main">
                    <div className="gm-line">
                      <span className="gm-reason">{gmReasonLabel(row.reason)}</span>
                      <span className="gm-since">{ageText(row.since * MS_PER_SECOND, clock * MS_PER_SECOND)}</span>
                    </div>
                    <div className="gm-who">
                      <b>{row.tag}</b>
                      {row.project && <span> · {row.project}</span>}
                    </div>
                    {row.detail && <div className="gm-detail">{row.detail}</div>}
                  </div>
                  <button
                    type="button"
                    className="gm-go"
                    aria-label={m.gm_report_go_label({ tag: row.tag })}
                    onClick={() => {
                      onGo(row.id);
                      onClose();
                    }}
                  >
                    {m.gm_report_go()}
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
    </div>
  );
};
