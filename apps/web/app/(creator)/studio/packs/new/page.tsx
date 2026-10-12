import Link from "next/link";
import {headers} from "next/headers";
import {auth} from "../../../../../src/lib/auth";
import {resolveLocale,localizeHref} from "../../../../../src/i18n/core";
import ManagementHeader from "../../../../../src/components/management-header";
import PackEditor from "../pack-editor";

export const dynamic="force-dynamic";
export default async function NewPackPage(){
  const h=await headers(),locale=resolveLocale(h.get("x-quizdip-locale"));
  const session=await auth.api.getSession({headers:h});
  return <main className="container inner-page management-page pack-detail-page">
    <Link href={localizeHref("/studio/packs",locale)} className="card-link">← {locale==="ko"?"퀴즈팩 목록":"All packs"}</Link>
    <ManagementHeader eyebrow="QUIZDIP STUDIO / PACK" title={locale==="ko"?"새 퀴즈팩 만들기":"Create quiz pack"}
      description={locale==="ko"?"팩 정보를 입력하고 포함할 문제를 선택하세요.":"Enter the pack details and choose its questions."}/>
    {!session?<Link href={localizeHref("/sign-in?callbackURL=%2Fstudio%2Fpacks%2Fnew",locale)}>{locale==="ko"?"로그인하기":"Sign in"}</Link>:<PackEditor/>}
  </main>;
}
