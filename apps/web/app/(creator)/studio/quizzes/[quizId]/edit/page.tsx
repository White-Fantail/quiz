import Link from "next/link";
import {headers} from "next/headers";
import {auth} from "../../../../../../src/lib/auth";
import {resolveLocale,localizeHref} from "../../../../../../src/i18n/core";
import ManagementHeader from "../../../../../../src/components/management-header";
import QuizEditor from "../../quiz-editor";

export const dynamic="force-dynamic";
export default async function EditQuizPage({params}:{params:Promise<{quizId:string}>}){
  const {quizId}=await params;
  const h=await headers(),locale=resolveLocale(h.get("x-quizdip-locale"));
  const session=await auth.api.getSession({headers:h});
  return <main className="container inner-page management-page studio-quiz-edit-page">
    <Link href={localizeHref("/studio",locale)} className="card-link">← {locale==="ko"?"내 문제 목록":"My quizzes"}</Link>
    <ManagementHeader eyebrow="QUIZDIP STUDIO / EDIT" title={locale==="ko"?"문제 편집":"Edit quiz"}
      description={locale==="ko"?"제목, 질문, 정답, 모든 단서를 한곳에서 수정하세요.":"Edit the title, question, answer and all clues."}/>
    {!session?<section className="placeholder-panel"><p>{locale==="ko"?"편집하려면 로그인하세요.":"Sign in to edit the quiz."}</p>
      <Link className="btn btn-primary" href={localizeHref("/sign-in?callbackURL="+encodeURIComponent("/studio/quizzes/"+quizId+"/edit"),locale)}>{locale==="ko"?"로그인":"Sign in"}</Link>
    </section>:<QuizEditor quizId={quizId}/>}
  </main>;
}
