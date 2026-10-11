"use client";

import Link from "next/link";
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
      <h1>새로운 퀴즈를 발견해 봐</h1>
      <p className="lead">좋아하는 주제와 정답 유형을 고르고, 단서를 따라 정답을 찾아봐.</p>

      <section className="discover-filters" aria-label="퀴즈 탐색 필터">
        <label>
          <span>정답 유형</span>
          <select value={answerType} onChange={e => changeType(e.target.value)}>
            <option value="">전체 유형</option>
            {ANSWER_TYPES.map(type =>
              <option value={type.value} key={type.value}>{type.label}</option>
            )}
          </select>
        </label>
        <label>
          <span>주제</span>
          <select value={topic} onChange={e => changeTopic(e.target.value)}>
            <option value="">전체 주제</option>
            {topic && !topics.some(item => item.name === topic) &&
              <option value={topic}>{topic}</option>}
            {topics.map(item => <option value={item.name} key={item.id}>{item.name}</option>)}
          </select>
        </label>
        <label className="discover-kids-option">
          <input type="checkbox" checked={kids} onChange={e => changeKids(e.target.checked)} />
          <span>어린이용으로 승인된 퀴즈만</span>
        </label>
        {activeFilters &&
          <button className="text-button" type="button" onClick={() => {
            setAnswerType(""); setTopic(""); setKids(false); setPage(0);
          }}>필터 초기화</button>}
      </section>

      <div className="discover-results-head">
        <h2>퀴즈 둘러보기</h2>
        <span className="muted">{loading ? "불러오는 중…" : quizzes.length ? "새로운 도전을 골라봐!" : "표시할 퀴즈가 없어요"}</span>
      </div>
      {error && <div className="feedback" role="alert">
        {error} <button type="button" className="text-button" onClick={() => setRetry(v => v + 1)}>다시 시도</button>
      </div>}
      {!loading && !error && !quizzes.length &&
        <div className="discover-empty">
          <h3>조건에 맞는 퀴즈를 찾지 못했어요.</h3>
          <p className="muted">{kids
            ? "어린이 모드에는 별도 안전성 승인을 받은 퀴즈만 나타나요."
            : "아직 공개된 퀴즈가 없거나 선택한 조건과 일치하지 않아요."}</p>
          {activeFilters && <button className="btn btn-outline" onClick={() => {
            setAnswerType(""); setTopic(""); setKids(false); setPage(0);
          }}>모든 퀴즈 보기</button>}
        </div>}
      {loading && <p className="muted" role="status">퀴즈를 찾고 있어요…</p>}
      {!loading && !error && !!quizzes.length && <div className="discover-grid">
        {quizzes.map(quiz => {
          const kind = ANSWER_TYPES.find(type => type.value === quiz.answerType);
          const age = audienceAgeLabel(quiz.recommendedAudience);
          const difficulty = difficultyLabel(quiz.recommendedAudience);
          return <article key={quiz.id} className="feature-card discover-card">
            <div className="discover-card-top">
              <span className="symbol mint" aria-hidden="true">{kind?.icon ?? "✨"}</span>
              <span className="small-tag">{kind?.label ?? "퀴즈"}</span>
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
            <div className="discover-card-meta">
              <span>{modeLabel(quiz.mode)}</span>
              <span>단서 {quiz.clueCount}개</span>
              {age && <span>{age}</span>}
              {difficulty && <span>난이도 {difficulty}</span>}
              {quiz.kidsEligible && <span>어린이 승인</span>}
            </div>
            <Link href={"/play/" + quiz.id + (kids ? "?kids=true" : "")}
              className="btn btn-primary discover-play-link">이 퀴즈 풀기 →</Link>
          </article>;
        })}
      </div>}
      {!loading && !error && (page > 0 || hasMore) &&
        <nav className="discover-pagination" aria-label="퀴즈 목록 페이지">
          <button type="button" className="btn btn-outline" disabled={page === 0}
            onClick={() => setPage(v => Math.max(0, v - 1))}>이전</button>
          <span>{page + 1} 페이지</span>
          <button type="button" className="btn btn-outline" disabled={!hasMore}
            onClick={() => setPage(v => v + 1)}>다음</button>
        </nav>}
      <p className="muted discover-explainer">추천 연령과 난이도는 퀴즈 제작 과정에서 제안된 정보예요. 어린이 노출 가능 여부는 별도의 안전성 검증으로 결정돼요.</p>
    </main>
  );
}
