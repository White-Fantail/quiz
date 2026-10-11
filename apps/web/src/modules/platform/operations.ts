import { parseOperation, operations, type Operation } from "./contracts";
import { fail, requireActor, type Actor } from "./auth";
import { quizList, quizGet, quizCreate, quizUpdate, quizPublish } from "./quiz";
import { playStart, playClue, playGuess } from "./play";
import { reviewsList, reviewUpsert, reportCreate, reportsMine, packCreate, packList, packUpdate } from "./social";
import { quizStats, myStats, me, leaderboard } from "./analytics";

export async function execute(name: Operation, raw: unknown, actor: Actor | null): Promise<unknown> {
  const p = parseOperation(name, raw);
  if (!operations[name].public) requireActor(actor);
  switch (name) {
    case "catalog": return { modes: ["guess-animal", "guess-person", "guess-place", "guess-thing"],
      clueTypes: ["text", "image", "audio", "video", "map"], minClues: 1, maxClues: 15,
      userAdjustable: ["creatorIntent", "categories", "clues", "answer"],
      platformControlled: ["safetyStatus", "kidsEligible"],
      version: "v1", format: "progressive-clues" };
    case "quiz_list": return quizList(p, actor);
    case "quiz_get": return quizGet(p.id, actor);
    case "quiz_create": return quizCreate(p, actor);
    case "quiz_update": return quizUpdate(p, actor);
    case "clues_replace": return quizUpdate({ id: p.id, expectedVersion: p.expectedVersion, clues: p.clues }, actor);
    case "quiz_publish": return quizPublish(p, actor);
    case "pack_list": return packList(p, actor);
    case "pack_create": return packCreate(p, actor);
    case "pack_update": return packUpdate(p, actor);
    case "play_start": return playStart(p, actor);
    case "play_clue": return playClue(p, actor);
    case "play_guess": return playGuess(p, actor);
    case "reviews_list": return reviewsList(p);
    case "review_upsert": return reviewUpsert(p, actor);
    case "report_create": return reportCreate(p, actor);
    case "reports_mine": return reportsMine(p, actor);
    case "quiz_stats": return quizStats(p, actor);
    case "me": return me(p, actor);
    case "my_quizzes": return quizList({ ...p, mine: true, kids: false }, actor);
    case "my_stats": return myStats(p, actor);
    case "leaderboard": return leaderboard(p);
    default: return fail(404, "operation_not_found", "Unknown operation");
  }
}
