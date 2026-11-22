import { useEffect, useRef, useState, type RefObject } from "react";

import { MS_PER_SECOND } from "@/lib/constants";
import type { ConflictRow, OfficeView, WaitingRow } from "@/lib/office/engine";
import { m } from "@/paraglide/messages";

import type { Mode, OfficeRef } from "../types";

const CLASH_PREFIX = "clash|";
const NOTIFY_COOLDOWN_SECONDS = 30;

export type Notify = { perm: NotificationPermission | "unsupported"; on: boolean; toggle: () => void };

/** Desktop notifications for waiting adventurers (Live only) and new clashes, with a persisted opt-in. */
export const useNotifications = ({
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
}): Notify => {
  const [perm, setPerm] = useState<NotificationPermission | "unsupported">("unsupported");
  const [on, setOn] = useState(false);
  const onRef = useRef(false);
  const prevWaiting = useRef<Set<string>>(new Set());
  const lastNotified = useRef<Map<string, number>>(new Map());

  const saveNotify = (enabled: boolean) => {
    try {
      localStorage.setItem("guild.notify", enabled ? "1" : "0");
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
      const result =
        Notification.permission === "default" ? await Notification.requestPermission() : Notification.permission;
      setPerm(result);
      const next = result === "granted";
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
    const current = new Set(clashes.map((conflict) => conflict.key));
    prevClashRef.current = current;
    for (const key of [...lastNotified.current.keys()])
      if (key.startsWith(CLASH_PREFIX) && !current.has(key.slice(CLASH_PREFIX.length)))
        lastNotified.current.delete(key);
    const fresh = clashes.filter((conflict) => !prev.has(conflict.key));
    if (!fresh.length || !onRef.current || typeof Notification === "undefined" || !document.hidden) return;
    const now = Date.now();
    for (const conflict of fresh.slice(0, 2)) {
      const last = lastNotified.current.get(CLASH_PREFIX + conflict.key);
      if (last !== undefined && now - last < NOTIFY_COOLDOWN_SECONDS * MS_PER_SECOND) continue;
      lastNotified.current.set(CLASH_PREFIX + conflict.key, now);
      try {
        const notification = new Notification(m.notify_clash_title({ file: conflict.file }), {
          body: conflict.names.join(" vs "),
          tag: `guild-clash-${conflict.key}`,
        });
        notification.onclick = () => {
          window.focus();
          officeRef.current?.select(conflict.sids[0]);
          notification.close();
        };
      } catch {}
    }
  }, [clashes, mode, prevClashRef, officeRef]);

  useEffect(() => {
    const current = new Set<string>();
    const fresh: WaitingRow[] = [];
    for (const row of waiting) {
      current.add(row.id);
      if (!prevWaiting.current.has(row.id)) fresh.push(row);
    }
    prevWaiting.current = current;
    for (const id of [...lastNotified.current.keys()])
      if (
        !id.startsWith(CLASH_PREFIX) &&
        !view.roster.some((row) => row.id === id) &&
        !(view.hiddenIds ?? []).includes(id)
      )
        lastNotified.current.delete(id);
    if (!fresh.length || !onRef.current || typeof Notification === "undefined") return;
    if (!document.hidden && document.hasFocus()) return;
    const now = Date.now();
    for (const row of fresh) {
      const last = lastNotified.current.get(row.id);
      if (last !== undefined && now - last < NOTIFY_COOLDOWN_SECONDS * MS_PER_SECOND) continue;
      lastNotified.current.set(row.id, now);
      try {
        const notification = new Notification(m.notify_waiting_title({ project: row.project || row.tag }), {
          body: `${row.tag}${row.status ? `: ${row.status}` : ""}`,
          tag: `guild-${row.id}`,
        });
        notification.onclick = () => {
          window.focus();
          revealSelect(row.id);
          notification.close();
        };
      } catch {}
    }
  }, [waiting, view.roster, view.hiddenIds, revealSelect]);

  return { perm, on, toggle };
};
