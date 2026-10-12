"use client";

import {useEffect,useState} from "react";
import {useRouter} from "next/navigation";
import {useLocale} from "../../../../src/i18n/provider";
import {localizeHref} from "../../../../src/i18n/core";

type Pack={id:string;title:string;description:string;publication:string;sourceLocale:string;orderMode:"CREATOR"|"RANDOM";quizIds:string[];members:{id:string;title:string}[]};
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
export default function PackEditor({packId}:{packId?:string}){
  const router=useRouter(),locale=useLocale(),ko=locale==="ko";
  const [loading,setLoading]=useState(!!packId);
  const [error,setError]=useState(""),[notice,setNotice]=useState("");
  const [title,setTitle]=useState(""),[description,setDescription]=useState("");
  const [language,setLanguage]=useState<"en"|"ko">(locale);
  const [orderMode,setOrderMode]=useState<"CREATOR"|"RANDOM">("CREATOR");
  const [members,setMembers]=useState<string[]>([]);
  const [memberTitles,setMemberTitles]=useState<Record<string,string>>({});
  const [publication,setPublication]=useState("DRAFT");
  const [busy,setBusy]=useState(false),[dirty,setDirty]=useState(false);
  const [preview,setPreview]=useState<Preview|null>(null),[insights,setInsights]=useState<Insights|null>(null);
  const [query,setQuery]=useState(""),[search,setSearch]=useState(""),[page,setPage]=useState(0);
  const [questions,setQuestions]=useState<Quiz[]>([]),[questionTotal,setQuestionTotal]=useState(0);
  const [questionLoading,setQuestionLoading]=useState(true),[questionError,setQuestionError]=useState("");
  useEffect(()=>{
    if(!packId)return;
    let active=true;
    setLoading(true);
    void Promise.all([api("/me/packs/"+packId),api("/me/packs/"+packId+"/insights?locale=all")])
      .then(([pack,stats]:[Pack,Insights])=>{
        if(!active)return;
        setTitle(pack.title);setDescription(pack.description||"");setMembers(pack.quizIds);
        setOrderMode(pack.orderMode||"CREATOR");setPublication(pack.publication);
        setMemberTitles(Object.fromEntries(pack.members.map(member=>[member.id,member.title])));
        setLanguage(pack.sourceLocale==="ko"?"ko":"en");
        setInsights(stats);setDirty(false);
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
  function change(){setDirty(true);setPreview(null);setNotice("");}
  function changeMembers(ids:string[]){setMembers(ids);change();}
  async function perform(action:()=>Promise<void>){
    setBusy(true);setError("");setNotice("");
    try{await action();}catch(e){setError(e instanceof Error?e.message:String(e));}
    finally{setBusy(false);}
  }
  async function save(){
    if(!title.trim()||!members.length){setError(ko?"제목과 최소 한 문제를 선택하세요.":"Choose a title and at least one question.");return;}
    await perform(async()=>{
      const body={title:title.trim(),description,quizIds:members,orderMode};
      if(packId){
        await api("/packs/"+packId,"PATCH",body);
        setDirty(false);setPreview(null);setNotice(ko?"변경 사항을 저장했어요.":"Changes saved.");
      }else{
        const pack=await api("/packs","POST",{...body,locale:language});
        router.replace(localizeHref("/studio/packs/"+pack.id,locale));
      }
    });
  }
  async function validate(){
    if(!packId||dirty)return;
    await perform(async()=>{
      const result=await api("/packs/"+packId+"/publish-preview");
      setPreview(result);
    });
  }
  async function publish(){
    if(!packId||dirty||!preview?.ready)return;
    if(!window.confirm(ko?"팩과 포함된 내 초안 문제를 함께 공개할까요?":"Publish this pack and eligible owned drafts?"))return;
    await perform(async()=>{
      await api("/packs/"+packId+"/publish","POST",{confirm:true});
      setPublication("PUBLISHED");setPreview(null);
      setNotice(ko?"팩을 공개했어요.":"Pack published.");
    });
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
        <button type="button" className="btn btn-primary" disabled={busy} onClick={()=>void save()}>{busy?(ko?"처리 중…":"Working…"):(ko?"팩 저장":"Save pack")}</button>
        {packId&&<button type="button" className="btn btn-outline" disabled={busy||dirty} onClick={()=>void validate()}>{ko?"공개 전 검증":"Check readiness"}</button>}
        {packId&&<button type="button" className="btn btn-primary" disabled={busy||dirty||!preview?.ready} onClick={()=>void publish()}>{ko?"전체 공개":"Publish all"}</button>}
      </div>
      {packId&&dirty&&<p className="muted">{ko?"검증 또는 공개하기 전에 변경 사항을 저장하세요.":"Save changes before checking readiness or publishing."}</p>}
      {!packId&&<p className="muted">{ko?"먼저 팩을 저장하면 공개 여부를 검증할 수 있습니다.":"Save the pack first to check publication readiness."}</p>}
      {error&&<p role="alert">{error}</p>}
      {notice&&<p role="status">{notice}</p>}
      {preview&&<div role="status" className="placeholder-panel">
        <h3>{preview.ready?(ko?"공개 준비 완료":"Ready to publish"):(ko?"수정이 필요해요":"Needs attention")}</h3>
        <p>{preview.questionCount} {ko?"문제":"questions"} · {preview.draftCount} {ko?"초안":"drafts"}</p>
        {preview.issues.map(issue=><p key={issue}>{issue}</p>)}
      </div>}
    </div>
    {packId&&insights&&<section className="feature-card pack-insights" aria-label={ko?"팩 분석":"Pack insights"}>
      <h2>{ko?"퀴즈팩 통계":"Pack performance"}</h2>
      <div className="studio-figures">
        <span><strong>{insights.runs}</strong> {ko?"전체 플레이":"starts"}</span>
        <span><strong>{insights.completed}</strong> {ko?"완료":"completed"}</span>
        <span><strong>{insights.ratings.positive}</strong> 👍</span>
        <span><strong>{insights.ratings.negative}</strong> 👎</span>
      </div>
      {insights.averageSolved!==null&&<p className="muted">{ko?"완료 플레이 평균 정답":"Average correct in completed runs"}: {insights.averageSolved.toFixed(1)}</p>}
      {!!insights.reportCounts.length&&<p className="muted">{ko?"신고 현황":"Reports"}: {insights.reportCounts.map(r=>r.reason+" "+r.count).join(", ")}</p>}
      <p className="muted">{ko?"이용자별 활동 기록은 노출하지 않습니다.":"Individual player activity is not exposed."}</p>
    </section>}
  </section>;
}
