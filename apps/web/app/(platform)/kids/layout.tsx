import Link from "next/link";
import { redirect } from "next/navigation";
import { currentKidDevice } from "../../../src/modules/kids/service";
import { hasKidCookie } from "../../../src/modules/kids/credentials";
import { localizeHref } from "../../../src/i18n/core";
import { headers } from "next/headers";
import { resolveLocale } from "../../../src/i18n/core";
import { t } from "../../../src/i18n/messages";
import LanguageSwitcher from "../../../src/i18n/language-switcher";
import { KIDS_TABS, kidsHref } from "../../../src/modules/kids/navigation";
import "./kids.css";

export default async function KidsLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const requestHeaders = await headers();
  const locale = resolveLocale(requestHeaders.get("x-quizdip-locale"));
  const currentPath = requestHeaders.get("x-quizdip-path") ?? "/kids";
  const isGuardianArea = currentPath === "/kids/parent";
  const isExit = currentPath === "/kids/exit";
  const cookiePresent = hasKidCookie(requestHeaders.get("cookie"));
  const device = cookiePresent ? await currentKidDevice(requestHeaders) : null;
  if (cookiePresent && isGuardianArea) redirect(localizeHref("/kids/exit",locale));
  if (cookiePresent && !device && !isExit) redirect(localizeHref("/kids/exit",locale));
  if (!cookiePresent && !isGuardianArea) redirect(localizeHref("/kids/parent",locale));
  if (device && !isGuardianArea && !isExit && device.profile.locale !== locale)
    redirect(localizeHref(currentPath,resolveLocale(device.profile.locale)));
  return (
    <div className="kids-shell">
      <a className="kids-skip" href="#kids-content">{t(locale, "kids.skip")}</a>
      <header className="kids-header">
        <Link className="kids-wordmark" href={kidsHref("/kids", locale)}
          aria-label={t(locale, "kids.brand")}>
          <span aria-hidden="true">✦</span> QuizDip <strong>Kids</strong>
        </Link>
        {cookiePresent ?
          (!isExit && <Link className="kids-parent-link" href={localizeHref("/kids/exit",locale)}>
            🔒 {t(locale,"kids.guardian.exit")}
          </Link>) : <LanguageSwitcher />}
      </header>
      <main className="kids-main" id="kids-content">
        {children}
      </main>
      {!isGuardianArea && !isExit && <nav className="kids-tabbar" aria-label={t(locale, "kids.navigation")}>
        {KIDS_TABS.map(tab => (
          <Link key={tab.path} className="kids-tab" href={kidsHref(tab.path, locale)}
            aria-current={currentPath === tab.path ? "page" : undefined}>
            <span className="kids-tab-emoji" aria-hidden="true">{tab.emoji}</span>
            <span>{t(locale, tab.key)}</span>
          </Link>
        ))}
      </nav>}
      <footer className="kids-footer">
        <span>QuizDip Kids</span>
        <span>{t(locale, "kids.safety")}</span>
      </footer>
    </div>
  );
}
