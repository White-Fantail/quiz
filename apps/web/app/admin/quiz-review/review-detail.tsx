"use client";
import {useEffect,useMemo,useState} from "react";
import Link from "next/link";
import {useRouter,useSearchParams} from "next/navigation";
import {useLocale} from "../../../src/i18n/provider";
import {localizeHref} from "../../../src/i18n/core";
import {bilingual} from "../../../src/i18n/view-copy";

type Clue={type:string;text?:string;mediaId?:string;map?:{latitude:number;longitude:number};reveal?:{effect:string;strength:number}};
type Details={id:string;title:string;prompt:string;version:number;publication:string;safetyStatus:string;kidsEligible:boolean;
 answer:{canonical:string;aliases?:string[]};clues:Clue[];promptMediaIds:string[];authorId:string;
 childSafetySignals?:Array<{reason:string;count:number}>};
type Media={id:string;kind:string;alt:string;attribution:string;license:string;moderationStatus:string;previewUrl:string};

async function api(path:string,locale:"en"|"ko",method="GET",payload?:unknown){
  const res=await fetch("/api/v1"+path,{method,credentials:"same-origin",cache:"no-store",
    headers:payload?{"Content-Type":"application/json"}:undefined,
    body:payload?JSON.stringify(payload):undefined});
  const data=await res.json().catch(()=>({}));
  if(!res.ok)throw Error(data.message||data.error||bilingual(locale,"Could not process the request","요청을 처리하지 못했어요"));
  return data.data;
}

export default function QuizReviewDetail({id}:{id:string}){
  const locale=useLocale(),router=useRouter(),params=useSearchParams();
  const msg=(en:string,ko:string)=>bilingual(locale,en,ko);
  const [selected,setSelected]=useState<Details|null>(null);
  const [media,setMedia]=useState<Record<string,Media>>({});
  const [missingMedia,setMissingMedia]=useState<string[]>([]);
  const [reason,setReason]=useState("");
  const [busy,setBusy]=useState(false),[loading,setLoading]=useState(true);
  const [error,setError]=useState(""),[notice,setNotice]=useState("");
  const back=useMemo(()=>{
    const state=new URLSearchParams();
    for(const name of ["filter","q","page"]){const value=params.get(name);if(value)state.set(name,value);}
    return localizeHref("/admin/quiz-review",locale)+(state.size?"?"+state.toString():"");
  },[locale,params]);
  useEffect(()=>{
    let active=true;
    async function load(){
      setLoading(true);setError("");
      try{
        const details:Details=await api("/quizzes/"+encodeURIComponent(id)+"/review",locale);
        const ids=[...new Set([...(details.promptMediaIds??[]),...details.clues.map(c=>c.mediaId).filter((x):x is string=>!!x)])];
        const results=await Promise.allSettled(ids.map(mediaId=>api("/media/"+mediaId+"/review",locale)));
        if(!active)return;
        const assets:Record<string,Media>={},failed:string[]=[];
        results.forEach((result,i)=>{if(result.status==="fulfilled")assets[ids[i]]=result.value;else failed.push(ids[i]);});
        setSelected(details);setMedia(assets);setMissingMedia(failed);
      }catch(e){if(active)setError(e instanceof Error?e.message:msg("Could not open this quiz.","문제를 열 수 없어요."));}
      finally{if(active)setLoading(false);}
    }
    void load();
    return ()=>{active=false;};
  },[id,locale]);
  const canRestrict=reason.trim().length>=5;
  async function review(verdict:"APPROVED"|"RESTRICTED",kidsEligible=false){
    if(!selected||busy)return;
    if(verdict==="RESTRICTED"&&!canRestrict){setError(msg("Enter at least 5 characters explaining the restriction.","제한 사유를 5자 이상 입력해 주세요."));return;}
    if(!window.confirm(msg("Have you personally checked the quiz and its media? Confirm the decision.","문제와 미디어를 직접 확인했나요? 심사를 확정할까요?")))return;
    setBusy(true);setError("");setNotice("");
    try{
      await api("/quizzes/"+selected.id+"/review",locale,"POST",{verdict,kidsEligible,reason:reason.trim(),confirm:true});
      const url=back+(back.includes("?")?"&":"?")+"result="+(verdict==="RESTRICTED"?"restricted":"approved");
      router.push(url);
    }catch(e){setError(e instanceof Error?e.message:msg("Could not save review.","심사 결과를 저장하지 못했어요."));}
    finally{setBusy(false);}
  }
  async function reviewMedia(mediaId:string,verdict:"APPROVED"|"RESTRICTED"){
    if(busy)return;
    if(verdict==="RESTRICTED"&&!canRestrict){setError(msg("Enter at least 5 characters explaining the restriction.","미디어 제한 사유를 5자 이상 입력해 주세요."));return;}
    if(!window.confirm(msg("Have you checked the media content, source and usage rights?","미디어의 내용, 출처 및 이용 권리를 확인했나요?")))return;
    setBusy(true);setError("");setNotice("");
    try{
      await api("/media/"+mediaId+"/review",locale,"POST",{verdict,reason:reason.trim(),confirm:true});
      const updated:Media=await api("/media/"+mediaId+"/review",locale);
      setMedia(old=>({...old,[mediaId]:updated}));
      setNotice(msg("Media review saved.","미디어 심사를 저장했어요."));
    }catch(e){setError(e instanceof Error?e.message:msg("Media review failed.","미디어 심사에 실패했어요."));}
    finally{setBusy(false);}
  }
  function mediaView(mediaId:string){
    const item=media[mediaId];
    if(!item)return <p className="feedback" role="alert">{msg("Media unavailable. Do not approve before inspecting it.","미디어를 불러오지 못했어요. 확인 전에는 승인하지 마세요.")}</p>;
    return <div className="review-media" key={mediaId}>
      <span className="small-tag">{item.kind} · {item.moderationStatus}</span>
      <p className="muted review-media-meta">{item.alt||msg("No description","설명 없음")} · {item.attribution||msg("No source","출처 없음")} · {item.license||msg("No license","라이선스 없음")}</p>
      {item.kind==="image"&&<img src={item.previewUrl} alt={item.alt||msg("Media under review","심사 미디어")} className="round-media"/>}
      {item.kind==="audio"&&<audio controls src={item.previewUrl}/>}
      {item.kind==="video"&&<video controls src={item.previewUrl} className="round-media"/>}
      <div className="review-media-actions">
        {item.moderationStatus!=="APPROVED"&&<button className="btn btn-outline" type="button" disabled={busy}
          onClick={()=>void reviewMedia(mediaId,"APPROVED")}>{msg("Approve media","미디어 승인")}</button>}
        <button className="btn btn-outline" type="button" disabled={busy||!canRestrict}
          onClick={()=>void reviewMedia(mediaId,"RESTRICTED")}>{msg("Restrict media","미디어 제한")}</button>
      </div>
    </div>;
  }
  return <div className="review-console review-detail">
    <Link className="review-back-link" href={back}>← {msg("Back to review queue","심사 목록으로 돌아가기")}</Link>
    {error&&<p className="feedback" role="alert">{error}</p>}
    {notice&&<p className="feedback success" role="status">{notice}</p>}
    {loading&&<p className="muted" role="status">{msg("Loading review…","심사 내용을 불러오는 중…")}</p>}
    {selected&&<article className="placeholder-panel review-detail-card">
      <div className="review-detail-heading"><div><h2>{selected.title}</h2>
        <p className="muted">v{selected.version} · {selected.publication}</p></div>
        <span className="small-tag">{selected.safetyStatus}{selected.kidsEligible?" · KIDS":""}</span>
      </div>
      <h3>{msg("Question","문제")}</h3><p>{selected.prompt}</p>
      <div className="review-answer"><strong>{msg("Answer","정답")}</strong> {selected.answer.canonical}</div>
      {!!selected.childSafetySignals?.length&&<p className="muted">{msg("Child safety reports","어린이 안전 신고")}: {selected.childSafetySignals.map(s=>s.reason+" ("+s.count+")").join(", ")}</p>}
      {!!selected.promptMediaIds?.length&&<section className="review-content-section">
        <h3>{msg("Question media","문제 미디어")}</h3>
        {selected.promptMediaIds.map(id=><div key={id}>{mediaView(id)}</div>)}
      </section>}
      <section className="review-content-section"><h3>{msg("Clues","단서")}</h3>
        <ol className="clue-list">{selected.clues.map((clue,i)=><li key={i}>
          <strong>{clue.type}</strong>
          {clue.text&&<p>{clue.text}</p>}
          {clue.mediaId&&mediaView(clue.mediaId)}
          {clue.reveal&&<p className="muted">{clue.reveal.effect} · {clue.reveal.strength}%</p>}
          {clue.map&&<p>{msg("Latitude","위도")} {clue.map.latitude} · {msg("Longitude","경도")} {clue.map.longitude}</p>}
        </li>)}</ol>
      </section>
      {!!missingMedia.length&&<p className="feedback" role="alert">{msg("Some media could not be inspected. Verify it before approval.","일부 미디어를 불러오지 못했습니다. 승인 전에 확인하세요.")}</p>}
      <section className="review-decision review-content-section">
        <h3>{msg("Review decision","심사 결정")}</h3>
        <label className="review-reason-label">{msg("Review note — optional for approval, required for restriction (5+ characters)","심사 사유 — 승인 시 선택, 제한 시 필수 (5자 이상)")}
          <textarea rows={3} value={reason} onChange={e=>setReason(e.target.value)} maxLength={1000}
            placeholder={msg("Explain a restriction, or optionally leave an approval note.","제한 사유를 입력하거나 승인 메모를 남길 수 있어요.")}/>
        </label>
        <div className="actions review-decision-actions">
          <button className="btn btn-primary" type="button" disabled={busy||missingMedia.length>0}
            onClick={()=>void review("APPROVED",true)}>{msg("Approve for Kids","어린이용 승인")}</button>
          <button className="btn btn-outline" type="button" disabled={busy||missingMedia.length>0}
            onClick={()=>void review("APPROVED",false)}>{msg("Approve for general play","일반용 승인")}</button>
          <button className="btn btn-outline" type="button" disabled={busy||!canRestrict}
            onClick={()=>void review("RESTRICTED",false)}>{msg("Restrict quiz","문제 제한")}</button>
        </div>
        <p className="muted">{msg("An approval still requires confirmation and server-side media checks. Every decision is logged.","승인 시에도 확인 절차와 서버 미디어 검증을 거치며 모든 판정은 감사 기록에 남아요.")}</p>
      </section>
    </article>}
  </div>;
}
