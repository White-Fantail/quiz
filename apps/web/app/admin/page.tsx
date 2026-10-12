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
          <h2>{msg("Quiz and child safety review","문제 및 어린이 안전성 심사")}</h2>
          <p>{msg("Review quizzes and media for general and child-safe visibility.","문제와 미디어를 확인하고 일반용·어린이용 노출 적합성을 관리해요.")}</p>
          <span className="card-link">{msg("Open review tools →","심사 도구 열기 →")}</span>
        </Link>
      </div>
    </section>
  );
}
