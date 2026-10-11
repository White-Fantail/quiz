import Link from "next/link";
import { headers } from "next/headers";
import { auth, availableProviders } from "../../src/lib/auth";
import AccountActions from "./account-actions";

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return <main className="container inner-page compact">
      <h1>내 계정</h1>
      <p>Google 또는 Apple로 로그인하면 내 문제, 기록, MCP 연결이 같은 계정에 저장돼요.</p>
      <Link className="btn btn-primary" href="/sign-in">로그인하기</Link>
    </main>;
  }
  return <main className="container inner-page compact">
    <span className="small-tag">My Clupio</span>
    <h1>내 계정</h1>
    <p>안녕하세요, <b>{session.user.name}</b>!</p>
    <p className="muted">웹사이트와 MCP는 동일한 Clupio 사용자 ID를 사용해요. Google과 Apple은 하나의 계정에 연결해서 사용할 수 있어요.</p>
    <div className="placeholder-panel">
      <h2>연결된 로그인 수단</h2>
      <AccountActions google={availableProviders.google} apple={availableProviders.apple} />
    </div>
    <p className="muted">보안을 위해 같은 이메일이라는 이유만으로 다른 로그인 계정을 자동 병합하지 않아요. 이 화면에서 직접 연결해야 해요.</p>
  </main>;
}
