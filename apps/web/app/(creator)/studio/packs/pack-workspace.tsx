"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useLocale } from "../../../../src/i18n/provider";
import { localizeHref } from "../../../../src/i18n/core";
import {listHref,listPageIndex,useListUrlState} from "../../../../src/lib/list-url-state";

type Pack={id:string;title:string;description:string;publication:string;orderMode:"CREATOR"|"RANDOM";quizIds:string[];kidsReviewStatus:string;excludedCount:number;safetyStatus:string};
type PackPage={items:Pack[];total:number;hasMore:boolean};
const PAGE_SIZE=20;
export default function PackWorkspace(){
  const locale=useLocale(),ko=locale==="ko";
  const defaults={page:"1"};
  const [listing,updateListing,ready]=useListUrlState(defaults);
  const page=listPageIndex(listing.page);
  const detailHref=(path:string)=>listHref(localizeHref(path,locale),listing,defaults);
  const [items,setItems]=useState<Pack[]>([]);
  const [total,setTotal]=useState(0);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");
  const [retry,setRetry]=useState(0);
  useEffect(()=>{
    if(!ready)return;
    const controller=new AbortController();
    setLoading(true);setError("");
    void fetch("/api/v1/packs?mine=true&locale="+locale+"&limit="+PAGE_SIZE+"&offset="+page*PAGE_SIZE,{
      credentials:"same-origin",cache:"no-store",signal:controller.signal
    }).then(async r=>{
      const json=await r.json();
      if(!r.ok)throw Error(json.message||json.error||"Could not load packs");
      return json.data as PackPage;
    }).then(data=>{
      if(!controller.signal.aborted){setItems(data.items||[]);setTotal(data.total||0);}
    }).catch(e=>{
      if(!controller.signal.aborted)setError(e instanceof Error?e.message:String(e));
    }).finally(()=>{if(!controller.signal.aborted)setLoading(false);});
    return ()=>controller.abort();
  },[ready,page,locale,retry]);
  const pages=Math.max(1,Math.ceil(total/PAGE_SIZE));
  return <section className="studio-workspace" aria-label={ko?"내 퀴즈팩":"My quiz packs"}>
    <div className="studio-section-head">
      <div><h2>{ko?"내 퀴즈팩":"My packs"}</h2><p className="muted">{ko?"팩을 선택하면 별도의 편집 페이지로 이동합니다.":"Select a pack to open its own editing page."}</p></div>
      <Link className="btn btn-primary" href={localizeHref("/studio/packs/new",locale)}>{ko?"+ 새 팩 만들기":"+ Create pack"}</Link>
    </div>
    {!error&&<p className="muted" aria-live="polite">{loading?(ko?"불러오는 중…":"Loading…"):ko?("전체 "+total+"개"):total+" packs"}</p>}
    {error&&<div className="studio-empty" role="alert"><p>{error}</p><button type="button" className="btn btn-outline" onClick={()=>setRetry(n=>n+1)}>{ko?"다시 시도":"Retry"}</button></div>}
    {!error&&loading&&<div className="studio-empty" role="status">{ko?"팩을 불러오는 중…":"Loading your packs…"}</div>}
    {!error&&!loading&&!items.length&&<div className="studio-empty"><h3>{ko?"아직 만든 퀴즈팩이 없어요":"No packs yet"}</h3>
      <p>{ko?"새 팩을 만들어 내 문제를 묶어 보세요.":"Create your first pack to organize your questions."}</p>
      <Link className="btn btn-primary" href={localizeHref("/studio/packs/new",locale)}>{ko?"새 팩 만들기":"Create pack"}</Link>
    </div>}
    {!error&&!loading&&items.length>0&&<div className="studio-list">
      {items.map(pack=><article className="studio-list-row pack-list-card" key={pack.id}>
        <div className="studio-list-main">
          <div className="studio-chip-row">
            <span className={"media-state-chip "+(pack.publication==="PUBLISHED"?"media-ok":"media-wait")}>{pack.publication==="PUBLISHED"?(ko?"공개":"Published"):pack.publication==="HIDDEN"?(ko?"숨김":"Hidden"):(ko?"초안":"Draft")}</span>
            <span className="media-state-chip media-wait">{pack.quizIds.length}{ko?"문제":" questions"}</span>
            <span className="media-state-chip media-wait">{pack.orderMode==="RANDOM"?(ko?"랜덤 순서":"Random order"):(ko?"등록 순서":"Creator order")}</span>
            {pack.kidsReviewStatus==="APPROVED"&&<span className="media-state-chip media-ok">{ko?"어린이용 승인":"Kids approved"}</span>}
            {pack.kidsReviewStatus==="PENDING"&&<span className="media-state-chip media-wait">{ko?"어린이 심사 대기":"Kids review pending"}</span>}
            {pack.kidsReviewStatus==="REJECTED"&&<span className="media-state-chip media-wait">{ko?"어린이 신청 거절":"Kids review rejected"}</span>}
            {pack.safetyStatus==="RESTRICTED"&&<span className="media-state-chip media-wait">{ko?"팩 제한됨":"Pack restricted"}</span>}
          </div>
          <h3><Link href={detailHref("/studio/packs/"+pack.id)}>{pack.title}</Link></h3>
          {pack.description&&<p>{pack.description}</p>}
        </div>
        <div className="studio-list-side">
          <Link href={detailHref("/studio/packs/"+pack.id)} className="btn btn-outline">{ko?"팩 편집 →":"Edit pack →"}</Link>
        </div>
      </article>)}
    </div>}
    {!error&&!loading&&total>PAGE_SIZE&&<nav className="media-pagination" aria-label={ko?"팩 목록 페이지":"Pack pages"}>
      <button type="button" className="btn btn-outline" disabled={page===0} onClick={()=>updateListing({page:String(Math.max(1,page))})}>{ko?"이전":"Previous"}</button>
      <span aria-live="polite">{page+1} / {pages}</span>
      <button type="button" className="btn btn-outline" disabled={page+1>=pages} onClick={()=>updateListing({page:String(page+2)})}>{ko?"다음":"Next"}</button>
    </nav>}
  </section>;
}
