"use client";
import { useState } from "react";
import { LOCALE_COOKIE, localizeHref, type Locale } from "./core";
import { useLocale, useTranslation } from "./provider";

/** Locale changes persist for guests via cookie; signed-in accounts via shared REST/MCP service. */
export default function LanguageSwitcher() {
  const locale = useLocale();
  const t = useTranslation();
  const [switching, setSwitching] = useState(false);
  async function switchTo(next: Locale) {
    if (next === locale || switching) return;
    setSwitching(true);
    document.cookie = LOCALE_COOKIE + "=" + next + "; Path=/; Max-Age=31536000; SameSite=Lax";
    // The authenticated preference endpoint may be unavailable for guests or unconfigured DBs.
    try {
      const controller = new AbortController();
      const timer = window.setTimeout(() => controller.abort(), 1500);
      try {
        await fetch("/api/v1/me/locale", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({ locale: next }),
          signal: controller.signal
        });
      } finally { window.clearTimeout(timer); }
    } catch { /* Guest cookie is sufficient. */ }
    const target = localizeHref(location.pathname, next) + location.search + location.hash;
    location.assign(target);
  }
  return <label className="language-selector">
    <span>{t("common.language")}</span>
    <select aria-label={t("common.language")} value={locale} disabled={switching}
      onChange={event => void switchTo(event.target.value as Locale)}>
      <option value="en">English</option>
      <option value="ko">한국어</option>
    </select>
  </label>;
}
