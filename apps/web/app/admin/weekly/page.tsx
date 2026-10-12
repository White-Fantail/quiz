import { redirect, notFound } from "next/navigation";
import { headers } from "next/headers";
import { resolveLocale, localizeHref } from "../../../src/i18n/core";
import { actorFor } from "../../../src/modules/platform/auth";
/** Archived route still independently enforces ADMIN before redirecting. */
export default async function RetiredWeeklyAdminPage() {
  const requestHeaders=await headers();
  const actor=await actorFor(new Request("http://localhost/admin/weekly",{headers:requestHeaders}));
  if(!actor || actor.role !== "ADMIN") notFound();
  redirect(localizeHref("/admin",resolveLocale(requestHeaders.get("x-quizdip-locale"))));
}
