import { availableProviders } from "../../src/lib/auth";
import SignInActions from "./sign-in-actions";

export const dynamic = "force-dynamic";
export default async function SignInPage({ searchParams }: {
  searchParams: Promise<{ callbackURL?: string; redirect?: string }>;
}) {
  const params = await searchParams;
  const requested = params.callbackURL || params.redirect || "/account";
  // Only same-site paths may be used after sign-in.
  const returnTo = requested.startsWith("/") && !requested.startsWith("//") ? requested : "/account";
  return (
    <main className="container inner-page compact">
      <span className="small-tag">QuizDip Account</span>
      <h1>QuizDip에 로그인</h1>
      <p className="muted">Google 또는 Apple 계정으로 로그인하면 웹사이트와 ChatGPT MCP에서 같은 QuizDip 계정을 이용할 수 있어요.</p>
      <div className="placeholder-panel">
        <SignInActions google={availableProviders.google} apple={availableProviders.apple} returnTo={returnTo} />
        <p className="muted">처음 로그인하면 QuizDip 계정이 만들어져요. 서로 다른 로그인 수단을 연결할 때는 먼저 로그인한 뒤 <b>내 계정</b>에서 명시적으로 연결해 주세요.</p>
      </div>
    </main>
  );
}
