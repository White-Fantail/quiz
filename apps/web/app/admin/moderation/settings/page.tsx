import Link from "next/link";
import {headers} from "next/headers";
import {notFound,redirect} from "next/navigation";
import ManagementHeader from "../../../../src/components/management-header";
import {resolveLocale,localizeHref} from "../../../../src/i18n/core";
import {bilingual} from "../../../../src/i18n/view-copy";
import {actorFor} from "../../../../src/modules/platform/auth";
import ModerationPolicySettings from "../policy-settings";

export const dynamic="force-dynamic";

/** The settings page is admin-only; server API rechecks ADMIN for read and write. */
export default async function ModerationSettingsPage(){
  const requestHeaders=await headers();
  const locale=resolveLocale(requestHeaders.get("x-quizdip-locale"));
  const msg=(en:string,ko:string)=>bilingual(locale,en,ko);
  const actor=await actorFor(new Request("http://localhost/admin/moderation/settings",{headers:requestHeaders}));
  if(!actor)redirect(localizeHref("/sign-in?callbackURL=%2Fadmin%2Fmoderation%2Fsettings",locale));
  if(actor.role!=="ADMIN"||actor.childScope)notFound();
  return <main className="container inner-page management-page">
    <ManagementHeader eyebrow="QUIZDIP ADMIN · TRUST & SAFETY"
      title={msg("Automatic hold settings","신고 자동 보류 설정")}
      description={msg(
        "Configure report thresholds and account-age safeguards independently of the moderation queue.",
        "신고 임계치와 계정 가입 기간 조건을 설정합니다. 일상적인 신고 심사 화면과 분리되어 있어요."
      )}
      actions={<Link href={localizeHref("/admin/moderation",locale)} className="btn btn-outline">
        {msg("← Back to moderation","← 신고 관리로 돌아가기")}
      </Link>}/>
    <ModerationPolicySettings/>
  </main>;
}
