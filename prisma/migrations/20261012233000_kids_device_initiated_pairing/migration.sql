-- New device-initiated QR / 6-digit fallback enrollment. Legacy long-code tickets
-- remain available for already-installed native app versions.
ALTER TABLE "KidGuardianPin"
  ADD COLUMN "pairCodeAttempts" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "pairCodeLockedUntil" TIMESTAMP(3);

CREATE TABLE "KidPairRequest" (
  "id" TEXT NOT NULL,
  "deviceSecretHash" TEXT NOT NULL,
  "approvalHash" TEXT NOT NULL,
  "shortCodeHash" TEXT NOT NULL,
  "deviceName" TEXT NOT NULL,
  "guardianId" TEXT,
  "profileId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "approvedAt" TIMESTAMP(3),
  "claimedAt" TIMESTAMP(3),
  CONSTRAINT "KidPairRequest_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "KidPairRequest_deviceSecretHash_key" ON "KidPairRequest"("deviceSecretHash");
CREATE UNIQUE INDEX "KidPairRequest_approvalHash_key" ON "KidPairRequest"("approvalHash");
CREATE UNIQUE INDEX "KidPairRequest_shortCodeHash_key" ON "KidPairRequest"("shortCodeHash");
CREATE INDEX "KidPairRequest_expiresAt_approvedAt_claimedAt_idx" ON "KidPairRequest"("expiresAt","approvedAt","claimedAt");
CREATE INDEX "KidPairRequest_guardianId_expiresAt_idx" ON "KidPairRequest"("guardianId","expiresAt");
ALTER TABLE "KidPairRequest" ADD CONSTRAINT "KidPairRequest_guardianId_fkey"
  FOREIGN KEY ("guardianId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "KidPairRequest" ADD CONSTRAINT "KidPairRequest_profileId_fkey"
  FOREIGN KEY ("profileId") REFERENCES "KidProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
