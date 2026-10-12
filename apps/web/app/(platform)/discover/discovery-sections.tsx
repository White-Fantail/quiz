"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useLocale } from "../../../src/i18n/provider";
import { loadDiscoverySections } from "./discovery-client";
import { localizeHref } from "../../../src/i18n/core";

type Card={id:string;type:"PACK"|"QUIZ";title:string;subtitle:string;creator:string;
 questionCount:number;orderMode?:string;started:number;completed:number;
 difficultyPercent:number|null;ratings:{total:number;positivePercent:number|null}};
type Section={key:"trending"|"popular"|"highly_rated"|"difficult"|"new";
 items:Card[];basis:string};
const names:Record<Section["key"],{en:string;ko:string;icon:string}>={
 trending:{en:"Trending now",ko:"지금 인기",icon:"📈"},
 popular:{en:"Popular to play",ko:"많이 풀어본 콘텐츠",icon:"✨"},
 highly_rated:{en:"Highly rated",ko:"평가가 좋은 콘텐츠",icon:"👍"},
 difficult:{en:"Challenge yourself",ko:"어려운 퀴즈에 도전",icon:"🔥"},
 new:{en:"New discoveries",ko:"새로운 발견",icon:"🌱"}
};
export default function DiscoverySections(){
 const locale=useLocale(),ko=locale==="ko";
 const [sections,setSections]=useState<Section[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState("");
 useEffect(()=>{
   let live=true;setLoading(true);setError("");
   void loadDiscoverySections(locale)
    .then(data=>{if(live)setSections(data.sections??[]);})
    .catch(e=>{if(live)setError(String(e));})
    .finally(()=>{if(live)setLoading(false)});
   return ()=>{live=false};
 },[locale]);
 const present=sections.filter(s=>s.items.length && Object.prototype.hasOwnProperty.call(names,s.key));
 // Keep an empty organic ranking from pushing the actual catalog down the page.
 if (!loading && !present.length) return null;
 return <section aria-label={ko?"추천 및 인기 퀴즈":"Discover recommended quizzes"} className="discovery-dashboard">
  <div className="discover-results-head">
    <h2>{ko?"발견할 만한 콘텐츠":"Worth discovering"}</h2>
    <span className="muted">{ko?"실제 플레이와 평가 기록을 바탕으로":"Based on verified plays and ratings"}</span>
  </div>
  {loading&&<p className="muted" role="status">{ko?"인기 콘텐츠를 불러오는 중…":"Loading discovery insights…"}</p>}
  {error&&<p className="muted" role="status">{ko?"추천 정보를 불러오지 못했어요. 아래에서 퀴즈를 탐색할 수 있어요.":"Insights are unavailable; browse questions below."}</p>}
  {!loading&&!error&&!present.length&&<p className="muted">
    {ko?"아직 순위를 매길 만큼의 기록이 없어요. 새로운 문제를 발견하고 첫 번째 평가를 남겨 보세요.":"Not enough reliable activity for rankings yet. Explore new quizzes and be among the first to rate them."}
  </p>}
  {present.map(section=><div className="discover-ranked-section" key={section.key}>
    <div className="discover-results-head">
      <h3>{names[section.key].icon} {ko?names[section.key].ko:names[section.key].en}</h3>
      <span className="muted">{section.key==="difficult"
        ?(ko?"충분한 완료 기록을 바탕으로":"Based on completed attempts")
        :section.key==="highly_rated"?(ko?"최소 5개 평가":"At least five ratings")
        :section.key==="trending"?(ko?"최근 7일 변화":"Recent seven-day growth")
        :section.key==="popular"?(ko?"최근 30일":"Recent 30 days")
        :(ko?"신규 공개 콘텐츠":"Recently created published content")}</span>
    </div>
    <div className="discover-grid">{section.items.map(item=><article className="feature-card discover-card" key={item.type+item.id}>
      <div className="discover-card-top">
        <span className="small-tag">{item.type==="PACK"?(ko?"퀴즈팩":"Quiz pack"):(ko?"개별 문제":"Question")}</span>
        {item.type==="PACK"&&<span className="muted">{item.questionCount}{ko?"문제":" questions"}</span>}
      </div>
      <h4>{item.title}</h4>
      <p>{item.type==="PACK"?item.subtitle:""}</p>
      <p className="muted">{ko?"제작자":"By"}: {item.creator}</p>
      {item.ratings.positivePercent!==null&&<p>👍 {item.ratings.positivePercent}% · {item.ratings.total}{ko?"명 평가":" ratings"}</p>}
      {section.key==="difficult"&&item.difficultyPercent!==null&&<p>🔥 {ko?"오답률":"Incorrect rate"} {item.difficultyPercent}%</p>}
      {section.key==="popular"&&<p>{item.started}{ko?"명 플레이":" distinct players"}</p>}
      {item.type==="PACK"&&<p className="muted">{item.orderMode==="RANDOM"?(ko?"랜덤 순서":"Random order"):(ko?"등록 순서":"Creator order")}</p>}
      <Link className="btn btn-outline discover-play-link"
        href={localizeHref(item.type==="PACK"?"/packs/"+item.id:"/play/"+item.id,locale)}>
        {item.type==="PACK"?(ko?"퀴즈팩 보기 →":"View pack →"):(ko?"문제 풀기 →":"Play →")}
      </Link>
    </article>)}</div>
  </div>)}
 </section>;
}
