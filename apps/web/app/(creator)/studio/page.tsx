import Link from "next/link";
import { headers } from "next/headers";
import { auth } from "../../../src/lib/auth";
import StudioWorkspace from "./studio-workspace";

export const dynamic = "force-dynamic";

export default async function StudioPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  return <main className="container inner-page studio-home">
    <span className="eyebrow">QUIZDIP STUDIO</span>
    <h1>내 퀴즈 스튜디오</h1>
    <p className="lead">직접 만든 문제를 검색하고 관리하며, 플레이 결과와 피드백으로 더 재미있게 다듬어 보세요.</p>
    <div className="actions studio-home-actions">
      <Link href="/studio/weekly" className="btn btn-outline">주간 출제자 도전하기</Link>
      <Link href="/studio/media" className="btn btn-outline">미디어 보관함</Link>
    </div>
    {!session ? <section className="placeholder-panel">
      <h2>로그인하고 내 문제를 관리하세요</h2>
      <p>QuizDip 계정으로 등록한 퀴즈, 결과, 피드백은 작성자 본인에게만 관리 권한이 있어요.</p>
      <Link href="/sign-in?callbackURL=%2Fstudio" className="btn btn-primary">Google·Apple 로그인</Link>
    </section> : <StudioWorkspace/>}
  </main>;
}
