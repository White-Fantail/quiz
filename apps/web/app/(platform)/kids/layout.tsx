import Link from "next/link";
import { headers } from "next/headers";
import { resolveLocale } from "../../../src/i18n/core";
import { t } from "../../../src/i18n/messages";
import LanguageSwitcher from "../../../src/i18n/language-switcher";
import { KIDS_TABS, kidsHref } from "../../../src/modules/kids/navigation";
import "./kids.css";

export default async function KidsLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const locale = resolveLocale((await headers()).get("x-quizdip-locale"));
  return (
    <div className="kids-shell">
      <a className="kids-skip" href="#kids-content">{t(locale, "kids.skip")}</a>
      <header className="kids-header">
        <Link className="kids-wordmark" href={kidsHref("/kids", locale)}
          aria-label={t(locale, "kids.brand")}>
          <span aria-hidden="true">✦</span> QuizDip <strong>Kids</strong>
        </Link>
        <LanguageSwitcher />
      </header>
      <main className="kids-main" id="kids-content">
        {children}
      </main>
      <nav className="kids-tabbar" aria-label={t(locale, "kids.navigation")}>
        {KIDS_TABS.map(tab => (
          <Link key={tab.path} className="kids-tab" href={kidsHref(tab.path, locale)}>
            <span className="kids-tab-emoji" aria-hidden="true">{tab.emoji}</span>
            <span>{t(locale, tab.key)}</span>
          </Link>
        ))}
      </nav>
      <footer className="kids-footer">
        <span>QuizDip Kids</span>
        <span>{t(locale, "kids.safety")}</span>
      </footer>
    </div>
  );
}
