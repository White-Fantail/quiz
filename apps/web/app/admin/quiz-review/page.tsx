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
    <ManagementHeader eyebrow="QUIZDIP ADMIN · SAFETY" title={msg("Content reports and Kids reviews","콘텐츠 신고 및 Kids 심사")} description={msg("Review flagged quizzes and Kids requests, without approving ordinary publication.","일반 공개 승인 없이 이상 징후가 감지된 문제와 Kids 신청을 검토합니다.")}/>
    <QuizReviewConsole/>
  </main>;
}
