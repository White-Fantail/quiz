import {headers} from "next/headers";
import {notFound,redirect} from "next/navigation";
import ManagementHeader from "../../../../src/components/management-header";
import {resolveLocale,localizeHref} from "../../../../src/i18n/core";
import {bilingual} from "../../../../src/i18n/view-copy";
import {actorFor} from "../../../../src/modules/platform/auth";
import QuizReviewDetail from "../review-detail";

export const dynamic="force-dynamic";
export default async function QuizReviewDetailPage({params}:{params:Promise<{id:string}>}){
  const {id}=await params;
  const h=await headers();
  const locale=resolveLocale(h.get("x-quizdip-locale"));
  const msg=(en:string,ko:string)=>bilingual(locale,en,ko);
  const actor=await actorFor(new Request("http://localhost/admin/quiz-review/"+id,{headers:h}));
  if(!actor)redirect(localizeHref("/sign-in?callbackURL=%2Fadmin%2Fquiz-review",locale));
  if(actor.role!=="ADMIN")notFound();
  return <main className="container inner-page management-page review-detail-page">
    <ManagementHeader eyebrow="QUIZDIP ADMIN · SAFETY"
      title={msg("Review quiz","문제 상세 심사")}
      description={msg("Review reported issues or a creator-submitted Kids request, then save a decision.","신고된 문제 또는 제작자의 Kids 신청을 확인한 뒤 심사 결과를 저장하세요.")}/>
    <QuizReviewDetail id={id}/>
  </main>;
}
