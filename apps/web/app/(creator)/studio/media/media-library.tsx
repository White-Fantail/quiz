"use client";

import { useEffect, useRef, useState } from "react";
import { formatMediaBytes, mediaUploadLabel, mediaModerationNames } from "../../../../src/lib/media-view";

type Kind = "image" | "audio" | "video";
type Media = {
  id: string; kind: Kind; mimeType: string; originalName: string;
  sizeBytes: number; status: string; moderationStatus: string;
  alt: string; attribution: string; createdAt: string; uploadExpiresAt?: string | null;
};
type MediaUsage = { quizId: string; title: string; version: number; isCurrent: boolean; publication: string };
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

const kindNames: Record<Kind,string> = { image:"이미지", audio:"오디오", video:"동영상" };
function hex(bytes: ArrayBuffer): string {
  return [...new Uint8Array(bytes)].map(byte => byte.toString(16).padStart(2, "0")).join("");
}
async function api(path: string, method="GET", body?: object): Promise<any> {
  const response = await fetch("/api/v1"+path, {
    method, credentials:"same-origin", cache:"no-store",
    headers: body ? { "Content-Type":"application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.message || result.error || "미디어 요청을 처리하지 못했어요.");
  return result.data;
}

/** Fetch the owner's 60-second signed thumbnail only when the image scrolls into view.
 * The server keeps originals and thumbnails private in R2, including unreviewed files.
 */
function MediaThumbnail({ item }: { item: Media }) {
  const node = useRef<HTMLDivElement|null>(null);
  const [src,setSrc] = useState("");
  const [failed,setFailed] = useState(false);
  useEffect(() => {
    if (item.status !== "READY" || item.kind !== "image") return;
    let cancelled = false;
    const load = () => {
      void api("/media/"+item.id+"?purpose=thumbnail").then((details: MediaDetails) => {
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
      <span className="media-thumb-fallback" aria-label={failed ? "미리보기를 불러오지 못했어요" : "미리보기 불러오는 중"}>
        {failed ? "이미지를 볼 수 없어요" : "🖼️"}
      </span>}
  </div>;
}

export default function MediaLibrary() {
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
        const result: MediaListResult = await api("/media?"+params.toString());
        if (active) { setItems(result.items || []); setTotal(result.total || 0); }
      } catch(e) { if (active) setError(e instanceof Error ? e.message : "목록을 가져오지 못했어요."); }
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
      if (!fileKind) throw new Error("지원하는 파일 형식이 아니에요. JPEG/PNG/WebP, MP3/WAV/OGG, MP4/WebM을 이용해 주세요.");
      if (selected.size > limits[fileKind]) throw new Error("파일 형식별 크기 제한을 초과했어요.");
      const digest = hex(await crypto.subtle.digest("SHA-256", await selected.arrayBuffer()));
      const ticket = await api("/media/upload","POST",{
        kind:fileKind,mimeType:mime,filename:selected.name,sizeBytes:selected.size,sha256:digest,alt,attribution,
      });
      const put = await fetch(ticket.upload.url, {
        method:ticket.upload.method,headers:ticket.upload.headers,body:selected,
      });
      if (!put.ok) throw new Error("R2 업로드에 실패했어요. 버킷 CORS 및 접근 권한을 확인해 주세요.");
      await api("/media/"+ticket.id+"/complete","POST",{});
      setSelected(null);setAlt("");setAttribution("");
      setNotice("업로드 완료! 안전 검토 전에는 공개 퀴즈에 사용할 수 없어요.");
      setPage(0);reload();
    } catch(e){setError(e instanceof Error?e.message:"업로드에 실패했어요.");}
    finally{setBusy(false);}
  }
  async function show(item: Media) {
    const requestId=++detailRequest.current;
    if (expandedId === item.id) { setExpandedId(null);setDetails(null);setDetailsLoading(false);return; }
    setExpandedId(item.id);setDetails(null);setDetailsLoading(true);setError("");
    try {
      const detail: MediaDetails = await api("/media/"+item.id);
      if (detailRequest.current === requestId) setDetails(detail);
    } catch(e){if (detailRequest.current === requestId) setError(e instanceof Error?e.message:"상세 정보를 불러오지 못했어요.");}
    finally{if (detailRequest.current === requestId) setDetailsLoading(false);}
  }
  async function blur(item: Media) {
    setBusy(true);setError("");
    try {
      const variant = await api("/media/"+item.id+"/transform","POST",{blur:8});
      setNotice("흐림 단서를 생성했습니다. 새 미디어 ID: "+variant.id);
      setPage(0);reload();
    }catch(e){setError(e instanceof Error?e.message:"이미지를 변환할 수 없어요.");}
    finally{setBusy(false);}
  }
  async function remove(item: Media) {
    if (!window.confirm("이 파일을 삭제할까요? 과거 버전을 포함해 퀴즈에서 사용 중인 파일은 삭제할 수 없어요.")) return;
    setBusy(true);setError("");
    try{
      await api("/media/"+item.id,"DELETE",{confirm:true});
      setExpandedId(null);setDetails(null);
      if (page > 0 && items.length <= 1) setPage(n=>n-1);
      else reload();
    }catch(e){setError(e instanceof Error?e.message:"삭제할 수 없어요.");}
    finally{setBusy(false);}
  }
  async function copyId(id: string) {
    try{await navigator.clipboard.writeText(id);setNotice("미디어 ID를 복사했습니다. QuizDip 퀴즈나 MCP에서 재사용할 수 있어요.");}
    catch{setError("ID 복사에 실패했어요. ID 텍스트를 직접 선택해 주세요.");}
  }
  const pages=Math.max(1,Math.ceil(total/PAGE_SIZE));
  return <div className="media-workspace">
    <section className="placeholder-panel">
      <h2>파일 추가</h2>
      <div className="media-editor">
        <label>이미지 · 음원 · 영상 선택
          <input type="file" accept=".jpg,.jpeg,.png,.webp,.mp3,.wav,.ogg,.mp4,.webm"
            onChange={e=>setSelected(e.currentTarget.files?.[0] || null)} disabled={busy}/>
        </label>
        <label>대체 텍스트 / 간단한 설명
          <input value={alt} maxLength={500} onChange={e=>setAlt(e.target.value)} placeholder="접근성을 위한 설명"/>
        </label>
        <label>출처 · 저작권자
          <input value={attribution} maxLength={500} onChange={e=>setAttribution(e.target.value)} placeholder="직접 제작 또는 출처"/>
        </label>
      </div>
      <p className="muted">이미지 최대 12MB · 음원 25MB · 영상 64MB. 타인의 콘텐츠는 사용 권한을 확인해 주세요.</p>
      <button className="btn btn-primary" type="button" disabled={!selected || busy} onClick={()=>void upload()}>
        {busy?"처리 중…":"Cloudflare R2에 업로드"}
      </button>
    </section>
    {error && <p role="alert" className="feedback">{error}</p>}
    {notice && <p role="status" className="feedback success">{notice}</p>}
    <section className="section">
      <div className="media-library-heading">
        <div><h2>등록한 미디어</h2><p className="muted">미디어를 찾아 퀴즈 단서에 재사용하세요. 검토 대기 중인 자료는 제작자에게만 미리보기가 제공됩니다.</p></div>
        <strong aria-live="polite">{loading?"불러오는 중":total.toLocaleString("ko-KR")+"개"}</strong>
      </div>
      <div className="media-filters" role="search" aria-label="미디어 검색 및 필터">
        <label className="media-filter-search">검색
          <input type="search" value={searchInput} placeholder="파일명, 설명, 출처 검색"
            onChange={e=>newFilter(()=>setSearchInput(e.target.value))}/>
        </label>
        <label>종류
          <select value={kind} onChange={e=>newFilter(()=>setKind(e.target.value as FilterKind))}>
            <option value="all">전체</option><option value="image">이미지</option><option value="audio">오디오</option><option value="video">동영상</option>
          </select>
        </label>
        <label>안전 검토
          <select value={moderation} onChange={e=>newFilter(()=>setModeration(e.target.value as FilterModeration))}>
            <option value="all">전체</option><option value="PENDING">검토 대기</option><option value="APPROVED">승인</option><option value="RESTRICTED">제한</option>
          </select>
        </label>
        <label>업로드
          <select value={status} onChange={e=>newFilter(()=>setStatus(e.target.value as FilterStatus))}>
            <option value="all">전체</option><option value="READY">업로드 완료</option><option value="UPLOADING">업로드 중/만료</option>
          </select>
        </label>
        <label>퀴즈 사용
          <select value={usage} onChange={e=>newFilter(()=>setUsage(e.target.value as FilterUsage))}>
            <option value="all">전체</option><option value="used">사용 중/사용 이력</option><option value="unused">사용 이력 없음</option>
          </select>
        </label>
        <label>정렬
          <select value={sort} onChange={e=>newFilter(()=>setSort(e.target.value as Sort))}>
            <option value="newest">최신순</option><option value="oldest">오래된 순</option><option value="name">이름순</option><option value="size">용량 큰 순</option>
          </select>
        </label>
      </div>
      {!loading && !items.length && <p className="media-empty">조건에 맞는 미디어가 없습니다.</p>}
      <div className="media-grid" aria-busy={loading}>
        {items.map(item=><article className="feature-card media-card" key={item.id}>
          {item.kind==="image" ? <MediaThumbnail item={item}/> :
            <div className="media-thumb media-thumb-icon" aria-hidden="true">
              <span>{item.kind==="audio"?"🔊":"🎬"}</span>
              <small>{item.kind==="audio"?"눌러서 듣기":"눌러서 보기"}</small>
            </div>}
          <h3 title={item.originalName}>{item.originalName}</h3>
          <p className="media-card-meta">{kindNames[item.kind]} · {formatMediaBytes(item.sizeBytes)}</p>
          <div className="media-state-line">
            <span className={"media-state-chip "+(item.status==="READY"?"media-ok":"media-wait")}>{mediaUploadLabel(item.status,item.uploadExpiresAt)}</span>
            <span className={"media-state-chip "+(item.moderationStatus==="APPROVED"?"media-ok":item.moderationStatus==="RESTRICTED"?"media-blocked":"media-wait")}>{mediaModerationNames[item.moderationStatus]||item.moderationStatus}</span>
          </div>
          <div className="media-card-actions">
            <button className="btn btn-outline" type="button" onClick={()=>void show(item)} disabled={busy} aria-expanded={expandedId===item.id}>
              {expandedId===item.id?"접기":"상세 · 미리보기"}
            </button>
            <button className="text-button" type="button" onClick={()=>void copyId(item.id)}>ID 복사</button>
            {item.kind==="image" && item.status==="READY" && <button className="text-button" type="button" disabled={busy} onClick={()=>void blur(item)}>흐림 단서</button>}
            <button className="text-button" type="button" disabled={busy} onClick={()=>void remove(item)}>삭제</button>
          </div>
          {expandedId===item.id && <div className="media-details" aria-live="polite">
            {detailsLoading && <p>상세 정보를 가져오는 중…</p>}
            {details?.id===item.id && <>
              {details.previewUrl && details.kind==="image" && <img className="media-preview" src={details.previewUrl} alt={details.alt||details.originalName}/>}
              {details.previewUrl && details.kind==="audio" && <audio controls preload="none" src={details.previewUrl}/>}
              {details.previewUrl && details.kind==="video" && <video controls preload="none" className="media-preview" src={details.previewUrl}/>}
              <p className="media-identity">ID: <code>{item.id}</code></p>
              <p>안전성: {mediaModerationNames[item.moderationStatus]||item.moderationStatus} · 자동 미리보기는 공개 승인을 뜻하지 않습니다.</p>
              <h4>사용 중인 퀴즈 / 버전</h4>
              {!details.usage?.items?.length && <p>연결된 퀴즈가 없습니다. 이 ID를 복사하여 새 문제에 사용할 수 있어요.</p>}
              {details.usage?.items?.map(link=><div className="media-usage-row" key={link.quizId+":"+link.version}>
                <div><b>{link.title}</b><small>버전 {link.version} · {link.isCurrent?"현재 버전":"이전 버전"} · {link.publication==="PUBLISHED"?"공개":"비공개"}</small></div>
                <button type="button" className="text-button" onClick={()=>void copyId(link.quizId)}>퀴즈 ID 복사</button>
              </div>)}
              {details.usage?.hasMore && <p>다른 과거 버전 사용 이력도 있습니다.</p>}
            </>}
          </div>}
        </article>)}
      </div>
      <nav className="media-pagination" aria-label="미디어 페이지">
        <button type="button" className="btn btn-outline" disabled={page===0||loading} onClick={()=>{detailRequest.current++;setPage(n=>n-1);setExpandedId(null);setDetails(null);}}>이전</button>
        <span>{page+1} / {pages} 페이지 · 총 {total.toLocaleString("ko-KR")}개</span>
        <button type="button" className="btn btn-outline" disabled={page+1>=pages||loading} onClick={()=>{detailRequest.current++;setPage(n=>n+1);setExpandedId(null);setDetails(null);}}>다음</button>
      </nav>
    </section>
  </div>;
}
