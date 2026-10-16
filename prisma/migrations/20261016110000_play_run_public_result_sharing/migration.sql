-- Public result sharing is an explicit opt-in, with an unguessable URL per shared run.
-- Null values preserve privacy for all historic and unshared runs.
ALTER TABLE "PlayRun" ADD COLUMN "shareId" TEXT;
ALTER TABLE "PlayRun" ADD COLUMN "sharedAt" TIMESTAMP(3);
CREATE UNIQUE INDEX "PlayRun_shareId_key" ON "PlayRun"("shareId");
