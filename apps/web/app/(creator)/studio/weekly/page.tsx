import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { resolveLocale, localizeHref } from "../../../../src/i18n/core";
/** The weekly creator submission route is archived; Studio remains available. */
export default async function RetiredWeeklyCreatorPage() {
  redirect(localizeHref("/studio",resolveLocale((await headers()).get("x-quizdip-locale"))));
}
