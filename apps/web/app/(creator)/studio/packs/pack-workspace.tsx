"use client";
import {useEffect,useState} from "react";
import {useLocale} from "../../../../src/i18n/provider";
type Pack={id:string;title:string;description:string;publication:string;quizIds:string[]};
type Quiz={id:string;title:string;publication:string};
async function api(path:string,method="GET",body?:object){
 const r=await fetch("/api/v1"+path,{method,credentials:"same-origin",cache:"no-store",
  headers:body?{"Content-Type":"application/json"}:{},body:body?JSON.stringify(body):undefined});
 const json=await r.json();if(!r.ok)throw Error(json.message||json.error||"Request failed");return json.data;
}
export default function PackWorkspace(){
 const locale=useLocale(),ko=locale==="ko";
 const [packs,setPacks]=useState<Pack[]>([]),[quizzes,setQuizzes]=useState<Quiz[]>([]);
 const [selected,setSelected]=useState(""),[title,setTitle]=useState(""),[description,setDescription]=useState("");
 const [members,setMembers]=useState<string[]>([]),[language,setLanguage]=useState<"en"|"ko">(locale);
 const [message,setMessage]=useState(""),[busy,setBusy]=useState(false),[preview,setPreview]=useState<{ready:boolean;issues:string[];draftCount:number;questionCount:number}|null>(null);
 async function refresh(){
  const [p,q]=await Promise.all([api("/packs?mine=true&locale="+locale+"&limit=100"),api("/me/quizzes?limit=100&offset=0&publication=all&safety=all&sort=newest")]);
  setPacks(p.items||[]);setQuizzes(q.items||[]);
 }
 useEffect(()=>{void refresh().catch(e=>setMessage(String(e)));},[locale]);
 function choose(p:Pack){setSelected(p.id);setTitle(p.title);setDescription(p.description||"");setMembers([...p.quizIds]);setPreview(null);setMessage("");}
 async function act(fn:()=>Promise<void>){setBusy(true);setMessage("");try{await fn();await refresh();}catch(e){setMessage(e instanceof Error?e.message:String(e));}finally{setBusy(false);}}
 async function save(){
  if(!title.trim()||!members.length){setMessage(ko?"제목과 최소 한 문제를 선택하세요.":"Choose a title and at least one quiz.");return;}
  await act(async()=>{const body={title:title.trim(),description,quizIds:members};
   if(selected)await api("/packs/"+selected,"PATCH",body);
   else {const p=await api("/packs","POST",{...body,locale:language});setSelected(p.id);}
   setPreview(null);setMessage(ko?"저장했어요.":"Saved.");
  });
 }
 async function validate(){if(!selected)return;await act(async()=>{const p=await api("/packs/"+selected+"/publish-preview");setPreview(p);});}
 async function publish(){if(!selected||!preview?.ready)return;
  if(!window.confirm(ko?"팩과 포함된 내 초안 문제를 함께 공개할까요?":"Publish this pack and all eligible owned drafts?"))return;
  await act(async()=>{await api("/packs/"+selected+"/publish","POST",{confirm:true});setPreview(null);setMessage(ko?"공개했어요.":"Published.");});
 }
 return <section className="studio-workspace">
  <div className="studio-section-head"><h2>{ko?"내 퀴즈팩":"My packs"}</h2><button className="btn btn-outline" onClick={()=>{setSelected("");setTitle("");setDescription("");setMembers([]);setPreview(null);}}>{ko?"새 팩":"New pack"}</button></div>
  <div className="studio-list">{packs.map(p=><button key={p.id} type="button" className="btn btn-outline" onClick={()=>choose(p)}>{p.title} · {p.quizIds.length} · {p.publication}</button>)}</div>
  <div className="studio-filters"><label>{ko?"제목":"Title"}<input value={title} maxLength={180} onChange={e=>{setTitle(e.target.value);setPreview(null);}}/></label>
  <label>{ko?"설명":"Description"}<textarea value={description} maxLength={2000} onChange={e=>{setDescription(e.target.value);setPreview(null);}}/></label>
  {!selected&&<label>{ko?"원본 언어":"Original language"}<select value={language} onChange={e=>setLanguage(e.target.value as "en"|"ko")}><option value="en">English</option><option value="ko">한국어</option></select></label>}</div>
  <h3>{ko?"문제 선택 및 순서":"Select and order questions"} ({members.length})</h3>
  <p className="muted">{ko?"내 문제를 선택하고 위아래 버튼으로 순서를 정하세요. 최대 100개.":"Select your quizzes, then move them up or down. Maximum 100."}</p>
  <div className="studio-list">{members.map((id,i)=><div className="studio-list-row" key={id}><span>{i+1}. {quizzes.find(q=>q.id===id)?.title||id}</span><div className="actions">
   <button disabled={i===0} onClick={()=>{setMembers(v=>{const a=[...v];[a[i-1],a[i]]=[a[i],a[i-1]];return a;});setPreview(null);}}>↑</button>
   <button disabled={i===members.length-1} onClick={()=>{setMembers(v=>{const a=[...v];[a[i+1],a[i]]=[a[i],a[i+1]];return a;});setPreview(null);}}>↓</button>
   <button onClick={()=>{setMembers(v=>v.filter(x=>x!==id));setPreview(null);}}>×</button></div></div>)}</div>
  <div className="studio-list">{quizzes.filter(q=>!members.includes(q.id)).map(q=><button type="button" key={q.id} className="btn btn-outline" disabled={members.length>=100} onClick={()=>{setMembers(v=>[...v,q.id]);setPreview(null);}}>+ {q.title} · {q.publication}</button>)}</div>
  <div className="actions"><button className="btn btn-primary" disabled={busy} onClick={()=>void save()}>{ko?"팩 저장":"Save pack"}</button>
  <button className="btn btn-outline" disabled={!selected||busy} onClick={()=>void validate()}>{ko?"공개 전 검증":"Check readiness"}</button>
  <button className="btn btn-primary" disabled={!selected||busy||!preview?.ready} onClick={()=>void publish()}>{ko?"전체 공개":"Publish all"}</button></div>
  {preview&&<div role="status"><p>{preview.ready?(ko?"공개 준비 완료":"Ready to publish"):(ko?"수정 필요":"Needs attention")} · {preview.questionCount} questions · {preview.draftCount} drafts</p>{preview.issues.map(x=><p key={x}>{x}</p>)}</div>}
  {message&&<p role="status">{message}</p>}
 </section>;
}
