"use client";
import {useEffect,useMemo,useState} from "react";
import {useLocale} from "../../../../../src/i18n/provider";

type Locale = "en"|"ko";
type Clue = {type:"text"|"image"|"audio"|"video"|"map";text?:string;mediaId?:string;
  map?:{latitude:number;longitude:number;zoom?:number}};
type Fields = {title:string;prompt:string;explanation?:string;answer:{canonical:string;aliases:string[];responseMode?:"text"|"multiple-choice";options?:string[]};clues:Clue[]};
type Version = {locale:string;currentVersion:number;publishedVersion:number|null;
  status:string;sourceRevisionId:string|null;stale:boolean;hasUnpublishedChanges:boolean;
  fields?:Fields|null};
type List = {sourceLocale:string;sourceRevisionId:string;items:Version[];publication:string;safetyStatus:string};

async function request(path:string,method="GET",body?:unknown):Promise<any>{
  const response=await fetch("/api/v1"+path,{
    method,credentials:"same-origin",cache:"no-store",
    headers:body!==undefined?{"Content-Type":"application/json"}:undefined,
    body:body!==undefined?JSON.stringify(body):undefined
  });
  const result=await response.json().catch(()=>({}));
  if(!response.ok)throw new Error(result.message||result.error||"Could not complete the request");
  return result.data;
}
function editableFromSource(fields:Fields):Fields{
  return {title:"",prompt:"",explanation:"",answer:{canonical:"",aliases:[],
    ...(fields.answer.responseMode==="multiple-choice"?{responseMode:"multiple-choice" as const,
      options:Array.from({length:fields.answer.options?.length??0},()=> "")}:{})},
    clues:fields.clues.map(c=>({...c,text:""}))};
}
export default function TranslationManager({quizId}:{quizId:string}){
  const uiLocale=useLocale();
  const isKo=uiLocale==="ko";
  const message=(ko:string,en:string)=>isKo?ko:en;
  const [list,setList]=useState<List|null>(null);
  const [target,setTarget]=useState<Locale>("ko");
  const [fields,setFields]=useState<Fields|null>(null);
  const [busy,setBusy]=useState(false);
  const [loading,setLoading]=useState(true);
  const [notice,setNotice]=useState("");
  const [error,setError]=useState("");
  const [verified,setVerified]=useState(false);
  const [revision,setRevision]=useState(0);
  useEffect(()=>{
    let active=true;setLoading(true);setError("");
    void request("/quizzes/"+encodeURIComponent(quizId)+"/languages?includeContent=true")
      .then((data:List)=>{if(!active)return;setList(data);})
      .catch(e=>{if(active)setError(e instanceof Error?e.message:String(e));})
      .finally(()=>{if(active)setLoading(false);});
    return()=>{active=false};
  },[quizId,revision]);
  useEffect(()=>{
    if(!list)return;
    const alternate=(["en","ko"] as Locale[]).find(l=>l!==list.sourceLocale);
    if(alternate && target===list.sourceLocale)setTarget(alternate);
  },[list,target]);
  const source=useMemo(()=>list?.items.find(x=>x.locale===list.sourceLocale),[list]);
  const language=useMemo(()=>list?.items.find(x=>x.locale===target),[list,target]);
  useEffect(()=>{
    if(!list)return;
    setFields(language?.fields??(source?.fields?editableFromSource(source.fields):null));
    setVerified(false);
  },[list,language,source,target]);
  function edit(action:(p:Fields)=>Fields){setFields(p=>p?action(p):p);setVerified(false);}
  const apiBase="/quizzes/"+encodeURIComponent(quizId)+"/languages/"+target;
  async function transact(task:()=>Promise<any>,ok:string,refresh=true){
    setBusy(true);setError("");setNotice("");
    try{
      await task();setNotice(ok);if(refresh)setRevision(n=>n+1);
    }catch(e){setError(e instanceof Error?e.message:String(e));}
    finally{setBusy(false);}
  }
  if(loading&&!list)return <p role="status">{message("언어 버전을 불러오는 중…","Loading language versions…")}</p>;
  if(!list)return <p role="alert" className="feedback">{error||message("정보를 확인할 수 없어요.","Unable to load language versions.")}</p>;
  if(list.sourceLocale==="und")return <section className="placeholder-panel">
    <h2>{message("원본 언어를 먼저 확인하세요","Confirm the original language first")}</h2>
    <p>{message("기존 문제는 원본 언어 확인 후 다른 언어로 번역할 수 있어요. 문제 상단의 원본 언어 버튼을 이용하세요.",
      "An unclassified original must be confirmed first. Use the original-language buttons above.")}</p>
  </section>;
  if(!source?.fields)return <p role="alert">{message("원본 버전을 찾을 수 없어요.","Source version is unavailable.")}</p>;
  const status=language?.status??"NOT_CREATED";
  const sourceName=list.sourceLocale==="en"?"English":"한국어";
  return <section className="placeholder-panel translation-manager">
    <h2>{message("언어별 퀴즈 버전","Quiz language versions")}</h2>
    <p className="muted">{message("원본","Original")}: <strong>{sourceName}</strong> ·
      {message(" 번역된 질문·정답·단서는 별도로 수정하고 공개할 수 있습니다.",
        " Translated questions, answers and clues have independent revisions and publication.")}</p>
    <div className="translation-locale-summary">
      {list.items.map(row=><span key={row.locale} className="media-state-chip">
        {row.locale==="en"?"English":row.locale==="ko"?"한국어":"Unclassified"} · {row.status}
        {row.hasUnpublishedChanges?" · Draft v"+row.currentVersion:""}
        {row.stale?" · "+message("원본 변경됨","Source changed"):""}
      </span>)}
    </div>
    <label className="translation-select">{message("편집할 언어","Language to edit")}
      <select value={target} disabled={busy} onChange={e=>setTarget(e.target.value as Locale)}>
        {(["en","ko"] as Locale[]).filter(locale=>locale!==list.sourceLocale)
          .map(locale=><option key={locale} value={locale}>{locale==="en"?"English":"한국어"}</option>)}
      </select>
    </label>
    {language?.stale && <p className="feedback" role="status">
      {message("원본이 변경되었어요. 번역을 검토하고 다시 저장해야 공개할 수 있어요.",
        "The original has changed. Review and resave the translation before publishing.")}
    </p>}
    <p className="muted">{message("현재 상태","Current status")}: {status}
      {" · "}{message("초안 버전","Draft version")}: {language?.currentVersion??0}
      {" · "}{message("공개 버전","Published version")}: {language?.publishedVersion??"—"}
    </p>
    {fields && <div className="studio-meta-form">
      <div className="studio-form-grid">
        <label className="studio-wide">{message("제목","Title")}
          <input maxLength={180} required value={fields.title}
            onChange={e=>edit(v=>({...v,title:e.target.value}))}/>
        </label>
        <label className="studio-wide">{message("질문","Question")}
          <textarea rows={3} maxLength={2000} required value={fields.prompt}
            onChange={e=>edit(v=>({...v,prompt:e.target.value}))}/>
        </label>
        <label className="studio-wide">{message("정답 해설 · 선택","Explanation · optional")}
          <textarea rows={4} maxLength={4000} value={fields.explanation??""}
            onChange={e=>edit(v=>({...v,explanation:e.target.value}))}/>
        </label>
        <label className="studio-wide">{message("정답","Canonical answer")}
          <input maxLength={200} required value={fields.answer.canonical}
            onChange={e=>edit(v=>({...v,answer:{...v.answer,canonical:e.target.value,
              ...(v.answer.responseMode==="multiple-choice"?{options:[e.target.value,...(v.answer.options??[]).slice(1)]}:{})}}))}/>
        </label>
        {source.fields.answer.responseMode==="multiple-choice"&&<label className="studio-wide">
          {message("번역된 오답 선택지 · 한 줄에 하나씩","Translated incorrect choices · one per line")}
          <textarea rows={5} value={(fields.answer.options??[]).filter(option=>option!==fields.answer.canonical).join("\n")}
            onChange={e=>edit(v=>({...v,answer:{...v.answer,responseMode:"multiple-choice",
              options:[v.answer.canonical,...e.target.value.split("\n")]}}))}/>
          <span className="muted">{message(
            "원본과 동일한 오답 개수와 의미를 유지하세요. 정답은 위 입력값으로 자동 포함됩니다.",
            "Keep the same number and meaning of incorrect choices as the original. The canonical answer is included automatically."
          )}</span>
        </label>}
        <label className="studio-wide">{message("인정할 다른 정답 · 줄바꿈으로 구분","Accepted answer aliases · one per line")}
          <textarea rows={2} value={fields.answer.aliases.join("\n")}
            onChange={e=>edit(v=>({...v,answer:{...v.answer,aliases:e.target.value.split("\n").map(x=>x.trim()).filter(Boolean)}}))}/>
        </label>
      </div>
      <h3>{message("단서","Clues")}</h3>
      <p className="muted">{message("단서 순서와 이미지·지도·미디어 ID는 원본과 동일하게 유지됩니다. 텍스트만 번역하세요.",
        "Clue order, type, maps and media IDs are preserved. Edit the translated text only.")}</p>
      {fields.clues.map((clue,index)=><label className="translation-clue" key={index}>
        {message("단서 ","Clue ")}{index+1} · {clue.type}
        <textarea rows={2} value={clue.text??""} maxLength={clue.type==="text"?3000:1000}
          required={clue.type==="text"}
          onChange={e=>edit(v=>({...v,clues:v.clues.map((c,i)=>i===index?{...c,text:e.target.value}:c)}))}/>
      </label>)}
      <p className="muted">{message("오디오·동영상은 원본 언어의 음성이 포함될 수 있으므로 번역 공개 시 별도 미디어 현지화가 필요합니다.",
        "Audio/video must be localized separately before translation can be published.")}</p>
      <div className="actions">
        <button type="button" className="btn btn-outline" disabled={busy}
          onClick={()=>void transact(async()=>{
            const suggestion=await request(apiBase+"/generate","POST",{});
            setFields(suggestion.fields);
            setVerified(false);
          },message("AI 번역 초안을 생성했어요. 내용을 확인하고 저장하세요.",
            "AI draft generated. Review it before saving."),false)}>
          {busy?message("처리 중…","Working…"):message("AI 번역 초안 만들기","Suggest AI translation")}
        </button>
        <button type="button" className="btn btn-primary" disabled={busy||!fields.title.trim()||!fields.prompt.trim()||!fields.answer.canonical.trim()}
          onClick={()=>void transact(()=>request(apiBase,"PUT",{
            sourceRevisionId:list.sourceRevisionId,expectedVersion:language?.currentVersion??0,fields
          }),message("언어별 초안을 저장했어요.","Localized draft saved."))}>
          {message("번역 초안 저장","Save translation draft")}
        </button>
      </div>
      <label className="translation-check">
        <input type="checkbox" checked={verified} onChange={e=>setVerified(e.target.checked)}/>
        <span>{message("질문·정답·단서를 검토했고, 공개 시 안전성 재검토가 필요하다는 것을 이해했습니다.",
          "I reviewed the question, answer and clues, and understand publishing resets the safety review.")}</span>
      </label>
      <div className="actions">
        <button type="button" className="btn btn-primary"
          disabled={busy||!language||!verified||list.publication!=="PUBLISHED"||language.stale}
          onClick={()=>{
            if(!language || !window.confirm(message("이 번역 버전을 공개할까요?","Publish this translated version?")))return;
            void transact(()=>request(apiBase+"/publish","POST",{
              expectedVersion:language.currentVersion,reviewed:true,confirm:true
            }),message("번역 버전을 공개했습니다.","Translated version published."));
          }}>
          {message("검토한 버전 공개","Publish reviewed version")}
        </button>
        {language?.status==="PUBLISHED"&&<button type="button" className="btn btn-outline" disabled={busy}
          onClick={()=>{
            if(!window.confirm(message("이 언어 버전을 숨길까요?","Hide this language version?")))return;
            void transact(()=>request(apiBase+"/hide","POST",{confirm:true}),
              message("언어 버전을 숨겼습니다.","Language version hidden."));
          }}>{message("이 언어 숨기기","Hide this language")}</button>}
      </div>
      {list.publication!=="PUBLISHED"&&<p className="muted">
        {message("원본 퀴즈가 공개된 후에 번역을 공개할 수 있어요.",
          "Publish the original quiz before publishing translations.")}
      </p>}
    </div>}
    {error&&<p className="feedback" role="alert">{error}</p>}
    {notice&&<p className="feedback success" role="status">{notice}</p>}
  </section>;
}
