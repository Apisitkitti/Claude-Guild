import { useEffect, useRef, useState } from "react";

import type { ChronicleDay } from "@/lib/chronicle";
import { MS_PER_SECOND } from "@/lib/constants";
import type { Office } from "@/lib/office/engine";
import { m } from "@/paraglide/messages";

import { chronicleFacts, chronicleSentences, chronicleStandup, isQuietDay, NO_LOCAL } from "./chronicleText";
import type { OfficeRef } from "./types";

const REFRESH_MS = 2 * MS_PER_SECOND;
const COPIED_MS = 2 * MS_PER_SECOND;
const QUIET_DAY = (date: string): ChronicleDay => ({
  date,
  sessions: 0,
  projects: [],
  prompts: 0,
  toolCalls: 0,
  tools: [],
  files: 0,
  recovered: 0,
  commits: 0,
  tasks: 0,
  loops: 0,
  longestSessionMs: 0,
  busiestHour: null,
});

type Tab = "today" | "yesterday";
type CopyState = "idle" | "copied" | "failed";

/**
 * The daily chronicle: a parchment dialog with Today / Yesterday tabs, a short fantasy recap, a facts grid and a
 * "copy as standup" button. Server numbers come over SSE; monsters / bosses / raids / levels come from the engine.
 */
export const ChronicleCard = ({ officeRef, onClose }: { officeRef: OfficeRef; onClose: () => void }) => {
  const closeRef = useRef<HTMLButtonElement>(null);
  const cardRef = useRef<HTMLElement>(null);
  const [tab, setTab] = useState<Tab>("today");
  const [copy, setCopy] = useState<CopyState>("idle");
  const [data, setData] = useState<ReturnType<Office["chronicleView"]> | null>(null);

  const isToday = tab === "today";
  const today = data?.server?.today ?? QUIET_DAY("");
  const yesterday = data?.server?.yesterday ?? QUIET_DAY("");
  const day = isToday ? today : yesterday;
  const local = data
    ? { monsters: data.monsters, bosses: data.bosses, raids: data.raids, levels: data.levels }
    : NO_LOCAL;
  const sentences = chronicleSentences(day, isToday, local);
  const facts = chronicleFacts(day, isToday, local);
  const quiet = isQuietDay(day, isToday ? local : NO_LOCAL);

  const copyStandup = async () => {
    try {
      await navigator.clipboard.writeText(chronicleStandup(yesterday, today));
      setCopy("copied");
    } catch {
      setCopy("failed");
    }
  };

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
    const read = () => setData(officeRef.current?.chronicleView() ?? null);
    read();
    const timer = setInterval(read, REFRESH_MS);
    return () => clearInterval(timer);
  }, [officeRef]);
  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key !== "Escape") return;
      ev.preventDefault();
      onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);
  useEffect(() => {
    if (copy === "idle") return;
    const timer = setTimeout(() => setCopy("idle"), COPIED_MS);
    return () => clearTimeout(timer);
  }, [copy]);

  return (
    <div
      className="chron-backdrop"
      onMouseDown={(ev) => {
        if (ev.target === ev.currentTarget) onClose();
      }}
    >
      <section
        className="chron"
        role="dialog"
        aria-modal="true"
        aria-labelledby="chron-title"
        ref={cardRef}
        onKeyDown={trapTab}
      >
        <header>
          <h2 id="chron-title">{m.chronicle_title()}</h2>
          <button
            type="button"
            ref={closeRef}
            onClick={onClose}
            aria-label={m.chronicle_close()}
            title={m.chronicle_close()}
          >
            ✕
          </button>
        </header>
        <div className="chron-tabs" role="group" aria-label={m.chronicle_tabs_label()}>
          <button type="button" aria-pressed={isToday} onClick={() => setTab("today")}>
            {m.chronicle_tab_today()}
          </button>
          <button type="button" aria-pressed={!isToday} onClick={() => setTab("yesterday")}>
            {m.chronicle_tab_yesterday()}
          </button>
          {day.date && <span className="chron-date">{day.date}</span>}
        </div>
        {quiet ? (
          <p className="chron-empty">{m.chronicle_empty()}</p>
        ) : (
          <>
            <ul className="chron-story">
              {sentences.map((sentence) => (
                <li key={sentence}>{sentence}</li>
              ))}
            </ul>
            <dl className="chron-facts">
              {facts.map((fact) => (
                <div key={fact.label}>
                  <dt>{fact.label}</dt>
                  <dd>{fact.value}</dd>
                </div>
              ))}
            </dl>
            {isToday && <p className="chron-note">{m.chronicle_local_note()}</p>}
          </>
        )}
        <footer>
          <button type="button" className="chron-copy" onClick={copyStandup}>
            {copy === "copied" ? m.chronicle_copied() : m.chronicle_copy()}
          </button>
          {copy === "failed" && (
            <span className="chron-fail" role="status">
              {m.chronicle_copy_failed()}
            </span>
          )}
        </footer>
      </section>
    </div>
  );
};
