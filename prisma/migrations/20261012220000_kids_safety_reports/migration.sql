CREATE TABLE "KidSafetyReport" (
  "id" TEXT NOT NULL,"profileId" TEXT NOT NULL,"quizId" TEXT NOT NULL,
  "reason" TEXT NOT NULL,"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "KidSafetyReport_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "KidSafetyReport_profileId_quizId_reason_key"
 ON "KidSafetyReport"("profileId","quizId","reason");
CREATE INDEX "KidSafetyReport_quizId_reason_createdAt_idx" ON "KidSafetyReport"("quizId","reason","createdAt");
ALTER TABLE "KidSafetyReport" ADD CONSTRAINT "KidSafetyReport_profileId_fkey"
 FOREIGN KEY ("profileId") REFERENCES "KidProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "KidSafetyReport" ADD CONSTRAINT "KidSafetyReport_quizId_fkey"
 FOREIGN KEY ("quizId") REFERENCES "Quiz"("id") ON DELETE CASCADE ON UPDATE CASCADE;
