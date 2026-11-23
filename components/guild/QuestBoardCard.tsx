import { useEffect, useRef, type RefObject } from "react";

import type { QuestView } from "@/lib/office/engine";
import type { QuestMsgItem } from "@/lib/office/questNotes";
import { m } from "@/paraglide/messages";

import { Avatar } from "./Avatar";

const STATUS_MARK: Record<QuestMsgItem["status"], string> = { pending: "☐", in_progress: "▶", completed: "✔" };

const statusText = (status: QuestMsgItem["status"]): string =>
  status === "completed"
    ? m.quest_board_status_done()
    : status === "in_progress"
      ? m.quest_board_status_active()
      : m.quest_board_status_pending();

/**
 * The quest board's list: each session (avatar, project, class colour) with its todos. ☐ pending, ▶ in progress (shows
 * the progress wording), ✔ done (struck). Closes with ✕, Escape or a click outside (`anchorRef` = the board's hit
 * button, so a click on it toggles instead of re-opening).
 */
export const QuestBoardCard = ({
  quests,
  left,
  top,
  anchorRef,
  onClose,
}: {
  quests: QuestView[];
  /** px from the left / top of the stage: just right of the board */
  left: number;
  top: number;
  anchorRef: RefObject<HTMLButtonElement | null>;
  onClose: () => void;
}) => {
  const cardRef = useRef<HTMLElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    closeRef.current?.focus({ preventScroll: true });
  }, []);
  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === "Escape") onClose();
    };
    const onDown = (ev: MouseEvent) => {
      const target = ev.target as Node;
      if (cardRef.current?.contains(target) || anchorRef.current?.contains(target)) return;
      onClose();
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onDown);
    };
  }, [anchorRef, onClose]);
  return (
    <section
      className="qcard"
      role="dialog"
      aria-labelledby="qcard-title"
      ref={cardRef}
      style={{ left, top, maxHeight: `calc(100% - ${top}px - 6px)` }}
    >
      <header>
        <h2 id="qcard-title">{m.quest_board_title()}</h2>
        <button
          type="button"
          ref={closeRef}
          onClick={onClose}
          aria-label={m.quest_board_close()}
          title={m.quest_board_close()}
        >
          ✕
        </button>
      </header>
      {quests.length === 0 && <p className="qnone">{m.quest_board_empty()}</p>}
      {quests.map((quest) => {
        const done = quest.items.filter((item) => item.status === "completed").length;
        return (
          <section key={quest.sid} className="qsess" style={{ borderLeftColor: quest.color }}>
            <h3>
              <Avatar look={quest.look} />
              <span className="qproj" title={quest.project}>
                {quest.project}
              </span>
              <span className="qtag">{quest.tag}</span>
              <span className="qprog">{m.quest_board_progress({ done, total: quest.items.length })}</span>
            </h3>
            {!quest.live && <p className="qleft">{m.quest_board_left()}</p>}
            <ul>
              {quest.items.map((item, index) => (
                <li key={`${index}|${item.text}`} className={`q-${item.status}`}>
                  <span className="qmark" aria-hidden="true">
                    {STATUS_MARK[item.status]}
                  </span>
                  <span className="sr-only">{statusText(item.status)}: </span>
                  <span className="qtext">
                    {item.status === "in_progress" && item.active ? item.active : item.text}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </section>
  );
};
