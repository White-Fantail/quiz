"use client";

import { useState } from "react";
import { authClient } from "../../src/lib/auth-client";

export default function SignInActions({ google, apple, returnTo }: {
  google: boolean; apple: boolean; returnTo: string;
}) {
  const [busy, setBusy] = useState<"google" | "apple" | null>(null);
  const [error, setError] = useState("");
  async function signIn(provider: "google" | "apple") {
    if (!(provider === "google" ? google : apple)) return;
    setBusy(provider);
    setError("");
    try {
      const response = await authClient.signIn.social({ provider, callbackURL: returnTo });
      if (response.error) setError(response.error.message || "로그인에 실패했어요.");
    } catch {
      setError("로그인을 시작할 수 없어요. 잠시 후 다시 시도해 주세요.");
    } finally {
      setBusy(null);
    }
  }
  return (
    <div className="social-actions">
      <button type="button" className="btn btn-outline" onClick={() => void signIn("google")} disabled={!google || busy !== null}>
        Google 계정으로 계속하기{!google ? " (설정 필요)" : ""}
      </button>
      <button type="button" className="btn btn-outline" onClick={() => void signIn("apple")} disabled={!apple || busy !== null}>
        Apple 계정으로 계속하기{!apple ? " (준비 중)" : ""}
      </button>
      {!google && <p role="status" className="muted">Google 로그인을 사용하려면 서비스 관리자가 OAuth 설정을 완료해야 해요.</p>}
      {error && <p role="alert" className="feedback">{error}</p>}
    </div>
  );
}
