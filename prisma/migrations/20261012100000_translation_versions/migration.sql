-- Existing revisions retain immutable IDs and player references.
-- Source and translated revisions may both have version N for one Quiz.
DROP INDEX IF EXISTS "QuizRevision_quizId_version_key";
CREATE INDEX IF NOT EXISTS "QuizRevision_quizId_version_idx" ON "QuizRevision"("quizId", "version");
ALTER TABLE "QuizLocalization" ADD COLUMN "publishedVersion" INTEGER;
UPDATE "QuizLocalization" SET "publishedVersion"="currentVersion" WHERE "status"='PUBLISHED';
