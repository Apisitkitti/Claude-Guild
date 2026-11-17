import { vi } from "vitest";
import { Office, type Employee, type HookEvt } from "@/lib/office/engine";

const noop = () => {};
export function makeCanvas(): HTMLCanvasElement {
  const ctx = new Proxy({}, {
    get: (t: Record<string, unknown>, k: string) => (k in t ? t[k] : noop),
    set: (t: Record<string, unknown>, k: string, v: unknown) => { t[k] = v; return true; },
  });
  return { width: 384, height: 216, getContext: () => ctx } as unknown as HTMLCanvasElement;
}

export function stubStorage(initial: Record<string, string> = {}) {
  const m = new Map<string, string>(Object.entries(initial));
  const ls = {
    getItem: (k: string) => (m.has(k) ? m.get(k)! : null),
    setItem: vi.fn((k: string, v: string) => { m.set(k, String(v)); }),
    removeItem: (k: string) => { m.delete(k); },
    clear: () => m.clear(),
  };
  vi.stubGlobal("localStorage", ls);
  return { m, ls };
}

export const PROGRESS_KEY = "guild.progress.v1";

export function tick(o: Office, sec: number, step = 0.05) {
  let t = 0;
  while (t < sec - 1e-9) { const d = Math.min(step, sec - t); o.update(d); t += d; }
}

let n = 0;
export const sid = (prefix = "s") => `${prefix}${(n++).toString().padStart(3, "0")}-abcdef`;

export function ev(session_id: string, hook_event_name: string, extra: Partial<HookEvt> = {}): HookEvt {
  return { session_id, hook_event_name, cwd: "/work/proj", ...extra };
}

export function emp(o: Office, id: string): Employee {
  const e = o.employees.get(id);
  if (!e) throw new Error("no employee " + id);
  return e;
}

/** start a session and tick until it is seated */
export function seat(o: Office, id: string, extra: Partial<HookEvt> = {}): Employee {
  o.event(ev(id, "SessionStart", extra));
  for (let i = 0; i < 400 && emp(o, id).state !== "SEATED"; i++) tick(o, 0.25);
  const e = emp(o, id);
  if (e.state !== "SEATED") throw new Error("never seated");
  // let the fresh monster pass its 0.3s spawn grace
  tick(o, 0.5);
  return e;
}

export function newOffice(): Office { return new Office(makeCanvas()); }

/** deterministic Math.random: constant value */
export function fixedRandom(v: number) { return vi.spyOn(Math, "random").mockReturnValue(v); }
