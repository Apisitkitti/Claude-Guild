import { overwriteGetLocale } from "@/paraglide/runtime";

// Messages follow the browser's language by default; tests assert the base locale (Thai) unless they pass `{ locale }`.
overwriteGetLocale(() => "th");
