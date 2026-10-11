import Link from "next/link";
import { headers } from "next/headers";
import { auth } from "../../../../../src/lib/auth";
import StudioQuizDetail from "./quiz-detail";

export const dynamic = "force-dynamic";

export default async function StudioQuizPage({ params }: { params: Promise<{quizId: string}> }) {
  const { quizId } = await params;
  const session = await auth.api.getSession({ headers: await headers() });
  return <main className="container inner-page studio-detail">
    <Link href="/studio" className="card-link">← 내 문제 목록으로</Link>
    <span className="eyebrow">QUIZDIP STUDIO / QUIZ</span>
    {!session ? <section className="placeholder-panel">
      <h1>로그인 후 관리할 수 있어요</h1>
      <p>문제의 작성자 계정으로 로그인하세요.</p>
      <Link href={"/sign-in?callbackURL="+encodeURIComponent("/studio/quizzes/"+quizId)}
        className="btn btn-primary">로그인하기</Link>
    </section> : <StudioQuizDetail quizId={quizId}/>}
  </main>;
}
