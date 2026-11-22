import { useEffect, useSyncExternalStore } from "react";

import { activateLocale, activeLocale, subscribeLocale } from "@/lib/i18n";
import { baseLocale, type Locale } from "@/paraglide/runtime";

/**
 * The viewer's locale, hydration-safe: Thai (the prerendered locale) during hydration, the real one right after.
 * Call it once at the top of the app; every component under it re-renders when the locale becomes known.
 */
export function useLocale(): Locale {
  const locale = useSyncExternalStore(subscribeLocale, activeLocale, () => baseLocale);
  useEffect(() => {
    activateLocale();
  }, []);
  return locale;
}
