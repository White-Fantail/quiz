"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Topic = { name:string; isSpoiler?:boolean };
type AgeRange = { minimum?:number; maximum?:number };
type Quiz = {
  id:string;title:string;prompt:string;version:number;publication:string;
  safetyStatus:string;kidsEligible:boolean;answerType:string;topics:Topic[];
  creatorIntent?:{ageRange?:AgeRange;note?:string}|null;
  recommendedAudience?:{ageRange?:AgeRange;difficulty?:string}|null;
};
type Feedback = { id:string;rating:number;comment:string;createdAt:string;author:{displayName:string} };
type Insights = {
  started:number;completed:number;solved:number;failed:number;inProgressOrAbandoned:number;
  successRate:number|null;completionRate:number|null;averageCluesUsed:number|null;
  correctByClueStage:{stage:number;correct:number}[];
  reviews:{positive:number;negative:number;total:number;items:Feedback[];hasMore:boolean;
    trend:{last7Days:{positive:number;negative:number};previous7Days:{positive:number;negative:number}}};
  reports:{total:number;byReason:{reason:string;count:number}[]};
};
type FormValues = {
  title:string;prompt:string;answerType:string;topics:string;
  creatorMin:string;creatorMax:string;creatorNote:string;
  suggestedMin:string;suggestedMax:string;difficulty:string;
};
type Tab = "metadata"|"results"|"feedback";
const REVIEW_PAGE_SIZE=10;
const answerTypes=["person","animal","place","thing","event","concept","other"];
const publicationNames:Record<string,string>={DRAFT:"초안",PUBLISHED:"공개",HIDDEN:"숨김"};
const safetyNames:Record<string,string>={PENDING:"검토 대기",APPROVED:"검토 완료",RESTRICTED:"제한됨"};
const reportNames:Record<string,string>={
  WRONG_ANSWER:"정답 오류",WRONG_CLUE:"단서 오류",UNSAFE:"부적절한 콘텐츠",
  COPYRIGHT:"저작권",PRIVACY:"개인정보",SPAM:"스팸",DUPLICATE:"중복"
};
function formatPercent(ratio:number|null){return ratio===null?"—":Math.round(ratio*100)+"%";}
function formatNumber(number:number){return number.toLocaleString("ko-KR");}
function formFromQuiz(q:Quiz):FormValues{
  return {
    title:q.title,prompt:q.prompt,answerType:q.answerType,
    topics:q.topics.map(t=>t.name).join(", "),
    creatorMin:q.creatorIntent?.ageRange?.minimum?.toString()??"",
    creatorMax:q.creatorIntent?.ageRange?.maximum?.toString()??"",
    creatorNote:q.creatorIntent?.note??"",
    suggestedMin:q.recommendedAudience?.ageRange?.minimum?.toString()??"",
    suggestedMax:q.recommendedAudience?.ageRange?.maximum?.toString()??"",
    difficulty:q.recommendedAudience?.difficulty??""
  };
}
async function api(path:string,method="GET",body?:object):Promise<any>{
  const res=await fetch("/api/v1"+path,{method,credentials:"same-origin",cache:"no-store",
    headers:body?{"Content-Type":"application/json"}:undefined,body:body?JSON.stringify(body):undefined});
  const data=await res.json().catch(()=>({}));
  if(!res.ok)throw new Error(data.message||data.error||"요청을 처리하지 못했어요.");
  return data.data;
}
function validateAge(min:string,max:string):AgeRange{
  const age:AgeRange={};
  if(min!=="")age.minimum=Number(min);
  if(max!=="")age.maximum=Number(max);
  if(Object.values(age).some(n=>!Number.isInteger(n)||n<0||n>120))
    throw new Error("연령은 0~120 사이의 정수로 입력해 주세요.");
  if(age.minimum!==undefined&&age.maximum!==undefined&&age.minimum>age.maximum)
    throw new Error("최소 연령은 최대 연령보다 클 수 없어요.");
  return age;
}

export default function StudioQuizDetail({quizId}:{quizId:string}){
  const [quiz,setQuiz]=useState<Quiz|null>(null);
  const [form,setForm]=useState<FormValues|null>(null);
  const [original,setOriginal]=useState<FormValues|null>(null);
  const [loading,setLoading]=useState(true);
  const [loadError,setLoadError]=useState("");
  const [refresh,setRefresh]=useState(0);
  const [tab,setTab]=useState<Tab>("metadata");
  const [insights,setInsights]=useState<Insights|null>(null);
  const [insightsLoading,setInsightsLoading]=useState(true);
  const [insightsError,setInsightsError]=useState("");
  const [feedbackPage,setFeedbackPage]=useState(0);
  const [feedbackRefresh,setFeedbackRefresh]=useState(0);
  const [saving,setSaving]=useState(false);
  const [notice,setNotice]=useState("");
  const [error,setError]=useState("");
  useEffect(()=>{
    let active=true;setLoading(true);setLoadError("");
    void api("/quizzes/"+encodeURIComponent(quizId)).then((q:Quiz)=>{
      if(active){setQuiz(q);const values=formFromQuiz(q);setForm(values);setOriginal(values);}
    }).catch(e=>{if(active)setLoadError(e instanceof Error?e.message:"문제를 불러오지 못했어요.");})
      .finally(()=>{if(active)setLoading(false);});
    return ()=>{active=false;};
  },[quizId,refresh]);
  useEffect(()=>{
    let active=true;setInsightsLoading(true);setInsightsError("");
    const params=new URLSearchParams({limit:String(REVIEW_PAGE_SIZE),offset:String(feedbackPage*REVIEW_PAGE_SIZE)});
    void api("/me/quizzes/"+encodeURIComponent(quizId)+"/insights?"+params.toString())
      .then((data:Insights)=>{if(active)setInsights(data);})
      .catch(e=>{if(active)setInsightsError(e instanceof Error?e.message:"통계와 리뷰를 가져오지 못했어요.");})
      .finally(()=>{if(active)setInsightsLoading(false);});
    return ()=>{active=false;};
  },[quizId,feedbackPage,feedbackRefresh]);

  function change<K extends keyof FormValues>(key:K,value:FormValues[K]){
    setForm(previous=>previous?{...previous,[key]:value}:previous);
  }
  const dirty=!!form&&!!original&&JSON.stringify(form)!==JSON.stringify(original);
  async function save(event:React.FormEvent<HTMLFormElement>){
    event.preventDefault();
    if(!quiz||!form||!dirty||saving)return;
    setNotice("");setError("");
    try{
      const creatorAge=validateAge(form.creatorMin,form.creatorMax);
      const suggestedAge=validateAge(form.suggestedMin,form.suggestedMax);
      const names=form.topics.split(",").map(t=>t.trim()).filter(Boolean);
      if(names.length>12)throw new Error("주제는 최대 12개까지 입력할 수 있어요.");
      const oldTopics=new Map(quiz.topics.map(t=>[t.name.toLocaleLowerCase(),t.isSpoiler===true]));
      const topics=names.map(name=>({name,isSpoiler:oldTopics.get(name.toLocaleLowerCase())??false}));
      if(quiz.publication==="PUBLISHED"&&!window.confirm(
        "공개된 문제의 정보를 수정할까요? 새 버전이 생성되고 안전 검토는 대기로 돌아가며, 기존 Kids 승인은 해제됩니다."
      ))return;
      setSaving(true);
      const q:Quiz=await api("/quizzes/"+encodeURIComponent(quiz.id),"PATCH",{
        expectedVersion:quiz.version,
        title:form.title,prompt:form.prompt,answerType:form.answerType,topics,
        creatorIntent:{ageRange:creatorAge,note:form.creatorNote},
        recommendedAudience:{ageRange:suggestedAge,...(form.difficulty?{difficulty:form.difficulty}:{})}
      });
      setQuiz(q);const values=formFromQuiz(q);setForm(values);setOriginal(values);
      setNotice("수정 내용을 새 버전으로 저장했습니다. 안전 검토 상태를 확인해 주세요.");
      setFeedbackPage(0);setFeedbackRefresh(n=>n+1);
    }catch(e){
      setError(e instanceof Error?e.message:"저장하지 못했어요. 최신 버전을 확인해 주세요.");
    }finally{setSaving(false);}
  }
  async function publish(){
    if(!quiz||saving||!window.confirm("이 퀴즈를 공개할까요? 공개 후에도 Kids 노출에는 별도 검토가 필요합니다."))return;
    setSaving(true);setNotice("");setError("");
    try{
      await api("/quizzes/"+encodeURIComponent(quiz.id)+"/publish","POST",{confirm:true});
      setNotice("공개 요청이 반영됐어요. Kids 노출 여부는 플랫폼 안전 검토에 따라 결정됩니다.");
      setRefresh(n=>n+1);
    }catch(e){setError(e instanceof Error?e.message:"공개하지 못했어요.");}
    finally{setSaving(false);}
  }
  if(loading)return <div className="studio-empty" role="status">문제 정보를 불러오는 중…</div>;
  if(loadError||insightsError)return <div className="studio-empty" role="alert">
    <h1>문제를 관리할 수 없어요</h1><p>{loadError||insightsError}</p>
    <Link href="/studio" className="btn btn-outline">내 목록으로 돌아가기</Link>
  </div>;
  if(!quiz||!form)return <div className="studio-empty">문제를 찾을 수 없어요.</div>;
  return <div className="studio-detail-workspace">
    <div className="studio-detail-head">
      <div>
        <h1>{quiz.title}</h1>
        <p className="muted">v{quiz.version} · 문제 메타정보, 이용 결과, 사용자 반응을 한곳에서 관리하세요.</p>
        <div className="studio-chip-row">
          <span className="media-state-chip media-wait">{publicationNames[quiz.publication]||quiz.publication}</span>
          <span className={"media-state-chip "+(quiz.safetyStatus==="RESTRICTED"?"media-blocked":quiz.safetyStatus==="APPROVED"?"media-ok":"media-wait")}>{safetyNames[quiz.safetyStatus]||quiz.safetyStatus}</span>
          <span className={"media-state-chip "+(quiz.kidsEligible?"media-ok":"media-wait")}>Kids {quiz.kidsEligible?"노출 가능":"미승인"}</span>
        </div>
      </div>
      <div className="actions">
        {quiz.publication!=="PUBLISHED"&&quiz.safetyStatus!=="RESTRICTED"&&<button type="button"
          className="btn btn-primary" disabled={saving||dirty} onClick={()=>void publish()}>퀴즈 공개하기</button>}
        {quiz.publication==="PUBLISHED"&&quiz.safetyStatus!=="RESTRICTED"&&
          <Link href={"/play/"+quiz.id} className="btn btn-outline">플레이 화면</Link>}
      </div>
    </div>
    {dirty&&<p className="muted">저장하지 않은 수정 사항이 있어요. 공개하기 전에 저장해 주세요.</p>}
    {error&&<p className="feedback" role="alert">{error}</p>}
    {notice&&<p className="feedback success" role="status">{notice}</p>}
    <nav className="studio-tabs" aria-label="문제 관리 메뉴">
      <button type="button" className={tab==="metadata"?"active":""} aria-current={tab==="metadata"?"page":undefined}
        onClick={()=>setTab("metadata")}>정보 수정</button>
      <button type="button" className={tab==="results"?"active":""} aria-current={tab==="results"?"page":undefined}
        onClick={()=>setTab("results")}>풀이 결과</button>
      <button type="button" className={tab==="feedback"?"active":""} aria-current={tab==="feedback"?"page":undefined}
        onClick={()=>setTab("feedback")}>사용자 피드백 {insights?"("+formatNumber(insights.reviews.total)+")":""}</button>
    </nav>

    {tab==="metadata"&&<form className="studio-meta-form" onSubmit={e=>void save(e)}>
      <section className="placeholder-panel">
        <h2>기본 정보</h2>
        <div className="studio-form-grid">
          <label className="studio-wide">퀴즈 제목
            <input value={form.title} onChange={e=>change("title",e.target.value)} maxLength={180} required/>
          </label>
          <label className="studio-wide">질문
            <textarea value={form.prompt} onChange={e=>change("prompt",e.target.value)} maxLength={2000} rows={3} required/>
          </label>
          <label>정답 유형
            <select value={form.answerType} onChange={e=>change("answerType",e.target.value)}>
              {answerTypes.map(t=><option key={t} value={t}>{t}</option>)}
            </select>
          </label>
          <label className="studio-wide">주제 · 쉼표로 구분
            <input value={form.topics} onChange={e=>change("topics",e.target.value)}
              placeholder="예: New Zealand, Geography, Cities"/>
          </label>
          <p className="studio-wide muted">기존 비공개 주제 설정은 유지됩니다. 정답을 드러내는 주제는 시스템에서 자동으로 숨깁니다.</p>
        </div>
      </section>
      <section className="placeholder-panel">
        <h2>대상과 난이도</h2>
        <p className="muted">권장 대상은 수정할 수 있지만 플랫폼의 안전성 등급과 Kids 승인 상태는 바꿀 수 없어요.</p>
        <div className="studio-form-grid">
          <h3 className="studio-wide">제작자가 생각하는 대상</h3>
          <label>최소 나이
            <input type="number" min={0} max={120} step={1} value={form.creatorMin} onChange={e=>change("creatorMin",e.target.value)} placeholder="선택 사항"/>
          </label>
          <label>최대 나이
            <input type="number" min={0} max={120} step={1} value={form.creatorMax} onChange={e=>change("creatorMax",e.target.value)} placeholder="선택 사항"/>
          </label>
          <label className="studio-wide">제작자 메모
            <textarea rows={2} maxLength={400} value={form.creatorNote} onChange={e=>change("creatorNote",e.target.value)} placeholder="이 문제를 누구에게 추천하고 싶나요?"/>
          </label>
          <h3 className="studio-wide">추천 대상 · 수정 가능</h3>
          <label>추천 최소 나이
            <input type="number" min={0} max={120} step={1} value={form.suggestedMin} onChange={e=>change("suggestedMin",e.target.value)} placeholder="자동 추천 또는 직접 입력"/>
          </label>
          <label>추천 최대 나이
            <input type="number" min={0} max={120} step={1} value={form.suggestedMax} onChange={e=>change("suggestedMax",e.target.value)} placeholder="선택 사항"/>
          </label>
          <label>추천 난이도
            <select value={form.difficulty} onChange={e=>change("difficulty",e.target.value)}>
              <option value="">지정 안 함</option><option value="easy">쉬움</option>
              <option value="medium">보통</option><option value="hard">어려움</option>
            </select>
          </label>
        </div>
      </section>
      <div className="studio-save-bar">
        <p className="muted">저장 시 새 버전이 만들어지고 안전 검토는 대기로 돌아가며 Kids 승인은 해제됩니다. 정답과 단서 편집은 현재 API/MCP에서 지원해요.</p>
        <div className="actions">
          <button type="button" className="btn btn-outline" disabled={!dirty||saving} onClick={()=>{if(original)setForm({...original});}}>변경 취소</button>
          <button className="btn btn-primary" type="submit" disabled={!dirty||saving}>{saving?"저장 중…":"변경사항 저장"}</button>
        </div>
      </div>
    </form>}

    {tab==="results"&&<section className="studio-results">
      <h2>전체 버전의 풀이 결과</h2>
      <p className="muted">퀴즈가 수정되기 전의 풀이도 합산합니다. 진행 중이거나 이탈한 플레이는 정답률 계산에서 제외됩니다.</p>
      {insightsLoading&&!insights&&<p role="status">통계를 불러오는 중…</p>}
      {insightsError&&<p role="alert" className="feedback">{insightsError}</p>}
      {insights&&<><div className="studio-metric-grid">
        <div><small>시작한 횟수</small><strong>{formatNumber(insights.started)}</strong></div>
        <div><small>완료한 횟수</small><strong>{formatNumber(insights.completed)}</strong></div>
        <div><small>완료율</small><strong>{formatPercent(insights.completionRate)}</strong></div>
        <div><small>정답률</small><strong>{formatPercent(insights.successRate)}</strong></div>
      </div>
      <div className="studio-results-columns">
        <div className="placeholder-panel"><h3>풀이 현황</h3>
          <p>정답 {formatNumber(insights.solved)}회 · 오답 {formatNumber(insights.failed)}회</p>
          <p>미완료 {formatNumber(insights.inProgressOrAbandoned)}회</p>
          <p>평균 사용 단서 수: <strong>{insights.averageCluesUsed===null?"—":insights.averageCluesUsed.toFixed(1)}</strong></p>
        </div>
        <div className="placeholder-panel"><h3>몇 번째 단서에서 맞혔을까?</h3>
          {!insights.correctByClueStage.length?<p className="muted">정답 데이터가 아직 없어요.</p>:
          <ul className="studio-clue-stages">{insights.correctByClueStage.map(s=><li key={s.stage}>
            <span>{s.stage}번째</span><div><span style={{width:(s.correct/Math.max(...insights.correctByClueStage.map(c=>c.correct))*100)+"%"}}/></div><b>{formatNumber(s.correct)}</b>
          </li>)}</ul>}
        </div>
      </div></>}
    </section>}

    {tab==="feedback"&&<section className="studio-feedback">
      <h2>퀴즈 사용자 반응</h2>
      <p className="muted">리뷰는 공개된 평가이며, 문제 신고는 운영자의 검토 대상입니다. 신고자 정보와 신고 원문은 작성자에게 공개되지 않습니다.</p>
      {insightsLoading&&!insights&&<p role="status">피드백을 불러오는 중…</p>}
      {insightsError&&<p role="alert" className="feedback">{insightsError}</p>}
      {insights&&<>
        <div className="studio-metric-grid studio-feedback-metrics">
          <div><small>좋아요</small><strong>{formatNumber(insights.reviews.positive)}</strong></div>
          <div><small>아쉬워요</small><strong>{formatNumber(insights.reviews.negative)}</strong></div>
          <div><small>긍정 평가 비율</small><strong>{insights.reviews.total>=5?
            formatPercent(insights.reviews.positive/insights.reviews.total):"평가 더 필요"}</strong></div>
          <div><small>신고 접수 (집계)</small><strong>{formatNumber(insights.reports.total)}</strong></div>
        </div>
        <div className="studio-rating-trend">
          <h3>최근 평가 추이</h3>
          <p className="muted">평가의 마지막 저장일을 기준으로 해요. 현재 평가만 집계하며 과거 스냅샷은 아니에요.</p>
          {([["최근 7일",insights.reviews.trend.last7Days],["그 전 7일",insights.reviews.trend.previous7Days]] as const)
            .map(([label,period])=><div key={label} className="studio-rating-period">
              <strong>{label}</strong><span>👍 {period.positive} · 👎 {period.negative}</span>
              <span>{period.positive+period.negative>=5?
                formatPercent(period.positive/(period.positive+period.negative)):"평가 적음"}</span>
            </div>)}
        </div>
        {insights.reports.byReason.length>0&&<div className="studio-report-summary">
          <h3>접수된 문제 유형</h3>
          <div className="studio-tags">{insights.reports.byReason.map(r=>
            <span key={r.reason}>{reportNames[r.reason]||r.reason} · {formatNumber(r.count)}</span>)}</div>
          <p className="muted">신고 건수는 문제 안전성 판정이나 제재 여부를 의미하지 않습니다.</p>
        </div>}
        <h3>최근 리뷰</h3>
        {!insights.reviews.items.length?<p className="studio-empty">아직 남겨진 리뷰가 없어요.</p>:
          <div className="studio-review-list">{insights.reviews.items.map(r=><article key={r.id}>
            <div><strong>{r.rating===1?"👍 좋아요":"👎 아쉬워요"}</strong>
              <small>{r.author.displayName} · {new Date(r.createdAt).toLocaleDateString("ko-NZ")}</small></div>
            <p>{r.comment||"텍스트 리뷰 없이 평가를 남겼습니다."}</p>
          </article>)}</div>}
        {insights.reviews.total>REVIEW_PAGE_SIZE&&<nav className="media-pagination" aria-label="리뷰 페이지">
          <button type="button" className="btn btn-outline" disabled={feedbackPage===0||insightsLoading}
            onClick={()=>setFeedbackPage(p=>p-1)}>이전</button>
          <span>{feedbackPage+1} / {Math.max(1,Math.ceil(insights.reviews.total/REVIEW_PAGE_SIZE))}</span>
          <button type="button" className="btn btn-outline" disabled={!insights.reviews.hasMore||insightsLoading}
            onClick={()=>setFeedbackPage(p=>p+1)}>다음</button>
        </nav>}
      </>}
    </section>}
  </div>;
}
