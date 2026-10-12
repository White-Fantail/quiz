import { headers } from "next/headers";
import { auth } from "../../../../src/lib/auth";
import { resolveLocale, localizeHref } from "../../../../src/i18n/core";
import Link from "next/link";
import ManagementHeader from "../../../../src/components/management-header";
import PackWorkspace from "./pack-workspace";
export const dynamic="force-dynamic";
export default async function StudioPacks(){
 const h=await headers(),locale=resolveLocale(h.get("x-quizdip-locale"));
 const session=await auth.api.getSession({headers:h});
 return <main className="container inner-page management-page">
  <ManagementHeader eyebrow="QUIZDIP STUDIO" title={locale==="ko"?"퀴즈팩 관리":"Manage quiz packs"}
    description={locale==="ko"?"문제를 묶고 순서를 정한 뒤 검증하고 공개하세요.":"Organize questions, preview readiness and publish together."}/>
  {!session?<Link href={localizeHref("/sign-in?callbackURL=%2Fstudio%2Fpacks",locale)}>Sign in / 로그인</Link>:<PackWorkspace/>}
 </main>;
}
