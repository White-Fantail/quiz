"use client";

import Link from "next/link";
import { ImageReveal, type RevealSettings } from "../../../../src/components/image-reveal";
import { activeImageStage } from "@quizdip/domain";
import { useLocale } from "../../../../src/i18n/provider";
import { localizeHref } from "../../../../src/i18n/core";
import { bilingual } from "../../../../src/i18n/view-copy";
import { RatingBadge, RatingButtons, RatingSignIn, type RatingAccess } from "../../../../src/components/quiz-ratings";
import type { RatingSummary } from "../../../../src/modules/quiz/rating-metadata";
import { useParams } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";

type Clue = { type: "text" | "image" | "image-reveal" | "audio" | "video" | "map"; text?: string;
  mediaId?: string; reveal?: RevealSettings; map?: {latitude:number;longitude:number;zoom?:number} };
type Session = { sessionId: string; sessionToken: string; title: string;
  prompt: string; promptMediaIds: string[]; clue: Clue; clueIndex: number; clueCount: number;
  responseMode?:"text"|"multiple-choice";options?:string[];
  ratings:RatingSummary;myRating:number|null;ratingAccess:RatingAccess;isTranslation?:boolean;myTranslationRating?:number|null };
type Media = { mediaId:string; url:string; kind:string };

async function api(path: string, body: unknown,locale:"en"|"ko"="en"): Promise<any> {
  const response = await fetch("/api/v1" + path, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body), cache: "no-store", credentials: "same-origin"
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (payload.error === "weekly_reserved")
      throw new Error(bilingual(locale,"This quiz is in the official weekly challenge. Join it from Play.","이번 주 공식 챌린지에 포함된 문제예요. Play에서 주간 도전에 참여해 주세요."));
    if (payload.error === "not_for_kids")
      throw new Error(bilingual(locale,"This quiz is not yet approved for Kids play.","이 퀴즈는 아직 어린이 모드 안전성 승인을 받지 않았어요."));
    throw new Error(payload.message || bilingual(locale,"Could not start this quiz.","퀴즈를 진행하지 못했어요."));
  }
  return payload.data;
}
export default function SingleQuizPage() {
  const locale = useLocale();
  const msg=(en:string,ko:string)=>bilingual(locale,en,ko);
  const request=(path:string,body:unknown)=>api(path,body,locale);
  const { quizId } = useParams<{ quizId: string }>();
  const [session, setSession] = useState<Session | null>(null);
  const [clues, setClues] = useState<Clue[]>([]);
  const [media, setMedia] = useState<Record<string, Media>>({});
  const [guess, setGuess] = useState("");
  const answerInputRef = useRef<HTMLInputElement>(null);
  const guessFormRef = useRef<HTMLFormElement>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");
  const [mustReveal, setMustReveal] = useState(false);
  const [answer, setAnswer] = useState("");
  const [score, setScore] = useState(0);
  const [status, setStatus] = useState<"ACTIVE" | "SOLVED" | "FAILED">("ACTIVE");

  useEffect(() => {
    let active = true;
    setSession(null); setClues([]); setMedia({}); setBusy(true); setError("");
    setGuess(""); setFeedback(""); setMustReveal(false); setAnswer(""); setScore(0); setStatus("ACTIVE");
    const kids = new URLSearchParams(window.location.search).get("kids") === "true";
    void request("/play", { quizId, kids, locale }).then((next:Session) => {
      if (!active) return;
      setSession(next);
      setClues([next.clue]);
      const ids = [...next.promptMediaIds, next.clue.mediaId].filter((id):id is string => !!id);
      void Promise.all([...new Set(ids)].map(async id => {
        try {
          const asset = await request("/play/" + next.sessionId + "/media",
            { sessionToken: next.sessionToken, mediaId: id });
          if (active) setMedia(old => ({ ...old, [id]: asset }));
        } catch { /* Missing or restricted assets are never treated as public URLs. */ }
      }));
    }).catch(e => { if (active) setError(e instanceof Error ? e.message : msg("Could not start this quiz.","퀴즈를 시작하지 못했어요.")); })
      .finally(() => { if (active) setBusy(false); });
    return () => { active = false; };
  }, [quizId,locale]);

  async function reveal() {
    if (!session) return;
    setBusy(true); setError("");
    try {
      const result = await request("/play/" + session.sessionId + "/clue",
        { sessionToken: session.sessionToken });
      const clue = result.clue as Clue;
      setClues(old => [...old, clue]);
      setSession(old => old ? { ...old, clueIndex: result.clueIndex } : old);
      setMustReveal(false); setFeedback(""); setGuess("");
      if (clue.mediaId) {
        try {
          const asset = await request("/play/" + session.sessionId + "/media",
            { sessionToken: session.sessionToken, mediaId: clue.mediaId });
          setMedia(old => ({ ...old, [clue.mediaId!]: asset }));
        } catch { /* Keep the revealed clue even if its media cannot load. */ }
      }
    } catch (e) { setError(e instanceof Error ? e.message : msg("Could not reveal the next clue.","단서를 열지 못했어요.")); }
    finally { setBusy(false); }
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!session || !guess.trim() || mustReveal) return;
    setBusy(true); setError("");
    try {
      const result = await request("/play/" + session.sessionId + "/guess",
        { sessionToken: session.sessionToken, guess: guess.trim() });
      if (result.status === "ACTIVE") {
        setFeedback(msg("Not quite! Reveal the next clue and try again.","아직 아니야! 다음 단서를 보고 다시 추리해 봐."));
        setMustReveal(true);
      } else {
        setStatus(result.status);
        setAnswer(result.answer ?? "");
        setScore(result.score ?? 0);
        setFeedback(result.correct ? msg("Correct! You got it! 🎉","정답이야! 알아냈네! 🎉") : msg("That's the end of this quiz. Try another!","아쉽지만 이번 퀴즈는 여기까지야."));
      }
    } catch (e) { setError(e instanceof Error ? e.message : msg("Could not check your answer.","정답을 확인하지 못했어요.")); }
    finally { setBusy(false); }
  }
  useEffect(()=>{
    if(!session||status!=="ACTIVE"||busy||mustReveal||session.responseMode==="multiple-choice")return;
    if(window.matchMedia("(pointer: fine)").matches){
      answerInputRef.current?.focus({preventScroll:true});
    }
  },[session?.sessionId,session?.clueIndex,session?.responseMode,status,busy,mustReveal]);

  useEffect(()=>{
    function handleKeyboard(event:KeyboardEvent) {
      if(event.key!=="Enter"||event.repeat||event.isComposing||event.keyCode===229||
         event.altKey||event.shiftKey||busy||status!=="ACTIVE"||!session)return;
      const target=event.target;
      if(target instanceof HTMLElement){
        const interactive=target.closest('input,textarea,select,a,button,[role="button"],[contenteditable="true"]');
        if(interactive&&interactive!==answerInputRef.current)return;
      }
      if(event.ctrlKey||event.metaKey){
        if(session.clueIndex<session.clueCount){event.preventDefault();void reveal();}
        return;
      }
      if(!mustReveal&&guess.trim()){
        if(target!==answerInputRef.current){
          event.preventDefault();guessFormRef.current?.requestSubmit();
        }
      }else if(session.clueIndex<session.clueCount){
        event.preventDefault();void reveal();
      }
    }
    window.addEventListener("keydown",handleKeyboard);
    return ()=>window.removeEventListener("keydown",handleKeyboard);
  },[session,status,busy,mustReveal,guess]);

  function clueMedia(id: string, reveal?:RevealSettings) {
    const asset = media[id];
    if (!asset) return <p className="muted">{msg("Could not load this media.","미디어를 불러올 수 없어요.")}</p>;
    if (asset.kind === "image") return reveal ?
      <ImageReveal src={asset.url} alt={msg("Revealing quiz image","점차 드러나는 퀴즈 이미지")} reveal={reveal}/> :
      <img className="round-media" src={asset.url} alt={msg("Quiz clue image","퀴즈 단서 이미지")}/>;
    if (asset.kind === "audio") return <audio className="round-audio" src={asset.url} controls preload="none"/>;
    if (asset.kind === "video") return <video className="round-media" src={asset.url} controls preload="metadata"/>;
    return null;
  }
  return <main className="container inner-page discover-solo">
    <span className="eyebrow">QUIZDIP · PLAY</span>
    <Link className="card-link" href={localizeHref("/discover",locale)}>{msg("← Discover more quizzes","← 다른 퀴즈 둘러보기")}</Link>
    {busy && !session && <p className="muted" role="status">{msg("Preparing your quiz…","퀴즈를 준비하고 있어요…")}</p>}
    {session && <section className="play-panel" aria-live="polite">
      <div className="play-top">
        <span className="small-tag">{msg("Progressive clues","단계별 단서")}</span>
        <span className="clue-count">{msg("Clue ","단서 ")}{session.clueIndex} / {session.clueCount}</span>
        <RatingBadge ratings={session.ratings}/>
      </div>
      <h1>{session.title}</h1>
      <h2>{session.prompt}</h2>
      {session.promptMediaIds.length > 0 && <div className="clue-media-list">
        {session.promptMediaIds.map(id => <div key={id}>{clueMedia(id)}</div>)}
      </div>}
      <ol className="clue-list">
        {clues.map((clue, index) => {
          const stage=activeImageStage(clues,index);
          if(!stage&&!clue.text&&!clue.map)return null;
          return <li key={index} style={{counterSet:`clue ${index}`}}>
          {clue.text && <p>{clue.text}</p>}
          {stage?.mediaId && clueMedia(stage.mediaId,stage.type==="image-reveal"?stage.reveal:undefined)}
          {clue.type === "map" && clue.map && <div className="map-clue">
            <a target="_blank" rel="noopener noreferrer"
              href={"https://www.openstreetmap.org/?mlat=" + clue.map.latitude +
                "&mlon=" + clue.map.longitude + "#map=" + (clue.map.zoom ?? 8) +
                "/" + clue.map.latitude + "/" + clue.map.longitude}>{msg("View map clue ↗","지도 단서 보기 ↗")}</a>
          </div>}
        </li>})}
      </ol>
      {status === "ACTIVE" && session.clueIndex < session.clueCount &&
        <button type="button" className="btn btn-outline" disabled={busy}
          onClick={() => void reveal()}>{msg("Reveal another clue","힌트 하나 더 볼까?")}</button>}
      {status === "ACTIVE" && <form ref={guessFormRef} className="guess-form" onSubmit={e => void submit(e)}>
        <label id="single-quiz-answer-label">{msg("What's your answer?","정답은 무엇일까요?")}</label>
        {session.responseMode==="multiple-choice"&&session.options?.length?
          <div className="guess-option-grid" role="group" aria-labelledby="single-quiz-answer-label">
            {session.options.map((option,index)=><button key={option} type="button"
              className={"guess-option"+(guess===option?" selected":"")} aria-pressed={guess===option}
              disabled={busy||mustReveal} onClick={()=>setGuess(option)}>
              <span className="guess-option-letter">{String.fromCharCode(65+index)}</span>{option}
            </button>)}
          </div>:
          <input ref={answerInputRef} className="guess-input" id="single-quiz-answer" aria-labelledby="single-quiz-answer-label" maxLength={200} autoComplete="off"
            value={guess} onChange={e=>setGuess(e.target.value)}
            disabled={busy||mustReveal} placeholder={msg("Type your answer","정답을 입력해 봐")}/>}
        <div className="guess-row">
          <button className="btn btn-primary" type="submit"
            disabled={busy || mustReveal || !guess.trim()}>{msg("Check answer","정답 확인")}</button>
        </div>
        {mustReveal && <p className="muted">{msg("Reveal another clue before trying again.","새로운 단서를 열면 다시 답할 수 있어요.")}</p>}
      </form>}
      {status === "ACTIVE" && <p className="play-keyboard-help"><span aria-hidden="true">⌨</span> <kbd>Enter</kbd> {msg("Check answer · empty field: next clue","정답 확인 · 빈칸이면 다음 단서")} <span className="shortcut-divider">·</span> <kbd>Ctrl/⌘ + Enter</kbd> {msg("Reveal next clue","다음 단서")}</p>}
      {feedback && <div className={"feedback" + (status === "SOLVED" ? " success" : "")} role="status">
        {feedback}
        {status !== "ACTIVE" && <p>{msg("Answer: ","정답: ")}<strong>{answer}</strong> · {score}{msg(" pts","점")}</p>}
      </div>}
      {status !== "ACTIVE" && <div className="single-rating-review">
        <h3>{msg("How was this quiz?","이 문제는 어땠나요?")}</h3>
        <RatingButtons quizId={quizId} locale={locale} initialRating={session.myRating} access={session.ratingAccess}
          onSaved={(ratings,value)=>setSession(old=>old?{...old,ratings,myRating:value}:old)}/>
        {session.isTranslation&&<div className="translation-quality-feedback">
          <p className="muted">{locale==="ko"?"번역은 자연스럽고 정확했나요?":"Was the translation clear and accurate?"}</p>
          <RatingButtons quizId={quizId} locale={locale} kind="TRANSLATION" initialRating={session.myTranslationRating??null} access={session.ratingAccess}
            onSaved={(_rating,value)=>setSession(old=>old?{...old,myTranslationRating:value}:old)}/>
        </div>}
        {session.ratingAccess==="SIGN_IN"&&<RatingSignIn destination={localizeHref("/play/"+quizId,locale)}/>}
      </div>}
      {status !== "ACTIVE" && <div className="actions">
        <Link className="btn btn-primary" href={localizeHref("/discover",locale)}>{msg("Discover more quizzes →","다른 퀴즈 발견하기 →")}</Link>
        <Link className="btn btn-outline" href={localizeHref("/play",locale)}>{msg("Play five random quizzes","랜덤 5문제 도전하기")}</Link>
      </div>}
    </section>}
    {error && <p className="feedback" role="alert">{error}</p>}
  </main>;
}
