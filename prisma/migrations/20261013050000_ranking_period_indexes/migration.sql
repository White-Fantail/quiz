-- Additive indexes for accurate on-demand UTC day/week/month aggregations.
-- Preserves all historic play sessions and ranking consent settings.
CREATE INDEX IF NOT EXISTS "User_leaderboardEligible_leaderboardOptIn_idx"
  ON "User"("leaderboardEligible","leaderboardOptIn");
CREATE INDEX IF NOT EXISTS "PlaySession_userId_status_finishedAt_idx"
  ON "PlaySession"("userId","status","finishedAt");
CREATE INDEX IF NOT EXISTS "PlaySession_status_finishedAt_idx"
  ON "PlaySession"("status","finishedAt");
