import Link from "next/link";
import { headers } from "next/headers";
import { localizeHref, resolveLocale } from "../../src/i18n/core";
import { t } from "../../src/i18n/messages";

export default async function HomePage() {
  const locale = resolveLocale((await headers()).get("x-quizdip-locale"));
  const msg = (key: Parameters<typeof t>[1]) => t(locale, key);
  const url = (path: string) => localizeHref(path, locale);
  return (
    <div className="container">
      <section className="hero">
        <div className="eyebrow">A LITTLE QUIZ. A LOT OF FUN.</div>
        <h1>{msg("home.title1")}<br /><span className="purple">{msg("home.title2")}</span></h1>
        <p className="lead">{msg("home.lead1")}<br />{msg("home.lead2")}</p>
        <div className="actions">
          <Link className="btn btn-primary" href={url("/play")}>{msg("home.start")}</Link>
          <Link className="btn btn-outline" href={url("/studio")}>{msg("home.create")}</Link>
        </div>
        <div className="hero-stickers" aria-hidden="true"><span>?</span><span>✦</span><span>!</span></div>
      </section>
      <section className="section"><div className="note-strip"><b>{msg("home.weekly")}</b><Link href={url("/play")}>{msg("home.weeklyLink")}</Link></div>
        <h2>{msg("home.heading")}</h2>
        <p className="muted">{msg("home.intro")}</p>
        <div className="cards">
          <Link href={url("/discover")} className="feature-card"><span className="symbol mint">✧</span><h3>Discover</h3><p>{msg("home.discoverText")}</p><span className="card-link">{msg("home.discoverAction")}</span></Link>
          <Link href={url("/play")} className="feature-card"><span className="symbol yellow">?</span><h3>Play</h3><p>{msg("home.playText")}</p><span className="card-link">{msg("home.playAction")}</span></Link>
          <Link href={url("/studio")} className="feature-card"><span className="symbol coral">✎</span><h3>Studio</h3><p>{msg("home.studioText")}</p><span className="card-link">{msg("home.studioAction")}</span></Link>
        </div>
      </section>
      <section className="note-strip"><b>Create it. Play it. Share it.</b><span>{msg("home.tagline")}</span></section>
    </div>
  );
}
