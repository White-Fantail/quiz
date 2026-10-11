import Link from "next/link";
import { headers } from "next/headers";
import { resolveLocale } from "../../../src/i18n/core";
import { t } from "../../../src/i18n/messages";
import { kidsHref } from "../../../src/modules/kids/navigation";

const journeys = [
  { emoji: "🦕", title: "kids.topic.dinosaurs", description: "kids.topic.dinosaursDesc", type: "animal", topic: "dinosaur", theme: "lavender" },
  { emoji: "🦁", title: "kids.topic.animals", description: "kids.topic.animalsDesc", type: "animal", topic: "", theme: "peach" },
  { emoji: "🌍", title: "kids.topic.world", description: "kids.topic.worldDesc", type: "place", topic: "", theme: "mint" },
  { emoji: "🚀", title: "kids.topic.science", description: "kids.topic.scienceDesc", type: "concept", topic: "", theme: "sky" },
] as const;

export default async function KidsPage() {
  const locale = resolveLocale((await headers()).get("x-quizdip-locale"));
  return (
    <>
      <section className="kids-hero">
        <span className="kids-eyebrow">{t(locale, "kids.brand")}</span>
        <h1>{t(locale, "kids.welcome")} <span aria-hidden="true">✨</span></h1>
        <p>{t(locale, "kids.subtitle")}</p>
        <Link className="kids-action" href={kidsHref("/kids/explore", locale)}>
          {t(locale, "kids.start")} <span aria-hidden="true">→</span>
        </Link>
        <span className="kids-hero-decor" aria-hidden="true">🌟</span>
      </section>
      <section className="kids-section" aria-labelledby="kids-topics">
        <div className="kids-section-heading">
          <h2 id="kids-topics">{t(locale, "kids.chooseTopic")}</h2>
          <p>{t(locale, "kids.chooseTopicLead")}</p>
        </div>
        <div className="kids-journeys">
          {journeys.map(journey => (
            <Link className={`kids-journey kids-${journey.theme}`} key={journey.title}
              href={kidsHref("/kids/explore", locale) + "?type=" + journey.type + (journey.topic ? "&topic=" + journey.topic : "")}>
              <span className="kids-journey-emoji" aria-hidden="true">{journey.emoji}</span>
              <span className="kids-journey-title">{t(locale, journey.title)}</span>
              <span className="kids-journey-description">{t(locale, journey.description)}</span>
              <span className="kids-journey-arrow" aria-hidden="true">↗</span>
            </Link>
          ))}
        </div>
        <p className="kids-parent-hint">{t(locale, "kids.guardian.controlled")}</p>
      </section>
    </>
  );
}
