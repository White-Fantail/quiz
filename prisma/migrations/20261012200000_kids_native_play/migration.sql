-- Private ownership of native child runs/sessions; does not change adult rankings.
CREATE TABLE "KidPlayRun" (
  "runId" TEXT NOT NULL,
  "profileId" TEXT NOT NULL,
  "deviceId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "KidPlayRun_pkey" PRIMARY KEY ("runId")
);
CREATE INDEX "KidPlayRun_profileId_createdAt_idx" ON "KidPlayRun"("profileId","createdAt");
CREATE INDEX "KidPlayRun_profileId_deviceId_idx" ON "KidPlayRun"("profileId","deviceId");
ALTER TABLE "KidPlayRun" ADD CONSTRAINT "KidPlayRun_runId_fkey"
 FOREIGN KEY ("runId") REFERENCES "PlayRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "KidPlayRun" ADD CONSTRAINT "KidPlayRun_profileId_fkey"
 FOREIGN KEY ("profileId") REFERENCES "KidProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "KidPlaySingle" (
  "sessionId" TEXT NOT NULL,
  "profileId" TEXT NOT NULL,
  "deviceId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "KidPlaySingle_pkey" PRIMARY KEY ("sessionId")
);
CREATE INDEX "KidPlaySingle_profileId_createdAt_idx" ON "KidPlaySingle"("profileId","createdAt");
ALTER TABLE "KidPlaySingle" ADD CONSTRAINT "KidPlaySingle_sessionId_fkey"
 FOREIGN KEY ("sessionId") REFERENCES "PlaySession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "KidPlaySingle" ADD CONSTRAINT "KidPlaySingle_profileId_fkey"
 FOREIGN KEY ("profileId") REFERENCES "KidProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
