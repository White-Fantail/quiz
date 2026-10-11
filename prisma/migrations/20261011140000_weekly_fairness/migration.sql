ALTER TABLE "PlayRun" ADD COLUMN "officialEligible" BOOLEAN NOT NULL DEFAULT FALSE;
-- Legacy attempts remain unranked until independently verified; do not backfill blindly.
