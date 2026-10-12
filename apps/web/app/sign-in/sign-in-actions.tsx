"use client";

import { useState } from "react";
import { useLocale } from "../../src/i18n/provider";
import { bilingual } from "../../src/i18n/view-copy";
import { authClient } from "../../src/lib/auth-client";

export default function SignInActions({ google, apple, returnTo }: {
  google: boolean; apple: boolean; returnTo: string;
}) {
  const locale=useLocale();
  const msg=(en:string,ko:string)=>bilingual(locale,en,ko);
  const [busy, setBusy] = useState<"google" | "apple" | null>(null);
  const [error, setError] = useState("");
  async function signIn(provider: "google" | "apple") {
    if (!(provider === "google" ? google : apple)) return;
    setBusy(provider);
    setError("");
    try {
      const response = await authClient.signIn.social({ provider, callbackURL: returnTo });
      if (response.error) setError(response.error.message || msg("Sign in failed.","로그인에 실패했어요."));
    } catch {
      setError(msg("Couldn't start sign in. Please try again.","로그인을 시작할 수 없어요. 잠시 후 다시 시도해 주세요."));
    } finally {
      setBusy(null);
    }
  }
  return (
    <div className="social-actions">
      <button type="button" className="btn btn-outline" onClick={() => void signIn("google")} disabled={!google || busy !== null}>
        {msg("Continue with Google","Google 계정으로 계속하기")}{!google ? msg(" (setup required)"," (설정 필요)") : ""}
      </button>
      <button type="button" className="btn btn-outline" onClick={() => void signIn("apple")} disabled={!apple || busy !== null}>
        {msg("Continue with Apple","Apple 계정으로 계속하기")}{!apple ? msg(" (coming soon)"," (준비 중)") : ""}
      </button>
      {!google && <p role="status" className="muted">{msg("Google sign-in requires the administrator to finish OAuth configuration.","Google 로그인을 사용하려면 서비스 관리자가 OAuth 설정을 완료해야 해요.")}</p>}
      {error && <p role="alert" className="feedback">{error}</p>}
    </div>
  );
}
