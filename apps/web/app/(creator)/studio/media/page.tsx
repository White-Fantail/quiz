import ManagementHeader from "../../../../src/components/management-header";
import { resolveLocale,localizeHref } from "../../../../src/i18n/core";
import { bilingual } from "../../../../src/i18n/view-copy";
import Link from "next/link";
import { headers } from "next/headers";
import { auth } from "../../../../src/lib/auth";
import MediaLibrary from "./media-library";
import MediaAddButton from "./media-add-button";

export const dynamic = "force-dynamic";

export default async function StudioMediaPage() {
  const requestHeaders=await headers();
  const locale=resolveLocale(requestHeaders.get("x-quizdip-locale"));
  const msg=(en:string,ko:string)=>bilingual(locale,en,ko);
  const session = await auth.api.getSession({ headers: requestHeaders });
  return <main className="container inner-page management-page">
    <ManagementHeader eyebrow="QUIZDIP STUDIO / MEDIA" title={msg("My media library","내 미디어 보관함")} description={msg("Manage images, audio and video for your quiz questions and clues.","문제 본문과 단서에서 재사용할 이미지, 소리, 영상을 안전하게 관리해요.")} actions={session ? <MediaAddButton>{msg("+ Add media","+ 미디어 추가")}</MediaAddButton> : undefined}/>
    {!session ? <div className="placeholder-panel">
      <p>{msg("Sign in to upload media.","미디어를 업로드하려면 로그인해 주세요.")}</p>
      <Link href={localizeHref("/sign-in?callbackURL=%2Fstudio%2Fmedia",locale)} className="btn btn-primary">{msg("Sign in with Google or Apple","Google·Apple 로그인")}</Link>
    </div> : <MediaLibrary />}
  </main>;
}
