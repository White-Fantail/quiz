import ManagementHeader from "../../src/components/management-header";
import { resolveLocale,localizeHref } from "../../src/i18n/core";
import { bilingual } from "../../src/i18n/view-copy";
import Link from "next/link";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { actorFor } from "../../src/modules/platform/auth";

export const dynamic = "force-dynamic";

/** Only authenticated platform administrators can access the backoffice. */
export default async function AdminPage() {
  const requestHeaders=await headers();
  const locale=resolveLocale(requestHeaders.get("x-quizdip-locale"));
  const msg=(en:string,ko:string)=>bilingual(locale,en,ko);
  const actor = await actorFor(
    new Request("http://localhost/admin", { headers: requestHeaders }),
  );
  if (!actor) redirect(localizeHref("/sign-in?callbackURL=%2Fadmin",locale));
  if (actor.role !== "ADMIN") notFound();

  return (
    <section className="container inner-page management-page">
      <ManagementHeader eyebrow="QUIZDIP ADMIN" title={msg("Admin dashboard","관리자 대시보드")} description={msg("Manage content safety and platform operations.","콘텐츠 안전성과 플랫폼 운영 기능을 관리할 수 있어요.")}/>
      <div className="cards management-link-grid">
        <Link href={localizeHref("/admin/quiz-review",locale)} className="feature-card">
          <span className="symbol mint" aria-hidden="true">✓</span>
          <h2>{msg("Reported content and Kids review","신고 콘텐츠 및 어린이용 심사")}</h2>
          <p>{msg("Review reports, high negative ratings and creator-submitted Kids quizzes.","신고·높은 부정 평가·제작자가 신청한 Kids 문제를 검토해요.")}</p>
          <span className="card-link">{msg("Open review tools →","심사 도구 열기 →")}</span>
        </Link>
        <Link href={localizeHref("/admin/features",locale)} className="feature-card">
          <span className="symbol yellow" aria-hidden="true">✦</span>
          <h2>{msg("Editorial recommendations","운영자 추천 콘텐츠")}</h2>
          <p>{msg("Schedule and manage featured questions and quiz packs independently of popular rankings.","문제·퀴즈팩 추천을 언어·대상·기간별로 편성하고 관리해요.")}</p>
          <span className="card-link">{msg("Manage Editor's Picks →","추천 콘텐츠 관리 →")}</span>
        </Link>
        <Link href={localizeHref("/admin/packs-review",locale)} className="feature-card">
          <span className="symbol mint" aria-hidden="true">🛡️</span>
          <h2>{msg("Kids quiz pack approval","퀴즈팩 어린이 안전 심사")}</h2>
          <p>{msg("Review complete packs independently before native Kids devices can discover them.","팩 자체의 내용과 전체 문제·미디어 안전성을 심사한 뒤 어린이용으로 승인해요.")}</p>
          <span className="card-link">{msg("Review packs →","퀴즈팩 심사 →")}</span>
        </Link>
      </div>
    </section>
  );
}
