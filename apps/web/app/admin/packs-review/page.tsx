import ManagementHeader from "../../../src/components/management-header";
import { headers } from "next/headers";
import { notFound,redirect } from "next/navigation";
import { resolveLocale,localizeHref } from "../../../src/i18n/core";
import { actorFor } from "../../../src/modules/platform/auth";
import PackSafetyConsole from "./pack-safety-console";
export const dynamic="force-dynamic";
export default async function PackSafetyReviewPage(){
 const h=await headers(),locale=resolveLocale(h.get("x-quizdip-locale"));
 const actor=await actorFor(new Request("http://localhost/admin/packs-review",{headers:h}));
 if(!actor)redirect(localizeHref("/sign-in?callbackURL=%2Fadmin%2Fpacks-review",locale));
 if(actor.role!=="ADMIN")notFound();
 return <main className="container inner-page management-page">
  <ManagementHeader eyebrow="QUIZDIP ADMIN · KIDS"
    title={locale==="ko"?"어린이용 팩 승인 및 팩 신고 검토":"Kids pack requests and flagged packs"}
    description={locale==="ko"?"제작자가 신청한 팩만 어린이용으로 심사하고, 신고된 팩은 별도로 제한합니다.":"Approve only creator-requested Kids packs. Review reports and general restrictions separately."}/>
  <PackSafetyConsole/>
 </main>;
}
