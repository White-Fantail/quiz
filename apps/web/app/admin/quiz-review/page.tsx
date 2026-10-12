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
    <ManagementHeader eyebrow="QUIZDIP ADMIN · SAFETY" title={msg("Safety review queue","안전성 심사")} description={msg("Find a published quiz and open its dedicated review page.","게시된 문제를 찾아 별도의 상세 심사 화면에서 확인하세요.")}/>
    <QuizReviewConsole/>
  </main>;
}
