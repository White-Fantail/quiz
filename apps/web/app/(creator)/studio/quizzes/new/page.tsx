import Link from "next/link";
import {headers} from "next/headers";
import {auth} from "../../../../../src/lib/auth";
import {resolveLocale,localizeHref} from "../../../../../src/i18n/core";
import ManagementHeader from "../../../../../src/components/management-header";
import QuizEditor from "../quiz-editor";

export const dynamic="force-dynamic";
export default async function NewQuizPage(){
  const h=await headers(),locale=resolveLocale(h.get("x-quizdip-locale"));
  const session=await auth.api.getSession({headers:h});
  return <main className="container inner-page management-page studio-quiz-edit-page">
    <Link href={localizeHref("/studio",locale)} className="card-link">← {locale==="ko"?"내 문제 목록":"My quizzes"}</Link>
    <ManagementHeader eyebrow="QUIZDIP STUDIO / CREATE" title={locale==="ko"?"새 문제 만들기":"Create a quiz"}
      description={locale==="ko"?"질문, 정답과 단서를 직접 작성하고 초안으로 저장하세요.":"Write your own question, answer and clues, then save a draft."}/>
    {!session?<section className="placeholder-panel">
      <p>{locale==="ko"?"문제를 만들려면 로그인하세요.":"Sign in to create a quiz."}</p>
      <Link className="btn btn-primary" href={localizeHref("/sign-in?callbackURL=%2Fstudio%2Fquizzes%2Fnew",locale)}>{locale==="ko"?"로그인":"Sign in"}</Link>
    </section>:<QuizEditor/>}
  </main>;
}
