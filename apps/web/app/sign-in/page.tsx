import { headers } from "next/headers";
import { resolveLocale } from "../../src/i18n/core";
import { t } from "../../src/i18n/messages";
import { availableProviders } from "../../src/lib/auth-providers";
import SignInActions from "./sign-in-actions";

export const dynamic = "force-dynamic";
export default async function SignInPage({ searchParams }: {
  searchParams: Promise<{ callbackURL?: string; redirect?: string }>;
}) {
  const locale = resolveLocale((await headers()).get("x-quizdip-locale"));
  const params = await searchParams;
  const requested = params.callbackURL || params.redirect || "/account";
  // Only same-site paths may be used after sign-in.
  const returnTo = requested.startsWith("/") && !requested.startsWith("//") ? requested : "/account";
  return (
    <main className="container inner-page compact">
      <span className="small-tag">QuizDip Account</span>
      <h1>{t(locale, "signIn.title")}</h1>
      <p className="muted">{t(locale, "signIn.lead")}</p>
      <div className="placeholder-panel">
        <SignInActions google={availableProviders.google} apple={availableProviders.apple} returnTo={returnTo} />
        <p className="muted">{t(locale, "signIn.note")}</p>
      </div>
    </main>
  );
}
