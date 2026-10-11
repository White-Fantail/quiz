-- A UTC Monday 00:00–Monday 00:00 weekly edition, curated by the verified author account.
CREATE TABLE "WeeklyChallenge" (
  "id" TEXT PRIMARY KEY, "lane" TEXT NOT NULL, "weekStart" TIMESTAMP(3) NOT NULL,
  "weekEnd" TIMESTAMP(3) NOT NULL, "hostId" TEXT NOT NULL,
  "title" TEXT NOT NULL, "description" TEXT NOT NULL DEFAULT '',
  "status" TEXT NOT NULL DEFAULT 'SUBMITTED', "verifiedHost" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "publishedAt" TIMESTAMP(3),
  CONSTRAINT "WeeklyChallenge_hostId_fkey" FOREIGN KEY ("hostId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "WeeklyChallenge_lane_check" CHECK ("lane" IN ('GENERAL','KIDS')),
  CONSTRAINT "WeeklyChallenge_status_check" CHECK ("status" IN ('SUBMITTED','SCHEDULED','SUSPENDED')),
  CONSTRAINT "WeeklyChallenge_week_check" CHECK ("weekEnd" > "weekStart")
);
-- Many creators may propose a week; at most one staff-approved edition per lane/week.
CREATE INDEX "WeeklyChallenge_lane_weekStart_idx" ON "WeeklyChallenge"("lane","weekStart");
CREATE UNIQUE INDEX "WeeklyChallenge_unique_scheduled" ON "WeeklyChallenge"("lane","weekStart") WHERE "status"='SCHEDULED';
CREATE INDEX "WeeklyChallenge_status_weekStart_weekEnd_idx" ON "WeeklyChallenge"("status","weekStart","weekEnd");

CREATE TABLE "WeeklyQuestion" (
  "challengeId" TEXT NOT NULL, "position" INTEGER NOT NULL,
  "quizId" TEXT NOT NULL, "revisionId" TEXT NOT NULL,
  PRIMARY KEY ("challengeId","position"),
  CONSTRAINT "WeeklyQuestion_challengeId_fkey" FOREIGN KEY ("challengeId") REFERENCES "WeeklyChallenge"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "WeeklyQuestion_quizId_fkey" FOREIGN KEY ("quizId") REFERENCES "Quiz"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "WeeklyQuestion_revisionId_fkey" FOREIGN KEY ("revisionId") REFERENCES "QuizRevision"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "WeeklyQuestion_position_check" CHECK ("position" >= 0 AND "position" < 5)
);
CREATE UNIQUE INDEX "WeeklyQuestion_challengeId_quizId_key" ON "WeeklyQuestion"("challengeId","quizId");

CREATE TABLE "PlayRun" (
  "id" TEXT PRIMARY KEY, "mode" TEXT NOT NULL, "lane" TEXT NOT NULL, "userId" TEXT,
  "weeklyId" TEXT, "tokenHash" TEXT NOT NULL, "currentIndex" INTEGER NOT NULL DEFAULT 0,
  "score" INTEGER NOT NULL DEFAULT 0, "solved" INTEGER NOT NULL DEFAULT 0, "failed" INTEGER NOT NULL DEFAULT 0,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE', "expiresAt" TIMESTAMP(3) NOT NULL,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "completedAt" TIMESTAMP(3),
  CONSTRAINT "PlayRun_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "PlayRun_weeklyId_fkey" FOREIGN KEY ("weeklyId") REFERENCES "WeeklyChallenge"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "PlayRun_mode_check" CHECK ("mode" IN ('WEEKLY','RANDOM_FIVE','INFINITE')),
  CONSTRAINT "PlayRun_lane_check" CHECK ("lane" IN ('GENERAL','KIDS')),
  CONSTRAINT "PlayRun_status_check" CHECK ("status" IN ('ACTIVE','FINISHED'))
);
-- One eligible official attempt per signed-in player per weekly edition; guests are not ranked.
CREATE UNIQUE INDEX "PlayRun_one_weekly_account" ON "PlayRun"("weeklyId","userId") WHERE "mode"='WEEKLY' AND "userId" IS NOT NULL;
CREATE INDEX "PlayRun_userId_startedAt_idx" ON "PlayRun"("userId","startedAt");
CREATE INDEX "PlayRun_weeklyId_status_score_idx" ON "PlayRun"("weeklyId","status","score");

CREATE TABLE "PlayRunQuestion" (
  "runId" TEXT NOT NULL, "position" INTEGER NOT NULL, "quizId" TEXT NOT NULL,
  "revisionId" TEXT NOT NULL, PRIMARY KEY ("runId","position"),
  CONSTRAINT "PlayRunQuestion_runId_fkey" FOREIGN KEY ("runId") REFERENCES "PlayRun"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "PlayRunQuestion_quizId_fkey" FOREIGN KEY ("quizId") REFERENCES "Quiz"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "PlayRunQuestion_revisionId_fkey" FOREIGN KEY ("revisionId") REFERENCES "QuizRevision"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "PlayRunQuestion_position_check" CHECK ("position" >= 0)
);
CREATE INDEX "PlayRunQuestion_runId_quizId_idx" ON "PlayRunQuestion"("runId","quizId");

ALTER TABLE "PlaySession" ADD COLUMN "runId" TEXT;
ALTER TABLE "PlaySession" ADD COLUMN "roundIndex" INTEGER;
ALTER TABLE "PlaySession" ADD CONSTRAINT "PlaySession_runId_fkey" FOREIGN KEY ("runId") REFERENCES "PlayRun"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE UNIQUE INDEX "PlaySession_runId_roundIndex_key" ON "PlaySession"("runId","roundIndex");
