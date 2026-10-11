"use client";

import { useState } from "react";
import { authClient } from "../../src/lib/auth-client";

export default function ConsentActions() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  async function decide(accept: boolean) {
    setPending(true); setError("");
    try {
      const result = await authClient.oauth2.consent({ accept });
      if (result.error) setError(result.error.message || "승인 요청을 처리하지 못했어요.");
    } catch {
      setError("연결 요청 처리 중 문제가 발생했어요.");
    } finally { setPending(false); }
  }
  return <div className="actions">
    <button type="button" className="btn btn-primary" disabled={pending} onClick={() => decide(true)}>연결 허용</button>
    <button type="button" className="btn btn-outline" disabled={pending} onClick={() => decide(false)}>거절</button>
    {error && <p role="alert" className="feedback">{error}</p>}
  </div>;
}
