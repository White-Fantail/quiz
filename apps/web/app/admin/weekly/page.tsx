import { headers } from "next/headers";
import { actorFor } from "../../../src/modules/platform/auth";
import WeeklyAdmin from "./weekly-admin";
export const dynamic="force-dynamic";
export default async function WeeklyAdminPage(){
  const headersList=await headers();
  const actor=await actorFor(new Request("http://localhost/admin/weekly",{headers:headersList}));
  if(!actor||actor.role!=="ADMIN")return <main className="container inner-page"><h1>접근 권한이 없어요.</h1></main>;
  return <main className="container inner-page">
    <span className="eyebrow">CLUPIO ADMIN · WEEKLY</span>
    <h1>주간 챌린지 편성</h1>
    <p>제작자 제안을 확인해 5문제와 순서를 고정한 뒤 확정해요. 일반·어린이 모드는 별도로 편성됩니다.</p>
    <p><a className="btn btn-outline" href="/admin/quiz-review">문제 및 어린이 안전성 심사 →</a></p>
    <WeeklyAdmin/>
  </main>;
}
