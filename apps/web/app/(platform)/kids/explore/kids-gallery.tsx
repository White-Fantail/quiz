"use client";

import { useEffect, useState } from "react";
import { discoverQuery, type DiscoverQuiz } from "../../../../src/modules/quiz/discover-metadata";
import { useLocale, useTranslation } from "../../../../src/i18n/provider";

const PAGE_SIZE = 8;
const filters = [
  { value: "", label: "kids.explore.all", icon: "✨" },
  { value: "animal", label: "kids.explore.animal", icon: "🦁" },
  { value: "place", label: "kids.explore.place", icon: "🌎" },
  { value: "thing", label: "kids.explore.thing", icon: "🔍" },
  { value: "concept", label: "kids.explore.concept", icon: "🚀" },
] as const;
type Type = (typeof filters)[number]["value"];

export default function KidsGallery({ initialType }: { initialType: Type }) {
  const locale = useLocale();
  const t = useTranslation();
  const [type, setType] = useState<Type>(initialType);
  const [page, setPage] = useState(0);
  const [items, setItems] = useState<DiscoverQuiz[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(false);
    const query = discoverQuery({ answerType: type, kids: true, locale, offset: page * PAGE_SIZE, limit: PAGE_SIZE + 1 });
    void fetch("/api/v1/quizzes?" + query, { cache: "no-store", signal: controller.signal })
      .then(async response => {
        if (!response.ok) throw new Error("Kids catalog unavailable");
        const body = await response.json();
        return (body.data?.items ?? []) as DiscoverQuiz[];
      })
      .then(quizzes => {
        if (controller.signal.aborted) return;
        // Server performs the authoritative safety gate; fail closed if metadata is inconsistent.
        const safe = quizzes.filter(quiz => quiz.kidsEligible === true);
        setItems(safe.slice(0, PAGE_SIZE));
        setHasMore(safe.length > PAGE_SIZE);
      })
      .catch(() => {
        if (!controller.signal.aborted) { setItems([]); setHasMore(false); setError(true); }
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [type, page, retry, locale]);

  return (
    <>
      <div className="kids-filterbar" role="group" aria-label={t("kids.explore.filters")}>
        {filters.map(filter => (
          <button type="button" className={"kids-filter" + (type === filter.value ? " active" : "")}
            key={filter.value} aria-pressed={type === filter.value}
            onClick={() => { setType(filter.value); setPage(0); }}>
            <span aria-hidden="true">{filter.icon}</span> {t(filter.label)}
          </button>
        ))}
      </div>
      {loading && <p className="kids-notice" role="status">{t("kids.explore.loading")}</p>}
      {error && <div className="kids-notice" role="alert">
        {t("kids.explore.error")}{" "}
        <button type="button" onClick={() => setRetry(n => n + 1)}>{t("kids.explore.retry")}</button>
      </div>}
      {!loading && !error && items.length === 0 &&
        <p className="kids-notice">{t("kids.explore.empty")}</p>}
      {!loading && !error && items.length > 0 &&
        <div className="kids-quiz-grid">
          {items.map(quiz => (
            <article className="kids-quiz-preview" key={quiz.id}>
              <span className="kids-quiz-icon" aria-hidden="true">
                {quiz.answerType === "animal" ? "🐾" : quiz.answerType === "place" ? "🌎" : "🌟"}
              </span>
              <h2>{quiz.title}</h2>
              <p>{quiz.prompt}</p>
              <span className="kids-preview-badge">{t("kids.explore.approved")}</span>
            </article>
          ))}
        </div>}
      {!loading && !error && (page > 0 || hasMore) && <div className="kids-pages">
        <button type="button" disabled={page === 0} onClick={() => setPage(n => Math.max(0, n - 1))}>
          {t("kids.explore.previous")}
        </button>
        <span>{page + 1}</span>
        <button type="button" disabled={!hasMore} onClick={() => setPage(n => n + 1)}>
          {t("kids.explore.next")}
        </button>
      </div>}
      <p className="kids-explore-note">{t("kids.explore.previewOnly")}</p>
    </>
  );
}
