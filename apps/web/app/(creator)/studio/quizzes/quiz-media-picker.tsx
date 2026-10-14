"use client";

import Link from "next/link";
import { useEffect,useState } from "react";
import { useLocale } from "../../../../src/i18n/provider";
import { localizeHref } from "../../../../src/i18n/core";
import { bilingual } from "../../../../src/i18n/view-copy";

type Kind="image"|"audio"|"video";
type Media={id:string;kind:Kind;originalName:string;alt?:string;status:string;moderationStatus:string};
type Page={items:Media[];total:number;hasMore:boolean};
async function request(path:string){
  const response=await fetch("/api/v1"+path,{cache:"no-store",credentials:"same-origin"});
  const result=await response.json().catch(()=>({}));
  if(!response.ok)throw Error(result.message||result.error||"Could not load media");
  return result.data;
}
function MediaCard({item,chosen,onSelect}:{item:Media;chosen:boolean;onSelect:(id:string)=>void}){
  const [preview,setPreview]=useState("");
  useEffect(()=>{
    let active=true;
    void request("/media/"+encodeURIComponent(item.id)+(item.kind==="image"?"?purpose=thumbnail":""))
      .then(data=>{if(active)setPreview(data.thumbnailUrl||data.previewUrl||"");}).catch(()=>{});
    return ()=>{active=false;};
  },[item.id,item.kind]);
  return <button type="button" className={"studio-media-choice"+(chosen?" selected":"")} onClick={()=>onSelect(item.id)}>
    <div className="studio-media-choice-preview">
      {item.kind==="image"&&preview?<img src={preview} alt={item.alt||item.originalName} loading="lazy"/>:
        item.kind==="audio"?<span aria-hidden="true">♫</span>:item.kind==="video"?<span aria-hidden="true">▶</span>:<span aria-hidden="true">▧</span>}
    </div>
    <strong title={item.originalName}>{item.originalName}</strong>
    <small>{item.moderationStatus}</small>
  </button>;
}
export default function MediaPicker({kind,selectedId,onSelect,onClose}:{
  kind:Kind;selectedId:string;onSelect:(id:string)=>void;onClose:()=>void;
}){
  const locale=useLocale(),msg=(en:string,ko:string)=>bilingual(locale,en,ko);
  const [query,setQuery]=useState(""),[search,setSearch]=useState("");
  const [page,setPage]=useState(0),[refresh,setRefresh]=useState(0);
  const [data,setData]=useState<Page|null>(null),[loading,setLoading]=useState(true),[error,setError]=useState("");
  useEffect(()=>{
    const timer=setTimeout(()=>{setPage(0);setSearch(query.trim());},300);
    return ()=>clearTimeout(timer);
  },[query]);
  useEffect(()=>{
    let active=true;setLoading(true);setError("");
    const params=new URLSearchParams({kind,status:"READY",limit:"12",offset:String(page*12),
      moderation:"all",usage:"all",sort:"newest",search});
    void request("/media?"+params).then((result:Page)=>{if(active)setData(result);})
      .catch(e=>{if(active)setError(e instanceof Error?e.message:String(e));})
      .finally(()=>{if(active)setLoading(false);});
    return ()=>{active=false;};
  },[kind,page,search,refresh]);
  return <div className="studio-quiz-picker" role="region" aria-label={msg("Choose media","미디어 선택")}>
    <div className="studio-quiz-picker-top">
      <label>{msg("Find an uploaded file","업로드한 파일 검색")}
        <input type="search" value={query} onChange={e=>setQuery(e.target.value)} placeholder={msg("Filename or description","파일명 또는 설명")}/>
      </label>
      <button className="btn btn-outline" type="button" onClick={onClose}>{msg("Close","닫기")}</button>
    </div>
    <div className="actions">
      <Link className="btn btn-outline" href={localizeHref("/studio/media",locale)} target="_blank" rel="noopener noreferrer">
        {msg("Open Media Library ↗","미디어 라이브러리 열기 ↗")}
      </Link>
      <Link className="btn btn-outline" href={localizeHref("/studio/media/new",locale)} target="_blank" rel="noopener noreferrer">{msg("+ Add media ↗","+ 미디어 추가 ↗")}</Link>
      <button className="btn btn-outline" type="button" onClick={()=>setRefresh(n=>n+1)}>{msg("Refresh files","파일 새로고침")}</button>
    </div>
    {loading&&<p role="status">{msg("Loading media…","미디어 불러오는 중…")}</p>}
    {error&&<p role="alert">{error}</p>}
    {!loading&&!error&&data&&<>
      {data.items.length===0?<p>{msg("No uploaded files found. Upload to Media Library, then refresh.","파일이 없습니다. 미디어 라이브러리에 업로드한 뒤 새로고침하세요.")}</p>:
        <div className="studio-quiz-media-grid">
          {data.items.map(item=><MediaCard key={item.id} item={item} chosen={item.id===selectedId} onSelect={onSelect}/>)}
        </div>}
      {data.total>12&&<div className="media-pagination">
        <button type="button" className="btn btn-outline" disabled={page===0} onClick={()=>setPage(n=>n-1)}>{msg("Previous","이전")}</button>
        <span>{page+1} / {Math.ceil(data.total/12)}</span>
        <button type="button" className="btn btn-outline" disabled={!data.hasMore} onClick={()=>setPage(n=>n+1)}>{msg("Next","다음")}</button>
      </div>}
    </>}
  </div>;
}
