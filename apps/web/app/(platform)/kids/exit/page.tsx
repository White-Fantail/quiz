import { headers } from "next/headers";
import { resolveLocale } from "../../../../src/i18n/core";
import { t } from "../../../../src/i18n/messages";
import KidsExitForm from "./kids-exit-form";
export const dynamic="force-dynamic";
export default async function KidsExitPage(){
  const locale=resolveLocale((await headers()).get("x-quizdip-locale"));
  return <section className="kids-section kids-inner kids-exit">
    <span className="kids-big-emoji" aria-hidden="true">🔒</span>
    <h1>{t(locale,"kids.exit.title")}</h1>
    <p>{t(locale,"kids.exit.lead")}</p>
    <KidsExitForm/>
  </section>;
}
