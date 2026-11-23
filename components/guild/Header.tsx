import { useEffect, useRef, useState } from "react";

import { m } from "@/paraglide/messages";
import { getLocale, setLocale, type Locale } from "@/paraglide/runtime";

import { ChronicleCard } from "./ChronicleCard";
import { isNum } from "./format";
import type { Notify } from "./hooks/useNotifications";
import { useTreasuryBump } from "./hooks/useRpgEffects";
import type { Sound } from "./hooks/useSound";
import type { Conn, Mode, OfficeRef } from "./types";

const SPEED_FAST = 4;
const SPEED_STEPS = [1, 2, SPEED_FAST];
const VOLUME_POP_ID = "vol-pop";
/** strips a leading/trailing emoji or arrow glyph so the text part can hide at narrow widths */
const textOnly = (label: string): string => label.replace(/[\u25C0\u25B6\u{1F4DC}]\uFE0F?/gu, "").trim();
/** language switch labels are written in their own language */
const LOCALE_BUTTONS: { locale: Locale; label: string }[] = [
  { locale: "th", label: "ไทย" },
  { locale: "en", label: "EN" },
];

export const Header = ({
  mode,
  conn,
  note,
  treasury,
  paused,
  speed,
  notify,
  sound,
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
  sound: Sound;
  full: boolean;
  collapsed: boolean;
  officeRef: OfficeRef;
  onSwitchMode: (mode: Mode) => void;
  onTogglePause: () => void;
  onSetSpeed: (speed: number) => void;
  onToggleFull: () => void;
  onToggleCollapsed: () => void;
}) => {
  const bump = useTreasuryBump(treasury);
  const [chronicleOpen, setChronicleOpen] = useState(false);
  const [volumeOpen, setVolumeOpen] = useState(false);
  const chronicleBtnRef = useRef<HTMLButtonElement>(null);
  const soundWrapRef = useRef<HTMLDivElement>(null);
  const volBtnRef = useRef<HTMLButtonElement>(null);
  const { perm: notifyPerm, on: notifyOn, toggle: toggleNotify } = notify;
  const locale = getLocale();
  const bellOn = notifyOn && notifyPerm === "granted";
  const pill =
    mode === "demo"
      ? { cls: "demo", text: m.header_pill_demo() }
      : conn === "connected"
        ? { cls: "ok", text: m.header_pill_connected() }
        : { cls: "warn", text: conn === "reconnecting" ? m.header_pill_reconnecting() : m.header_pill_connecting() };
  const chronicleText = textOnly(m.chronicle_button());
  const panelText = textOnly(collapsed ? m.header_panel_show() : m.header_panel_hide());
  const volumeShown = volumeOpen && sound.on;
  const closeChronicle = () => {
    setChronicleOpen(false);
    chronicleBtnRef.current?.focus({ preventScroll: true });
  };
  useEffect(() => {
    if (!volumeShown) return;
    const onDown = (ev: MouseEvent) => {
      if (!soundWrapRef.current?.contains(ev.target as Node)) setVolumeOpen(false);
    };
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key !== "Escape") return;
      ev.preventDefault(); // one Escape closes the popover only (the dungeon scene also listens for it)
      setVolumeOpen(false);
      volBtnRef.current?.focus({ preventScroll: true });
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [volumeShown]);
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
          <span aria-hidden>💰</span> <span className="hdr-lbl">{m.header_treasury()} </span>
          <b>{treasury}</b>
        </span>
      )}
      {mode === "demo" && (
        <div className="ctrls">
          <button onClick={() => officeRef.current?.addSession()}>{m.header_add_session()}</button>
          <button onClick={() => officeRef.current?.testHand()}>{m.header_test_hand()}</button>
          <button onClick={onTogglePause}>{paused ? m.header_resume() : m.header_pause()}</button>
          <div className="seg">
            {SPEED_STEPS.map((step) => (
              <button key={step} className={speed === step ? "on" : ""} onClick={() => onSetSpeed(step)}>
                {step}x
              </button>
            ))}
          </div>
        </div>
      )}
      {note && <span className="note">{note}</span>}
      <span className="spacer" />
      <button
        type="button"
        ref={chronicleBtnRef}
        onClick={() => setChronicleOpen(true)}
        aria-haspopup="dialog"
        title={m.chronicle_button_title()}
        aria-label={chronicleText}
      >
        <span aria-hidden>📜</span> <span className="hdr-lbl">{chronicleText}</span>
      </button>
      {chronicleOpen && <ChronicleCard officeRef={officeRef} onClose={closeChronicle} />}
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
      <div className="sound-wrap" ref={soundWrapRef}>
        <button
          className={`bell${sound.on ? " on" : ""}`}
          onClick={() => {
            setVolumeOpen(false);
            sound.toggle();
          }}
          aria-pressed={sound.on}
          aria-label={m.sound_label()}
          title={sound.on ? m.sound_off() : m.sound_on()}
        >
          {sound.on ? "🔊" : "🔇"}
        </button>
        {sound.on && (
          <button
            type="button"
            className="vol-btn"
            ref={volBtnRef}
            onClick={() => setVolumeOpen((open) => !open)}
            aria-expanded={volumeShown}
            aria-controls={VOLUME_POP_ID}
            aria-label={m.sound_volume()}
            title={m.sound_volume()}
          >
            ▾
          </button>
        )}
        {volumeShown && (
          <div className="vol-pop" id={VOLUME_POP_ID}>
            <input
              className="sound-vol"
              type="range"
              min={0}
              max={1}
              step={0.1}
              value={sound.volume}
              onChange={(event) => sound.setVolume(Number(event.target.value))}
              aria-label={m.sound_volume()}
              title={m.sound_volume()}
            />
          </div>
        )}
      </div>
      <div className="seg" role="group" aria-label={m.header_language()}>
        {LOCALE_BUTTONS.map((button) => (
          <button
            key={button.locale}
            lang={button.locale}
            className={locale === button.locale ? "on" : ""}
            aria-pressed={locale === button.locale}
            onClick={() => setLocale(button.locale)}
          >
            {button.label}
          </button>
        ))}
      </div>
      <button onClick={onToggleFull} title={m.header_fullscreen()} aria-label={m.header_fullscreen()}>
        {full ? "⤡" : "⤢"}
      </button>
      <button
        onClick={onToggleCollapsed}
        aria-expanded={!collapsed}
        title={m.header_panel_toggle()}
        aria-label={panelText}
      >
        {collapsed && <span aria-hidden>◀ </span>}
        <span className="hdr-lbl">{panelText}</span>
        {!collapsed && <span aria-hidden> ▶</span>}
      </button>
    </header>
  );
};
