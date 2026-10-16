"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useLocale } from "../../../src/i18n/provider";
import { localizeHref } from "../../../src/i18n/core";
import PackResultShare from "../../../src/components/pack-result-share";
import { recoverCachedRuns, cachedCompletedResults, getCachedRun, type RecoveryReport } from "../../../src/lib/local-run-sync";

type RunResult = {runId:string;packId:string|null;packTitle:string|null;mode:string;status:string;
  score:number;solved:number;failed:number;completed:number;total:number|null;startedAt:string;shareId:string|null};
type History = {items:RunResult[];total:number;limit:number;offset:number};
const PAGE_SIZE=20;
async function api(path:string,method:"GET"|"POST"|"DELETE"="GET",body?:unknown):Promise<any> {
  const res=await fetch("/api/v1"+path,{method,credentials:"same-origin",cache:"no-store",
    headers:body?{"Content-Type":"application/json"}:undefined,
    body:body?JSON.stringify(body):undefined});
  const payload=await res.json().catch(()=>({}));
  if(!res.ok)throw new Error(payload.message||payload.error||"Request failed");
  return payload.data;
}
export default function MyResults() {
  const locale=useLocale(),korean=locale==="ko";
  const [offset,setOffset]=useState(0),[history,setHistory]=useState<History|null>(null);
  const [selected,setSelected]=useState<string|null>(null),[error,setError]=useState("");
  const [loading,setLoading]=useState(true);
  const [recovering,setRecovering]=useState(true);
  const recoveryStarted=useRef(false);
  const [recoverCount,setRecoverCount]=useState({done:0,total:0});
  const [recoveryReport,setRecoveryReport]=useState<RecoveryReport|null>(null);
  const load=useCallback(async ()=>{
    setLoading(true);setError("");
    try{setHistory(await api(`/runs?limit=${PAGE_SIZE}&offset=${offset}`));}
    catch(e){setError(e instanceof Error?e.message:String(e));}
    finally{setLoading(false);}
  },[offset]);
  useEffect(()=>{void load();},[load]);
  const recover=useCallback(async()=>{
    setRecovering(true);setRecoveryReport(null);
    try{
      const result=await recoverCachedRuns({
        onProgress:(done,total)=>setRecoverCount({done,total})
      });
      setRecoveryReport(result);
    }catch(error){
      setRecoveryReport({checked:1,recovered:0,failed:1,failures:[{
        runId:"",message:error instanceof Error?error.message:String(error)
      }]});
    }finally{
      setRecovering(false);
      await load(); // Refresh after older local results have been committed.
    }
  },[load]);
  useEffect(()=>{if(recoveryStarted.current)return;recoveryStarted.current=true;void recover();},[]); // Initial history recovery, not on pagination.
  const rows=history?.items||[];
  return <main className="container inner-page management-page my-results-page">
    <div className="play-intro"><span className="eyebrow">MY QUIZDIP</span>
      <h1>{korean?"내 플레이 기록":"My play history"}</h1>
      <p className="lead">{korean?"지난 퀴즈팩 결과를 다시 열어 이미지나 소셜 미디어로 공유하세요.":
        "Reopen past quiz pack results and share them again."}</p>
    </div>
    {recovering&&<p className="my-results-recovery" role="status">
      {korean?"기존 브라우저 기록을 서버와 동기화하는 중…":"Reconciling saved browser results…"}
      {recoverCount.total>0&&` ${recoverCount.done}/${recoverCount.total}`}
    </p>}
    {!recovering&&recoveryReport&&recoveryReport.checked>0&&
      <section className="my-results-recovery" role="status">
        <p>{recoveryReport.failed>0
          ?(korean?`${recoveryReport.recovered}개 기록 동기화 완료, ${recoveryReport.failed}개는 아직 저장하지 못했어요. 브라우저 기록은 보존돼요.`:
            `${recoveryReport.recovered} results synchronized; ${recoveryReport.failed} could not be saved. Browser copies are preserved.`)
          :(korean?`${recoveryReport.recovered}개 기존 기록을 서버와 확인했어요.`:
            `${recoveryReport.recovered} saved results checked with the server.`)}</p>
        {recoveryReport.failed>0&&<button type="button" className="btn btn-outline" disabled={recovering}
          onClick={()=>void recover()}>
          {korean?"미저장 기록 다시 동기화":"Retry pending results"}
        </button>}
      </section>}
    {loading&&<p role="status">{korean?"기록을 불러오는 중…":"Loading your history…"}</p>}
    {error&&<section className="placeholder-panel" role="alert"><p>{error}</p>
      <p>{korean?"로그인 상태를 확인해 주세요. 비로그인 기록은 계정에 연결되지 않아요.":
        "Check that you're signed in. Guest runs are not linked to an account."}</p>
      <Link href={localizeHref("/account",locale)} className="btn btn-outline">
        {korean?"계정으로 이동":"Go to account"}</Link>
      <button className="btn btn-outline" onClick={()=>void load()}>{korean?"다시 시도":"Try again"}</button>
    </section>}
    {!loading&&!error&&rows.length===0&&<p>{korean?"저장된 플레이 기록이 없어요.":"No saved play history yet."}</p>}
    {!loading&&!error&&<div className="my-results-list">{rows.map(run=>{
      const shareable=run.mode==="PACK"&&run.status==="FINISHED"&&!!run.packId;
      const open=selected===run.runId;
      const browserCache=getCachedRun(run.runId);
      const browserCompleted=browserCache?cachedCompletedResults(browserCache).length:0;
      const hasUnsavedBrowserResults=browserCompleted>run.completed;
      return <article className="my-result-entry" key={run.runId}>
        <div className="my-result-row">
          <div>
            <span className="small-tag">{run.mode==="PACK"?(korean?"퀴즈팩":"Quiz pack"):(korean?"자유 플레이":"Free play")}</span>
            <h2>{run.packTitle||(run.mode==="RANDOM_FIVE"?(korean?"랜덤 5문제":"Random five"):(korean?"연속 플레이":"Continuous play"))}</h2>
            <p className="muted">{new Date(run.startedAt).toLocaleDateString(korean?"ko-KR":"en-NZ")}
              {" · "}{run.score}{korean?"점":" pts"}{" · "}
              {run.completed}{run.total!==null?`/${run.total}`:""}{korean?"문제 완료":" completed"}
              {" · "}{run.solved}{korean?"문제 정답":" correct"}</p>
            {hasUnsavedBrowserResults&&<p className="my-results-warning">
              {korean?`브라우저에는 ${browserCompleted}문제 완료 기록이 있어요. 서버 복구가 필요해요.`:
                `This browser has ${browserCompleted} completed questions awaiting recovery.`}
            </p>
          </div>
          {shareable?<button className="btn btn-outline" type="button" aria-expanded={open}
            onClick={()=>setSelected(open?null:run.runId)}>
            {open?(korean?"접기":"Close"):(korean?"결과 다시 공유":"Share result again")}
          </button>:<span className="muted">{run.status==="FINISHED"?(korean?"완료":"Finished"):(korean?"진행 중":"In progress")}</span>}
        </div>
        {open&&shareable&&run.packId&&<PackResultShare key={run.runId}
          packId={run.packId} title={run.packTitle||"Quiz pack"} score={run.score}
          completed={run.completed} solved={run.solved} existingShareId={run.shareId}
          createShareId={async()=>{
            const shared=await api("/runs/"+run.runId+"/share","POST",{});
            setHistory(old=>old?{...old,items:old.items.map(item=>item.runId===run.runId?
              {...item,shareId:shared.shareId}:item)}:old);
            return shared.shareId as string;
          }}
          revokeShare={async()=>{
            await api("/runs/"+run.runId+"/share?confirm=true","DELETE");
            setHistory(old=>old?{...old,items:old.items.map(item=>item.runId===run.runId?
              {...item,shareId:null}:item)}:old);
          }}/>}
      </article>;
    })}</div>}
    {!loading&&!error&&history&&history.total>PAGE_SIZE&&<div className="my-results-pagination">
      <button className="btn btn-outline" disabled={offset===0}
        onClick={()=>{setOffset(Math.max(0,offset-PAGE_SIZE));setSelected(null);}}>
        {korean?"← 이전":"← Previous"}</button>
      <span>{Math.min(offset+1,history.total)}–{Math.min(offset+PAGE_SIZE,history.total)} / {history.total}</span>
      <button className="btn btn-outline" disabled={offset+PAGE_SIZE>=history.total}
        onClick={()=>{setOffset(offset+PAGE_SIZE);setSelected(null);}}>
        {korean?"다음 →":"Next →"}</button>
    </div>}
    <p><Link href={localizeHref("/account",locale)}>{korean?"← 내 계정":"← My account"}</Link></p>
  </main>;
}
