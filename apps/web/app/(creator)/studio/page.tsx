import ManagementHeader from "../../../src/components/management-header";
import Link from "next/link";
import { headers } from "next/headers";
import { auth } from "../../../src/lib/auth";
import { resolveLocale, localizeHref } from "../../../src/i18n/core";
import { t } from "../../../src/i18n/messages";
import StudioWorkspace from "./studio-workspace";

export const dynamic = "force-dynamic";

export default async function StudioPage() {
  const requestHeaders = await headers();
  const session = await auth.api.getSession({ headers: requestHeaders });
  const locale = resolveLocale(requestHeaders.get("x-quizdip-locale"));
  const msg = (key: Parameters<typeof t>[1]) => t(locale, key);
  return <main className="container inner-page studio-home management-page">
    <ManagementHeader eyebrow="QUIZDIP STUDIO" title={msg("studio.title")} description={msg("studio.lead")}/>
    <div className="actions studio-home-actions">
      <Link href={localizeHref("/studio/weekly", locale)} className="btn btn-outline">{msg("studio.weekly")}</Link>
      <Link href={localizeHref("/studio/media", locale)} className="btn btn-outline">{msg("studio.media")}</Link>
    </div>
    {!session ? <section className="placeholder-panel">
      <h2>{msg("studio.signInTitle")}</h2>
      <p>{msg("studio.signInBody")}</p>
      <Link href={localizeHref("/sign-in?callbackURL=%2Fstudio", locale)} className="btn btn-primary">{msg("studio.signIn")}</Link>
    </section> : <StudioWorkspace/>}
  </main>;
}
