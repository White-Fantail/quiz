"use client";

import { useState } from "react";
import { useLocale } from "../../src/i18n/provider";
import { bilingual } from "../../src/i18n/view-copy";
import { authClient } from "../../src/lib/auth-client";

export default function ConsentActions() {
  const locale=useLocale();
  const msg=(en:string,ko:string)=>bilingual(locale,en,ko);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  async function decide(accept: boolean) {
    setPending(true); setError("");
    try {
      const result = await authClient.oauth2.consent({ accept });
      if (result.error) setError(result.error.message || msg("Could not process authorization.","승인 요청을 처리하지 못했어요."));
    } catch {
      setError(msg("A connection request error occurred.","연결 요청 처리 중 문제가 발생했어요."));
    } finally { setPending(false); }
  }
  return <div className="actions">
    <button type="button" className="btn btn-primary" disabled={pending} onClick={() => decide(true)}>{msg("Authorize access","연결 허용")}</button>
    <button type="button" className="btn btn-outline" disabled={pending} onClick={() => decide(false)}>{msg("Deny","거절")}</button>
    {error && <p role="alert" className="feedback">{error}</p>}
  </div>;
}
