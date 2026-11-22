import { detectLocale } from "@/lib/detectLocale";
import { baseLocale, overwriteGetLocale, type Locale } from "@/paraglide/runtime";

// Client-side locale gate. `/` is prerendered in the base locale (Thai), so React must hydrate in Thai too; only
// after hydration do messages switch to the viewer's locale (cookie, else the browser's first language: Thai if Thai, English otherwise).
// Until `activateLocale()` runs, every `m.*()` call (server or client) answers in the base locale.

const listeners = new Set<() => void>();
let ready = false;
let current: Locale = baseLocale;

overwriteGetLocale(() => (ready ? current : baseLocale));

export const subscribeLocale = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
export const isLocaleActive = () => ready;
export const activeLocale = (): Locale => (ready ? current : baseLocale);

/** Resolve the viewer's locale once, tell subscribers, and put it on `<html lang>`. Browser only; idempotent. */
export const activateLocale = () => {
  if (ready) return;
  current = detectLocale();
  ready = true;
  document.documentElement.lang = current;
  for (const listener of listeners) listener();
};
