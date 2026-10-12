"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale } from "../../../../src/i18n/provider";
import { localizeHref } from "../../../../src/i18n/core";
import { bilingual } from "../../../../src/i18n/view-copy";
import MediaPicker from "./quiz-media-picker";

type ClueType = "text" | "image" | "audio" | "video" | "image-reveal" | "map";
type Reveal = { effect:"blur"|"zoom"|"spotlight"; strength:number;focusX:number;focusY:number };
type MapData = { latitude:number;longitude:number;zoom:number };
type Clue = { key:string;type:ClueType;text:string;mediaId:string;reveal:Reveal;map:MapData };
type AnswerType = "person"|"animal"|"place"|"thing"|"event"|"concept"|"other";
type Language = "ko"|"en"|"und";
type Quiz = {
  id:string; title:string;prompt:string;locale:Language;version:number;publication:string;
  safetyStatus:string;answerType:AnswerType;answer:{canonical:string;aliases:string[]};
  clues:Array<{id?:string;type:ClueType;text?:string;mediaId?:string;reveal?:Reveal;map?:MapData}>;
  topics:Array<{name:string;isSpoiler?:boolean}>;promptMediaIds?:string[];
  creatorIntent?:{ageRange?:{minimum?:number;maximum?:number};note?:string}|null;
  recommendedAudience?:{ageRange?:{minimum?:number;maximum?:number};difficulty?:string}|null;
};
type Form = {
  title:string;prompt:string;locale:Language;answerType:AnswerType;canonical:string;
  aliases:string;topics:string;clues:Clue[];creatorMin:string;creatorMax:string;creatorNote:string;
  suggestedMin:string;suggestedMax:string;difficulty:string;promptMediaIds:string[];
};
let sequence=0;
function newClue(type:ClueType="text"):Clue {
  sequence++;
  return {key:"clue-"+sequence,type,text:"",mediaId:"",
    reveal:{effect:"blur",strength:60,focusX:50,focusY:50},
    map:{latitude:0,longitude:0,zoom:10}};
}
function blankForm(locale:Language):Form {
  return {title:"",prompt:"",locale,answerType:"other",canonical:"",aliases:"",topics:"",
    clues:[newClue()],creatorMin:"",creatorMax:"",creatorNote:"",
    suggestedMin:"",suggestedMax:"",difficulty:"",promptMediaIds:[]};
}
function fromQuiz(quiz:Quiz):Form {
  return {title:quiz.title,prompt:quiz.prompt,locale:quiz.locale,answerType:quiz.answerType,
    canonical:quiz.answer.canonical,aliases:quiz.answer.aliases.join("\n"),
    topics:quiz.topics.map(t=>t.name).join(", "),
    clues:quiz.clues.map(c=>({...newClue(c.type),text:c.text??"",mediaId:c.mediaId??"",
      reveal:c.reveal?{...c.reveal}:{effect:"blur",strength:60,focusX:50,focusY:50},
      map:c.map?{latitude:c.map.latitude,longitude:c.map.longitude,zoom:c.map.zoom??10}:{latitude:0,longitude:0,zoom:10}})),
    creatorMin:quiz.creatorIntent?.ageRange?.minimum?.toString()??"",
    creatorMax:quiz.creatorIntent?.ageRange?.maximum?.toString()??"",
    creatorNote:quiz.creatorIntent?.note??"",
    suggestedMin:quiz.recommendedAudience?.ageRange?.minimum?.toString()??"",
    suggestedMax:quiz.recommendedAudience?.ageRange?.maximum?.toString()??"",
    difficulty:quiz.recommendedAudience?.difficulty??"",
    promptMediaIds:quiz.promptMediaIds??[]};
}
async function request(path:string,method="GET",body?:object) {
  const response=await fetch("/api/v1"+path,{method,cache:"no-store",credentials:"same-origin",
    headers:body?{"Content-Type":"application/json"}:undefined,body:body?JSON.stringify(body):undefined});
  const json=await response.json().catch(()=>({}));
  if(!response.ok){
    const message=json.issues?.map((issue:{path:(string|number)[];message:string})=>issue.path.join(".")+": "+issue.message).join("; ");
    throw Error(message||json.message||json.error||"Request failed");
  }
  return json.data;
}
function ageRange(min:string,max:string) {
  const range:{minimum?:number;maximum?:number}={};
  if(min.trim()!=="")range.minimum=Number(min);
  if(max.trim()!=="")range.maximum=Number(max);
  if(Object.values(range).some(n=>!Number.isInteger(n)||n<0||n>120)
    ||(range.minimum!==undefined&&range.maximum!==undefined&&range.minimum>range.maximum))
    throw Error("Age must be between 0 and 120 and minimum age must not exceed maximum.");
  return range;
}
function asPayload(form:Form,original:Quiz|null) {
  const title=form.title.trim(),prompt=form.prompt.trim(),canonical=form.canonical.trim();
  if(!title||!prompt||!canonical)throw Error("Title, question and correct answer are required.");
  if(title.length>180||prompt.length>2000||canonical.length>200)throw Error("Title, question or answer is too long.");
  const aliases=[...new Set(form.aliases.split(/[\n,]+/).map(s=>s.trim()).filter(Boolean))].filter(s=>s.toLocaleLowerCase()!==canonical.toLocaleLowerCase());
  if(aliases.length>20||aliases.some(s=>s.length>200))throw Error("Maximum 20 alternative answers, up to 200 characters each.");
  const names=[...new Set(form.topics.split(",").map(s=>s.trim()).filter(Boolean))];
  if(names.length>12||names.some(s=>s.length>80))throw Error("Maximum 12 topics, up to 80 characters each.");
  if(form.clues.length<1||form.clues.length>15)throw Error("Add between 1 and 15 clues.");
  const clues=form.clues.map((clue,i)=>{
    if(clue.type==="text"){
      if(!clue.text.trim()||clue.text.trim().length>3000)throw Error("Clue "+(i+1)+" requires text (up to 3000 characters).");
      return {type:"text" as const,text:clue.text.trim()};
    }
    if(clue.text.length>1000)throw Error("Clue "+(i+1)+" caption is too long.");
    const caption=clue.text?{text:clue.text}:{};
    if(clue.type==="map"){
      const {latitude,longitude,zoom}=clue.map;
      if(!Number.isFinite(latitude)||Math.abs(latitude)>90||!Number.isFinite(longitude)||Math.abs(longitude)>180
        ||!Number.isFinite(zoom)||zoom<1||zoom>20)throw Error("Clue "+(i+1)+" has invalid map coordinates or zoom.");
      return {type:"map" as const,map:{latitude,longitude,zoom},...caption};
    }
    if(!/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(clue.mediaId))throw Error("Select media for clue "+(i+1)+".");
    if(clue.type==="image-reveal")return {type:clue.type,mediaId:clue.mediaId,reveal:clue.reveal,...caption};
    return {type:clue.type,mediaId:clue.mediaId,...caption};
  });
  const oldTopics=new Map((original?.topics??[]).map(t=>[t.name.toLocaleLowerCase(),!!t.isSpoiler]));
  const topics=names.map(name=>({name,isSpoiler:oldTopics.get(name.toLocaleLowerCase())??false}));
  return {title,prompt,answerType:form.answerType,answer:{canonical,aliases},clues,topics,
    promptMediaIds:form.promptMediaIds,
    creatorIntent:{ageRange:ageRange(form.creatorMin,form.creatorMax),note:form.creatorNote},
    recommendedAudience:{ageRange:ageRange(form.suggestedMin,form.suggestedMax),
      ...(form.difficulty?{difficulty:form.difficulty}:{})}};
}
const clueTypes: {type:ClueType;en:string;ko:string}[]=[
  {type:"text",en:"Text",ko:"텍스트"},{type:"image",en:"Image",ko:"이미지"},
  {type:"audio",en:"Audio",ko:"소리"},{type:"video",en:"Video",ko:"영상"},
  {type:"image-reveal",en:"Image reveal",ko:"이미지 단계별 공개"},{type:"map",en:"Map",ko:"지도"}];
const answerTypes:AnswerType[]=["person","animal","place","thing","event","concept","other"];

export default function QuizEditor({quizId}:{quizId?:string}) {
  const locale=useLocale(),router=useRouter();
  const msg=(en:string,ko:string)=>bilingual(locale,en,ko);
  const [form,setForm]=useState<Form>(()=>blankForm(locale));
  const [original,setOriginal]=useState<Quiz|null>(null);
  const [initial,setInitial]=useState<string>("");
  const [loading,setLoading]=useState(!!quizId);
  const [saving,setSaving]=useState(false);
  const [error,setError]=useState("");
  const [notice,setNotice]=useState("");
  const [mediaTarget,setMediaTarget]=useState<string|null>(null);
  const [reload,setReload]=useState(0);

  useEffect(()=>{
    if(!quizId)return;
    let active=true;setLoading(true);setError("");
    void request("/quizzes/"+encodeURIComponent(quizId)).then((quiz:Quiz)=>{
      if(!active)return;
      setOriginal(quiz);
      const next=fromQuiz(quiz);setForm(next);setInitial(JSON.stringify(next));
    }).catch(e=>{if(active)setError(e instanceof Error?e.message:String(e));})
      .finally(()=>{if(active)setLoading(false);});
    return ()=>{active=false;};
  },[quizId,reload]);
  const dirty=quizId?!!initial&&JSON.stringify(form)!==initial:
    !!form.title.trim()||!!form.prompt.trim()||!!form.canonical.trim()||
    form.clues.some(c=>!!c.text.trim()||!!c.mediaId)||!!form.topics.trim();
  useEffect(()=>{
    const onBeforeUnload=(event:BeforeUnloadEvent)=>{
      if(dirty&&!saving){event.preventDefault();event.returnValue="";}
    };
    window.addEventListener("beforeunload",onBeforeUnload);
    return ()=>window.removeEventListener("beforeunload",onBeforeUnload);
  },[dirty,saving]);

  function update<K extends keyof Form>(name:K,value:Form[K]){
    setForm(s=>({...s,[name]:value}));setNotice("");
  }
  function updateClue(key:string,patch:Partial<Clue>){
    setForm(s=>({...s,clues:s.clues.map(c=>c.key===key?{...c,...patch}:c)}));setNotice("");
  }
  function moveClue(index:number,step:number){
    setForm(s=>{
      const list=[...s.clues],next=index+step;
      if(next<0||next>=list.length)return s;
      [list[index],list[next]]=[list[next],list[index]];
      return {...s,clues:list};
    });
  }
  async function save(event:React.FormEvent<HTMLFormElement>){
    event.preventDefault();
    if(loading||saving||(!dirty&&!!quizId))return;
    setError("");setNotice("");
    try{
      const body=asPayload(form,original);
      if(original?.safetyStatus==="RESTRICTED")throw Error(msg("Restricted questions cannot be edited until cleared by an administrator.","제한된 문제는 관리자 검토 후 수정할 수 있어요."));
      if(original?.publication==="PUBLISHED"&&!window.confirm(
        msg("Save a new revision? The quiz stays published, but Kids approval must be reviewed again.",
          "새 버전으로 저장할까요? 일반 공개는 유지되지만 어린이용 승인은 다시 심사받아야 합니다.")))return;
      setSaving(true);
      if(quizId&&original){
        const updated=await request("/quizzes/"+encodeURIComponent(quizId),"PATCH",{...body,expectedVersion:original.version}) as Quiz;
        const next=fromQuiz(updated);setOriginal(updated);setForm(next);setInitial(JSON.stringify(next));
        setNotice(msg("Changes saved in revision v","버전 v")+updated.version+msg(".","에 저장했어요."));
      }else{
        const created=await request("/quizzes","POST",{...body,locale:form.locale,mode:"progressive-clues"}) as Quiz;
        router.replace(localizeHref("/studio/quizzes/"+created.id+"/edit",locale));
      }
    }catch(e){setError(e instanceof Error?e.message:String(e));}
    finally{setSaving(false);}
  }
  async function publish(){
    if(!quizId||dirty||saving||original?.publication==="PUBLISHED")return;
    if(!window.confirm(msg("Publish this quiz now?","이 문제를 지금 공개할까요?")))return;
    setSaving(true);setError("");setNotice("");
    try{
      await request("/quizzes/"+encodeURIComponent(quizId)+"/publish","POST",{confirm:true});
      setNotice(msg("Quiz published.","문제를 공개했어요."));setReload(n=>n+1);
    }catch(e){setError(e instanceof Error?e.message:String(e));}
    finally{setSaving(false);}
  }

  if(loading)return <div className="studio-empty" role="status">{msg("Loading quiz editor…","문제 편집기를 불러오는 중…")}</div>;
  if(quizId&&!original)return <div className="studio-empty" role="alert"><p>{error||msg("Quiz unavailable.","문제를 불러올 수 없어요.")}</p>
    <button type="button" className="btn btn-outline" onClick={()=>setReload(n=>n+1)}>{msg("Retry","다시 시도")}</button></div>;
  return <form onSubmit={e=>void save(e)} className="studio-quiz-editor">
    <div className="studio-quiz-editor-actions">
      <span className="media-state-chip media-wait">{original?("v"+original.version+" · "+original.publication):msg("New draft","새 초안")}</span>
      {original&&<>
        <Link className="btn btn-outline" href={localizeHref("/studio/quizzes/"+original.id+"/preview",locale)}>{msg("Test play","테스트 플레이")}</Link>
        <Link className="btn btn-outline" href={localizeHref("/studio/quizzes/"+original.id,locale)}>{msg("Results · Kids review","통계 · Kids 심사")}</Link>
      </>}
    </div>
    <section className="placeholder-panel">
      <h2>{msg("Question and answer","질문과 정답")}</h2>
      <p className="muted">{msg("Write the question players will see. The correct answer is never displayed before the game ends.",
        "플레이어가 볼 질문을 작성하세요. 정답은 풀이 중에 미리 공개되지 않습니다.")}</p>
      <div className="studio-form-grid">
        <label className="studio-wide">{msg("Quiz title","문제 제목")}
          <input required maxLength={180} value={form.title} onChange={e=>update("title",e.target.value)} placeholder={msg("e.g. Name this animal","예: 이 동물은 누구일까요?")}/>
        </label>
        <label className="studio-wide">{msg("Question / description","질문 / 설명")}
          <textarea required maxLength={2000} rows={3} value={form.prompt} onChange={e=>update("prompt",e.target.value)} placeholder={msg("What should the player guess?","무엇을 맞혀야 하는지 설명해 주세요.")}/>
        </label>
        <label>{msg("Original language","원본 언어")}
          <select value={form.locale} disabled={!!quizId} onChange={e=>update("locale",e.target.value as Language)}>
            <option value="ko">한국어</option><option value="en">English</option>
            {form.locale==="und"&&<option value="und">{msg("Unclassified","미분류")}</option>}
          </select>
        </label>
        <label>{msg("Answer category","정답 유형")}
          <select value={form.answerType} onChange={e=>update("answerType",e.target.value as AnswerType)}>
            {answerTypes.map(type=><option value={type} key={type}>{type}</option>)}
          </select>
        </label>
        <label>{msg("Correct answer","정답")}
          <input required maxLength={200} value={form.canonical} onChange={e=>update("canonical",e.target.value)} placeholder={msg("e.g. Kiwi","예: 키위")}/>
        </label>
        <label>{msg("Other accepted answers · one per line","인정할 다른 정답 · 줄마다 하나")}
          <textarea rows={3} value={form.aliases} onChange={e=>update("aliases",e.target.value)} placeholder={msg("Synonyms and alternate spellings","다른 표기와 동의어")}/>
        </label>
        <label className="studio-wide">{msg("Topics · comma separated","주제 · 쉼표로 구분")}
          <input value={form.topics} onChange={e=>update("topics",e.target.value)} placeholder={msg("Nature, Animals, New Zealand","자연, 동물, 뉴질랜드")}/>
        </label>
      </div>
    </section>

    <section className="placeholder-panel">
      <div className="studio-section-head">
        <div><h2>{msg("Clues","단서")}</h2><p className="muted">{msg("Clues appear in this order. Add 1 to 15 and move them up or down.","단서는 이 순서대로 나타납니다. 1~15개를 추가하고 순서를 바꿀 수 있어요.")}</p></div>
        <span className="media-state-chip media-wait">{form.clues.length} / 15</span>
      </div>
      <div className="studio-quiz-clue-list">
        {form.clues.map((clue,index)=><article className="studio-quiz-clue" key={clue.key}>
          <div className="studio-quiz-clue-head">
            <h3>{msg("Clue ","단서 ")}{index+1}</h3>
            <div className="actions">
              <button type="button" className="btn btn-outline" aria-label={msg("Move clue up","단서 위로 이동")} disabled={index===0}
                onClick={()=>moveClue(index,-1)}>↑</button>
              <button type="button" className="btn btn-outline" aria-label={msg("Move clue down","단서 아래로 이동")} disabled={index===form.clues.length-1}
                onClick={()=>moveClue(index,1)}>↓</button>
              <button type="button" className="btn btn-outline" disabled={form.clues.length===1}
                onClick={()=>update("clues",form.clues.filter(c=>c.key!==clue.key))}>{msg("Remove","삭제")}</button>
            </div>
          </div>
          <div className="studio-form-grid">
            <label>{msg("Clue format","단서 방식")}
              <select value={clue.type} onChange={e=>{
                const type=e.target.value as ClueType;
                updateClue(clue.key,{type,mediaId:type==="image"||type==="image-reveal"?(clue.type==="image"||clue.type==="image-reveal"?clue.mediaId:""):type===clue.type?clue.mediaId:""});
              }}>
                {clueTypes.map(item=><option key={item.type} value={item.type}>{msg(item.en,item.ko)}</option>)}
              </select>
            </label>
            {clue.type!=="text"&&<label>{msg("Optional accompanying text","함께 보여줄 설명 · 선택")}
              <input value={clue.text} maxLength={1000} onChange={e=>updateClue(clue.key,{text:e.target.value})}/>
            </label>}
            {clue.type==="text"&&<label className="studio-wide">{msg("Clue text","단서 문구")}
              <textarea required rows={3} maxLength={3000} value={clue.text} onChange={e=>updateClue(clue.key,{text:e.target.value})} placeholder={msg("Start with a harder clue and gradually make it easier.","처음에는 어렵게, 뒤로 갈수록 쉽게 작성해 보세요.")}/>
            </label>}
            {(["image","image-reveal","audio","video"] as ClueType[]).includes(clue.type)&&
              <div className="studio-wide studio-quiz-media-field">
                <strong>{msg("Selected media","선택된 미디어")}</strong>
                <span>{clue.mediaId||msg("Nothing selected","선택하지 않음")}</span>
                <button className="btn btn-outline" type="button" onClick={()=>setMediaTarget(mediaTarget===clue.key?null:clue.key)}>
                  {msg("Choose from Media Library","미디어 라이브러리에서 선택")}
                </button>
                {mediaTarget===clue.key&&<MediaPicker kind={clue.type==="image-reveal"?"image":clue.type} selectedId={clue.mediaId}
                  onSelect={id=>{updateClue(clue.key,{mediaId:id});setMediaTarget(null);}}
                  onClose={()=>setMediaTarget(null)}/>}
              </div>}
            {clue.type==="image-reveal"&&<>
              <label>{msg("Reveal effect","공개 효과")}
                <select value={clue.reveal.effect} onChange={e=>updateClue(clue.key,{reveal:{...clue.reveal,effect:e.target.value as Reveal["effect"]}})}>
                  <option value="blur">{msg("Blur → clear","흐림 → 선명")}</option>
                  <option value="zoom">{msg("Zoom out","확대 → 전체")}</option>
                  <option value="spotlight">{msg("Spotlight","작은 부분 → 전체")}</option>
                </select>
              </label>
              <label>{msg("Strength (0 = original)","강도 (0 = 원본)")}
                <input type="number" min={0} max={100} step={1} value={clue.reveal.strength}
                  onChange={e=>updateClue(clue.key,{reveal:{...clue.reveal,strength:Number(e.target.value)}})}/>
              </label>
              {clue.reveal.effect!=="blur"&&<>
                <label>{msg("Focus X (%)","중심 X (%)")}<input type="number" min={0} max={100} value={clue.reveal.focusX}
                  onChange={e=>updateClue(clue.key,{reveal:{...clue.reveal,focusX:Number(e.target.value)}})}/></label>
                <label>{msg("Focus Y (%)","중심 Y (%)")}<input type="number" min={0} max={100} value={clue.reveal.focusY}
                  onChange={e=>updateClue(clue.key,{reveal:{...clue.reveal,focusY:Number(e.target.value)}})}/></label>
              </>}
            </>}
            {clue.type==="map"&&<>
              {(["latitude","longitude","zoom"] as const).map(field=><label key={field}>{field}
                <input type="number" required step="any" min={field==="latitude"?-90:field==="longitude"?-180:1}
                  max={field==="latitude"?90:field==="longitude"?180:20} value={clue.map[field]}
                  onChange={e=>updateClue(clue.key,{map:{...clue.map,[field]:Number(e.target.value)}})}/>
              </label>)}
            </>}
          </div>
        </article>)}
      </div>
      <div className="studio-quiz-add-clue">
        <label>{msg("New clue format","추가할 단서 방식")}
          <select id="new-clue-type" defaultValue="text">
            {clueTypes.map(item=><option key={item.type} value={item.type}>{msg(item.en,item.ko)}</option>)}
          </select>
        </label>
        <button className="btn btn-outline" type="button" disabled={form.clues.length>=15}
          onClick={()=>{
            const select=document.getElementById("new-clue-type") as HTMLSelectElement|null;
            update("clues",[...form.clues,newClue(select?.value as ClueType||"text")]);
          }}>+ {msg("Add clue","단서 추가")}</button>
      </div>
      <p className="muted">{msg("Upload files in Media Library before selecting them here. The same image can be reused across reveal stages.",
        "먼저 미디어 라이브러리에 파일을 올린 뒤 여기서 선택하세요. 한 이미지를 여러 공개 단계에 재사용할 수 있습니다.")}</p>
    </section>

    <section className="placeholder-panel">
      <h2>{msg("Audience · optional","추천 대상 · 선택 사항")}</h2>
      <p className="muted">{msg("These are creator preferences, not a safety approval. Request Kids review separately after publishing.",
        "제작자의 추천 정보일 뿐 안전성 승인이 아닙니다. 어린이용 승인은 공개 후 별도로 신청하세요.")}</p>
      <div className="studio-form-grid">
        <label>{msg("Intended minimum age","의도한 최소 연령")}
          <input type="number" min={0} max={120} value={form.creatorMin} onChange={e=>update("creatorMin",e.target.value)}/>
        </label>
        <label>{msg("Intended maximum age","의도한 최대 연령")}
          <input type="number" min={0} max={120} value={form.creatorMax} onChange={e=>update("creatorMax",e.target.value)}/>
        </label>
        <label>{msg("Suggested minimum age","추천 최소 연령")}
          <input type="number" min={0} max={120} value={form.suggestedMin} onChange={e=>update("suggestedMin",e.target.value)}/>
        </label>
        <label>{msg("Suggested maximum age","추천 최대 연령")}
          <input type="number" min={0} max={120} value={form.suggestedMax} onChange={e=>update("suggestedMax",e.target.value)}/>
        </label>
        <label>{msg("Difficulty","난이도")}
          <select value={form.difficulty} onChange={e=>update("difficulty",e.target.value)}>
            <option value="">{msg("Unspecified","지정 안 함")}</option>
            <option value="easy">{msg("Easy","쉬움")}</option>
            <option value="medium">{msg("Medium","보통")}</option>
            <option value="hard">{msg("Hard","어려움")}</option>
          </select>
        </label>
        <label className="studio-wide">{msg("Creator note","제작자 메모")}
          <textarea maxLength={400} rows={2} value={form.creatorNote} onChange={e=>update("creatorNote",e.target.value)}/>
        </label>
      </div>
    </section>
    {error&&<p className="feedback" role="alert">{error}</p>}
    {notice&&<p className="feedback success" role="status">{notice}</p>}
    <div className="studio-save-bar">
      <p className="muted">{original?msg("Edits create a new immutable revision. Published questions stay published; Kids review resets.",
        "수정하면 새 버전이 생성됩니다. 일반 공개는 유지되고 Kids 승인은 재심사가 필요합니다."):
        msg("Save your draft first, then test it and publish when ready.","먼저 초안으로 저장하고 테스트한 뒤 원하는 때 공개하세요.")}</p>
      <div className="actions">
        <Link className="btn btn-outline" href={localizeHref("/studio",locale)}
          onClick={e=>{if(dirty&&!window.confirm(msg("Discard unsaved changes?","저장하지 않은 변경 사항을 버릴까요?")))e.preventDefault();}}>
          {msg("Back to list","목록으로")}
        </Link>
        {original&&<button className="btn btn-outline" type="button" disabled={!dirty||saving} onClick={()=>{
          if(window.confirm(msg("Discard edits and reload the saved quiz?","수정 내용을 버리고 저장된 내용을 다시 불러올까요?")))setReload(n=>n+1);
        }}>{msg("Discard edits","수정 취소")}</button>}
        <button type="submit" className="btn btn-primary" disabled={saving||!!original&&!dirty||original?.safetyStatus==="RESTRICTED"}>
          {saving?msg("Saving…","저장 중…"):original?msg("Save new revision","수정사항 저장"):msg("Create draft","초안 만들기")}
        </button>
        {original&&original.publication!=="PUBLISHED"&&<button type="button" className="btn btn-outline"
          disabled={saving||dirty||original.safetyStatus==="RESTRICTED"} onClick={()=>void publish()}>{msg("Publish","공개하기")}</button>}
      </div>
    </div>
  </form>;
}
