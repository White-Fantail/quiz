"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useLocale } from "../i18n/provider";
import { localizeHref } from "../i18n/core";
import { RatingBadge } from "./quiz-ratings";
import type { RatingSummary } from "../modules/quiz/rating-metadata";

export function PackShare({path}:{path?:string}) {
  const locale=useLocale(),ko=locale==="ko";
  const [feedback,setFeedback]=useState("");
  async function share(){
    const url=new URL(path?localizeHref(path,locale):window.location.pathname,window.location.origin).href;
    try{
      if(navigator.share)await navigator.share({url});
      else if(navigator.clipboard?.writeText)await navigator.clipboard.writeText(url);
      else throw new Error("clipboard unavailable");
      setFeedback(ko?"공유했어요.":"Ready to share.");
    }catch(error){
      // Canceling the native share sheet is not an error and needs no toast.
      if(error instanceof DOMException&&error.name==="AbortError")return;
      setFeedback(url);
    }
  }
  return <span>
    <button type="button" className="btn btn-outline" onClick={()=>void share()}>{ko?"공유":"Share"} <span aria-hidden="true">↗</span></button>
    {feedback&&<small role="status" className="muted">{feedback}</small>}
  </span>;
}

/** Pack ratings are only writable after a server-verified completed PACK run.
 * The UI cannot grant itself review eligibility.
 */
export default function PackFeedback({packId}:{packId:string}){
  const locale=useLocale(),ko=locale==="ko";
  const [ratings,setRatings]=useState<RatingSummary|null>(null);
  const [mine,setMine]=useState<-1|1|null>(null);
  const [comment,setComment]=useState("");
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const [status,setStatus]=useState("");
  useEffect(()=>{
    let active=true;
    void fetch("/api/v1/packs/"+packId+"/reviews?locale="+locale+"&limit=3",{cache:"no-store"})
      .then(r=>r.ok?r.json():null).then(v=>{if(active&&v?.data?.ratings)setRatings(v.data.ratings);})
      .catch(()=>{});
    return ()=>{active=false};
  },[packId,locale]);
  async function update(rating:-1|1|null){
    setBusy(true);setStatus("");setError("");
    try{
      const r=await fetch("/api/v1/packs/"+packId+"/reviews",{
        method:rating===null?"DELETE":"POST",credentials:"same-origin",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({locale,...(rating===null?{}:{rating,comment})})
      });
      const data=await r.json();
      if(!r.ok)throw new Error(data.message||data.error||"Review failed");
      setMine(rating);setRatings(data.data?.ratings??null);
      setStatus(ko?"팩 평가를 저장했어요.":"Pack feedback saved.");
    }catch(e){setError(e instanceof Error?e.message:String(e));}
    finally{setBusy(false);}
  }
  return <section className="feature-card" aria-label={ko?"퀴즈팩 평가":"Quiz pack feedback"}>
    <h3>{ko?"퀴즈팩 전체는 어땠나요?":"How was the full quiz pack?"}</h3>
    <p className="muted">{ko?"팩 자체에 대한 평가이며 개별 문제 평가와 별도로 집계돼요.":"This rates the pack as a whole, independently of individual quiz ratings."}</p>
    {ratings&&<RatingBadge ratings={ratings}/>}
    <label>{ko?"평가 의견 (선택)":"Comment (optional)"}
      <textarea value={comment} maxLength={2000} onChange={e=>setComment(e.target.value)} rows={2}/>
    </label>
    <div className="actions">
      <button type="button" className="btn btn-primary" disabled={busy} aria-pressed={mine===1}
        onClick={()=>void update(1)}>👍 {ko?"좋아요":"Like"}</button>
      <button type="button" className="btn btn-outline" disabled={busy} aria-pressed={mine===-1}
        onClick={()=>void update(-1)}>👎 {ko?"아쉬워요":"Needs work"}</button>
      {mine!==null&&<button type="button" className="btn btn-outline" disabled={busy}
        onClick={()=>void update(null)}>{ko?"평가 취소":"Remove review"}</button>}
    </div>
    {status&&<p role="status">{status}</p>}
    {error&&<p role="alert" className="feedback">{error}
      {(/authentication_required|sign in/i).test(error)&&<Link href={localizeHref("/sign-in?callbackURL="+encodeURIComponent("/packs/"+packId+"/play"),locale)}>
        {ko?" 로그인":" Sign in"}
      </Link>}
    </p>}
  </section>;
}
