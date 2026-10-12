import { parseOperation, operations, type Operation } from "./contracts";
import { quizLanguages,quizTranslationGet,quizTranslationGenerate,quizTranslationSave,quizTranslationPublish,quizTranslationHide } from "./translations";
import { localeGet, localeUpdate } from "./locale";
import { topicList } from "./topics";
import { fail, requireActor, type Actor } from "./auth";
import { quizList, quizGet, quizCreate, quizUpdate, quizPublish, quizKidsRequest, quizLanguageSet, quizReview, quizReviewGet, adminQuizReviewList } from "./quiz";
import { playStart, playClue, playGuess } from "./play";
import { runStart,runCurrent,runFinish,runHistory,runFeedback } from "./runs";
import { reviewsList, reviewUpsert, reviewRemove, reportCreate, reportsMine, packCreate, packList, packGet, myPackGet, packPreflight, packUpdate, packLanguageSet, packLanguages, packTranslationUpsert, packPublishPreview, packPublish, packKidsRequest } from "./social";
import { quizStats, myStats, me, leaderboard, rankingOptin, adultVerify } from "./analytics";
import { packReviewsList, packReviewUpsert, packReviewRemove, packReportCreate, packInsightsMine } from "./pack-social";
import { discoverSections } from "./discovery";
import { editorialFeaturesList,adminFeatureList,adminFeatureCandidates,adminFeatureCreate,
  adminFeatureUpdate,adminFeatureRemove,adminPackSafetyList,adminPackSafetyReview,adminPackReportsList } from "./editorial";
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
      clueTypes: ["text", "image", "image-reveal", "audio", "video", "map"], mediaReference: "mediaId", promptMediaIds: true,
      mediaLimitsBytes: { image: 12582912, audio: 26214400, video: 67108864 }, minClues: 1, maxClues: 15,
      userAdjustable: ["answerType", "topics", "creatorIntent", "recommendedAudience", "clues", "answer"],
      platformControlled: ["safetyStatus", "kidsEligible", "kidsReviewStatus"],
      playModes: ["RANDOM_FIVE","INFINITE","PACK"], audiences: ["GENERAL","KIDS"],
      quickStartQuestions: 5, editorialPicks: "ACTIVE", packOrderModes: ["CREATOR","RANDOM"],
      version: "v2", format: "progressive-clues" };
    case "topic_list": return topicList(p);
    case "quiz_list": return quizList(p, actor);
    case "quiz_get": return quizGet(p.id, actor, p.locale);
    case "quiz_create": return quizCreate(p, actor);
    case "quiz_update": return quizUpdate(p, actor);
    case "clues_replace": return quizUpdate({ id: p.id, expectedVersion: p.expectedVersion, clues: p.clues }, actor);
    case "quiz_publish": return quizPublish(p, actor);
    case "quiz_kids_request": return quizKidsRequest(p, actor);
    case "quiz_language_set": return quizLanguageSet(p, actor);
    case "quiz_languages": return quizLanguages(p,actor);
    case "quiz_translation_get": return quizTranslationGet(p,actor);
    case "quiz_translation_generate": return quizTranslationGenerate(p,actor);
    case "quiz_translation_save": return quizTranslationSave(p,actor);
    case "quiz_translation_publish": return quizTranslationPublish(p,actor);
    case "quiz_translation_hide": return quizTranslationHide(p,actor);
    case "admin_quiz_review_list": return adminQuizReviewList(p,actor);
    case "quiz_review_get": return quizReviewGet(p,actor);
    case "quiz_review": return quizReview(p, actor);
    case "pack_get": return packGet(p,actor);
    case "my_pack_get": return myPackGet(p,actor);
    case "pack_list": return packList(p, actor);
    case "pack_preflight": return packPreflight(p,actor);
    case "pack_create": return packCreate(p, actor);
    case "pack_language_set": return packLanguageSet(p, actor);
    case "pack_languages": return packLanguages(p,actor);
    case "pack_translation_upsert": return packTranslationUpsert(p,actor);
    case "pack_publish_preview": return packPublishPreview(p,actor);
    case "pack_publish": return packPublish(p,actor);
    case "pack_kids_request": return packKidsRequest(p,actor);
    case "pack_update": return packUpdate(p, actor);
    case "pack_reviews_list": return packReviewsList(p,actor);
    case "pack_review_upsert": return packReviewUpsert(p,actor);
    case "pack_review_remove": return packReviewRemove(p,actor);
    case "pack_report_create": return packReportCreate(p,actor);
    case "my_pack_insights": return packInsightsMine(p,actor);
    case "discover_sections": return discoverSections(p);
    case "editorial_features": return editorialFeaturesList(p,actor);
    case "admin_feature_list": return adminFeatureList(p,actor);
    case "admin_feature_candidates": return adminFeatureCandidates(p,actor);
    case "admin_feature_create": return adminFeatureCreate(p,actor);
    case "admin_feature_update": return adminFeatureUpdate(p,actor);
    case "admin_feature_remove": return adminFeatureRemove(p,actor);
    case "admin_pack_safety_list": return adminPackSafetyList(p,actor);
    case "admin_pack_reports_list": return adminPackReportsList(p,actor);
    case "admin_pack_safety_review": return adminPackSafetyReview(p,actor);
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
