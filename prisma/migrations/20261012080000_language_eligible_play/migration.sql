-- Phase 2: Freeze locale throughout runs, sessions and weekly featured revisions.
-- Old sessions are labelled 'und'; they remain intact and are not presented as English.
ALTER TABLE "PlayRun" ADD COLUMN "locale" TEXT NOT NULL DEFAULT 'und';
ALTER TABLE "PlaySession" ADD COLUMN "locale" TEXT NOT NULL DEFAULT 'und';
CREATE INDEX "PlayRun_weeklyId_locale_status_score_idx" ON "PlayRun"("weeklyId", "locale", "status", "score");
CREATE TABLE "WeeklyQuestionLocalization" (
  "challengeId" TEXT NOT NULL,
  "position" INTEGER NOT NULL,
  "locale" TEXT NOT NULL,
  "revisionId" TEXT NOT NULL,
  CONSTRAINT "WeeklyQuestionLocalization_pkey" PRIMARY KEY ("challengeId","position","locale")
);
CREATE INDEX "WeeklyQuestionLocalization_revisionId_idx" ON "WeeklyQuestionLocalization"("revisionId");
ALTER TABLE "WeeklyQuestionLocalization" ADD CONSTRAINT "WeeklyQuestionLocalization_challengeId_fkey"
  FOREIGN KEY ("challengeId") REFERENCES "WeeklyChallenge"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WeeklyQuestionLocalization" ADD CONSTRAINT "WeeklyQuestionLocalization_revisionId_fkey"
  FOREIGN KEY ("revisionId") REFERENCES "QuizRevision"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- Previously pinned weekly editions intentionally have no translations: they must be explicitly verified.
