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
        "Adjust report thresholds, review held content, and restrict abusive publishing accounts. No AI decisions.",
        "신고 임계치를 변경하고 보류된 콘텐츠를 검토하며 악성 게시자의 공개 권한을 제한합니다. AI 자동 판정은 사용하지 않습니다.")}/>
    <ModerationConsole/>
  </main>;
}
