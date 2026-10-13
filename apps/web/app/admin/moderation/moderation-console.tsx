"use client";
import {useCallback,useEffect,useState} from "react";
import Link from "next/link";
import {useLocale} from "../../../src/i18n/provider";
import {localizeHref} from "../../../src/i18n/core";
import {bilingual} from "../../../src/i18n/view-copy";
import ModerationDetail from "./moderation-detail";
import ModeratorAppeals from "./moderation-appeals";

type Policy={enabled:boolean;quizReportThreshold:number;packReportThreshold:number;
  windowHours:number;minimumEstablishedReporters:number;establishedAccountDays:number};
type Item={kind:"QUIZ"|"PACK";id:string;title:string;authorId:string;author:string;
  publishingStatus:string;publishingRestrictedUntil:string|null;safetyStatus:string;
  reportCount:number;updatedAt:string};
const initialPolicy:Policy={enabled:true,quizReportThreshold:3,packReportThreshold:3,
  windowHours:24,minimumEstablishedReporters:2,establishedAccountDays:7};

async function api(path:string,init?:RequestInit){
  const response=await fetch("/api/v1/admin/moderation/"+path,{
    credentials:"same-origin",cache:"no-store",...init,
    headers:{"content-type":"application/json"}});
  const body=await response.json().catch(()=>({}));
  if(!response.ok)throw Error(body.message||body.error||"Request failed");
  return body.data;
}
function request(method:string,body:Record<string,unknown>):RequestInit{
  return {method,body:JSON.stringify({...body,confirm:true})};
}
export default function ModerationConsole(){
  const locale=useLocale(),msg=(en:string,ko:string)=>bilingual(locale,en,ko);
  const [policy,setPolicy]=useState<Policy>(initialPolicy);
  const [queue,setQueue]=useState<Item[]>([]);
  const [selected,setSelected]=useState<Item|null>(null);
  const [userId,setUserId]=useState("");
  const [userInfo,setUserInfo]=useState<{displayName:string;publishingStatus:string;publishingRestrictedUntil:string|null;confirmedViolationDecisions:number;confirmedContentCount:number;quizzes:number;packs:number}|null>(null);
  const [reason,setReason]=useState("");
  const [days,setDays]=useState("7");
  const [busy,setBusy]=useState(false),[loading,setLoading]=useState(true);
  const [error,setError]=useState(""),[success,setSuccess]=useState("");
  const load=useCallback(async()=>{
    const [config,rows]=await Promise.all([api("policy"),api("queue?limit=100")]);
    setPolicy(config);setQueue(rows.items??[]);
  },[]);
  useEffect(()=>{let mounted=true;Promise.all([api("policy"),api("queue?limit=100")])
    .then(([config,rows])=>{if(mounted){setPolicy(config);setQueue(rows.items??[]);}})
    .catch(e=>{if(mounted)setError(e.message)})
    .finally(()=>{if(mounted)setLoading(false)});
    return ()=>{mounted=false};
  },[]);
  async function action(work:()=>Promise<unknown>,message:string){
    setBusy(true);setError("");setSuccess("");
    try{await work();await load();setSuccess(message)}
    catch(e){setError(e instanceof Error?e.message:"Request failed")}
    finally{setBusy(false)}
  }
  function changeNumber(field:keyof Policy,value:string){
    setPolicy(previous=>({...previous,[field]:Number(value)}));
  }
  async function lookup(id=userId){
    if(!id.trim())return;
    setUserId(id.trim());setError("");setUserInfo(null);
    try{setUserInfo(await api("publishers/"+encodeURIComponent(id.trim())))}
    catch(e){setError(e instanceof Error?e.message:"User lookup failed")}
  }
  async function review(decision:"CLEARED"|"RESTRICTED"|"RESTORED"){
    if(!selected)return;
    if(decision==="RESTRICTED"&&reason.trim().length<5){
      setError(msg("Enter a specific restriction reason (5+ characters).","제한 사유를 5자 이상 입력해 주세요."));return;
    }
    if(!window.confirm(msg("Confirm moderation decision?","관리자 심사 결정을 확정할까요?")))return;
    await action(()=>api("review",request("POST",{kind:selected.kind,id:selected.id,decision,reason})),
      msg("Moderation decision saved.","심사 결과를 저장했습니다."));
    setSelected(null);setReason("");
  }
  async function setPublishing(status:"ACTIVE"|"RESTRICTED"){
    if(!userId.trim())return;
    if(status==="RESTRICTED"&&reason.trim().length<5){
      setError(msg("Enter a reason before restricting.","게시 제한 사유를 입력해 주세요."));return;
    }
    const n=days.trim()?Number(days):null;
    if(status==="RESTRICTED"&&n!==null&&(!Number.isInteger(n)||n<1||n>365)){
      setError(msg("Use 1–365 days or leave blank for indefinite.","1~365일 또는 공란(무기한)을 선택해 주세요."));return;
    }
    if(!window.confirm(msg("Change this account's publishing access?","이 사용자의 게시 권한을 변경할까요?")))return;
    await action(async()=>{
      await api("publishers/"+encodeURIComponent(userId),request("POST",{
        userId,status,reason,until:status==="RESTRICTED"&&n!==null
          ?new Date(Date.now()+n*86400000).toISOString():null
      }));
      setUserInfo(await api("publishers/"+encodeURIComponent(userId)));
    },msg("Publishing access updated.","게시 권한을 변경했습니다."));
    setReason("");
  }
  return <section className="section review-console">
    {error&&<p role="alert" className="feedback">{error}</p>}
    {success&&<p role="status" className="feedback success">{success}</p>}
    {loading&&<p role="status">{msg("Loading moderation policy…","모더레이션 설정을 불러오는 중…")}</p>}
    {!loading&&<>
      <div className="review-section-heading">
        <div><h2>{msg("Automatic hold rules","자동 보류 기준")}</h2>
          <p className="muted">{msg("Only independent account reports count. Admin review decides the final outcome.","독립적인 신고 계정 수로 보류를 결정하며, 최종 제재는 관리자가 판단합니다.")}</p></div>
      </div>
      <div className="cards" style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(175px,1fr))",gap:12}}>
        {([
          ["quizReportThreshold",msg("Quiz reports","문제 신고 임계치"),2,100],
          ["packReportThreshold",msg("Pack reports","팩 신고 임계치"),2,100],
          ["windowHours",msg("Rolling hours","신고 집계 시간"),1,720],
          ["minimumEstablishedReporters",msg("Established reporters","기존 계정 최소 신고자"),0,100],
          ["establishedAccountDays",msg("Account age (days)","기존 계정 기준 일수"),0,90]
        ] as const).map(([field,label,min,max])=>
          <label key={field} className="feature-card" style={{display:"grid",gap:8}}>
            <span>{label}</span>
            <input aria-label={label} type="number" min={min} max={max} value={policy[field]}
              onChange={e=>changeNumber(field,e.target.value)}/>
          </label>)}
      </div>
      <p><label><input type="checkbox" checked={policy.enabled}
        onChange={e=>setPolicy(previous=>({...previous,enabled:e.target.checked}))}/>
        {" "}{msg("Enable automatic holds","자동 보류 활성화")}</label></p>
      <button className="btn btn-primary" type="button" disabled={busy}
        onClick={()=>{if(window.confirm(msg("Save thresholds?","변경한 임계치를 저장할까요?")))
          void action(()=>api("policy",request("PATCH",{...policy})),
            msg("Policy saved.","정책 설정을 저장했습니다."));}}>
        {msg("Save policy","설정 저장")}
      </button>
      <div className="review-section-heading" style={{marginTop:30}}>
        <div><h2>{msg("Held and reported content","보류 및 신고된 콘텐츠")}</h2>
          <p className="muted">{msg("A hold hides the content from public discovery and play until staff review.","보류된 콘텐츠는 관리자가 검토할 때까지 공개 검색과 플레이에서 제외됩니다.")}</p></div>
        <span className="small-tag">{queue.length}</span>
      </div>
      <div className="review-result-list">
        {queue.length===0&&<p className="muted">{msg("No flagged content.","검토 대기 중인 콘텐츠가 없습니다.")}</p>}
        {queue.map(item=><div key={item.kind+item.id} className="review-entry" style={{display:"grid",gap:8}}>
          <div><strong>{item.title}</strong>
            <p className="muted">{item.kind} · {item.safetyStatus} · {msg("Reports","신고")} {item.reportCount}</p>
            <small>{msg("Creator","제작자")}: {item.author}</small>
          </div>
          <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
            {item.kind==="QUIZ"&&<Link className="btn btn-outline" href={localizeHref("/admin/quiz-review/"+item.id,locale)}>
              {msg("Full review","문제 상세")}</Link>}
            <button className="btn btn-outline" type="button" onClick={()=>{setSelected(item);setReason("")}}>
              {msg("Moderate","심사")}</button>
            <button className="btn btn-outline" type="button" onClick={()=>{void lookup(item.authorId)}}>
              {msg("Creator access","제작자 권한")}</button>
          </div>
        </div>)}
      </div>
      {selected&&<div className="feature-card" style={{marginTop:20,display:"grid",gap:10}}>
        <strong>{msg("Review","심사")}: {selected.title} ({selected.kind})</strong>
        <p>{msg("Current safety state","현재 상태")}: {selected.safetyStatus}</p>
        <ModerationDetail kind={selected.kind} id={selected.id}/>
        <label>{msg("Decision reason","심사 사유")}
          <textarea value={reason} rows={3} maxLength={1000} onChange={e=>setReason(e.target.value)}/>
        </label>
        <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
          <button className="btn btn-outline" disabled={busy} onClick={()=>void review("CLEARED")}>{msg("Clear and show","정상 공개")}</button>
          <button className="btn btn-outline" disabled={busy} onClick={()=>void review("RESTRICTED")}>{msg("Restrict","콘텐츠 제한")}</button>
          <button className="btn btn-outline" disabled={busy} onClick={()=>void review("RESTORED")}>{msg("Restore restriction","제한 복원")}</button>
          <button className="btn btn-outline" disabled={busy} onClick={()=>setSelected(null)}>{msg("Cancel","취소")}</button>
        </div>
      </div>}
      <div className="review-section-heading" style={{marginTop:30}}>
        <div><h2>{msg("Creator publishing restrictions","제작자 게시 제한")}</h2>
          <p className="muted">{msg("Publishing limits do not automatically hide existing content or block play.","게시 제한은 기존 문제를 자동으로 숨기거나 플레이까지 차단하지 않습니다.")}</p></div>
      </div>
      <div className="feature-card" style={{display:"grid",gap:12}}>
        <label>{msg("User ID","사용자 ID")}
          <input value={userId} onChange={e=>setUserId(e.target.value)} placeholder={msg("Select a creator above or enter ID","위에서 제작자를 선택하거나 ID 입력")}/>
        </label>
        <button className="btn btn-outline" disabled={busy||!userId} onClick={()=>void lookup()}>{msg("Look up creator","제작자 조회")}</button>
        {userInfo&&<div>
          <p>{userInfo.displayName} · {msg("Access","권한")}: {userInfo.publishingStatus}
            {userInfo.publishingRestrictedUntil?" · "+userInfo.publishingRestrictedUntil.slice(0,10):""}</p>
          <p className="muted">{msg("Content","게시물")}: {userInfo.quizzes} {msg("quizzes","문제")} · {userInfo.packs} {msg("packs","팩")}</p>
          <p className="muted">{msg("Confirmed restriction decisions","관리자 위반 확정 조치")}:
            {" "+userInfo.confirmedViolationDecisions} ({userInfo.confirmedContentCount} {msg("distinct items","개 콘텐츠")})
            {" · "}{msg("Reports alone do not count as violations","단순 신고는 위반으로 집계하지 않아요")}</p>
        </div>}
        <label>{msg("Reason (required for restriction)","사유 (제한 시 필수)")}
          <textarea value={reason} rows={3} maxLength={1000} onChange={e=>setReason(e.target.value)}/>
        </label>
        <label>{msg("Duration in days (blank = indefinite)","게시 제한 일수 (공란 = 무기한)")}
          <input type="number" min="1" max="365" value={days} onChange={e=>setDays(e.target.value)}/>
        </label>
        <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
          <button className="btn btn-outline" disabled={busy||!userId} onClick={()=>void setPublishing("RESTRICTED")}>{msg("Restrict publishing","게시 제한")}</button>
          <button className="btn btn-outline" disabled={busy||!userId} onClick={()=>void setPublishing("ACTIVE")}>{msg("Restore publishing","게시 제한 해제")}</button>
        </div>
      </div>
      <ModeratorAppeals/>
    </>}
  </section>;
}
