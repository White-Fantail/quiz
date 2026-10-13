"use client";

import {useEffect,useRef,useState} from "react";
import {useLocale} from "../../../src/i18n/provider";
import {bilingual} from "../../../src/i18n/view-copy";
import {formatMediaBytes} from "../../../src/lib/media-view";
import {listPageIndex,useListUrlState} from "../../../src/lib/list-url-state";

type Kind="image"|"audio"|"video";
type Moderation="PENDING"|"APPROVED"|"RESTRICTED";
type Media={
  id:string;kind:Kind;mimeType:string;originalName:string;ownerName:string;
  sizeBytes:number;status:string;moderationStatus:Moderation;
  alt:string;transcript:string;attribution:string;license:string;
  createdAt:string;
};
type Preview=Media & {previewUrl:string;thumbnailUrl?:string};
type Queue="all"|Moderation;
type KindFilter="all"|Kind;
const PAGE_SIZE=16;
const statusOptions:Queue[]=["PENDING","APPROVED","RESTRICTED","all"];
const kindOptions:KindFilter[]=["all","image","audio","video"];

async function api(path:string,method="GET",body?:object):Promise<any>{
  const response=await fetch("/api/v1"+path,{
    method,credentials:"same-origin",cache:"no-store",
    headers:body?{"Content-Type":"application/json"}:undefined,
    body:body?JSON.stringify(body):undefined
  });
  const result=await response.json().catch(()=>({}));
  if(!response.ok)throw Error(result.message||result.error||"Media request failed");
  return result.data;
}

/** Admin-only presigned previews stay private until each row becomes visible. */
function MediaPreview({item,expanded}:{item:Media;expanded:boolean}){
  const locale=useLocale(),msg=(en:string,ko:string)=>bilingual(locale,en,ko);
  const node=useRef<HTMLDivElement|null>(null);
  const [detail,setDetail]=useState<Preview|null>(null);
  const [error,setError]=useState("");
  useEffect(()=>{
    let active=true;
    let observer:IntersectionObserver|undefined;
    const load=async()=>{
      try{
        const value=await api("/media/"+encodeURIComponent(item.id)+"/review");
        if(active){setDetail(value);setError("");}
      }catch(e){
        if(active)setError(e instanceof Error?e.message:String(e));
      }
    };
    // Only images need a thumbnail in the collapsed list.
    if(expanded)void load();
    else if(item.kind==="image"){
      const target=node.current;
      if(target&&typeof IntersectionObserver!=="undefined"){
        observer=new IntersectionObserver(entries=>{
          if(entries.some(entry=>entry.isIntersecting)){observer?.disconnect();void load();}
        },{rootMargin:"140px"});
        observer.observe(target);
      }else void load();
    }
    return ()=>{active=false;observer?.disconnect();};
  },[item.id,item.kind,expanded]);
  const thumb=detail?.thumbnailUrl||detail?.previewUrl;
  return <>
    <div className="admin-media-thumb" ref={node}>
      {item.kind==="image"&&thumb?<img src={thumb} alt={item.alt||item.originalName} loading="lazy"/>:
        <span>{item.kind==="image"?"IMAGE":item.kind==="audio"?"AUDIO":"VIDEO"}</span>}
    </div>
    {expanded&&<div className="admin-media-detail">
      {error?<p className="feedback" role="alert">{error}</p>:
        !detail?<p className="muted">{msg("Loading preview…","미리보기를 불러오는 중…")}</p>:
        item.kind==="image"?<img src={detail.previewUrl} alt={item.alt||item.originalName}/>:
        item.kind==="audio"?<audio src={detail.previewUrl} controls preload="none"/>:
          <video src={detail.previewUrl} controls preload="none" playsInline/>}
      {item.alt&&<p><b>{msg("Alt text","대체 텍스트")}:</b> {item.alt}</p>}
      {item.attribution&&<p><b>{msg("Attribution","출처")}:</b> {item.attribution}</p>}
      {item.license&&<p><b>{msg("License","라이선스")}:</b> {item.license}</p>}
      {item.transcript&&<p><b>{msg("Transcript","자막/대본")}:</b> {item.transcript}</p>}
    </div>}
  </>;
}

function MediaRow({item,selected,busy,onSelect,onApprove,onRestrict}:{
  item:Media;selected:boolean;busy:boolean;
  onSelect:(id:string,checked:boolean)=>void;
  onApprove:(id:string)=>Promise<void>;
  onRestrict:(id:string,reason:string)=>Promise<void>;
}){
  const locale=useLocale(),msg=(en:string,ko:string)=>bilingual(locale,en,ko);
  const [expanded,setExpanded]=useState(false);
  const [rejecting,setRejecting]=useState(false);
  const [reason,setReason]=useState("");
  const pending=item.moderationStatus==="PENDING";
  const approved=item.moderationStatus==="APPROVED";
  const status=pending?msg("Pending","대기 중"):approved?msg("Approved","승인됨"):msg("Restricted","제한됨");
  const kind=item.kind==="image"?msg("Image","이미지"):item.kind==="audio"?msg("Audio","오디오"):msg("Video","동영상");
  const approve=()=>{
    if(item.moderationStatus==="RESTRICTED"&&
      !window.confirm(msg("Remove the restriction and approve this media?","미디어 제한을 해제하고 승인할까요?")))return;
    void onApprove(item.id);
  };
  return <article className="admin-media-item">
    <div className="admin-media-select">
      {pending&&<input type="checkbox" checked={selected} disabled={busy}
        aria-label={msg("Select media: ","미디어 선택: ")+(item.originalName||item.id)}
        onChange={event=>onSelect(item.id,event.target.checked)}/>}
    </div>
    <MediaPreview item={item} expanded={expanded}/>
    <div className="admin-media-copy">
      <div className="admin-media-name-line">
        <strong>{item.originalName||msg("Untitled media","이름 없는 미디어")}</strong>
        <span className={"media-state-chip "+(pending?"media-wait":approved?"media-ok":"media-blocked")}>{status}</span>
      </div>
      <p className="muted">{kind} · {formatMediaBytes(item.sizeBytes)} · {item.ownerName}</p>
      <p className="muted">{new Date(item.createdAt).toLocaleDateString(locale==="ko"?"ko-KR":"en-NZ")}</p>
      <div className="admin-media-actions">
        <button type="button" className="btn btn-outline" disabled={busy} aria-expanded={expanded}
          onClick={()=>setExpanded(value=>!value)}>{expanded?msg("Close preview","미리보기 닫기"):msg("Preview details","자세히 보기")}</button>
        {!approved&&<button type="button" className="btn btn-primary" disabled={busy}
          onClick={approve}>{item.moderationStatus==="RESTRICTED"?msg("Restore & approve","제한 해제 및 승인"):msg("Approve","승인")}</button>}
        {item.moderationStatus!=="RESTRICTED"&&<button type="button" className="btn btn-outline" disabled={busy}
          onClick={()=>setRejecting(value=>!value)} aria-expanded={rejecting}>
          {rejecting?msg("Cancel rejection","거부 취소"):msg("Reject / restrict","거부 / 제한")}</button>}
      </div>
      {rejecting&&item.moderationStatus!=="RESTRICTED"&&<div className="admin-media-reject">
        <label>{msg("Reason for rejection (required, 5+ characters)","거부 사유 (필수, 5자 이상)")}
          <textarea required minLength={5} maxLength={1000} rows={3} value={reason}
            placeholder={msg("Explain the safety, rights or content concern","안전·저작권·콘텐츠 문제 등 사유를 입력하세요")}
            onChange={event=>setReason(event.target.value)}/>
        </label>
        <button type="button" className="btn btn-outline" disabled={busy||reason.trim().length<5}
          onClick={()=>void onRestrict(item.id,reason.trim())}>{msg("Confirm restriction","거부 및 제한 확정")}</button>
      </div>}
    </div>
  </article>;
}

export default function MediaReviewConsole(){
  const locale=useLocale(),msg=(en:string,ko:string)=>bilingual(locale,en,ko);
  const [listing,updateListing,ready]=useListUrlState({q:"",kind:"all",moderation:"PENDING",page:"1"});
  const query=listing.q;
  const kind=kindOptions.includes(listing.kind as KindFilter)?listing.kind as KindFilter:"all";
  const moderation=statusOptions.includes(listing.moderation as Queue)?listing.moderation as Queue:"PENDING";
  const page=listPageIndex(listing.page);
  const [items,setItems]=useState<Media[]>([]);
  const [total,setTotal]=useState(0);
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState(false);
  const [selected,setSelected]=useState<string[]>([]);
  const [error,setError]=useState("");
  const [notice,setNotice]=useState("");
  const [reload,setReload]=useState(0);
  useEffect(()=>{
    if(!ready)return;
    let active=true;
    setLoading(true);
    const timer=setTimeout(async()=>{
      try{
        const qs=new URLSearchParams({limit:String(PAGE_SIZE),offset:String(page*PAGE_SIZE),
          search:query.trim(),kind,moderation});
        const result=await api("/admin/media/review?"+qs.toString());
        if(active){
          setItems(result.items??[]);
          setTotal(result.total??0);
          setSelected([]);
        }
      }catch(e){if(active){setItems([]);setError(e instanceof Error?e.message:String(e));}}
      finally{if(active)setLoading(false);}
    },160);
    return ()=>{active=false;clearTimeout(timer);};
  },[ready,query,kind,moderation,page,reload]);
  const pages=Math.max(1,Math.ceil(total/PAGE_SIZE));
  const pendingIds=items.filter(item=>item.moderationStatus==="PENDING").map(item=>item.id);
  const allSelected=pendingIds.length>0&&pendingIds.every(id=>selected.includes(id));
  function select(id:string,checked:boolean){
    setSelected(previous=>checked?[...new Set([...previous,id])]:previous.filter(value=>value!==id));
  }
  async function approve(id:string){
    setBusy(true);setNotice("");setError("");
    try{
      await api("/media/"+encodeURIComponent(id)+"/review","POST",{verdict:"APPROVED",confirm:true});
      setNotice(msg("Media approved.","미디어를 승인했습니다."));
      setReload(value=>value+1);
    }catch(e){setError(e instanceof Error?e.message:String(e));}
    finally{setBusy(false);}
  }
  async function restrict(id:string,reason:string){
    if(reason.trim().length<5){
      setError(msg("Enter at least five characters for the rejection reason.","거부 사유를 5자 이상 입력하세요."));
      return;
    }
    setBusy(true);setNotice("");setError("");
    try{
      await api("/media/"+encodeURIComponent(id)+"/review","POST",{verdict:"RESTRICTED",reason:reason.trim(),confirm:true});
      setNotice(msg("Media restricted. The reason was recorded.","미디어를 제한하고 사유를 기록했습니다."));
      setReload(value=>value+1);
    }catch(e){setError(e instanceof Error?e.message:String(e));}
    finally{setBusy(false);}
  }
  async function approveSelected(){
    const ids=pendingIds.filter(id=>selected.includes(id));
    if(!ids.length)return;
    setBusy(true);setNotice("");setError("");
    let succeeded=0;
    const failures:string[]=[];
    // Limit concurrent database connections; do not fire a large batch at the server.
    for(const id of ids){
      try{
        await api("/media/"+encodeURIComponent(id)+"/review","POST",{verdict:"APPROVED",confirm:true});
        succeeded++;
      }catch(e){failures.push(e instanceof Error?e.message:String(e));}
    }
    if(succeeded)setNotice(msg("Approved","승인 완료")+": "+succeeded);
    if(failures.length)setError(msg("Failed to approve","승인 실패")+": "+failures.length+" · "+failures[0]);
    setReload(value=>value+1);
    setBusy(false);
  }
  return <section className="admin-media-review section">
    <div className="review-section-heading">
      <div><h2>{msg("Media awaiting review","미디어 심사 목록")}</h2>
        <p className="muted">{msg("Approve immediately with no comment. Rejecting requires a reason. Previously reviewed media remain searchable.","승인은 메시지 없이 한 번에 처리할 수 있습니다. 거부할 때만 사유를 입력하며, 기존 심사 결과도 검색할 수 있어요.")}</p>
      </div>
      <span className="small-tag">{total} {msg("items","개")}</span>
    </div>
    <div className="admin-media-filters">
      <label>{msg("Search files or creators","파일·제작자 검색")}
        <input type="search" value={query} maxLength={120} onChange={event=>updateListing({q:event.target.value,page:"1"})}
          placeholder={msg("File name or creator","파일명 또는 제작자")}/></label>
      <label>{msg("Review status","심사 상태")}
        <select value={moderation} onChange={event=>updateListing({moderation:event.target.value,page:"1"})}>
          <option value="PENDING">{msg("Pending","대기 중")}</option>
          <option value="APPROVED">{msg("Approved","승인됨")}</option>
          <option value="RESTRICTED">{msg("Restricted","제한됨")}</option>
          <option value="all">{msg("All","전체")}</option>
        </select></label>
      <label>{msg("Media type","미디어 종류")}
        <select value={kind} onChange={event=>updateListing({kind:event.target.value,page:"1"})}>
          <option value="all">{msg("All types","전체")}</option>
          <option value="image">{msg("Images","이미지")}</option>
          <option value="audio">{msg("Audio","오디오")}</option>
          <option value="video">{msg("Video","동영상")}</option>
        </select></label>
    </div>
    {notice&&<p className="feedback success" role="status">{notice}</p>}
    {error&&<p className="feedback" role="alert">{error}</p>}
    {!loading&&pendingIds.length>0&&<div className="admin-media-bulk">
      <label><input type="checkbox" checked={allSelected} disabled={busy}
        onChange={event=>setSelected(event.target.checked?pendingIds:[])}/>
        {msg("Select all pending media on this page","이 페이지 대기 미디어 전체 선택")}</label>
      <button type="button" className="btn btn-primary" disabled={busy||selected.length===0}
        onClick={()=>void approveSelected()}>{msg("Approve selected","선택 항목 승인")} ({selected.length})</button>
    </div>}
    {loading&&<p className="muted" role="status">{msg("Loading media…","미디어를 불러오는 중…")}</p>}
    {!loading&&!error&&!items.length&&<p className="media-empty">{msg("No ready media matches these filters.","조건에 맞는 심사 대상 미디어가 없습니다.")}</p>}
    {!loading&&<div className="admin-media-list">
      {items.map(item=><MediaRow key={item.id} item={item} selected={selected.includes(item.id)} busy={busy}
        onSelect={select} onApprove={approve} onRestrict={restrict}/>)}
    </div>}
    {!loading&&pages>1&&<nav className="review-pagination" aria-label={msg("Media review pages","미디어 심사 페이지")}>
      <button type="button" className="btn btn-outline" disabled={busy||page===0}
        onClick={()=>updateListing({page:String(page)})}>{msg("Previous","이전")}</button>
      <span>{page+1} / {pages}</span>
      <button type="button" className="btn btn-outline" disabled={busy||page>=pages-1}
        onClick={()=>updateListing({page:String(page+2)})}>{msg("Next","다음")}</button>
    </nav>}
  </section>;
}
