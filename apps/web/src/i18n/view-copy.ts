import type { Locale } from "./core";
/** Explicit bilingual UI copy, independent of quiz content locale. */
export function bilingual(locale:Locale,en:string,ko:string):string { return locale==="ko"?ko:en; }
