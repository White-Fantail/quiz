# QuizDip metadata v2

The model contains three **independent** dimensions: `mode` (play mechanic, currently `progressive-clues`), `answerType` (`person`, `animal`, `place`, `thing`, `event`, `concept`, `other`), and a single unified `topics` collection, replacing category/topic/tag overlap.

The authenticated ChatGPT/MCP tool `quizdip_quiz_create` can include suggested topics (array of strings or `{name,isSpoiler}` entries), `creatorIntent` and `recommendedAudience` with age range and difficulty. The same Zod contract serves REST. Topic names are Unicode-normalized and deduplicated by key. A topic equal to or containing an answer alias is automatically spoiler-marked; owners and admins can read spoilers, public quiz metadata and topic discovery cannot. Semantic spoilers not matching answer text still need editorial review.

Only trusted moderators control `safetyStatus` / `kidsEligible`. Recommended audience is a suggestion **not** safety approval. There is **no autonomous server AI classification job yet**; the connected GPT client must supply classification suggestions.

- `GET /api/v1/catalog` = `quizdip_catalog`
- `GET /api/v1/topics` = `quizdip_topic_list`
- `GET /api/v1/quizzes?topic=...&answerType=...&mode=...` = `quizdip_quiz_list`
- `POST /api/v1/quizzes` = `quizdip_quiz_create`
- `PATCH /api/v1/quizzes/:id` = `quizdip_quiz_update`
- `GET /api/v1/quizzes/:id` = `quizdip_quiz_get`

Migration: `20261011130000_unified_quiz_metadata` maps older guess-animal/person/place/thing modes to progressive-clues + answerType and converts previous categories into linked topics without deleting quiz data. Apply domain migrations with `npm run db:migrate`. Production safety requires real DB migrated + authenticated MCP/REST E2E, separate from unit tests.

Topics have an unused `aliases` column reserved for later semantic dedupe and translations. Do not promise automatic translation or sophisticated AI moderation until implemented.
