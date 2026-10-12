"use client";

import Link from "next/link";
import { ImageReveal, supersededReveal, type RevealSettings } from "../../../src/components/image-reveal";
import { useLocale } from "../../../src/i18n/provider";
import { localizeHref } from "../../../src/i18n/core";
import { bilingual } from "../../../src/i18n/view-copy";
import { RatingBadge, RatingButtons, RatingSignIn, type RatingAccess } from "../../../src/components/quiz-ratings";
import type { RatingSummary } from "../../../src/modules/quiz/rating-metadata";
import { useCallback, useEffect, useState } from "react";

type Lane = "GENERAL" | "KIDS";
type Mode = "RANDOM_FIVE" | "INFINITE";
type Clue = { id?: string; type: "text"|"image"|"image-reveal"|"audio"|"video"|"map";
  text?: string; mediaId?: string; reveal?:RevealSettings; map?: {latitude:number;longitude:number;zoom?:number} };
type RunInfo = {runId:string;runToken:string;mode:Mode;lane:Lane;
  completed:number;score:number;status:"ACTIVE"|"FINISHED";total:number|null;official?:boolean;
  solved?:number;failed?:number;exhausted?:boolean;message?:string};
type Round = RunInfo & {sessionId:string;sessionToken:string;round:number;quizId:string;title:string;
  prompt:string;promptMediaIds:string[];clues:Clue[];clueIndex:number;clueCount:number;
  sessionStatus:string;canGuess?:boolean;ratings?:RatingSummary;myRating?:number|null;ratingAccess?:RatingAccess};
type FeedbackItem = {quizId:string;round:number;title:string;ratings:RatingSummary;myRating:number|null;ratingAccess:RatingAccess;isTranslation?:boolean;myTranslationRating?:number|null};
type MediaPreview = {url:string;kind:string;mimeType:string;mediaId:string};

async function api(path:string, method:"GET"|"POST"="GET",body?:unknown,locale:"en"|"ko"="en"):Promise<any> {
  const response=await fetch("/api/v1"+path,{
    method,credentials:"same-origin",cache:"no-store",
    headers:body!==undefined?{"Content-Type":"application/json"}:undefined,
    body:body!==undefined?JSON.stringify(body):undefined,
  });
  const data=await response.json().catch(()=>({}));
  if(!response.ok) {
    const code=data.error;
    if(code==="not_enough_questions") throw new Error(data.message||bilingual(locale,"There aren't enough unseen quizzes. Come back when new ones are published.","새로운 문제가 충분하지 않아요. 새 퀴즈가 공개되면 다시 즐겨 주세요."));
    if(code==="question_suspended") throw new Error(bilingual(locale,"Play is temporarily paused while this question is reviewed.","문제 안전성 검토로 플레이가 잠시 중단됐어요."));
    if(code==="run_expired"||code==="week_closed") throw new Error(bilingual(locale,"This challenge has ended. Start a new one.","진행 기간이 끝났어요. 새 도전을 시작해 주세요."));
    throw new Error(data.message || code || bilingual(locale,"Something went wrong. Please try again.","요청을 처리하지 못했어요."));
  }
  return data.data;
}

const SEEN_KEY="quizdip-played-quiz-ids-v1";
function rememberedQuizzes():string[] {
  try {
    const ids=JSON.parse(localStorage.getItem(SEEN_KEY)||"[]");
    return Array.isArray(ids)?ids.filter((id):id is string=>
      typeof id==="string"&&/^[a-f0-9-]{36}$/i.test(id)).slice(-1000):[];
  } catch {return [];}
}
function rememberQuiz(id:string) {
  try {localStorage.setItem(SEEN_KEY,JSON.stringify([...new Set([...rememberedQuizzes(),id])].slice(-1000)));}
  catch { /* Device-only fallback; signed-in histories remain server-authoritative. */ }
}
function MediaPart({item,reveal}:{item:MediaPreview;reveal?:RevealSettings}) {
  const locale=useLocale();
  if(item.kind==="image") return reveal ?
    <ImageReveal src={item.url} reveal={reveal} alt={bilingual(locale,"Revealing quiz image","점차 드러나는 퀴즈 이미지")}/> :
    <img className="round-media" src={item.url} alt={bilingual(locale,"Published quiz clue image","공개된 단서 이미지")}/>;
  if(item.kind==="audio") return <audio controls src={item.url} preload="none" className="round-audio"/>;
  if(item.kind==="video") return <video controls src={item.url} preload="metadata" className="round-media"/>;
  return null;
}

export default function PlayPage() {
  const locale = useLocale();
  const msg=(en:string,ko:string)=>bilingual(locale,en,ko);
  const request=(path:string,method:"GET"|"POST"="GET",body?:unknown)=>api(path,method,body,locale);
  const [lane,setLane]=useState<Lane>("GENERAL");
  const [run,setRun]=useState<RunInfo|null>(null);
  const [round,setRound]=useState<Round|null>(null);
  const [guess,setGuess]=useState("");
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const [feedback,setFeedback]=useState("");
  const [answer,setAnswer]=useState("");
  const [roundScore,setRoundScore]=useState(0);
  const [mustReveal,setMustReveal]=useState(false);
  const [media,setMedia]=useState<Record<string,MediaPreview>>({});
  const [myHistory,setMyHistory]=useState<RunInfo[]>([]);
  const [mode,setMode]=useState<Mode>("RANDOM_FIVE");
  const [questionsToRate,setQuestionsToRate]=useState<FeedbackItem[]>([]);
  const [ratingBusy,setRatingBusy]=useState(false);
  const [ratingError,setRatingError]=useState("");

  useEffect(()=>{
    // Deep links from Kids and campaigns must preserve the audience selection.
    if(new URLSearchParams(window.location.search).get("lane")==="KIDS") setLane("KIDS");
  },[]);

  useEffect(()=>{
    let alive=true;
    setRun(null);setRound(null);setError("");setFeedback("");setMedia({});
    void request("/runs?limit=5").then(value=>{if(alive)setMyHistory(value.items||[])}).catch(()=>{});
    return ()=>{alive=false;};
  },[lane,locale]);

  useEffect(()=>{
    if(!run||run.status!=="FINISHED"||round)return;
    let alive=true;
    setRatingBusy(true);setRatingError("");
    void request("/runs/"+run.runId+"/feedback","POST",{runToken:run.runToken})
      .then(data=>{if(alive)setQuestionsToRate(data.items??[]);})
      .catch(e=>{if(alive)setRatingError(e instanceof Error?e.message:msg("Could not load the questions for review.","평가할 문제를 불러오지 못했어요."));})
      .finally(()=>{if(alive)setRatingBusy(false);});
    return ()=>{alive=false;};
  },[run?.runId,run?.status,round]);

  const showRound=useCallback(async (r:RunInfo) => {
    const data=await request("/runs/"+r.runId+"/current","POST",{runToken:r.runToken,avoidQuizIds:rememberedQuizzes(),locale});
    if(data.status==="FINISHED" && !data.sessionId){
      setRun({...r,...data});setRound(null);setFeedback("");setMedia({});
      return;
    }
    const next=data as Round;
    rememberQuiz(next.quizId);
    setRun({...r,...data});setRound(next);setGuess("");setFeedback("");setAnswer("");setRoundScore(0);
    setMustReveal(!next.canGuess);
    setMedia({});
    const ids=[...(next.promptMediaIds||[]),...next.clues.map(c=>c.mediaId).filter((x):x is string=>!!x)];
    await Promise.all([...new Set(ids)].map(async mediaId=>{
      try{
        const asset=await request("/play/"+next.sessionId+"/media","POST",{sessionToken:next.sessionToken,mediaId});
        setMedia(previous=>({...previous,[mediaId]:asset}));
      }catch{/* Missing or revoked media is shown as unavailable, never expose a storage key. */}
    }));
  },[]);

  async function start(nextMode:Mode) {
    setBusy(true);setError("");setFeedback("");setQuestionsToRate([]);setRatingError("");
    try{
      const value=await request("/runs","POST",{mode:nextMode,lane,avoidQuizIds:rememberedQuizzes(),locale});
      setMode(nextMode);setRun(value);
      await showRound(value);
    }catch(e){setError(e instanceof Error?e.message:msg("Could not start the challenge.","시작할 수 없어요."));}
    finally{setBusy(false);}
  }

  async function reveal() {
    if(!round)return;
    setBusy(true);setError("");
    try{
      await request("/play/"+round.sessionId+"/clue","POST",{sessionToken:round.sessionToken});
      await showRound(run!);setMustReveal(false);
    }catch(e){setError(e instanceof Error?e.message:msg("Could not reveal the next clue.","다음 단서를 열지 못했어요."));}
    finally{setBusy(false);}
  }
  async function check(event:React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if(!round||!guess.trim())return;
    setBusy(true);setError("");
    try{
      const result=await request("/play/"+round.sessionId+"/guess","POST",
        {sessionToken:round.sessionToken,guess:guess.trim()});
      if(result.status==="ACTIVE"){
        setFeedback(msg("Not quite. Reveal the next clue and try again.","아쉬워요. 다음 단서를 열어서 다시 맞혀 보세요."));
        setMustReveal(true);
      }else{
        setFeedback(result.correct?msg("Correct! 🎉","정답이에요! 🎉"):msg("That's the end of this question.","아쉽지만 이번 문제는 여기까지예요."));
        setAnswer(result.answer||"");setRoundScore(result.score||0);
        setRound({...round,sessionStatus:result.status});
        setRun(previous=>previous?{
          ...previous,completed:previous.completed+1,score:previous.score+(result.score||0),
          solved:(previous.solved||0)+(result.correct?1:0),failed:(previous.failed||0)+(result.correct?0:1),
          status:previous.total!==null&&previous.completed+1>=previous.total?"FINISHED":"ACTIVE"
        }:null);
      }
    }catch(e){setError(e instanceof Error?e.message:msg("Could not check your answer.","정답을 확인하지 못했어요."));}
    finally{setBusy(false);}
  }
  async function nextRound(){
    if(!run)return;
    setBusy(true);setError("");
    try{await showRound(run);}
    catch(e){setError(e instanceof Error?e.message:msg("Could not load the next question.","다음 문제를 불러오지 못했어요."));}
    finally{setBusy(false);}
  }
  async function finishInfinite(){
    if(!run)return;
    setBusy(true);setError("");
    try{
      const result=await request("/runs/"+run.runId+"/finish","POST",{runToken:run.runToken,confirm:true});
      setRun({...run,...result});setRound(null);
    }catch(e){setError(e instanceof Error?e.message:msg("Could not finish your game.","종료할 수 없어요."));}
    finally{setBusy(false);}
  }

  const isDone=!!round&&round.sessionStatus!=="ACTIVE";
  const endReached=!!run&&(run.status==="FINISHED")&&(!round||isDone);
  return <main className="container inner-page play-experience">
    <div className="play-intro">
      <span className="eyebrow">QUIZDIP · PLAY</span>
      <h1>{msg("Discover and play at your pace.","흥미로운 퀴즈를 발견하고 자유롭게 플레이하세요.")}</h1>
      <p className="lead">{msg("Try five quick questions, keep exploring at random, or find quiz packs in Discover.","가볍게 랜덤 5문제로 시작하거나 계속 풀어보세요. Discover에서 다양한 퀴즈팩을 탐색할 수도 있어요.")}</p>
    </div>

    <div className="lane-picker" role="group" aria-label={msg("Play audience","플레이 대상 선택")}>
      <button type="button" disabled={busy} aria-pressed={lane==="GENERAL"}
        className={"lane-choice "+(lane==="GENERAL"?"active":"")} onClick={()=>setLane("GENERAL")}>{msg("General play","일반 플레이")}</button>
      <button type="button" disabled={busy} aria-pressed={lane==="KIDS"}
        className={"lane-choice "+(lane==="KIDS"?"active":"")} onClick={()=>setLane("KIDS")}>{msg("Kids play","어린이 플레이")}</button>
    </div>

    {!run && <>
      <section className="play-practice">
        <h2>{msg("Free play","자유 플레이")}</h2>
        <div className="cards">
          <article className="feature-card">
            <span className="symbol mint">5</span><h3>{msg("Quick start · five questions","가볍게 시작 · 랜덤 5문제")}</h3>
            <p>{msg("Choose five quizzes you haven't seen. Finish and unlock five more.","아직 보지 않은 다섯 문제를 골라요. 완료하면 새로운 다섯 문제를 더 즐길 수 있어요.")}</p>
            <button className="btn btn-primary" disabled={busy} onClick={()=>void start("RANDOM_FIVE")}>{msg("Start five quizzes →","5문제 시작하기 →")}</button>
          </article>
          <article className="feature-card">
            <span className="symbol yellow">∞</span><h3>{msg("Continuous random play","랜덤 연속 플레이")}</h3>
            <p>{msg("Keep playing until you run out of new questions, with no repeats.","원한다면 계속 풀 수 있어요. 새로운 문제가 소진되면 반복 없이 끝나요.")}</p>
            <button className="btn btn-outline" disabled={busy} onClick={()=>void start("INFINITE")}>{msg("Continue playing","이어 풀기")}</button>
          </article>
        </div>
      </section>
      <p className="play-discover-link"><Link href={localizeHref("/discover", locale)}>{msg("Explore questions and quiz packs →","문제와 퀴즈팩 둘러보기 →")}</Link></p>

      {myHistory.length>0&&<section className="play-recent">
        <h2>{msg("My recent games","최근 내 기록")}</h2>
        <div className="recent-results">
          {myHistory.map(item=><p key={item.runId}>
            {item.mode==="WEEKLY"?msg("Past weekly game","이전 주간 플레이"):item.mode==="INFINITE"?msg("Continuous play","연속 플레이"):msg("Quick five","랜덤 5문제")}
            {" · "}{item.score}{msg(" pts · ","점 · ")}{item.completed}{msg(" quizzes · ","문제 ")}{item.status==="FINISHED"?msg("Finished","완료"):msg("In progress","진행 중")}
          </p>)}
        </div>
      </section>}
    </>}

    {run&&<section className="play-panel play-live" aria-live="polite">
      <div className="play-top">
        <span className="small-tag">{mode==="RANDOM_FIVE"?msg("Quick five","랜덤 5문제"):msg("Continuous play","연속 플레이")}</span>
        <span className="clue-count">{run.completed}{msg(" quizzes finished · ","문제 완료 · ")}{run.score}{msg(" pts","점")}</span>
      </div>
      {round?<>
        <div className="round-progress"><span>{msg("Question ","문제 ")}{round.round}{run.total?" / "+run.total:""} </span>
          <span>{msg("Clue ","단서 ")}{round.clueIndex} / {round.clueCount}</span></div>
        <RatingBadge ratings={round.ratings}/>
        <h2>{round.prompt}</h2>
        {!!round.promptMediaIds?.length&&<div className="clue-media-list">
          {round.promptMediaIds.map(id=><div key={id}>{media[id]?<MediaPart item={media[id]}/>:<p className="muted">{msg("Couldn't load the media.","미디어를 불러올 수 없어요.")}</p>}</div>)}
        </div>}
        <ol className="clue-list">
          {round.clues.map((clue,i)=>supersededReveal(round.clues,i)?null:<li key={clue.id||i} style={{counterSet:`clue ${i}`}}>
            {clue.text&&<p>{clue.text}</p>}
            {clue.type==="map"&&clue.map&&<div className="map-clue">
              <span>{msg("Map clue · latitude ","지도 단서 · 위도 ")}{clue.map.latitude}{msg(", longitude ",", 경도 ")}{clue.map.longitude}</span>
              <a href={`https://www.openstreetmap.org/?mlat=${clue.map.latitude}&mlon=${clue.map.longitude}#map=${clue.map.zoom||8}/${clue.map.latitude}/${clue.map.longitude}`}
                target="_blank" rel="noopener noreferrer">{msg("View map ↗","지도에서 보기 ↗")}</a>
            </div>}
            {clue.mediaId&&(media[clue.mediaId]?<MediaPart item={media[clue.mediaId]} reveal={clue.type==="image-reveal"?clue.reveal:undefined}/>:<p className="muted">{msg("Media is unavailable.","미디어가 제공되지 않았어요.")}</p>)}
          </li>)}
        </ol>
        {!isDone&&round.clueIndex<round.clueCount&&
          <button type="button" className="btn btn-outline" disabled={busy} onClick={()=>void reveal()}>
            {msg("Reveal another clue","단서 하나 더 보기")}</button>}
        {!isDone&&<form className="guess-form" onSubmit={e=>void check(e)}>
          <label htmlFor="quizdip-answer">{msg("What's your answer?","정답은 무엇일까요?")}</label>
          <div className="guess-row">
            <input id="quizdip-answer" value={guess} onChange={e=>setGuess(e.target.value)}
              autoComplete="off" placeholder={msg("Enter your answer","정답을 입력해 보세요")} maxLength={200}
              disabled={busy||mustReveal}/>
            <button type="submit" className="btn btn-primary" disabled={busy||mustReveal||!guess.trim()}>
              {msg("Check answer","정답 확인")}</button>
          </div>
        </form>}
        {feedback&&<div className={"feedback "+(answer&&roundScore>0?"success":"")} role="status">
          {feedback}{answer&&<p>{msg("Answer: ","정답: ")}<strong>{answer}</strong> · {roundScore}{msg(" pts","점")}</p>}
        </div>}
        {isDone&&<button type="button" className="btn btn-primary" disabled={busy} onClick={()=>void nextRound()}>
          {endReached?msg("View final results →","최종 결과 보기 →"):msg("Next question →","다음 문제 →")}
        </button>}
      </>:<>
        <div className="round-finish">
          <div className="round-finish-symbol">✦</div>
          <h2>{msg("Challenge complete!","이번 도전 완료!")}</h2>
          <p>{msg("Total ","총 ")}<strong>{run.score}{msg(" pts","점")}</strong> · {run.completed}{msg(" quizzes · ","문제 · ")}{msg("Correct ","정답 ")}{run.solved||0}</p>
          {run.exhausted&&<p>{msg("You've finished all available new questions. Come back for more.","새로운 문제를 모두 풀었어요. 새 퀴즈가 등록되면 다시 즐겨 주세요.")}</p>}
          <div className="run-rating-review">
            <h3>{msg("How were those quizzes?","방금 풀었던 문제는 어땠나요?")}</h3>
            <p className="muted">{msg("Rate the quizzes after the game to keep the flow uninterrupted. Feedback is optional.","흐름을 끊지 않도록 게임이 끝난 뒤 모았어요. 평가는 선택 사항이에요.")}</p>
            {ratingBusy&&<p role="status">{msg("Loading questions to rate…","평가할 문제를 불러오는 중…")}</p>}
            {ratingError&&<p className="feedback" role="alert">{ratingError}</p>}
            {!ratingBusy&&!ratingError&&questionsToRate.length===0&&<p className="muted">{msg("No completed questions to rate yet.","평가할 완료 문제가 없어요.")}</p>}
            {questionsToRate.map(q=><div className="run-rating-row" key={q.quizId}>
              <div className="run-rating-question"><strong>{q.round}. {q.title}</strong>
                <RatingBadge ratings={q.ratings}/></div>
              <RatingButtons quizId={q.quizId} locale={locale} initialRating={q.myRating} access={q.ratingAccess}
                onSaved={(ratings,value)=>setQuestionsToRate(old=>old.map(row=>row.quizId===q.quizId?{...row,ratings,myRating:value}:row))}/>
              {q.isTranslation&&<div className="translation-quality-feedback">
                <p className="muted">{locale==="ko"?"번역 품질":"Translation quality"}</p>
                <RatingButtons quizId={q.quizId} locale={locale} kind="TRANSLATION"
                  initialRating={q.myTranslationRating??null} access={q.ratingAccess}
                  onSaved={(_rating,value)=>setQuestionsToRate(old=>old.map(row=>row.quizId===q.quizId?{...row,myTranslationRating:value}:row))}/>
              </div>}
            </div>)}
            {questionsToRate.some(q=>q.ratingAccess==="SIGN_IN")&&<RatingSignIn destination={localizeHref("/play", locale)}/>}
          </div>
          {run.mode==="RANDOM_FIVE"&&<button type="button" className="btn btn-primary"
            disabled={busy} onClick={()=>void start("RANDOM_FIVE")}>{msg("Play five more →","새로운 5문제 더 풀기 →")}</button>}
        </div>
      </>}
      <div className="play-bottom">
        {run.mode==="INFINITE"&&!endReached&&
          <button type="button" className="text-button" disabled={busy} onClick={()=>void finishInfinite()}>{msg("End continuous play","무한 플레이 끝내기")}</button>}
        <button type="button" className="text-button" onClick={()=>{setRun(null);setRound(null);setFeedback("");setError("");}}>{msg("Back to game modes","모드 선택으로 돌아가기")}</button>
      </div>
    </section>}

    {error&&<p className="feedback" role="alert">{error}</p>}

    {lane==="KIDS"&&<p className="muted">{msg("Kids play only includes safety-approved questions and never displays public individual rankings.","어린이 모드는 플랫폼에서 안전성을 확인한 문제만 제공하고, 공개 개인 순위는 표시하지 않아요.")}</p>}
    <div className="play-bottom"><Link href={localizeHref("/discover", locale)}>{msg("Discover more quizzes →","다른 퀴즈 둘러보기 →")}</Link><Link href={localizeHref("/studio", locale)}>{msg("Create your own quiz →","퀴즈 만들기 →")}</Link></div>
  </main>;
}
