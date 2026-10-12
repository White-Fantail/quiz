import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { resolveLocale,localizeHref } from "../../../../src/i18n/core";
import { PlatformError } from "../../../../src/modules/platform/auth";
import { packGet } from "../../../../src/modules/platform/social";
export const dynamic="force-dynamic";
async function fetchPack(id:string){
  const locale=resolveLocale((await headers()).get("x-quizdip-locale"));
  try{return await packGet({id,locale},null);}
  catch(e){if(e instanceof PlatformError && e.status===404)notFound();throw e;}
}
export async function generateMetadata({params}:{params:Promise<{packId:string}>}):Promise<Metadata>{
  const {packId}=await params;
  const pack=await fetchPack(packId);
  return {title:pack.title+" · QuizDip",description:pack.description||"Discover this QuizDip question pack.",
    robots:{index:true,follow:true}};
}
export default async function PackDetail({params}:{params:Promise<{packId:string}>}){
 const {packId}=await params;
 const pack=await fetchPack(packId);
 const locale=resolveLocale((await headers()).get("x-quizdip-locale"));
 return <main className="container inner-page management-page">
  <div className="play-intro"><span className="eyebrow">QUIZDIP · QUIZ PACK</span>
   <h1>{pack.title}</h1><p className="lead">{pack.description}</p></div>
  <section className="feature-card">
   <p>{locale==="ko"?"제작자":"Created by"}: <strong>{pack.author.displayName}</strong></p>
   <p><strong>{pack.questionCount}</strong> {pack.orderMode==="RANDOM"?(locale==="ko"?"개의 문제 · 시작할 때 랜덤 순서":"questions · shuffled at the start"):(locale==="ko"?"개의 문제 · 제작자가 정한 순서":"questions · creator-defined order")}</p>
   <div className="actions">
    <Link href={localizeHref("/packs/"+pack.id+"/play",locale)} className="btn btn-primary">{locale==="ko"?"전체 플레이 / 이어 풀기 →":"Play or resume full pack →"}</Link>
    <Link href={localizeHref("/packs",locale)} className="btn btn-outline">{locale==="ko"?"다른 퀴즈팩":"More packs"}</Link>
   </div>
  </section>
 </main>;
}
