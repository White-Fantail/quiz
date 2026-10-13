import ManagementHeader from "../../../src/components/management-header";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { resolveLocale, localizeHref } from "../../../src/i18n/core";
import { bilingual } from "../../../src/i18n/view-copy";
import { actorFor } from "../../../src/modules/platform/auth";
import MediaReviewConsole from "./media-review-console";

export const dynamic = "force-dynamic";

export default async function AdminMediaReviewPage() {
  const requestHeaders = await headers();
  const locale = resolveLocale(requestHeaders.get("x-quizdip-locale"));
  const msg = (en:string,ko:string) => bilingual(locale,en,ko);
  const actor = await actorFor(new Request("http://localhost/admin/media-review",{headers:requestHeaders}));
  if (!actor) redirect(localizeHref("/sign-in?callbackURL=%2Fadmin%2Fmedia-review",locale));
  if (actor.role !== "ADMIN") notFound();
  return <main className="container inner-page management-page">
    <ManagementHeader eyebrow="QUIZDIP ADMIN · MEDIA" title={msg("Media review","미디어 심사")}
      description={msg("Approve media directly in the queue. Restricting media always requires an explanation.","대기 목록에서 바로 승인할 수 있습니다. 미디어를 거부·제한할 때는 반드시 사유를 기록합니다.")}/>
    <MediaReviewConsole />
  </main>;
}
