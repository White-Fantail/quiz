import Link from "next/link";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "../../../../../../src/lib/auth";
import { db } from "../../../../../../src/modules/platform/db";
import StudioQuizPreview from "./studio-quiz-preview";

export const dynamic = "force-dynamic";

export default async function StudioQuizPreviewPage({params}: {
  params: Promise<{ quizId: string }>
}) {
  const {quizId}=await params;
  const session=await auth.api.getSession({headers:await headers()});
  if(!session?.user?.id){
    return <main className="container inner-page">
      <div className="placeholder-panel">
        <h1>Studio preview · 로그인 필요</h1>
        <p>미리보기는 문제 제작자만 사용할 수 있어요.</p>
        <Link className="btn btn-primary" href={"/sign-in?callbackURL="+encodeURIComponent("/studio/quizzes/"+quizId+"/preview")}>로그인하기</Link>
      </div>
    </main>;
  }
  // Do not render an owner preview or call private media APIs for other authors.
  const owned=await db().quiz.findFirst({
    where:{id:quizId,authorId:session.user.id},
    select:{id:true}
  });
  if(!owned) notFound();
  return <StudioQuizPreview quizId={owned.id}/>;
}
