"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type QuizSummary = {
  id: string; title: string; prompt: string; version: number;
  publication: string; safetyStatus: string; kidsEligible: boolean;
  answerType: string; topics: { name: string; isSpoiler?: boolean }[];
  plays: number; reviews: number; createdAt: string; updatedAt: string;
};
type ListResult = { items: QuizSummary[]; total: number; hasMore: boolean };
type Publication = "all"|"DRAFT"|"PUBLISHED"|"HIDDEN";
type Safety = "all"|"PENDING"|"APPROVED"|"RESTRICTED";
type Sort = "newest"|"oldest";
const PAGE_SIZE = 20;
const publicationNames: Record<string,string> = { DRAFT:"초안",PUBLISHED:"공개",HIDDEN:"숨김" };
const safetyNames: Record<string,string> = { PENDING:"검토 대기",APPROVED:"검토 완료",RESTRICTED:"제한됨" };
function label(value: string, names: Record<string,string>) { return names[value] || value; }
function date(value: string) { return new Date(value).toLocaleDateString("ko-NZ",{year:"numeric",month:"short",day:"numeric"}); }

export default function StudioWorkspace() {
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
      if(!response.ok) throw new Error(result.message||result.error||"문제를 가져오지 못했어요.");
      return result.data as ListResult;
    }).then(data=>{
      if(!controller.signal.aborted){setItems(data.items || []);setTotal(data.total||0);}
    }).catch(e=>{
      if(!controller.signal.aborted) setError(e instanceof Error?e.message:"문제를 가져오지 못했어요.");
    }).finally(()=>{if(!controller.signal.aborted)setLoading(false);});
    return ()=>controller.abort();
  },[page,search,publication,safety,sort,refresh]);

  function changeFilter(fn:()=>void){setPage(0);fn();}
  const pages = Math.max(1,Math.ceil(total/PAGE_SIZE));
  return <section className="studio-workspace" aria-label="내 퀴즈 관리">
    <div className="studio-section-head">
      <div><h2>내가 등록한 문제</h2><p className="muted">문제가 많아도 필요한 항목만 찾아볼 수 있어요.</p></div>
      <strong aria-live="polite">{loading?"불러오는 중…":total.toLocaleString("ko-KR")+"개"}</strong>
    </div>
    <div className="studio-filters" role="search" aria-label="내 문제 검색과 필터">
      <label className="studio-search">검색
        <input type="search" value={query} onChange={e=>changeFilter(()=>setQuery(e.target.value))}
          placeholder="제목 또는 질문 내용" maxLength={120}/>
      </label>
      <label>공개 상태
        <select value={publication} onChange={e=>changeFilter(()=>setPublication(e.target.value as Publication))}>
          <option value="all">전체</option><option value="PUBLISHED">공개</option>
          <option value="DRAFT">초안</option><option value="HIDDEN">숨김</option>
        </select>
      </label>
      <label>안전 검토
        <select value={safety} onChange={e=>changeFilter(()=>setSafety(e.target.value as Safety))}>
          <option value="all">전체</option><option value="PENDING">대기</option>
          <option value="APPROVED">완료</option><option value="RESTRICTED">제한</option>
        </select>
      </label>
      <label>정렬
        <select value={sort} onChange={e=>changeFilter(()=>setSort(e.target.value as Sort))}>
          <option value="newest">최근 수정 순</option><option value="oldest">오래된 등록 순</option>
        </select>
      </label>
    </div>
    {error && <div className="studio-empty" role="alert">
      <p>{error}</p><button type="button" className="btn btn-outline" onClick={()=>setRefresh(n=>n+1)}>다시 시도</button>
    </div>}
    {!error && loading && <div className="studio-empty" role="status">문제 목록을 불러오는 중…</div>}
    {!error && !loading && !items.length && <div className="studio-empty">
      <h3>{search||publication!=="all"||safety!=="all"?"일치하는 문제가 없어요":"아직 등록한 문제가 없어요"}</h3>
      <p>{search||publication!=="all"||safety!=="all"?"검색어나 필터를 바꿔 보세요.":"ChatGPT에서 QuizDip 연결을 사용하거나 REST API를 통해 퀴즈를 등록할 수 있어요."}</p>
      {(search||publication!=="all"||safety!=="all") && <button className="btn btn-outline" type="button"
        onClick={()=>{setQuery("");setSearch("");setPublication("all");setSafety("all");setPage(0);}}>필터 초기화</button>}
    </div>}
    {!error && !loading && items.length>0 && <div className="studio-list">
      {items.map(item=><article key={item.id} className="studio-list-row">
        <div className="studio-list-main">
          <div className="studio-chip-row">
            <span className={"media-state-chip "+(item.publication==="PUBLISHED"?"media-ok":"media-wait")}>{label(item.publication,publicationNames)}</span>
            <span className={"media-state-chip "+(item.safetyStatus==="RESTRICTED"?"media-blocked":item.safetyStatus==="APPROVED"?"media-ok":"media-wait")}>{label(item.safetyStatus,safetyNames)}</span>
            {item.kidsEligible&&<span className="media-state-chip media-ok">Kids 노출 가능</span>}
          </div>
          <h3><Link href={"/studio/quizzes/"+item.id}>{item.title}</Link></h3>
          <p>{item.prompt}</p>
          <div className="studio-tags">
            <span>{item.answerType}</span>{item.topics.slice(0,3).map(t=><span key={t.name}>{t.name}{t.isSpoiler?" · 비공개 태그":""}</span>)}
          </div>
        </div>
        <div className="studio-list-side">
          <div className="studio-figures"><span><b>{item.plays.toLocaleString("ko-KR")}</b>시작</span><span><b>{item.reviews.toLocaleString("ko-KR")}</b>리뷰</span></div>
          <small>v{item.version} · {date(item.updatedAt)} 수정</small>
          <Link href={"/studio/quizzes/"+item.id} className="btn btn-outline">관리 및 결과 보기</Link>
        </div>
      </article>)}
    </div>}
    {!error && !loading && total>PAGE_SIZE && <nav className="media-pagination" aria-label="문제 목록 페이지">
      <button type="button" className="btn btn-outline" disabled={page===0} onClick={()=>setPage(n=>n-1)}>이전</button>
      <span aria-live="polite">{page+1} / {pages} 페이지 · {page*PAGE_SIZE+1}–{Math.min(total,(page+1)*PAGE_SIZE)}개 표시</span>
      <button type="button" className="btn btn-outline" disabled={page+1>=pages} onClick={()=>setPage(n=>n+1)}>다음</button>
    </nav>}
  </section>;
}
