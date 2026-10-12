"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useLocale } from "../i18n/provider";
import { localizeHref } from "../i18n/core";
import { bilingual } from "../i18n/view-copy";

type Category="solved"|"detective"|"challenge"|"explorer"|"rising";
type Winner={userId:string;displayName:string;value:number;category:Category};
const categories:Category[]=["solved","detective","explorer","challenge","rising"];
const names:Record<Category,[string,string,string]>={
  solved:["Most Solved","문제 해결왕","🏆"],detective:["Best Detective","명탐정","🔍"],
  challenge:["Challenge Master","어려운 문제 정복자","🔥"],
  explorer:["Explorer","탐험가","🧭"],rising:["Rising Star","떠오르는 신예","✨"]
};
export default function LeaderboardSpotlight(){
  const locale=useLocale(),msg=(en:string,ko:string)=>bilingual(locale,en,ko);
  const [winners,setWinners]=useState<Winner[]>([]);
  const [loading,setLoading]=useState(true);
  useEffect(()=>{
    const controller=new AbortController();
    Promise.all(categories.map(async category=>{
      const r=await fetch("/api/v1/leaderboard?period=week&category="+category+"&limit=5",
        {signal:controller.signal,cache:"no-store"});
      if(!r.ok)throw Error("Ranking unavailable");
      const payload=await r.json();
      return {category,items:(payload.data?.items??[]) as Array<{userId:string;displayName:string;value:number}>};
    })).then(results=>{
      const used=new Set<string>(),picked:Winner[]=[];
      // Main highlights distinct people when possible; the full tables stay objective.
      for(const result of results){
        const next=result.items.find(item=>!used.has(item.userId));
        if(next){used.add(next.userId);picked.push({...next,category:result.category});}
        if(picked.length===3)break;
      }
      setWinners(picked);
    }).catch(()=>{if(!controller.signal.aborted)setWinners([]);})
      .finally(()=>{if(!controller.signal.aborted)setLoading(false);});
    return ()=>controller.abort();
  },[]);
  return <section className="section ranking-home" aria-label={msg("This week's players","이번 주의 플레이어")}>
    <div className="ranking-home-head">
      <div><span className="eyebrow">QUIZDIP · COMMUNITY</span><h2>🏆 {msg("Players of the week","이번 주의 플레이어")}</h2>
        <p className="muted">{msg("Many ways to shine. Every great clue counts.","서로 다른 재능으로 빛나는 플레이어들")}</p></div>
      <Link className="text-button" href={localizeHref("/leaderboard",locale)}>{msg("View all rankings →","전체 랭킹 보기 →")}</Link>
    </div>
    {winners.length?<div className="ranking-home-grid">
      {winners.map(item=><article className="feature-card ranking-home-card" key={item.category}>
        <span className="ranking-home-emoji" aria-hidden="true">{names[item.category][2]}</span>
        <span className="small-tag">{msg(names[item.category][0],names[item.category][1])}</span>
        <h3>{item.displayName}</h3>
        <p>{item.value.toLocaleString(locale==="ko"?"ko-KR":"en-US")} {item.category==="detective"?msg("avg pts","평균 점수"):item.category==="explorer"?msg("topics","주제"):item.category==="challenge"?msg("challenge pts","도전 점수"):msg("solved","문제 해결")}</p>
      </article>)}
    </div>:<div className="ranking-home-empty">
      <span aria-hidden="true">✨</span> {loading?msg("Checking this week's players…","이번 주의 기록을 확인 중…"):
        msg("The first weekly champions are waiting to be discovered!","이번 주 첫 번째 챔피언을 기다리고 있어요!")}
    </div>}
  </section>;
}
