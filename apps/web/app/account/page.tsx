import Link from "next/link";
import { resolveLocale, localizeHref } from "../../src/i18n/core";
import { t } from "../../src/i18n/messages";
import { headers } from "next/headers";
import { availableProviders } from "../../src/lib/auth-providers";
import SignInActions from "../sign-in/sign-in-actions";
import AccountActions from "./account-actions";

export const dynamic = "force-dynamic";

/** A broken auth service is not the same thing as a logged-out visitor. */
async function resolveSession() {
  try {
    // Dynamic import also catches auth initialization/configuration failures.
    const { auth } = await import("../../src/lib/auth");
    return { session: await auth.api.getSession({ headers: await headers() }), unavailable: false };
  } catch (error) {
    console.error("[account] Unable to resolve Better Auth session", error);
    return { session: null, unavailable: true };
  }
}

export default async function AccountPage() {
  const { session, unavailable } = await resolveSession();
  const locale = resolveLocale((await headers()).get("x-quizdip-locale"));
  const msg = (key: Parameters<typeof t>[1]) => t(locale, key);
  if (unavailable) {
    return <main className="container inner-page compact">
      <h1>{msg("account.title")}</h1>
      <p role="alert" className="feedback">{msg("account.unavailable")}</p>
      <p className="muted">{msg("account.unavailableHelp")}</p>
      <a className="btn btn-outline" href={localizeHref("/account", locale)}>{msg("account.retry")}</a>
    </main>;
  }
  if (!session) {
    return <main className="container inner-page compact">
      <h1>{msg("account.title")}</h1>
      <p>{msg("account.guest")}</p>
      <div className="placeholder-panel">
        <SignInActions google={availableProviders.google} apple={availableProviders.apple} returnTo="/account" />
      </div>
      <p className="muted">{msg("account.afterSignIn")}</p>
      <Link className="text-button" href={localizeHref("/", locale)}>{msg("account.home")}</Link>
    </main>;
  }

  // The administrator link is convenience only; /admin and its APIs check roles independently.
  let isAdmin = false;
  try {
    const { actorByIdentity } = await import("../../src/modules/platform/auth");
    isAdmin = (await actorByIdentity(session.user.id)).role === "ADMIN";
  } catch (error) {
    console.error("[account] Could not resolve platform role", error);
  }

  return <main className="container inner-page compact">
    <span className="small-tag">My QuizDip</span>
    <h1>{msg("account.title")}</h1>
    <p>{msg("account.greeting")} <b>{session.user.name}</b>!</p>
    <p className="muted">{msg("account.identity")}</p>
    {isAdmin && <div className="actions">
      <Link href={localizeHref("/admin", locale)} className="btn btn-primary">{msg("account.admin")}</Link>
    </div>}
    <div className="placeholder-panel">
      <h2>{msg("kids.guardian.title")}</h2>
      <p className="muted">{msg("kids.native.pairHelp")}</p>
      <Link className="btn btn-outline" href={localizeHref("/account/kids",locale)}>
        {msg("kids.native.pairTitle")}
      </Link>
    </div>
    <div className="placeholder-panel">
      <h2>{msg("account.providers")}</h2>
      <AccountActions google={availableProviders.google} apple={availableProviders.apple} />
    </div>
    <p className="muted">{msg("account.security")}</p>
  </main>;
}
