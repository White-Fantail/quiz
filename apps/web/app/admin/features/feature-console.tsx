"use client";
import {useEffect,useState} from "react";
import Link from "next/link";
import {useLocale} from "../../../src/i18n/provider";
import {localizeHref} from "../../../src/i18n/core";
type Candidate={id:string;type:"QUIZ"|"PACK";title:string;creator:string;questionCount:number};
type Feature={id:string;targetType:"QUIZ"|"PACK";subjectId:string;locale:string;lane:string;
  headline:string;description:string;priority:number;placement:string;status:string;
  startAt:string;endAt:string};
async function api(path:string,method="GET",body?:object){
 const response=await fetch("/api/v1"+path,{method,credentials:"same-origin",cache:"no-store",
   ...(method==="DELETE"?{headers:{"Content-Type":"application/json"}}:body?{headers:{"Content-Type":"application/json"}}:{}),
   ...(body?{body:JSON.stringify(body)}:{})});
 const data=await response.json().catch(()=>({}));
 if(!response.ok)throw Error(data.message||data.error||"Request failed");
 return data.data;
}
function iso(value:string){
 const date=new Date(value);
 if(!Number.isFinite(date.getTime()))throw Error("Choose a valid date and time");
 return date.toISOString();
}
function localDate(date:Date){
 const local=new Date(date.getTime()-date.getTimezoneOffset()*60000);
 return local.toISOString().slice(0,16);
}
export default function FeatureConsole(){
 const locale=useLocale(),ko=locale==="ko";
 const [type,setType]=useState<"QUIZ"|"PACK">("PACK"),[audience,setAudience]=useState<"GENERAL"|"KIDS">("GENERAL");
 const [language,setLanguage]=useState<"en"|"ko">(locale);
 const [search,setSearch]=useState(""),[candidates,setCandidates]=useState<Candidate[]>([]);
 const [subjectId,setSubjectId]=useState("");
 const [placement,setPlacement]=useState<"HERO"|"ROW">("HERO"),[priority,setPriority]=useState(0);
 const [headline,setHeadline]=useState(""),[description,setDescription]=useState("");
 const [startAt,setStartAt]=useState(()=>localDate(new Date()));
 const [endAt,setEndAt]=useState(()=>localDate(new Date(Date.now()+7*86400000)));
 const [features,setFeatures]=useState<Feature[]>([]),[busy,setBusy]=useState(false);
 const [error,setError]=useState(""),[notice,setNotice]=useState("");
 async function load(){
   const value=await api("/admin/features?limit=50");
   setFeatures(value.items??[]);
 }
 useEffect(()=>{void load().catch(e=>setError(String(e)));},[]);
 async function work(fn:()=>Promise<void>){
   setBusy(true);setError("");setNotice("");
   try{await fn();await load();}
   catch(e){setError(e instanceof Error?e.message:String(e))}
   finally{setBusy(false)}
 }
 async function find(){
   await work(async()=>{
    const params=new URLSearchParams({type,locale:language,lane:audience,search,limit:"15"});
    const value=await api("/admin/features/candidates?"+params);
    setCandidates(value.items??[]);
    setSubjectId("");setNotice(ko?"공개·안전 기준을 통과한 콘텐츠만 표시해요.":"Only currently eligible content is listed.");
   });
 }
 async function create(){
   if(!subjectId){setError(ko?"먼저 추천할 콘텐츠를 선택하세요.":"Select content first.");return}
   if(!window.confirm(ko?"이 콘텐츠를 관리자 추천으로 편성할까요?":"Schedule this as a labeled Editor's Pick?"))return;
   await work(async()=>{
     await api("/admin/features","POST",{targetType:type,targetId:subjectId,lane:audience,
       locale:language,placement,priority,headline,description,
       startAt:iso(startAt),endAt:iso(endAt),confirm:true});
     setNotice(ko?"추천이 편성됐어요.":"Editorial feature scheduled.");
   });
 }
 async function toggle(feature:Feature){
   const next=feature.status==="ACTIVE"?"PAUSED":"ACTIVE";
   await work(async()=>{
     await api("/admin/features/"+feature.id,"PATCH",{status:next,confirm:true});
     setNotice(ko?"편성 상태를 업데이트했어요.":"Feature status updated.");
   });
 }
 async function remove(feature:Feature){
   if(!window.confirm(ko?"추천 항목을 삭제할까요?":"Remove this editorial feature?"))return;
   await work(async()=>{
     await api("/admin/features/"+feature.id+"?confirm=true","DELETE");
     setNotice(ko?"추천 항목을 삭제했어요.":"Editorial feature removed.");
   });
 }
 return <section className="studio-workspace">
  <p className="muted">{ko?"관리자 선정은 셀럽 인증이나 자동 인기 순위를 의미하지 않아요.":"Editorial selection never certifies a celebrity identity or implies organic popularity."}</p>
  <h2>{ko?"추천할 콘텐츠 찾기":"Find eligible content"}</h2>
  <div className="studio-filters">
   <label>{ko?"콘텐츠":"Content type"}<select value={type} onChange={e=>{setType(e.target.value as typeof type);setCandidates([]);setSubjectId("");}}>
    <option value="PACK">{ko?"퀴즈팩":"Quiz pack"}</option><option value="QUIZ">{ko?"개별 문제":"Question"}</option></select></label>
   <label>{ko?"노출 대상":"Audience"}<select value={audience} onChange={e=>{setAudience(e.target.value as typeof audience);setCandidates([]);setSubjectId("");}}>
    <option value="GENERAL">{ko?"일반":"General"}</option><option value="KIDS">{ko?"어린이 (별도 승인 필수)":"Kids (separate approval required)"}</option></select></label>
   <label>{ko?"언어":"Language"}<select value={language} onChange={e=>{setLanguage(e.target.value as typeof language);setCandidates([]);setSubjectId("");}}>
    <option value="en">English</option><option value="ko">한국어</option></select></label>
   <label>{ko?"제목 검색":"Search titles"}<input value={search} onChange={e=>setSearch(e.target.value)} maxLength={100}/></label>
  </div>
  <button className="btn btn-outline" type="button" disabled={busy} onClick={()=>void find()}>
   {ko?"노출 가능한 콘텐츠 검색":"Search eligible content"}</button>
  <div className="studio-list">{candidates.map(item=><label key={item.id} className="studio-list-row">
    <input type="radio" name="editorial-target" checked={subjectId===item.id} onChange={()=>setSubjectId(item.id)}/>
    <span><strong>{item.title}</strong> · {item.creator} · {item.questionCount} {ko?"문제":"questions"}</span>
  </label>)}</div>
  <h2>{ko?"추천 편성":"Schedule highlight"}</h2>
  <div className="studio-filters">
    <label>{ko?"위치":"Placement"}<select value={placement} onChange={e=>setPlacement(e.target.value as typeof placement)}>
      <option value="HERO">{ko?"대표 추천":"Hero feature"}</option><option value="ROW">{ko?"추천 목록":"Editorial row"}</option></select></label>
    <label>{ko?"우선순위":"Priority"}<input type="number" min={-100} max={100} value={priority} onChange={e=>setPriority(Number(e.target.value))}/></label>
    <label>{ko?"추천 제목 (선택)":"Editorial headline (optional)"}<input value={headline} maxLength={180} onChange={e=>setHeadline(e.target.value)}/></label>
    <label>{ko?"추천 설명 (선택)":"Editorial description (optional)"}<textarea value={description} maxLength={500} onChange={e=>setDescription(e.target.value)} rows={3}/></label>
    <label>{ko?"시작":"Starts"}<input type="datetime-local" value={startAt} onChange={e=>setStartAt(e.target.value)}/></label>
    <label>{ko?"종료":"Ends"}<input type="datetime-local" value={endAt} onChange={e=>setEndAt(e.target.value)}/></label>
  </div>
  <button className="btn btn-primary" type="button" disabled={busy||!subjectId} onClick={()=>void create()}>
   {ko?"관리자 추천 편성":"Schedule Editor's Pick"}</button>
  <h2>{ko?"편성된 추천 콘텐츠":"Editorial schedule"}</h2>
  <div className="studio-list">{features.map(item=><article className="studio-list-row" key={item.id}>
   <div><strong>{item.headline||item.targetType}</strong>
    <p className="muted">{item.targetType} · {item.lane} · {item.locale} · {item.placement} · {item.status}</p>
    <p className="muted">{new Date(item.startAt).toLocaleString()} – {new Date(item.endAt).toLocaleString()}</p>
    <Link href={localizeHref(item.targetType==="PACK"?"/packs/"+item.subjectId:"/play/"+item.subjectId,locale)}>
      {ko?"콘텐츠 확인":"View content"}</Link>
   </div>
   <div className="actions">
    <button className="btn btn-outline" type="button" disabled={busy} onClick={()=>void toggle(item)}>
      {item.status==="ACTIVE"?(ko?"일시중지":"Pause"):(ko?"재개":"Resume")}</button>
    <button className="btn btn-outline" type="button" disabled={busy} onClick={()=>void remove(item)}>
      {ko?"삭제":"Remove"}</button>
   </div>
  </article>)}</div>
  {!features.length&&<p className="muted">{ko?"편성된 추천이 없어요.":"No features scheduled yet."}</p>}
  {notice&&<p role="status">{notice}</p>}
  {error&&<p role="alert" className="feedback">{error}</p>}
 </section>;
}
