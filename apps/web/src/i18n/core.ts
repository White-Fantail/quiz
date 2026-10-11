/** User-facing locales; BCP-47 tags, independent of content classification ('und'). */
export const LOCALES = ["en", "ko"] as const;
export type Locale = typeof LOCALES[number];
export const DEFAULT_LOCALE: Locale = "en";
export const LOCALE_COOKIE = "quizdip-locale";

export function isLocale(value: unknown): value is Locale {
  return value === "en" || value === "ko";
}
export function resolveLocale(value: unknown): Locale {
  return isLocale(value) ? value : DEFAULT_LOCALE;
}
export function localeFromPath(pathname: string): Locale | null {
  const first = pathname.split("/")[1];
  return isLocale(first) ? first : null;
}
export function stripLocale(pathname: string): string {
  const locale = localeFromPath(pathname);
  if (!locale) return pathname;
  const stripped = pathname.slice(locale.length + 1);
  return stripped || "/";
}
/** URL navigation helper: never prefix API, auth callback or static asset URLs. */
export function localizeHref(href: string, locale: Locale): string {
  if (!href.startsWith("/") || href.startsWith("//")) return href;
  const [pathname, suffix = ""] = [href.split(/[?#]/)[0], href.slice(href.split(/[?#]/)[0].length)];
  if (pathname.startsWith("/api/") || pathname === "/api" ||
      pathname.startsWith("/_next/") || pathname.startsWith("/.well-known/") ||
      /\.[a-z0-9]+$/i.test(pathname)) return href;
  const path = stripLocale(pathname);
  return "/" + locale + (path === "/" ? "" : path) + suffix;
}
export function localeFromAcceptLanguage(header: string | null): Locale {
  const entries = (header ?? "").split(",").map(entry => {
    const [tag, ...parameters] = entry.trim().split(";");
    const q = parameters.find(p => p.trim().startsWith("q="));
    const weight = q ? Number(q.trim().slice(2)) : 1;
    return { tag: tag.toLowerCase(), weight: Number.isFinite(weight) ? weight : 0 };
  }).sort((a, b) => b.weight - a.weight);
  for (const entry of entries) {
    if (entry.weight <= 0) continue;
    const lang = entry.tag.split("-")[0];
    if (isLocale(lang)) return lang;
  }
  return DEFAULT_LOCALE;
}
