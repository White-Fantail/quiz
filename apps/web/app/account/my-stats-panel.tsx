"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useLocale } from "../../src/i18n/provider";
import { localizeHref } from "../../src/i18n/core";
import { bilingual } from "../../src/i18n/view-copy";

type Period="day"|"week"|"month"|"all";
type PeriodStats={finished:number;solved:number;failed:number;score:number;detectiveScore:number|null;topics:number};
type Report={
  started:number;finished:number;solved:number;failed:number;distinctSolved:number;totalBestScore:number;
  successRate:number|null;weeklyRank:number|null;rank:number|null;leaderboardEligible:boolean;
  leaderboardOptIn:boolean;periodStats:Record<Period,PeriodStats>;
};
const periods:Period[]=["day","week","month","all"];
export default function MyStatsPanel(){
  const locale=useLocale(),msg=(en:string,ko:string)=>bilingual(locale,en,ko);
  const [period,setPeriod]=useState<Period>("week");
  const [data,setData]=useState<Report|null>(null);
  const [error,setError]=useState(false);
  useEffect(()=>{
    const controller=new AbortController();
    fetch("/api/v1/me/stats",{cache:"no-store",credentials:"same-origin",signal:controller.signal})
      .then(async r=>{if(!r.ok)throw Error("Stats unavailable");return (await r.json()).data as Report;})
      .then(setData).catch(()=>{if(!controller.signal.aborted)setError(true);});
    return ()=>controller.abort();
  },[]);
  const current=data?.periodStats?.[period];
  return <section className="placeholder-panel account-records" aria-label={msg("My play records","내 플레이 기록")}>
    <div className="account-records-head">
      <div><span className="eyebrow">MY QUIZDIP</span><h2>📊 {msg("My play records","내 플레이 기록")}</h2></div>
      <Link href={localizeHref("/leaderboard",locale)} className="text-button">{msg("Rankings →","랭킹 보기 →")}</Link>
    </div>
    <div className="ranking-periods account-periods" aria-label={msg("My statistics period","기록 기간")}>
      {periods.map(p=><button type="button" key={p} className={p===period?"active":""} aria-pressed={p===period} onClick={()=>setPeriod(p)}>
        {p==="day"?msg("Today","오늘"):p==="week"?msg("This week","이번 주"):p==="month"?msg("This month","이번 달"):msg("All time","전체")}
      </button>)}
    </div>
    {!data&&!error?<p role="status" className="muted">{msg("Loading my records…","내 기록을 불러오는 중…")}</p>:
      error?<p role="alert" className="feedback">{msg("Could not load play records right now.","지금은 플레이 기록을 불러올 수 없어요.")}</p>:
      current?<><div className="account-stat-grid">
        <div><strong>{current.solved.toLocaleString()}</strong><span>{msg("Solved","정답")}</span></div>
        <div><strong>{current.finished.toLocaleString()}</strong><span>{msg("Completed","완료")}</span></div>
        <div><strong>{current.score.toLocaleString()}</strong><span>{msg("Score","점수")}</span></div>
        <div><strong>{current.topics.toLocaleString()}</strong><span>{msg("Explored topics","탐험한 주제")}</span></div>
      </div>
      <p className="muted account-stat-detail">{msg("Detective average: ","명탐정 평균: ")}
        <b>{current.detectiveScore===null?msg("Not enough qualifying solves yet","아직 기준을 충족한 기록이 없어요"):current.detectiveScore+" "+msg("points","점")}</b>
        {" · "}{msg("Incorrect: ","오답: ")}<b>{current.failed}</b>
      </p>
      <p className="muted">{msg("First completed attempt per question; own quizzes and Kids excluded. UTC periods apply.","문제마다 최초 완료 기록만 집계하며 본인이 만든 문제와 키즈 기록은 제외해요. 기간은 UTC 기준이에요.")}</p>
      {period==="week"&&data.weeklyRank!==null&&<p className="account-ranking-position">🏆 {msg("My weekly Most Solved rank: ","내 주간 문제 해결왕 순위: ")}<b>#{data.weeklyRank}</b></p>}
      {period==="all"&&data.rank!==null&&<p className="account-ranking-position">🏆 {msg("My all-time Most Solved rank: ","내 누적 문제 해결왕 순위: ")}<b>#{data.rank}</b></p>}
      {!data.leaderboardEligible||!data.leaderboardOptIn?<p className="muted">{msg("Your records stay private. Public rankings require consent and separately verified adult eligibility.","내 기록은 비공개로 유지돼요. 공개 랭킹 참여에는 공개 동의와 별도의 성인 참여 자격 확인이 필요해요.")}</p>:null}
      </>:null}
  </section>;
}
