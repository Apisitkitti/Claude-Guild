import { useEffect, useRef, useState, type RefObject } from "react";

import { MS_PER_SECOND } from "@/lib/constants";
import type { ConflictRow, OfficeView, WaitingRow } from "@/lib/office/engine";

import type { Mode, OfficeRef } from "../types";

const CLASH_PREFIX = "clash|";
const NOTIFY_COOLDOWN_SECONDS = 30;

export type Notify = { perm: NotificationPermission | "unsupported"; on: boolean; toggle: () => void };

/** Desktop notifications for waiting adventurers (Live only) and new clashes, with a persisted opt-in. */
export function useNotifications({
  officeRef,
  mode,
  view,
  waiting,
  clashes,
  prevClashRef,
  revealSelect,
}: {
  officeRef: OfficeRef;
  mode: Mode;
  view: OfficeView;
  waiting: WaitingRow[];
  clashes: ConflictRow[];
  /** null until the first live snapshot has been applied (baseline); reset whenever the data source changes */
  prevClashRef: RefObject<Set<string> | null>;
  revealSelect: (id: string) => void;
}): Notify {
  const [perm, setPerm] = useState<NotificationPermission | "unsupported">("unsupported");
  const [on, setOn] = useState(false);
  const onRef = useRef(false);
  const prevWaiting = useRef<Set<string>>(new Set());
  const lastNotified = useRef<Map<string, number>>(new Map());

  const saveNotify = (v: boolean) => {
    try {
      localStorage.setItem("guild.notify", v ? "1" : "0");
    } catch {}
  };
  const toggle = async () => {
    if (typeof Notification === "undefined") return;
    if (on && Notification.permission === "granted") {
      setOn(false);
      saveNotify(false);
      return;
    }
    try {
      const p =
        Notification.permission === "default" ? await Notification.requestPermission() : Notification.permission;
      setPerm(p);
      const next = p === "granted";
      setOn(next);
      saveNotify(next);
    } catch {}
  };

  useEffect(() => {
    queueMicrotask(() => {
      if (typeof Notification === "undefined") return;
      setPerm(Notification.permission);
      try {
        if (localStorage.getItem("guild.notify") === "1") setOn(true);
      } catch {}
    });
  }, []);
  useEffect(() => {
    onRef.current = on && perm === "granted";
  }, [on, perm]);
  useEffect(() => {
    if (mode !== "live") {
      prevClashRef.current = null;
      return;
    }
    const prev = prevClashRef.current;
    if (prev === null) return; // no baseline yet: pre-existing clashes never notify
    const cur = new Set(clashes.map((c) => c.key));
    prevClashRef.current = cur;
    for (const k of [...lastNotified.current.keys()])
      if (k.startsWith(CLASH_PREFIX) && !cur.has(k.slice(CLASH_PREFIX.length))) lastNotified.current.delete(k);
    const fresh = clashes.filter((c) => !prev.has(c.key));
    if (!fresh.length || !onRef.current || typeof Notification === "undefined" || !document.hidden) return;
    const now = Date.now();
    for (const c of fresh.slice(0, 2)) {
      const last = lastNotified.current.get(CLASH_PREFIX + c.key);
      if (last !== undefined && now - last < NOTIFY_COOLDOWN_SECONDS * MS_PER_SECOND) continue;
      lastNotified.current.set(CLASH_PREFIX + c.key, now);
      try {
        const n = new Notification(`⚔️ ชนกัน! ${c.file}`, { body: c.names.join(" vs "), tag: `guild-clash-${c.key}` });
        n.onclick = () => {
          window.focus();
          officeRef.current?.select(c.sids[0]);
          n.close();
        };
      } catch {}
    }
  }, [clashes, mode, prevClashRef, officeRef]);

  useEffect(() => {
    const cur = new Set<string>();
    const fresh: WaitingRow[] = [];
    for (const r of waiting) {
      cur.add(r.id);
      if (!prevWaiting.current.has(r.id)) fresh.push(r);
    }
    prevWaiting.current = cur;
    for (const id of [...lastNotified.current.keys()])
      if (!id.startsWith(CLASH_PREFIX) && !view.roster.some((r) => r.id === id) && !(view.hiddenIds ?? []).includes(id))
        lastNotified.current.delete(id);
    if (!fresh.length || !onRef.current || typeof Notification === "undefined") return;
    if (!document.hidden && document.hasFocus()) return;
    const now = Date.now();
    for (const r of fresh) {
      const last = lastNotified.current.get(r.id);
      if (last !== undefined && now - last < NOTIFY_COOLDOWN_SECONDS * MS_PER_SECOND) continue;
      lastNotified.current.set(r.id, now);
      try {
        const n = new Notification(`❗ ${r.project || r.tag} ต้องการคุณ`, {
          body: `${r.tag}${r.status ? `: ${r.status}` : ""}`,
          tag: `guild-${r.id}`,
        });
        n.onclick = () => {
          window.focus();
          revealSelect(r.id);
          n.close();
        };
      } catch {}
    }
  }, [waiting, view.roster, view.hiddenIds, revealSelect]);

  return { perm, on, toggle };
}
