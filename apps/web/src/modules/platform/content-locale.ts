/** Shared server-only language eligibility. No fallback to 'und' or other languages. */
import type { Locale } from "../../i18n/core";
import { fail } from "./auth";
import { db } from "./db";

export function publishedLocalization(locale: Locale) {
  return { some: { locale, status: "PUBLISHED" } } as const;
}
export function playableQuizWhere(locale: Locale, lane: "GENERAL" | "KIDS" = "GENERAL") {
  return {
    publication: "PUBLISHED",
    ...(lane === "KIDS" ? { safetyStatus: "APPROVED", kidsEligible: true }
      : { safetyStatus: { not: "RESTRICTED" } }),
    localizations: publishedLocalization(locale)
  };
}
export async function currentPlayableRevision(quizId: string, locale: Locale) {
  const translation = await db().quizLocalization.findUnique({
    where: { quizId_locale: { quizId, locale } }
  });
  if (!translation || translation.status !== "PUBLISHED" || translation.publishedVersion === null)
    fail(404, "locale_unavailable", "This quiz is not available in the selected language");
  const revision = await db().quizRevision.findFirst({
    where: { quizId, localizationId: translation.id, version: translation.publishedVersion }
  });
  if (!revision) fail(409, "localized_revision_missing", "Published language version is incomplete");
  return { translation, revision };
}
/** Pinned revisions are valid only for the requested locale, even if the UI changes. */
export async function assertPinnedLocale(revisionId: string, locale: Locale): Promise<void> {
  const found = await db().quizRevision.findFirst({
    where: { id: revisionId, localization: { locale, status: "PUBLISHED" } },
    select: { id: true }
  });
  if (!found) fail(409, "locale_unavailable", "Pinned quiz language is unavailable");
}
export function sameLocaleRevision(revision: { localizationId: string | null },
  translation: { id: string } | null): boolean {
  return !!translation && revision.localizationId === translation.id;
}
