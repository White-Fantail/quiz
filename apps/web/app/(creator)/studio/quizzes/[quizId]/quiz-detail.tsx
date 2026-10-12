"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import TranslationManager from "./translation-manager";
import { useLocale } from "../../../../../src/i18n/provider";
import { localizeHref } from "../../../../../src/i18n/core";
import { bilingual } from "../../../../../src/i18n/view-copy";

type Topic = { name:string; isSpoiler?:boolean };
type VisualClue = {type:string;mediaId?:string;text?:string;reveal?:{effect:"blur"|"zoom"|"spotlight";strength:number;focusX?:number;focusY?:number}};
type AgeRange = { minimum?:number; maximum?:number };
type Quiz = {
  id:string;title:string;prompt:string;version:number;publication:string;locale?:string;
  safetyStatus:string;kidsEligible:boolean;kidsReviewStatus:string;answerType:string;topics:Topic[];clues:VisualClue[];
  creatorIntent?:{ageRange?:AgeRange;note?:string}|null;
  recommendedAudience?:{ageRange?:AgeRange;difficulty?:string}|null;
};
type Feedback = { id:string;rating:number;comment:string;locale?:string;createdAt:string;author:{displayName:string} };
type Insights = {
  started:number;completed:number;solved:number;failed:number;inProgressOrAbandoned:number;
  locale:string;languages:{locale:string;started:number;completed:number;solved:number;failed:number;successRate:number|null}[];
  translationQuality?:{positive:number;negative:number};
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
type Tab = "metadata"|"visual"|"results"|"feedback"|"languages";
const REVIEW_PAGE_SIZE=10;
const answerTypes=["person","animal","place","thing","event","concept","other"];
const publicationNames:Record<string,[string,string]>={DRAFT:["Draft","초안"],PUBLISHED:["Published","공개"],HIDDEN:["Hidden","숨김"]};
const safetyNames:Record<string,[string,string]>={ACTIVE:["Active","정상 공개"],RESTRICTED:["Restricted","제한됨"]};
const reportNames:Record<string,[string,string]>={
  WRONG_ANSWER:["Incorrect answer","정답 오류"],WRONG_CLUE:["Incorrect clue","단서 오류"],UNSAFE:["Unsafe content","부적절한 콘텐츠"],
  COPYRIGHT:["Copyright","저작권"],PRIVACY:["Privacy","개인정보"],SPAM:["Spam","스팸"],DUPLICATE:["Duplicate","중복"]
};
function formatPercent(ratio:number|null){return ratio===null?"—":Math.round(ratio*100)+"%";}
function formatNumber(number:number,locale:"en"|"ko"="en"){return number.toLocaleString(locale==="ko"?"ko-KR":"en-NZ");}
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
async function api(path:string,method="GET",body?:object,locale:"en"|"ko"="en"):Promise<any>{
  const res=await fetch("/api/v1"+path,{method,credentials:"same-origin",cache:"no-store",
    headers:body?{"Content-Type":"application/json"}:undefined,body:body?JSON.stringify(body):undefined});
  const data=await res.json().catch(()=>({}));
  if(!res.ok)throw new Error(data.message||data.error||bilingual(locale,"Couldn't process the request.","요청을 처리하지 못했어요."));
  return data.data;
}
function validateAge(min:string,max:string,locale:"en"|"ko"):AgeRange{
  const msg=(en:string,ko:string)=>bilingual(locale,en,ko);
  const age:AgeRange={};
  if(min!=="")age.minimum=Number(min);
  if(max!=="")age.maximum=Number(max);
  if(Object.values(age).some(n=>!Number.isInteger(n)||n<0||n>120))
    throw new Error(bilingual(locale,"Age must be a whole number from 0 to 120.","연령은 0~120 사이의 정수로 입력해 주세요."));
  if(age.minimum!==undefined&&age.maximum!==undefined&&age.minimum>age.maximum)
    throw new Error(bilingual(locale,"Minimum age cannot exceed maximum age.","최소 연령은 최대 연령보다 클 수 없어요."));
  return age;
}

export default function StudioQuizDetail({quizId,backHref}:{quizId:string;backHref:string}){
  const locale=useLocale();
  const inListContext=(path:string)=>{const query=backHref.split("?")[1];return localizeHref(path,locale)+(query?"?"+query:"");};
  const msg=(en:string,ko:string)=>bilingual(locale,en,ko);
  const request=(path:string,method="GET",body?:object)=>api(path,method,body,locale);
  const stateLabel=(names:Record<string,[string,string]>,value:string)=>names[value]?msg(...names[value]):value;
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
  const [insightLocale,setInsightLocale]=useState<"all"|"en"|"ko"|"und">("all");
  const [feedbackRefresh,setFeedbackRefresh]=useState(0);
  const [saving,setSaving]=useState(false);
  const [notice,setNotice]=useState("");
  const [imageSource,setImageSource]=useState("");
  const [effect,setEffect]=useState<"blur"|"zoom"|"spotlight">("blur");
  const [stages,setStages]=useState(3);
  const [focusX,setFocusX]=useState(50);
  const [focusY,setFocusY]=useState(50);
  const [error,setError]=useState("");
  useEffect(()=>{
    let active=true;setLoading(true);setLoadError("");
    void request("/quizzes/"+encodeURIComponent(quizId)).then((q:Quiz)=>{
      if(active){setQuiz(q);const values=formFromQuiz(q);setForm(values);setOriginal(values);
        setImageSource(q.clues?.find(c=>c.mediaId&&(c.type==="image"||c.type==="image-reveal"))?.mediaId??"");}
    }).catch(e=>{if(active)setLoadError(e instanceof Error?e.message:msg("Could not load the quiz.","문제를 불러오지 못했어요."));})
      .finally(()=>{if(active)setLoading(false);});
    return ()=>{active=false;};
  },[quizId,refresh]);
  useEffect(()=>{
    let active=true;setInsightsLoading(true);setInsightsError("");
    const params=new URLSearchParams({limit:String(REVIEW_PAGE_SIZE),offset:String(feedbackPage*REVIEW_PAGE_SIZE),locale:insightLocale});
    void request("/me/quizzes/"+encodeURIComponent(quizId)+"/insights?"+params.toString())
      .then((data:Insights)=>{if(active)setInsights(data);})
      .catch(e=>{if(active)setInsightsError(e instanceof Error?e.message:msg("Could not load statistics and reviews.","통계와 리뷰를 가져오지 못했어요."));})
      .finally(()=>{if(active)setInsightsLoading(false);});
    return ()=>{active=false;};
  },[quizId,feedbackPage,feedbackRefresh,insightLocale]);

  function change<K extends keyof FormValues>(key:K,value:FormValues[K]){
    setForm(previous=>previous?{...previous,[key]:value}:previous);
  }
  const dirty=!!form&&!!original&&JSON.stringify(form)!==JSON.stringify(original);
  async function save(event:React.FormEvent<HTMLFormElement>){
    event.preventDefault();
    if(!quiz||!form||!dirty||saving)return;
    setNotice("");setError("");
    try{
      const creatorAge=validateAge(form.creatorMin,form.creatorMax,locale);
      const suggestedAge=validateAge(form.suggestedMin,form.suggestedMax,locale);
      const names=form.topics.split(",").map(t=>t.trim()).filter(Boolean);
      if(names.length>12)throw new Error(msg("You can add up to 12 topics.","주제는 최대 12개까지 입력할 수 있어요."));
      const oldTopics=new Map(quiz.topics.map(t=>[t.name.toLocaleLowerCase(),t.isSpoiler===true]));
      const topics=names.map(name=>({name,isSpoiler:oldTopics.get(name.toLocaleLowerCase())??false}));
      if(quiz.publication==="PUBLISHED"&&!window.confirm(
        msg("Editing creates a new revision and requires Kids re-review; general publication remains active.","수정 시 새 버전이 생성되고 Kids 승인은 재심사가 필요하지만 일반 공개는 유지됩니다.")
      ))return;
      setSaving(true);
      const q:Quiz=await request("/quizzes/"+encodeURIComponent(quiz.id),"PATCH",{
        expectedVersion:quiz.version,
        title:form.title,prompt:form.prompt,answerType:form.answerType,topics,
        creatorIntent:{ageRange:creatorAge,note:form.creatorNote},
        recommendedAudience:{ageRange:suggestedAge,...(form.difficulty?{difficulty:form.difficulty}:{})}
      });
      setQuiz(q);const values=formFromQuiz(q);setForm(values);setOriginal(values);
      setNotice(msg("Saved as a new revision. General publication continues; Kids re-review may be needed.","새 버전으로 저장했습니다. 일반 공개는 유지되며 Kids 재심사가 필요할 수 있습니다."));
      setFeedbackPage(0);setFeedbackRefresh(n=>n+1);
    }catch(e){
      setError(e instanceof Error?e.message:msg("Could not save. Refresh to check the latest version.","저장하지 못했어요. 최신 버전을 확인해 주세요."));
    }finally{setSaving(false);}
  }
  async function saveImageReveal(){
    if(!quiz||saving||dirty)return;
    const images=quiz.clues.filter(c=>c.type==="image"||c.type==="image-reveal");
    const firstIndex=quiz.clues.findIndex(c=>c.type==="image"||c.type==="image-reveal");
    if(!images.length||!imageSource||firstIndex<0)return;
    const visualStages=Array.from({length:stages},(_,i)=>({
      type:"image-reveal",mediaId:imageSource,
      ...(images[i]?.text?{text:images[i].text}:{}),
      reveal:{effect,strength:Math.round(95*(stages-1-i)/(stages-1)),focusX,focusY}
    }));
    const next:VisualClue[]=quiz.clues.flatMap((clue,i)=>i===firstIndex?visualStages:
      (clue.type==="image"||clue.type==="image-reveal")?[]:[clue]);
    if(next.length>15){setError(msg("A quiz supports at most 15 clues. Reduce the reveal steps.","단서는 최대 15개까지 가능해요. 이미지 공개 단계를 줄여 주세요."));return;}
    if(!window.confirm(msg("Replace the image clues with one original image and "+stages+" reveal stages? This creates a new revision and resets safety/Kids approval.","기존 이미지 단서를 한 장의 원본과 "+stages+"단계 공개 효과로 변경할까요? 새 버전이 생성되며 안전 검토와 Kids 승인이 초기화됩니다.")))return;
    setSaving(true);setError("");setNotice("");
    try{
      const updated:Quiz=await request("/quizzes/"+encodeURIComponent(quiz.id),"PATCH",{
        expectedVersion:quiz.version,clues:next
      });
      setQuiz(updated);const values=formFromQuiz(updated);setForm(values);setOriginal(values);
      setNotice(msg("Image Reveal saved. Use Test play to check every stage.","이미지 공개 단서를 저장했어요. 테스트 플레이에서 각 단계를 확인하세요."));
      setFeedbackRefresh(n=>n+1);
    }catch(e){setError(e instanceof Error?e.message:msg("Could not update image clues.","이미지 단서를 수정하지 못했어요."));}
    finally{setSaving(false);}
  }
  async function confirmOriginalLanguage(locale:"en"|"ko") {
    if (!quiz || quiz.locale!=="und" || saving) return;
    const label = locale==="en" ? "English" : "한국어";
    if(!window.confirm(msg("Have you verified the question, answer and clues were originally written in "+label+"? This only assigns a language; it does not translate.","이 문제의 질문, 정답, 단서가 실제로 "+label+"로 작성되었는지 확인했나요? 번역은 하지 않고 원본 언어만 지정합니다."))) return;
    setSaving(true);setError("");setNotice("");
    try {
      await request("/quizzes/"+encodeURIComponent(quiz.id)+"/language","POST",{locale,confirm:true});
      setNotice(msg("Original language confirmed. This quiz can now appear in the chosen language.","원본 언어를 확인했습니다. 선택한 언어의 퀴즈 목록에 표시될 수 있습니다."));
      setRefresh(v=>v+1);
    } catch(e) { setError(e instanceof Error?e.message:msg("Could not save the original language.","원본 언어를 저장하지 못했습니다.")); }
    finally { setSaving(false); }
  }
  async function requestKids(requested:boolean){
    if(!quiz||saving)return;
    if(!window.confirm(requested
      ? msg("Request a Kids safety review? General visibility remains unchanged.","어린이용 안전 심사를 신청할까요? 일반 공개는 유지됩니다.")
      : msg("Withdraw Kids visibility or application? General visibility remains unchanged.","어린이용 승인 또는 신청을 철회할까요? 일반 공개는 유지됩니다.")))return;
    setSaving(true);setError("");setNotice("");
    try{
      const updated=await request("/quizzes/"+encodeURIComponent(quiz.id)+"/kids-request","POST",{requested});
      setQuiz(old=>old?{...old,...updated}:old);
      setNotice(requested?msg("Kids review requested; staff approval is required.","어린이용 심사를 신청했습니다. 관리자 승인 후 노출됩니다."):
        msg("Kids request/approval withdrawn.","어린이용 신청 및 승인을 철회했습니다."));
    }catch(e){setError(e instanceof Error?e.message:msg("Could not change Kids application.","어린이용 신청을 변경하지 못했습니다."));}
    finally{setSaving(false);}
  }
  async function publish(){
    if(!quiz||saving||!window.confirm(msg("Publish this quiz? Kids visibility still requires a separate safety review.","이 퀴즈를 공개할까요? 공개 후에도 Kids 노출에는 별도 검토가 필요합니다.")))return;
    setSaving(true);setNotice("");setError("");
    try{
      await request("/quizzes/"+encodeURIComponent(quiz.id)+"/publish","POST",{confirm:true});
      setNotice(msg("Publish request applied. Kids visibility depends on platform safety review.","공개 요청이 반영됐어요. Kids 노출 여부는 플랫폼 안전 검토에 따라 결정됩니다."));
      setRefresh(n=>n+1);
    }catch(e){setError(e instanceof Error?e.message:msg("Could not publish the quiz.","공개하지 못했어요."));}
    finally{setSaving(false);}
  }
  if(loading)return <div className="studio-empty" role="status">{msg("Loading quiz details…","문제 정보를 불러오는 중…")}</div>;
  if(loadError||insightsError)return <div className="studio-empty" role="alert">
    <h1>{msg("Could not manage this quiz","문제를 관리할 수 없어요")}</h1><p>{loadError||insightsError}</p>
    <Link href={backHref} className="btn btn-outline">{msg("Back to my quizzes","내 목록으로 돌아가기")}</Link>
  </div>;
  if(!quiz||!form)return <div className="studio-empty">{msg("Quiz not found.","문제를 찾을 수 없어요.")}</div>;
  return <div className="studio-detail-workspace">
    <div className="studio-detail-head">
      <div>
        <h1>{quiz.title}</h1>
        <p className="muted">v{quiz.version}{msg(" · Manage metadata, results and player feedback in one place."," · 문제 메타정보, 이용 결과, 사용자 반응을 한곳에서 관리하세요.")}</p>
        {quiz.locale==="und" && <div className="feedback" role="group" aria-label={msg("Confirm source language","원본 언어 확인")}>
          <p>{msg("This older quiz has no assigned language. Confirm its original language; no translation will be performed.","언어가 미분류된 기존 퀴즈입니다. 질문과 단서의 원본 언어를 확인해 주세요. 자동 번역은 하지 않습니다.")}</p>
          <div className="actions">
            <button type="button" className="btn btn-outline" disabled={saving} onClick={()=>void confirmOriginalLanguage("en")}>{msg("Original English","English 원본")}</button>
            <button type="button" className="btn btn-outline" disabled={saving} onClick={()=>void confirmOriginalLanguage("ko")}>{msg("Original Korean","한국어 원본")}</button>
          </div>
        </div>}
        <div className="studio-chip-row">
          <span className="media-state-chip media-wait">{stateLabel(publicationNames,quiz.publication)}</span>
          <span className={"media-state-chip "+(quiz.safetyStatus==="RESTRICTED"?"media-blocked":"media-ok")}>{stateLabel(safetyNames,quiz.safetyStatus)}</span>
          <span className={"media-state-chip "+(quiz.kidsEligible?"media-ok":"media-wait")}>Kids {quiz.kidsEligible?msg("approved","승인"):quiz.kidsReviewStatus==="REQUESTED"?msg("requested","신청 중"):quiz.kidsReviewStatus==="REJECTED"?msg("rejected","반려"):msg("not requested","미신청")}</span>
        </div>
      </div>
      <div className="actions">
        <Link className="btn btn-primary" href={inListContext("/studio/quizzes/"+quiz.id+"/edit")}>{msg("Edit question & clues","문제 · 단서 편집")}</Link>
        {quiz.publication!=="PUBLISHED"&&quiz.safetyStatus!=="RESTRICTED"&&<button type="button"
          className="btn btn-primary" disabled={saving||dirty} onClick={()=>void publish()}>{msg("Publish quiz","퀴즈 공개하기")}</button>}
        <Link href={inListContext("/studio/quizzes/"+quiz.id+"/preview")} className="btn btn-primary">
          {msg("Test play (no records)","테스트 플레이 (기록 없음)")}
        </Link>
        {quiz.publication==="PUBLISHED"&&quiz.safetyStatus!=="RESTRICTED"&&
          <Link href={localizeHref("/play/"+quiz.id,locale)} className="btn btn-outline">
            {msg("Live play (records a result)","실제 플레이 (기록됨)")}
          </Link>}
      </div>
    </div>
    {dirty&&<p className="muted">{msg("You have unsaved changes. Save them before publishing.","저장하지 않은 수정 사항이 있어요. 공개하기 전에 저장해 주세요.")}</p>}
    {error&&<p className="feedback" role="alert">{error}</p>}
    {notice&&<p className="feedback success" role="status">{notice}</p>}
    <nav className="studio-tabs" aria-label={msg("Quiz management menu","문제 관리 메뉴")}>
      <button type="button" className={tab==="metadata"?"active":""} aria-current={tab==="metadata"?"page":undefined}
        onClick={()=>setTab("metadata")}>{msg("Edit details","정보 수정")}</button>
      <button type="button" className={tab==="visual"?"active":""} aria-current={tab==="visual"?"page":undefined}
        onClick={()=>setTab("visual")}>{msg("Image Reveal","이미지 공개 효과")}</button>
      <button type="button" className={tab==="results"?"active":""} aria-current={tab==="results"?"page":undefined}
        onClick={()=>setTab("results")}>{msg("Play results","풀이 결과")}</button>
      <button type="button" className={tab==="feedback"?"active":""} aria-current={tab==="feedback"?"page":undefined}
        onClick={()=>setTab("feedback")}>{msg("User feedback ","사용자 피드백 ")}{insights?"("+formatNumber(insights.reviews.total)+")":""}</button>
      <button type="button" className={tab==="languages"?"active":""} aria-current={tab==="languages"?"page":undefined}
        onClick={()=>setTab("languages")}>{msg("Language versions","언어 버전 / Languages")}</button>
    </nav>

    {tab==="languages"&&<TranslationManager quizId={quizId}/>}
    {tab==="metadata"&&<section className="placeholder-panel">
      <h2>{msg("Kids app visibility · optional","Kids 앱 노출 · 선택 사항")}</h2>
      <p className="muted">{msg("General quizzes need no approval. Only creator-requested quizzes enter the Kids review queue.","일반 문제는 승인이 필요하지 않습니다. 제작자가 신청한 문제만 Kids 심사에 들어갑니다.")}</p>
      <p>{msg("Current Kids status","어린이용 상태")}: <strong>{quiz.kidsEligible?msg("Approved","승인됨"):quiz.kidsReviewStatus==="REQUESTED"?msg("Requested · waiting for staff","관리자 승인 대기"):quiz.kidsReviewStatus==="REJECTED"?msg("Rejected · may reapply","반려 · 재신청 가능"):msg("Not requested","미신청")}</strong></p>
      {quiz.kidsReviewStatus!=="NOT_REQUESTED"&&<button className="btn btn-outline" type="button" disabled={saving}
        onClick={()=>void requestKids(false)}>{msg("Withdraw Kids request / access","어린이용 신청 / 승인 철회")}</button>}
      {(quiz.kidsReviewStatus==="NOT_REQUESTED"||quiz.kidsReviewStatus==="REJECTED")&&
        <button className="btn btn-primary" type="button" disabled={saving||quiz.safetyStatus==="RESTRICTED"}
          onClick={()=>void requestKids(true)}>{quiz.kidsReviewStatus==="REJECTED"?msg("Request review again","다시 심사 신청"):msg("Request Kids review","어린이용 심사 신청")}</button>}
    </section>}
    {tab==="metadata"&&<form className="studio-meta-form" onSubmit={e=>void save(e)}>
      <section className="placeholder-panel">
        <h2>{msg("Basic information","기본 정보")}</h2>
        <div className="studio-form-grid">
          <label className="studio-wide">{msg("Quiz title","퀴즈 제목")}
            <input value={form.title} onChange={e=>change("title",e.target.value)} maxLength={180} required/>
          </label>
          <label className="studio-wide">{msg("Question","질문")}
            <textarea value={form.prompt} onChange={e=>change("prompt",e.target.value)} maxLength={2000} rows={3} required/>
          </label>
          <label>{msg("Answer type","정답 유형")}
            <select value={form.answerType} onChange={e=>change("answerType",e.target.value)}>
              {answerTypes.map(t=><option key={t} value={t}>{t}</option>)}
            </select>
          </label>
          <label className="studio-wide">{msg("Topics · comma-separated","주제 · 쉼표로 구분")}
            <input value={form.topics} onChange={e=>change("topics",e.target.value)}
              placeholder={msg("e.g. New Zealand, Geography, Cities","예: New Zealand, Geography, Cities")}/>
          </label>
          <p className="studio-wide muted">{msg("Existing private topics are preserved. Topics revealing the answer are automatically hidden.","기존 비공개 주제 설정은 유지됩니다. 정답을 드러내는 주제는 시스템에서 자동으로 숨깁니다.")}</p>
        </div>
      </section>
      <section className="placeholder-panel">
        <h2>{msg("Audience and difficulty","대상과 난이도")}</h2>
        <p className="muted">{msg("You can change your intended audience and request Kids review; only staff can approve Kids exposure.","권장 대상과 어린이용 심사 신청은 변경할 수 있지만 Kids 승인은 관리자만 할 수 있습니다.")}</p>
        <div className="studio-form-grid">
          <h3 className="studio-wide">{msg("Creator's intended audience","제작자가 생각하는 대상")}</h3>
          <label>{msg("Minimum age","최소 나이")}
            <input type="number" min={0} max={120} step={1} value={form.creatorMin} onChange={e=>change("creatorMin",e.target.value)} placeholder={msg("Optional","선택 사항")}/>
          </label>
          <label>{msg("Maximum age","최대 나이")}
            <input type="number" min={0} max={120} step={1} value={form.creatorMax} onChange={e=>change("creatorMax",e.target.value)} placeholder={msg("Optional","선택 사항")}/>
          </label>
          <label className="studio-wide">{msg("Creator note","제작자 메모")}
            <textarea rows={2} maxLength={400} value={form.creatorNote} onChange={e=>change("creatorNote",e.target.value)} placeholder={msg("Who is this quiz for?","이 문제를 누구에게 추천하고 싶나요?")}/>
          </label>
          <h3 className="studio-wide">{msg("Recommended audience · editable","추천 대상 · 수정 가능")}</h3>
          <label>{msg("Recommended minimum age","추천 최소 나이")}
            <input type="number" min={0} max={120} step={1} value={form.suggestedMin} onChange={e=>change("suggestedMin",e.target.value)} placeholder={msg("Auto-recommended or enter your own","자동 추천 또는 직접 입력")}/>
          </label>
          <label>{msg("Recommended maximum age","추천 최대 나이")}
            <input type="number" min={0} max={120} step={1} value={form.suggestedMax} onChange={e=>change("suggestedMax",e.target.value)} placeholder={msg("Optional","선택 사항")}/>
          </label>
          <label>{msg("Recommended difficulty","추천 난이도")}
            <select value={form.difficulty} onChange={e=>change("difficulty",e.target.value)}>
              <option value="">{msg("Not specified","지정 안 함")}</option><option value="easy">{msg("Easy","쉬움")}</option>
              <option value="medium">{msg("Medium","보통")}</option><option value="hard">{msg("Hard","어려움")}</option>
            </select>
          </label>
        </div>
      </section>
      <div className="studio-save-bar">
        <p className="muted">{msg("Saving creates a new revision, requiring Kids re-review if previously approved. General visibility stays active. Use the separate editor to change the question, answer and clues.","저장하면 새 버전이 생성되어 기존 Kids 승인은 재심사가 필요합니다. 일반 공개는 유지됩니다. 질문·정답·단서는 별도 편집 페이지에서 수정할 수 있어요.")}</p>
        <div className="actions">
          <button type="button" className="btn btn-outline" disabled={!dirty||saving} onClick={()=>{if(original)setForm({...original});}}>{msg("Discard changes","변경 취소")}</button>
          <button className="btn btn-primary" type="submit" disabled={!dirty||saving}>{saving?msg("Saving…","저장 중…"):msg("Save changes","변경사항 저장")}</button>
        </div>
      </div>
    </form>}

    {tab==="visual"&&<section className="placeholder-panel studio-reveal-editor">
      <h2>{msg("Progressive Image Reveal","이미지 한 장으로 단계별 공개")}</h2>
      <p className="muted">{msg("Choose an existing image clue as the original. Blur, Zoom or Spotlight is applied at play time in web and Kids. No duplicate images are created.",
        "기존 이미지 단서 중 원본 한 장을 선택하세요. 웹과 Kids 앱에서 블러·확대·스포트라이트를 적용하므로 이미지를 여러 장 만들 필요가 없어요.")}</p>
      {!quiz.clues.some(c=>c.type==="image"||c.type==="image-reveal")?
        <p className="muted">{msg("Add an image clue using the media library or API first.","먼저 미디어 라이브러리 또는 API에서 이미지 단서를 등록해 주세요.")}</p>:
        <div className="studio-form-grid">
          <label className="studio-wide">{msg("Source image","원본 이미지")}
            <select value={imageSource} onChange={e=>setImageSource(e.target.value)}>
              {[...new Map(quiz.clues.filter(c=>c.mediaId&&(c.type==="image"||c.type==="image-reveal"))
                .map((c,i)=>[c.mediaId!,{id:c.mediaId!,text:c.text||"Image "+(i+1)}])).values()].map(item=>
                <option key={item.id} value={item.id}>{item.text.slice(0,70)}</option>)}
            </select>
          </label>
          <label>{msg("Reveal effect","공개 효과")}
            <select value={effect} onChange={e=>setEffect(e.target.value as "blur"|"zoom"|"spotlight")}>
              <option value="blur">{msg("Blur → Clear","흐림 → 선명")}</option>
              <option value="zoom">{msg("Zoom out → Full","부분 확대 → 전체")}</option>
              <option value="spotlight">{msg("Spotlight → Full","작은 영역 → 전체")}</option>
            </select>
          </label>
          <label>{msg("Image stages","이미지 공개 단계")}
            <select value={stages} onChange={e=>setStages(Number(e.target.value))}>
              {[2,3,4,5].map(count=><option key={count} value={count}>{count}</option>)}
            </select>
          </label>
          {effect!=="blur"&&<>
            <label>{msg("Focus X (%)","중심 X (%)")}
              <input type="number" min={0} max={100} value={focusX} onChange={e=>setFocusX(Math.max(0,Math.min(100,Number(e.target.value))))}/>
            </label>
            <label>{msg("Focus Y (%)","중심 Y (%)")}
              <input type="number" min={0} max={100} value={focusY} onChange={e=>setFocusY(Math.max(0,Math.min(100,Number(e.target.value))))}/>
            </label>
          </>}
          <p className="studio-wide muted">{msg("Preview strengths: ","단계별 공개 강도: ")}
            {Array.from({length:stages},(_,i)=>Math.round(95*(stages-1-i)/(stages-1))).join(" → ")}
            {msg(" (0 is the fully revealed image). All existing image clues are replaced; text and other media clues remain.",
              " (0은 완전 공개). 기존 이미지 단서는 모두 대체되며 텍스트 등 다른 단서는 유지됩니다.")}</p>
          <div className="studio-wide actions">
            <button type="button" className="btn btn-primary" disabled={saving||dirty||!imageSource}
              onClick={()=>void saveImageReveal()}>{saving?msg("Saving…","저장 중…"):msg("Create Image Reveal","이미지 공개 단서 만들기")}</button>
            <Link className="btn btn-outline" href={inListContext("/studio/quizzes/"+quiz.id+"/preview")}>
              {msg("Test play","테스트 플레이")}
            </Link>
          </div>
          {dirty&&<p className="studio-wide muted">{msg("Save or discard metadata changes first.","먼저 정보 수정 내용을 저장하거나 취소해 주세요.")}</p>}
        </div>}
    </section>}
    {(tab==="results"||tab==="feedback")&&<section className="studio-locale-filter">
      <label>{msg("Analysis language","분석 언어")}
        <select value={insightLocale} onChange={e=>{setInsightLocale(e.target.value as "all"|"en"|"ko"|"und");setFeedbackPage(0);}}>
          <option value="all">{msg("All languages","전체 언어")}</option><option value="ko">한국어</option>
          <option value="en">English</option><option value="und">{msg("Unclassified legacy records","미분류 과거 기록")}</option>
        </select>
      </label>
      <p className="muted">{msg("Ratings and success rates follow the selected language; older unclassified data is not assigned to a language.","평가와 성공률은 선택한 언어 기준이며, 과거 언어 미분류 자료는 임의 배정하지 않습니다.")}</p>
    </section>}
    {tab==="results"&&<section className="studio-results">
      <h2>{insightLocale==="all"?msg("All language results","언어별 전체 풀이 결과"):msg("Results · ","풀이 결과 · ")+(insightLocale==="ko"?"한국어":insightLocale==="en"?"English":msg("Unclassified","미분류"))}</h2>
      <p className="muted">{msg("Play statistics include earlier revisions. Incomplete and abandoned attempts are excluded from success rates.","퀴즈가 수정되기 전의 풀이도 합산합니다. 진행 중이거나 이탈한 플레이는 정답률 계산에서 제외됩니다.")}</p>
      {insightsLoading&&!insights&&<p role="status">{msg("Loading statistics…","통계를 불러오는 중…")}</p>}
      {insightsError&&<p role="alert" className="feedback">{insightsError}</p>}
      {insights&&<><div className="studio-metric-grid">
        <div><small>{msg("Starts","시작한 횟수")}</small><strong>{formatNumber(insights.started)}</strong></div>
        <div><small>{msg("Completed","완료한 횟수")}</small><strong>{formatNumber(insights.completed)}</strong></div>
        <div><small>{msg("Completion rate","완료율")}</small><strong>{formatPercent(insights.completionRate)}</strong></div>
        <div><small>{msg("Success rate","정답률")}</small><strong>{formatPercent(insights.successRate)}</strong></div>
      </div>
      <div className="studio-results-columns">
        <div className="placeholder-panel"><h3>{msg("Play activity","풀이 현황")}</h3>
          <p>{msg("Correct ","정답 ")}{formatNumber(insights.solved,locale)}{msg(" · Incorrect ","회 · 오답 ")}{formatNumber(insights.failed,locale)}{msg(" attempts","회")}</p>
          <p>{msg("Unfinished ","미완료 ")}{formatNumber(insights.inProgressOrAbandoned,locale)}{msg(" attempts","회")}</p>
          <p>{msg("Average clues used: ","평균 사용 단서 수: ")}<strong>{insights.averageCluesUsed===null?"—":insights.averageCluesUsed.toFixed(1)}</strong></p>
        </div>
        <div className="placeholder-panel"><h3>{msg("At which clue do players solve it?","몇 번째 단서에서 맞혔을까?")}</h3>
          {!insights.correctByClueStage.length?<p className="muted">{msg("No correct answers yet.","정답 데이터가 아직 없어요.")}</p>:
          <ul className="studio-clue-stages">{insights.correctByClueStage.map(s=><li key={s.stage}>
            <span>{msg("Clue ","")}{s.stage}{msg("","번째")}</span><div><span style={{width:(s.correct/Math.max(...insights.correctByClueStage.map(c=>c.correct))*100)+"%"}}/></div><b>{formatNumber(s.correct)}</b>
          </li>)}</ul>}
        </div>
      </div>
      <h3>{msg("Success rates by language","언어별 정답률")}</h3>
      <div className="studio-metric-grid">
        {insights.languages.map(row=><div key={row.locale}>
          <small>{row.locale==="ko"?"한국어":row.locale==="en"?"English":msg("Unclassified / Legacy","미분류 / Legacy")}</small>
          <strong>{formatPercent(row.successRate)}</strong>
          <small>{msg("Completed ","풀이 ")}{formatNumber(row.completed,locale)}{msg(" / Started ","회 / 시작 ")}{formatNumber(row.started,locale)}{msg("","회")}</small>
        </div>)}
      </div></>}
    </section>}

    {tab==="feedback"&&<section className="studio-feedback">
      <h2>{msg("Player feedback","퀴즈 사용자 반응")}</h2>
      <p className="muted">{msg("Reviews are public feedback. Reports go to moderators; reporter identities and report details are not shown to creators.","리뷰는 공개된 평가이며, 문제 신고는 운영자의 검토 대상입니다. 신고자 정보와 신고 원문은 작성자에게 공개되지 않습니다.")}</p>
      {insightsLoading&&!insights&&<p role="status">{msg("Loading feedback…","피드백을 불러오는 중…")}</p>}
      {insightsError&&<p role="alert" className="feedback">{insightsError}</p>}
      {insights&&<>
        <div className="studio-metric-grid studio-feedback-metrics">
          <div><small>{msg("Likes","좋아요")}</small><strong>{formatNumber(insights.reviews.positive)}</strong></div>
          <div><small>{msg("Needs work","아쉬워요")}</small><strong>{formatNumber(insights.reviews.negative)}</strong></div>
          <div><small>{msg("Positive rating ratio","긍정 평가 비율")}</small><strong>{insights.reviews.total>=5?
            formatPercent(insights.reviews.positive/insights.reviews.total):msg("More ratings needed","평가 더 필요")}</strong></div>
          <div><small>{msg("Reports (aggregate)","신고 접수 (집계)")}</small><strong>{formatNumber(insights.reports.total)}</strong></div>
        </div>
        {insights.translationQuality&&<p className="muted">{msg("Translation quality · Likes ","번역 품질 별도 평가 · 좋아요 ")}{formatNumber(insights.translationQuality.positive,locale)}{msg(" / Needs work ","회 / 아쉬워요 ")}{formatNumber(insights.translationQuality.negative,locale)}{msg("","회")}</p>}
        <div className="studio-rating-trend">
          <h3>{msg("Recent rating trend","최근 평가 추이")}</h3>
          <p className="muted">{msg("Counts use the last update date of current ratings, not historical snapshots.","평가의 마지막 저장일을 기준으로 해요. 현재 평가만 집계하며 과거 스냅샷은 아니에요.")}</p>
          {([[(msg("Last 7 days","최근 7일")),insights.reviews.trend.last7Days],[msg("Previous 7 days","그 전 7일"),insights.reviews.trend.previous7Days]] as const)
            .map(([label,period])=><div key={label} className="studio-rating-period">
              <strong>{label}</strong><span>👍 {period.positive} · 👎 {period.negative}</span>
              <span>{period.positive+period.negative>=5?
                formatPercent(period.positive/(period.positive+period.negative)):msg("Not enough ratings","평가 적음")}</span>
            </div>)}
        </div>
        {insights.reports.byReason.length>0&&<div className="studio-report-summary">
          <h3>{msg("Reported issue categories","접수된 문제 유형")}</h3>
          <div className="studio-tags">{insights.reports.byReason.map(r=>
            <span key={r.reason}>{stateLabel(reportNames,r.reason)} · {formatNumber(r.count)}</span>)}</div>
          <p className="muted">{msg("Report counts do not determine safety decisions or penalties.","신고 건수는 문제 안전성 판정이나 제재 여부를 의미하지 않습니다.")}</p>
        </div>}
        <h3>{msg("Recent reviews","최근 리뷰")}</h3>
        {!insights.reviews.items.length?<p className="studio-empty">{msg("No reviews yet.","아직 남겨진 리뷰가 없어요.")}</p>:
          <div className="studio-review-list">{insights.reviews.items.map(r=><article key={r.id}>
            <div><strong>{r.rating===1?msg("👍 Like","👍 좋아요"):msg("👎 Needs work","👎 아쉬워요")}</strong> <small>{r.locale??"und"}</small>
              <small>{r.author.displayName} · {new Date(r.createdAt).toLocaleDateString(locale==="ko"?"ko-NZ":"en-NZ")}</small></div>
            <p>{r.comment||msg("Rating without a written review.","텍스트 리뷰 없이 평가를 남겼습니다.")}</p>
          </article>)}</div>}
        {insights.reviews.total>REVIEW_PAGE_SIZE&&<nav className="media-pagination" aria-label={msg("Review pages","리뷰 페이지")}>
          <button type="button" className="btn btn-outline" disabled={feedbackPage===0||insightsLoading}
            onClick={()=>setFeedbackPage(p=>p-1)}>{msg("Previous","이전")}</button>
          <span>{feedbackPage+1} / {Math.max(1,Math.ceil(insights.reviews.total/REVIEW_PAGE_SIZE))}</span>
          <button type="button" className="btn btn-outline" disabled={!insights.reviews.hasMore||insightsLoading}
            onClick={()=>setFeedbackPage(p=>p+1)}>{msg("Next","다음")}</button>
        </nav>}
      </>}
    </section>}
  </div>;
}
