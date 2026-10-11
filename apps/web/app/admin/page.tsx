import Link from "next/link";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { actorFor } from "../../src/modules/platform/auth";

export const dynamic = "force-dynamic";

/** Only authenticated platform administrators can access the backoffice. */
export default async function AdminPage() {
  const actor = await actorFor(
    new Request("http://localhost/admin", { headers: await headers() }),
  );
  if (!actor) redirect("/sign-in?callbackURL=%2Fadmin");
  if (actor.role !== "ADMIN") notFound();

  return (
    <section className="container inner-page">
      <span className="eyebrow">QUIZDIP ADMIN</span>
      <h1>관리자 대시보드</h1>
      <p className="lead">
        콘텐츠 안전성과 주간 챌린지 등 플랫폼 운영 기능을 관리할 수 있어요.
      </p>
      <div className="cards">
        <Link href="/admin/quiz-review" className="feature-card">
          <span className="symbol mint" aria-hidden="true">✓</span>
          <h2>문제 및 어린이 안전성 심사</h2>
          <p>문제와 미디어를 확인하고 일반용·어린이용 노출 적합성을 관리해요.</p>
          <span className="card-link">심사 도구 열기 →</span>
        </Link>
        <Link href="/admin/weekly" className="feature-card">
          <span className="symbol yellow" aria-hidden="true">★</span>
          <h2>주간 챌린지 관리</h2>
          <p>제작자가 제출한 문제를 확인하고 이번 주 챌린지를 편성해요.</p>
          <span className="card-link">주간 편성 열기 →</span>
        </Link>
      </div>
    </section>
  );
}
