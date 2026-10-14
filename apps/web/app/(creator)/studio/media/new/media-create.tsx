"use client";

import Link from "next/link";
import { useEffect,useRef,useState } from "react";
import { useLocale } from "../../../../../src/i18n/provider";
import { localizeHref } from "../../../../../src/i18n/core";
import { bilingual } from "../../../../../src/i18n/view-copy";
import { formatMediaBytes } from "../../../../../src/lib/media-view";
import { mediaLibraryReturnHref } from "../../../../../src/lib/media-navigation";

type Kind="image"|"audio"|"video";
type Method="upload"|"url";
const limits:Record<Kind,number>={image:12*1024*1024,audio:25*1024*1024,video:64*1024*1024};
const kinds:Record<string,Kind>={
  "image/jpeg":"image","image/png":"image","image/webp":"image",
  "audio/mpeg":"audio","audio/wav":"audio","audio/ogg":"audio",
  "video/mp4":"video","video/webm":"video",
};
function hex(bytes:ArrayBuffer):string {
  return [...new Uint8Array(bytes)].map(byte=>byte.toString(16).padStart(2,"0")).join("");
}

export default function MediaCreate({initialMethod,returnTo}:{initialMethod:Method;returnTo?:string}) {
  const locale=useLocale();
  const msg=(en:string,ko:string)=>bilingual(locale,en,ko);
  const libraryHref=localizeHref("/studio/media",locale);
  const backHref=mediaLibraryReturnHref(returnTo,libraryHref);
  const [method,setMethod]=useState<Method>(initialMethod);
  const [selected,setSelected]=useState<File|null>(null);
  const fileInput=useRef<HTMLInputElement|null>(null);
  const [alt,setAlt]=useState("");
  const [attribution,setAttribution]=useState("");
  const [importUrl,setImportUrl]=useState("");
  const [importAlt,setImportAlt]=useState("");
  const [importCredit,setImportCredit]=useState("");
  const [importLicense,setImportLicense]=useState("");
  const [importRights,setImportRights]=useState(false);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const [notice,setNotice]=useState("");
  const [completed,setCompleted]=useState(false);

  useEffect(()=>{
    const sync=()=>setMethod(new URLSearchParams(window.location.search).get("method")==="url"?"url":"upload");
    window.addEventListener("popstate",sync);
    return ()=>window.removeEventListener("popstate",sync);
  },[]);

  function chooseMethod(next:Method) {
    if(busy)return;
    setMethod(next);setError("");setNotice("");setCompleted(false);
    const url=new URL(window.location.href);
    if(next==="url")url.searchParams.set("method","url");
    else url.searchParams.delete("method");
    window.history.replaceState(window.history.state,"",url.pathname+url.search);
  }

  async function request(path:string,body:object) {
    const response=await fetch("/api/v1"+path,{
      method:"POST",credentials:"same-origin",cache:"no-store",
      headers:{"Content-Type":"application/json"},body:JSON.stringify(body),
    });
    const result=await response.json().catch(()=>({}));
    if(!response.ok){
      if(result.error==="import_forbidden"||result.code==="import_forbidden")
        throw Error(msg("This image host is not approved. Download a properly licensed file and upload it, or ask an administrator to allow the exact host.","허용되지 않은 이미지 출처입니다. 라이선스가 확인된 파일을 직접 업로드하거나 관리자에게 해당 호스트 허용을 요청하세요."));
      throw Error(result.message||result.error||msg("Could not process this media request.","미디어 요청을 처리하지 못했어요."));
    }
    return result.data;
  }

  async function upload() {
    if(!selected||busy)return;
    setBusy(true);setError("");setNotice("");
    try {
      const mime=selected.type==="audio/x-wav"?"audio/wav":selected.type;
      const kind=kinds[mime];
      if(!kind)throw Error(msg("Unsupported file type. Use JPEG/PNG/WebP, MP3/WAV/OGG or MP4/WebM.","지원하지 않는 파일 형식입니다. JPEG/PNG/WebP, MP3/WAV/OGG, MP4/WebM을 이용해 주세요."));
      if(selected.size>limits[kind])throw Error(msg("The file exceeds the size limit for this format.","파일 형식별 크기 제한을 초과했어요."));
      const digest=hex(await crypto.subtle.digest("SHA-256",await selected.arrayBuffer()));
      const ticket=await request("/media/upload",{
        kind,mimeType:mime,filename:selected.name,sizeBytes:selected.size,sha256:digest,alt,attribution,
      });
      const put=await fetch(ticket.upload.url,{method:ticket.upload.method,headers:ticket.upload.headers,body:selected});
      if(!put.ok)throw Error(msg("R2 upload failed. Check bucket CORS and permissions.","R2 업로드에 실패했어요. 버킷 CORS 및 접근 권한을 확인해 주세요."));
      await request("/media/"+ticket.id+"/complete",{});
      setSelected(null);setAlt("");setAttribution("");
      if(fileInput.current)fileInput.current.value="";
      setCompleted(true);
      setNotice(msg("Upload complete! Public quizzes require safety approval.","업로드 완료! 공개 퀴즈에 사용하려면 안전 검토가 필요합니다."));
    }catch(e){setError(e instanceof Error?e.message:msg("Upload failed.","업로드에 실패했어요."));}
    finally{setBusy(false);}
  }

  async function importImage() {
    if(busy)return;
    setBusy(true);setError("");setNotice("");
    try {
      let source:URL;
      try{source=new URL(importUrl.trim());}
      catch{throw Error(msg("Enter a valid direct HTTPS image URL.","유효한 HTTPS 이미지 파일 주소를 입력해 주세요."));}
      if(source.protocol!=="https:"||source.username||source.password)
        throw Error(msg("Enter a direct HTTPS image URL.","이미지 파일의 HTTPS 직접 주소를 입력해 주세요."));
      if(!importRights||!importCredit.trim()||!importLicense.trim())
        throw Error(msg("Confirm usage rights and provide a source and licence.","사용 권한 확인과 출처, 라이선스 정보를 입력해 주세요."));
      const filename=(source.pathname.split("/").pop()||"imported-image").slice(0,200);
      await request("/media/import",{
        url:source.href,kind:"image",filename,alt:importAlt.trim(),
        attribution:importCredit.trim(),license:importLicense.trim(),
      });
      setImportUrl("");setImportAlt("");setImportCredit("");setImportLicense("");setImportRights(false);
      setCompleted(true);
      setNotice(msg("Image added to your private library. Public use requires safety approval.","비공개 보관함에 이미지를 추가했습니다. 공개 사용 전 안전 검토가 필요합니다."));
    }catch(e){setError(e instanceof Error?e.message:msg("Could not import the image.","이미지를 가져오지 못했어요."));}
    finally{setBusy(false);}
  }

  return <div className="media-create-workspace">
    <Link href={backHref} className="media-create-back">← {msg("Back to media library","미디어 보관함으로 돌아가기")}</Link>
    <section className="placeholder-panel media-create-panel">
      <div className="media-create-tabs" role="tablist" aria-label={msg("How to add media","미디어 추가 방식")}>
        <button type="button" role="tab" aria-selected={method==="upload"} aria-controls="media-create-fields" className={method==="upload"?"active":""} disabled={busy} onClick={()=>chooseMethod("upload")}>{msg("File upload","파일 업로드")}</button>
        <button type="button" role="tab" aria-selected={method==="url"} aria-controls="media-create-fields" className={method==="url"?"active":""} disabled={busy} onClick={()=>chooseMethod("url")}>{msg("Import image URL","이미지 URL 가져오기")}</button>
      </div>
      {error && <p role="alert" className="feedback">{error}</p>}
      {notice && <p role="status" className="feedback success">{notice}</p>}
      {completed ? <div className="media-create-complete">
        <div className="actions">
          <Link href={libraryHref} className="btn btn-primary">{msg("View in media library","미디어 보관함에서 보기")}</Link>
          <button type="button" className="btn btn-outline" onClick={()=>{setCompleted(false);setNotice("");setError("");}}>{msg("Add another media","다른 미디어 추가")}</button>
          {backHref!==libraryHref && <Link href={backHref} className="btn btn-outline">{msg("Return to previous filters","이전 검색 조건으로 돌아가기")}</Link>}
        </div>
      </div> : <div id="media-create-fields" role="tabpanel" className="media-create-fields">
        {method==="upload" ? <>
          <label className="media-upload-dropzone" onDragOver={e=>{if(!busy)e.preventDefault();}} onDrop={e=>{
            if(busy)return;
            e.preventDefault();
            const file=e.dataTransfer.files?.[0];
            if(file){setSelected(file);setError("");}
          }}>
            <span aria-hidden="true" className="media-upload-icon">↑</span>
            <strong>{msg("Choose or drop an image, audio or video","이미지, 음원, 동영상을 선택하거나 끌어다 놓으세요")}</strong>
            <span className="muted">{msg("JPEG/PNG/WebP up to 12MB · MP3/WAV/OGG up to 25MB · MP4/WebM up to 64MB","이미지 최대 12MB · 음원 25MB · 동영상 64MB")}</span>
            <input ref={fileInput} type="file" accept=".jpg,.jpeg,.png,.webp,.mp3,.wav,.ogg,.mp4,.webm" onChange={e=>{setSelected(e.currentTarget.files?.[0]||null);setError("");}} disabled={busy}/>
            {selected && <span className="media-upload-selected">{selected.name} · {formatMediaBytes(selected.size)}</span>}
          </label>
          <div className="media-editor">
            <label>{msg("Alt text / short description","대체 텍스트 / 간단한 설명")}
              <input value={alt} maxLength={500} onChange={e=>setAlt(e.target.value)} placeholder={msg("Describe media for accessibility","접근성을 위한 설명")} disabled={busy}/>
            </label>
            <label>{msg("Source / copyright holder","출처 · 저작권자")}
              <input value={attribution} maxLength={500} onChange={e=>setAttribution(e.target.value)} placeholder={msg("Original work or source","직접 제작 또는 출처")} disabled={busy}/>
            </label>
          </div>
          <p className="muted media-create-note">{msg("Make sure you have permission to use third-party content.","타인의 콘텐츠는 사용 권한을 확인해 주세요.")}</p>
          <div className="actions"><button type="button" className="btn btn-primary" disabled={!selected||busy} onClick={()=>void upload()}>{busy?msg("Working…","처리 중…"):msg("Upload to Cloudflare R2","Cloudflare R2에 업로드")}</button></div>
        </> : <>
          <p className="muted media-create-note">{msg("Paste a direct image file URL, not a search page. Wikimedia Commons, Unsplash, Pexels and Pixabay image CDNs are supported by default. Other hosts require approval.","검색 페이지가 아닌 이미지 파일의 직접 주소를 입력하세요. Wikimedia Commons, Unsplash, Pexels, Pixabay 이미지 CDN을 기본 지원하며 기타 호스트는 별도 허용이 필요합니다.")}</p>
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
          <label className="media-rights-confirm"><input type="checkbox" checked={importRights} onChange={e=>setImportRights(e.target.checked)} disabled={busy}/> {msg("I checked that the licence or permission allows my intended use and provided required credit.","사용 목적에 맞는 라이선스·사용 허가 및 출처 표시 의무를 확인했습니다.")}</label>
          <p className="muted media-create-note">{msg("Find an image at one of these sites, then copy its direct file URL:","다음 사이트에서 이미지를 찾은 뒤 파일의 직접 주소를 복사하세요:")}{" "}
            <a target="_blank" rel="noopener noreferrer" href="https://commons.wikimedia.org/wiki/Special:MediaSearch?type=image">Wikimedia Commons</a>{" · "}
            <a target="_blank" rel="noopener noreferrer" href="https://unsplash.com/s/photos/nature">Unsplash</a>{" · "}
            <a target="_blank" rel="noopener noreferrer" href="https://www.pexels.com/search/animals/">Pexels</a>{" · "}
            <a target="_blank" rel="noopener noreferrer" href="https://pixabay.com/images/search/animals/">Pixabay</a>
          </p>
          <p className="muted media-create-note">{msg("If a host is not approved, download a properly licensed file and use File upload instead. Copyright requirements still apply.","허용되지 않은 호스트라면 적절한 라이선스의 파일을 다운로드하여 파일 업로드를 이용하세요. 저작권 확인 의무는 동일합니다.")}</p>
          <div className="actions"><button type="button" className="btn btn-primary" disabled={!importUrl.trim()||!importCredit.trim()||!importLicense.trim()||!importRights||busy} onClick={()=>void importImage()}>{busy?msg("Working…","처리 중…"):msg("Import to private media library","비공개 미디어 보관함으로 가져오기")}</button></div>
        </>}
      </div>}
    </section>
  </div>;
}
