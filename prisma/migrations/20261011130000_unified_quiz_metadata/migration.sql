-- Game mechanic and answer kind are orthogonal. Preserve existing test questions.
ALTER TABLE "Quiz" ADD COLUMN "mode" TEXT NOT NULL DEFAULT 'progressive-clues', ADD COLUMN "answerType" TEXT NOT NULL DEFAULT 'other';
ALTER TABLE "QuizRevision" ADD COLUMN "answerType" TEXT NOT NULL DEFAULT 'other';
UPDATE "QuizRevision" SET "answerType"=CASE "mode"
 WHEN 'guess-animal' THEN 'animal' WHEN 'guess-person' THEN 'person'
 WHEN 'guess-place' THEN 'place' WHEN 'guess-thing' THEN 'thing' ELSE 'other' END,
 "mode"='progressive-clues';
UPDATE "Quiz" q SET "answerType"=r."answerType" FROM "QuizRevision" r
 WHERE r."quizId"=q."id" AND r."version"=q."currentVersion";

CREATE TABLE "Topic" (
 "id" TEXT NOT NULL, "key" TEXT NOT NULL, "name" TEXT NOT NULL,
 "aliases" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "Topic_pkey" PRIMARY KEY("id")
);
CREATE UNIQUE INDEX "Topic_key_key" ON "Topic"("key");
CREATE TABLE "QuizTopic" (
 "quizId" TEXT NOT NULL, "topicId" TEXT NOT NULL,
 "position" INTEGER NOT NULL, "isSpoiler" BOOLEAN NOT NULL DEFAULT false,
 CONSTRAINT "QuizTopic_pkey" PRIMARY KEY("quizId","topicId")
);
CREATE INDEX "QuizTopic_quizId_position_idx" ON "QuizTopic"("quizId","position");
CREATE INDEX "QuizTopic_topicId_isSpoiler_idx" ON "QuizTopic"("topicId","isSpoiler");
ALTER TABLE "QuizTopic" ADD CONSTRAINT "QuizTopic_quizId_fkey" FOREIGN KEY("quizId") REFERENCES "Quiz"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "QuizTopic" ADD CONSTRAINT "QuizTopic_topicId_fkey" FOREIGN KEY("topicId") REFERENCES "Topic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "Topic"("id","key","name")
SELECT gen_random_uuid()::text, key, MIN(name) FROM (
 SELECT lower(btrim(category)) AS key,btrim(category) AS name
 FROM "Quiz" q CROSS JOIN LATERAL unnest(q."categories") AS category
 WHERE length(btrim(category))>0
) x GROUP BY key ON CONFLICT ("key") DO NOTHING;
INSERT INTO "QuizTopic"("quizId","topicId","position","isSpoiler")
SELECT DISTINCT ON (q."id",t."id") q."id",t."id",x.position-1,false
FROM "Quiz" q CROSS JOIN LATERAL unnest(q."categories") WITH ORDINALITY AS x(category,position)
JOIN "Topic" t ON t."key"=lower(btrim(x.category))
ORDER BY q."id",t."id",x.position;
ALTER TABLE "Quiz" DROP COLUMN "categories";
