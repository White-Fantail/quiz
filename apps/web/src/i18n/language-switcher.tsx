"use client";
import { useState } from "react";
import { LOCALE_COOKIE, localizeHref, type Locale } from "./core";
import { useLocale, useTranslation } from "./provider";

/** Locale changes persist for guests via cookie; signed-in accounts via shared REST/MCP service. */
export default function LanguageSwitcher({ compact = false }: { compact?: boolean } = {}) {
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
  const selector = <select aria-label={t("common.language")} value={locale} disabled={switching}
    onChange={event => void switchTo(event.target.value as Locale)}>
    <option value="en">English</option>
    <option value="ko">한국어</option>
  </select>;
  if (compact) {
    return <label className="header-language-selector" title={t("common.language")}>
      <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10Z" />
      </svg>
      <span aria-hidden="true">{locale === "ko" ? "한국어" : "EN"}</span>
      <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="m6 9 6 6 6-6" />
      </svg>
      {selector}
    </label>;
  }
  return <label className="language-selector">
    <span>{t("common.language")}</span>
    {selector}
  </label>;
}
