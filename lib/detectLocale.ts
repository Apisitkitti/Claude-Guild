import { baseLocale, extractLocaleFromCookie, isLocale, type Locale } from "@/paraglide/runtime";

/** Thai when the stored choice or the browser's first language is Thai; English for everything else. */
export const pickLocale = (stored: string | undefined, languages: readonly string[]): Locale => {
  if (stored !== undefined && isLocale(stored)) return stored;
  const first = languages[0]?.toLowerCase() ?? "";
  return first === baseLocale || first.startsWith(`${baseLocale}-`) ? baseLocale : "en";
};

/**
 * The viewer's locale: the cookie written by the header toggle, else the browser language.
 * Read-only on purpose: Paraglide's own resolver would persist the browser language into the cookie on the first
 * visit and freeze it; only the explicit toggle may write the cookie.
 */
export const detectLocale = (): Locale =>
  pickLocale(extractLocaleFromCookie(), typeof navigator === "undefined" ? [] : navigator.languages);
