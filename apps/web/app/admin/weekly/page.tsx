import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { resolveLocale, localizeHref } from "../../../src/i18n/core";
/** Archived weekly URLs redirect rather than opening a retired scheduling UI. */
export default async function RetiredWeeklyAdminPage() {
  redirect(localizeHref("/admin",resolveLocale((await headers()).get("x-quizdip-locale"))));
}
