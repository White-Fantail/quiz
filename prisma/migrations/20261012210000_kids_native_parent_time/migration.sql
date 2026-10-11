-- Phase 4: time budgets are separate from the legacy web cookie expiry field.
ALTER TABLE "KidProfile" ADD COLUMN "dailyMinutes" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "KidProfile" ADD COLUMN "playSessionMinutes" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "KidProfile" ADD COLUMN "breakEveryMinutes" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "KidProfile" ADD COLUMN "timeZone" TEXT NOT NULL DEFAULT 'Pacific/Auckland';
ALTER TABLE "KidDeviceSession" ADD COLUMN "playStartedAt" TIMESTAMP(3);
ALTER TABLE "KidDeviceSession" ADD COLUMN "lastUsageAt" TIMESTAMP(3);
ALTER TABLE "KidDeviceSession" ADD COLUMN "breakUntil" TIMESTAMP(3);
CREATE TABLE "KidParentAccess" (
  "id" TEXT NOT NULL,"guardianId" TEXT NOT NULL,"deviceId" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3) NOT NULL,"revokedAt" TIMESTAMP(3),
  CONSTRAINT "KidParentAccess_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "KidParentAccess_tokenHash_key" ON "KidParentAccess"("tokenHash");
CREATE INDEX "KidParentAccess_guardianId_expiresAt_idx" ON "KidParentAccess"("guardianId","expiresAt");
ALTER TABLE "KidParentAccess" ADD CONSTRAINT "KidParentAccess_guardianId_fkey"
 FOREIGN KEY ("guardianId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "KidParentAccess" ADD CONSTRAINT "KidParentAccess_deviceId_fkey"
 FOREIGN KEY ("deviceId") REFERENCES "KidDeviceSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE TABLE "KidUsageMinute" (
  "id" TEXT NOT NULL,"profileId" TEXT NOT NULL,"deviceId" TEXT NOT NULL,
  "utcMinute" INTEGER NOT NULL,"localDay" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "KidUsageMinute_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "KidUsageMinute_profileId_utcMinute_key" ON "KidUsageMinute"("profileId","utcMinute");
CREATE INDEX "KidUsageMinute_profileId_localDay_idx" ON "KidUsageMinute"("profileId","localDay");
CREATE INDEX "KidUsageMinute_createdAt_idx" ON "KidUsageMinute"("createdAt");
ALTER TABLE "KidUsageMinute" ADD CONSTRAINT "KidUsageMinute_profileId_fkey"
 FOREIGN KEY ("profileId") REFERENCES "KidProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
