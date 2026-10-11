import ConsentActions from "./consent-actions";
import { headers } from "next/headers";
import Link from "next/link";
import { auth } from "../../src/lib/auth";
export const dynamic = "force-dynamic";

export default async function ConsentPage({ searchParams }: {
  searchParams: Promise<{ client_id?: string; scope?: string }>;
}) {
  const session = await auth.api.getSession({ headers: await headers() });
  const params = await searchParams;
  return <main className="container inner-page compact">
    <span className="small-tag">Clupio Connect</span>
    <h1>Clupio 연결 승인</h1>
    {!session ? <>
      <p>로그인 후 연결 요청을 승인할 수 있어요.</p>
      <Link href="/sign-in" className="btn btn-primary">로그인하기</Link>
    </> : <>
      <p><b>{session.user.name}</b> 계정으로 외부 AI 앱에 Clupio 접근을 허용할까요?</p>
      <div className="placeholder-panel">
        <p>요청 클라이언트: <code>{params.client_id || "확인되지 않은 앱"}</code></p>
        <p>요청 권한: <code>{params.scope || "기본 접근"}</code></p>
        <p className="muted">허용하면 이 앱에서 내 Clupio 문제·플레이 기록을 조회하거나 승인된 작업을 실행할 수 있어요. 신뢰하는 앱에만 허용해 주세요.</p>
        <ConsentActions />
      </div>
    </>}
  </main>;
}
