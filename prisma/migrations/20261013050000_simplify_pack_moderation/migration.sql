-- Independent general restriction and optional creator-requested Kids review.
-- Preserve existing moderator Kids approvals; never invent a new creator request.
ALTER TABLE "QuizPack" ADD COLUMN "kidsReviewStatus" TEXT NOT NULL DEFAULT 'NOT_REQUESTED';
UPDATE "QuizPack" SET "kidsReviewStatus" = 'APPROVED' WHERE "kidsEligible" = TRUE;
UPDATE "QuizPack" SET "safetyStatus" = 'ACTIVE' WHERE "safetyStatus" IN ('PENDING', 'APPROVED');
ALTER TABLE "QuizPack" ALTER COLUMN "safetyStatus" SET DEFAULT 'ACTIVE';
CREATE INDEX "QuizPack_kidsReviewStatus_publication_idx" ON "QuizPack"("kidsReviewStatus","publication");
