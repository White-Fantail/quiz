import Link from "next/link";
import { headers } from "next/headers";
import { auth } from "../../../../../src/lib/auth";
import { resolveLocale,localizeHref } from "../../../../../src/i18n/core";
import { bilingual } from "../../../../../src/i18n/view-copy";
import ManagementHeader from "../../../../../src/components/management-header";
import MediaCreate from "./media-create";

export const dynamic="force-dynamic";

export default async function StudioMediaCreatePage({searchParams}:{searchParams:Promise<{method?:string;returnTo?:string}>}) {
  const requestHeaders=await headers();
  const locale=resolveLocale(requestHeaders.get("x-quizdip-locale"));
  const msg=(en:string,ko:string)=>bilingual(locale,en,ko);
  const session=await auth.api.getSession({headers:requestHeaders});
  const query=await searchParams;
  const method=query.method==="url"?"url":"upload";
  const callbackURL=encodeURIComponent(localizeHref("/studio/media/new",locale)+(method==="url"?"?method=url":""));
  return <main className="container inner-page management-page media-create-page">
    <ManagementHeader eyebrow="QUIZDIP STUDIO / MEDIA" title={msg("Add media","미디어 추가")} description={msg("Upload a file or import an image URL into your private media library.","파일을 업로드하거나 이미지 주소로 내 미디어 보관함에 추가하세요.")}/>
    {!session ? <div className="placeholder-panel">
      <p>{msg("Sign in to add media.","미디어를 추가하려면 로그인해 주세요.")}</p>
      <Link href={localizeHref("/sign-in?callbackURL="+callbackURL,locale)} className="btn btn-primary">{msg("Sign in with Google or Apple","Google·Apple 로그인")}</Link>
    </div> : <MediaCreate initialMethod={method} returnTo={query.returnTo}/>}
  </main>;
}
