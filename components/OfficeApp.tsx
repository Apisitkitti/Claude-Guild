"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { EMPTY_VIEW, Office, type InternRow, type OfficeView, type RosterAct, type RosterRow, type WaitingRow } from "@/lib/office/engine";
import { charSprite } from "@/lib/office/sprites";
import { CLASS_LABEL, type Look } from "@/lib/office/palette";
import { connectLive } from "@/lib/office/live";
import { Simulator } from "@/lib/office/sim";
import { H, W } from "@/lib/office/layout";

type Mode = "live" | "demo";
type Conn = "connecting" | "connected" | "reconnecting";

const noopSub = () => () => {};
const forcedDemoNow = () => new URLSearchParams(window.location.search).has("demo");

const ACT_CHIP: Record<RosterAct, { cls: string; label: string }> = {
  typing: { cls: "c-magic", label: "✨ ร่ายเวท" },
  reading: { cls: "c-read", label: "📜 อ่านคัมภีร์" },
  bash: { cls: "c-combat", label: "⚔️ ต่อสู้" },
  handup: { cls: "c-seal pulse", label: "❗ ต้องการคุณ" },
  intern_handup: { cls: "c-seal pulse", label: "❗ ลูกมือต้องการ" },
  thinking: { cls: "c-grey", label: "ครุ่นคิด" },
  phone: { cls: "c-owl", label: "🦉 ส่งนกฮูก" },
  mcp: { cls: "c-portal", label: "🌀 พอร์ทัล" },
  sticky: { cls: "c-notes", label: "📝 จดบันทึก" },
  coffee: { cls: "c-tavern", label: "🍺 โรงเตี๊ยม" },
  stretch: { cls: "c-tavern", label: "บิดขี้เกียจ" },
  enter: { cls: "c-grey", label: "รับเควส" },
  leave: { cls: "c-grey", label: "กลับกิลด์" },
};

const EVT_ICON: Record<string, string> = {
  Read: "📖", Grep: "🔎", Glob: "🔎", LS: "📂", Edit: "✏️", Write: "✏️", MultiEdit: "✏️", NotebookEdit: "✏️",
  Bash: "💻", WebFetch: "🌐", WebSearch: "🌐", TodoWrite: "📝", TaskCreate: "📝", TaskUpdate: "📝",
  Agent: "🤖", Task: "🤖", Workflow: "🤖", SubagentStart: "🛡️", SubagentStop: "🛡️",
  Notification: "🔔", PermissionRequest: "❗", SessionStart: "📜", SessionEnd: "🏰", PreCompact: "🗜️", UserPromptSubmit: "💬", Stop: "⏹️",
};
const iconFor = (kind: string) => EVT_ICON[kind] ?? (kind.startsWith("mcp__") ? "🔌" : "•");
const pad2 = (n: number) => String(n).padStart(2, "0");
const hms = (t: number) => { const d = new Date(t); return `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`; };

const INTERN_CHIP: Record<InternRow["act"], { cls: string; label: string }> = {
  typing: { cls: "c-magic", label: "ร่ายเวท" },
  reading: { cls: "c-read", label: "อ่าน" },
  idle: { cls: "c-grey", label: "ว่าง" },
  handup: { cls: "c-seal pulse", label: "ต้องการคุณ ❗" },
};

// Optional RPG fields the engine may add; widened locally so this compiles before and after.
type RpgRow = RosterRow & { level?: number; xp?: number; xpNext?: number; gold?: number; kills?: number; hp?: number; hpMax?: number };
const isNum = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n);

const fmtTok = (n: number) => (n >= 1e6 ? `${+(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${Math.round(n / 1e3)}k` : String(n));

function Mana({ p }: { p: RpgRow }) {
  const { ctxUsed: used, ctxLimit: limit } = p;
  if (!isNum(used) || !isNum(limit) || limit <= 0) return null;
  const pct = Math.max(0, Math.min(100, Math.round((used / limit) * 100)));
  const lvl = pct > 90 ? " hot" : pct > 70 ? " warn" : "";
  const tip = `${fmtTok(used)} / ${fmtTok(limit)} tokens${p.ctxGuessed ? " (ประมาณ)" : ""}`;
  return (
    <div className="mana" title={tip}>
      <div className={`bar${lvl}`} role="progressbar" aria-label="Context" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-valuetext={`${pct}% ${tip}`}>
        <i style={{ width: `${pct}%` }} />
      </div>
      <span className="mpct">🔮 {p.ctxGuessed ? "≈" : ""}{pct}%</span>
    </div>
  );
}

function Stats({ p }: { p: RpgRow }) {
  const { xp, xpNext, hp, hpMax, gold, kills } = p;
  const showXp = isNum(xp) && isNum(xpNext) && xpNext > 0;
  const showHp = isNum(hp) && isNum(hpMax) && hpMax > 0;
  if (!showXp && !showHp && !isNum(gold) && !isNum(kills)) return null;
  const pct = showXp ? Math.max(0, Math.min(100, (xp / xpNext) * 100)) : 0;
  const maxHearts = showHp ? Math.min(hpMax, 10) : 0;
  const hearts = showHp ? Math.max(0, Math.min(hp, maxHearts)) : 0;
  return (
    <div className="stats">
      {showXp && (
        <div className="xp" role="progressbar" aria-label="XP" aria-valuemin={0} aria-valuemax={xpNext} aria-valuenow={Math.min(xp, xpNext)}>
          <i style={{ width: `${pct}%` }} />
        </div>
      )}
      <div className="srow">
        {showHp && (
          <span className="hearts" role="img" aria-label={`หัวใจ ${hp}/${hpMax}`}>
            {Array.from({ length: maxHearts }, (_, k) => (k < hearts ? "♥" : "♡")).join("")}
          </span>
        )}
        {isNum(gold) && <span className="sgold" title="ทอง">💰 {gold}</span>}
        {isNum(kills) && <span className="skills" title="มอนสเตอร์ที่ฆ่า">⚔️ {kills}</span>}
      </div>
    </div>
  );
}

function readJson(key: string): Record<string, boolean> {
  try { const v = JSON.parse(localStorage.getItem(key) ?? "{}"); return v && typeof v === "object" ? v : {}; } catch { return {}; }
}
function writeJson(key: string, v: Record<string, boolean>) {
  try { localStorage.setItem(key, JSON.stringify(v)); } catch {}
}

function InternList({ list }: { list: InternRow[] }) {
  return (
    <ul className="interns">
      {list.map((i) => {
        const chip = INTERN_CHIP[i.act] ?? INTERN_CHIP.idle;
        const detail = i.act === "idle" ? (i.detail ? `เพิ่งทำ: ${i.tool} ${i.detail}` : "") : `${i.tool} ${i.detail}`;
        return (
          <li key={i.id} className={i.failed ? "fail" : ""} title={detail.trim()}>
            <span aria-hidden>🛡️</span>
            <b>{i.label}</b>
            <span className={`chip ${chip.cls}`}>{chip.label}</span>
            <span className="idetail">{detail.trim()}</span>
            {i.count > 0 && <span className="icount" title="tool calls">×{i.count}</span>}
          </li>
        );
      })}
    </ul>
  );
}

function Avatar({ look }: { look: Look }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, 16, 14);
    ctx.drawImage(charSprite(look, "idle", 0), 0, 0, 16, 14, 0, 0, 16, 14);
  }, [look]);
  return <canvas ref={ref} className="avatar" width={16} height={14} />;
}

export default function OfficeApp() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const headRef = useRef<HTMLElement>(null);
  const officeRef = useRef<Office | null>(null);

  const mounted = useSyncExternalStore(noopSub, () => true, () => false);
  const speedRef = useRef(1);
  const forcedDemo = useSyncExternalStore(noopSub, forcedDemoNow, () => false);
  const [chosen, setChosen] = useState<Mode | null>(null);
  const mode: Mode = chosen ?? (forcedDemo ? "demo" : "live");
  const [conn, setConn] = useState<Conn>("connecting");
  const [note, setNote] = useState("");
  const [view, setView] = useState<OfficeView>(EMPTY_VIEW);
  const [speed, setSpeed] = useState(1);
  const [paused, setPaused] = useState(false);
  const [scale, setScale] = useState(2);
  const [collapsed, setCollapsed] = useState(false);
  const [full, setFull] = useState(false);
  const appRef = useRef<HTMLDivElement>(null);
  const [internHidden, setInternHidden] = useState<Record<string, boolean>>({});
  const [secHidden, setSecHidden] = useState<Record<string, boolean>>({});
  const [lvFlash, setLvFlash] = useState<Record<string, boolean>>({});
  const [bump, setBump] = useState(false);
  const [fq, setFq] = useState("");
  const [fStray, setFStray] = useState(false);
  const prevLv = useRef<Map<string, number>>(new Map());
  const prevTreasury = useRef<number | undefined>(undefined);

  // Level-up flash per card + treasury bump (brief CSS class toggles)
  useEffect(() => {
    const up: string[] = [];
    const seen = new Set<string>();
    for (const r of view.roster) {
      const lv = (r as RpgRow).level;
      seen.add(r.id);
      if (!isNum(lv)) continue;
      const old = prevLv.current.get(r.id);
      if (old !== undefined && lv > old) up.push(r.id);
      prevLv.current.set(r.id, lv);
    }
    for (const id of [...prevLv.current.keys()]) if (!seen.has(id)) prevLv.current.delete(id);
    if (!up.length) return;
    const t = setTimeout(() => {
      setLvFlash((m) => { const n = { ...m }; for (const id of up) n[id] = true; return n; });
      setTimeout(() => setLvFlash((m) => { const n = { ...m }; for (const id of up) delete n[id]; return n; }), 1200);
    }, 0);
    return () => clearTimeout(t);
  }, [view.roster]);
  const treasury = (view as OfficeView & { treasury?: number }).treasury;
  useEffect(() => {
    const old = prevTreasury.current;
    prevTreasury.current = treasury;
    if (!isNum(treasury) || old === undefined || treasury <= old) return;
    const a = setTimeout(() => setBump(true), 0);
    const b = setTimeout(() => setBump(false), 400);
    return () => { clearTimeout(a); clearTimeout(b); };
  }, [treasury]);

  useEffect(() => {
    queueMicrotask(() => {
      try { if (localStorage.getItem("office.panelCollapsed") === "1") setCollapsed(true); } catch {}
      setInternHidden(readJson("office.internsHidden"));
      setSecHidden(readJson("office.sectionsHidden"));
    });
    const onFs = () => setFull(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);
  const [notifyPerm, setNotifyPerm] = useState<NotificationPermission | "unsupported">("unsupported");
  const [notifyOn, setNotifyOn] = useState(false);
  const notifyOnRef = useRef(false);
  const prevWaiting = useRef<Set<string>>(new Set());
  const lastNotified = useRef<Map<string, number>>(new Map());
  const baseTitle = useRef<string | null>(null);

  useEffect(() => {
    baseTitle.current = document.title;
    queueMicrotask(() => {
      if (typeof Notification === "undefined") return;
      setNotifyPerm(Notification.permission);
      try { if (localStorage.getItem("guild.notify") === "1") setNotifyOn(true); } catch {}
    });
    return () => { if (baseTitle.current !== null) document.title = baseTitle.current; };
  }, []);
  useEffect(() => { notifyOnRef.current = notifyOn && notifyPerm === "granted"; }, [notifyOn, notifyPerm]);
  const saveNotify = (on: boolean) => { try { localStorage.setItem("guild.notify", on ? "1" : "0"); } catch {} };
  const toggleNotify = async () => {
    if (typeof Notification === "undefined") return;
    if (notifyOn && Notification.permission === "granted") { setNotifyOn(false); saveNotify(false); return; }
    try {
      const perm = Notification.permission === "default" ? await Notification.requestPermission() : Notification.permission;
      setNotifyPerm(perm);
      const on = perm === "granted";
      setNotifyOn(on);
      saveNotify(on);
    } catch {}
  };

  // Tab title + desktop notification when adventurers wait on the user (Live only)
  const waiting = useMemo(() => (mode === "live" ? view.waiting ?? [] : []), [view.waiting, mode]);
  const waitingN = waiting.length;
  const hiddenSet = useMemo(() => new Set(view.hiddenIds ?? []), [view.hiddenIds]);
  useEffect(() => {
    if (baseTitle.current === null) return;
    document.title = waitingN > 0 ? `❗(${waitingN}) Claude Guild ⚔️` : baseTitle.current;
  }, [waitingN]);
  useEffect(() => {
    const cur = new Set<string>();
    const fresh: WaitingRow[] = [];
    for (const r of waiting) {
      cur.add(r.id);
      if (!prevWaiting.current.has(r.id)) fresh.push(r);
    }
    prevWaiting.current = cur;
    for (const id of [...lastNotified.current.keys()]) if (!view.roster.some((r) => r.id === id) && !(view.hiddenIds ?? []).includes(id)) lastNotified.current.delete(id);
    if (!fresh.length || !notifyOnRef.current || typeof Notification === "undefined") return;
    if (!document.hidden && document.hasFocus()) return;
    const now = Date.now();
    for (const r of fresh) {
      const last = lastNotified.current.get(r.id);
      if (last !== undefined && now - last < 30000) continue;
      lastNotified.current.set(r.id, now);
      try {
        const n = new Notification(`❗ ${r.project || r.tag} ต้องการคุณ`, {
          body: `${r.tag}${r.status ? `: ${r.status}` : ""}`,
          tag: `guild-${r.id}`,
        });
        n.onclick = () => {
          window.focus();
          const off = officeRef.current;
          if (off?.isHidden(off.employees.get(r.id))) {
            // relax the query filter so the session is visible, then select it
            setFq("");
            off.setFilter({ query: "" });
            try { localStorage.setItem("guild.filter", JSON.stringify({ query: "", hideStray: off.getFilter().hideStray })); } catch {}
          }
          off?.select(r.id);
          n.close();
        };
      } catch {}
    }
  }, [waiting, view.roster, view.hiddenIds]);

  const toggleCollapsed = () => {
    setCollapsed((c) => {
      try { localStorage.setItem("office.panelCollapsed", c ? "0" : "1"); } catch {}
      return !c;
    });
  };
  const toggleIntern = (id: string) => {
    setInternHidden((m) => { const n = { ...m, [id]: !m[id] }; writeJson("office.internsHidden", n); return n; });
  };
  const toggleSec = (k: string) => {
    setSecHidden((m) => { const n = { ...m, [k]: !m[k] }; writeJson("office.sectionsHidden", n); return n; });
  };
  const toggleFull = () => {
    try {
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
      else appRef.current?.requestFullscreen().catch(() => {});
    } catch {}
  };

  // session filter: restore once, push to the engine, persist
  useEffect(() => {
    const t = setTimeout(() => {
      try {
        const j = JSON.parse(localStorage.getItem("guild.filter") ?? "null");
        if (j && typeof j === "object") {
          if (typeof j.query === "string") setFq(j.query.slice(0, 80));
          if (j.hideStray === true) setFStray(true);
        }
      } catch {}
    }, 0);
    return () => clearTimeout(t);
  }, []);
  useEffect(() => {
    officeRef.current?.setFilter({ query: fq, hideStray: fStray });
  }, [fq, fStray, mounted]);
  const saveFilter = (query: string, hideStray: boolean) => {
    setFq(query); setFStray(hideStray);
    try { localStorage.setItem("guild.filter", JSON.stringify({ query, hideStray })); } catch {}
  };

  // Guild engine (once)
  useEffect(() => {
    const o = new Office(canvasRef.current!);
    officeRef.current = o;
    o.subscribe(setView);
    o.start();
    return () => { o.stop(); officeRef.current = null; };
  }, []);

  // Data source per mode
  useEffect(() => {
    const o = officeRef.current;
    if (!o || !mounted) return;
    o.clear();
    if (mode === "demo") {
      o.setSpeed(speedRef.current);
      o.attachSim(new Simulator(o));
      return () => o.attachSim(null);
    }
    o.setSpeed(1);
    let opened = false;
    let errored = false;
    const live = connectLive({
      onSnapshot: (s) => o.loadSnapshot(s),
      onEvent: (e) => o.event(e),
      onContext: (m) => { if (m && typeof m.session_id === "string") o.setContext(m.session_id, m.used, m.limit, !!m.limitGuessed); },
      onStatus: (s) => {
        if (s === "open") { opened = true; setConn("connected"); } else { errored = true; setConn(opened ? "reconnecting" : "connecting"); }
      },
    });
    const fallback = () => {
      if (opened) return;
      live.close();
      setNote("เชื่อมต่อ /events/stream ไม่ได้ — สลับเป็น Demo");
      setChosen("demo");
    };
    // fall back on error after 3s; if the first request is still pending, wait longer (dev compile)
    const t1 = setTimeout(() => { if (errored) fallback(); }, 3000);
    const t2 = setTimeout(fallback, 8000);
    return () => { clearTimeout(t1); clearTimeout(t2); live.close(); };
  }, [mode, mounted]);

  // Crisp backing store: scale * devicePixelRatio device px per logical px
  const [dpr, setDpr] = useState(1);
  useEffect(() => {
    // Moving to a monitor with a different DPR doesn't always fire resize, so also watch the resolution query.
    let mq: MediaQueryList | null = null;
    const upd = () => {
      const r = window.devicePixelRatio || 1;
      setDpr(r);
      mq?.removeEventListener("change", upd);
      mq = window.matchMedia(`(resolution: ${r}dppx)`);
      mq.addEventListener("change", upd);
    };
    upd();
    window.addEventListener("resize", upd);
    return () => { window.removeEventListener("resize", upd); mq?.removeEventListener("change", upd); };
  }, []);
  useEffect(() => { officeRef.current?.setPixelScale(scale * dpr); }, [scale, dpr]);

  // Scale fitting: snap so scale * devicePixelRatio is a whole number of device px per logical px
  // (crisp pixel art, but 0.5 steps on retina instead of wasting space with integer-only scale).
  useEffect(() => {
    const calc = () => {
      const st = stageRef.current;
      if (!st) return;
      const cs = getComputedStyle(st);
      const px = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight);
      const py = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom);
      const FRAME = 24; // frame border + padding on both sides
      const availW = st.clientWidth - px - FRAME;
      const availH = st.clientHeight - py - FRAME;
      const ratio = window.devicePixelRatio || 1;
      const fit = Math.min(availW / W, availH / H);
      setScale(Math.max(1 / ratio, Math.floor(fit * ratio) / ratio));
    };
    const ro = new ResizeObserver(calc);
    ro.observe(stageRef.current!);
    window.addEventListener("resize", calc);
    calc();
    return () => { ro.disconnect(); window.removeEventListener("resize", calc); };
  }, []);

  const toLogical = (ev: React.MouseEvent<HTMLCanvasElement>) => {
    const c = ev.currentTarget;
    const r = c.getBoundingClientRect();
    return {
      x: ((ev.clientX - r.left - c.clientLeft) * W) / c.clientWidth,
      y: ((ev.clientY - r.top - c.clientTop) * H) / c.clientHeight,
    };
  };

  const switchMode = (m: Mode) => {
    if (m === mode) return;
    setNote("");
    setConn("connecting");
    setPaused(false);
    officeRef.current?.setPaused(false);
    setChosen(m);
  };

  const pill =
    mode === "demo" ? { cls: "demo", text: "demo" }
    : conn === "connected" ? { cls: "ok", text: "connected" }
    : { cls: "warn", text: conn === "reconnecting" ? "reconnecting" : "connecting" };

  const setSpeedBoth = useCallback((n: number) => { setSpeed(n); speedRef.current = n; officeRef.current?.setSpeed(n); }, []);

  return (
    <div className={`app${collapsed ? " collapsed" : ""}`} ref={appRef}>
      <header className="bar" ref={headRef}>
        <h1><span className="logo" aria-hidden>⚔️</span> Claude Guild</h1>
        <div className="seg" role="group" aria-label="mode">
          <button className={mode === "live" ? "on" : ""} onClick={() => switchMode("live")}>Live</button>
          <button className={mode === "demo" ? "on" : ""} onClick={() => switchMode("demo")}>Demo</button>
        </div>
        <span className={`pill ${pill.cls}`}><i />{pill.text}</span>
        {isNum(treasury) && <span className={`pill treasury${bump ? " bump" : ""}`} title="ทองสะสมของกิลด์">💰 คลังกิลด์ <b>{treasury}</b></span>}
        {mode === "demo" && (
          <div className="ctrls">
            <button onClick={() => officeRef.current?.addSession()}>+ session</button>
            <button onClick={() => officeRef.current?.testHand()}>❗ test hand</button>
            <button onClick={() => { const p = !paused; setPaused(p); officeRef.current?.setPaused(p); }}>{paused ? "▶ resume" : "⏸ pause"}</button>
            <div className="seg">
              {[1, 2, 4].map((n) => (
                <button key={n} className={speed === n ? "on" : ""} onClick={() => setSpeedBoth(n)}>{n}x</button>
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
        <button onClick={toggleFull} title="Fullscreen" aria-label="Fullscreen">{full ? "⤡" : "⤢"}</button>
        <button onClick={toggleCollapsed} aria-expanded={!collapsed} title="ซ่อน/แสดงแผงกิลด์">{collapsed ? "◀ แสดงแผงกิลด์" : "ซ่อนแผงกิลด์ ▶"}</button>
      </header>
      <div className="main">
        <div className="stage" ref={stageRef}>
          <div className="frame">
            <canvas
              ref={canvasRef}
              role="img"
              aria-label="Pixel-art guild: each Claude Code session is an adventurer on a quest"
              style={{ width: W * scale, height: H * scale }}
              onMouseMove={(ev) => { const p = toLogical(ev); officeRef.current?.setHover(officeRef.current.hit(p.x, p.y)); }}
              onMouseLeave={() => officeRef.current?.setHover(null)}
            />
          </div>
        </div>
        <aside className="panel" hidden={collapsed}>
          <h2>
            <button className="sec" onClick={() => toggleSec("roster")} aria-expanded={!secHidden.roster} aria-controls="sec-roster">
              {secHidden.roster ? "▸" : "▾"} นักผจญภัย <small>({view.roster.length})</small>
            </button>
          </h2>
          <div className="gfilter">
            <input
              type="search"
              value={fq}
              onChange={(e) => saveFilter(e.target.value, fStray)}
              placeholder="กรองโปรเจกต์"
              aria-label="กรองโปรเจกต์"
              maxLength={80}
            />
            <label>
              <input type="checkbox" checked={fStray} onChange={(e) => saveFilter(fq, e.target.checked)} />
              ซ่อน session ที่ไม่ได้เริ่มที่นี่
            </label>
            {(view.hiddenCount ?? 0) > 0 && <small className="hid" role="status">(ซ่อน {view.hiddenCount})</small>}
          </div>
          <ul className="roster" id="sec-roster" hidden={!!secHidden.roster}>
            {view.roster.length === 0 && <li className="empty">ยังไม่มีนักผจญภัย — เปิด Claude Code เพื่อรับเควส</li>}
            {view.roster.map((r) => {
              const chip = ACT_CHIP[r.act] ?? ACT_CHIP.thinking;
              const p = r as RpgRow;
              return (
                <li
                  key={r.id}
                  className={`card${r.id === view.hoverId || r.id === view.selectedId ? " hl" : ""}${lvFlash[r.id] ? " lvup" : ""}`}
                  style={{ borderLeftColor: r.color }}
                >
                  <button
                    type="button"
                    className="csel"
                    onClick={() => officeRef.current?.select(r.id)}
                    aria-pressed={r.id === view.selectedId}
                    aria-label={`${r.tag} ${r.project}: ${r.status}`}
                    title={r.status}
                  >
                    <Avatar look={r.look} />
                    <span className="who">
                      <b>{r.tag}{r.look.cls ? <span className="cls">{CLASS_LABEL[r.look.cls]}</span> : null}{isNum(p.level) ? <span className="lv">Lv.{p.level}</span> : null}</b>
                      <span className="proj">{r.project}</span>
                    </span>
                    <span className={`chip ${chip.cls}`}>{chip.label}</span>
                  </button>
                  <Stats p={p} />
                  <Mana p={p} />
                  {r.interns > 0 && (
                    <button
                      className="itoggle"
                      aria-expanded={!internHidden[r.id]}
                      aria-label={`ลูกมือ ${r.interns}`}
                      title="ซ่อน/แสดงลูกมือ"
                      onClick={() => toggleIntern(r.id)}
                    >
                      {internHidden[r.id] ? "▸" : "▾"} ลูกมือ {r.interns}
                    </button>
                  )}
                  {r.interns > 0 && !internHidden[r.id] && <InternList list={r.internList} />}
                </li>
              );
            })}
          </ul>
          <h2>
            <button className="sec" onClick={() => toggleSec("log")} aria-expanded={!secHidden.log} aria-controls="sec-log">
              {secHidden.log ? "▸" : "▾"} บันทึกเควส
            </button>
          </h2>
          <ul className="log" id="sec-log" hidden={!!secHidden.log}>
            {view.log.filter((l) => !l.sid || !hiddenSet.has(l.sid)).map((l) => (
              <li key={l.id} className={`${l.bad ? "bad " : ""}${l.intern ? "intern" : ""}`} title={l.text}>
                <time>{hms(l.time)}</time>
                <span className="dot" style={{ background: l.color }} />
                <span className="ic">{iconFor(l.kind)}</span>
                <span className="tx"><b>{l.tag}</b>{l.intern ? <span className="ilab"> 🛡️ {l.internLabel} ›</span> : null} {l.kind}{l.detail ? <em> {l.detail}</em> : null}</span>
              </li>
            ))}
          </ul>
        </aside>
      </div>
    </div>
  );
}
