"use client";

import { useEffect, useRef, useState } from "react";
import MediaAddButton from "./media-add-button";
import { useLocale } from "../../../../src/i18n/provider";
import { bilingual } from "../../../../src/i18n/view-copy";
import { formatMediaBytes, mediaUploadLabel, mediaModerationLabel } from "../../../../src/lib/media-view";
import {listPageIndex,useListUrlState} from "../../../../src/lib/list-url-state";

type Kind = "image" | "audio" | "video";
type Media = {
  id: string; kind: Kind; mimeType: string; originalName: string;
  sizeBytes: number; status: string; moderationStatus: string;
  alt: string; attribution: string; license?: string; sourceUrl?: string | null; createdAt: string; uploadExpiresAt?: string | null;
};
type MediaUsage = { quizId: string; title: string; version: number; isCurrent: boolean; publication: string; inPrompt: boolean; cluePositions: number[] };
type MediaDetails = Media & {
  previewUrl?: string; thumbnailUrl?: string; previewExpiresInSeconds?: number;
  usage?: { items: MediaUsage[]; hasMore: boolean };
};
type MediaListResult = { items: Media[]; total: number; hasMore: boolean };
type FilterKind = "all" | Kind;
type FilterModeration = "all" | "PENDING" | "APPROVED" | "RESTRICTED";
type FilterStatus = "all" | "READY" | "UPLOADING";
type FilterUsage = "all" | "used" | "unused";
type Sort = "newest" | "oldest" | "name" | "size";

const PAGE_SIZE = 24;
const kindNames: Record<Kind,[string,string]> = { image:["Image","이미지"], audio:["Audio","오디오"], video:["Video","동영상"] };
async function api(path: string, method="GET", body?: object,locale:"en"|"ko"="en"): Promise<any> {
  const response = await fetch("/api/v1"+path, {
    method, credentials:"same-origin", cache:"no-store",
    headers: body ? { "Content-Type":"application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (result.error === "import_forbidden" || result.code === "import_forbidden")
      throw new Error(bilingual(locale,"This image host is not approved. Download a properly licensed file and upload it, or ask an administrator to allow the exact host.","허용되지 않은 이미지 출처입니다. 라이선스가 확인된 파일을 직접 업로드하거나 관리자에게 해당 호스트 허용을 요청하세요."));
    throw new Error(result.message || result.error || bilingual(locale,"Could not process this media request.","미디어 요청을 처리하지 못했어요."));
  }
  return result.data;
}

/** Fetch the owner's 60-second signed thumbnail only when the image scrolls into view.
 * The server keeps originals and thumbnails private in R2, including unreviewed files.
 */
function MediaThumbnail({ item }: { item: Media }) {
  const locale=useLocale();
  const msg=(en:string,ko:string)=>bilingual(locale,en,ko);
  const node = useRef<HTMLDivElement|null>(null);
  const [src,setSrc] = useState("");
  const [failed,setFailed] = useState(false);
  useEffect(() => {
    if (item.status !== "READY" || item.kind !== "image") return;
    let cancelled = false;
    const load = () => {
      void api("/media/"+item.id+"?purpose=thumbnail","GET",undefined,locale).then((details: MediaDetails) => {
        if (!cancelled) {
          if (details.thumbnailUrl || details.previewUrl) setSrc(details.thumbnailUrl || details.previewUrl || "");
          else setFailed(true);
        }
      }).catch(() => { if (!cancelled) setFailed(true); });
    };
    if (!node.current || typeof IntersectionObserver === "undefined") load();
    else {
      const observer = new IntersectionObserver((entries) => {
        if (entries.some(entry => entry.isIntersecting)) { observer.disconnect(); load(); }
      }, { rootMargin: "180px" });
      observer.observe(node.current);
      return () => { cancelled = true; observer.disconnect(); };
    }
    return () => { cancelled = true; };
  }, [item.id,item.kind,item.status]);
  return <div ref={node} className="media-thumb">
    {src ? <img src={src} alt={item.alt || item.originalName} loading="lazy"
      onError={() => {setSrc("");setFailed(true);}}/> :
      <span className="media-thumb-fallback" aria-label={failed?msg("Preview failed to load","미리보기를 불러오지 못했어요"):msg("Loading preview","미리보기 불러오는 중")}>
        {failed ? msg("Image unavailable","이미지를 볼 수 없어요") : "🖼️"}
      </span>}
  </div>;
}

export default function MediaLibrary() {
  const locale=useLocale();
  const msg=(en:string,ko:string)=>bilingual(locale,en,ko);
  const request=(path:string,method="GET",body?:object)=>api(path,method,body,locale);
  const [items,setItems] = useState<Media[]>([]);
  const [total,setTotal] = useState(0);
  const [loading,setLoading] = useState(true);
  const [listing,updateListing,ready]=useListUrlState({
    q:"",kind:"all",moderation:"all",status:"all",usage:"all",sort:"newest",page:"1"
  });
  const searchInput=listing.q;
  const kind=(["all","image","audio","video"].includes(listing.kind)?listing.kind:"all") as FilterKind;
  const moderation=(["all","PENDING","APPROVED","RESTRICTED"].includes(listing.moderation)?listing.moderation:"all") as FilterModeration;
  const status=(["all","READY","UPLOADING"].includes(listing.status)?listing.status:"all") as FilterStatus;
  const usage=(["all","used","unused"].includes(listing.usage)?listing.usage:"all") as FilterUsage;
  const sort=(["newest","oldest","name","size"].includes(listing.sort)?listing.sort:"newest") as Sort;
  const page=listPageIndex(listing.page);
  const setSearchInput=(value:string)=>updateListing({q:value});
  const setKind=(value:FilterKind)=>updateListing({kind:value});
  const setModeration=(value:FilterModeration)=>updateListing({moderation:value});
  const setStatus=(value:FilterStatus)=>updateListing({status:value});
  const setUsage=(value:FilterUsage)=>updateListing({usage:value});
  const setSort=(value:Sort)=>updateListing({sort:value});
  const setPage=(next:number|((prev:number)=>number))=>{
    const value=typeof next==="function"?next(page):next;
    updateListing({page:String(Math.max(0,value)+1)});
  };
  const [search,setSearch] = useState("");
  const [refresh,setRefresh] = useState(0);
  const [details,setDetails] = useState<MediaDetails|null>(null);
  const [detailsLoading,setDetailsLoading] = useState(false);
  const detailRequest = useRef(0);
  const [expandedId,setExpandedId] = useState<string|null>(null);
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState("");
  const [notice,setNotice] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchInput.trim()), 300);
    return () => clearTimeout(timer);
  }, [searchInput]);
  useEffect(() => {
    if(!ready)return;
    let active = true;
    const params = new URLSearchParams({ limit:String(PAGE_SIZE),offset:String(page*PAGE_SIZE),
      search,kind,moderation,status,usage,sort });
    void (async () => {
      setLoading(true);
      try {
        const result: MediaListResult = await request("/media?"+params.toString());
        if (active) { setItems(result.items || []); setTotal(result.total || 0); }
      } catch(e) { if (active) setError(e instanceof Error ? e.message : msg("Could not load media.","목록을 가져오지 못했어요.")); }
      finally { if (active) setLoading(false); }
    })();
    return () => { active=false; };
  }, [ready,search,kind,moderation,status,usage,sort,page,refresh]);

  function reload() { setRefresh(n=>n+1); }
  function newFilter(update: () => void) { detailRequest.current++;setPage(0);setExpandedId(null);setDetails(null);update(); }
  async function show(item: Media) {
    const requestId=++detailRequest.current;
    if (expandedId === item.id) { setExpandedId(null);setDetails(null);setDetailsLoading(false);return; }
    setExpandedId(item.id);setDetails(null);setDetailsLoading(true);setError("");
    try {
      const detail: MediaDetails = await request("/media/"+item.id);
      if (detailRequest.current === requestId) setDetails(detail);
    } catch(e){if (detailRequest.current === requestId) setError(e instanceof Error?e.message:msg("Could not load media details.","상세 정보를 불러오지 못했어요."));}
    finally{if (detailRequest.current === requestId) setDetailsLoading(false);}
  }
  async function remove(item: Media) {
    if (!window.confirm(msg("Delete this file? Active quiz versions, unexpired play sessions and upcoming weekly challenges are protected. Historical usage records remain.","이 파일을 삭제할까요? 현재 버전·만료 전 플레이·예정된 주간 챌린지에서 사용하는 파일은 보호됩니다. 과거 사용 이력은 유지돼요."))) return;
    setBusy(true);setError("");
    try{
      await request("/media/"+item.id,"DELETE",{confirm:true});
      setExpandedId(null);setDetails(null);
      if (page > 0 && items.length <= 1) setPage(n=>n-1);
      else reload();
    }catch(e){setError(e instanceof Error?e.message:msg("Could not delete this file.","삭제할 수 없어요."));}
    finally{setBusy(false);}
  }
  async function copyId(id: string) {
    try{await navigator.clipboard.writeText(id);setNotice(msg("Media ID copied. Reuse it in quizzes or via MCP.","미디어 ID를 복사했습니다. QuizDip 퀴즈나 MCP에서 재사용할 수 있어요."));}
    catch{setError(msg("Could not copy the ID. Select the text manually.","ID 복사에 실패했어요. ID 텍스트를 직접 선택해 주세요."));}
  }
  const pages=Math.max(1,Math.ceil(total/PAGE_SIZE));
  return <div className="media-workspace">
    {error && <p role="alert" className="feedback">{error}</p>}
    {notice && <p role="status" className="feedback success">{notice}</p>}
    <section className="section">
      <div className="media-library-heading">
        <div><h2>{msg("My media","등록한 미디어")}</h2><p className="muted">{msg("Find and reuse media in your quiz clues. Pending-review previews are only visible to the creator.","미디어를 찾아 퀴즈 단서에 재사용하세요. 검토 대기 중인 자료는 제작자에게만 미리보기가 제공됩니다.")}</p></div>
        <strong aria-live="polite">{loading?msg("Loading…","불러오는 중"):total.toLocaleString(locale==="ko"?"ko-KR":"en-NZ")+"개"}</strong>
      </div>
      <div className="media-filters" role="search" aria-label={msg("Media search and filters","미디어 검색 및 필터")}>
        <label className="media-filter-search">{msg("Search","검색")}
          <input type="search" value={searchInput} placeholder={msg("Search name, description or source","파일명, 설명, 출처 검색")}
            onChange={e=>newFilter(()=>setSearchInput(e.target.value))}/>
        </label>
        <label>{msg("Type","종류")}
          <select value={kind} onChange={e=>newFilter(()=>setKind(e.target.value as FilterKind))}>
            <option value="all">{msg("All","전체")}</option><option value="image">{msg("Image","이미지")}</option><option value="audio">{msg("Audio","오디오")}</option><option value="video">{msg("Video","동영상")}</option>
          </select>
        </label>
        <label>{msg("Safety review","안전 검토")}
          <select value={moderation} onChange={e=>newFilter(()=>setModeration(e.target.value as FilterModeration))}>
            <option value="all">{msg("All","전체")}</option><option value="PENDING">{msg("Pending review","검토 대기")}</option><option value="APPROVED">{msg("Approved","승인")}</option><option value="RESTRICTED">{msg("Restricted","제한")}</option>
          </select>
        </label>
        <label>{msg("Upload","업로드")}
          <select value={status} onChange={e=>newFilter(()=>setStatus(e.target.value as FilterStatus))}>
            <option value="all">{msg("All","전체")}</option><option value="READY">{msg("Upload complete","업로드 완료")}</option><option value="UPLOADING">{msg("Uploading / expired","업로드 중/만료")}</option>
          </select>
        </label>
        <label>{msg("Quiz usage","퀴즈 사용")}
          <select value={usage} onChange={e=>newFilter(()=>setUsage(e.target.value as FilterUsage))}>
            <option value="all">{msg("All","전체")}</option><option value="used">{msg("Currently needed","현재 필요한 파일")}</option><option value="unused">{msg("Not needed for playback","현재 재생에 불필요")}</option>
          </select>
        </label>
        <label>{msg("Sort","정렬")}
          <select value={sort} onChange={e=>newFilter(()=>setSort(e.target.value as Sort))}>
            <option value="newest">{msg("Newest first","최신순")}</option><option value="oldest">{msg("Oldest first","오래된 순")}</option><option value="name">{msg("Name","이름순")}</option><option value="size">{msg("Largest first","용량 큰 순")}</option>
          </select>
        </label>
      </div>
      {!loading && !error && !items.length && (total===0 && !searchInput.trim() && kind==="all" && moderation==="all" && status==="all" && usage==="all"
        ? <div className="media-empty media-empty-start">
            <h3>{msg("No media yet","아직 등록된 미디어가 없습니다")}</h3>
            <p>{msg("Add an image, audio or video to reuse in your quizzes.","이미지, 음원 또는 동영상을 추가해 퀴즈에 사용해 보세요.")}</p>
            <MediaAddButton>{msg("+ Add your first media","+ 첫 미디어 추가하기")}</MediaAddButton>
          </div>
        : <p className="media-empty">{msg("No media matches these filters.","조건에 맞는 미디어가 없습니다.")}</p>)}
      <div className="media-grid" aria-busy={loading}>
        {items.map(item=><article className="feature-card media-card" key={item.id}>
          {item.kind==="image" ? <MediaThumbnail item={item}/> :
            <div className="media-thumb media-thumb-icon" aria-hidden="true">
              <span>{item.kind==="audio"?"🔊":"🎬"}</span>
              <small>{item.kind==="audio"?msg("Click to listen","눌러서 듣기"):msg("Click to view","눌러서 보기")}</small>
            </div>}
          <h3 title={item.originalName}>{item.originalName}</h3>
          <p className="media-card-meta">{msg(...kindNames[item.kind])} · {formatMediaBytes(item.sizeBytes)}</p>
          <div className="media-state-line">
            <span className={"media-state-chip "+(item.status==="READY"?"media-ok":"media-wait")}>{mediaUploadLabel(item.status,item.uploadExpiresAt,Date.now(),locale)}</span>
            <span className={"media-state-chip "+(item.moderationStatus==="APPROVED"?"media-ok":item.moderationStatus==="RESTRICTED"?"media-blocked":"media-wait")}>{mediaModerationLabel(item.moderationStatus,locale)}</span>
          </div>
          <div className="media-card-actions">
            <button className="btn btn-outline" type="button" onClick={()=>void show(item)} disabled={busy} aria-expanded={expandedId===item.id}>
              {expandedId===item.id?msg("Collapse","접기"):msg("Details · Preview","상세 · 미리보기")}
            </button>
            <button className="text-button" type="button" onClick={()=>void copyId(item.id)}>{msg("Copy ID","ID 복사")}</button>
            <button className="text-button" type="button" disabled={busy} onClick={()=>void remove(item)}>{msg("Delete","삭제")}</button>
          </div>
          {expandedId===item.id && <div className="media-details" aria-live="polite">
            {detailsLoading && <p>{msg("Loading media details…","상세 정보를 가져오는 중…")}</p>}
            {details?.id===item.id && <>
              {details.previewUrl && details.kind==="image" && <img className="media-preview" src={details.previewUrl} alt={details.alt||details.originalName}/>}
              {details.previewUrl && details.kind==="audio" && <audio controls preload="none" src={details.previewUrl}/>}
              {details.previewUrl && details.kind==="video" && <video controls preload="none" className="media-preview" src={details.previewUrl}/>}
              <p className="media-identity">ID: <code>{item.id}</code></p>
              {details.sourceUrl?.startsWith("https://") && <p>{msg("Original source: ","원본 출처: ")}<a href={details.sourceUrl} target="_blank" rel="noopener noreferrer">{msg("View original image","원본 이미지 보기")}</a></p>}
              {details.attribution && <p>{msg("Credit: ","저작자 · 출처: ")}{details.attribution}</p>}
              {details.license && <p>{msg("Licence / permission: ","라이선스 · 사용 권한: ")}{details.license}</p>}
              <p>{msg("Safety: ","안전성: ")}{mediaModerationLabel(item.moderationStatus,locale)}{msg(" · Preview availability does not mean public approval."," · 자동 미리보기는 공개 승인을 뜻하지 않습니다.")}</p>
              <h4>{msg("Quizzes and versions using this media","사용 중인 퀴즈 / 버전")}</h4>
              {!details.usage?.items?.length && <p>{msg("No linked quizzes. Copy this ID to use it in a new question.","연결된 퀴즈가 없습니다. 이 ID를 복사하여 새 문제에 사용할 수 있어요.")}</p>}
              {details.usage?.items?.map(link=><div className="media-usage-row" key={link.quizId+":"+link.version}>
                <div><b>{link.title}</b><small>{msg("Version ","버전 ")}{link.version} · {link.isCurrent?msg("Current version","현재 버전"):msg("Older version","이전 버전")} · {link.publication==="PUBLISHED"?msg("Published","공개"):msg("Private","비공개")} · {[link.inPrompt?msg("Question body","문제 본문"):null,...(link.cluePositions||[]).map(n=>n+"번 단서")].filter(Boolean).join(", ")}</small></div>
                <button type="button" className="text-button" onClick={()=>void copyId(link.quizId)}>{msg("Copy quiz ID","퀴즈 ID 복사")}</button>
              </div>)}
              {details.usage?.hasMore && <p>{msg("More historical version usage records are available.","다른 과거 버전 사용 이력도 있습니다.")}</p>}
            </>}
          </div>}
        </article>)}
      </div>
      <nav className="media-pagination" aria-label={msg("Media pages","미디어 페이지")}>
        <button type="button" className="btn btn-outline" disabled={page===0||loading} onClick={()=>{detailRequest.current++;setPage(n=>n-1);setExpandedId(null);setDetails(null);}}>{msg("Previous","이전")}</button>
        <span>{page+1} / {pages}{msg(" pages · Total "," 페이지 · 총 ")}{total.toLocaleString(locale==="ko"?"ko-KR":"en-NZ")}{msg("","개")}</span>
        <button type="button" className="btn btn-outline" disabled={page+1>=pages||loading} onClick={()=>{detailRequest.current++;setPage(n=>n+1);setExpandedId(null);setDetails(null);}}>{msg("Next","다음")}</button>
      </nav>
    </section>
  </div>;
}
