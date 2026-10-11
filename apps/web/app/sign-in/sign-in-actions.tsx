"use client";

import { useState } from "react";
import { authClient } from "../../src/lib/auth-client";

export default function SignInActions({ google, apple, returnTo }: {
  google: boolean; apple: boolean; returnTo: string;
}) {
  const [busy, setBusy] = useState<"google" | "apple" | null>(null);
  const [error, setError] = useState("");
  async function signIn(provider: "google" | "apple") {
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
      {google && <button className="btn btn-outline" onClick={() => signIn("google")} disabled={busy !== null}>
        Google 계정으로 계속하기
      </button>}
      {apple && <button className="btn btn-outline" onClick={() => signIn("apple")} disabled={busy !== null}>
        Apple 계정으로 계속하기
      </button>}
      {!google && !apple && <p role="status">현재 로그인 제공자가 설정되지 않았어요. 서비스 관리자에게 문의해 주세요.</p>}
      {error && <p role="alert" className="feedback">{error}</p>}
    </div>
  );
}
