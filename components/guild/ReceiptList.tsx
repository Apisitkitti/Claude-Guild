import { receiptSummary, receiptVerdictText, type ReceiptRow } from "@/lib/office/engine";
import { m } from "@/paraglide/messages";

import { agoText } from "./format";
import { useReceiptDismissals } from "./hooks/useReceiptDismissals";
import { SectionHeading } from "./Section";

const ReceiptItem = ({
  receipt,
  now,
  selected,
  onSelect,
  onDismiss,
}: {
  receipt: ReceiptRow;
  now: number;
  selected: boolean;
  onSelect: () => void;
  onDismiss: () => void;
}) => {
  const chips: { icon: string; label: string; count: number; hint: string }[] = [
    { icon: "📝", label: m.receipt_label_files(), count: receipt.files, hint: m.receipt_hint_files() },
    { icon: "✅", label: m.receipt_label_recovered(), count: receipt.recovered, hint: m.receipt_hint_recovered() },
    { icon: "📦", label: m.receipt_label_commits(), count: receipt.commits, hint: m.receipt_hint_commits() },
    { icon: "↩", label: m.receipt_label_amends(), count: receipt.amends, hint: m.receipt_hint_amends() },
    { icon: "☑", label: m.receipt_label_tasks(), count: receipt.tasks, hint: m.receipt_hint_tasks() },
  ];
  const sum = receiptSummary(receipt);
  return (
    <li className={`rcpt ${receipt.verdict}${selected ? " hl" : ""}`}>
      <button
        type="button"
        className="rsel"
        onClick={onSelect}
        disabled={!receipt.live}
        title={`${sum || m.receipt_verdict_none()} · ${m.receipt_calls({ calls: receipt.calls })} · ${m.receipt_per_hook()}${receipt.live ? "" : ` · ${m.receipt_left_guild()}`}`}
      >
        <span className="rhead">
          <b>
            {receipt.tag} <span className="rproj">{receipt.project}</span>
          </b>
          <span className={`rverdict ${receipt.verdict}`}>{receiptVerdictText(receipt.verdict)}</span>
        </span>
        <span className="rchips">
          {chips
            .filter((chip) => chip.count > 0)
            .map((chip) => (
              <span key={chip.label} className="rchip" title={chip.hint}>
                <span aria-hidden="true">{chip.icon}</span> {chip.label} {chip.count}
              </span>
            ))}
          {sum === "" && <span className="rnone">{m.receipt_calls_none({ calls: receipt.calls })}</span>}
        </span>
        <span className="rage">
          {agoText(receipt.closedAt, now)}
          {receipt.squire > 0 ? ` · ${m.receipt_squires({ count: receipt.squire })}` : ""}
          {receipt.staleRed && receipt.verdict !== "red" ? ` · ${m.receipt_stale_red()}` : ""}
        </span>
      </button>
      <button
        type="button"
        className="rdismiss"
        onClick={onDismiss}
        aria-label={m.receipt_dismiss_label({ tag: receipt.tag })}
        title={m.receipt_dismiss_title()}
      >
        ✕
      </button>
    </li>
  );
};

export const ReceiptList = ({
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
}) => {
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
          {visible.map((receipt) => (
            <ReceiptItem
              key={receipt.id}
              receipt={receipt}
              now={now || receipt.closedAt}
              selected={receipt.sid === selectedId}
              onSelect={() => onJump(receipt.sid)}
              onDismiss={() => dismiss(receipt.id)}
            />
          ))}
        </ul>
        <p className="terrnote">{m.receipt_note()}</p>
      </div>
    </>
  );
};
