-- Explicit creator-defined versus per-run randomized presentation.
-- Existing packs always retain their historical creator-defined order.
ALTER TABLE "QuizPack" ADD COLUMN "orderMode" TEXT NOT NULL DEFAULT 'CREATOR';
ALTER TABLE "QuizPack" ADD CONSTRAINT "QuizPack_orderMode_check" CHECK ("orderMode" IN ('CREATOR','RANDOM'));

-- Per-pack reputation is independent of Quiz/Review reputation and has real FK integrity.
CREATE TABLE "PackReview" (
  "id" TEXT NOT NULL,
  "packId" TEXT NOT NULL,
  "authorId" TEXT NOT NULL,
  "locale" TEXT NOT NULL DEFAULT 'und',
  "rating" INTEGER NOT NULL,
  "comment" TEXT NOT NULL DEFAULT '',
  "packVersionAtReview" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PackReview_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PackReview_rating_check" CHECK ("rating" IN (-1,1)),
  CONSTRAINT "PackReview_packId_fkey" FOREIGN KEY ("packId") REFERENCES "QuizPack"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "PackReview_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "PackReview_packId_authorId_locale_key" ON "PackReview"("packId","authorId","locale");
CREATE INDEX "PackReview_packId_locale_rating_idx" ON "PackReview"("packId","locale","rating");

CREATE TABLE "PackReport" (
  "id" TEXT NOT NULL,
  "packId" TEXT NOT NULL,
  "reporterId" TEXT NOT NULL,
  "locale" TEXT NOT NULL DEFAULT 'und',
  "reason" TEXT NOT NULL,
  "detail" TEXT NOT NULL DEFAULT '',
  "status" TEXT NOT NULL DEFAULT 'OPEN',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PackReport_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PackReport_packId_fkey" FOREIGN KEY ("packId") REFERENCES "QuizPack"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "PackReport_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "PackReport_packId_status_idx" ON "PackReport"("packId","status");
CREATE INDEX "PackReport_packId_locale_reason_idx" ON "PackReport"("packId","locale","reason");
CREATE INDEX "PackReport_reporterId_createdAt_idx" ON "PackReport"("reporterId","createdAt");
