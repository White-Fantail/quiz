"use client";

import { useEffect, useRef, useState } from "react";
import { useLocale } from "../../../../src/i18n/provider";
import { bilingual } from "../../../../src/i18n/view-copy";
import { formatMediaBytes, mediaUploadLabel, mediaModerationLabel } from "../../../../src/lib/media-view";

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
const limits: Record<Kind,number> = { image: 12 * 1024 * 1024, audio: 25 * 1024 * 1024, video: 64 * 1024 * 1024 };
const kinds: Record<string,Kind> = {
  "image/jpeg":"image", "image/png":"image", "image/webp":"image",
  "audio/mpeg":"audio", "audio/wav":"audio", "audio/ogg":"audio",
  "video/mp4":"video", "video/webm":"video",
};

const kindNames: Record<Kind,[string,string]> = { image:["Image","이미지"], audio:["Audio","오디오"], video:["Video","동영상"] };
function hex(bytes: ArrayBuffer): string {
  return [...new Uint8Array(bytes)].map(byte => byte.toString(16).padStart(2, "0")).join("");
}
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
  const [searchInput,setSearchInput] = useState("");
  const [search,setSearch] = useState("");
  const [kind,setKind] = useState<FilterKind>("all");
  const [moderation,setModeration] = useState<FilterModeration>("all");
  const [status,setStatus] = useState<FilterStatus>("all");
  const [usage,setUsage] = useState<FilterUsage>("all");
  const [sort,setSort] = useState<Sort>("newest");
  const [page,setPage] = useState(0);
  const [refresh,setRefresh] = useState(0);
  const [selected,setSelected] = useState<File|null>(null);
  const [importUrl,setImportUrl] = useState("");
  const [importAlt,setImportAlt] = useState("");
  const [importCredit,setImportCredit] = useState("");
  const [importLicense,setImportLicense] = useState("");
  const [importRights,setImportRights] = useState(false);
  const [alt,setAlt] = useState("");
  const [attribution,setAttribution] = useState("");
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
  }, [search,kind,moderation,status,usage,sort,page,refresh]);

  function reload() { setRefresh(n=>n+1); }
  function newFilter(update: () => void) { detailRequest.current++;setPage(0);setExpandedId(null);setDetails(null);update(); }
  async function upload() {
    if (!selected) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const mime = selected.type==="audio/x-wav" ? "audio/wav" : selected.type;
      const fileKind = kinds[mime];
      if (!fileKind) throw new Error(msg("Unsupported file type. Use JPEG/PNG/WebP, MP3/WAV/OGG or MP4/WebM.","지원하는 파일 형식이 아니에요. JPEG/PNG/WebP, MP3/WAV/OGG, MP4/WebM을 이용해 주세요."));
      if (selected.size > limits[fileKind]) throw new Error(msg("The file exceeds the size limit for this format.","파일 형식별 크기 제한을 초과했어요."));
      const digest = hex(await crypto.subtle.digest("SHA-256", await selected.arrayBuffer()));
      const ticket = await request("/media/upload","POST",{
        kind:fileKind,mimeType:mime,filename:selected.name,sizeBytes:selected.size,sha256:digest,alt,attribution,
      });
      const put = await fetch(ticket.upload.url, {
        method:ticket.upload.method,headers:ticket.upload.headers,body:selected,
      });
      if (!put.ok) throw new Error(msg("R2 upload failed. Check bucket CORS and permissions.","R2 업로드에 실패했어요. 버킷 CORS 및 접근 권한을 확인해 주세요."));
      await request("/media/"+ticket.id+"/complete","POST",{});
      setSelected(null);setAlt("");setAttribution("");
      setNotice(msg("Upload complete! Media cannot be used in public quizzes until safety review.","업로드 완료! 안전 검토 전에는 공개 퀴즈에 사용할 수 없어요."));
      setPage(0);reload();
    } catch(e){setError(e instanceof Error?e.message:msg("Upload failed.","업로드에 실패했어요."));}
    finally{setBusy(false);}
  }
  async function importImage() {
    setBusy(true);setError("");setNotice("");
    try {
      const source = new URL(importUrl.trim());
      if (source.protocol !== "https:" || source.username || source.password)
        throw new Error(msg("Enter a direct HTTPS image URL.","이미지 파일의 HTTPS 직접 주소를 입력해 주세요."));
      if (!importRights || !importCredit.trim() || !importLicense.trim())
        throw new Error(msg("Confirm usage rights and provide a source and licence.","사용 권한 확인과 출처, 라이선스 정보를 입력해 주세요."));
      const filename = (source.pathname.split("/").pop() || "imported-image").slice(0,200);
      await request("/media/import","POST",{
        url:source.href,kind:"image",filename,alt:importAlt.trim(),
        attribution:importCredit.trim(),license:importLicense.trim(),
      });
      setImportUrl("");setImportAlt("");setImportCredit("");setImportLicense("");setImportRights(false);
      setNotice(msg("Image saved to your private library. Safety approval is still required before public use.",
        "이미지를 비공개 보관함에 저장했어요. 공개 사용 전 안전 검토가 필요합니다."));
      setPage(0);reload();
    } catch(e) {setError(e instanceof Error ? e.message : msg("Could not import the image.","이미지를 가져오지 못했어요."));}
    finally {setBusy(false);}
  }
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
  async function blur(item: Media) {
    setBusy(true);setError("");
    try {
      const variant = await request("/media/"+item.id+"/transform","POST",{blur:8});
      setNotice(msg("Blurred clue created. New media ID: ","흐림 단서를 생성했습니다. 새 미디어 ID: ")+variant.id);
      setPage(0);reload();
    }catch(e){setError(e instanceof Error?e.message:msg("Could not transform the image.","이미지를 변환할 수 없어요."));}
    finally{setBusy(false);}
  }
  async function remove(item: Media) {
    if (!window.confirm(msg("Delete this file? Files used in any quiz revision cannot be deleted.","이 파일을 삭제할까요? 과거 버전을 포함해 퀴즈에서 사용 중인 파일은 삭제할 수 없어요."))) return;
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
    <section className="placeholder-panel">
      <h2>{msg("Add media","파일 추가")}</h2>
      <div className="media-editor">
        <label>{msg("Choose image, audio or video","이미지 · 음원 · 영상 선택")}
          <input type="file" accept=".jpg,.jpeg,.png,.webp,.mp3,.wav,.ogg,.mp4,.webm"
            onChange={e=>setSelected(e.currentTarget.files?.[0] || null)} disabled={busy}/>
        </label>
        <label>{msg("Alt text / short description","대체 텍스트 / 간단한 설명")}
          <input value={alt} maxLength={500} onChange={e=>setAlt(e.target.value)} placeholder={msg("Describe media for accessibility","접근성을 위한 설명")}/>
        </label>
        <label>{msg("Source / copyright holder","출처 · 저작권자")}
          <input value={attribution} maxLength={500} onChange={e=>setAttribution(e.target.value)} placeholder={msg("Original work or source","직접 제작 또는 출처")}/>
        </label>
      </div>
      <p className="muted">{msg("Images up to 12MB, audio 25MB and video 64MB. Make sure you have permission to use third-party content.","이미지 최대 12MB · 음원 25MB · 영상 64MB. 타인의 콘텐츠는 사용 권한을 확인해 주세요.")}</p>
      <button className="btn btn-primary" type="button" disabled={!selected || busy} onClick={()=>void upload()}>
        {busy?msg("Working…","처리 중…"):msg("Upload to Cloudflare R2","Cloudflare R2에 업로드")}
      </button>
    </section>
    <section className="placeholder-panel">
      <h2>{msg("Import an image from a URL","이미지 URL로 가져오기")}</h2>
      <p className="muted">{msg("Paste the direct file URL, not a search page. Wikimedia Commons, Unsplash, Pexels and Pixabay image CDNs are supported by default. Other sites may require an administrator to approve the exact host.","검색 결과 페이지가 아닌 이미지 파일의 직접 주소를 입력하세요. Wikimedia Commons, Unsplash, Pexels, Pixabay 이미지 CDN을 기본 지원합니다. 그 외 출처는 관리자의 정확한 호스트 허용이 필요합니다.")}</p>
      <div className="media-editor">
        <label>{msg("Direct HTTPS image URL","HTTPS 이미지 파일 주소")}
          <input type="url" value={importUrl} maxLength={2000} placeholder="https://upload.wikimedia.org/…" onChange={e=>setImportUrl(e.target.value)} disabled={busy}/>
        </label>
        <label>{msg("Description (for accessible clues)","이미지 설명 (접근성 단서)")}
          <input value={importAlt} maxLength={500} onChange={e=>setImportAlt(e.target.value)} placeholder={msg("Describe what is visible","이미지에 보이는 내용을 설명해 주세요.")} disabled={busy}/>
        </label>
        <label>{msg("Photographer / credit / source","사진가 · 출처 · 저작자")}
          <input value={importCredit} maxLength={500} onChange={e=>setImportCredit(e.target.value)} placeholder={msg("Author and source page","저작자와 출처 페이지")} disabled={busy}/>
        </label>
        <label>{msg("Licence or permission","라이선스 또는 사용 허가")}
          <input value={importLicense} maxLength={200} onChange={e=>setImportLicense(e.target.value)} placeholder={msg("e.g. CC BY 4.0, CC0, Unsplash License","예: CC BY 4.0, CC0, Unsplash License")} disabled={busy}/>
        </label>
      </div>
      <label><input type="checkbox" checked={importRights} onChange={e=>setImportRights(e.target.checked)} disabled={busy}/> {msg("I checked that the licence or permission allows my intended use and provided the required credit.","사용 목적에 맞는 라이선스·사용 허가 및 출처 표시 의무를 확인했습니다.")}</label>
      <p className="muted">{msg("Find a suitable image at one of these sites, then copy its direct image URL:","아래 사이트에서 이미지를 검색한 뒤 이미지 파일의 직접 주소를 복사하세요:")}{" "}
        <a target="_blank" rel="noopener noreferrer" href="https://commons.wikimedia.org/wiki/Special:MediaSearch?type=image">Wikimedia Commons</a>{" · "}
        <a target="_blank" rel="noopener noreferrer" href="https://unsplash.com/s/photos/nature">Unsplash</a>{" · "}
        <a target="_blank" rel="noopener noreferrer" href="https://www.pexels.com/search/animals/">Pexels</a>{" · "}
        <a target="_blank" rel="noopener noreferrer" href="https://pixabay.com/images/search/animals/">Pixabay</a>
      </p>
      <p className="muted">{msg("If an image host is unavailable, download the appropriately licensed file and use the upload option above. This does not bypass copyright requirements.","허용되지 않은 호스트라면 정당한 사용 권한이 있는 파일을 다운로드하여 위의 직접 업로드를 이용하세요. 저작권 확인 의무는 동일합니다.")}</p>
      <button className="btn btn-primary" type="button" disabled={!importUrl.trim() || !importCredit.trim() || !importLicense.trim() || !importRights || busy} onClick={()=>void importImage()}>
        {busy?msg("Working…","처리 중…"):msg("Import into private media library","비공개 미디어 보관함으로 가져오기")}
      </button>
    </section>
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
            <option value="all">{msg("All","전체")}</option><option value="used">{msg("Used / previously used","사용 중/사용 이력")}</option><option value="unused">{msg("Never used","사용 이력 없음")}</option>
          </select>
        </label>
        <label>{msg("Sort","정렬")}
          <select value={sort} onChange={e=>newFilter(()=>setSort(e.target.value as Sort))}>
            <option value="newest">{msg("Newest first","최신순")}</option><option value="oldest">{msg("Oldest first","오래된 순")}</option><option value="name">{msg("Name","이름순")}</option><option value="size">{msg("Largest first","용량 큰 순")}</option>
          </select>
        </label>
      </div>
      {!loading && !items.length && <p className="media-empty">{msg("No media matches these filters.","조건에 맞는 미디어가 없습니다.")}</p>}
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
            {item.kind==="image" && item.status==="READY" && <button className="text-button" type="button" disabled={busy} onClick={()=>void blur(item)}>{msg("Blurred clue","흐림 단서")}</button>}
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
