"use client";
import {useEffect,useState} from "react";
import {useLocale} from "../../../src/i18n/provider";
type Kind="QUIZ"|"PACK"|"PUBLISHER";
type Notice={id:string;event:string;targetKind:Kind;targetId:string;message:string;readAt:string|null;createdAt:string};
type Appeal={id:string;status:string;targetKind:Kind;targetId:string;message:string;resolution:string;createdAt:string};
type Inbox={userId:string;publishing:{publishingStatus:string;publishingRestrictedUntil:string|null};notices:Notice[];appeals:Appeal[]};
async function loadApi(path:string,init?:RequestInit){
  const response=await fetch("/api/v1/me/moderation"+path,{credentials:"same-origin",cache:"no-store",
    headers:{"content-type":"application/json"},...init});
  const body=await response.json().catch(()=>({}));
  if(!response.ok)throw Error(body.message||body.error||"Request failed");
  return body.data;
}
export default function ModerationInbox(){
  const locale=useLocale(),ko=locale==="ko";
  const [data,setData]=useState<Inbox|null>(null),[error,setError]=useState(""),[message,setMessage]=useState("");
  const [kind,setKind]=useState<Kind>("QUIZ"),[targetId,setTargetId]=useState(""),[details,setDetails]=useState("");
  const [busy,setBusy]=useState(false);
  async function refresh(){setData(await loadApi("?limit=100&offset=0"))}
  useEffect(()=>{let active=true;loadApi("?limit=100&offset=0")
    .then((result:Inbox)=>{if(active)setData(result)})
    .catch(e=>{if(active)setError(e.message)});
    return()=>{active=false}},[]);
  function startAppeal(n:Notice){setKind(n.targetKind);setTargetId(n.targetId);setDetails("");}
  async function submit(){
    if(details.trim().length<15){setError(ko?"이의신청 내용을 15자 이상 작성해 주세요.":"Please explain your appeal in at least 15 characters.");return}
    if(!window.confirm(ko?"이의신청을 제출할까요?":"Submit this appeal for manual review?"))return;
    setBusy(true);setError("");setMessage("");
    try{
      await loadApi("/appeals",{method:"POST",body:JSON.stringify({kind,targetId,message:details.trim(),confirm:true})});
      await refresh();setDetails("");setMessage(ko?"이의신청이 접수됐어요.":"Appeal submitted for review.");
    }catch(e){setError(e instanceof Error?e.message:"Request failed")}finally{setBusy(false)}
  }
  return <section className="section">
    {error&&<p className="feedback" role="alert">{error}</p>}
    {message&&<p className="feedback success" role="status">{message}</p>}
    {!data&&<p className="muted">{ko?"불러오는 중…":"Loading…"}</p>}
    {data&&<>
      <div className="placeholder-panel">
        <h2>{ko?"게시 권한":"Publishing access"}</h2>
        <p>{data.publishing.publishingStatus==="ACTIVE"?(ko?"정상":"Active"):(ko?"게시 제한 중":"Restricted")}</p>
        {data.publishing.publishingRestrictedUntil&&<p className="muted">
          {ko?"제한 종료":"Restriction until"}: {new Date(data.publishing.publishingRestrictedUntil).toLocaleString()}</p>}
        {data.publishing.publishingStatus==="RESTRICTED"&&
          <button className="btn btn-outline" onClick={()=>{setKind("PUBLISHER");setTargetId(data.userId)}}>
            {ko?"게시 제한 이의신청":"Appeal publishing restriction"}</button>}
      </div>
      <div className="placeholder-panel">
        <h2>{ko?"모더레이션 알림":"Moderation notifications"}</h2>
        {!data.notices.length&&<p className="muted">{ko?"새로운 알림이 없어요.":"No moderation notices."}</p>}
        {data.notices.map(n=><article key={n.id} style={{padding:"12px 0",borderBottom:"1px solid var(--border, #ddd)"}}>
          <strong>{n.event.replaceAll("_"," ")}</strong> <small>{new Date(n.createdAt).toLocaleString()}</small>
          <p>{n.message}</p>
          <small>{n.targetKind}: {n.targetId}</small>
          <div style={{display:"flex",gap:8,flexWrap:"wrap",marginTop:8}}>
            {["UNDER_REVIEW","RESTRICTED","PUBLISHING_RESTRICTED"].includes(n.event)&&
              <button className="btn btn-outline" onClick={()=>startAppeal(n)}>{ko?"이의신청":"Appeal"}</button>}
            {!n.readAt&&<button className="btn btn-outline" disabled={busy} onClick={async()=>{
              try{await loadApi("/notices/"+n.id+"/read",{method:"POST",body:"{}"});await refresh()}
              catch(e){setError(e instanceof Error?e.message:"Request failed")}
            }}>{ko?"읽음 처리":"Mark read"}</button>}
          </div>
        </article>)}
      </div>
      <div className="placeholder-panel">
        <h2>{ko?"이의신청 작성":"Submit an appeal"}</h2>
        <p className="muted">{ko?"보류 또는 제한된 본인 문제·팩만 신청할 수 있어요.":"You may appeal only your own held or restricted content."}</p>
        <label>{ko?"대상":"Target"}
          <select value={kind} onChange={e=>setKind(e.target.value as Kind)}>
            <option value="QUIZ">{ko?"문제":"Quiz"}</option>
            <option value="PACK">{ko?"퀴즈팩":"Quiz pack"}</option>
            <option value="PUBLISHER">{ko?"게시 권한":"Publishing access"}</option>
          </select>
        </label>
        <label>{ko?"대상 ID":"Target ID"}<input value={targetId} onChange={e=>setTargetId(e.target.value)} /></label>
        <label>{ko?"이의신청 사유":"Appeal details"}
          <textarea rows={4} maxLength={2000} value={details} onChange={e=>setDetails(e.target.value)}
            placeholder={ko?"심사자가 확인할 근거와 수정 내용을 설명해 주세요.":"Explain why this should be reconsidered."}/>
        </label>
        <button type="button" className="btn btn-primary" disabled={busy||!targetId||details.trim().length<15}
          onClick={()=>void submit()}>{ko?"이의신청 제출":"Submit appeal"}</button>
      </div>
      <div className="placeholder-panel">
        <h2>{ko?"이의신청 내역":"My appeals"}</h2>
        {!data.appeals.length&&<p className="muted">{ko?"신청 내역이 없어요.":"No appeals yet."}</p>}
        {data.appeals.map(a=><div key={a.id} style={{marginBottom:12}}>
          <strong>{a.targetKind} · {a.status}</strong>
          <p>{a.message}</p>
          {a.resolution&&<p className="muted">{ko?"관리자 답변":"Staff response"}: {a.resolution}</p>}
        </div>)}
      </div>
    </>}
  </section>;
}
