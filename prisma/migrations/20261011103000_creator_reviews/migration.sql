CREATE TABLE "CreatorReview" (
  "id" TEXT NOT NULL, "targetId" TEXT NOT NULL, "reviewerId" TEXT NOT NULL,
  "rating" INTEGER NOT NULL, "comment" TEXT NOT NULL DEFAULT '',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CreatorReview_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CreatorReview_rating_check" CHECK ("rating" IN (-1, 1))
);
CREATE UNIQUE INDEX "CreatorReview_targetId_reviewerId_key" ON "CreatorReview"("targetId","reviewerId");
CREATE INDEX "CreatorReview_targetId_createdAt_idx" ON "CreatorReview"("targetId","createdAt");
ALTER TABLE "CreatorReview" ADD CONSTRAINT "CreatorReview_targetId_fkey"
  FOREIGN KEY ("targetId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CreatorReview" ADD CONSTRAINT "CreatorReview_reviewerId_fkey"
  FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
