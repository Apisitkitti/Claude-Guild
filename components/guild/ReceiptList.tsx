import { receiptSummary, receiptVerdictText, type ReceiptRow } from "@/lib/office/engine";
import { m } from "@/paraglide/messages";

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
    ["📝", m.receipt_label_files(), r.files, m.receipt_hint_files()],
    ["✅", m.receipt_label_recovered(), r.recovered, m.receipt_hint_recovered()],
    ["📦", m.receipt_label_commits(), r.commits, m.receipt_hint_commits()],
    ["↩", m.receipt_label_amends(), r.amends, m.receipt_hint_amends()],
    ["☑", m.receipt_label_tasks(), r.tasks, m.receipt_hint_tasks()],
  ];
  const sum = receiptSummary(r);
  return (
    <li className={`rcpt ${r.verdict}${selected ? " hl" : ""}`}>
      <button
        type="button"
        className="rsel"
        onClick={onSelect}
        disabled={!r.live}
        title={`${sum || m.receipt_verdict_none()} · ${m.receipt_calls({ calls: r.calls })} · ${m.receipt_per_hook()}${r.live ? "" : ` · ${m.receipt_left_guild()}`}`}
      >
        <span className="rhead">
          <b>
            {r.tag} <span className="rproj">{r.project}</span>
          </b>
          <span className={`rverdict ${r.verdict}`}>{receiptVerdictText(r.verdict)}</span>
        </span>
        <span className="rchips">
          {chips
            .filter((c) => c[2] > 0)
            .map((c) => (
              <span key={c[1]} className="rchip" title={c[3]}>
                <span aria-hidden="true">{c[0]}</span> {c[1]} {c[2]}
              </span>
            ))}
          {sum === "" && <span className="rnone">{m.receipt_calls_none({ calls: r.calls })}</span>}
        </span>
        <span className="rage">
          {agoText(r.closedAt, now)}
          {r.squire > 0 ? ` · ${m.receipt_squires({ count: r.squire })}` : ""}
          {r.staleRed && r.verdict !== "red" ? ` · ${m.receipt_stale_red()}` : ""}
        </span>
      </button>
      <button
        type="button"
        className="rdismiss"
        onClick={onDismiss}
        aria-label={m.receipt_dismiss_label({ tag: r.tag })}
        title={m.receipt_dismiss_title()}
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
        {m.receipt_heading()}
      </SectionHeading>
      <div className="rcptsec" id="sec-rcpt" hidden={hidden}>
        {visible.length > 0 && (
          <div className="rcptbar">
            <button type="button" className="rclear" onClick={clearAll} title={m.receipt_clear_title()}>
              {m.receipt_clear()}
            </button>
          </div>
        )}
        <ul className="rcpts">
          {visible.length === 0 && <li className="empty">{m.receipt_empty()}</li>}
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
        <p className="terrnote">{m.receipt_note()}</p>
      </div>
    </>
  );
}
