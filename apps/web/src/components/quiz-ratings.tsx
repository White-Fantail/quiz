"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useLocale } from "../i18n/provider";
import { bilingual } from "../i18n/view-copy";
import type { RatingSummary } from "../modules/quiz/rating-metadata";
export type RatingAccess = "SIGN_IN" | "OWN_QUIZ" | "GUEST_SESSION" | "READY";
/** Community sentiment is independent of player success rate. */
export function RatingBadge({ratings}:{ratings?:RatingSummary|null}) {
  const locale=useLocale();
  if(!ratings || ratings.positivePercent===null)
    return <span className="quiz-rating-badge" aria-label={bilingual(locale,"Not enough ratings yet","아직 충분한 평가가 없습니다")}>🌱 {bilingual(locale,"New quiz · ","새 문제 · 평가 ")}{ratings?.total??0}{bilingual(locale," ratings","명")}</span>;
  return <span className="quiz-rating-badge"
    aria-label={bilingual(locale,"Positive ratings ","좋아요 ")+ratings.positivePercent+bilingual(locale,"% from ","퍼센트, ")+ratings.total+bilingual(locale," voters","명 평가")}>
    👍 {ratings.positivePercent}% · {ratings.total}{bilingual(locale," ratings","명 평가")}</span>;
}
export function RatingButtons({quizId,initialRating,access,locale:explicitLocale,kind="QUIZ",onSaved}:{
  quizId:string;initialRating:number|null;access:RatingAccess;
  locale?:"en"|"ko";kind?:"QUIZ"|"TRANSLATION";
  onSaved?:(ratings:RatingSummary,value:number|null)=>void;
}) {
  const contextLocale=useLocale();
  const msg=(en:string,ko:string)=>bilingual(contextLocale,en,ko);
  const locale=explicitLocale??contextLocale;
  const [rating,setRating]=useState<number|null>(initialRating);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const [notice,setNotice]=useState("");
  useEffect(()=>{setRating(initialRating);setError("");setNotice("");},[quizId,initialRating,locale,kind]);
  async function submit(next:-1|1) {
    if(access!=="READY"||busy)return;
    setBusy(true);setError("");setNotice("");
    const remove=rating===next;
    try {
      const response=await fetch("/api/v1/quizzes/"+encodeURIComponent(quizId)+"/reviews?locale="+locale+"&kind="+kind,{
        method:remove?"DELETE":"POST",credentials:"same-origin",
        headers:remove?undefined:{"Content-Type":"application/json"},
        body:remove?undefined:JSON.stringify({rating:next,comment:"",locale,kind})
      });
      const result=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(result.message||msg("Could not save your rating.","평가 저장에 실패했어요."));
      const value:number|null=result.data.rating??null;
      setRating(value);setNotice(value===null?msg("Rating removed.","평가를 취소했어요."):msg("Rating saved.","평가를 저장했어요."));
      onSaved?.(result.data.ratings,value);
    }catch(e){setError(e instanceof Error?e.message:msg("Could not save your rating.","평가를 저장하지 못했어요."));}
    finally{setBusy(false);}
  }
  if(access!=="READY")return <span className="rating-unavailable">
    {access==="OWN_QUIZ"?msg("You can't rate your own quiz.","내가 만든 문제는 평가할 수 없어요."):access==="GUEST_SESSION"?
      msg("Guest plays can't be rated.","비로그인 플레이 기록은 평가할 수 없어요."):msg("Sign in and finish a quiz to leave a rating.","로그인 후 푼 문제만 평가할 수 있어요.")}
  </span>;
  return <div className="rating-input">
    <div className="rating-buttons" role="group" aria-label={msg("Rate this quiz","이 문제 평가")}>
      <button type="button" className={"rating-vote"+(rating===1?" selected":"")} aria-pressed={rating===1}
        disabled={busy} onClick={()=>void submit(1)} title={msg("Like (click again to remove)","좋아요 (다시 누르면 취소)")}>👍 <span>{msg("Like","좋아요")}</span></button>
      <button type="button" className={"rating-vote"+(rating===-1?" selected":"")} aria-pressed={rating===-1}
        disabled={busy} onClick={()=>void submit(-1)} title={msg("Needs improvement (click again to remove)","아쉬워요 (다시 누르면 취소)")}>👎 <span>{msg("Needs work","아쉬워요")}</span></button>
    </div>
    {notice&&<span className="rating-saved" role="status">{notice}</span>}
    {error&&<span className="rating-error" role="alert">{error}</span>}
  </div>;
}
export function RatingSignIn({destination}:{destination:string}) {
  const locale=useLocale();
  const msg=(en:string,ko:string)=>bilingual(locale,en,ko);
  return <p className="muted rating-sign-in">
    {msg("To leave a rating, ","평가를 남기려면 ")}<Link href={"/sign-in?callbackURL="+encodeURIComponent(destination)}>{msg("sign in","로그인")}</Link>{msg(" and finish a new quiz."," 후 새 문제를 풀어 주세요.")}
    {msg("Guest plays cannot be rated retroactively after signing in.","비로그인으로 완료한 기록은 로그인 후 소급해서 평가할 수 없어요.")}
  </p>;
}
