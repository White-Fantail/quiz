"use client";
import {useEffect,useState} from "react";
import Link from "next/link";
import {useSearchParams} from "next/navigation";
import {useLocale} from "../../../src/i18n/provider";
import {localizeHref} from "../../../src/i18n/core";
import {bilingual} from "../../../src/i18n/view-copy";

type Summary={id:string;title:string;mode:string;version:number;publication:string;safetyStatus:string;kidsEligible:boolean};
type Filter="ALL"|"PENDING"|"APPROVED"|"RESTRICTED";
const PAGE_SIZE=16;
const filters:Filter[]=["ALL","PENDING","APPROVED","RESTRICTED"];

export default function QuizReviewConsole(){
  const locale=useLocale(),params=useSearchParams();
  const msg=(en:string,ko:string)=>bilingual(locale,en,ko);
  const initialFilter=params.get("filter");
  const [filter,setFilter]=useState<Filter>(filters.includes(initialFilter as Filter)?initialFilter as Filter:"PENDING");
  const [query,setQuery]=useState(params.get("q")??"");
  const [page,setPage]=useState(Math.max(1,Number(params.get("page"))||1));
  const [quizzes,setQuizzes]=useState<Summary[]>([]);
  const [total,setTotal]=useState(0);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");
  const outcome=params.get("result");
  useEffect(()=>{
    let active=true;
    setLoading(true);setError("");
    const timer=setTimeout(async()=>{
      try{
        const options=new URLSearchParams({limit:String(PAGE_SIZE),offset:String((page-1)*PAGE_SIZE),safety:filter,search:query.trim()});
        const res=await fetch("/api/v1/admin/quizzes/review?"+options.toString(),{credentials:"same-origin",cache:"no-store"});
        const json=await res.json().catch(()=>({}));
        if(!res.ok)throw Error(json.message||json.error||"Could not load moderation queue");
        if(active){
          setQuizzes(json.data?.items??[]);
          setTotal(json.data?.total??0);
        }
      }catch(e){if(active){setQuizzes([]);setError(e instanceof Error?e.message:"Could not load moderation queue");}}
      finally{if(active)setLoading(false);}
    },200);
    return ()=>{active=false;clearTimeout(timer);};
  },[filter,query,page]);
  const totalPages=Math.max(1,Math.ceil(total/PAGE_SIZE));
  const currentPage=Math.min(page,totalPages);
  const shown=quizzes;
  const labels:Record<Filter,string>={
    ALL:msg("All","전체"),PENDING:msg("Pending","대기 중"),
    APPROVED:msg("Approved","승인"),RESTRICTED:msg("Restricted","제한")
  };
  function detailHref(id:string){
    const state=new URLSearchParams({filter,q:query,page:String(currentPage)});
    return localizeHref("/admin/quiz-review/"+encodeURIComponent(id),locale)+"?"+state.toString();
  }
  return <section className="review-console section">
    <div className="review-section-heading">
      <div><h2>{msg("Review queue","심사 목록")}</h2>
        <p className="muted">{msg("Choose a quiz to open its dedicated review page. All published quizzes, including restricted ones, are available.","문제를 선택하면 상세 심사 화면으로 이동해요. 제한된 문제까지 포함해 전체 공개 문제를 조회할 수 있어요.")}</p></div>
      <span className="small-tag">{total} {msg("results","개")}</span>
    </div>
    {outcome&&["approved","restricted"].includes(outcome)&&<p className="feedback success" role="status">{outcome==="approved"?msg("Review approved.","승인 결과를 저장했어요."):msg("Visibility restricted.","제한 결과를 저장했어요.")}</p>}
    <div className="review-list-controls">
      <label className="review-search-label">{msg("Search by title","제목 검색")}
        <input type="search" value={query} onChange={e=>{setQuery(e.target.value);setPage(1);}}
          placeholder={msg("Search published quizzes","전체 공개 문제 검색")}/>
      </label>
      <label className="review-filter-label">{msg("Safety status","안전성 상태")}
        <select value={filter} onChange={e=>{setFilter(e.target.value as Filter);setPage(1);}}>
          {filters.map(value=><option key={value} value={value}>{labels[value]}</option>)}
        </select>
      </label>
    </div>
    {error&&<p className="feedback" role="alert">{error}</p>}
    {loading&&<p className="muted" role="status">{msg("Loading quizzes…","문제를 불러오는 중…")}</p>}
    {!loading&&!error&&!shown.length&&<p className="muted">{msg("No quizzes match these filters.","조건에 맞는 문제가 없어요.")}</p>}
    <div className="review-result-list">
      {shown.map(q=><Link className="review-entry" href={detailHref(q.id)} key={q.id}>
        <span className="review-entry-copy"><strong>{q.title}</strong>
          <small>{q.mode} · v{q.version}{q.kidsEligible?" · Kids":""}</small></span>
        <span className="review-entry-right"><span className="small-tag">{labels[q.safetyStatus as Filter]??q.safetyStatus}</span>
          <span aria-hidden="true">›</span></span>
      </Link>)}
    </div>
    {!loading&&totalPages>1&&<nav className="review-pagination" aria-label={msg("Review queue pages","심사 목록 페이지")}>
      <button className="btn btn-outline" type="button" disabled={currentPage===1}
        onClick={()=>setPage(p=>Math.max(1,p-1))}>{msg("Previous","이전")}</button>
      <span>{currentPage} / {totalPages}</span>
      <button className="btn btn-outline" type="button" disabled={currentPage===totalPages}
        onClick={()=>setPage(p=>Math.min(totalPages,p+1))}>{msg("Next","다음")}</button>
    </nav>}
  </section>;
}
