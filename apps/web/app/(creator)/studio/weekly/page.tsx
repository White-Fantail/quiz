import ManagementHeader from "../../../../src/components/management-header";
import { resolveLocale,localizeHref } from "../../../../src/i18n/core";
import { bilingual } from "../../../../src/i18n/view-copy";
import Link from "next/link";
import { headers } from "next/headers";
import { auth } from "../../../../src/lib/auth";
import WeeklyEditor from "./weekly-editor";
export const dynamic = "force-dynamic";

export default async function CreatorWeeklyPage() {
  const requestHeaders=await headers();
  const locale=resolveLocale(requestHeaders.get("x-quizdip-locale"));
  const msg=(en:string,ko:string)=>bilingual(locale,en,ko);
  const session=await auth.api.getSession({headers:requestHeaders});
  return <main className="container inner-page management-page">
    <ManagementHeader eyebrow="QUIZDIP STUDIO · WEEKLY CREATOR" title={msg("Become a weekly challenge host","이번 주의 출제자가 되어 보세요")} description={msg("Choose five quizzes you created and submit them for next week's challenge. Once approved, everyone plays them in the same order.","직접 만든 5문제를 골라 다음 주 챌린지로 제안하세요. 공식 선정되면 모두가 같은 순서로 문제를 풀게 돼요.")}/>
    {!session?<div className="placeholder-panel">
      <p>{msg("Sign in before submitting your weekly quiz proposal.","출제자 제안을 제출하려면 먼저 로그인해야 해요.")}</p>
      <Link className="btn btn-primary" href={localizeHref("/sign-in?callbackURL=%2Fstudio%2Fweekly",locale)}>{msg("Sign in","로그인하기")}</Link>
    </div>:<WeeklyEditor/>}
  </main>;
}
