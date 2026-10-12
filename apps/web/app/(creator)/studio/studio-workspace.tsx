"use client";

import Link from "next/link";
import { useLocale } from "../../../src/i18n/provider";
import { localizeHref } from "../../../src/i18n/core";
import { bilingual } from "../../../src/i18n/view-copy";
import { useEffect, useState } from "react";

type QuizSummary = {
  id: string; title: string; prompt: string; version: number;
  publication: string; safetyStatus: string; kidsEligible: boolean; kidsReviewStatus:string;
  answerType: string; topics: { name: string; isSpoiler?: boolean }[];
  plays: number; reviews: number; createdAt: string; updatedAt: string;
};
type ListResult = { items: QuizSummary[]; total: number; hasMore: boolean };
type Publication = "all"|"DRAFT"|"PUBLISHED"|"HIDDEN";
type Safety = "all"|"ACTIVE"|"RESTRICTED";
type Sort = "newest"|"oldest";
const PAGE_SIZE = 20;
const publicationNames: Record<string,[string,string]> = { DRAFT:["Draft","초안"],PUBLISHED:["Published","공개"],HIDDEN:["Hidden","숨김"] };
const safetyNames: Record<string,[string,string]> = { ACTIVE:["Active","정상 공개"],RESTRICTED:["Restricted","제한됨"] };
function label(locale:"en"|"ko",value:string,names:Record<string,[string,string]>) { const translated=names[value];return translated?bilingual(locale,...translated):value; }
function date(locale:"en"|"ko",value:string) { return new Date(value).toLocaleDateString(locale==="ko"?"ko-NZ":"en-NZ",{year:"numeric",month:"short",day:"numeric"}); }

export default function StudioWorkspace() {
  const locale=useLocale();
  const msg=(en:string,ko:string)=>bilingual(locale,en,ko);
  const [query,setQuery] = useState("");
  const [search,setSearch] = useState("");
  const [publication,setPublication] = useState<Publication>("all");
  const [safety,setSafety] = useState<Safety>("all");
  const [sort,setSort] = useState<Sort>("newest");
  const [page,setPage] = useState(0);
  const [items,setItems] = useState<QuizSummary[]>([]);
  const [total,setTotal] = useState(0);
  const [loading,setLoading] = useState(true);
  const [error,setError] = useState("");
  const [refresh,setRefresh] = useState(0);

  useEffect(() => {
    const timer = setTimeout(()=>setSearch(query.trim()),300);
    return ()=>clearTimeout(timer);
  },[query]);
  useEffect(()=>{
    const controller = new AbortController();
    const params = new URLSearchParams({
      limit:String(PAGE_SIZE),offset:String(page*PAGE_SIZE),search,publication,safety,sort
    });
    setLoading(true);setError("");
    void fetch("/api/v1/me/quizzes?"+params.toString(),{
      credentials:"same-origin",cache:"no-store",signal:controller.signal
    }).then(async response=>{
      const result=await response.json();
      if(!response.ok) throw new Error(result.message||result.error||msg("Could not load quizzes.","문제를 가져오지 못했어요."));
      return result.data as ListResult;
    }).then(data=>{
      if(!controller.signal.aborted){setItems(data.items || []);setTotal(data.total||0);}
    }).catch(e=>{
      if(!controller.signal.aborted) setError(e instanceof Error?e.message:msg("Could not load quizzes.","문제를 가져오지 못했어요."));
    }).finally(()=>{if(!controller.signal.aborted)setLoading(false);});
    return ()=>controller.abort();
  },[page,search,publication,safety,sort,refresh]);

  function changeFilter(fn:()=>void){setPage(0);fn();}
  const pages = Math.max(1,Math.ceil(total/PAGE_SIZE));
  return <section className="studio-workspace" aria-label={msg("Manage my quizzes","내 퀴즈 관리")}>
    <div className="studio-section-head">
      <div><h2>{msg("My quizzes","내가 등록한 문제")}</h2><p className="muted">{msg("Find and manage your quizzes, even when you have a long list.","문제가 많아도 필요한 항목만 찾아볼 수 있어요.")}</p></div>
      <div className="actions"><Link className="btn btn-primary" href={localizeHref("/studio/quizzes/new",locale)}>{msg("+ Create quiz","+ 새 문제 만들기")}</Link>
      <strong aria-live="polite">{loading?msg("Loading…","불러오는 중…"):total.toLocaleString(locale==="ko"?"ko-KR":"en-NZ")+msg(" quizzes","개")}</strong>
      </div>
    </div>
    <div className="studio-filters" role="search" aria-label={msg("My quiz search and filters","내 문제 검색과 필터")}>
      <label className="studio-search">{msg("Search","검색")}
        <input type="search" value={query} onChange={e=>changeFilter(()=>setQuery(e.target.value))}
          placeholder={msg("Title or question","제목 또는 질문 내용")} maxLength={120}/>
      </label>
      <label>{msg("Publication","공개 상태")}
        <select value={publication} onChange={e=>changeFilter(()=>setPublication(e.target.value as Publication))}>
          <option value="all">{msg("All","전체")}</option><option value="PUBLISHED">{msg("Published","공개")}</option>
          <option value="DRAFT">{msg("Draft","초안")}</option><option value="HIDDEN">{msg("Hidden","숨김")}</option>
        </select>
      </label>
      <label>{msg("Visibility","노출 상태")}
        <select value={safety} onChange={e=>changeFilter(()=>setSafety(e.target.value as Safety))}>
          <option value="all">{msg("All","전체")}</option><option value="ACTIVE">{msg("Active","정상")}</option>
          <option value="RESTRICTED">{msg("Restricted","제한")}</option>
        </select>
      </label>
      <label>{msg("Sort","정렬")}
        <select value={sort} onChange={e=>changeFilter(()=>setSort(e.target.value as Sort))}>
          <option value="newest">{msg("Recently updated","최근 수정 순")}</option><option value="oldest">{msg("Oldest first","오래된 등록 순")}</option>
        </select>
      </label>
    </div>
    {error && <div className="studio-empty" role="alert">
      <p>{error}</p><button type="button" className="btn btn-outline" onClick={()=>setRefresh(n=>n+1)}>{msg("Try again","다시 시도")}</button>
    </div>}
    {!error && loading && <div className="studio-empty" role="status">{msg("Loading quizzes…","문제 목록을 불러오는 중…")}</div>}
    {!error && !loading && !items.length && <div className="studio-empty">
      <h3>{search||publication!=="all"||safety!=="all"?msg("No matching quizzes","일치하는 문제가 없어요"):msg("No quizzes yet","아직 등록한 문제가 없어요")}</h3>
      <p>{search||publication!=="all"||safety!=="all"?msg("Try a different search or filter.","검색어나 필터를 바꿔 보세요."):msg("Create a new quiz directly in Studio.","Studio에서 직접 새 문제를 만들어 보세요.")}</p>
      {!(search||publication!=="all"||safety!=="all")&&<Link className="btn btn-primary" href={localizeHref("/studio/quizzes/new",locale)}>{msg("Create your first quiz","첫 문제 만들기")}</Link>}
      {(search||publication!=="all"||safety!=="all") && <button className="btn btn-outline" type="button"
        onClick={()=>{setQuery("");setSearch("");setPublication("all");setSafety("all");setPage(0);}}>{msg("Clear filters","필터 초기화")}</button>}
    </div>}
    {!error && !loading && items.length>0 && <div className="studio-list">
      {items.map(item=><article key={item.id} className="studio-list-row">
        <div className="studio-list-main">
          <div className="studio-chip-row">
            <span className={"media-state-chip "+(item.publication==="PUBLISHED"?"media-ok":"media-wait")}>{label(locale,item.publication,publicationNames)}</span>
            <span className={"media-state-chip "+(item.safetyStatus==="RESTRICTED"?"media-blocked":"media-ok")}>{label(locale,item.safetyStatus,safetyNames)}</span>
            {item.kidsEligible?<span className="media-state-chip media-ok">{msg("Kids approved","Kids 승인")}</span>:item.kidsReviewStatus==="REQUESTED"?<span className="media-state-chip media-wait">{msg("Kids requested","Kids 심사 신청")}</span>:item.kidsReviewStatus==="REJECTED"?<span className="media-state-chip media-wait">{msg("Kids rejected","Kids 반려")}</span>:null}
          </div>
          <h3><Link href={localizeHref("/studio/quizzes/"+item.id,locale)}>{item.title}</Link></h3>
          <p>{item.prompt}</p>
          <div className="studio-tags">
            <span>{item.answerType}</span>{item.topics.slice(0,3).map(t=><span key={t.name}>{t.name}{t.isSpoiler?msg(" · Hidden tag"," · 비공개 태그"):""}</span>)}
          </div>
        </div>
        <div className="studio-list-side">
          <div className="studio-figures"><span><b>{item.plays.toLocaleString(locale==="ko"?"ko-KR":"en-NZ")}</b>{msg(" starts","시작")}</span><span><b>{item.reviews.toLocaleString(locale==="ko"?"ko-KR":"en-NZ")}</b>{msg(" reviews","리뷰")}</span></div>
          <small>v{item.version} · {date(locale,item.updatedAt)}{msg(" updated"," 수정")}</small>
          <div className="studio-quiz-row-actions">
            <Link href={localizeHref("/studio/quizzes/"+item.id+"/edit",locale)} className="btn btn-primary">{msg("Edit quiz","문제 수정")}</Link>
            <Link href={localizeHref("/studio/quizzes/"+item.id+"/preview",locale)} className="btn btn-outline">{msg("Test play","테스트 플레이")}</Link>
            <Link href={localizeHref("/studio/quizzes/"+item.id,locale)} className="btn btn-outline">{msg("Manage and view results","관리 및 결과 보기")}</Link>
          </div>
        </div>
      </article>)}
    </div>}
    {!error && !loading && total>PAGE_SIZE && <nav className="media-pagination" aria-label={msg("Quiz list pages","문제 목록 페이지")}>
      <button type="button" className="btn btn-outline" disabled={page===0} onClick={()=>setPage(n=>n-1)}>{msg("Previous","이전")}</button>
      <span aria-live="polite">{page+1} / {pages}{msg(" pages · "," 페이지 · ")}{page*PAGE_SIZE+1}–{Math.min(total,(page+1)*PAGE_SIZE)}{msg(" shown","개 표시")}</span>
      <button type="button" className="btn btn-outline" disabled={page+1>=pages} onClick={()=>setPage(n=>n+1)}>{msg("Next","다음")}</button>
    </nav>}
  </section>;
}
