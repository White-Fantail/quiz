-- Optional educational content; existing quizzes and packs remain playable.
ALTER TABLE "QuizRevision" ADD COLUMN "explanation" TEXT NOT NULL DEFAULT '';
ALTER TABLE "QuizPack" ADD COLUMN "coverMediaId" TEXT;
ALTER TABLE "QuizPack" ADD COLUMN "sections" JSONB NOT NULL DEFAULT '[]'::jsonb;
