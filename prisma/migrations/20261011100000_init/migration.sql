-- Initial Clupio platform storage. Applied by prisma migrate deploy.
CREATE TABLE "User" (
  "id" TEXT NOT NULL, "issuer" TEXT NOT NULL, "subject" TEXT NOT NULL,
  "displayName" TEXT NOT NULL, "role" TEXT NOT NULL DEFAULT 'MEMBER',
  "leaderboardEligible" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "User_issuer_subject_key" ON "User"("issuer","subject");

CREATE TABLE "Quiz" (
  "id" TEXT NOT NULL, "authorId" TEXT NOT NULL, "currentVersion" INTEGER NOT NULL DEFAULT 1,
  "publication" TEXT NOT NULL DEFAULT 'DRAFT', "safetyStatus" TEXT NOT NULL DEFAULT 'PENDING',
  "kidsEligible" BOOLEAN NOT NULL DEFAULT false, "creatorIntent" JSONB, "recommendedAudience" JSONB,
  "categories" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "Quiz_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Quiz_publication_updatedAt_idx" ON "Quiz"("publication","updatedAt");
CREATE INDEX "Quiz_authorId_updatedAt_idx" ON "Quiz"("authorId","updatedAt");
ALTER TABLE "Quiz" ADD CONSTRAINT "Quiz_authorId_fkey"
  FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "QuizRevision" (
  "id" TEXT NOT NULL, "quizId" TEXT NOT NULL, "version" INTEGER NOT NULL,
  "title" TEXT NOT NULL, "prompt" TEXT NOT NULL, "mode" TEXT NOT NULL,
  "answer" JSONB NOT NULL, "clues" JSONB NOT NULL, "scoring" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "QuizRevision_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "QuizRevision_quizId_version_key" ON "QuizRevision"("quizId","version");
ALTER TABLE "QuizRevision" ADD CONSTRAINT "QuizRevision_quizId_fkey"
  FOREIGN KEY ("quizId") REFERENCES "Quiz"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "QuizPack" (
  "id" TEXT NOT NULL, "authorId" TEXT NOT NULL, "title" TEXT NOT NULL,
  "description" TEXT NOT NULL DEFAULT '', "publication" TEXT NOT NULL DEFAULT 'DRAFT',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "QuizPack_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "QuizPack" ADD CONSTRAINT "QuizPack_authorId_fkey"
  FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "PackQuestion" (
  "packId" TEXT NOT NULL, "quizId" TEXT NOT NULL, "position" INTEGER NOT NULL,
  CONSTRAINT "PackQuestion_pkey" PRIMARY KEY ("packId","quizId")
);
CREATE UNIQUE INDEX "PackQuestion_packId_position_key" ON "PackQuestion"("packId","position");
ALTER TABLE "PackQuestion" ADD CONSTRAINT "PackQuestion_packId_fkey"
  FOREIGN KEY ("packId") REFERENCES "QuizPack"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PackQuestion" ADD CONSTRAINT "PackQuestion_quizId_fkey"
  FOREIGN KEY ("quizId") REFERENCES "Quiz"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "PlaySession" (
  "id" TEXT NOT NULL, "quizId" TEXT NOT NULL, "revisionId" TEXT NOT NULL,
  "userId" TEXT, "tokenHash" TEXT NOT NULL, "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "usedClues" INTEGER NOT NULL DEFAULT 1, "wrongGuesses" INTEGER NOT NULL DEFAULT 0,
  "score" INTEGER NOT NULL DEFAULT 0,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3) NOT NULL, "finishedAt" TIMESTAMP(3),
  CONSTRAINT "PlaySession_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "PlaySession_quizId_revisionId_status_idx" ON "PlaySession"("quizId","revisionId","status");
CREATE INDEX "PlaySession_userId_status_score_idx" ON "PlaySession"("userId","status","score");
ALTER TABLE "PlaySession" ADD CONSTRAINT "PlaySession_quizId_fkey"
  FOREIGN KEY ("quizId") REFERENCES "Quiz"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PlaySession" ADD CONSTRAINT "PlaySession_revisionId_fkey"
  FOREIGN KEY ("revisionId") REFERENCES "QuizRevision"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PlaySession" ADD CONSTRAINT "PlaySession_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "Review" (
  "id" TEXT NOT NULL, "quizId" TEXT NOT NULL, "authorId" TEXT NOT NULL,
  "rating" INTEGER NOT NULL, "comment" TEXT NOT NULL DEFAULT '',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "Review_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Review_rating_check" CHECK ("rating" IN (-1,1))
);
CREATE UNIQUE INDEX "Review_quizId_authorId_key" ON "Review"("quizId","authorId");
CREATE INDEX "Review_quizId_createdAt_idx" ON "Review"("quizId","createdAt");
ALTER TABLE "Review" ADD CONSTRAINT "Review_quizId_fkey"
  FOREIGN KEY ("quizId") REFERENCES "Quiz"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Review" ADD CONSTRAINT "Review_authorId_fkey"
  FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "Report" (
  "id" TEXT NOT NULL, "quizId" TEXT NOT NULL, "reporterId" TEXT NOT NULL,
  "reason" TEXT NOT NULL, "detail" TEXT NOT NULL DEFAULT '',
  "status" TEXT NOT NULL DEFAULT 'OPEN',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Report_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Report_quizId_status_idx" ON "Report"("quizId","status");
ALTER TABLE "Report" ADD CONSTRAINT "Report_quizId_fkey"
  FOREIGN KEY ("quizId") REFERENCES "Quiz"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Report" ADD CONSTRAINT "Report_reporterId_fkey"
  FOREIGN KEY ("reporterId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "AuditLog" (
  "id" TEXT NOT NULL, "actorId" TEXT NOT NULL, "action" TEXT NOT NULL,
  "objectId" TEXT NOT NULL, "detail" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "AuditLog_actorId_createdAt_idx" ON "AuditLog"("actorId","createdAt");
