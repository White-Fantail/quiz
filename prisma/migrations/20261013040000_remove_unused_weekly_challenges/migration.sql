-- QuizDip retired Weekly Five before any challenge was launched.
-- Guard against accidentally deleting live or historical data in another environment.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "WeeklyChallenge")
     OR EXISTS (SELECT 1 FROM "WeeklyQuestion")
     OR EXISTS (SELECT 1 FROM "WeeklyQuestionLocalization")
     OR EXISTS (SELECT 1 FROM "PlayRun" WHERE "mode" = 'WEEKLY' OR "weeklyId" IS NOT NULL)
  THEN
    RAISE EXCEPTION 'Cannot remove weekly challenge schema: existing weekly records or runs detected. Audit and migrate this data before retrying.';
  END IF;
END
$$;

-- Only the unused weekly artifacts are removed; ordinary random and pack
-- runs, their scores, sessions, revisions and child ownership are untouched.
DROP INDEX IF EXISTS "PlayRun_one_weekly_account";
DROP INDEX IF EXISTS "PlayRun_weeklyId_status_score_idx";
ALTER TABLE "PlayRun" DROP COLUMN "weeklyId";
ALTER TABLE "PlayRun" DROP COLUMN "officialEligible";

DROP TABLE "WeeklyQuestionLocalization";
DROP TABLE "WeeklyQuestion";
DROP TABLE "WeeklyChallenge";

-- Fix the inherited v1 mode constraint: the pack-play migration introduces
-- PACK runs, while the old check still allowed obsolete WEEKLY and rejected PACK.
ALTER TABLE "PlayRun" DROP CONSTRAINT "PlayRun_mode_check";
ALTER TABLE "PlayRun" ADD CONSTRAINT "PlayRun_mode_check"
  CHECK ("mode" IN ('RANDOM_FIVE', 'INFINITE', 'PACK'));
