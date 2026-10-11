-- Distinguish web-only cookies from native scoped credentials without invalidating existing sessions.
ALTER TABLE "KidDeviceSession" ADD COLUMN "clientKind" TEXT NOT NULL DEFAULT 'WEB';

CREATE TABLE "KidPairTicket" (
  "id" TEXT NOT NULL,
  "guardianId" TEXT NOT NULL,
  "profileId" TEXT NOT NULL,
  "codeHash" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "consumedAt" TIMESTAMP(3),
  CONSTRAINT "KidPairTicket_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "KidPairTicket_codeHash_key" ON "KidPairTicket"("codeHash");
CREATE INDEX "KidPairTicket_guardianId_expiresAt_consumedAt_idx" ON "KidPairTicket"("guardianId","expiresAt","consumedAt");
ALTER TABLE "KidPairTicket" ADD CONSTRAINT "KidPairTicket_guardianId_fkey" FOREIGN KEY ("guardianId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "KidPairTicket" ADD CONSTRAINT "KidPairTicket_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "KidProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
