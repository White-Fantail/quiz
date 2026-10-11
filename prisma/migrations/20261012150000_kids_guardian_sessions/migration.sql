-- Guardian-owned private child profiles, server-side PIN lockout and opaque device sessions.
CREATE TABLE "KidProfile" (
 "id" TEXT NOT NULL,
 "guardianId" TEXT NOT NULL,
 "nickname" TEXT NOT NULL,
 "ageBand" TEXT NOT NULL DEFAULT 'MIDDLE',
 "locale" TEXT NOT NULL DEFAULT 'en',
 "sessionMinutes" INTEGER NOT NULL DEFAULT 0,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "updatedAt" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "KidProfile_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "KidProfile_guardianId_updatedAt_idx" ON "KidProfile"("guardianId", "updatedAt");
ALTER TABLE "KidProfile" ADD CONSTRAINT "KidProfile_guardianId_fkey"
 FOREIGN KEY ("guardianId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE TABLE "KidGuardianPin" (
 "guardianId" TEXT NOT NULL,
 "hash" TEXT NOT NULL,
 "attempts" INTEGER NOT NULL DEFAULT 0,
 "lockedUntil" TIMESTAMP(3),
 "updatedAt" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "KidGuardianPin_pkey" PRIMARY KEY ("guardianId")
);
ALTER TABLE "KidGuardianPin" ADD CONSTRAINT "KidGuardianPin_guardianId_fkey"
 FOREIGN KEY ("guardianId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE TABLE "KidDeviceSession" (
 "id" TEXT NOT NULL,
 "guardianId" TEXT NOT NULL,
 "profileId" TEXT NOT NULL,
 "tokenHash" TEXT NOT NULL,
 "deviceName" TEXT NOT NULL,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "expiresAt" TIMESTAMP(3) NOT NULL,
 "revokedAt" TIMESTAMP(3),
 CONSTRAINT "KidDeviceSession_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "KidDeviceSession_tokenHash_key" ON "KidDeviceSession"("tokenHash");
CREATE INDEX "KidDeviceSession_guardianId_revokedAt_idx" ON "KidDeviceSession"("guardianId","revokedAt");
CREATE INDEX "KidDeviceSession_profileId_revokedAt_expiresAt_idx" ON "KidDeviceSession"("profileId","revokedAt","expiresAt");
ALTER TABLE "KidDeviceSession" ADD CONSTRAINT "KidDeviceSession_guardianId_fkey"
 FOREIGN KEY ("guardianId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "KidDeviceSession" ADD CONSTRAINT "KidDeviceSession_profileId_fkey"
 FOREIGN KEY ("profileId") REFERENCES "KidProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
