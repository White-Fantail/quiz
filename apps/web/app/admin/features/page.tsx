import ManagementHeader from "../../../src/components/management-header";
import { headers } from "next/headers";
import { notFound,redirect } from "next/navigation";
import { resolveLocale,localizeHref } from "../../../src/i18n/core";
import { actorFor } from "../../../src/modules/platform/auth";
import FeatureConsole from "./feature-console";
export const dynamic="force-dynamic";
export default async function AdminFeaturesPage(){
  const h=await headers(),locale=resolveLocale(h.get("x-quizdip-locale"));
  const actor=await actorFor(new Request("http://localhost/admin/features",{headers:h}));
  if(!actor)redirect(localizeHref("/sign-in?callbackURL=%2Fadmin%2Ffeatures",locale));
  if(actor.role!=="ADMIN")notFound();
  return <main className="container inner-page management-page">
    <ManagementHeader eyebrow="QUIZDIP ADMIN · EDITORIAL"
      title={locale==="ko"?"추천 콘텐츠 편성":"Editorial recommendations"}
      description={locale==="ko"?"추천할 문제·퀴즈팩을 선택하고 언어, 대상, 기간, 우선순위를 관리하세요. 관리자 추천은 실제 인기 순위와 분리돼요.":"Curate quizzes and packs with explicit audience, locale and schedule. Editor picks are labeled separately from organic rankings."}/>
    <FeatureConsole/>
  </main>;
}
