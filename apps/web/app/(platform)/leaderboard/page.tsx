"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useLocale } from "../../../src/i18n/provider";
import { bilingual } from "../../../src/i18n/view-copy";
import { localizeHref } from "../../../src/i18n/core";

type Period="day"|"week"|"month";
type Category="solved"|"detective"|"challenge"|"explorer"|"rising";
type Entry={userId:string;rank:number;displayName:string;value:number;quizzesSolved:number;score:number};
type Result={items:Entry[];total:number;minimum:number};
const PAGE=20;
const periods:Period[]=["day","week","month"];
const categories:Category[]=["solved","detective","challenge","explorer","rising"];

export default function LeaderboardPage() {
  const locale=useLocale();
  const msg=(en:string,ko:string)=>bilingual(locale,en,ko);
  const [period,setPeriod]=useState<Period>("week");
  const [category,setCategory]=useState<Category>("solved");
  const [page,setPage]=useState(0);
  const [data,setData]=useState<Result|null>(null);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");
  const labels:Record<Category,[string,string,string]>={
    solved:["Most Solved","문제 해결왕","🏆"],
    detective:["Best Detective","명탐정","🔍"],
    challenge:["Challenge Master","어려운 문제 정복자","🔥"],
    explorer:["Explorer","탐험가","🧭"],
    rising:["Rising Star","떠오르는 신예","✨"]
  };
  const description:Record<Category,[string,string]>={
    solved:["Most distinct questions solved on the first completed attempt.","해당 기간 첫 완료 기록에서 가장 많은 서로 다른 문제를 맞힌 사람"],
    detective:["Highest average score among at least 5 qualifying multi-clue solves.","단서가 2개 이상인 문제를 5개 이상 맞힌 플레이어의 평균 점수"],
    challenge:["Successfully solved hard questions (at least 10 players and 40% failures).","10명 이상 참여하고 오답률 40% 이상인 어려운 문제를 해결한 플레이어"],
    explorer:["Different topics with at least 2 distinct solves each.","각각 서로 다른 문제를 2개 이상 맞힌 주제의 수"],
    rising:["Most solves by players who joined during the past 30 days.","최근 30일 안에 가입한 플레이어 중 가장 많은 문제를 맞힌 사람"]
  };
  useEffect(()=>{
    const controller=new AbortController();
    setLoading(true);setError("");
    fetch("/api/v1/leaderboard?period="+period+"&category="+category+"&limit="+PAGE+"&offset="+(page*PAGE),
      {cache:"no-store",signal:controller.signal})
      .then(async r=>{const j=await r.json();if(!r.ok)throw Error(j.message||j.error||"Ranking unavailable");return j.data as Result;})
      .then(setData)
      .catch(e=>{if(controller.signal.aborted)return;setError(e instanceof Error?e.message:"Ranking unavailable");setData(null);})
      .finally(()=>{if(!controller.signal.aborted)setLoading(false);});
    return ()=>controller.abort();
  },[period,category,page]);
  const changePeriod=(p:Period)=>{setPeriod(p);setPage(0);};
  const changeCategory=(c:Category)=>{setCategory(c);setPage(0);};
  return <main className="container inner-page rankings-page">
    <span className="eyebrow">QUIZDIP · RANKINGS</span>
    <h1>{msg("Meet the QuizDip players","QuizDip의 멋진 플레이어들")}</h1>
    <p className="lead">{msg("Different strengths, different champions. Explore rankings by time and talent.","많이 풀고, 날카롭게 추리하고, 새로운 주제를 탐험하는 다양한 플레이어를 만나보세요.")}</p>
    <div className="ranking-periods" aria-label={msg("Ranking period","랭킹 기간")}>
      {periods.map(p=><button key={p} type="button" className={period===p?"active":""} aria-pressed={period===p} onClick={()=>changePeriod(p)}>
        {p==="day"?msg("Today","오늘"):p==="week"?msg("This week","이번 주"):msg("This month","이번 달")}
      </button>)}
    </div>
    <div className="ranking-categories" aria-label={msg("Ranking category","랭킹 카테고리")}>
      {categories.map(c=><button key={c} type="button" className={category===c?"active":""} aria-pressed={category===c} onClick={()=>changeCategory(c)}>
        <span aria-hidden="true">{labels[c][2]}</span> {msg(labels[c][0],labels[c][1])}
      </button>)}
    </div>
    <section className="ranking-board" aria-live="polite">
      <div className="ranking-board-head">
        <div><h2>{labels[category][2]} {msg(labels[category][0],labels[category][1])}</h2>
          <p className="muted">{msg(description[category][0],description[category][1])}</p></div>
        {!loading&&data&&<span className="small-tag">{data.total} {msg("players","명")}</span>}
      </div>
      {loading?<p role="status" className="muted">{msg("Loading rankings…","랭킹을 불러오는 중…")}</p>:
        error?<p role="alert" className="feedback">{msg("Couldn't load rankings. Please try again.","랭킹을 불러오지 못했어요. 다시 시도해 주세요.")}</p>:
        data?.items.length?
          <ol className="ranking-entries" start={page*PAGE+1}>
            {data.items.map(item=><li key={item.userId} className="ranking-entry">
              <span className="ranking-medal" aria-label={msg("Rank","순위")+" "+item.rank}>{item.rank<=3?["🥇","🥈","🥉"][item.rank-1]:item.rank}</span>
              <span className="ranking-player">{item.displayName}</span>
              <strong className="ranking-value">{item.value.toLocaleString(locale==="ko"?"ko-KR":"en-US")} <small>
                {category==="solved"||category==="rising"?msg("solved","문제"):
                 category==="detective"?msg("avg pts","평균 점수"):
                 category==="explorer"?msg("topics","주제"):msg("challenge pts","도전 점수")}
              </small></strong>
            </li>)}
          </ol>:
          <div className="ranking-empty"><span aria-hidden="true">🌱</span><h3>{msg("The podium is still open!","아직 첫 번째 주인공을 기다리고 있어요!")}</h3>
            <p className="muted">{msg("Not enough eligible public results in this period yet. Play some quizzes and come back.","이 기간에 공개할 수 있는 기록이 아직 충분하지 않아요. 퀴즈를 풀고 다시 확인해 보세요.")}</p>
            <Link className="btn btn-outline" href={localizeHref("/play",locale)}>{msg("Play quizzes →","퀴즈 풀러 가기 →")}</Link>
          </div>}
      {!loading&&!error&&data&&data.total>PAGE&&<nav className="ranking-pages" aria-label={msg("Ranking pages","랭킹 페이지")}>
        <button className="btn btn-outline" type="button" disabled={page===0} onClick={()=>setPage(n=>n-1)}>{msg("Previous","이전")}</button>
        <span>{page+1} / {Math.ceil(data.total/PAGE)}</span>
        <button className="btn btn-outline" type="button" disabled={(page+1)*PAGE>=data.total} onClick={()=>setPage(n=>n+1)}>{msg("Next","다음")}</button>
      </nav>}
    </section>
    <p className="muted ranking-footnote">{msg(
      "Only verified adults who opted in appear here. Kids are never ranked. UTC day/week/month boundaries apply; the week starts Monday. Replays and creators' own quizzes do not boost scores.",
      "공개에 동의하고 성인 참여 자격을 확인받은 일반 사용자만 표시돼요. 키즈 기록은 제외해요. 기간은 UTC 기준이며 주간은 월요일에 시작해요. 재도전이나 자신의 문제 풀기는 순위를 올리지 못해요."
    )}</p>
    <p><Link href={localizeHref("/account",locale)} className="text-button">{msg("View my own records →","내 기록 확인하기 →")}</Link></p>
  </main>;
}
