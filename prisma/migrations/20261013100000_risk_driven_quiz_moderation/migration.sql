-- Adults can play any published unrestricted quiz; Kids remains opt-in + staff-approved.
ALTER TABLE "Quiz" ADD COLUMN "kidsReviewStatus" TEXT NOT NULL DEFAULT 'NOT_REQUESTED';
ALTER TABLE "Quiz" ADD COLUMN "moderationReviewedAt" TIMESTAMP(3);
UPDATE "Quiz" SET "kidsReviewStatus"='APPROVED' WHERE "kidsEligible"=true AND "safetyStatus"='APPROVED';
UPDATE "Quiz" SET "safetyStatus"='ACTIVE' WHERE "safetyStatus" IN ('PENDING','APPROVED');
ALTER TABLE "Quiz" ALTER COLUMN "safetyStatus" SET DEFAULT 'ACTIVE';
CREATE INDEX "Review_quizId_kind_rating_updatedAt_idx" ON "Review"("quizId","kind","rating","updatedAt");
CREATE INDEX "Report_quizId_status_createdAt_idx" ON "Report"("quizId","status","createdAt");
