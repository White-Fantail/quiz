import { headers } from "next/headers";
import { actorFor } from "../../../src/modules/platform/auth";
import QuizReviewConsole from "./review-console";
export const dynamic="force-dynamic";
export default async function QuizReviewPage(){
  const actor=await actorFor(new Request("http://localhost/admin/quiz-review",{headers:await headers()}));
  if(!actor||actor.role!=="ADMIN")return <main className="container inner-page"><h1>접근 권한이 없어요.</h1></main>;
  return <main className="container inner-page">
    <span className="eyebrow">CLUPIO ADMIN · SAFETY</span>
    <h1>문제 및 어린이 안전성 심사</h1>
    <p>공개 문제와 사용된 이미지·음원을 실제로 확인하고, 일반용 또는 어린이용 안전 여부를 독립적으로 승인해요.</p>
    <QuizReviewConsole/>
  </main>;
}
