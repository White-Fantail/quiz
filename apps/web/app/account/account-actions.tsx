"use client";

import { useEffect, useState } from "react";
import { authClient } from "../../src/lib/auth-client";

type Account = { id: string; providerId: string };
export default function AccountActions({ google, apple }: { google: boolean; apple: boolean }) {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    authClient.listAccounts().then(({ data, error }) => {
      if (error) setError(error.message || "계정 정보를 불러올 수 없어요.");
      else setAccounts((data || []).map(item => ({ id: item.id, providerId: item.providerId })));
    }).catch(() => setError("연결된 계정을 불러오지 못했어요."));
  }, []);
  async function link(provider: "google" | "apple") {
    setBusy(true);
    setError("");
    try {
      const response = await authClient.linkSocial({ provider, callbackURL: "/account" });
      if (response.error) setError(response.error.message || "계정을 연결하지 못했어요.");
    } catch {
      setError("계정 연결 요청에 실패했어요.");
    } finally { setBusy(false); }
  }
  async function unlink(accountId: string) {
    setBusy(true); setError("");
    try {
      const response = await authClient.unlinkAccount({ accountId });
      if (response.error) setError(response.error.message || "연결을 해제하지 못했어요.");
      else setAccounts(current => current.filter(item => item.id !== accountId));
    } catch { setError("연결 해제에 실패했어요."); }
    finally { setBusy(false); }
  }
  return <div className="social-actions">
    {(["google", "apple"] as const).map(provider => {
      const linked = accounts.find(item => item.providerId === provider);
      const enabled = provider === "google" ? google : apple;
      if (!enabled && !linked) return null;
      return <div key={provider} className="connected-provider">
        <span><b>{provider === "google" ? "Google" : "Apple"}</b> {linked ? "· 연결됨" : "· 연결되지 않음"}</span>
        {linked && accounts.length > 1
          ? <button type="button" className="text-button" disabled={busy} onClick={() => unlink(linked.id)}>연결 해제</button>
          : !linked && enabled
            ? <button type="button" className="btn btn-outline" disabled={busy} onClick={() => link(provider)}>이 계정에 연결</button>
            : null}
      </div>;
    })}
    {error && <p className="feedback" role="alert">{error}</p>}
    <button className="text-button" disabled={busy} onClick={() => authClient.signOut({ fetchOptions: { onSuccess: () => { window.location.href = "/"; } } })}>로그아웃</button>
  </div>;
}
