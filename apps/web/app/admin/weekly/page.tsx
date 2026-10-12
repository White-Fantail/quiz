import ManagementHeader from "../../../src/components/management-header";
import { resolveLocale,localizeHref } from "../../../src/i18n/core";
import { bilingual } from "../../../src/i18n/view-copy";
import { headers } from "next/headers";
import { actorFor } from "../../../src/modules/platform/auth";
import WeeklyAdmin from "./weekly-admin";
export const dynamic="force-dynamic";
export default async function WeeklyAdminPage(){
  const headersList=await headers();
  const locale=resolveLocale(headersList.get("x-quizdip-locale"));
  const msg=(en:string,ko:string)=>bilingual(locale,en,ko);
  const actor=await actorFor(new Request("http://localhost/admin/weekly",{headers:headersList}));
  if(!actor||actor.role!=="ADMIN")return <main className="container inner-page management-page"><h1>{msg("Access denied.","접근 권한이 없어요.")}</h1></main>;
  return <main className="container inner-page management-page">
    <ManagementHeader eyebrow="QUIZDIP ADMIN · WEEKLY" title={msg("Schedule weekly challenge","주간 챌린지 편성")} description={msg("Review creator proposals, freeze the five questions and their order, then schedule the challenge. General and Kids editions are managed separately.","제작자 제안을 확인해 5문제와 순서를 고정한 뒤 확정해요. 일반·어린이 모드는 별도로 편성됩니다.")}/>
    <p><a className="btn btn-outline" href={localizeHref("/admin/quiz-review",locale)}>{msg("Quiz and child safety review →","문제 및 어린이 안전성 심사 →")}</a></p>
    <WeeklyAdmin/>
  </main>;
}
