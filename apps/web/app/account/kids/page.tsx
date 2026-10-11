import Link from "next/link";
import { headers } from "next/headers";
import { auth } from "../../../src/lib/auth";
import { localizeHref, resolveLocale } from "../../../src/i18n/core";
import { t } from "../../../src/i18n/messages";
import KidsFamilySettings from "./family-settings";

export const dynamic="force-dynamic";
/** Adult-account family setup, not a web Kids mode. Mobile children never authenticate here. */
export default async function FamilySettingsPage(){
 const requestHeaders=await headers();
 const locale=resolveLocale(requestHeaders.get("x-quizdip-locale"));
 let signedIn=false,unavailable=false;
 try {signedIn=!!(await auth.api.getSession({headers:requestHeaders}))?.user?.id;}
 catch{unavailable=true;}
 return <main className="container inner-page">
   <span className="small-tag">QuizDip Account</span>
   <h1>{t(locale,"kids.guardian.title")}</h1>
   <p className="muted">{t(locale,"kids.native.pairHelp")}</p>
   {unavailable?<p role="alert" className="feedback">{t(locale,"account.unavailable")}</p>:
    !signedIn?<div className="placeholder-panel">
     <p>{t(locale,"kids.guardian.signin")}</p>
     <Link className="btn btn-primary"
       href={localizeHref("/sign-in?callbackURL=%2Faccount%2Fkids",locale)}>
       {t(locale,"kids.guardian.signinAction")}
     </Link>
    </div>:<KidsFamilySettings/>}
   <p style={{marginTop:32}}>
     <Link className="text-button" href={localizeHref("/account",locale)}>{t(locale,"account.home")}</Link>
   </p>
 </main>;
}
