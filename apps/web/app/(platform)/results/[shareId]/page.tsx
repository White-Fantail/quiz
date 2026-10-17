import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PlatformError } from "../../../../src/modules/platform/auth";
import { runShareGet } from "../../../../src/modules/platform/runs";
import { localizeHref } from "../../../../src/i18n/core";
import AdSlot from "../../../../src/components/ads/AdSlot";

export const dynamic = "force-dynamic";

async function sharedResult(shareId:string) {
  try{return await runShareGet({shareId});}
  catch(error){if(error instanceof PlatformError && error.status===404)notFound();throw error;}
}
// Keep Facebook's crawler on the public host, not an internal auth or preview URL.
const origin=()=>process.env.PUBLIC_ORIGIN||
  (process.env.VERCEL_PROJECT_PRODUCTION_URL ? "https://"+process.env.VERCEL_PROJECT_PRODUCTION_URL : "https://quizdip.vercel.app");

export async function generateMetadata({params}:{params:Promise<{shareId:string}>}):Promise<Metadata> {
  const {shareId}=await params;
  const result=await sharedResult(shareId);
  const korean=result.locale==="ko";
  const title=korean?`${result.title} · ${result.score}점 · QuizDip`:`${result.title} · ${result.score} points · QuizDip`;
  const description=korean?`${result.completed}문제 중 ${result.solved}문제를 맞혔어요. 당신도 도전해 보세요!`:
    `${result.solved} correct out of ${result.completed} questions. Try the quiz pack!`;
  const url=new URL("/"+(korean?"ko":"en")+"/results/"+shareId,origin()).href;
  const image=new URL("/results/"+shareId+"/og?v=3",origin()).href;
  return {title,description,metadataBase:new URL(origin()),alternates:{canonical:url},
    robots:{index:false,follow:true},
    openGraph:{type:"website",title,description,url:url+"?preview=3",siteName:"QuizDip",
      images:[{url:image,width:1200,height:630,type:"image/png",alt:title}]},
    twitter:{card:"summary_large_image",title,description,images:[image]}};
}

export default async function SharedResult({params}:{params:Promise<{shareId:string}>}) {
  const {shareId}=await params;
  const result=await sharedResult(shareId);
  const korean=result.locale==="ko";
  const packHref=localizeHref("/packs/"+result.packId,result.locale==="ko"?"ko":"en");
  return <main className="container inner-page management-page shared-result-page">
    <div className="play-intro">
      <span className="eyebrow">QUIZDIP · {korean?"공유된 결과":"SHARED RESULT"}</span>
      <h1>{korean?"나의 퀴즈팩 도전 결과":"A quiz pack result"}</h1>
      <p className="lead">{result.title}</p>
    </div>
    <section className="shared-result-detail">
      <img src={`/results/${shareId}/og?v=3`}
        width={1200} height={630} alt={korean?`${result.title} · ${result.score}점`:`${result.title} · ${result.score} points`}/>
      <div className="shared-result-stats">
        <strong>{result.score.toLocaleString(korean?"ko-KR":"en-US")}{korean?"점":" pts"}</strong>
        <span>{korean?`정답 ${result.solved}/${result.completed} · 완료 ${result.completed}문제`:
          `${result.solved}/${result.completed} correct · ${result.completed} completed`}</span>
      </div>
      <Link href={packHref} className="btn btn-primary">
        {korean?"이 퀴즈팩 도전하기 →":"Try this quiz pack →"}
      </Link>
    </section>
    <AdSlot placement="SHARED_RESULT" kids={result.kidsEligible}/>
  </main>;
}
