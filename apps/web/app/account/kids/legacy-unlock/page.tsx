import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { resolveLocale,localizeHref } from "../../../../src/i18n/core";
import { hasKidCookie } from "../../../../src/modules/kids/credentials";
import LegacyUnlockForm from "./legacy-unlock-form";

export const dynamic="force-dynamic";
/** No child web game survives the cutover. This is a PIN-only safety exit for old locked browsers. */
export default async function LegacyUnlockPage(){
 const requestHeaders=await headers();
 const locale=resolveLocale(requestHeaders.get("x-quizdip-locale"));
 if(!hasKidCookie(requestHeaders.get("cookie")))
   redirect(localizeHref("/account/kids",locale));
 return <main className="container inner-page compact management-page" id="legacy-kid-exit">
   <h1>{locale==="ko"?"QuizDip Kids 앱으로 이전했어요":"QuizDip Kids is now an app"}</h1>
   <p>{locale==="ko"?
     "웹 Kids 게임은 종료되었어요. 이 기기에서 일반 QuizDip에 다시 접근하려면 보호자 PIN으로 기존 키즈 잠금을 해제해야 해요.":
     "The Kids web game has been retired. A parent must enter the existing PIN to unlock this browser before returning to the regular QuizDip site."}</p>
   <LegacyUnlockForm/>
 </main>;
}
