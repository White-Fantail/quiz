-- Additive multilingual foundation. Never infer a legacy question's language from UI locale.
-- "und" means unclassified; Phase 2 classifies and strictly filters discover/play.
ALTER TABLE "User" ADD COLUMN "uiLocale" TEXT NOT NULL DEFAULT 'en';
ALTER TABLE "User" ADD COLUMN "contentLocale" TEXT NOT NULL DEFAULT 'en';
ALTER TABLE "Quiz" ADD COLUMN "sourceLocale" TEXT NOT NULL DEFAULT 'und';
ALTER TABLE "QuizPack" ADD COLUMN "sourceLocale" TEXT NOT NULL DEFAULT 'und';

CREATE TABLE "QuizLocalization" (
  "id" TEXT NOT NULL,
  "quizId" TEXT NOT NULL,
  "locale" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "currentVersion" INTEGER NOT NULL DEFAULT 1,
  "sourceRevisionId" TEXT,
  "origin" TEXT NOT NULL DEFAULT 'ORIGINAL',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "QuizLocalization_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "QuizLocalization_quizId_locale_key" ON "QuizLocalization"("quizId", "locale");
CREATE INDEX "QuizLocalization_locale_status_idx" ON "QuizLocalization"("locale", "status");
ALTER TABLE "QuizLocalization" ADD CONSTRAINT "QuizLocalization_quizId_fkey"
  FOREIGN KEY ("quizId") REFERENCES "Quiz"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "QuizRevision" ADD COLUMN "localizationId" TEXT;
CREATE UNIQUE INDEX "QuizRevision_localizationId_version_key" ON "QuizRevision"("localizationId", "version");
ALTER TABLE "QuizRevision" ADD CONSTRAINT "QuizRevision_localizationId_fkey"
  FOREIGN KEY ("localizationId") REFERENCES "QuizLocalization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "QuizPackLocalization" (
  "id" TEXT NOT NULL,
  "packId" TEXT NOT NULL,
  "locale" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL DEFAULT '',
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "QuizPackLocalization_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "QuizPackLocalization_packId_locale_key" ON "QuizPackLocalization"("packId", "locale");
CREATE INDEX "QuizPackLocalization_locale_status_idx" ON "QuizPackLocalization"("locale", "status");
ALTER TABLE "QuizPackLocalization" ADD CONSTRAINT "QuizPackLocalization_packId_fkey"
  FOREIGN KEY ("packId") REFERENCES "QuizPack"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "TopicLocalization" (
  "id" TEXT NOT NULL,
  "topicId" TEXT NOT NULL,
  "locale" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "aliases" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TopicLocalization_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "TopicLocalization_topicId_locale_key" ON "TopicLocalization"("topicId", "locale");
CREATE INDEX "TopicLocalization_locale_name_idx" ON "TopicLocalization"("locale", "name");
ALTER TABLE "TopicLocalization" ADD CONSTRAINT "TopicLocalization_topicId_fkey"
  FOREIGN KEY ("topicId") REFERENCES "Topic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill with honest unknown language; do not silently label Korean content as English.
INSERT INTO "QuizLocalization" ("id", "quizId", "locale", "status", "currentVersion", "origin")
SELECT gen_random_uuid()::text, "id", 'und', "publication", "currentVersion", 'LEGACY'
FROM "Quiz";
UPDATE "QuizRevision" AS r SET "localizationId" = l."id"
FROM "QuizLocalization" AS l WHERE r."quizId" = l."quizId" AND l."locale" = 'und';

INSERT INTO "QuizPackLocalization" ("id", "packId", "locale", "title", "description", "status")
SELECT gen_random_uuid()::text, "id", 'und', "title", "description", "publication"
FROM "QuizPack";
INSERT INTO "TopicLocalization" ("id", "topicId", "locale", "name", "aliases")
SELECT gen_random_uuid()::text, "id", 'und', "name", "aliases"
FROM "Topic";
