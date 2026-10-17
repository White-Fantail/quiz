import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { resolveLocale,localizeHref } from "../../../../src/i18n/core";
import { PlatformError } from "../../../../src/modules/platform/auth";
import { packGet } from "../../../../src/modules/platform/social";
import { PackPublicReviews, PackReport, PackShare } from "../../../../src/components/pack-feedback";
import {listBackHref} from "../../../../src/lib/list-back-href";
import AdSlot from "../../../../src/components/ads/AdSlot";
export const dynamic="force-dynamic";
async function fetchPack(id:string){
  const locale=resolveLocale((await headers()).get("x-quizdip-locale"));
  try{return await packGet({id,locale},null);}
  catch(e){if(e instanceof PlatformError && e.status===404)notFound();throw e;}
}
export async function generateMetadata({params}:{params:Promise<{packId:string}>}):Promise<Metadata>{
  const {packId}=await params;
  const pack=await fetchPack(packId);
  const locale=resolveLocale((await headers()).get("x-quizdip-locale"));
  const title=pack.title+" · QuizDip";
  const description=pack.description||(`${pack.questionCount} questions · QuizDip`);
  const origin=process.env.PUBLIC_ORIGIN||process.env.BETTER_AUTH_URL||"https://quizdip.vercel.app";
  const url=new URL(localizeHref("/packs/"+pack.id,locale),origin).href;
  return {title,description,metadataBase:new URL(origin),
    alternates:{canonical:url},
    openGraph:{title,description,siteName:"QuizDip",type:"website",url},
    twitter:{card:"summary",title,description},
    robots:{index:true,follow:true}};
}
export default async function PackDetail({params,searchParams}:{params:Promise<{packId:string}>;searchParams:Promise<Record<string,string|string[]|undefined>>}){
 const {packId}=await params;
 const pack=await fetchPack(packId);
 const locale=resolveLocale((await headers()).get("x-quizdip-locale"));
 const backHref=listBackHref(localizeHref("/packs",locale),await searchParams,["page"]);
 return <main className="container inner-page management-page">
  <div className="play-intro"><span className="eyebrow">QUIZDIP · QUIZ PACK</span>
   <h1>{pack.title}</h1><p className="lead">{pack.description}</p>
   {pack.coverMediaUrl&&<img src={pack.coverMediaUrl} alt={pack.title} className="round-media" style={{maxHeight:380,objectFit:"contain",borderRadius:16,marginTop:16}}/>}</div>
  <section className="feature-card">
   <p>{locale==="ko"?"제작자":"Created by"}: <strong>{pack.author.displayName}</strong></p>
   <p className="muted">{pack.ratings.positivePercent===null
      ?(locale==="ko"?`평가 ${pack.ratings.total}명 · 표본이 부족해요.`:`${pack.ratings.total} ratings · insufficient sample`)
      :`👍 ${pack.ratings.positivePercent}% · ${pack.ratings.total} ${locale==="ko"?"명 평가":"ratings"}`}</p>
   <p><strong>{pack.questionCount}</strong> {pack.orderMode==="RANDOM"?(locale==="ko"?"개의 문제 · 시작할 때 랜덤 순서":"questions · shuffled at the start"):(locale==="ko"?"개의 문제 · 제작자가 정한 순서":"questions · creator-defined order")}</p>
   {pack.sections.length>0&&<div className="pack-section-overview"><h2>{locale==="ko"?"파트 구성":"Chapters"}</h2>
     <ol>{pack.sections.map((part,index)=><li key={part.start}><strong>{locale==="ko"?"파트 ":"Part "}{index+1} · {part.title}</strong>
       <span className="muted"> · {locale==="ko"?"문제 ":"Question "}{part.start}</span>{part.description&&<p>{part.description}</p>}</li>)}</ol>
   </div>}
   <div className="actions">
    <Link href={localizeHref("/packs/"+pack.id+"/play",locale)} className="btn btn-primary">{locale==="ko"?"전체 플레이 / 이어 풀기 →":"Play or resume full pack →"}</Link>
    <Link href={backHref} className="btn btn-outline">{locale==="ko"?"다른 퀴즈팩":"More packs"}</Link>
    <PackShare path={"/packs/"+pack.id}/>
   </div>
  </section>
  <PackPublicReviews packId={pack.id}/>
  <AdSlot placement="PACK_DETAIL" kids={pack.kidsEligible}/>
  <PackReport packId={pack.id}/>
 </main>;
}
