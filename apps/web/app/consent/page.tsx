import { resolveLocale,localizeHref } from "../../src/i18n/core";
import { bilingual } from "../../src/i18n/view-copy";
import ConsentActions from "./consent-actions";
import { headers } from "next/headers";
import Link from "next/link";
import { auth } from "../../src/lib/auth";
export const dynamic = "force-dynamic";

export default async function ConsentPage({ searchParams }: {
  searchParams: Promise<{ client_id?: string; scope?: string }>;
}) {
  const requestHeaders=await headers();
  const locale=resolveLocale(requestHeaders.get("x-quizdip-locale"));
  const msg=(en:string,ko:string)=>bilingual(locale,en,ko);
  const session = await auth.api.getSession({ headers: requestHeaders });
  const params = await searchParams;
  return <main className="container inner-page compact">
    <span className="small-tag">QuizDip Connect</span>
    <h1>{msg("Authorize QuizDip connection","QuizDip 연결 승인")}</h1>
    {!session ? <>
      <p>{msg("Sign in to approve this connection request.","로그인 후 연결 요청을 승인할 수 있어요.")}</p>
      <Link href={localizeHref("/sign-in",locale)} className="btn btn-primary">{msg("Sign in","로그인하기")}</Link>
    </> : <>
      <p><b>{session.user.name}</b>{msg(": allow an external AI app to access your QuizDip account?"," 계정으로 외부 AI 앱에 QuizDip 접근을 허용할까요?")}</p>
      <div className="placeholder-panel">
        <p>{msg("Requesting client: ","요청 클라이언트: ")}<code>{params.client_id || msg("Unknown app","확인되지 않은 앱")}</code></p>
        <p>{msg("Requested scopes: ","요청 권한: ")}<code>{params.scope || msg("Basic access","기본 접근")}</code></p>
        <p className="muted">{msg("Approving lets this app access your QuizDip quizzes, play history, and approved actions. Only authorize apps you trust.","허용하면 이 앱에서 내 QuizDip 문제·플레이 기록을 조회하거나 승인된 작업을 실행할 수 있어요. 신뢰하는 앱에만 허용해 주세요.")}</p>
        <ConsentActions />
      </div>
    </>}
  </main>;
}
