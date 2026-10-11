import Link from "next/link";
import { headers } from "next/headers";
import { auth } from "../../../../src/lib/auth";
import { resolveLocale, localizeHref } from "../../../../src/i18n/core";
import { t } from "../../../../src/i18n/messages";
import GuardianPanel from "./guardian-panel";
export const dynamic = "force-dynamic";
export default async function GuardianPage() {
  const locale=resolveLocale((await headers()).get("x-quizdip-locale"));
  let signedIn=false;
  try { signedIn=!!(await auth.api.getSession({headers:await headers()}))?.user?.id; }
  catch { /* A broken auth service must not unlock guardian controls. */ }
  return <section className="kids-section kids-inner kids-guardian">
    <span className="kids-eyebrow">{t(locale,"kids.guardian.header")}</span>
    <h1>{t(locale,"kids.guardian.title")}</h1>
    <p className="kids-lead">{t(locale,"kids.guardian.lead")}</p>
    {!signedIn ? <div className="kids-notice">
      <p>{t(locale,"kids.guardian.signin")}</p>
      <Link className="kids-action" href={localizeHref("/sign-in?callbackURL=%2Fkids%2Fparent",locale)}>
        {t(locale,"kids.guardian.signinAction")}
      </Link>
    </div> : <GuardianPanel/>}
  </section>;
}
