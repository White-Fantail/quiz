-- First-class packs and historical run snapshots; existing quiz and weekly data is preserved.
ALTER TABLE "QuizPack" ADD COLUMN "currentVersion" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "PlayRun" ADD COLUMN "packId" TEXT;
ALTER TABLE "PlayRun" ADD COLUMN "packVersion" INTEGER;
ALTER TABLE "PlayRun" ADD CONSTRAINT "PlayRun_packId_fkey" FOREIGN KEY ("packId") REFERENCES "QuizPack"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "PlayRun_packId_status_startedAt_idx" ON "PlayRun"("packId","status","startedAt");
ALTER TABLE "PlayRun" ADD CONSTRAINT "PlayRun_pack_shape_check" CHECK (
  ("mode" = 'PACK' AND "packId" IS NOT NULL AND "packVersion" IS NOT NULL
    AND "targetCount" IS NOT NULL AND "targetCount" > 0)
  OR ("mode" <> 'PACK' AND "packId" IS NULL AND "packVersion" IS NULL)
);
