import Link from "next/link";
import { headers } from "next/headers";
import { resolveLocale,localizeHref } from "../../../src/i18n/core";
import { packList } from "../../../src/modules/platform/social";
export const dynamic="force-dynamic";
export default async function PackCatalog({searchParams}:{searchParams:Promise<{page?:string}>}){
  const locale=resolveLocale((await headers()).get("x-quizdip-locale"));
  const params=await searchParams;
  const page=Math.min(100,Math.max(0,Number.parseInt(params.page||"0",10)||0));
  const {items}=await packList({mine:false,locale,limit:20,offset:page*20},null);
  return <main className="container inner-page management-page">
    <div className="play-intro"><span className="eyebrow">QUIZDIP · DISCOVER</span>
      <h1>{locale==="ko"?"퀴즈팩 탐색":"Explore quiz packs"}</h1>
      <p className="lead">{locale==="ko"?"제작자가 직접 구성한 문제를 순서대로 플레이하세요.":"Play complete question collections created by the community."}</p>
    </div>
    {!items.length&&<p>{locale==="ko"?"현재 이 언어로 플레이할 수 있는 퀴즈팩이 없어요.":"No playable quiz packs in this language yet."}</p>}
    <div className="cards">{items.map(pack=><article key={pack.id} className="feature-card">
      <span className="small-tag">{locale==="ko"?"퀴즈팩":"Quiz pack"}</span>
      <h2>{pack.title}</h2><p>{pack.description}</p>
      <p className="muted">{pack.quizIds.length} {locale==="ko"?"문제":"questions"}</p>
      <Link className="btn btn-primary" href={localizeHref("/packs/"+pack.id,locale)}>{locale==="ko"?"팩 보기 →":"View pack →"}</Link>
    </article>)}</div>
    <nav className="media-pagination">
      {page>0&&<Link className="btn btn-outline" href={localizeHref("/packs?page="+(page-1),locale)}>{locale==="ko"?"이전":"Previous"}</Link>}
      {items.length===20&&<Link className="btn btn-outline" href={localizeHref("/packs?page="+(page+1),locale)}>{locale==="ko"?"다음":"Next"}</Link>}
    </nav>
  </main>;
}
