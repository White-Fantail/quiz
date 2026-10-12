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
    title={locale==="ko"?"퀴즈팩 어린이 안전 심사":"Kids quiz pack safety review"}
    description={locale==="ko"?"퀴즈팩 자체와 구성 문제·미디어를 독립적으로 확인한 후 승인하세요. 제작자가 팩을 수정하면 다시 심사해야 합니다.":"Independently review the pack, every member and its media. Author edits revoke previous Kids approval."}/>
  <PackSafetyConsole/>
 </main>;
}
