"use client";
import {useEffect,useState} from "react";
import Link from "next/link";
import {useSearchParams} from "next/navigation";
import {useLocale} from "../../../src/i18n/provider";
import {localizeHref} from "../../../src/i18n/core";
import {bilingual} from "../../../src/i18n/view-copy";

type Summary={id:string;title:string;mode:string;version:number;publication:string;
  safetyStatus:string;kidsEligible:boolean;kidsReviewStatus:string;
  reportCount:number;seriousReportCount:number;ratingCount:number;negativeCount:number;ratingFlag:boolean};
type Queue="ATTENTION"|"REPORTS"|"RATINGS"|"KIDS"|"RESTRICTED"|"ALL";
const PAGE_SIZE=16;
const queues:Queue[]=["ATTENTION","REPORTS","RATINGS","KIDS","RESTRICTED","ALL"];

export default function QuizReviewConsole(){
  const locale=useLocale(),params=useSearchParams();
  const msg=(en:string,ko:string)=>bilingual(locale,en,ko);
  const initial=params.get("queue");
  const [queue,setQueue]=useState<Queue>(queues.includes(initial as Queue)?initial as Queue:"ATTENTION");
  const [query,setQuery]=useState(params.get("q")??"");
  const [page,setPage]=useState(Math.max(1,Number(params.get("page"))||1));
  const [quizzes,setQuizzes]=useState<Summary[]>([]);
  const [total,setTotal]=useState(0);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");
  const outcome=params.get("result");
  const labels:Record<Queue,string>={
    ATTENTION:msg("Needs attention","검토 필요"),REPORTS:msg("Reports","신고"),
    RATINGS:msg("Negative feedback","부정 평가"),KIDS:msg("Kids requests","어린이용 신청"),
    RESTRICTED:msg("Restricted","제한된 문제"),ALL:msg("All published","전체 공개")
  };
  useEffect(()=>{
    let active=true;setLoading(true);setError("");
    const timer=setTimeout(async()=>{
      try{
        const args=new URLSearchParams({limit:String(PAGE_SIZE),offset:String((page-1)*PAGE_SIZE),queue,search:query.trim()});
        const response=await fetch("/api/v1/admin/quizzes/review?"+args.toString(),{credentials:"same-origin",cache:"no-store"});
        const body=await response.json().catch(()=>({}));
        if(!response.ok)throw Error(body.message||body.error||"Could not load safety review");
        if(active){setQuizzes(body.data?.items??[]);setTotal(body.data?.total??0);}
      }catch(e){if(active){setQuizzes([]);setError(e instanceof Error?e.message:"Could not load safety review");}}
      finally{if(active)setLoading(false);}
    },200);
    return ()=>{active=false;clearTimeout(timer);};
  },[queue,query,page]);
  const pages=Math.max(1,Math.ceil(total/PAGE_SIZE));
  function detailHref(id:string){
    const state=new URLSearchParams({queue,q:query,page:String(page)});
    return localizeHref("/admin/quiz-review/"+encodeURIComponent(id),locale)+"?"+state.toString();
  }
  return <section className="review-console section">
    <div className="review-section-heading">
      <div><h2>{msg("Flagged content and Kids requests","이상 징후 및 어린이용 신청")}</h2>
        <p className="muted">{msg("General quizzes go live immediately. Only reports, unusually high negative feedback and creator-requested Kids quizzes need attention.","일반 문제는 즉시 공개됩니다. 신고·높은 부정 평가·제작자의 Kids 신청 문제만 우선 검토합니다.")}</p></div>
      <span className="small-tag">{total} {msg("results","개")}</span>
    </div>
    {outcome&&<p className="feedback success" role="status">{msg("Moderation decision saved.","심사 결과를 저장했습니다.")}</p>}
    <div className="review-list-controls">
      <label className="review-search-label">{msg("Search by title","제목 검색")}
        <input type="search" value={query} onChange={e=>{setQuery(e.target.value);setPage(1);}} placeholder={msg("Search published quizzes","공개 문제 검색")}/>
      </label>
      <label className="review-filter-label">{msg("Review category","검토 분류")}
        <select value={queue} onChange={e=>{setQueue(e.target.value as Queue);setPage(1);}}>
          {queues.map(q=><option key={q} value={q}>{labels[q]}</option>)}
        </select>
      </label>
    </div>
    <p className="muted">{msg("Negative-feedback alert: at least 20 distinct voters, 70% negative (14+), and at least 5 new negative voters since the last check. Ratings alone never hide a quiz.","부정 평가 감지: 서로 다른 평가자 20명 이상, 싫어요 70% 이상(최소 14명), 마지막 검토 이후 신규 부정 평가 5명 이상. 싫어요만으로 자동 숨김 처리하지 않습니다.")}</p>
    {error&&<p className="feedback" role="alert">{error}</p>}
    {loading&&<p className="muted" role="status">{msg("Loading…","불러오는 중…")}</p>}
    {!loading&&!error&&!quizzes.length&&<p className="muted">{msg("No quizzes in this category.","이 분류에 해당하는 문제가 없습니다.")}</p>}
    <div className="review-result-list">
      {!loading&&quizzes.map(q=><Link className="review-entry" href={detailHref(q.id)} key={q.id}>
        <span className="review-entry-copy"><strong>{q.title}</strong>
          <small>{q.mode} · v{q.version}
            {q.reportCount>0?" · "+msg("Reports","신고")+" "+q.reportCount:""}
            {q.ratingFlag?" · "+msg("High negative ratings","부정 평가 높음")+" "+q.negativeCount+"/"+q.ratingCount:""}
            {q.kidsReviewStatus==="REQUESTED"?" · "+msg("Kids requested","Kids 신청"):""}
            {q.kidsEligible?" · Kids ✓":""}
          </small></span>
        <span className="review-entry-right">
          <span className="small-tag">{q.safetyStatus==="RESTRICTED"?msg("Restricted","제한됨"):q.seriousReportCount>0?msg("Urgent report","우선 신고"):q.kidsReviewStatus==="REQUESTED"?msg("Kids review","Kids 심사"):msg("Visible","공개 중")}</span>
          <span aria-hidden="true">›</span>
        </span>
      </Link>)}
    </div>
    {!loading&&pages>1&&<nav className="review-pagination" aria-label={msg("Queue pages","심사 목록 페이지")}>
      <button className="btn btn-outline" type="button" disabled={page===1}
        onClick={()=>setPage(p=>Math.max(1,p-1))}>{msg("Previous","이전")}</button>
      <span>{page} / {pages}</span>
      <button className="btn btn-outline" type="button" disabled={page>=pages}
        onClick={()=>setPage(p=>Math.min(pages,p+1))}>{msg("Next","다음")}</button>
    </nav>}
  </section>;
}
