"use client";
import {useEffect,useId,useState} from "react";
import {useLocale} from "../../../src/i18n/provider";
import {bilingual} from "../../../src/i18n/view-copy";

type Policy={
  enabled:boolean;quizReportThreshold:number;packReportThreshold:number;
  windowHours:number;minimumEstablishedReporters:number;establishedAccountDays:number
};
type NumericSetting=Exclude<keyof Policy,"enabled">;
const limits:Record<NumericSetting,[number,number]>={
  quizReportThreshold:[2,100],packReportThreshold:[2,100],
  windowHours:[1,720],minimumEstablishedReporters:[0,100],establishedAccountDays:[0,90]
};
const fields:NumericSetting[]=[
  "quizReportThreshold","packReportThreshold","windowHours",
  "minimumEstablishedReporters","establishedAccountDays"
];

function RuleBadge({label,explanation,question=false,ariaLabel}:{
  label:string;explanation:string;question?:boolean;ariaLabel?:string
}){
  const id=useId(),[open,setOpen]=useState(false);
  return <span className={"moderation-help-badge"+(open?" is-open":"")}
    onBlur={event=>{if(!event.currentTarget.contains(event.relatedTarget))setOpen(false)}}>
    <button type="button" className={question?"moderation-help-dot":"small-tag moderation-help-pill"}
      aria-label={ariaLabel??label} aria-describedby={id} aria-expanded={open}
      onClick={()=>setOpen(previous=>!previous)}>
      {label}
    </button>
    <span id={id} role="tooltip" className="moderation-help-popover">{explanation}</span>
  </span>;
}
async function policyApi(method:"GET"|"PATCH",body?:Policy){
  const response=await fetch("/api/v1/admin/moderation/policy",{
    method,credentials:"same-origin",cache:"no-store",
    headers:{"content-type":"application/json"},
    ...(body?{body:JSON.stringify({...body,confirm:true})}:{})
  });
  const json=await response.json().catch(()=>({}));
  if(!response.ok)throw Error(json.message||json.error||"Request failed");
  return json.data;
}
function samePolicy(a:Policy,b:Policy){
  return a.enabled===b.enabled&&fields.every(field=>a[field]===b[field]);
}
function validPolicy(p:Policy){
  return fields.every(field=>Number.isInteger(p[field]) &&
    p[field]>=limits[field][0]&&p[field]<=limits[field][1]) &&
    p.minimumEstablishedReporters<=Math.min(p.quizReportThreshold,p.packReportThreshold);
}
export default function ModerationPolicySettings(){
  const locale=useLocale(),msg=(en:string,ko:string)=>bilingual(locale,en,ko);
  const [policy,setPolicy]=useState<Policy|null>(null);
  const [saved,setSaved]=useState<Policy|null>(null);
  const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false);
  const [error,setError]=useState(""),[success,setSuccess]=useState("");
  useEffect(()=>{
    let mounted=true;
    policyApi("GET")
      .then((result:Policy)=>{if(mounted){setPolicy(result);setSaved(result)}})
      .catch(e=>{if(mounted)setError(e instanceof Error?e.message:"Request failed")})
      .finally(()=>{if(mounted)setLoading(false)});
    return ()=>{mounted=false};
  },[]);

  function update(field:NumericSetting,value:string){
    setPolicy(prev=>prev&&({...prev,[field]:value===""?NaN:Number(value)}));
    setSuccess("");
  }
  async function save(){
    if(!policy||!validPolicy(policy)||busy)return;
    if(!window.confirm(msg(
      "Save these rules? Existing open reports will be re-evaluated immediately and qualifying content may be temporarily hidden.",
      "이 설정을 저장할까요? 기존 미처리 신고도 즉시 재평가되며 조건에 맞는 콘텐츠는 자동 보류될 수 있습니다."
    )))return;
    setBusy(true);setError("");setSuccess("");
    try{
      const result=await policyApi("PATCH",policy) as Policy & {reevaluatedHolds?:{quizzes:number;packs:number}};
      setPolicy(result);setSaved(result);
      const newHolds=(result.reevaluatedHolds?.quizzes??0)+(result.reevaluatedHolds?.packs??0);
      setSuccess(newHolds>0
        ?msg("Policy saved. "+newHolds+" existing item(s) were put on hold.",
          "설정이 저장되었고 기존 신고 콘텐츠 "+newHolds+"개가 자동 보류됐습니다.")
        :msg("Policy saved.","설정이 저장되었습니다."));
    }catch(e){setError(e instanceof Error?e.message:"Request failed")}
    finally{setBusy(false)}
  }
  const copy:Record<NumericSetting,{label:string;help:string;footnote:string}>={
    quizReportThreshold:{
      label:msg("Quiz report threshold","문제 신고 임계치"),
      help:msg("At least this many different accounts must report the same quiz during the configured window.",
        "집계 시간 안에 동일한 문제를 신고한 서로 다른 계정 수가 이 값 이상이어야 합니다."),
      footnote:msg("People, not total report clicks","신고 횟수가 아닌 고유 신고자 수")
    },
    packReportThreshold:{
      label:msg("Pack report threshold","팩 신고 임계치"),
      help:msg("Pack reports are counted separately from reports on the quizzes inside the pack.",
        "퀴즈팩 자체에 들어온 신고만 계산하며 팩 안의 개별 문제 신고와 합치지 않습니다."),
      footnote:msg("Independent of quiz reports","문제 신고와 별도로 집계")
    },
    windowHours:{
      label:msg("Report window (hours)","신고 집계 시간"),
      help:msg("Only unresolved reports made within this rolling period are counted, measured back from now.",
        "현재 시점을 기준으로 최근 이 시간 안에 접수된 미처리 신고만 계산합니다."),
      footnote:msg("Rolling lookback, not calendar days","달력 날짜가 아닌 현재 기준 최근 시간")
    },
    minimumEstablishedReporters:{
      label:msg("Minimum established reporters","기존 계정 최소 신고자"),
      help:msg("Within the total unique reporters, at least this many must have accounts older than the age rule below. Set 0 to disable this safeguard.",
        "전체 고유 신고자 중 아래 가입 일수 조건을 만족하는 계정이 최소 이 인원만큼 필요합니다. 0이면 이 조건을 적용하지 않습니다."),
      footnote:msg("Extra safeguard against new-account brigades","신규 계정의 집단 신고를 방지")
    },
    establishedAccountDays:{
      label:msg("Established account age (days)","기존 계정 기준 일수"),
      help:msg("A reporter counts as an established account if they registered at least this many days before the evaluation time.",
        "신고 집계 시점에 가입한 지 이 일수 이상인 계정을 기존 계정 신고자로 인정합니다."),
      footnote:msg("Based on account registration date","계정 가입일을 기준으로 판정")
    }
  };
  if(loading)return <section className="section"><p role="status" className="muted">
    {msg("Loading moderation settings…","자동 보류 설정을 불러오는 중…")}</p></section>;
  if(!policy)return <section className="section"><p role="alert" className="feedback">{error||
    msg("Settings could not be loaded.","설정을 불러오지 못했습니다.")}</p>
    <button type="button" className="btn btn-outline" onClick={()=>window.location.reload()}>
      {msg("Retry","다시 시도")}</button></section>;

  const dirty=!!saved&&!samePolicy(policy,saved);
  const valid=validPolicy(policy);
  const countLabel=policy.minimumEstablishedReporters===0
    ?msg("No age-qualified minimum","기존 계정 최소 인원 없음")
    :msg(policy.minimumEstablishedReporters+" established account(s)",
      "기존 계정 최소 "+policy.minimumEstablishedReporters+"명");
  return <section className="section moderation-policy-page">
    {error&&<p role="alert" className="feedback">{error}</p>}
    {success&&<p role="status" className="feedback success">{success}</p>}
    <div className="moderation-policy-intro">
      <div className="moderation-policy-status">
        <strong>{msg("Automatic holds","자동 보류")}</strong>
        <span className="small-tag">{policy.enabled?msg("On","사용 중"):msg("Off","꺼짐")}</span>
        {dirty&&<span className="small-tag moderation-unsaved-tag">
          {msg("Unsaved changes · preview only","미저장 변경사항 · 미적용")}</span>}
      </div>
      <p className="muted">{msg(
        "Reports are never proof of a violation. When enabled, eligible published content is temporarily hidden for staff review.",
        "신고만으로 위반이 확정되지 않습니다. 활성화된 경우 조건에 맞는 공개 콘텐츠를 관리자가 검토할 때까지 임시로 숨깁니다."
      )}</p>
      <details className="moderation-policy-explainer">
        <summary>{msg("How do these conditions work?","현재 자동 보류 조건 자세히 보기")}
          <span className="muted">{msg("Show examples and badge help","예시와 배지 설명")}</span></summary>
        <div className="moderation-policy-explainer-body">
          <p>{msg(
            "For each quiz or pack, all applicable requirements must be met. Quiz and pack thresholds are independent.",
            "문제 또는 팩 각각에 대해 해당 조건을 모두 충족해야 합니다. 문제 신고와 팩 신고는 별도로 계산합니다."
          )}</p>
          <div className="moderation-badge-row">
            <RuleBadge label={msg("Quiz ≥ "+policy.quizReportThreshold,"문제 ≥ "+policy.quizReportThreshold+"명")}
              explanation={copy.quizReportThreshold.help}/>
            <RuleBadge label={msg("Pack ≥ "+policy.packReportThreshold,"팩 ≥ "+policy.packReportThreshold+"명")}
              explanation={copy.packReportThreshold.help}/>
            <RuleBadge label={msg("Last "+policy.windowHours+" h","최근 "+policy.windowHours+"시간")}
              explanation={copy.windowHours.help}/>
            <RuleBadge label={countLabel} explanation={copy.minimumEstablishedReporters.help}/>
            <RuleBadge label={msg("Age ≥ "+policy.establishedAccountDays+" days",
              "가입 "+policy.establishedAccountDays+"일 이상")}
              explanation={copy.establishedAccountDays.help}/>
          </div>
          <p>{msg(
            "Example: If one quiz receives reports from "+policy.quizReportThreshold+
            " distinct accounts within "+policy.windowHours+" hours, at least "+
            policy.minimumEstablishedReporters+" of those accounts must be "+
            policy.establishedAccountDays+"+ days old for automatic holding.",
            "예: 한 문제에 최근 "+policy.windowHours+"시간 내 서로 다른 계정 "+
            policy.quizReportThreshold+"명 이상의 신고가 들어오고, 그중 최소 "+
            policy.minimumEstablishedReporters+"명이 가입 "+policy.establishedAccountDays+
            "일 이상이면 자동 보류 대상입니다."
          )}</p>
          <p className="muted">{msg(
            "Hover, focus or tap any badge to read its explanation. Self-reports and repeated open reports do not increase the count. Disabling auto-hold does not erase reports or restore content already held.",
            "배지에 마우스를 올리거나 클릭·키보드로 선택하면 설명을 볼 수 있습니다. 본인 신고와 동일 계정의 중복 신고는 추가 집계하지 않습니다. 자동 보류를 꺼도 신고 내역이 사라지거나 이미 보류한 콘텐츠가 자동 복원되지는 않습니다."
          )}</p>
        </div>
      </details>
    </div>
    <div className="moderation-settings-grid">
      {fields.map(field=>{
        const config=copy[field],value=policy[field];
        const [min,max]=limits[field];
        return <div className="feature-card moderation-setting-card" key={field}>
          <div className="moderation-setting-heading">
            <label htmlFor={"moderation-"+field}>{config.label}</label>
            <RuleBadge question label="?" ariaLabel={msg("Help: ","도움말: ")+config.label}
              explanation={config.help}/>
          </div>
          <input id={"moderation-"+field} type="number" min={min} max={max} step="1"
            value={Number.isNaN(value)?"":value}
            onChange={event=>update(field,event.target.value)}/>
          <p className="muted">{config.footnote}</p>
        </div>;
      })}
    </div>
    <label className="moderation-policy-toggle">
      <input type="checkbox" checked={policy.enabled}
        onChange={event=>{setPolicy(prev=>prev&&({...prev,enabled:event.target.checked}));setSuccess("")}}/>
      <span>{msg("Enable automatic holds","자동 보류 활성화")}</span>
    </label>
    {!valid&&<p role="alert" className="feedback">{msg(
      "Enter whole numbers within the allowed ranges. The established-reporter minimum must not exceed either report threshold.",
      "허용 범위 안의 정수를 입력하세요. 기존 계정 최소 신고자 수는 문제·팩 신고 임계치를 넘을 수 없습니다."
    )}</p>}
    <div className="moderation-settings-actions">
      <button type="button" className="btn btn-primary" onClick={()=>void save()}
        disabled={busy||!valid||!dirty}>
        {busy?msg("Saving…","저장 중…"):msg("Save settings","설정 저장")}
      </button>
      {dirty&&<button type="button" className="btn btn-outline" onClick={()=>{if(saved)setPolicy(saved);setError("");setSuccess("")}}>
        {msg("Discard changes","변경 취소")}</button>}
    </div>
  </section>;
}
