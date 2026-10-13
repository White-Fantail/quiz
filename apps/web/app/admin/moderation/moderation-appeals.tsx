"use client";
import {useCallback,useEffect,useState} from "react";
import {useLocale} from "../../../src/i18n/provider";
type Appeal={id:string;creator:string;userId:string;targetKind:string;targetId:string;message:string;status:string;createdAt:string};
export default function ModeratorAppeals(){
  const ko=useLocale()==="ko";
  const [items,setItems]=useState<Appeal[]>([]),[status,setStatus]=useState("OPEN"),
    [reason,setReason]=useState<Record<string,string>>({}),[busy,setBusy]=useState(false),
    [error,setError]=useState(""),[success,setSuccess]=useState("");
  const load=useCallback(async()=>{
    const resp=await fetch("/api/v1/admin/moderation/appeals?status="+status+"&limit=100&offset=0",
      {credentials:"same-origin",cache:"no-store"});
    const body=await resp.json();
    if(!resp.ok)throw Error(body.message||body.error||"Could not list appeals");
    setItems(body.data.items??[]);
  },[status]);
  useEffect(()=>{let active=true;load().catch(e=>{if(active)setError(e.message)});return()=>{active=false}},[load]);
  async function decide(id:string,decision:"ACCEPTED"|"REJECTED"){
    const explanation=(reason[id]??"").trim();
    if(explanation.length<5){setError(ko?"관리자 답변을 5자 이상 입력하세요.":"Provide a reason of at least 5 characters.");return}
    if(!window.confirm(ko?"이의신청 결정과 콘텐츠/계정 상태 변경을 확정할까요?":"Confirm the appeal decision and any content/account restoration?"))return;
    setBusy(true);setError("");setSuccess("");
    try{
      const resp=await fetch("/api/v1/admin/moderation/appeals/"+id+"/review",{method:"POST",
        credentials:"same-origin",headers:{"content-type":"application/json"},
        body:JSON.stringify({decision,reason:explanation,confirm:true})});
      const body=await resp.json().catch(()=>({}));
      if(!resp.ok)throw Error(body.message||body.error||"Review failed");
      await load();setSuccess(ko?"심사 결과를 저장했어요.":"Appeal decision saved.");
    }catch(e){setError(e instanceof Error?e.message:"Review failed")}finally{setBusy(false)}
  }
  return <section className="section">
    <div className="review-section-heading">
      <h2>{ko?"제작자 이의신청 심사":"Creator appeals"}</h2>
      <label>{ko?"상태":"Status"} <select value={status} onChange={e=>setStatus(e.target.value)}>
        <option value="OPEN">{ko?"대기":"Open"}</option><option value="ALL">{ko?"전체":"All"}</option>
        <option value="ACCEPTED">{ko?"수락":"Accepted"}</option><option value="REJECTED">{ko?"기각":"Rejected"}</option>
      </select></label>
    </div>
    {error&&<p role="alert" className="feedback">{error}</p>}
    {success&&<p role="status" className="feedback success">{success}</p>}
    {!items.length&&<p className="muted">{ko?"이 분류의 이의신청이 없어요.":"No appeals in this category."}</p>}
    {items.map(a=><article className="feature-card" key={a.id} style={{padding:14,marginBottom:12}}>
      <strong>{a.creator} · {a.targetKind} · {a.status}</strong>
      <p className="muted">{a.targetId} · {new Date(a.createdAt).toLocaleString()}</p>
      <p style={{whiteSpace:"pre-wrap"}}>{a.message}</p>
      {a.status==="OPEN"&&<>
        <label>{ko?"관리자 답변":"Staff response"}
          <textarea rows={2} maxLength={1000} value={reason[a.id]??""}
            onChange={e=>setReason(prev=>({...prev,[a.id]:e.target.value}))}/>
        </label>
        <div style={{display:"flex",gap:8,flexWrap:"wrap",marginTop:8}}>
          <button type="button" className="btn btn-outline" disabled={busy} onClick={()=>void decide(a.id,"ACCEPTED")}>
            {ko?"이의신청 수락 및 복원":"Accept and restore"}</button>
          <button type="button" className="btn btn-outline" disabled={busy} onClick={()=>void decide(a.id,"REJECTED")}>
            {ko?"기각":"Reject"}</button>
        </div>
      </>}
    </article>)}
  </section>;
}
