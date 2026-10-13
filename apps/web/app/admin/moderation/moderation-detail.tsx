"use client";
import {useEffect,useState} from "react";
import {useLocale} from "../../../src/i18n/provider";
type RecordItem={id:string;reason:string;detail:string;status:string;locale:string;createdAt:string};
type HistoryItem={action:string;createdAt:string;detail:unknown};
type AppealItem={id:string;message:string;status:string;resolution:string;createdAt:string};
type Detail={id:string;authorId:string;safetyStatus:string;reports:RecordItem[];history:HistoryItem[];appeals:AppealItem[]};
export default function ModerationDetail({kind,id}:{kind:"QUIZ"|"PACK";id:string}){
  const ko=useLocale()==="ko";
  const [detail,setDetail]=useState<Detail|null>(null),[error,setError]=useState("");
  useEffect(()=>{let mounted=true;setDetail(null);setError("");
    fetch("/api/v1/admin/moderation/detail/"+kind+"/"+id,{credentials:"same-origin",cache:"no-store"})
      .then(async r=>{const body=await r.json();if(!r.ok)throw Error(body.message||body.error||"Request failed");return body.data;})
      .then(v=>{if(mounted)setDetail(v)})
      .catch(e=>{if(mounted)setError(e.message)});
    return()=>{mounted=false};
  },[kind,id]);
  return <section style={{padding:"12px 0"}}>
    <h3>{ko?"신고 및 심사 상세":"Report and decision detail"}</h3>
    {error&&<p className="feedback" role="alert">{error}</p>}
    {!detail&&!error&&<p>{ko?"불러오는 중…":"Loading…"}</p>}
    {detail&&<>
      <p>{ko?"콘텐츠 상태":"Content status"}: {detail.safetyStatus}</p>
      <h4>{ko?"신고 내역":"Reports"} ({detail.reports.length})</h4>
      {!detail.reports.length&&<p className="muted">{ko?"신고 내역 없음":"No reports"}</p>}
      {detail.reports.map(r=><div key={r.id} style={{padding:"10px 0",borderBottom:"1px solid #9993"}}>
        <strong>{r.reason} · {r.status}</strong> <small>{r.locale} · {new Date(r.createdAt).toLocaleString()}</small>
        <p style={{whiteSpace:"pre-wrap"}}>{r.detail}</p>
      </div>)}
      <h4>{ko?"심사 이력":"Decision history"}</h4>
      {!detail.history.length&&<p className="muted">{ko?"처리 이력 없음":"No previous decisions"}</p>}
      {detail.history.map((h,i)=><div key={i} style={{marginBottom:10}}>
        <strong>{h.action}</strong> <small>{new Date(h.createdAt).toLocaleString()}</small>
        <p className="muted">{h.detail&&typeof h.detail==="object"?JSON.stringify(h.detail):""}</p>
      </div>)}
      <h4>{ko?"이의신청":"Appeals"}</h4>
      {!detail.appeals.length&&<p className="muted">{ko?"이의신청 없음":"No appeals"}</p>}
      {detail.appeals.map(a=><div key={a.id} style={{marginBottom:10}}>
        <strong>{a.status}</strong> · {a.message}
        {a.resolution&&<p className="muted">{a.resolution}</p>}
      </div>)}
    </>}
  </section>;
}
