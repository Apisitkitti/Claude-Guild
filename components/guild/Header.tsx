import { m } from "@/paraglide/messages";
import { getLocale, setLocale, type Locale } from "@/paraglide/runtime";

import { isNum } from "./format";
import type { Notify } from "./hooks/useNotifications";
import { useTreasuryBump } from "./hooks/useRpgEffects";
import type { Conn, Mode, OfficeRef } from "./types";

const SPEED_FAST = 4;
const SPEED_STEPS = [1, 2, SPEED_FAST];
/** language switch labels are written in their own language */
const LOCALE_BUTTONS: { locale: Locale; label: string }[] = [
  { locale: "th", label: "ไทย" },
  { locale: "en", label: "EN" },
];

export function Header({
  mode,
  conn,
  note,
  treasury,
  paused,
  speed,
  notify,
  full,
  collapsed,
  officeRef,
  onSwitchMode,
  onTogglePause,
  onSetSpeed,
  onToggleFull,
  onToggleCollapsed,
}: {
  mode: Mode;
  conn: Conn;
  note: string;
  treasury: number | undefined;
  paused: boolean;
  speed: number;
  notify: Notify;
  full: boolean;
  collapsed: boolean;
  officeRef: OfficeRef;
  onSwitchMode: (m: Mode) => void;
  onTogglePause: () => void;
  onSetSpeed: (n: number) => void;
  onToggleFull: () => void;
  onToggleCollapsed: () => void;
}) {
  const bump = useTreasuryBump(treasury);
  const { perm: notifyPerm, on: notifyOn, toggle: toggleNotify } = notify;
  const locale = getLocale();
  const bellOn = notifyOn && notifyPerm === "granted";
  const pill =
    mode === "demo"
      ? { cls: "demo", text: m.header_pill_demo() }
      : conn === "connected"
        ? { cls: "ok", text: m.header_pill_connected() }
        : { cls: "warn", text: conn === "reconnecting" ? m.header_pill_reconnecting() : m.header_pill_connecting() };
  return (
    <header className="bar">
      <h1>
        <span className="logo" aria-hidden>
          ⚔️
        </span>{" "}
        Claude Guild
      </h1>
      <div className="seg" role="group" aria-label={m.header_mode_label()}>
        <button className={mode === "live" ? "on" : ""} onClick={() => onSwitchMode("live")}>
          {m.header_mode_live()}
        </button>
        <button className={mode === "demo" ? "on" : ""} onClick={() => onSwitchMode("demo")}>
          {m.header_mode_demo()}
        </button>
      </div>
      <span className={`pill ${pill.cls}`}>
        <i />
        {pill.text}
      </span>
      {isNum(treasury) && (
        <span className={`pill treasury${bump ? " bump" : ""}`} title={m.header_treasury_title()}>
          💰 {m.header_treasury()} <b>{treasury}</b>
        </span>
      )}
      {mode === "demo" && (
        <div className="ctrls">
          <button onClick={() => officeRef.current?.addSession()}>{m.header_add_session()}</button>
          <button onClick={() => officeRef.current?.testHand()}>{m.header_test_hand()}</button>
          <button onClick={onTogglePause}>{paused ? m.header_resume() : m.header_pause()}</button>
          <div className="seg">
            {SPEED_STEPS.map((n) => (
              <button key={n} className={speed === n ? "on" : ""} onClick={() => onSetSpeed(n)}>
                {n}x
              </button>
            ))}
          </div>
        </div>
      )}
      {note && <span className="note">{note}</span>}
      <span className="spacer" />
      {(notifyPerm === "default" || notifyPerm === "granted") && (
        <button
          className={`bell${bellOn ? " on" : ""}`}
          onClick={toggleNotify}
          aria-pressed={bellOn}
          aria-label={bellOn ? m.header_notify_off() : m.header_notify_on()}
          title={bellOn ? m.header_notify_off() : m.header_notify_on()}
        >
          {bellOn ? "🔔" : "🔕"}
        </button>
      )}
      <div className="seg" role="group" aria-label={m.header_language()}>
        {LOCALE_BUTTONS.map((b) => (
          <button
            key={b.locale}
            lang={b.locale}
            className={locale === b.locale ? "on" : ""}
            aria-pressed={locale === b.locale}
            onClick={() => setLocale(b.locale)}
          >
            {b.label}
          </button>
        ))}
      </div>
      <button onClick={onToggleFull} title={m.header_fullscreen()} aria-label={m.header_fullscreen()}>
        {full ? "⤡" : "⤢"}
      </button>
      <button onClick={onToggleCollapsed} aria-expanded={!collapsed} title={m.header_panel_toggle()}>
        {collapsed ? m.header_panel_show() : m.header_panel_hide()}
      </button>
    </header>
  );
}
