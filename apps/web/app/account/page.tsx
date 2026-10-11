import Link from "next/link";
import { headers } from "next/headers";
import { availableProviders } from "../../src/lib/auth-providers";
import SignInActions from "../sign-in/sign-in-actions";
import AccountActions from "./account-actions";

export const dynamic = "force-dynamic";

/** A broken auth service is not the same thing as a logged-out visitor. */
async function resolveSession() {
  try {
    // Dynamic import also catches auth initialization/configuration failures.
    const { auth } = await import("../../src/lib/auth");
    return { session: await auth.api.getSession({ headers: await headers() }), unavailable: false };
  } catch (error) {
    console.error("[account] Unable to resolve Better Auth session", error);
    return { session: null, unavailable: true };
  }
}

export default async function AccountPage() {
  const { session, unavailable } = await resolveSession();
  if (unavailable) {
    return <main className="container inner-page compact">
      <h1>내 계정</h1>
      <p role="alert" className="feedback">계정 정보를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.</p>
      <p className="muted">문제가 계속되면 서비스 관리자에게 알려 주세요. 로그인 상태나 계정 정보는 변경되지 않았어요.</p>
      <a className="btn btn-outline" href="/account">다시 시도하기</a>
    </main>;
  }
  if (!session) {
    return <main className="container inner-page compact">
      <h1>내 계정</h1>
      <p>Google 계정으로 로그인하면 내 퀴즈와 플레이 기록, MCP 연결을 한곳에서 관리할 수 있어요.</p>
      <div className="placeholder-panel">
        <SignInActions google={availableProviders.google} apple={availableProviders.apple} returnTo="/account" />
      </div>
      <p className="muted">계정에 로그인한 뒤 다른 로그인 수단을 연결할 수 있어요.</p>
      <Link className="text-button" href="/">홈으로 돌아가기</Link>
    </main>;
  }

  // The administrator link is convenience only; /admin and its APIs check roles independently.
  let isAdmin = false;
  try {
    const { actorByIdentity } = await import("../../src/modules/platform/auth");
    isAdmin = (await actorByIdentity(session.user.id)).role === "ADMIN";
  } catch (error) {
    console.error("[account] Could not resolve platform role", error);
  }

  return <main className="container inner-page compact">
    <span className="small-tag">My QuizDip</span>
    <h1>내 계정</h1>
    <p>안녕하세요, <b>{session.user.name}</b>!</p>
    <p className="muted">웹사이트와 MCP는 동일한 QuizDip 사용자 ID를 사용해요. 추가 로그인 수단은 직접 연결할 수 있어요.</p>
    {isAdmin && <div className="actions">
      <Link href="/admin" className="btn btn-primary">관리자 대시보드</Link>
    </div>}
    <div className="placeholder-panel">
      <h2>연결된 로그인 수단</h2>
      <AccountActions google={availableProviders.google} apple={availableProviders.apple} />
    </div>
    <p className="muted">보안을 위해 같은 이메일이라는 이유만으로 다른 로그인 계정을 자동 병합하지 않아요. 이 화면에서 직접 연결해야 해요.</p>
  </main>;
}
