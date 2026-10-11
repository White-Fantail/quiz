"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type Lane = "GENERAL" | "KIDS";
type Mode = "WEEKLY" | "RANDOM_FIVE" | "INFINITE";
type Clue = { id?: string; type: "text"|"image"|"audio"|"video"|"map";
  text?: string; mediaId?: string; map?: {latitude:number;longitude:number;zoom?:number} };
type Edition = { available:boolean; id?:string; title?:string; description?:string;
  startsAt?:string; endsAt?:string; message?:string; host?:{id:string;name:string;verified:boolean};questionCount?:number };
type RunInfo = {runId:string;runToken:string;mode:Mode;lane:Lane;weekly?:Edition|null;
  completed:number;score:number;status:"ACTIVE"|"FINISHED";total:number|null;official?:boolean;
  solved?:number;failed?:number};
type Round = RunInfo & {sessionId:string;sessionToken:string;round:number;quizId:string;title:string;
  prompt:string;promptMediaIds:string[];clues:Clue[];clueIndex:number;clueCount:number;
  sessionStatus:string};
type Ranking = {rank:number;displayName:string;score:number;solved:number};
type MediaPreview = {url:string;kind:string;mimeType:string;mediaId:string};

async function api(path:string, method:"GET"|"POST"="GET",body?:unknown):Promise<any> {
  const response=await fetch("/api/v1"+path,{
    method,credentials:"same-origin",cache:"no-store",
    headers:body!==undefined?{"Content-Type":"application/json"}:undefined,
    body:body!==undefined?JSON.stringify(body):undefined,
  });
  const data=await response.json().catch(()=>({}));
  if(!response.ok) {
    const code=data.error;
    if(code==="weekly_unavailable") throw new Error("이번 주의 공식 5문제가 아직 준비되지 않았어요.");
    if(code==="not_enough_questions") throw new Error("공개 문제가 아직 충분하지 않아요. 더 많은 문제가 등록되면 시작할 수 있어요.");
    if(code==="question_suspended") throw new Error("문제 안전성 검토로 플레이가 잠시 중단됐어요.");
    if(code==="run_expired"||code==="week_closed") throw new Error("진행 기간이 끝났어요. 새 도전을 시작해 주세요.");
    throw new Error(data.message || code || "요청을 처리하지 못했어요.");
  }
  return data.data;
}

function displayedDate(v?:string) {
  if(!v) return "";
  return new Date(v).toLocaleDateString("ko-KR",{month:"long",day:"numeric",timeZone:"UTC"});
}

function MediaPart({item}:{item:MediaPreview}) {
  if(item.kind==="image") return <img className="round-media" src={item.url} alt="공개된 단서 이미지"/>;
  if(item.kind==="audio") return <audio controls src={item.url} preload="none" className="round-audio"/>;
  if(item.kind==="video") return <video controls src={item.url} preload="metadata" className="round-media"/>;
  return null;
}

export default function PlayPage() {
  const [lane,setLane]=useState<Lane>("GENERAL");
  const [edition,setEdition]=useState<Edition|null>(null);
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
  const [ranking,setRanking]=useState<Ranking[]>([]);
  const [rankingAvailable,setRankingAvailable]=useState(false);
  const [myHistory,setMyHistory]=useState<RunInfo[]>([]);
  const [mode,setMode]=useState<Mode>("WEEKLY");

  useEffect(()=>{
    let alive=true;
    setEdition(null);setRun(null);setRound(null);setError("");setFeedback("");setMedia({});
    void api("/weekly/current?lane="+lane).then((v:Edition)=>{if(alive)setEdition(v)})
      .catch(e=>{if(alive)setError(e instanceof Error?e.message:"이번 주 정보를 불러오지 못했어요.")});
    void api("/runs?limit=5").then(value=>{if(alive)setMyHistory(value.items||[])}).catch(()=>{});
    return ()=>{alive=false;};
  },[lane]);

  useEffect(()=>{
    let alive=true;
    if(lane!=="GENERAL"||!edition?.available||!edition.id){setRanking([]);setRankingAvailable(false);return;}
    void api("/weekly/"+edition.id+"/standings?limit=10").then(data=>{
      if(alive){setRanking(data.items||[]);setRankingAvailable(true);}
    }).catch(()=>{if(alive){setRanking([]);setRankingAvailable(false);}});
    return ()=>{alive=false;};
  },[lane,edition?.available,edition?.id,round?.sessionStatus,run?.status]);

  const showRound=useCallback(async (r:RunInfo) => {
    const data=await api("/runs/"+r.runId+"/current","POST",{runToken:r.runToken});
    if(data.status==="FINISHED" && !data.sessionId){
      setRun({...r,...data});setRound(null);setFeedback("");setMedia({});
      return;
    }
    const next=data as Round;
    setRun({...r,...data});setRound(next);setGuess("");setFeedback("");setAnswer("");setRoundScore(0);
    setMustReveal(next.sessionStatus!=="ACTIVE");
    setMedia({});
    const ids=[...(next.promptMediaIds||[]),...next.clues.map(c=>c.mediaId).filter((x):x is string=>!!x)];
    await Promise.all([...new Set(ids)].map(async mediaId=>{
      try{
        const asset=await api("/play/"+next.sessionId+"/media","POST",{sessionToken:next.sessionToken,mediaId});
        setMedia(previous=>({...previous,[mediaId]:asset}));
      }catch{/* Missing or revoked media is shown as unavailable, never expose a storage key. */}
    }));
  },[]);

  async function start(nextMode:Mode) {
    setBusy(true);setError("");setFeedback("");
    try{
      const value=await api("/runs","POST",{mode:nextMode,lane});
      setMode(nextMode);setRun(value);
      await showRound(value);
    }catch(e){setError(e instanceof Error?e.message:"시작할 수 없어요.");}
    finally{setBusy(false);}
  }

  async function reveal() {
    if(!round)return;
    setBusy(true);setError("");
    try{
      await api("/play/"+round.sessionId+"/clue","POST",{sessionToken:round.sessionToken});
      await showRound(run!);setMustReveal(false);
    }catch(e){setError(e instanceof Error?e.message:"다음 단서를 열지 못했어요.");}
    finally{setBusy(false);}
  }
  async function check(event:React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if(!round||!guess.trim())return;
    setBusy(true);setError("");
    try{
      const result=await api("/play/"+round.sessionId+"/guess","POST",
        {sessionToken:round.sessionToken,guess:guess.trim()});
      if(result.status==="ACTIVE"){
        setFeedback("아쉬워요. 다음 단서를 열어서 다시 맞혀 보세요.");
        setMustReveal(true);
      }else{
        setFeedback(result.correct?"정답이에요! 🎉":"아쉽지만 이번 문제는 여기까지예요.");
        setAnswer(result.answer||"");setRoundScore(result.score||0);
        setRound({...round,sessionStatus:result.status});
        setRun(previous=>previous?{
          ...previous,completed:previous.completed+1,score:previous.score+(result.score||0),
          solved:(previous.solved||0)+(result.correct?1:0),failed:(previous.failed||0)+(result.correct?0:1),
          status:previous.mode!=="INFINITE"&&previous.completed+1>=5?"FINISHED":"ACTIVE"
        }:null);
      }
    }catch(e){setError(e instanceof Error?e.message:"정답을 확인하지 못했어요.");}
    finally{setBusy(false);}
  }
  async function nextRound(){
    if(!run)return;
    setBusy(true);setError("");
    try{await showRound(run);}
    catch(e){setError(e instanceof Error?e.message:"다음 문제를 불러오지 못했어요.");}
    finally{setBusy(false);}
  }
  async function finishInfinite(){
    if(!run)return;
    setBusy(true);setError("");
    try{
      const result=await api("/runs/"+run.runId+"/finish","POST",{runToken:run.runToken,confirm:true});
      setRun({...run,...result});setRound(null);
    }catch(e){setError(e instanceof Error?e.message:"종료할 수 없어요.");}
    finally{setBusy(false);}
  }

  const isDone=!!round&&round.sessionStatus!=="ACTIVE";
  const endReached=!!run&&(run.status==="FINISHED")&&(!round||isDone);
  return <main className="container inner-page play-experience">
    <div className="play-intro">
      <span className="eyebrow">CLUPIO · PLAY TOGETHER</span>
      <h1>같은 다섯 문제, 서로 다른 발견.</h1>
      <p className="lead">이번 주 출제자가 준비한 문제를 모두 함께 풀어요. 또는 마음껏 연습하고 놀아도 좋아요.</p>
    </div>

    <div className="lane-picker" role="group" aria-label="플레이 대상 선택">
      <button type="button" disabled={busy} aria-pressed={lane==="GENERAL"}
        className={"lane-choice "+(lane==="GENERAL"?"active":"")} onClick={()=>setLane("GENERAL")}>일반 플레이</button>
      <button type="button" disabled={busy} aria-pressed={lane==="KIDS"}
        className={"lane-choice "+(lane==="KIDS"?"active":"")} onClick={()=>setLane("KIDS")}>어린이 플레이</button>
    </div>

    {!run && <>
      <section className="weekly-spotlight">
        <div className="weekly-star" aria-hidden="true">✦</div>
        <span className="small-tag">WEEKLY FIVE · 이번 주의 메인 챌린지</span>
        {edition?.available? <>
          <h2>{edition.title}</h2>
          <p className="weekly-host">이번 주 출제자 · <strong>{edition.host?.name||"Clupio 제작자"}</strong>
            {edition.host?.verified&&<span className="host-verified">✓ 인증된 출제자</span>}</p>
          <p>{edition.description||"한 명의 출제자가 준비한 다섯 문제. 모두에게 같은 순서로 공개돼요."}</p>
          <p className="weekly-dates">{displayedDate(edition.startsAt)} – {displayedDate(edition.endsAt)} (UTC 기준) · 5문제</p>
          <button className="btn btn-primary" disabled={busy} onClick={()=>void start("WEEKLY")}>
            {busy?"불러오는 중…":"이번 주 5문제 도전하기 →"}</button>
          <p className="weekly-footnote">공식 기록은 로그인 계정당 한 번만 반영돼요. 로그인하지 않아도 같은 문제를 체험할 수 있어요.</p>
          <Link href="/sign-in?callbackURL=%2Fplay" className="text-button">공식 기록을 위해 로그인하기</Link>
        </>:<>
          <h2>{lane==="KIDS"?"이번 주 어린이 챌린지를 준비하고 있어요":"이번 주 출제자를 기다리고 있어요"}</h2>
          <p>{edition?.message||"주간 문제 정보를 확인하고 있어요."}</p>
          <p>운영자가 이번 주의 공식 5문제를 확정하면 여기에서 모두가 함께 풀 수 있어요.</p>
        </>}
      </section>

      <section className="play-practice">
        <h2>다른 플레이 방법</h2>
        <div className="cards">
          <article className="feature-card">
            <span className="symbol mint">5</span><h3>랜덤 5문제</h3>
            <p>새로운 다섯 문제를 무작위로 골라 연습해요. 매번 다른 구성이에요.</p>
            <button className="btn btn-outline" disabled={busy} onClick={()=>void start("RANDOM_FIVE")}>5문제 시작</button>
          </article>
          <article className="feature-card">
            <span className="symbol yellow">∞</span><h3>무한 플레이</h3>
            <p>시간 제한 없이 원하는 만큼 문제를 풀어요. 그만둘 때까지 이어져요.</p>
            <button className="btn btn-outline" disabled={busy} onClick={()=>void start("INFINITE")}>계속 풀기</button>
          </article>
        </div>
      </section>
      {myHistory.length>0&&<section className="play-recent">
        <h2>최근 내 기록</h2>
        <div className="recent-results">
          {myHistory.map(item=><p key={item.runId}>
            {item.mode==="WEEKLY"?"주간 5문제":item.mode==="INFINITE"?"무한 플레이":"랜덤 5문제"}
            {" · "}{item.score}점 · {item.completed}문제 {item.status==="FINISHED"?"완료":"진행 중"}
          </p>)}
        </div>
      </section>}
    </>}

    {run&&<section className="play-panel play-live" aria-live="polite">
      <div className="play-top">
        <span className="small-tag">{mode==="WEEKLY"?"이번 주의 5문제":mode==="RANDOM_FIVE"?"랜덤 5문제":"무한 플레이"}</span>
        <span className="clue-count">{run.completed}문제 완료 · {run.score}점</span>
      </div>
      {round?<>
        <div className="round-progress"><span>문제 {round.round}{run.total?" / "+run.total:""} </span>
          <span>단서 {round.clueIndex} / {round.clueCount}</span></div>
        <h2>{round.prompt}</h2>
        {!!round.promptMediaIds?.length&&<div className="clue-media-list">
          {round.promptMediaIds.map(id=><div key={id}>{media[id]?<MediaPart item={media[id]}/>:<p className="muted">미디어를 불러올 수 없어요.</p>}</div>)}
        </div>}
        <ol className="clue-list">
          {round.clues.map((clue,i)=><li key={clue.id||i}>
            {clue.text&&<p>{clue.text}</p>}
            {clue.type==="map"&&clue.map&&<div className="map-clue">
              <span>지도 단서 · 위도 {clue.map.latitude}, 경도 {clue.map.longitude}</span>
              <a href={`https://www.openstreetmap.org/?mlat=${clue.map.latitude}&mlon=${clue.map.longitude}#map=${clue.map.zoom||8}/${clue.map.latitude}/${clue.map.longitude}`}
                target="_blank" rel="noopener noreferrer">지도에서 보기 ↗</a>
            </div>}
            {clue.mediaId&&(media[clue.mediaId]?<MediaPart item={media[clue.mediaId]}/>:<p className="muted">미디어가 제공되지 않았어요.</p>)}
          </li>)}
        </ol>
        {!isDone&&round.clueIndex<round.clueCount&&
          <button type="button" className="btn btn-outline" disabled={busy} onClick={()=>void reveal()}>
            단서 하나 더 보기</button>}
        {!isDone&&<form className="guess-form" onSubmit={e=>void check(e)}>
          <label htmlFor="clupio-answer">정답은 무엇일까요?</label>
          <div className="guess-row">
            <input id="clupio-answer" value={guess} onChange={e=>setGuess(e.target.value)}
              autoComplete="off" placeholder="정답을 입력해 보세요" maxLength={200}
              disabled={busy||mustReveal}/>
            <button type="submit" className="btn btn-primary" disabled={busy||mustReveal||!guess.trim()}>
              정답 확인</button>
          </div>
        </form>}
        {feedback&&<div className={"feedback "+(answer&&roundScore>0?"success":"")} role="status">
          {feedback}{answer&&<p>정답: <strong>{answer}</strong> · {roundScore}점</p>}
        </div>}
        {isDone&&<button type="button" className="btn btn-primary" disabled={busy} onClick={()=>void nextRound()}>
          {endReached?"최종 결과 보기 →":"다음 문제 →"}
        </button>}
      </>:<>
        <div className="round-finish">
          <div className="round-finish-symbol">✦</div>
          <h2>이번 도전 완료!</h2>
          <p>총 <strong>{run.score}점</strong> · {run.completed}문제 · 정답 {run.solved||0}개</p>
          {run.mode==="WEEKLY"&&<p>모두에게 같은 다섯 문제였어요. 이번 주의 다른 도전자들과 결과를 비교해 보세요.</p>}
          {run.mode==="WEEKLY"&&!run.official&&<p>로그인하지 않은 체험 기록은 공식 순위에 포함되지 않아요.</p>}
        </div>
      </>}
      <div className="play-bottom">
        {run.mode==="INFINITE"&&!endReached&&
          <button type="button" className="text-button" disabled={busy} onClick={()=>void finishInfinite()}>무한 플레이 끝내기</button>}
        <button type="button" className="text-button" onClick={()=>{setRun(null);setRound(null);setFeedback("");setError("");}}>모드 선택으로 돌아가기</button>
      </div>
    </section>}

    {error&&<p className="feedback" role="alert">{error}</p>}

    {lane==="GENERAL"&&edition?.available&&rankingAvailable&&
      <section className="weekly-ranking">
        <div className="play-top"><h2>이번 주 도전자들</h2><span className="small-tag">공식 기록</span></div>
        {ranking.length? <ol className="ranking-list">
          {ranking.map((person,index)=><li key={index}>
            <span className="ranking-place">{person.rank}위</span>
            <span>{person.displayName}</span><strong>{person.score}점</strong>
          </li>)}
        </ol> : <p className="muted">아직 공개된 공식 기록이 없어요. 첫 도전자가 되어 보세요.</p>}
        <p className="muted">참여 자격이 확인되고 순위 공개에 동의한 성인만 표시돼요. 동점자는 공동 순위예요.</p>
      </section>}
    {lane==="KIDS"&&<p className="muted">어린이 모드는 플랫폼에서 안전성을 확인한 문제만 제공하고, 공개 개인 순위는 표시하지 않아요.</p>}
    <div className="play-bottom"><Link href="/discover">다른 퀴즈 둘러보기 →</Link><Link href="/studio/weekly">출제자로 참여하기 →</Link></div>
  </main>;
}
