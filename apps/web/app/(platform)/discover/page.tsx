"use client";

import Link from "next/link";
import { useLocale, useTranslation } from "../../../src/i18n/provider";
import { localizeHref } from "../../../src/i18n/core";
import { RatingBadge } from "../../../src/components/quiz-ratings";
import { useEffect, useState } from "react";
import {
  ANSWER_TYPES, audienceAgeLabel, difficultyLabel, discoverQuery, modeLabel,
  publicTopics, type DiscoverQuiz
} from "../../../src/modules/quiz/discover-metadata";

const PAGE_SIZE = 12;
type Topic = { id: string; name: string; key: string };

async function getData(path: string): Promise<any> {
  const response = await fetch("/api/v1" + path, { cache: "no-store" });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.message || "퀴즈를 불러오지 못했어요.");
  return body.data;
}

export default function DiscoverPage() {
  const locale = useLocale();
  const t = useTranslation();
  const typeLabelsEn: Record<string, string> = { animal:"Animal", person:"Person", place:"Place", thing:"Thing", event:"Event", concept:"Concept", other:"Other" };
  const [answerType, setAnswerType] = useState("");
  const [topic, setTopic] = useState("");
  const [kids, setKids] = useState(false);
  const [page, setPage] = useState(0);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [quizzes, setQuizzes] = useState<DiscoverQuiz[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let active = true;
    setTopics([]);
    void getData("/topics?limit=100" + (kids ? "&kids=true" : "")).then(data => {
      if (active) setTopics(data.items ?? []);
    }).catch(() => {
      // Quiz listings still work if the optional topic suggestions fail.
    });
    return () => { active = false; };
  }, [kids]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    const query = discoverQuery({ answerType, topic, kids, offset: page * PAGE_SIZE, limit: PAGE_SIZE + 1 });
    void getData("/quizzes?" + query).then(data => {
      if (!active) return;
      const all = (data.items ?? []) as DiscoverQuiz[];
      setQuizzes(all.slice(0, PAGE_SIZE));
      setHasMore(all.length > PAGE_SIZE);
    }).catch(e => {
      if (!active) return;
      setQuizzes([]);
      setHasMore(false);
      setError(e instanceof Error ? e.message : "퀴즈를 불러오지 못했어요.");
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [answerType, topic, kids, page, retry]);

  function changeType(value: string) { setAnswerType(value); setPage(0); }
  function changeTopic(value: string) { setTopic(value); setPage(0); }
  function changeKids(value: boolean) { setKids(value); setTopic(""); setPage(0); }
  const activeFilters = Boolean(answerType || topic || kids);

  return (
    <main className="container inner-page discover-page">
      <span className="eyebrow">QUIZDIP DISCOVER</span>
      <h1>{t("discover.heading")}</h1>
      <p className="lead">{t("discover.lead")}</p>

      <section className="discover-filters" aria-label={t("discover.filters")}>
        <label>
          <span>{t("discover.answerType")}</span>
          <select value={answerType} onChange={e => changeType(e.target.value)}>
            <option value="">{t("discover.allTypes")}</option>
            {ANSWER_TYPES.map(type =>
              <option value={type.value} key={type.value}>{locale === "en" ? typeLabelsEn[type.value] : type.label}</option>
            )}
          </select>
        </label>
        <label>
          <span>{t("discover.topic")}</span>
          <select value={topic} onChange={e => changeTopic(e.target.value)}>
            <option value="">{t("discover.allTopics")}</option>
            {topic && !topics.some(item => item.name === topic) &&
              <option value={topic}>{topic}</option>}
            {topics.map(item => <option value={item.name} key={item.id}>{item.name}</option>)}
          </select>
        </label>
        <label className="discover-kids-option">
          <input type="checkbox" checked={kids} onChange={e => changeKids(e.target.checked)} />
          <span>{t("discover.kidsOnly")}</span>
        </label>
        {activeFilters &&
          <button className="text-button" type="button" onClick={() => {
            setAnswerType(""); setTopic(""); setKids(false); setPage(0);
          }}>{t("discover.clearFilters")}</button>}
      </section>

      <div className="discover-results-head">
        <h2>{t("discover.browse")}</h2>
        <span className="muted">{loading ? t("discover.loading") : quizzes.length ? t("discover.ready") : t("discover.none")}</span>
      </div>
      {error && <div className="feedback" role="alert">
        {error} <button type="button" className="text-button" onClick={() => setRetry(v => v + 1)}>{t("discover.retry")}</button>
      </div>}
      {!loading && !error && !quizzes.length &&
        <div className="discover-empty">
          <h3>{t("discover.empty")}</h3>
          <p className="muted">{kids
            ? t("discover.emptyKids")
            : t("discover.emptyGeneral")}</p>
          {activeFilters && <button className="btn btn-outline" onClick={() => {
            setAnswerType(""); setTopic(""); setKids(false); setPage(0);
          }}>{t("discover.viewAll")}</button>}
        </div>}
      {loading && <p className="muted" role="status">{t("discover.searching")}</p>}
      {!loading && !error && !!quizzes.length && <div className="discover-grid">
        {quizzes.map(quiz => {
          const kind = ANSWER_TYPES.find(type => type.value === quiz.answerType);
          const age = audienceAgeLabel(quiz.recommendedAudience, locale);
          const difficulty = difficultyLabel(quiz.recommendedAudience, locale);
          return <article key={quiz.id} className="feature-card discover-card">
            <div className="discover-card-top">
              <span className="symbol mint" aria-hidden="true">{kind?.icon ?? "✨"}</span>
              <span className="small-tag">{locale === "en" ? (typeLabelsEn[quiz.answerType] || "Quiz") : (kind?.label ?? "퀴즈")}</span>
            </div>
            <h3>{quiz.title}</h3>
            <p>{quiz.prompt}</p>
            <div className="discover-tags">
              {publicTopics(quiz).slice(0, 5).map(item =>
                <button type="button" key={item.id ?? item.key ?? item.name}
                  className="discover-topic" onClick={() => changeTopic(item.name)}>
                  # {item.name}
                </button>
              )}
            </div>
            <RatingBadge ratings={quiz.ratings}/>
            <div className="discover-card-meta">
              <span>{modeLabel(quiz.mode, locale)}</span>
              <span>{t("discover.clues")}: {quiz.clueCount}</span>
              {age && <span>{age}</span>}
              {difficulty && <span>{t("discover.difficulty")}: {difficulty}</span>}
              {quiz.kidsEligible && <span>{t("discover.approved")}</span>}
            </div>
            <Link href={localizeHref("/play/" + quiz.id + (kids ? "?kids=true" : ""), locale)}
              className="btn btn-primary discover-play-link">{t("discover.play")}</Link>
          </article>;
        })}
      </div>}
      {!loading && !error && (page > 0 || hasMore) &&
        <nav className="discover-pagination" aria-label={t("discover.pagination")}>
          <button type="button" className="btn btn-outline" disabled={page === 0}
            onClick={() => setPage(v => Math.max(0, v - 1))}>{t("discover.previous")}</button>
          <span>{page + 1} {t("discover.page")}</span>
          <button type="button" className="btn btn-outline" disabled={!hasMore}
            onClick={() => setPage(v => v + 1)}>{t("discover.next")}</button>
        </nav>}
      <p className="muted discover-explainer">{t("discover.explainer")}</p>
    </main>
  );
}
