import Link from "next/link";
import { headers } from "next/headers";
import { resolveLocale } from "../../../../src/i18n/core";
import { t } from "../../../../src/i18n/messages";
import { kidsHref } from "../../../../src/modules/kids/navigation";

export default async function KidsTreasuresPage() {
  const locale = resolveLocale((await headers()).get("x-quizdip-locale"));
  return (
    <section className="kids-section kids-inner">
      <span className="kids-eyebrow">{t(locale, "kids.nav.treasures")}</span>
      <div className="kids-coming kids-lavender">
        <span aria-hidden="true" className="kids-big-emoji">⭐</span>
        <h1>{t(locale, "kids.treasures.title")}</h1>
        <p>{t(locale, "kids.treasures.lead")}</p>
        <p className="kids-coming-detail">{t(locale, "kids.treasures.soon")}</p>
        <Link className="kids-action" href={kidsHref("/kids/explore", locale)}>
          {t(locale, "kids.treasures.explore")}
        </Link>
      </div>
    </section>
  );
}
