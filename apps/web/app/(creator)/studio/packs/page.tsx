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
    description={locale==="ko"?"내 퀴즈팩을 확인하고 새 팩을 만들거나 기존 팩을 편집하세요.":"Browse your packs, create a new one or edit an existing pack."}/>
  {!session?<Link href={localizeHref("/sign-in?callbackURL=%2Fstudio%2Fpacks",locale)}>Sign in / 로그인</Link>:<PackWorkspace/>}
 </main>;
}
