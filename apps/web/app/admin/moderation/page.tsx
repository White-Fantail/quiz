import ManagementHeader from "../../../src/components/management-header";
import { resolveLocale } from "../../../src/i18n/core";
import { bilingual } from "../../../src/i18n/view-copy";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { actorFor } from "../../../src/modules/platform/auth";
import { localizeHref } from "../../../src/i18n/core";
import ModerationConsole from "./moderation-console";
export const dynamic="force-dynamic";

/** Restricted at the page and operation boundaries. */
export default async function ModerationPage(){
  const requestHeaders=await headers();
  const locale=resolveLocale(requestHeaders.get("x-quizdip-locale"));
  const actor=await actorFor(new Request("http://localhost/admin/moderation",{headers:requestHeaders}));
  if(!actor)redirect(localizeHref("/sign-in?callbackURL=%2Fadmin%2Fmoderation",locale));
  if(actor.role!=="ADMIN")notFound();
  return <main className="container inner-page management-page">
    <ManagementHeader eyebrow="QUIZDIP ADMIN · TRUST & SAFETY"
      title={bilingual(locale,"Report moderation","신고 및 게시 제한 관리")}
      description={bilingual(locale,
        "Review held and reported content, handle appeals, and manage abusive publishing accounts. Automatic hold rules are in Settings.",
        "보류 및 신고 콘텐츠를 심사하고, 이의신청과 제작자의 게시 제한을 관리합니다. 자동 보류 기준은 별도 설정 화면에서 변경합니다.")}/>
    <ModerationConsole/>
  </main>;
}
