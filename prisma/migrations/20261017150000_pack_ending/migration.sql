ALTER TABLE "QuizPack" ADD COLUMN "closingMessage" TEXT NOT NULL DEFAULT '';
ALTER TABLE "QuizPack" ADD COLUMN "scoreReviews" JSONB NOT NULL DEFAULT '[]'::jsonb;
