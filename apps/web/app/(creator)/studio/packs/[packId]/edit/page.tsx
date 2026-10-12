import Link from "next/link";
import {headers} from "next/headers";
import {auth} from "../../../../../../src/lib/auth";
import {resolveLocale,localizeHref} from "../../../../../../src/i18n/core";
import {listBackHref} from "../../../../../../src/lib/list-back-href";
import ManagementHeader from "../../../../../../src/components/management-header";
import PackEditor from "../../pack-editor";

export const dynamic="force-dynamic";
export default async function EditPackPage({params,searchParams}:{
  params:Promise<{packId:string}>;
  searchParams:Promise<Record<string,string|string[]|undefined>>;
}){
  const {packId}=await params;
  const h=await headers(),locale=resolveLocale(h.get("x-quizdip-locale"));
  const session=await auth.api.getSession({headers:h});
  const detailHref=listBackHref(localizeHref("/studio/packs/"+packId,locale),await searchParams,["page"]);
  return <main className="container inner-page management-page pack-detail-page">
    <Link href={detailHref} className="card-link">← {locale==="ko"?"팩 상세 보기":"Pack details"}</Link>
    <ManagementHeader eyebrow="QUIZDIP STUDIO / PACK EDIT" title={locale==="ko"?"퀴즈팩 편집":"Edit quiz pack"}
      description={locale==="ko"?"제목, 설명, 포함 문제와 출제 순서를 수정하세요.":"Edit its title, description, included questions and play order."}/>
    {!session?<section className="placeholder-panel">
      <Link className="btn btn-primary" href={localizeHref("/sign-in?callbackURL="+encodeURIComponent("/studio/packs/"+packId+"/edit"),locale)}>
        {locale==="ko"?"로그인":"Sign in"}</Link></section>:
      <PackEditor packId={packId} detailHref={detailHref}/>}
  </main>;
}
