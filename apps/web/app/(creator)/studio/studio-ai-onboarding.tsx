"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useLocale } from "../../../src/i18n/provider";
import { localizeHref } from "../../../src/i18n/core";
import { bilingual } from "../../../src/i18n/view-copy";

const INTRO_KEY = "quizdip:studio:ai-intro-dismissed:v1:";

function samplePrompt(locale: "en" | "ko"): string {
  return bilingual(locale,
    "Create 25 nostalgic 1990s quiz questions for Korean adults. Give each question three progressively easier clues. Mix multiple-choice and free-text answers as appropriate. Show me the draft for review before registering or publishing it on QuizDip.",
    "한국 성인을 위한 1990년대 추억 퀴즈 25개를 만들어 줘. 문제마다 점점 쉬워지는 힌트 3개를 넣고, 적절히 객관식과 주관식을 섞어 줘. QuizDip에 등록하거나 공개하기 전에 초안을 먼저 검토할 수 있게 보여 줘.");
}

async function copyToClipboard(value: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      return true;
    }
  } catch {
    // Older browsers and restricted contexts may need the selection fallback.
  }

  const field = document.createElement("textarea");
  field.value = value;
  field.setAttribute("readonly", "");
  field.style.position = "fixed";
  field.style.left = "-9999px";
  document.body.appendChild(field);
  field.focus();
  field.select();
  try {
    return document.execCommand("copy");
  } catch {
    return false;
  } finally {
    field.remove();
  }
}

function CopyButton({ value, label }: { value: string; label: string }) {
  const locale = useLocale();
  const [status, setStatus] = useState<"idle" | "copied" | "error">("idle");
  return <span className="studio-ai-copy-action">
    <button type="button" className="btn btn-outline" onClick={async () => {
      const copied = await copyToClipboard(value);
      setStatus(copied ? "copied" : "error");
    }}>{status === "copied"
      ? bilingual(locale, "✓ Copied", "✓ 복사됨")
      : label}</button>
    {status === "error" && <span role="status" className="studio-ai-copy-error">
      {bilingual(locale, "Select the text and copy it manually.", "텍스트를 선택해 직접 복사해 주세요.")}
    </span>}
  </span>;
}

/** Intro dismissal is scoped to a QuizDip account on this device. */
export default function StudioAiOnboarding({ viewerId, mcpUrl }: { viewerId: string | null; mcpUrl: string }) {
  const locale = useLocale();
  const [visible, setVisible] = useState(false);
  const key = INTRO_KEY + (viewerId ?? "guest");

  useEffect(() => {
    try {
      setVisible(window.localStorage.getItem(key) !== "yes");
    } catch {
      setVisible(true);
    }
  }, [key]);

  function dismiss() {
    try {
      window.localStorage.setItem(key, "yes");
    } catch {
      // Continue dismissing for the current page even with blocked storage.
    }
    setVisible(false);
  }

  if (!visible) return null;
  return <section aria-labelledby="studio-ai-intro-title" className="studio-ai-hero">
    <div className="studio-ai-hero-top">
      <span className="studio-ai-eyebrow">✦ QuizDip AI Creator <span className="studio-ai-beta">BETA</span></span>
      <button type="button" className="studio-ai-dismiss" onClick={dismiss}>
        {bilingual(locale, "Don't show again ✕", "다시 보지 않기 ✕")}
      </button>
    </div>
    <h2 id="studio-ai-intro-title">{bilingual(locale,
      "Have an idea? Let AI make the quiz.",
      "아이디어만 있다면, 퀴즈 제작은 AI에게 맡겨보세요.")}</h2>
    <p>{bilingual(locale,
      "Ask ChatGPT to draft questions and progressively revealed clues, then help you register and publish them on QuizDip. Review the questions before sharing.",
      "ChatGPT에게 주제만 알려주세요. 문제와 단계별 힌트를 만들고, QuizDip에 등록하고 공개하는 과정까지 도와줍니다. 공개 전에는 내용을 직접 검토할 수 있어요.")}</p>
    <div className="studio-ai-prompt-preview">
      <strong>{bilingual(locale, "Try asking ChatGPT…", "예를 들어 이렇게 요청해 보세요")}</strong>
      <span>{samplePrompt(locale)}</span>
    </div>
    <div className="studio-ai-hero-actions">
      <Link href={localizeHref("/studio/ai", locale)} className="btn btn-primary">
        {bilingual(locale, "Start creating with AI →", "AI 제작 시작하기 →")}
      </Link>
      <CopyButton value={mcpUrl} label={bilingual(locale, "Copy MCP address", "MCP 주소 복사하기")}/>
    </div>
    <p className="studio-ai-small-note">{bilingual(locale,
      "Early access · Connecting a custom MCP server requires a compatible ChatGPT account.",
      "베타 제공 중 · 사용자 지정 MCP 서버 연결은 지원되는 ChatGPT 계정에서 가능합니다.")}</p>
  </section>;
}

export function StudioAiSetup({ mcpUrl }: { mcpUrl: string }) {
  const locale = useLocale();
  return <div className="studio-ai-guide">
    <section className="studio-ai-guide-panel">
      <div className="studio-ai-guide-heading">
        <span className="studio-ai-eyebrow">✦ QUIZDIP AI CREATOR · BETA</span>
        <h2>{bilingual(locale, "1. Copy the QuizDip MCP address", "1. QuizDip MCP 주소 복사하기")}</h2>
        <p>{bilingual(locale,
          "Use this server address when adding QuizDip to ChatGPT. This is the same MCP endpoint used by QuizDip's authentication service.",
          "ChatGPT에 QuizDip을 연결할 때 아래 서버 주소를 사용하세요. QuizDip 인증 서버에서 사용하는 MCP 주소와 동일합니다.")}</p>
      </div>
      <div className="studio-ai-address-row">
        <code aria-label={bilingual(locale, "QuizDip MCP server URL", "QuizDip MCP 서버 주소")}>{mcpUrl}</code>
        <CopyButton value={mcpUrl} label={bilingual(locale, "Copy MCP address", "MCP 주소 복사하기")}/>
      </div>
      <p className="studio-ai-small-note">{bilingual(locale,
        "You can also select and copy the URL above manually.",
        "복사 버튼을 사용할 수 없다면 위 주소를 직접 선택해 복사할 수 있습니다.")}</p>
    </section>

    <section className="studio-ai-guide-panel">
      <h2>{bilingual(locale, "2. Connect in ChatGPT", "2. ChatGPT에서 연결하기")}</h2>
      <ol className="studio-ai-steps">
        <li>{bilingual(locale,
          "Open ChatGPT settings and find Plugins / Apps. Choose Add custom MCP server, if available on your account.",
          "ChatGPT의 설정에서 플러그인(앱)을 열고, 제공되는 경우 사용자 지정 MCP 서버 추가를 선택하세요.")}</li>
        <li>{bilingual(locale,
          "Paste the copied URL and continue with the connection process.",
          "복사한 MCP 주소를 붙여넣고 연결을 진행하세요.")}</li>
        <li>{bilingual(locale,
          "Sign in with your QuizDip account and approve the requested access after reviewing it.",
          "QuizDip 계정으로 로그인한 다음, 요청된 접근 권한을 확인하고 동의하세요.")}</li>
        <li>{bilingual(locale,
          "In a ChatGPT conversation, select the connected QuizDip tool and ask it to create your quiz.",
          "ChatGPT 대화에서 연결한 QuizDip 도구를 선택하고 원하는 퀴즈 제작을 요청하세요.")}</li>
      </ol>
      <a className="btn btn-outline" href="https://chatgpt.com/" target="_blank" rel="noopener noreferrer">
        {bilingual(locale, "Open ChatGPT ↗", "ChatGPT 열기 ↗")}
      </a>
      <p className="studio-ai-small-note">{bilingual(locale,
        "ChatGPT controls custom server availability and the exact labels. If you don't see this option, custom MCP connections may not be available on your account yet.",
        "사용자 지정 서버 추가 기능과 메뉴 이름은 ChatGPT 계정 및 버전에 따라 다를 수 있습니다. 해당 옵션이 보이지 않으면 아직 사용할 수 없는 계정일 수 있습니다.")}</p>
    </section>

    <section className="studio-ai-guide-panel">
      <h2>{bilingual(locale, "3. Start with an example", "3. 예시 요청으로 시작하기")}</h2>
      <p>{bilingual(locale,
        "Copy this prompt and send it in ChatGPT after connecting QuizDip.",
        "QuizDip을 연결한 다음, 아래 요청문을 복사해 ChatGPT에서 사용해 보세요.")}</p>
      <div className="studio-ai-prompt-preview">
        <span>{samplePrompt(locale)}</span>
      </div>
      <div className="studio-ai-guide-actions">
        <CopyButton value={samplePrompt(locale)} label={bilingual(locale, "Copy example prompt", "예시 요청 복사하기")}/>
        <Link className="btn btn-outline" href={localizeHref("/studio", locale)}>
          {bilingual(locale, "Back to Studio", "스튜디오로 돌아가기")}
        </Link>
      </div>
      <p className="studio-ai-small-note">{bilingual(locale,
        "AI can help draft, create, and publish content through the connected tools, but you remain responsible for reviewing accuracy and copyright before publishing.",
        "AI가 연결된 도구를 통해 문제 제작과 등록·공개를 도울 수 있지만, 공개 전 정답 정확성과 저작권은 직접 확인해 주세요.")}</p>
    </section>
  </div>;
}
