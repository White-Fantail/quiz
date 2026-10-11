import { localizeHref, type Locale } from "../../i18n/core";

/** The child-facing shell only navigates between its own routes. */
export const KIDS_TABS = [
  { path: "/kids", key: "kids.nav.home", emoji: "🏠" },
  { path: "/kids/explore", key: "kids.nav.explore", emoji: "🧭" },
  { path: "/kids/challenge", key: "kids.nav.challenge", emoji: "🧩" },
  { path: "/kids/treasures", key: "kids.nav.treasures", emoji: "⭐" },
] as const;

export type KidsRoute = (typeof KIDS_TABS)[number]["path"];

export function isKidsPath(path: string): boolean {
  return path === "/kids" || path.startsWith("/kids/");
}

/** Intentionally excludes /play, /discover, /studio and account routes. */
export function kidsHref(path: KidsRoute, locale: Locale): string {
  if (!KIDS_TABS.some(tab => tab.path === path)) throw new Error("Invalid Kids destination");
  return localizeHref(path, locale);
}
