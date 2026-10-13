"use client";

import Link from "next/link";
import { ImageReveal, type RevealSettings } from "../../../src/components/image-reveal";
import { activeImageStage } from "@quizdip/domain";
import { useLocale } from "../../../src/i18n/provider";
import { localizeHref } from "../../../src/i18n/core";
import { bilingual } from "../../../src/i18n/view-copy";
import { RatingBadge, RatingButtons, RatingSignIn, type RatingAccess } from "../../../src/components/quiz-ratings";
import PackFeedback, { PackShare } from "../../../src/components/pack-feedback";
import type { RatingSummary } from "../../../src/modules/quiz/rating-metadata";
import { useCallback, useEffect, useRef, useState } from "react";

type Lane = "GENERAL" | "KIDS";
type Mode = "RANDOM_FIVE" | "INFINITE" | "PACK";
type Clue = { id?: string; type: "text"|"image"|"image-reveal"|"audio"|"video"|"map";
  text?: string; mediaId?: string; reveal?:RevealSettings; map?: {latitude:number;longitude:number;zoom?:number} };
type RunInfo = {runId:string;runToken:string;mode:Mode;lane:Lane;packId?:string|null;packVersion?:number|null;
  completed:number;score:number;status:"ACTIVE"|"FINISHED";total:number|null;official?:boolean;
  solved?:number;failed?:number;exhausted?:boolean;message?:string};
type Round = RunInfo & {sessionId:string;sessionToken:string;round:number;quizId:string;title:string;
  prompt:string;promptMediaIds:string[];clues:Clue[];clueIndex:number;clueCount:number;
  sessionStatus:string;canGuess?:boolean;responseMode?:"text"|"multiple-choice";options?:string[];ratings?:RatingSummary;myRating?:number|null;ratingAccess?:RatingAccess};
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

export default function PlayPage({packId}:{packId?:string}={}) {
  const locale = useLocale();
  const msg=(en:string,ko:string)=>bilingual(locale,en,ko);
  const request=(path:string,method:"GET"|"POST"="GET",body?:unknown)=>api(path,method,body,locale);
  const [lane,setLane]=useState<Lane>("GENERAL");
  const [pack,setPack]=useState<{id:string;title:string;description:string;questionCount:number;author:{displayName:string}}|null>(null);
  const [run,setRun]=useState<RunInfo|null>(null);
  const [round,setRound]=useState<Round|null>(null);
  const [guess,setGuess]=useState("");
  const answerInputRef=useRef<HTMLInputElement>(null);
  const guessFormRef=useRef<HTMLFormElement>(null);
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
    if(!packId&&new URLSearchParams(window.location.search).get("lane")==="KIDS") setLane("KIDS");
  },[]);

  useEffect(()=>{
    let alive=true;
    setRun(null);setRound(null);setError("");setFeedback("");setMedia({});
    if(!packId)void request("/runs?limit=5").then(value=>{if(alive)setMyHistory(value.items||[])}).catch(()=>{});
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
      if(packId)try{sessionStorage.removeItem("quizdip-pack-run:"+packId+":"+locale)}catch{}
      setRun({...r,...data});setRound(null);setFeedback("");setMedia({});
      return;
    }
    const next=data as Round;
    if(packId)try{sessionStorage.setItem("quizdip-pack-run:"+packId+":"+locale,JSON.stringify({runId:r.runId,runToken:r.runToken,mode:"PACK",lane:"GENERAL",completed:r.completed,total:r.total,score:r.score,status:"ACTIVE"}))}catch{}
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
  },[packId,locale]);

  useEffect(()=>{
    if(!packId)return;
    let active=true;
    setMode("PACK");setLane("GENERAL");
    void request("/packs/"+packId+"?locale="+locale).then(value=>{
      if(active)setPack(value);
    }).catch(e=>{if(active)setError(e instanceof Error?e.message:String(e));});
    // Guest capabilities only persist in the same browser tab. Signed-in users
    // can additionally resume from a different device via POST /runs PACK.
    try {
      const saved=sessionStorage.getItem("quizdip-pack-run:"+packId+":"+locale);
      if(saved){
        const r=JSON.parse(saved) as RunInfo;
        if(r.mode==="PACK"&&r.runId&&r.runToken){
          void showRound(r).catch(()=>{
            sessionStorage.removeItem("quizdip-pack-run:"+packId+":"+locale);
            if(active)setError(msg("Saved progress is no longer available. You can restart the pack.","저장한 진행 기록을 사용할 수 없어요. 퀴즈팩을 다시 시작할 수 있어요."));
          });
        }
      }
    }catch{/* Unavailable storage never prevents public play. */}
    return ()=>{active=false};
  },[packId,locale,showRound]);

  async function start(nextMode:Mode, restart=false) {
    setBusy(true);setError("");setFeedback("");setQuestionsToRate([]);setRatingError("");
    try{
      const value=await request("/runs","POST",{mode:nextMode,lane:packId?"GENERAL":lane,
        ...(nextMode==="PACK"?{packId,restart}:{avoidQuizIds:rememberedQuizzes()}),locale});
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

  // Keep a physical-keyboard player in the answer field after each new clue/round,
  // without opening the virtual keyboard unexpectedly on a touch device.
  useEffect(()=>{
    if(!round||isDone||busy||mustReveal||round.responseMode==="multiple-choice")return;
    if(window.matchMedia("(pointer: fine)").matches){
      answerInputRef.current?.focus({preventScroll:true});
    }
  },[round?.quizId,round?.clueIndex,round?.responseMode,isDone,busy,mustReveal]);

  useEffect(()=>{
    function handleKeyboard(event:KeyboardEvent) {
      // Enter can also commit a Korean/other IME candidate: never treat that as an answer or action.
      if(event.key!=="Enter"||event.repeat||event.isComposing||event.keyCode===229||
         event.altKey||event.shiftKey||busy||!round)return;
      const target=event.target;
      if(target instanceof HTMLElement){
        const interactive=target.closest('input,textarea,select,a,button,[role="button"],[contenteditable="true"]');
        if(interactive&&interactive!==answerInputRef.current)return;
      }
      // Ctrl/Command+Enter advances without submitting an answer, even when one is typed.
      if(event.ctrlKey||event.metaKey){
        if(isDone){event.preventDefault();void nextRound();}
        else if(round.clueIndex<round.clueCount){event.preventDefault();void reveal();}
        return;
      }
      if(isDone){event.preventDefault();void nextRound();return;}
      if(!mustReveal&&guess.trim()){
        // Native Enter submits the focused text input. Otherwise submit the selected choice.
        if(target!==answerInputRef.current){
          event.preventDefault();guessFormRef.current?.requestSubmit();
        }
      }else if(round.clueIndex<round.clueCount){
        // Empty input (or a locked input after a wrong guess): reveal the next clue.
        event.preventDefault();void reveal();
      }
    }
    window.addEventListener("keydown",handleKeyboard);
    return ()=>window.removeEventListener("keydown",handleKeyboard);
  },[round,isDone,busy,mustReveal,guess]);

  return <main className="container inner-page play-experience">
    <div className="play-intro">
      <span className="eyebrow">QUIZDIP · PLAY</span>
      <h1>{packId?(pack?.title||msg("Quiz pack","퀴즈팩")):msg("Discover and play at your pace.","흥미로운 퀴즈를 발견하고 자유롭게 플레이하세요.")}</h1>
      <p className="lead">{packId?(pack?.description||msg("Play every question in this creator-curated collection.","제작자가 구성한 모든 문제를 순서대로 플레이하세요.")):msg("Try five quick questions, keep exploring at random, or find quiz packs in Discover.","가볍게 랜덤 5문제로 시작하거나 계속 풀어보세요. Discover에서 다양한 퀴즈팩을 탐색할 수도 있어요.")}</p>
    </div>

    {!packId&&<div className="lane-picker" role="group" aria-label={msg("Play audience","플레이 대상 선택")}>
      <button type="button" disabled={busy} aria-pressed={lane==="GENERAL"}
        className={"lane-choice "+(lane==="GENERAL"?"active":"")} onClick={()=>setLane("GENERAL")}>{msg("General play","일반 플레이")}</button>
      <button type="button" disabled={busy} aria-pressed={lane==="KIDS"}
        className={"lane-choice "+(lane==="KIDS"?"active":"")} onClick={()=>setLane("KIDS")}>{msg("Kids play","어린이 플레이")}</button>
    </div>}

    {!run&&packId&&<section className="play-practice"><article className="feature-card">
      <h2>{pack?.title||msg("Quiz pack","퀴즈팩")}</h2>
      <p>{pack?.questionCount||"—"} {msg("questions · progress is saved after every answer.","문제 · 각 문제를 풀면 진행 상황이 저장됩니다.")}</p>
      <button type="button" className="btn btn-primary" disabled={busy||!pack} onClick={()=>void start("PACK")}>{msg("Start or resume pack →","퀴즈팩 시작 / 이어 풀기 →")}</button>
      <p><Link href={localizeHref("/packs/"+packId,locale)}>{msg("Back to pack details","퀴즈팩 상세 보기")}</Link></p>
    </article></section>}

    {!run && !packId && <>
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
      <p className="play-discover-link"><Link href={localizeHref("/packs", locale)}>{msg("Explore complete quiz packs →","퀴즈팩 전체 플레이 →")}</Link> · <Link href={localizeHref("/discover", locale)}>{msg("Explore individual quizzes →","개별 문제 둘러보기 →")}</Link></p>

      {myHistory.length>0&&<section className="play-recent">
        <h2>{msg("My recent games","최근 내 기록")}</h2>
        <div className="recent-results">
          {myHistory.map(item=><p key={item.runId}>
            {item.mode==="PACK"?msg("Quiz pack","퀴즈팩"):item.mode==="INFINITE"?msg("Continuous play","연속 플레이"):msg("Quick five","랜덤 5문제")}
            {" · "}{item.score}{msg(" pts · ","점 · ")}{item.completed}{msg(" quizzes · ","문제 ")}{item.status==="FINISHED"?msg("Finished","완료"):msg("In progress","진행 중")}
            {item.mode==="PACK"&&item.packId&&<> · <Link href={localizeHref("/packs/"+item.packId+"/play",locale)}>{msg("Resume pack →","퀴즈팩 이어 풀기 →")}</Link></>}
          </p>)}
        </div>
      </section>}
    </>}

    {run&&<section className="play-panel play-live" aria-live="polite">
      <div className="play-top">
        <span className="small-tag">{mode==="PACK"?msg("Quiz pack","퀴즈팩"):mode==="RANDOM_FIVE"?msg("Quick five","랜덤 5문제"):msg("Continuous play","연속 플레이")}</span>
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
          {round.clues.map((clue,i)=>{
            const stage=activeImageStage(round.clues,i);
            if(!stage&&!clue.text&&!clue.map)return null;
            return <li key={clue.id||i} style={{counterSet:`clue ${i}`}}>
            {clue.text&&<p>{clue.text}</p>}
            {clue.type==="map"&&clue.map&&<div className="map-clue">
              <span>{msg("Map clue · latitude ","지도 단서 · 위도 ")}{clue.map.latitude}{msg(", longitude ",", 경도 ")}{clue.map.longitude}</span>
              <a href={`https://www.openstreetmap.org/?mlat=${clue.map.latitude}&mlon=${clue.map.longitude}#map=${clue.map.zoom||8}/${clue.map.latitude}/${clue.map.longitude}`}
                target="_blank" rel="noopener noreferrer">{msg("View map ↗","지도에서 보기 ↗")}</a>
            </div>}
            {stage?.mediaId&&(media[stage.mediaId]?<MediaPart item={media[stage.mediaId]} reveal={stage.type==="image-reveal"?stage.reveal:undefined}/>:<p className="muted">{msg("Media is unavailable.","미디어가 제공되지 않았어요.")}</p>)}
          </li>})}
        </ol>
        {!isDone&&round.clueIndex<round.clueCount&&
          <button type="button" className="btn btn-outline" disabled={busy} onClick={()=>void reveal()}>
            {msg("Reveal another clue","단서 하나 더 보기")}</button>}
        {!isDone&&<form ref={guessFormRef} className="guess-form" onSubmit={e=>void check(e)}>
          <label id="quizdip-answer-label">{msg("What's your answer?","정답은 무엇일까요?")}</label>
          {round.responseMode==="multiple-choice"&&round.options?.length?
            <div className="guess-option-grid" role="group" aria-labelledby="quizdip-answer-label">
              {round.options.map((option,index)=><button type="button" key={option}
                className={"guess-option"+(guess===option?" selected":"")} aria-pressed={guess===option}
                disabled={busy||mustReveal} onClick={()=>setGuess(option)}>
                <span className="guess-option-letter">{String.fromCharCode(65+index)}</span>{option}
              </button>)}
            </div>:
            <input ref={answerInputRef} className="guess-input" id="quizdip-answer" value={guess} onChange={e=>setGuess(e.target.value)}
              aria-labelledby="quizdip-answer-label" autoComplete="off" placeholder={msg("Enter your answer","정답을 입력해 보세요")}
              maxLength={200} disabled={busy||mustReveal}/>}
          <div className="guess-row">
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
        <p className="play-keyboard-help"><span aria-hidden="true">⌨</span> <kbd>Enter</kbd> {isDone?msg("Next question / results","다음 문제 / 결과 보기"):msg("Check answer · empty field: next clue","정답 확인 · 빈칸이면 다음 단서")} <span className="shortcut-divider">·</span> <kbd>Ctrl/⌘ + Enter</kbd> {isDone?msg("Next","다음"):msg("Reveal next clue","다음 단서")}</p>
      </>:<>
        <div className="round-finish">
          <div className="round-finish-symbol">✦</div>
          {run.mode==="PACK"&&packId&&<><PackFeedback packId={packId}/><PackShare path={"/packs/"+packId}/></>}
          <h2>{msg("Challenge complete!","이번 도전 완료!")}</h2>
          <p>{msg("Total ","총 ")}<strong>{run.score}{msg(" pts","점")}</strong> · {run.completed}{msg(" quizzes · ","문제 · ")}{msg("Correct ","정답 ")}{run.solved||0}</p>
          {run.exhausted&&<p>{msg("You've finished all available new questions. Come back for more.","새로운 문제를 모두 풀었어요. 새 퀴즈가 등록되면 다시 즐겨 주세요.")}</p>}
          <details className="run-rating-review" open={run.mode!=="PACK"}>
            <summary>{run.mode==="PACK"?msg("Optional: rate individual questions","선택: 개별 문제 평가"):msg("Rate finished questions","완료한 문제 평가")}</summary>
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
            {questionsToRate.some(q=>q.ratingAccess==="SIGN_IN")&&<RatingSignIn destination={localizeHref(packId?"/packs/"+packId+"/play":"/play", locale)}/>}
          </details>
          {run.mode==="PACK"&&<button type="button" className="btn btn-outline" onClick={()=>void start("PACK",true)} disabled={busy}>{msg("Play this pack again","퀴즈팩 다시 풀기")}</button>}
          {run.mode==="RANDOM_FIVE"&&<button type="button" className="btn btn-primary"
            disabled={busy} onClick={()=>void start("RANDOM_FIVE")}>{msg("Play five more →","새로운 5문제 더 풀기 →")}</button>}
        </div>
      </>}
      <div className="play-bottom">
        {run.mode==="INFINITE"&&!endReached&&
          <button type="button" className="text-button" disabled={busy} onClick={()=>void finishInfinite()}>{msg("End continuous play","무한 플레이 끝내기")}</button>}
        {packId?<Link className="text-button" href={localizeHref("/packs/"+packId,locale)}>{msg("Back to pack details","퀴즈팩 상세 보기")}</Link>:
        <button type="button" className="text-button" onClick={()=>{setRun(null);setRound(null);setFeedback("");setError("");}}>{msg("Back to game modes","모드 선택으로 돌아가기")}</button>}
      </div>
    </section>}

    {error&&<p className="feedback" role="alert">{error}</p>}

    {lane==="KIDS"&&<p className="muted">{msg("Kids play only includes safety-approved questions and never displays public individual rankings.","어린이 모드는 플랫폼에서 안전성을 확인한 문제만 제공하고, 공개 개인 순위는 표시하지 않아요.")}</p>}
    <div className="play-bottom"><Link href={localizeHref("/discover", locale)}>{msg("Discover more quizzes →","다른 퀴즈 둘러보기 →")}</Link><Link href={localizeHref("/studio", locale)}>{msg("Create your own quiz →","퀴즈 만들기 →")}</Link></div>
  </main>;
}
