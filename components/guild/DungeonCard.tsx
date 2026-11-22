import { useEffect, useRef, useState } from "react";

import type { DungeonStats } from "@/lib/office/dungeon";
import { m } from "@/paraglide/messages";

import { durText, hms } from "./format";
import type { OfficeRef } from "./types";

const NONE = "—";
const REFRESH_MS = 1000;

/** The dungeon gate's ledger: client-side counters since this page opened. Closes with ✕, Escape or a click outside. */
export const DungeonCard = ({
  stats,
  officeRef,
  top,
  onClose,
  onEnter,
}: {
  stats: DungeonStats;
  officeRef: OfficeRef;
  /** px from the top of the stage: just under the gate */
  top: number;
  onClose: () => void;
  /** switch the canvas to the dungeon interior (the parent mirrors the scene and closes the card) */
  onEnter: () => void;
}) => {
  const closeRef = useRef<HTMLButtonElement>(null);
  // the waiting total keeps growing between view updates: while the card is open, re-read it once a second
  const [liveWaitS, setLiveWaitS] = useState(stats.waitS);
  const waitS = Math.max(stats.waitS, liveWaitS);
  useEffect(() => {
    const timer = setInterval(() => setLiveWaitS(officeRef.current?.dungeonStats().waitS ?? 0), REFRESH_MS);
    return () => clearInterval(timer);
  }, [officeRef]);
  useEffect(() => {
    closeRef.current?.focus({ preventScroll: true });
  }, []);
  return (
    <section
      className="dcard"
      role="dialog"
      aria-labelledby="dcard-title"
      style={{ top, maxHeight: `calc(100% - ${top}px - 6px)` }}
    >
      <header>
        <h2 id="dcard-title">{m.dungeon_title()}</h2>
        <button type="button" ref={closeRef} onClick={onClose} aria-label={m.dungeon_close()} title={m.dungeon_close()}>
          ✕
        </button>
      </header>
      <dl>
        <div className="drow">
          <dt>{m.dungeon_sessions()}</dt>
          <dd>{m.dungeon_sessions_value({ entered: stats.entered, left: stats.left })}</dd>
        </div>
        <div className="drow">
          <dt>{m.dungeon_raiders()}</dt>
          <dd>{stats.raiders}</dd>
        </div>
        <div className="drow">
          <dt>{m.dungeon_live()}</dt>
          <dd>{stats.live}</dd>
        </div>
        <div className="drow">
          <dt>{m.dungeon_monsters()}</dt>
          <dd>{stats.monsters}</dd>
        </div>
        <div className="drow">
          <dt>{m.dungeon_bosses()}</dt>
          <dd>
            {stats.bosses}
            {stats.bossesAlive > 0 && <small>{m.dungeon_boss_alive({ count: stats.bossesAlive })}</small>}
          </dd>
        </div>
        <div className="drow">
          <dt>{m.dungeon_boss_longest()}</dt>
          <dd>{stats.longestBossS > 0 ? durText(stats.longestBossS) : NONE}</dd>
        </div>
        <div className="drow">
          <dt>{m.dungeon_wait()}</dt>
          <dd>{durText(waitS)}</dd>
        </div>
      </dl>
      <h3>{m.dungeon_tools()}</h3>
      {stats.topTools.length ? (
        <ol>
          {stats.topTools.map((entry) => (
            <li key={entry.tool}>
              <span title={entry.tool}>{entry.tool}</span>
              <b>{entry.count}</b>
            </li>
          ))}
        </ol>
      ) : (
        <p className="dnone">{m.dungeon_tools_empty()}</p>
      )}
      <button type="button" className="denter" onClick={onEnter}>
        {m.dungeon_enter()}
      </button>
      <p className="dnote">{m.dungeon_since({ time: hms(stats.since) })}</p>
    </section>
  );
};
