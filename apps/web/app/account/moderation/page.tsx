import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { actorFor } from "../../../src/modules/platform/auth";
import { resolveLocale, localizeHref } from "../../../src/i18n/core";
import ModerationInbox from "./moderation-inbox";
export const dynamic="force-dynamic";
export default async function CreatorModerationPage(){
  const requestHeaders=await headers();
  const locale=resolveLocale(requestHeaders.get("x-quizdip-locale"));
  const actor=await actorFor(new Request("http://localhost/account/moderation",{headers:requestHeaders}));
  if(!actor)redirect(localizeHref("/sign-in?callbackURL=%2Faccount%2Fmoderation",locale));
  if(actor.childScope)notFound();
  return <main className="container inner-page compact management-page">
    <h1>{locale==="ko"?"콘텐츠 신고 및 이의신청":"Moderation and appeals"}</h1>
    <p className="muted">{locale==="ko"?"신고·심사·게시 제한 알림을 확인하고 필요한 경우 이의신청할 수 있어요. 신고자 신원은 공개되지 않습니다.":"Review private moderation notifications and appeal decisions. Reporter identities are never shown."}</p>
    <ModerationInbox/>
  </main>;
}
