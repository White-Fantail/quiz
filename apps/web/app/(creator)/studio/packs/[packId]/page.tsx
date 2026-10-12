import Link from "next/link";
import {headers} from "next/headers";
import {auth} from "../../../../../src/lib/auth";
import {resolveLocale,localizeHref} from "../../../../../src/i18n/core";
import ManagementHeader from "../../../../../src/components/management-header";
import PackEditor from "../pack-editor";
import {listBackHref} from "../../../../../src/lib/list-back-href";

export const dynamic="force-dynamic";
export default async function EditPackPage({params,searchParams}:{params:Promise<{packId:string}>;searchParams:Promise<Record<string,string|string[]|undefined>>}){
  const {packId}=await params;
  const h=await headers(),locale=resolveLocale(h.get("x-quizdip-locale"));
  const session=await auth.api.getSession({headers:h});
  const backHref=listBackHref(localizeHref("/studio/packs",locale),await searchParams,["page"]);
  return <main className="container inner-page management-page pack-detail-page">
    <Link href={backHref} className="card-link">← {locale==="ko"?"퀴즈팩 목록":"All packs"}</Link>
    <ManagementHeader eyebrow="QUIZDIP STUDIO / PACK" title={locale==="ko"?"퀴즈팩 편집":"Edit quiz pack"}
      description={locale==="ko"?"팩 정보와 문제 순서를 수정하고 검증·공개 상태를 관리하세요.":"Edit pack details and question order, then check readiness or publish."}/>
    {!session?<Link href={localizeHref("/sign-in?callbackURL="+encodeURIComponent("/studio/packs/"+packId),locale)}>{locale==="ko"?"로그인하기":"Sign in"}</Link>:<PackEditor packId={packId}/>}
  </main>;
}
