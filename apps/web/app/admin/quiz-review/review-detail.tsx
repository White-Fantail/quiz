"use client";
import {useEffect,useMemo,useState} from "react";
import Link from "next/link";
import {useRouter,useSearchParams} from "next/navigation";
import {useLocale} from "../../../src/i18n/provider";
import {localizeHref} from "../../../src/i18n/core";
import {bilingual} from "../../../src/i18n/view-copy";

type Clue={type:string;text?:string;mediaId?:string;map?:{latitude:number;longitude:number};reveal?:{effect:string;strength:number}};
type Details={id:string;title:string;prompt:string;version:number;publication:string;safetyStatus:string;kidsEligible:boolean;kidsReviewStatus:string;
 reports?:Array<{reason:string;detail:string;createdAt:string}>;reviews?:{positive:number;negative:number};
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
    for(const name of ["queue","q","page"]){const value=params.get(name);if(value)state.set(name,value);}
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
  async function review(verdict:"CLEARED"|"KIDS_APPROVED"|"KIDS_REJECTED"|"RESTRICTED"|"RESTORED"){
    if(!selected||busy)return;
    if(["RESTRICTED","KIDS_REJECTED"].includes(verdict)&&!canRestrict){
      setError(msg("Enter at least 5 characters explaining the restriction or rejection.","제한 또는 반려 사유를 5자 이상 입력해 주세요."));return;
    }
    if(!window.confirm(msg("Confirm this moderation decision after inspecting the question and relevant media.","문제와 관련 미디어를 확인한 후 심사 결과를 확정할까요?")))return;
    setBusy(true);setError("");setNotice("");
    try{
      await api("/quizzes/"+selected.id+"/review",locale,"POST",{verdict,reason:reason.trim(),confirm:true});
      router.push(back+(back.includes("?")?"&":"?")+"result="+encodeURIComponent(verdict.toLowerCase()));
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
        <span className="small-tag">{selected.safetyStatus}{selected.kidsEligible?" · KIDS":selected.kidsReviewStatus==="REQUESTED"?" · Kids requested":""}</span>
      </div>
      <h3>{msg("Question","문제")}</h3><p>{selected.prompt}</p>
      <div className="review-answer"><strong>{msg("Answer","정답")}</strong> {selected.answer.canonical}</div>
      {!!selected.reports?.length&&<section className="review-content-section">
        <h3>{msg("Reports requiring review","검토할 사용자 신고")}</h3>
        <ol className="clue-list">{selected.reports.map((report,i)=><li key={i}>
          <strong>{report.reason}</strong> · <small>{new Date(report.createdAt).toLocaleDateString()}</small>
          <p>{report.detail}</p>
        </li>)}</ol>
      </section>}
      {selected.reviews&&<p className="muted">{msg("Quiz ratings","문제 평가")}: 👍 {selected.reviews.positive} · 👎 {selected.reviews.negative}</p>}
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
        <label className="review-reason-label">{msg("Decision note (required for restriction or Kids rejection, 5+ characters)","심사 메모 (제한 또는 Kids 반려 시 5자 이상 필수)")}
          <textarea rows={3} value={reason} onChange={e=>setReason(e.target.value)} maxLength={1000}
            placeholder={msg("Explain the decision if needed.","필요한 경우 심사 사유를 입력하세요.")}/>
        </label>
        <div className="actions review-decision-actions">
          {selected.kidsReviewStatus==="REQUESTED"&&selected.safetyStatus!=="RESTRICTED"&&<>
            <button className="btn btn-primary" type="button" disabled={busy||missingMedia.length>0}
              onClick={()=>void review("KIDS_APPROVED")}>{msg("Approve requested Kids quiz","어린이용 승인")}</button>
            <button className="btn btn-outline" type="button" disabled={busy||!canRestrict}
              onClick={()=>void review("KIDS_REJECTED")}>{msg("Reject Kids request","어린이용 반려")}</button>
          </>}
          {selected.safetyStatus!=="RESTRICTED"&&<>
            <button className="btn btn-outline" type="button" disabled={busy||missingMedia.length>0}
              onClick={()=>void review("CLEARED")}>{msg("Mark alerts reviewed","신고·평가 검토 완료")}</button>
            <button className="btn btn-outline" type="button" disabled={busy||!canRestrict}
              onClick={()=>void review("RESTRICTED")}>{msg("Restrict quiz","문제 제한")}</button>
          </>}
          {selected.safetyStatus==="RESTRICTED"&&<button className="btn btn-primary" type="button" disabled={busy||missingMedia.length>0}
            onClick={()=>void review("RESTORED")}>{msg("Restore general visibility","일반 공개 복구")}</button>}
        </div>
        <p className="muted">{msg("General publication needs no approval. Clearing alerts preserves any Kids decision and only closes the current moderation signals. Every decision is audited.","일반 공개에는 승인이 필요하지 않습니다. 검토 완료는 Kids 승인을 변경하지 않고 현재 신고·평가 신호만 처리합니다. 모든 결정은 감사 기록에 남습니다.")}</p>
      </section>
    </article>}
  </div>;
}
