import Link from "next/link";
import { headers } from "next/headers";
import { localizeHref, resolveLocale } from "../../../src/i18n/core";
import { t } from "../../../src/i18n/messages";
import LanguageSwitcher from "../../../src/i18n/language-switcher";

export default async function AccountSettingsPage() {
  const locale = resolveLocale((await headers()).get("x-quizdip-locale"));
  return <main className="container inner-page compact account-settings">
    <span className="small-tag">QuizDip</span>
    <h1>{t(locale,"account.settings")}</h1>
    <div className="placeholder-panel">
      <h2>{t(locale,"common.language")}</h2>
      <p className="muted">{t(locale,"account.languageHelp")}</p>
      <LanguageSwitcher />
    </div>
    <div className="placeholder-panel">
      <h2>{t(locale,"kids.guardian.language")}</h2>
      <p className="muted">{t(locale,"account.kidsLanguageHelp")}</p>
      <Link className="text-button" href={localizeHref("/account/kids",locale)}>{t(locale,"kids.guardian.title")} →</Link>
    </div>
    <p style={{marginTop:28}}>
      <Link className="text-button" href={localizeHref("/account",locale)}>{t(locale,"account.title")} →</Link>
    </p>
  </main>;
}
