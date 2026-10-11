-- Existing ratings and reports are kept as 'und': origin locale cannot be inferred.
ALTER TABLE "Review" ADD COLUMN "locale" TEXT NOT NULL DEFAULT 'und';
ALTER TABLE "Review" ADD COLUMN "kind" TEXT NOT NULL DEFAULT 'QUIZ';
ALTER TABLE "Review" ADD COLUMN "revisionId" TEXT;
DROP INDEX IF EXISTS "Review_quizId_authorId_key";
CREATE UNIQUE INDEX "Review_quizId_authorId_locale_kind_key"
 ON "Review"("quizId", "authorId", "locale", "kind");
CREATE INDEX "Review_quizId_locale_kind_rating_idx" ON "Review"("quizId","locale","kind","rating");
ALTER TABLE "Review" ADD CONSTRAINT "Review_revisionId_fkey"
 FOREIGN KEY ("revisionId") REFERENCES "QuizRevision"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Report" ADD COLUMN "locale" TEXT NOT NULL DEFAULT 'und';
ALTER TABLE "Report" ADD COLUMN "revisionId" TEXT;
CREATE INDEX "Report_quizId_locale_reason_idx" ON "Report"("quizId","locale","reason");
ALTER TABLE "Report" ADD CONSTRAINT "Report_revisionId_fkey"
 FOREIGN KEY ("revisionId") REFERENCES "QuizRevision"("id") ON DELETE SET NULL ON UPDATE CASCADE;
