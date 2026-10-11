import { parseOperation, operations, type Operation } from "./contracts";
import { localeGet, localeUpdate } from "./locale";
import { topicList } from "./topics";
import { fail, requireActor, type Actor } from "./auth";
import { quizList, quizGet, quizCreate, quizUpdate, quizPublish, quizReview, quizReviewGet } from "./quiz";
import { playStart, playClue, playGuess } from "./play";
import { weeklyCurrent,weeklySubmit,weeklyPublish,weeklyProposals,weeklySuspend,weeklyStandings,
  runStart,runCurrent,runFinish,runHistory,runFeedback } from "./runs";
import { reviewsList, reviewUpsert, reviewRemove, reportCreate, reportsMine, packCreate, packList, packUpdate } from "./social";
import { quizStats, myStats, me, leaderboard, rankingOptin, adultVerify } from "./analytics";
import { userGet, creatorReviewsList, creatorReviewUpsert } from "./creators";
import { myQuizzes, myQuizInsights } from "./studio";
import { mediaUpload, mediaChunk, mediaComplete, mediaImport, mediaList, mediaGet, mediaUpdate,
  mediaDelete, mediaTransform, mediaReview, mediaReviewGet, signedPlayMedia } from "./media";

export async function execute(name: Operation, raw: unknown, actor: Actor | null): Promise<unknown> {
  const p = parseOperation(name, raw);
  if (!operations[name].public) requireActor(actor);
  switch (name) {
    case "catalog": return { modes: ["progressive-clues"],
      answerTypes: ["person","animal","place","thing","event","concept","other"],
      topics: { model:"unified", tool:"quizdip_topic_list", maxPerQuiz:12, normalizes:true },
      clueTypes: ["text", "image", "audio", "video", "map"], mediaReference: "mediaId", promptMediaIds: true,
      mediaLimitsBytes: { image: 12582912, audio: 26214400, video: 67108864 }, minClues: 1, maxClues: 15,
      userAdjustable: ["answerType", "topics", "creatorIntent", "recommendedAudience", "clues", "answer"],
      platformControlled: ["safetyStatus", "kidsEligible"],
      playModes: ["WEEKLY","RANDOM_FIVE","INFINITE"], audiences: ["GENERAL","KIDS"],
      weeklyQuestions: 5, weeklyTimezone: "UTC", featuredCreator: true,
      version: "v2", format: "progressive-clues" };
    case "topic_list": return topicList(p);
    case "quiz_list": return quizList(p, actor);
    case "quiz_get": return quizGet(p.id, actor);
    case "quiz_create": return quizCreate(p, actor);
    case "quiz_update": return quizUpdate(p, actor);
    case "clues_replace": return quizUpdate({ id: p.id, expectedVersion: p.expectedVersion, clues: p.clues }, actor);
    case "quiz_publish": return quizPublish(p, actor);
    case "quiz_review_get": return quizReviewGet(p,actor);
    case "quiz_review": return quizReview(p, actor);
    case "pack_list": return packList(p, actor);
    case "pack_create": return packCreate(p, actor);
    case "pack_update": return packUpdate(p, actor);
    case "play_start": return playStart(p, actor);
    case "play_clue": return playClue(p, actor);
    case "play_guess": return playGuess(p, actor);
    case "reviews_list": return reviewsList(p);
    case "review_upsert": return reviewUpsert(p, actor);
    case "review_remove": return reviewRemove(p, actor);
    case "report_create": return reportCreate(p, actor);
    case "reports_mine": return reportsMine(p, actor);
    case "quiz_stats": return quizStats(p, actor);
    case "me": return me(p, actor);
    case "locale_get": return localeGet(p, actor);
    case "locale_update": return localeUpdate(p, actor);
    case "my_quizzes": return myQuizzes(p, actor);
    case "my_quiz_insights": return myQuizInsights(p, actor);
    case "my_stats": return myStats(p, actor);
    case "leaderboard": return leaderboard(p);
    case "user_get": return userGet(p);
    case "creator_reviews_list": return creatorReviewsList(p);
    case "creator_review_upsert": return creatorReviewUpsert(p, actor);
    case "media_upload": return mediaUpload(p, actor);
    case "media_chunk": return mediaChunk(p, actor);
    case "media_complete": return mediaComplete(p, actor);
    case "media_import": return mediaImport(p, actor);
    case "media_list": return mediaList(p, actor);
    case "media_get": return mediaGet(p, actor);
    case "media_update": return mediaUpdate(p, actor);
    case "media_delete": return mediaDelete(p, actor);
    case "media_transform": return mediaTransform(p, actor);
    case "media_review_get": return mediaReviewGet(p,actor);
    case "media_review": return mediaReview(p, actor);
    case "play_media": return signedPlayMedia(p, actor);
    case "weekly_current": return weeklyCurrent(p);
    case "weekly_submit": return weeklySubmit(p,actor);
    case "weekly_publish": return weeklyPublish(p,actor);
    case "weekly_proposals": return weeklyProposals(p,actor);
    case "weekly_suspend": return weeklySuspend(p,actor);
    case "weekly_standings": return weeklyStandings(p);
    case "run_start": return runStart(p,actor);
    case "run_current": return runCurrent(p,actor);
    case "run_finish": return runFinish(p,actor);
    case "run_history": return runHistory(p,actor);
    case "run_feedback": return runFeedback(p,actor);
    case "ranking_optin": return rankingOptin(p,actor);
    case "adult_verify": return adultVerify(p,actor);
    default: return fail(404, "operation_not_found", "Unknown operation");
  }
}
