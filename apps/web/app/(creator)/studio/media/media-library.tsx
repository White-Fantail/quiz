"use client";

import { useCallback, useEffect, useState } from "react";

type Kind = "image" | "audio" | "video";
type Media = { id: string; kind: Kind; mimeType: string; originalName: string;
  sizeBytes: number; status: string; moderationStatus: string; alt: string; attribution: string };
type MediaDetails = Media & { previewUrl?: string; previewExpiresInSeconds?: number };
const limits: Record<Kind,number> = { image: 12 * 1024 * 1024, audio: 25 * 1024 * 1024, video: 64 * 1024 * 1024 };
const kinds: Record<string,Kind> = {
  "image/jpeg":"image", "image/png":"image", "image/webp":"image",
  "audio/mpeg":"audio", "audio/wav":"audio", "audio/ogg":"audio",
  "video/mp4":"video", "video/webm":"video",
};
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
export default function MediaLibrary() {
  const [items,setItems] = useState<Media[]>([]);
  const [selected,setSelected] = useState<File|null>(null);
  const [alt,setAlt] = useState("");
  const [attribution,setAttribution] = useState("");
  const [preview,setPreview] = useState<Record<string,string>>({});
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState("");
  const [notice,setNotice] = useState("");
  const load = useCallback(async () => {
    try { const value=await api("/media?limit=60"); setItems(value.items || []); }
    catch(e) { setError(e instanceof Error ? e.message : "목록을 가져오지 못했어요."); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  async function upload() {
    if (!selected) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const mime = selected.type==="audio/x-wav" ? "audio/wav" : selected.type;
      const kind = kinds[mime];
      if (!kind) throw new Error("지원하는 파일 형식이 아니에요. JPEG/PNG/WebP, MP3/WAV/OGG, MP4/WebM을 이용해 주세요.");
      if (selected.size > limits[kind]) throw new Error("파일 형식별 크기 제한을 초과했어요.");
      const digest = hex(await crypto.subtle.digest("SHA-256", await selected.arrayBuffer()));
      const ticket = await api("/media/upload", "POST", {
        kind,mimeType:mime,filename:selected.name,sizeBytes:selected.size,sha256:digest,alt,attribution,
      });
      const put=await fetch(ticket.upload.url,{
        method:ticket.upload.method,headers:ticket.upload.headers,body:selected,
      });
      if (!put.ok) throw new Error("R2 업로드에 실패했어요. 버킷 CORS 및 접근 권한을 확인해 주세요.");
      await api("/media/"+ticket.id+"/complete","POST",{});
      setSelected(null);setAlt("");setAttribution("");setNotice("업로드 완료! 안전성 검토 전에는 공개 문제에 사용할 수 없어요.");
      await load();
    } catch(e) { setError(e instanceof Error?e.message:"업로드에 실패했어요."); }
    finally { setBusy(false); }
  }
  async function show(item: Media) {
    setError("");
    try {
      const details: MediaDetails=await api("/media/"+item.id);
      if (!details.previewUrl) throw new Error("업로드를 완료한 파일만 미리 볼 수 있어요.");
      setPreview(current=>({...current,[item.id]:details.previewUrl!}));
    } catch(e) { setError(e instanceof Error?e.message:"미리보기에 실패했어요."); }
  }
  async function blur(item: Media) {
    setBusy(true);setError("");
    try {
      const variant = await api("/media/"+item.id+"/transform","POST",{blur:8});
      setNotice("흐림 단서가 생성되었어요. 새 미디어 ID: "+variant.id);
      await load();
    } catch(e){setError(e instanceof Error?e.message:"이미지를 변환할 수 없어요.");}
    finally {setBusy(false);}
  }
  async function remove(item: Media) {
    if (!window.confirm("이 파일을 삭제할까요? 퀴즈에서 사용 중인 파일은 삭제할 수 없어요.")) return;
    setBusy(true);setError("");
    try {await api("/media/"+item.id,"DELETE",{confirm:true});await load();}
    catch(e){setError(e instanceof Error?e.message:"삭제할 수 없어요.");}
    finally{setBusy(false);}
  }
  return <div className="media-workspace">
    <section className="placeholder-panel">
      <h2>파일 추가</h2>
      <div className="media-editor">
        <label>이미지 · 음원 · 영상 선택
          <input type="file" accept=".jpg,.jpeg,.png,.webp,.mp3,.wav,.ogg,.mp4,.webm"
            onChange={e=>setSelected(e.currentTarget.files?.[0] || null)} disabled={busy} />
        </label>
        <label>대체 텍스트 / 간단한 설명
          <input value={alt} maxLength={500} onChange={e=>setAlt(e.target.value)} placeholder="접근성을 위한 설명" />
        </label>
        <label>출처 · 저작권자
          <input value={attribution} maxLength={500} onChange={e=>setAttribution(e.target.value)} placeholder="직접 제작 또는 출처" />
        </label>
      </div>
      <p className="muted">이미지 최대 12MB · 음원 25MB · 영상 64MB. 다른 사람의 콘텐츠는 사용 권한을 확인해 주세요.</p>
      <button className="btn btn-primary" type="button" disabled={!selected || busy} onClick={()=>void upload()}>
        {busy?"처리 중…":"Cloudflare R2에 업로드"}
      </button>
    </section>
    {error && <p role="alert" className="feedback">{error}</p>}
    {notice && <p role="status" className="feedback success">{notice}</p>}
    <section className="section">
      <h2>등록한 미디어</h2>
      <p className="muted">문제나 단서에는 미디어 ID를 연결해요. AI/MCP에서도 같은 ID를 사용할 수 있어요.</p>
      {!items.length && <p>아직 등록된 미디어가 없어요.</p>}
      <div className="media-grid">
        {items.map(item=><article className="feature-card" key={item.id}>
          <span className="small-tag">{item.kind} · {item.moderationStatus}</span>
          <h3>{item.originalName}</h3>
          <p>{(item.sizeBytes/1024/1024).toFixed(2)}MB · {item.status}</p>
          <p className="media-identity">ID: <code>{item.id}</code></p>
          {preview[item.id] && item.kind==="image" && <img className="media-preview" src={preview[item.id]} alt={item.alt || item.originalName}/>}
          {preview[item.id] && item.kind==="audio" && <audio controls src={preview[item.id]} preload="none"/>}
          {preview[item.id] && item.kind==="video" && <video controls className="media-preview" src={preview[item.id]} preload="none"/>}
          <div className="actions">
            <button type="button" className="btn btn-outline" onClick={()=>void show(item)} disabled={busy}>미리보기</button>
            {item.kind==="image" && item.status==="READY" &&
              <button type="button" className="btn btn-outline" disabled={busy} onClick={()=>void blur(item)}>흐림 단서 생성</button>}
            <button type="button" className="text-button" disabled={busy} onClick={()=>void remove(item)}>삭제</button>
          </div>
        </article>)}
      </div>
    </section>
  </div>;
}
