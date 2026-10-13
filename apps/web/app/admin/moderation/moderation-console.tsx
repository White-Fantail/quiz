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
  const [savedPolicy,setSavedPolicy]=useState<Policy>(initialPolicy);
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
    setPolicy(config);setSavedPolicy(config);setQueue(rows.items??[]);
  },[]);
  useEffect(()=>{let mounted=true;Promise.all([api("policy"),api("queue?limit=100")])
    .then(([config,rows])=>{if(mounted){setPolicy(config);setSavedPolicy(config);setQueue(rows.items??[]);}})
    .catch(e=>{if(mounted)setError(e.message)})
    .finally(()=>{if(mounted)setLoading(false)});
    return ()=>{mounted=false};
  },[]);
  async function action(work:()=>Promise<unknown>,message:string){
    setBusy(true);setError("");setSuccess("");
    try{await work();await load();setSuccess(message);return true}
    catch(e){setError(e instanceof Error?e.message:"Request failed");return false}
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
    const saved=await action(()=>api("review",request("POST",{kind:selected.kind,id:selected.id,decision,reason})),
      msg("Moderation decision saved.","심사 결과를 저장했습니다."));
    if(saved){setSelected(null);setReason("");}
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
  const hasUnsavedChanges=(
    policy.enabled!==savedPolicy.enabled ||
    policy.quizReportThreshold!==savedPolicy.quizReportThreshold ||
    policy.packReportThreshold!==savedPolicy.packReportThreshold ||
    policy.windowHours!==savedPolicy.windowHours ||
    policy.minimumEstablishedReporters!==savedPolicy.minimumEstablishedReporters ||
    policy.establishedAccountDays!==savedPolicy.establishedAccountDays
  );
  const establishedDescription=policy.minimumEstablishedReporters===0
    ?msg("No established-account requirement","기존 계정 최소 인원 조건 없음")
    :msg("At least "+policy.minimumEstablishedReporters+" established reporters",
      "기존 계정 신고자 최소 "+policy.minimumEstablishedReporters+"명");
  const ageDescription=policy.establishedAccountDays===0
    ?msg("Every account meets the age rule","가입 당일부터 기존 계정으로 인정")
    :msg("Accounts at least "+policy.establishedAccountDays+" days old",
      "가입 "+policy.establishedAccountDays+"일 이상 계정");
  return <section className="section review-console">
    {error&&<p role="alert" className="feedback">{error}</p>}
    {success&&<p role="status" className="feedback success">{success}</p>}
    {loading&&<p role="status">{msg("Loading moderation policy…","모더레이션 설정을 불러오는 중…")}</p>}
    {!loading&&<>
      <div className="review-section-heading">
        <div><h2>{msg("Automatic hold rules","자동 보류 기준")}</h2>
          <p className="muted">{msg("Only independent account reports count. Admin review decides the final outcome.","독립적인 신고 계정 수로 보류를 결정하며, 최종 제재는 관리자가 판단합니다.")}</p></div>
      </div>
      <div className="feature-card" aria-live="polite" style={{display:"grid",gap:12,marginBottom:16}}>
        <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
          <strong>{msg("Automatic hold at a glance","현재 자동 보류 조건")}</strong>
          <span className="small-tag">{policy.enabled
            ?msg("Auto-hold ON","자동 보류 사용 중")
            :msg("Auto-hold OFF","자동 보류 중지")}</span>
          {hasUnsavedChanges&&<span className="small-tag" style={{borderStyle:"dashed"}}>
            {msg("Preview only · not saved","미저장 · 변경사항 미적용")}
          </span>}
        </div>
        <p className="muted" style={{margin:0}}>{msg(
          "All applicable requirements below must be met for the same item. Reports are counted from distinct accounts, not total clicks.",
          "같은 콘텐츠에 아래 조건이 모두 충족되어야 자동 보류됩니다. 신고 횟수가 아니라 서로 다른 신고 계정 수를 계산합니다."
        )}</p>
        <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
          <span className="small-tag">{msg("Quiz","문제")} ≥ {policy.quizReportThreshold}{msg(" reporters","명")}</span>
          <span className="small-tag">{msg("Pack","팩")} ≥ {policy.packReportThreshold}{msg(" reporters","명")}</span>
          <span className="small-tag">{msg("Within the last ","최근 ")}{policy.windowHours}{msg(" hours","시간")}</span>
          <span className="small-tag">{establishedDescription}</span>
          <span className="small-tag">{ageDescription}</span>
        </div>
        <p style={{margin:0}}>{policy.enabled
          ?msg(
            "Example: "+policy.quizReportThreshold+" different people report one quiz within "+policy.windowHours+" hours; at least "+policy.minimumEstablishedReporters+" of them have accounts "+policy.establishedAccountDays+"+ days old. Then it is temporarily hidden pending staff review.",
            "예: 최근 "+policy.windowHours+"시간에 한 문제를 서로 다른 "+policy.quizReportThreshold+"명 이상이 신고하고, 그중 최소 "+policy.minimumEstablishedReporters+"명이 가입 "+policy.establishedAccountDays+"일 이상이라면 관리자 검토까지 일시적으로 숨깁니다."
          )
          :msg(
            "Reports are still accepted and shown in the review queue. Automatic hiding is disabled.",
            "신고 접수와 관리자 검토는 계속되지만 자동 숨김은 발생하지 않습니다."
          )}</p>
        <small className="muted">{msg(
          "Self-reports and repeated open reports from the same account do not increase the count. A hold is not a confirmed violation.",
          "본인 콘텐츠 신고는 제외하고, 같은 계정의 중복 신고는 추가 집계하지 않습니다. 자동 보류는 위반 확정이 아닙니다."
        )}</small>
      </div>
      <div className="cards" style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(175px,1fr))",gap:12}}>
        {([
          ["quizReportThreshold",msg("Quiz report threshold","문제 신고 임계치"),2,100,
            msg("Minimum number of different accounts reporting the same quiz.","같은 문제를 신고한 서로 다른 계정의 최소 수")],
          ["packReportThreshold",msg("Pack report threshold","팩 신고 임계치"),2,100,
            msg("Minimum number of different accounts reporting the same pack.","같은 퀴즈팩을 신고한 서로 다른 계정의 최소 수")],
          ["windowHours",msg("Report window (hours)","신고 집계 시간"),1,720,
            msg("Only OPEN reports submitted in the last N hours count.","현재 기준 최근 N시간의 미처리 신고만 집계")],
          ["minimumEstablishedReporters",msg("Established reporters required","기존 계정 최소 신고자"),0,100,
            msg("Among the unique reporters, at least this many must meet the account-age rule.","전체 신고자 중 가입 기간 조건을 충족해야 하는 최소 인원")],
          ["establishedAccountDays",msg("Established account age (days)","기존 계정 기준 일수"),0,90,
            msg("An account is established after being registered for this many days.","가입한 지 이 일수 이상이면 기존 계정으로 인정")]
        ] as const).map(([field,label,min,max,help])=>
          <label key={field} className="feature-card" style={{display:"grid",gap:8}}>
            <span style={{display:"flex",gap:6,alignItems:"center",flexWrap:"wrap"}}>
              <span>{label}</span>
              <span className="small-tag" title={help} aria-label={help} style={{cursor:"help"}}>?</span>
            </span>
            <input aria-label={label} type="number" min={min} max={max} step={1} value={policy[field]}
              onChange={e=>changeNumber(field,e.target.value)}/>
            <small className="muted">{help}</small>
          </label>)}
      </div>
      {policy.minimumEstablishedReporters>Math.min(policy.quizReportThreshold,policy.packReportThreshold)&&
        <p role="alert" className="feedback">{msg(
          "Established-reporter minimum cannot exceed either content threshold.",
          "기존 계정 최소 신고자 수는 문제·팩 신고 임계치를 초과할 수 없습니다."
        )}</p>}
      <p><label><input type="checkbox" checked={policy.enabled}
        onChange={e=>setPolicy(previous=>({...previous,enabled:e.target.checked}))}/>
        {" "}{msg("Enable automatic holds","자동 보류 활성화")}</label></p>
      <button className="btn btn-primary" type="button" disabled={busy||policy.minimumEstablishedReporters>Math.min(policy.quizReportThreshold,policy.packReportThreshold)}
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
      <ModeratorAppeals onReviewed={()=>void load()}/>
    </>}
  </section>;
}
