import Link from "next/link";
import {headers} from "next/headers";
import {auth} from "../../../../../src/lib/auth";
import {resolveLocale,localizeHref} from "../../../../../src/i18n/core";
import {listBackHref} from "../../../../../src/lib/list-back-href";
import PackDetail from "../pack-detail";

export const dynamic="force-dynamic";
export default async function StudioPackPage({params,searchParams}:{
  params:Promise<{packId:string}>;
  searchParams:Promise<Record<string,string|string[]|undefined>>;
}){
  const {packId}=await params;
  const h=await headers(),locale=resolveLocale(h.get("x-quizdip-locale"));
  const session=await auth.api.getSession({headers:h});
  const query=await searchParams;
  const backHref=listBackHref(localizeHref("/studio/packs",locale),query,["page"]);
  const editHref=listBackHref(localizeHref("/studio/packs/"+packId+"/edit",locale),query,["page"]);
  return <main className="container inner-page management-page pack-detail-page">
    <Link href={backHref} className="card-link">← {locale==="ko"?"퀴즈팩 목록":"All packs"}</Link>
    <span className="eyebrow">QUIZDIP STUDIO / PACK</span>
    {!session?<section className="placeholder-panel">
      <h1>{locale==="ko"?"로그인이 필요합니다":"Sign in to manage this pack"}</h1>
      <Link className="btn btn-primary" href={localizeHref("/sign-in?callbackURL="+encodeURIComponent("/studio/packs/"+packId),locale)}>
        {locale==="ko"?"로그인":"Sign in"}</Link>
    </section>:<PackDetail packId={packId} backHref={backHref} editHref={editHref}/>}
  </main>;
}
