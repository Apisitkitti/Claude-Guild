import { useState } from "react";

import { attentionCopy, attentionDetail, attentionText } from "@/lib/office/attentionText";
import type { AttentionRow } from "@/lib/office/engine";
import { m } from "@/paraglide/messages";

import { ageText } from "./format";
import { SectionHeading } from "./Section";
import type { OfficeRef } from "./types";

const COPIED_FLASH_MS = 1500;

const ATTN_ICON: Record<AttentionRow["kind"], string> = {
  permission: "❗",
  loop: "🔁",
  asked: "💬",
  context: "🗜️",
  limit: "😴",
  done: "✅",
};

const AttentionItem = ({
  row,
  now,
  selected,
  onSelect,
  onDismiss,
}: {
  row: AttentionRow;
  now: number;
  selected: boolean;
  onSelect: () => void;
  onDismiss: () => void;
}) => {
  const [copied, setCopied] = useState(false);
  const text = attentionText(row);
  const detail = attentionDetail(row);
  const copyText = attentionCopy(row);
  const copy = () => {
    if (!copyText) return;
    try {
      navigator.clipboard.writeText(copyText).then(
        () => {
          setCopied(true);
          setTimeout(() => setCopied(false), COPIED_FLASH_MS);
        },
        () => {},
      );
    } catch {}
  };
  return (
    <li className={`attn ${row.kind}${selected ? " hl" : ""}`}>
      <button type="button" className="asel" onClick={onSelect} title={detail ? `${text} — ${detail}` : text}>
        <span className="aico" aria-hidden="true">
          {ATTN_ICON[row.kind]}
        </span>
        <span className="atxt">
          <b>
            {row.tag} <span className="aproj">{row.project}</span>
          </b>
          <span className="areason">{text}</span>
          {detail && <span className="adetail">{detail}</span>}
        </span>
        <span className="aage">{ageText(row.since, now)}</span>
      </button>
      <div className="aact">
        {copyText && (
          <button type="button" className="acopy" onClick={copy} title={m.queue_copy_title()}>
            {copied ? m.queue_copied() : m.queue_copy()}
          </button>
        )}
        <button
          type="button"
          className="adismiss"
          onClick={onDismiss}
          aria-label={m.queue_dismiss_label({ tag: row.tag })}
          title={m.queue_dismiss_title()}
        >
          ✕
        </button>
      </div>
    </li>
  );
};

export const AttentionQueue = ({
  rows,
  now,
  selectedId,
  hidden,
  onToggle,
  onJump,
  officeRef,
}: {
  rows: AttentionRow[];
  now: number;
  selectedId: string | null;
  hidden: boolean;
  onToggle: () => void;
  onJump: (sid: string) => void;
  officeRef: OfficeRef;
}) => {
  return (
    <>
      <SectionHeading id="attn" hidden={hidden} onToggle={onToggle} count={rows.length}>
        {m.queue_heading()}
      </SectionHeading>
      <div className="attnsec" id="sec-attn" hidden={hidden}>
        <ul className="attns" aria-live="polite">
          {rows.length === 0 && <li className="empty">{m.queue_empty()}</li>}
          {rows.map((row) => (
            <AttentionItem
              key={row.key}
              row={row}
              now={now || row.since}
              selected={row.sid === selectedId}
              onSelect={() => onJump(row.sid)}
              onDismiss={() => officeRef.current?.dismissAttention(row.key)}
            />
          ))}
        </ul>
        <p className="terrnote">{m.queue_note()}</p>
      </div>
    </>
  );
};
