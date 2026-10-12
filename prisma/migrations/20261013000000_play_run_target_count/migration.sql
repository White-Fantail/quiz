-- Backward-compatible length for future pack play. INFINITE stays unbounded (NULL).
ALTER TABLE "PlayRun" ADD COLUMN "targetCount" INTEGER;
UPDATE "PlayRun" SET "targetCount" = 5 WHERE "mode" IN ('WEEKLY', 'RANDOM_FIVE');
ALTER TABLE "PlayRun" ADD CONSTRAINT "PlayRun_targetCount_check" CHECK ("targetCount" IS NULL OR "targetCount" > 0);
