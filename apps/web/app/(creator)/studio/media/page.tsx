import Link from "next/link";
import { headers } from "next/headers";
import { auth } from "../../../../src/lib/auth";
import MediaLibrary from "./media-library";

export const dynamic = "force-dynamic";

export default async function StudioMediaPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  return <main className="container inner-page">
    <span className="eyebrow">CLUPIO STUDIO / MEDIA</span>
    <h1>내 미디어 보관함</h1>
    <p className="lead">문제 본문과 단서에서 재사용할 이미지, 소리, 영상을 안전하게 관리해요.</p>
    {!session ? <div className="placeholder-panel">
      <p>미디어를 업로드하려면 로그인해 주세요.</p>
      <Link href="/sign-in?callbackURL=%2Fstudio%2Fmedia" className="btn btn-primary">Google·Apple 로그인</Link>
    </div> : <MediaLibrary />}
  </main>;
}
