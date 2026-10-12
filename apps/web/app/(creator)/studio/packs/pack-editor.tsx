"use client";

import {useEffect,useState} from "react";
import Link from "next/link";
import {useRouter} from "next/navigation";
import {useLocale} from "../../../../src/i18n/provider";
import {localizeHref} from "../../../../src/i18n/core";

type Pack={id:string;title:string;description:string;publication:string;sourceLocale:string;orderMode:"CREATOR"|"RANDOM";
  kidsReviewStatus:string;kidsEligible:boolean;kidsReady:boolean;kidsIssue:string;excludedCount:number;
  quizIds:string[];members:{id:string;title:string}[]};
type Quiz={id:string;title:string;publication:string};
type QuizPage={items:Quiz[];total:number};
type Preview={ready:boolean;issues:string[];draftCount:number;questionCount:number};
type Insights={runs:number;completed:number;averageSolved:number|null;ratings:{positive:number;negative:number};reportCounts:{reason:string;count:number}[]};
const PAGE_SIZE=20;
async function api(path:string,method="GET",body?:object){
  const response=await fetch("/api/v1"+path,{method,credentials:"same-origin",cache:"no-store",
    headers:body?{"Content-Type":"application/json"}:{},body:body?JSON.stringify(body):undefined});
  const json=await response.json();
  if(!response.ok)throw Error(json.message||json.error||"Request failed");
  return json.data;
}
export default function PackEditor({packId,detailHref}:{packId?:string;detailHref?:string}){
  const router=useRouter(),locale=useLocale(),ko=locale==="ko";
  const destination=detailHref??localizeHref(packId?"/studio/packs/"+packId:"/studio/packs",locale);
  const [loading,setLoading]=useState(!!packId);
  const [error,setError]=useState(""),[notice,setNotice]=useState("");
  const [title,setTitle]=useState(""),[description,setDescription]=useState("");
  const [language,setLanguage]=useState<"en"|"ko">(locale);
  const [orderMode,setOrderMode]=useState<"CREATOR"|"RANDOM">("CREATOR");
  const [members,setMembers]=useState<string[]>([]);
  const [memberTitles,setMemberTitles]=useState<Record<string,string>>({});
  const [publication,setPublication]=useState("DRAFT");
  const [busy,setBusy]=useState(false),[dirty,setDirty]=useState(false);
  const [query,setQuery]=useState(""),[search,setSearch]=useState(""),[page,setPage]=useState(0);
  const [questions,setQuestions]=useState<Quiz[]>([]),[questionTotal,setQuestionTotal]=useState(0);
  const [questionLoading,setQuestionLoading]=useState(true),[questionError,setQuestionError]=useState("");
  useEffect(()=>{
    if(!packId)return;
    let active=true;
    setLoading(true);
    void api("/me/packs/"+encodeURIComponent(packId))
      .then((pack:Pack)=>{
        if(!active)return;
        setTitle(pack.title);setDescription(pack.description||"");setMembers(pack.quizIds);
        setOrderMode(pack.orderMode||"CREATOR");setPublication(pack.publication);
        setMemberTitles(Object.fromEntries(pack.members.map(member=>[member.id,member.title])));
        setLanguage(pack.sourceLocale==="ko"?"ko":"en");
        setDirty(false);
      }).catch(e=>{if(active)setError(e instanceof Error?e.message:String(e));})
      .finally(()=>{if(active)setLoading(false);});
    return ()=>{active=false;};
  },[packId]);
  useEffect(()=>{
    const timer=setTimeout(()=>setSearch(query.trim()),300);
    return ()=>clearTimeout(timer);
  },[query]);
  useEffect(()=>{
    const controller=new AbortController();
    const params=new URLSearchParams({limit:String(PAGE_SIZE),offset:String(page*PAGE_SIZE),
      publication:"all",safety:"all",sort:"newest",search});
    setQuestionLoading(true);setQuestionError("");
    void fetch("/api/v1/me/quizzes?"+params.toString(),{
      credentials:"same-origin",cache:"no-store",signal:controller.signal
    }).then(async response=>{
      const data=await response.json();
      if(!response.ok)throw Error(data.message||data.error||"Could not load questions");
      return data.data as QuizPage;
    }).then(result=>{
      if(!controller.signal.aborted){setQuestions(result.items||[]);setQuestionTotal(result.total||0);}
    }).catch(e=>{
      if(!controller.signal.aborted)setQuestionError(e instanceof Error?e.message:String(e));
    }).finally(()=>{if(!controller.signal.aborted)setQuestionLoading(false);});
    return ()=>controller.abort();
  },[page,search]);
  function change(){setDirty(true);setNotice("");}
  function changeMembers(ids:string[]){setMembers(ids);change();}
  async function save(){
    if(busy)return;
    if(!title.trim()||!members.length){setError(ko?"제목과 최소 한 문제를 선택하세요.":"Choose a title and at least one question.");return;}
    setBusy(true);setError("");setNotice("");
    try{
      const body={title:title.trim(),description,quizIds:members,orderMode};
      if(packId){
        await api("/packs/"+encodeURIComponent(packId),"PATCH",body);
        setDirty(false);
        router.replace(destination);
        router.refresh();
      }else{
        const pack=await api("/packs","POST",{...body,locale:language});
        setDirty(false);
        router.replace(localizeHref("/studio/packs/"+pack.id,locale));
        router.refresh();
      }
    }catch(e){setError(e instanceof Error?e.message:String(e));}
    finally{setBusy(false);}
  }
  if(loading)return <div className="studio-empty" role="status">{ko?"팩을 불러오는 중…":"Loading pack…"}</div>;
  if(packId&&error&&!title)return <div className="studio-empty" role="alert">{error}</div>;
  const pages=Math.max(1,Math.ceil(questionTotal/PAGE_SIZE));
  return <section className="studio-workspace pack-editor">
    {packId&&<div className="studio-chip-row"><span className={"media-state-chip "+(publication==="PUBLISHED"?"media-ok":"media-wait")}>
      {publication==="PUBLISHED"?(ko?"공개 중":"Published"):publication==="HIDDEN"?(ko?"숨김":"Hidden"):(ko?"초안":"Draft")}
    </span></div>}
    <div className="studio-filters pack-form-fields">
      <label>{ko?"제목":"Title"}
        <input value={title} maxLength={180} onChange={e=>{setTitle(e.target.value);change();}}/>
      </label>
      {!packId&&<label>{ko?"원본 언어":"Original language"}
        <select value={language} onChange={e=>{setLanguage(e.target.value as "en"|"ko");change();}}>
          <option value="en">English</option><option value="ko">한국어</option>
        </select>
      </label>}
      <label className="pack-description">{ko?"설명":"Description"}
        <textarea rows={3} value={description} maxLength={2000} onChange={e=>{setDescription(e.target.value);change();}}/>
      </label>
      <label>{ko?"문제 출제 순서":"Question order"}
        <select value={orderMode} onChange={e=>{setOrderMode(e.target.value as "CREATOR"|"RANDOM");change();}}>
          <option value="CREATOR">{ko?"등록한 순서대로":"Creator-defined order"}</option>
          <option value="RANDOM">{ko?"플레이마다 랜덤으로":"Random each play"}</option>
        </select>
      </label>
    </div>
    <p className="muted">{orderMode==="RANDOM"
      ?(ko?"새 플레이 시작 시 순서를 한 번 섞고, 이어 하기에서는 그 순서를 유지합니다.":"Shuffle once per run; resuming retains the same order.")
      :(ko?"아래에서 정한 순서대로 출제합니다.":"Questions appear in the order below.")}</p>
    <div className="pack-editor-columns">
      <section className="feature-card">
        <h2>{ko?"팩에 포함된 문제":"Questions in this pack"} ({members.length}/100)</h2>
        {!members.length&&<p className="muted">{ko?"오른쪽 목록에서 문제를 추가하세요.":"Add questions from the available list."}</p>}
        <div className="pack-question-list">
          {members.map((id,index)=><div className="pack-question" key={id}>
            <span className="pack-question-title">{index+1}. {memberTitles[id]||id}</span>
            <div className="pack-question-actions">
              <button type="button" disabled={index===0||busy} aria-label={ko?"위로 이동":"Move up"} onClick={()=>{
                const next=[...members];[next[index-1],next[index]]=[next[index],next[index-1]];changeMembers(next);
              }}>↑</button>
              <button type="button" disabled={index===members.length-1||busy} aria-label={ko?"아래로 이동":"Move down"} onClick={()=>{
                const next=[...members];[next[index+1],next[index]]=[next[index],next[index+1]];changeMembers(next);
              }}>↓</button>
              <button type="button" disabled={busy} aria-label={ko?"문제 제거":"Remove question"} onClick={()=>changeMembers(members.filter(x=>x!==id))}>×</button>
            </div>
          </div>)}
        </div>
      </section>
      <section className="feature-card">
        <h2>{ko?"내 문제에서 추가":"Add from my questions"}</h2>
        <label className="pack-question-search">{ko?"문제 검색":"Search questions"}
          <input type="search" maxLength={120} value={query} placeholder={ko?"문제 제목 검색":"Search titles"} onChange={e=>{setQuery(e.target.value);setPage(0);}}/>
        </label>
        {questionError&&<p role="alert">{questionError}</p>}
        {questionLoading&&<p role="status" className="muted">{ko?"불러오는 중…":"Loading…"}</p>}
        {!questionLoading&&!questionError&&<div className="pack-question-list">
          {questions.filter(q=>!members.includes(q.id)).map(q=><button className="pack-add-question" type="button" key={q.id}
            disabled={members.length>=100||busy} onClick={()=>{
              setMemberTitles(old=>({...old,[q.id]:q.title}));changeMembers([...members,q.id]);
            }}><span>+ {q.title}</span><small>{q.publication==="PUBLISHED"?(ko?"공개":"Published"):(ko?"초안":"Draft")}</small></button>)}
          {!questions.length&&<p className="muted">{ko?"검색 결과가 없어요.":"No matching questions."}</p>}
        </div>}
        {!questionLoading&&!questionError&&questionTotal>PAGE_SIZE&&<nav className="media-pagination" aria-label={ko?"문제 검색 페이지":"Question pages"}>
          <button type="button" className="btn btn-outline" disabled={page===0} onClick={()=>setPage(n=>n-1)}>{ko?"이전":"Previous"}</button>
          <span>{page+1} / {pages}</span>
          <button type="button" className="btn btn-outline" disabled={page+1>=pages} onClick={()=>setPage(n=>n+1)}>{ko?"다음":"Next"}</button>
        </nav>}
      </section>
    </div>
    <div className="pack-editor-footer">
      <div className="actions">
        <Link href={destination} className="btn btn-outline"
          onClick={e=>{if(dirty&&!window.confirm(ko?"수정 사항을 버리고 이동할까요?":"Discard unsaved changes?"))e.preventDefault();}}>
          {ko?"취소":"Cancel"}</Link>
        <button type="button" className="btn btn-primary" disabled={busy||(!!packId&&!dirty)} onClick={()=>void save()}>
          {busy?(ko?"저장 중…":"Saving…"):packId?(ko?"변경사항 저장":"Save changes"):(ko?"팩 만들기":"Create pack")}</button>
      </div>
      {!packId&&<p className="muted">{ko?"팩을 만든 다음 상세 페이지에서 공개 여부와 어린이용 심사를 관리하세요.":"Create the pack, then manage publication and Kids review from its detail page."}</p>}
      {error&&<p role="alert">{error}</p>}
      {notice&&<p role="status">{notice}</p>}
    </div>
  </section>;
}
