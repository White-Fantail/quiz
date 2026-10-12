import ManagementHeader from "../../../src/components/management-header";
import { resolveLocale,localizeHref } from "../../../src/i18n/core";
import { bilingual } from "../../../src/i18n/view-copy";
import { headers } from "next/headers";
import { actorFor } from "../../../src/modules/platform/auth";
import QuizReviewConsole from "./review-console";
export const dynamic="force-dynamic";
export default async function QuizReviewPage(){
  const requestHeaders=await headers();
  const locale=resolveLocale(requestHeaders.get("x-quizdip-locale"));
  const msg=(en:string,ko:string)=>bilingual(locale,en,ko);
  const actor=await actorFor(new Request("http://localhost/admin/quiz-review",{headers:requestHeaders}));
  if(!actor||actor.role!=="ADMIN")return <main className="container inner-page management-page"><h1>{msg("Access denied.","접근 권한이 없어요.")}</h1></main>;
  return <main className="container inner-page management-page">
    <ManagementHeader eyebrow="QUIZDIP ADMIN · SAFETY" title={msg("Quiz and child safety review","문제 및 어린이 안전성 심사")} description={msg("Review published quizzes and their media, then independently assess general and child safety eligibility.","공개 문제와 사용된 이미지·음원을 실제로 확인하고, 일반용 또는 어린이용 안전 여부를 독립적으로 승인해요.")}/>
    <QuizReviewConsole/>
  </main>;
}
