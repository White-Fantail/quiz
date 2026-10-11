import Link from "next/link";
import { headers } from "next/headers";
import { auth } from "../../../../src/lib/auth";
import WeeklyEditor from "./weekly-editor";
export const dynamic = "force-dynamic";

export default async function CreatorWeeklyPage() {
  const session=await auth.api.getSession({headers:await headers()});
  return <main className="container inner-page">
    <span className="eyebrow">QUIZDIP STUDIO · WEEKLY CREATOR</span>
    <h1>이번 주의 출제자가 되어 보세요</h1>
    <p className="lead">직접 만든 5문제를 골라 다음 주 챌린지로 제안하세요. 공식 선정되면 모두가 같은 순서로 문제를 풀게 돼요.</p>
    {!session?<div className="placeholder-panel">
      <p>출제자 제안을 제출하려면 먼저 로그인해야 해요.</p>
      <Link className="btn btn-primary" href="/sign-in?callbackURL=%2Fstudio%2Fweekly">로그인하기</Link>
    </div>:<WeeklyEditor/>}
  </main>;
}
