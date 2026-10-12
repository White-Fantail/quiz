import Link from "next/link";
import { headers } from "next/headers";
import { auth } from "../../../../../src/lib/auth";
import StudioQuizDetail from "./quiz-detail";
import {resolveLocale,localizeHref} from "../../../../../src/i18n/core";
import {listBackHref} from "../../../../../src/lib/list-back-href";

export const dynamic = "force-dynamic";

export default async function StudioQuizPage({ params,searchParams }: { params: Promise<{quizId: string}>;searchParams:Promise<Record<string,string|string[]|undefined>> }) {
  const { quizId } = await params;
  const h=await headers(),locale=resolveLocale(h.get("x-quizdip-locale"));
  const backHref=listBackHref(localizeHref("/studio",locale),await searchParams,["q","publication","safety","sort","page"]);
  const session = await auth.api.getSession({ headers:h });
  return <main className="container inner-page studio-detail management-page">
    <Link href={backHref} className="card-link">← 내 문제 목록으로</Link>
    <span className="eyebrow">QUIZDIP STUDIO / QUIZ</span>
    {!session ? <section className="placeholder-panel">
      <h1>로그인 후 관리할 수 있어요</h1>
      <p>문제의 작성자 계정으로 로그인하세요.</p>
      <Link href={"/sign-in?callbackURL="+encodeURIComponent("/studio/quizzes/"+quizId)}
        className="btn btn-primary">로그인하기</Link>
    </section> : <StudioQuizDetail quizId={quizId} backHref={backHref}/>}
  </main>;
}
