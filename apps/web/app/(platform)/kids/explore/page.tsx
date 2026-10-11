import { headers } from "next/headers";
import { resolveLocale } from "../../../../src/i18n/core";
import { t } from "../../../../src/i18n/messages";
import KidsGallery from "./kids-gallery";

const types = ["animal", "place", "thing", "concept"] as const;
type Type = (typeof types)[number];

export default async function KidsExplorePage({ searchParams }: {
  searchParams: Promise<{ type?: string; topic?: string }>;
}) {
  const locale = resolveLocale((await headers()).get("x-quizdip-locale"));
  const query = await searchParams;
  const input = query.type;
  const initialTopic = query.topic === "dinosaur" ? "dinosaur" : "";
  const initialType: Type | "" = types.find(type => type === input) ?? "";
  return (
    <section className="kids-section kids-inner">
      <span className="kids-eyebrow">{t(locale, "kids.nav.explore")}</span>
      <h1>{t(locale, "kids.explore.title")}</h1>
      <p className="kids-lead">{t(locale, "kids.explore.lead")}</p>
      <KidsGallery initialType={initialType} initialTopic={initialTopic} />
    </section>
  );
}
