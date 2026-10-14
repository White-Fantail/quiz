import ManagementHeader from "../../../../src/components/management-header";
import { headers } from "next/headers";
import { resolveLocale, localizeHref } from "../../../../src/i18n/core";
import { mcpResource } from "../../../../src/lib/auth";
import Link from "next/link";
import { StudioAiSetup } from "../studio-ai-onboarding";

export const dynamic = "force-dynamic";

export default async function StudioAiPage() {
  const locale = resolveLocale((await headers()).get("x-quizdip-locale"));
  return <main className="container inner-page management-page studio-ai-page">
    <ManagementHeader
      eyebrow="QUIZDIP AI CREATOR"
      title={locale === "ko" ? "ChatGPT로 퀴즈 만들기" : "Create quizzes with ChatGPT"}
      description={locale === "ko"
        ? "주제만 정하면 AI와 함께 퀴즈를 만들 수 있어요. QuizDip을 ChatGPT에 연결하는 방법을 안내합니다."
        : "Turn your ideas into quizzes with AI. Follow these steps to connect QuizDip to ChatGPT."}
    />
    <StudioAiSetup mcpUrl={mcpResource}/>
    <p className="studio-ai-guide-back">
      <Link href={localizeHref("/studio", locale)}>{locale === "ko" ? "← 내 스튜디오" : "← My Studio"}</Link>
    </p>
  </main>;
}
