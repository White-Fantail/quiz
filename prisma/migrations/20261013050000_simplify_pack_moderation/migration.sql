-- Separate whole-pack General restriction from explicit Kids approval requests.
-- Drop the previous check BEFORE converting APPROVED packs to ACTIVE.
ALTER TABLE "QuizPack" DROP CONSTRAINT IF EXISTS "QuizPack_kidsApproval_check";
ALTER TABLE "QuizPack" ADD COLUMN "kidsReviewStatus" TEXT NOT NULL DEFAULT 'NOT_REQUESTED';
UPDATE "QuizPack" SET "kidsReviewStatus" = 'APPROVED' WHERE "kidsEligible" = TRUE;
UPDATE "QuizPack" SET "safetyStatus" = 'ACTIVE' WHERE "safetyStatus" IN ('PENDING', 'APPROVED');
ALTER TABLE "QuizPack" ALTER COLUMN "safetyStatus" SET DEFAULT 'ACTIVE';

ALTER TABLE "QuizPack" ADD CONSTRAINT "QuizPack_generalSafety_check"
  CHECK ("safetyStatus" IN ('ACTIVE','RESTRICTED'));
ALTER TABLE "QuizPack" ADD CONSTRAINT "QuizPack_kidsReviewStatus_check"
  CHECK ("kidsReviewStatus" IN ('NOT_REQUESTED','PENDING','APPROVED','REJECTED'));
ALTER TABLE "QuizPack" ADD CONSTRAINT "QuizPack_kidsApproval_check"
  CHECK (NOT "kidsEligible" OR (
    "safetyStatus" = 'ACTIVE' AND
    "kidsReviewStatus" = 'APPROVED' AND
    "publication" = 'PUBLISHED'
  ));
CREATE INDEX "QuizPack_kidsReviewStatus_publication_idx" ON "QuizPack"("kidsReviewStatus","publication");
