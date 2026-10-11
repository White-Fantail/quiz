
-- Staff verification and user consent are independent gates for public rankings.
ALTER TABLE "User" ADD COLUMN "leaderboardOptIn" BOOLEAN NOT NULL DEFAULT false;
