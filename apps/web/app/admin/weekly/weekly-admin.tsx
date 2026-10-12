"use client";
import {useEffect,useState} from "react";
import { useLocale } from "../../../src/i18n/provider";
import { bilingual } from "../../../src/i18n/view-copy";
type Proposal={id:string;lane:string;title:string;description:string;startsAt:string;host:{name:string;verified:boolean};questions:{position:number;title:string;quizId:string}[]};
type Edition={available:boolean;id?:string;title?:string;host?:{name:string}};
async function api(path:string,method="GET",body?:unknown,locale:"en"|"ko"="en"){
  const res=await fetch("/api/v1"+path,{method,credentials:"same-origin",cache:"no-store",
    headers:body?{"Content-Type":"application/json"}:undefined,body:body?JSON.stringify(body):undefined});
  const data=await res.json();
  if(!res.ok)throw new Error(data.message||data.error||bilingual(locale,"Request failed",msg("Request failed","요청 실패")));
  return data.data;
}
export default function WeeklyAdmin(){
  const locale=useLocale();
  const msg=(en:string,ko:string)=>bilingual(locale,en,ko);
  const request=(path:string,method="GET",body?:unknown)=>request(path,method,body,locale);
  const [proposals,setProposals]=useState<Proposal[]>([]);
  const [current,setCurrent]=useState<Edition[]>([]);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const [notice,setNotice]=useState("");
  async function refresh(){
    const [pending,general,kids]=await Promise.all([
      request("/weekly/proposals?limit=100"),request("/weekly/current?lane=GENERAL"),request("/weekly/current?lane=KIDS")
    ]);
    setProposals(pending.items||[]);setCurrent([general,kids]);
  }
  useEffect(()=>{void refresh().catch(e=>setError(e.message))},[]);
  async function publish(p:Proposal){
    if(!window.confirm(p.title+msg(" — Schedule this creator's five quizzes as the official weekly set?"," — 이 제작자의 다섯 문제를 이번 주 공식 세트로 편성할까요?")))return;
    setBusy(true);setError("");setNotice("");
    try{
      const verifiedHost=window.confirm("출제자의 실명/셀러브리티 신원을 독립적으로 검증했나요?\n확인하지 않았다면 취소를 누르세요.");
      await request("/weekly/"+p.id+"/publish","POST",{confirm:true,verifiedHost});
      setNotice(msg("Official challenge scheduled. Everyone will receive the same questions starting UTC Monday.","공식 편성을 완료했어요. 지정된 UTC 월요일부터 모든 참가자에게 같은 문제를 제공해요."));
      await refresh();
    }catch(e){setError(e instanceof Error?e.message:msg("Scheduling failed","편성 실패"))}
    finally{setBusy(false)}
  }
  async function suspend(id:string){
    const reason=window.prompt(msg("Enter a reason for suspending the official challenge.","공식 챌린지 중단 이유를 입력해 주세요."));
    if(!reason||reason.trim().length<5)return;
    if(!window.confirm(msg("Suspend this official weekly challenge?","공식 주간 챌린지를 중단할까요?")))return;
    setBusy(true);setError("");
    try{await request("/weekly/"+id+"/suspend","POST",{reason,confirm:true});await refresh();}
    catch(e){setError(e instanceof Error?e.message:msg("Suspension failed","중단 실패"))}
    finally{setBusy(false)}
  }
  return <div className="weekly-admin-panel">
    {error&&<p role="alert" className="feedback">{error}</p>}
    {notice&&<p role="status" className="feedback success">{notice}</p>}
    <section className="section"><h2>{msg("Current official challenges","공식 진행 중")}</h2>
      {current.map((e,i)=><div className="connected-provider" key={i}>
        <span>{i===0?msg("General","일반"):msg("Kids","어린이")} · {e.id?(e.title||msg("Official challenge","공식 챌린지"))+(e.available?"":msg(" · Safety review in progress"," · 안전성 재검토 중")):msg("Not scheduled","편성 없음")}</span>
        {e.id&&<button className="text-button" disabled={busy} onClick={()=>void suspend(e.id!)}>{msg("Suspend","중단")}</button>}
      </div>)}
    </section>
    <section className="section"><h2>{msg("Creator proposals","출제자 제안")}</h2>
      {!proposals.length&&<p>{msg("No pending proposals.","대기 중인 제안이 없어요.")}</p>}
      {proposals.map(p=><article key={p.id} className="feature-card">
        <span className="small-tag">{p.lane==="KIDS"?msg("Kids","어린이"):msg("General","일반")} · {p.startsAt.slice(0,10)}</span>
        <h3>{p.title}</h3><p>{msg("Host: ","출제자: ")}{p.host.name}</p><p>{p.description}</p>
        <ol>{p.questions.map(q=><li key={q.quizId}>{q.title}</li>)}</ol>
        <button type="button" disabled={busy} className="btn btn-primary" onClick={()=>void publish(p)}>{msg("Schedule these five questions","이 5문제 편성 확정")}</button>
      </article>)}
    </section>
  </div>;
}
