-- Editorial decisions and Kids-pack metadata are independently auditable.
ALTER TABLE "QuizPack" ADD COLUMN "safetyStatus" TEXT NOT NULL DEFAULT 'PENDING';
ALTER TABLE "QuizPack" ADD COLUMN "kidsEligible" BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE "QuizPack" ADD CONSTRAINT "QuizPack_kidsApproval_check"
  CHECK (NOT "kidsEligible" OR ("safetyStatus" = 'APPROVED' AND "publication" = 'PUBLISHED'));

CREATE TABLE "EditorialFeature" (
  "id" TEXT NOT NULL,
  "targetType" TEXT NOT NULL,
  "quizId" TEXT,
  "packId" TEXT,
  "locale" TEXT NOT NULL,
  "lane" TEXT NOT NULL DEFAULT 'GENERAL',
  "placement" TEXT NOT NULL DEFAULT 'ROW',
  "priority" INTEGER NOT NULL DEFAULT 0,
  "headline" TEXT NOT NULL DEFAULT '',
  "description" TEXT NOT NULL DEFAULT '',
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "startAt" TIMESTAMP(3) NOT NULL,
  "endAt" TIMESTAMP(3) NOT NULL,
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "EditorialFeature_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "EditorialFeature_target_check" CHECK (
    ("targetType"='QUIZ' AND "quizId" IS NOT NULL AND "packId" IS NULL)
    OR ("targetType"='PACK' AND "packId" IS NOT NULL AND "quizId" IS NULL)
  ),
  CONSTRAINT "EditorialFeature_valid_check" CHECK (
    "locale" IN ('en','ko') AND "lane" IN ('GENERAL','KIDS')
    AND "placement" IN ('HERO','ROW') AND "status" IN ('ACTIVE','PAUSED')
    AND "startAt"<"endAt"
  ),
  CONSTRAINT "EditorialFeature_quizId_fkey" FOREIGN KEY ("quizId")
    REFERENCES "Quiz"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "EditorialFeature_packId_fkey" FOREIGN KEY ("packId")
    REFERENCES "QuizPack"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "EditorialFeature_createdById_fkey" FOREIGN KEY ("createdById")
    REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "EditorialFeature_locale_lane_status_placement_startAt_endAt_idx"
  ON "EditorialFeature"("locale","lane","status","placement","startAt","endAt");
CREATE INDEX "EditorialFeature_packId_idx" ON "EditorialFeature"("packId");
CREATE INDEX "EditorialFeature_quizId_idx" ON "EditorialFeature"("quizId");
