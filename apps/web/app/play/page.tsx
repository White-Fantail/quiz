"use client";

import { useState } from "react";
import Link from "next/link";
import { isCorrectAnswer, scoreForClues } from "@clupio/domain";
import { demoQuiz } from "../../src/data/demo-quiz";

export default function PlayPage() {
  const [cluesUsed, setCluesUsed] = useState(1);
  const [guess, setGuess] = useState("");
  const [result, setResult] = useState<"correct" | "incorrect" | null>(null);
  const maxClues = demoQuiz.clues.length;
  const finished = result === "correct";

  function submitGuess(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (finished || !guess.trim()) return;
    setResult(isCorrectAnswer(demoQuiz.answer, guess) ? "correct" : "incorrect");
  }

  function reset() {
    setCluesUsed(1);
    setGuess("");
    setResult(null);
  }

  return (
    <section className="container inner-page compact">
      <span className="eyebrow">CLUPIO PLAY · DEMO</span>
      <h1>{demoQuiz.title}</h1>
      <p className="muted">실제 서버 데이터가 아닌 로컬 샘플이에요. 정답 판정도 브라우저에서 이루어집니다.</p>
      <div className="play-panel">
        <div className="play-top"><span className="small-tag">동물 맞히기</span><span className="clue-count">힌트 {cluesUsed} / {maxClues}</span></div>
        <h2>{demoQuiz.prompt}</h2>
        <ol className="clue-list">
          {demoQuiz.clues.slice(0, cluesUsed).map((clue) => (
            <li key={clue.id}>{clue.type === "text" ? clue.text : "미지원 샘플 형식"}</li>
          ))}
        </ol>
        {!finished && cluesUsed < maxClues && (
          <button className="btn btn-outline" onClick={() => { setCluesUsed((count) => count + 1); setResult(null); }}>
            힌트 하나 더 볼까?
          </button>
        )}
        <form onSubmit={submitGuess} className="guess-form">
          <label htmlFor="answer">정답을 입력해 봐</label>
          <div className="guess-row">
            <input id="answer" type="text" value={guess} onChange={(e) => setGuess(e.target.value)} disabled={finished} placeholder="정답은 무엇일까?" autoComplete="off" />
            <button className="btn btn-primary" type="submit" disabled={finished || !guess.trim()}>정답 확인</button>
          </div>
        </form>
        {result === "correct" && <div className="feedback success" role="status">정답이야! 알아냈네! 🎉 점수: {Math.round(scoreForClues(maxClues, cluesUsed))}점</div>}
        {result === "incorrect" && <div className="feedback" role="status">아직 아니야! 다시 생각하거나 힌트를 하나 더 열어 봐.</div>}
        <div className="play-bottom"><button type="button" className="text-button" onClick={reset}>다시 플레이</button><Link href="/discover">다른 퀴즈 둘러보기 →</Link></div>
      </div>
    </section>
  );
}
