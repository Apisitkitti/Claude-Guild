import { isNum } from "./format";
import { useTreasuryBump } from "./hooks/useRpgEffects";
import type { Notify } from "./hooks/useNotifications";
import type { Conn, Mode, OfficeRef } from "./types";

export function Header({ mode, conn, note, treasury, paused, speed, notify, full, collapsed, officeRef, onSwitchMode, onTogglePause, onSetSpeed, onToggleFull, onToggleCollapsed }: {
  mode: Mode; conn: Conn; note: string; treasury: number | undefined; paused: boolean; speed: number; notify: Notify; full: boolean; collapsed: boolean; officeRef: OfficeRef;
  onSwitchMode: (m: Mode) => void; onTogglePause: () => void; onSetSpeed: (n: number) => void; onToggleFull: () => void; onToggleCollapsed: () => void;
}) {
  const bump = useTreasuryBump(treasury);
  const { perm: notifyPerm, on: notifyOn, toggle: toggleNotify } = notify;
  const pill =
    mode === "demo" ? { cls: "demo", text: "demo" }
    : conn === "connected" ? { cls: "ok", text: "connected" }
    : { cls: "warn", text: conn === "reconnecting" ? "reconnecting" : "connecting" };
  return (
    <header className="bar">
      <h1><span className="logo" aria-hidden>⚔️</span> Claude Guild</h1>
      <div className="seg" role="group" aria-label="mode">
        <button className={mode === "live" ? "on" : ""} onClick={() => onSwitchMode("live")}>Live</button>
        <button className={mode === "demo" ? "on" : ""} onClick={() => onSwitchMode("demo")}>Demo</button>
      </div>
      <span className={`pill ${pill.cls}`}><i />{pill.text}</span>
      {isNum(treasury) && <span className={`pill treasury${bump ? " bump" : ""}`} title="ทองสะสมของกิลด์">💰 คลังกิลด์ <b>{treasury}</b></span>}
      {mode === "demo" && (
        <div className="ctrls">
          <button onClick={() => officeRef.current?.addSession()}>+ session</button>
          <button onClick={() => officeRef.current?.testHand()}>❗ test hand</button>
          <button onClick={onTogglePause}>{paused ? "▶ resume" : "⏸ pause"}</button>
          <div className="seg">
            {[1, 2, 4].map((n) => (
              <button key={n} className={speed === n ? "on" : ""} onClick={() => onSetSpeed(n)}>{n}x</button>
            ))}
          </div>
        </div>
      )}
      {note && <span className="note">{note}</span>}
      <span className="spacer" />
      {(notifyPerm === "default" || notifyPerm === "granted") && (
        <button
          className={`bell${notifyOn && notifyPerm === "granted" ? " on" : ""}`}
          onClick={toggleNotify}
          aria-pressed={notifyOn && notifyPerm === "granted"}
          aria-label={notifyOn && notifyPerm === "granted" ? "ปิดแจ้งเตือน" : "เปิดแจ้งเตือน"}
          title={notifyOn && notifyPerm === "granted" ? "ปิดแจ้งเตือน" : "เปิดแจ้งเตือน"}
        >{notifyOn && notifyPerm === "granted" ? "🔔" : "🔕"}</button>
      )}
      <button onClick={onToggleFull} title="Fullscreen" aria-label="Fullscreen">{full ? "⤡" : "⤢"}</button>
      <button onClick={onToggleCollapsed} aria-expanded={!collapsed} title="ซ่อน/แสดงแผงกิลด์">{collapsed ? "◀ แสดงแผงกิลด์" : "ซ่อนแผงกิลด์ ▶"}</button>
    </header>
  );
}
