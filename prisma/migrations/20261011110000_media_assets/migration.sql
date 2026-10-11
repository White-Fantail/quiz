
-- Media assets are private. "uploadKey" objects are temporary and untrusted.
ALTER TABLE "QuizRevision" ADD COLUMN "promptMediaIds" JSONB NOT NULL DEFAULT '[]'::jsonb;
CREATE TABLE "MediaAsset" (
  "id" TEXT NOT NULL,
  "ownerId" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL,
  "originalName" TEXT NOT NULL DEFAULT '',
  "sizeBytes" INTEGER NOT NULL,
  "sha256" TEXT,
  "status" TEXT NOT NULL DEFAULT 'UPLOADING',
  "moderationStatus" TEXT NOT NULL DEFAULT 'PENDING',
  "storageKey" TEXT NOT NULL,
  "uploadKey" TEXT,
  "uploadExpiresAt" TIMESTAMP(3),
  "sourceUrl" TEXT,
  "parentId" TEXT,
  "alt" TEXT NOT NULL DEFAULT '',
  "transcript" TEXT NOT NULL DEFAULT '',
  "attribution" TEXT NOT NULL DEFAULT '',
  "license" TEXT NOT NULL DEFAULT '',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "deletedAt" TIMESTAMP(3),
  CONSTRAINT "MediaAsset_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "MediaAsset_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "MediaAsset_sizeBytes_check" CHECK ("sizeBytes" >= 0),
  CONSTRAINT "MediaAsset_status_check" CHECK ("status" IN ('UPLOADING','READY','REJECTED','DELETED')),
  CONSTRAINT "MediaAsset_moderation_check" CHECK ("moderationStatus" IN ('PENDING','APPROVED','RESTRICTED'))
);
CREATE UNIQUE INDEX "MediaAsset_storageKey_key" ON "MediaAsset"("storageKey");
CREATE UNIQUE INDEX "MediaAsset_uploadKey_key" ON "MediaAsset"("uploadKey");
CREATE INDEX "MediaAsset_ownerId_status_createdAt_idx" ON "MediaAsset"("ownerId","status","createdAt");
CREATE INDEX "MediaAsset_parentId_idx" ON "MediaAsset"("parentId");
