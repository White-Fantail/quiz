import Link from "next/link";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import ManagementHeader from "../../../../../src/components/management-header";
import { resolveLocale, localizeHref } from "../../../../../src/i18n/core";
import { actorFor } from "../../../../../src/modules/platform/auth";
import { db } from "../../../../../src/modules/platform/db";

export const dynamic = "force-dynamic";
const LIMIT = 20;
type Tab = "packs" | "questions" | "answers" | "runs";
const tabs: Tab[] = ["packs", "questions", "answers", "runs"];
type Search = { tab?: string; page?: string };
export default async function AdminUserDetails({
  params, searchParams,
}: { params: Promise<{ userId: string }>; searchParams: Promise<Search> }) {
  const h = await headers(), locale = resolveLocale(h.get("x-quizdip-locale"));
  const tr = (en: string, ko: string) => locale === "ko" ? ko : en;
  const actor = await actorFor(new Request("http://localhost/admin/directory/users", { headers: h }));
  if (!actor) redirect(localizeHref("/sign-in?callbackURL=%2Fadmin%2Fdirectory", locale));
  if (actor.role !== "ADMIN") notFound();

  const { userId } = await params;
  const user = await db().user.findUnique({
    where: { id: userId },
    select: { id: true, displayName: true, role: true, createdAt: true, publishingStatus: true,
      _count: { select: { quizzes: true, packs: true, sessions: true, playRuns: true } } },
  });
  if (!user) notFound();
  const query = await searchParams;
  const tab: Tab = tabs.includes(query.tab as Tab) ? query.tab as Tab : "packs";
  const n = Number(query.page);
  const page = Number.isSafeInteger(n) ? Math.min(10000, Math.max(1, n)) : 1;
  const skip = (page - 1) * LIMIT;
  const date = (value: Date) => value.toLocaleDateString(locale === "ko" ? "ko-KR" : "en-NZ");
  const base = localizeHref("/admin/directory/users/" + encodeURIComponent(user.id), locale);
  const directory = localizeHref("/admin/directory", locale);
  const titles: Record<Tab, string> = {
    packs: tr("Created packs", "등록한 퀴즈팩"),
    questions: tr("Created questions", "등록한 문제"),
    answers: tr("Completed questions", "푼 문제"),
    runs: tr("Play runs", "플레이 기록"),
  };
  const link = (value: Tab, p = 1) => {
    const query = new URLSearchParams({ tab: value });
    if (p > 1) query.set("page", String(p));
    return base + "?" + query.toString();
  };

  let total = 0;
  let content: React.ReactNode;
  if (tab === "packs") {
    const [count, rows] = await Promise.all([
      db().quizPack.count({ where: { authorId: userId } }),
      db().quizPack.findMany({
        where: { authorId: userId }, orderBy: { updatedAt: "desc" }, skip, take: LIMIT,
        select: { id: true, title: true, publication: true, updatedAt: true,
          _count: { select: { items: true, runs: true } } },
      }),
    ]);
    total = count;
    content = rows.map(p => <div key={p.id} className="review-entry">
      <span className="review-entry-copy"><strong>{p.title}</strong>
        <small>{p.publication} · {tr("Updated", "수정")} {date(p.updatedAt)} · {tr("Questions", "문제")} {p._count.items} · {tr("Runs", "플레이")} {p._count.runs}</small>
      </span>
      {p.publication === "PUBLISHED" && <Link className="card-link" href={localizeHref("/packs/" + p.id, locale)}>{tr("Open", "보기")} →</Link>}
    </div>);
  } else if (tab === "questions") {
    const [count, rows] = await Promise.all([
      db().quiz.count({ where: { authorId: userId } }),
      db().quiz.findMany({
        where: { authorId: userId }, orderBy: { updatedAt: "desc" }, skip, take: LIMIT,
        select: { id: true, publication: true, updatedAt: true,
          revisions: { orderBy: { createdAt: "desc" }, take: 1, select: { title: true } },
          _count: { select: { packItems: true, sessions: true } } },
      }),
    ]);
    total = count;
    content = rows.map(q => <div key={q.id} className="review-entry">
      <span className="review-entry-copy"><strong>{q.revisions[0]?.title ?? q.id}</strong>
        <small>{q.publication} · {tr("Updated", "수정")} {date(q.updatedAt)} · {tr("Packs", "포함된 팩")} {q._count.packItems} · {tr("Question sessions", "문제 풀이 기록")} {q._count.sessions}</small>
      </span><Link className="card-link" href={localizeHref("/admin/quiz-review/" + q.id, locale)}>{tr("Inspect", "상세")} →</Link>
    </div>);
  } else if (tab === "answers") {
    const where = { userId, status: { in: ["SOLVED", "FAILED"] } };
    const [count, rows] = await Promise.all([
      db().playSession.count({ where }),
      db().playSession.findMany({
        where, orderBy: { finishedAt: "desc" }, skip, take: LIMIT,
        select: { id: true, status: true, score: true, usedClues: true, wrongGuesses: true, finishedAt: true,
          quizId: true, revision: { select: { title: true } },
          run: { select: { pack: { select: { title: true } } } } },
      }),
    ]);
    total = count;
    content = rows.map(s => <div className="review-entry" key={s.id}>
      <span className="review-entry-copy"><strong>{s.revision.title}</strong>
        <small>{s.status === "SOLVED" ? tr("Solved", "정답") : tr("Failed", "오답")} · {tr("Score", "점수")} {s.score} · {tr("Clues", "클루")} {s.usedClues} · {tr("Wrong guesses", "오답 시도")} {s.wrongGuesses}</small>
        <small>{s.run?.pack?.title ?? tr("Individual question", "개별 문제")} · {s.finishedAt ? date(s.finishedAt) : "—"}</small>
      </span><Link className="card-link" href={localizeHref("/admin/quiz-review/" + s.quizId, locale)}>{tr("Question", "문제")} →</Link>
    </div>);
  } else {
    const [count, rows] = await Promise.all([
      db().playRun.count({ where: { userId } }),
      db().playRun.findMany({
        where: { userId }, orderBy: { startedAt: "desc" }, skip, take: LIMIT,
        select: { id: true, mode: true, status: true, startedAt: true, score: true,
          solved: true, failed: true, currentIndex: true, targetCount: true,
          pack: { select: { title: true } }, kidOwnership: { select: { runId: true } } },
      }),
    ]);
    total = count;
    content = rows.map(r => <div key={r.id} className="review-entry">
      <span className="review-entry-copy"><strong>{r.pack?.title ?? r.mode}</strong>
        <small>{r.status} · {date(r.startedAt)} · {tr("Score", "점수")} {r.score} · {r.currentIndex}/{r.targetCount ?? "?"} · {tr("Solved", "정답")} {r.solved} · {tr("Failed", "오답")} {r.failed}</small>
        {r.kidOwnership && <small>{tr("Kids play", "Kids 플레이")}</small>}
      </span>
    </div>);
  }
  const pages = Math.max(1, Math.ceil(total / LIMIT));
  return <main className="container inner-page management-page">
    <ManagementHeader eyebrow="QUIZDIP ADMIN · USER"
      title={user.displayName} description={tr("Account activity and authored content (read-only).", "계정 활동 및 등록 콘텐츠를 조회합니다. (읽기 전용)")}/>
    <div className="actions"><Link className="card-link" href={directory + "?view=users"}>← {tr("All users", "전체 사용자")}</Link></div>
    <section className="section">
      <p className="muted">{user.role} · {user.publishingStatus} · {tr("Joined", "가입")} {date(user.createdAt)}</p>
      <p className="muted">{tr("Packs", "퀴즈팩")} {user._count.packs} · {tr("Questions", "등록 문제")} {user._count.quizzes} · {tr("Play runs", "플레이")} {user._count.playRuns} · {tr("Question sessions", "문제 풀이 기록")} {user._count.sessions}</p>
      <nav className="actions" aria-label={tr("User records", "사용자 기록")}>
        {tabs.map(t => <Link key={t} href={link(t)} aria-current={t === tab ? "page" : undefined}
          className={t === tab ? "btn btn-primary" : "btn btn-outline"}>{titles[t]}</Link>)}
      </nav>
    </section>
    <section className="section review-console">
      <div className="review-section-heading"><h2>{titles[tab]}</h2><span className="small-tag">{total} {tr("results", "개")}</span></div>
      {tab === "answers" && <p className="muted">{tr("Only completed, synced question sessions are shown. Unfinished or unsynced local attempts and child-profile records are not included.", "완료되어 서버에 동기화된 개별 문제 풀이만 표시합니다. 미완료·미동기화 기록과 별도 Kids 프로필 기록은 포함되지 않습니다.")}</p>}
      <div className="review-result-list">{content}</div>
      {total === 0 && <p className="muted">{tr("No records.", "기록이 없습니다.")}</p>}
      {pages > 1 && <nav className="review-pagination" aria-label={tr("Pages", "페이지")}>
        {page > 1 ? <Link className="btn btn-outline" href={link(tab, page - 1)}>{tr("Previous", "이전")}</Link> : <span/>}
        <span>{page} / {pages}</span>
        {page < pages ? <Link className="btn btn-outline" href={link(tab, page + 1)}>{tr("Next", "다음")}</Link> : <span/>}
      </nav>}
    </section>
  </main>;
}
