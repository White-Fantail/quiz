-- Configurable, no-AI report moderation and creator publication restrictions.
ALTER TABLE "User"
  ADD COLUMN "publishingStatus" TEXT NOT NULL DEFAULT 'ACTIVE',
  ADD COLUMN "publishingRestrictedUntil" TIMESTAMP(3);

ALTER TABLE "User" ADD CONSTRAINT "User_publishingStatus_check"
  CHECK ("publishingStatus" IN ('ACTIVE', 'RESTRICTED'));

CREATE TABLE "ModerationPolicy" (
  "id" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "quizReportThreshold" INTEGER NOT NULL DEFAULT 3,
  "packReportThreshold" INTEGER NOT NULL DEFAULT 3,
  "windowHours" INTEGER NOT NULL DEFAULT 24,
  "minimumEstablishedReporters" INTEGER NOT NULL DEFAULT 2,
  "establishedAccountDays" INTEGER NOT NULL DEFAULT 7,
  "updatedById" TEXT,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ModerationPolicy_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ModerationPolicy_bounds_check" CHECK (
    "quizReportThreshold" BETWEEN 2 AND 100
    AND "packReportThreshold" BETWEEN 2 AND 100
    AND "windowHours" BETWEEN 1 AND 720
    AND "minimumEstablishedReporters" BETWEEN 0 AND 100
    AND "establishedAccountDays" BETWEEN 0 AND 90
  )
);
INSERT INTO "ModerationPolicy"
 ("id","enabled","quizReportThreshold","packReportThreshold","windowHours","minimumEstablishedReporters","establishedAccountDays")
 VALUES ('default',true,3,3,24,2,7)
 ON CONFLICT ("id") DO NOTHING;

CREATE INDEX "Report_quizId_reporterId_status_idx" ON "Report" ("quizId","reporterId","status");
CREATE INDEX "PackReport_packId_reporterId_status_idx" ON "PackReport" ("packId","reporterId","status");

-- Safety states already use a TEXT column, so UNDER_REVIEW is additive.
-- Do not rewrite existing publication/Kids approval, authors, play data or reports.
