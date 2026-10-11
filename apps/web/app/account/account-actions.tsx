"use client";

import { useEffect, useState } from "react";
import { authClient } from "../../src/lib/auth-client";

type Account = { id: string; providerId: string };
export default function AccountActions({ google, apple }: { google: boolean; apple: boolean }) {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [rankingConsent, setRankingConsent] = useState(false);
  const [adultVerified, setAdultVerified] = useState(false);
  const [rankingLoaded, setRankingLoaded] = useState(false);
  const [rankingNotice, setRankingNotice] = useState("");
  useEffect(() => {
    authClient.listAccounts().then(({ data, error }) => {
      if (error) setError(error.message || "계정 정보를 불러올 수 없어요.");
      else setAccounts((data || []).map(item => ({ id: item.id, providerId: item.providerId })));
    }).catch(() => setError("연결된 계정을 불러오지 못했어요."));
    fetch("/api/v1/me",{credentials:"same-origin",cache:"no-store"})
      .then(async response => {
        if(!response.ok) throw new Error("Unable to load ranking preferences");
        return response.json();
      })
      .then(result => {
        setRankingConsent(Boolean(result.data?.leaderboardOptIn));
        setAdultVerified(Boolean(result.data?.leaderboardEligible));
        setRankingLoaded(true);
      }).catch(()=>{});
  }, []);
  async function updateRankingConsent(next: boolean) {
    setBusy(true);setError("");setRankingNotice("");
    try {
      const response=await fetch("/api/v1/me/ranking",{
        method:"PATCH",credentials:"same-origin",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({enabled:next,confirm:true})
      });
      const result=await response.json();
      if(!response.ok) throw new Error(result.message || result.error || "순위 설정 변경에 실패했어요.");
      setRankingConsent(Boolean(result.data?.leaderboardOptIn));
      setRankingNotice("순위 공개 설정을 저장했어요.");
    }catch(e){setError(e instanceof Error?e.message:"순위 설정 변경에 실패했어요.");}
    finally{setBusy(false);}
  }
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
      return <div key={provider} className="connected-provider">
        <span><b>{provider === "google" ? "Google" : "Apple"}</b> {linked ? "· 연결됨" : "· 연결되지 않음"}</span>
        {linked && accounts.length > 1
          ? <button type="button" className="text-button" disabled={busy} onClick={() => unlink(linked.id)}>연결 해제</button>
          : !linked && enabled
            ? <button type="button" className="btn btn-outline" disabled={busy} onClick={() => link(provider)}>이 계정에 연결</button>
            : !linked
              ? <span className="muted">{provider === "apple" ? "준비 중" : "설정 필요"}</span>
              : null}
      </div>;
    })}
    {rankingLoaded&&<div className="ranking-consent-setting">
      <h3>내 주간 순위 공개</h3>
      <label className="connected-provider">
        <span><b>공식 순위에 내 이름과 점수를 공개</b></span>
        <input type="checkbox" checked={rankingConsent} disabled={busy}
          onChange={e=>void updateRankingConsent(e.target.checked)}/>
      </label>
      <p className="muted">공개는 선택 사항이에요. 성인 인증도 완료되어야 실제 순위에 표시돼요.
        인증 상태: {adultVerified?"확인 완료":"미확인"}.</p>
      {rankingNotice&&<p role="status" className="feedback success">{rankingNotice}</p>}
    </div>}
    {error && <p className="feedback" role="alert">{error}</p>}
    <button className="text-button" disabled={busy} onClick={() => authClient.signOut({ fetchOptions: { onSuccess: () => { window.location.href = "/"; } } })}>로그아웃</button>
  </div>;
}
