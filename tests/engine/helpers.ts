import { vi } from "vitest";

import { Office, type Employee, type HookEvt } from "@/lib/office/engine";

const noop = () => {};
export const makeCanvas = (): HTMLCanvasElement => {
  const ctx = new Proxy(
    {},
    {
      get: (target: Record<string, unknown>, k: string) => (k in target ? target[k] : noop),
      set: (target: Record<string, unknown>, k: string, value: unknown) => {
        target[k] = value;
        return true;
      },
    },
  );
  return { width: 384, height: 216, getContext: () => ctx } as unknown as HTMLCanvasElement;
};

export const stubStorage = (initial: Record<string, string> = {}) => {
  const store = new Map<string, string>(Object.entries(initial));
  const ls = {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: vi.fn((k: string, value: string) => {
      store.set(k, String(value));
    }),
    removeItem: (k: string) => {
      store.delete(k);
    },
    clear: () => store.clear(),
  };
  vi.stubGlobal("localStorage", ls);
  return { m: store, ls };
};

export const PROGRESS_KEY = "guild.progress.v1";

export const tick = (office: Office, sec: number, step = 0.05) => {
  let elapsed = 0;
  while (elapsed < sec - 1e-9) {
    const delta = Math.min(step, sec - elapsed);
    office.update(delta);
    elapsed += delta;
  }
};

let counter = 0;
export const sid = (prefix = "s") => `${prefix}${(counter++).toString().padStart(3, "0")}-abcdef`;

export const ev = (session_id: string, hook_event_name: string, extra: Partial<HookEvt> = {}): HookEvt => {
  return { session_id, hook_event_name, cwd: "/work/proj", ...extra };
};

export const emp = (office: Office, id: string): Employee => {
  const employee = office.employees.get(id);
  if (!employee) throw new Error("no employee " + id);
  return employee;
};

/** start a session and tick until it is seated */
export const seat = (office: Office, id: string, extra: Partial<HookEvt> = {}): Employee => {
  office.event(ev(id, "SessionStart", extra));
  for (let i = 0; i < 400 && emp(office, id).state !== "SEATED"; i++) tick(office, 0.25);
  const employee = emp(office, id);
  if (employee.state !== "SEATED") throw new Error("never seated");
  // let the fresh monster pass its 0.3s spawn grace
  tick(office, 0.5);
  return employee;
};

export const newOffice = (): Office => {
  return new Office(makeCanvas());
};

/** deterministic Math.random: constant value */
export const fixedRandom = (value: number) => {
  return vi.spyOn(Math, "random").mockReturnValue(value);
};
