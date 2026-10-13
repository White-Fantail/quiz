-- Creator-visible moderation notifications and structured appeals, without storing reporter identities in notices.
CREATE TABLE "ModerationNotice" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "targetKind" TEXT NOT NULL,
  "targetId" TEXT NOT NULL,
  "event" TEXT NOT NULL,
  "message" TEXT NOT NULL DEFAULT '',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "readAt" TIMESTAMP(3),
  CONSTRAINT "ModerationNotice_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "ModerationAppeal" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "targetKind" TEXT NOT NULL,
  "targetId" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'OPEN',
  "resolution" TEXT NOT NULL DEFAULT '',
  "reviewedById" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ModerationAppeal_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ModerationAppeal_status_check" CHECK ("status" IN ('OPEN','ACCEPTED','REJECTED'))
);
ALTER TABLE "ModerationNotice" ADD CONSTRAINT "ModerationNotice_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ModerationAppeal" ADD CONSTRAINT "ModerationAppeal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "ModerationNotice_userId_createdAt_idx" ON "ModerationNotice" ("userId","createdAt");
CREATE INDEX "ModerationNotice_userId_readAt_idx" ON "ModerationNotice" ("userId","readAt");
CREATE INDEX "ModerationAppeal_userId_createdAt_idx" ON "ModerationAppeal" ("userId","createdAt");
CREATE INDEX "ModerationAppeal_status_createdAt_idx" ON "ModerationAppeal" ("status","createdAt");
CREATE INDEX "ModerationAppeal_targetKind_targetId_status_idx" ON "ModerationAppeal" ("targetKind","targetId","status");
CREATE UNIQUE INDEX "ModerationAppeal_one_open_per_target" ON "ModerationAppeal" ("userId","targetKind","targetId") WHERE "status"='OPEN';
CREATE INDEX "AuditLog_objectId_action_createdAt_idx" ON "AuditLog" ("objectId","action","createdAt");
