import { z } from "zod";

export const uuid = z.string().uuid();
export const userId = z.string().min(8).max(200).regex(/^[a-zA-Z0-9_-]+$/);
export const answerSchema = z.object({ canonical: z.string().trim().min(1).max(200), aliases: z.array(z.string().trim().min(1).max(200)).max(20).default([]) });
const mediaId = uuid;
export const clueSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("text"), text: z.string().trim().min(1).max(3000) }),
  z.object({ type: z.enum(["image", "audio", "video"]), mediaId, text: z.string().max(1000).optional() }),
  z.object({ type: z.literal("map"), map: z.object({ latitude: z.number().min(-90).max(90), longitude: z.number().min(-180).max(180), zoom: z.number().min(1).max(20).optional() }), text: z.string().max(1000).optional() })
]);
const mediaMetadata = {
  alt: z.string().max(500).optional(),
  transcript: z.string().max(5000).optional(),
  attribution: z.string().max(500).optional(),
  license: z.string().max(200).optional()
};
const mediaKinds = z.enum(["image", "audio", "video"]);
const mediaFormats = z.enum(["image/jpeg","image/png","image/webp","audio/mpeg","audio/wav","audio/ogg","video/mp4","video/webm"]);
export const gameModeSchema = z.enum(["progressive-clues"]);
export const answerTypeSchema = z.enum(["person","animal","place","thing","event","concept","other"]);
const ageRangeSchema = z.object({
  minimum: z.number().int().min(0).max(120).optional(),
  maximum: z.number().int().min(0).max(120).optional()
}).refine(v=>v.minimum===undefined||v.maximum===undefined||v.minimum<=v.maximum,"Minimum age exceeds maximum");
const topicName = z.string().trim().min(1).max(80);
const topicInputSchema = z.union([topicName, z.object({name:topicName,isSpoiler:z.boolean().optional()})]);
export const quizFields = z.object({
  title: z.string().trim().min(1).max(180), prompt: z.string().trim().min(1).max(2000),
  mode: gameModeSchema.default("progressive-clues"),
  answerType: answerTypeSchema.default("other"),
  answer: answerSchema, clues: z.array(clueSchema).min(1).max(15),
  promptMediaIds: z.array(mediaId).max(5).default([]),
  topics: z.array(topicInputSchema).max(12).optional(),
  recommendedAudience: z.object({ ageRange: ageRangeSchema.optional(), difficulty: z.enum(["easy","medium","hard"]).optional() }).optional(),
  creatorIntent: z.object({ ageRange: ageRangeSchema.optional(), note: z.string().max(400).optional() }).optional()
});
const paging = { limit: z.number().int().min(1).max(100).default(20), offset: z.number().int().min(0).default(0) };
const session = { sessionId: uuid, sessionToken: z.string().min(32).max(200) };
export const operations = {
  catalog: { public: true, description: "Supported game modes, clue formats and rules", schema: z.object({}) },
  topic_list: { public: true, description: "Search established topics for discovery and authoring. New topic names are accepted on quiz creation.", schema: z.object({ ...paging, q: topicName.optional() }) },
  quiz_list: { public: true, description: "Find quizzes by game mode, answer kind and topic", schema: z.object({ ...paging, mine: z.boolean().default(false), kids: z.boolean().default(false), mode: gameModeSchema.optional(), answerType: answerTypeSchema.optional(), topic: topicName.optional() }) },
  quiz_get: { public: true, description: "Get published quiz metadata or my full editable quiz", schema: z.object({ id: uuid }) },
  quiz_create: { public: false, description: "Create ordered clues; infer answerType, relevant topics, age recommendation and difficulty. Platform safety is never creator input.", schema: quizFields },
  quiz_update: { public: false, description: "Edit my quiz as a new immutable revision", schema: quizFields.partial().extend({ id: uuid, expectedVersion: z.number().int().positive() }) },
  clues_replace: { public: false, description: "Replace my ordered clues as a new revision", schema: z.object({ id: uuid, expectedVersion: z.number().int().positive(), clues: quizFields.shape.clues }) },
  quiz_publish: { public: false, description: "Publish my quiz; explicit user confirmation needed", schema: z.object({ id: uuid, confirm: z.literal(true) }) },
  quiz_review_get: { public: false, description: "ADMIN ONLY: inspect quiz questions and answers for safety", schema: z.object({id:uuid}) },
  quiz_review: { public: false, description: "ADMIN ONLY: independently approve or restrict a quiz; Kids requires explicit safety approval", schema: z.object({
    id: uuid, verdict: z.enum(["APPROVED","RESTRICTED","PENDING"]), kidsEligible: z.boolean().default(false),
    reason: z.string().trim().min(5).max(1000), confirm: z.literal(true)
  }) },
  pack_list: { public: true, description: "List published packs or my packs", schema: z.object({ ...paging, mine: z.boolean().default(false) }) },
  pack_create: { public: false, description: "Create a new ordered quiz pack", schema: z.object({ title: z.string().min(1).max(180), description: z.string().max(2000).default(""), quizIds: z.array(uuid).min(1).max(100) }) },
  pack_update: { public: false, description: "Edit or publish an owned quiz pack", schema: z.object({ id: uuid, title: z.string().min(1).max(180).optional(), description: z.string().max(2000).optional(), quizIds: z.array(uuid).min(1).max(100).optional(), publication: z.enum(["DRAFT", "PUBLISHED", "HIDDEN"]).optional(), confirm: z.boolean().optional() }) },
  play_start: { public: true, description: "Start a playable session and see first clue", schema: z.object({ quizId: uuid, kids: z.boolean().default(false) }) },
  play_clue: { public: true, description: "Reveal the next clue using my play token", schema: z.object(session) },
  play_guess: { public: true, description: "Check my guess on the server", schema: z.object({ ...session, guess: z.string().trim().min(1).max(200) }) },
  reviews_list: { public: true, description: "Read public quiz reviews", schema: z.object({ quizId: uuid, ...paging }) },
  review_upsert: { public: false, description: "Rate and review a completed quiz", schema: z.object({ quizId: uuid, rating: z.union([z.literal(-1), z.literal(1)]), comment: z.string().max(2000).default("") }) },
  report_create: { public: false, description: "Report a quiz issue", schema: z.object({ quizId: uuid, reason: z.enum(["WRONG_ANSWER", "WRONG_CLUE", "UNSAFE", "COPYRIGHT", "PRIVACY", "SPAM", "DUPLICATE"]), detail: z.string().trim().min(5).max(2000) }) },
  reports_mine: { public: false, description: "Track reports I submitted", schema: z.object(paging) },
  quiz_stats: { public: true, description: "Success rate, revision metrics, reviews and per-clue stages", schema: z.object({ quizId: uuid, version: z.number().int().positive().optional() }) },
  me: { public: false, description: "My verified account and settings", schema: z.object({}) },
  my_quizzes: { public: false, description: "Manage questions I created", schema: z.object(paging) },
  my_stats: { public: false, description: "My private scores, attempts and rank", schema: z.object({}) },
  leaderboard: { public: true, description: "Opt-in verified player rankings", schema: z.object({ ...paging, quizId: uuid.optional() }) },
  user_get: { public: true, description: "View a creator's public profile and reputation", schema: z.object({ userId }) },
  creator_reviews_list: { public: true, description: "Read the public reviews of a quiz creator", schema: z.object({ userId, ...paging }) },
  creator_review_upsert: { public: false, description: "Rate a creator after finishing one of their questions", schema: z.object({ userId, rating: z.union([z.literal(-1), z.literal(1)]), comment: z.string().max(2000).default("") }) },
  media_upload: { public: false, description: "Reserve private object storage and return a short-lived signed upload URL", schema: z.object({
    kind: mediaKinds, mimeType: mediaFormats, filename: z.string().min(1).max(200), sizeBytes: z.number().int().positive(),
    sha256: z.string().regex(/^[a-f0-9]{64}$/), ...mediaMetadata
  }) },
  media_chunk: { public: false, description: "Upload a 512 KiB base64 chunk through MCP when direct binary PUT is unavailable", schema: z.object({
    id: mediaId, index: z.number().int().min(0).max(127),
    dataBase64: z.string().min(4).max(720000).regex(/^[A-Za-z0-9+/]+={0,2}$/),
    sha256: z.string().regex(/^[a-f0-9]{64}$/)
  }) },
  media_complete: { public: false, description: "Verify uploaded bytes or sequential MCP chunks and finalize immutable media", schema: z.object({
    id: mediaId, partCount: z.number().int().min(1).max(128).optional()
  }) },
  media_import: { public: false, description: "Import HTTPS media from a server-approved host into private storage", schema: z.object({
    url: z.url().max(2000), kind: mediaKinds, filename: z.string().min(1).max(200), ...mediaMetadata
  }) },
  media_list: { public: false, description: "Search and paginate my media, including optional usage filtering", schema: z.object({
    ...paging, search: z.string().trim().max(120).default(""),
    kind: z.enum(["all", "image", "audio", "video"]).default("all"),
    moderation: z.enum(["all", "PENDING", "APPROVED", "RESTRICTED"]).default("all"),
    status: z.enum(["all", "READY", "UPLOADING"]).default("all"),
    usage: z.enum(["all", "used", "unused"]).default("all"),
    sort: z.enum(["newest", "oldest", "name", "size"]).default("newest"),
  }) },
  media_get: { public: false, description: "Get a media asset, owner preview, thumbnail and quiz usage", schema: z.object({ id: mediaId, purpose: z.enum(["detail", "thumbnail"]).default("detail") }) },
  media_update: { public: false, description: "Edit attribution or accessible text of my media, resetting moderation", schema: z.object({ id: mediaId, ...mediaMetadata }) },
  media_delete: { public: false, description: "Delete unreferenced media with explicit confirmation", schema: z.object({ id: mediaId, confirm: z.literal(true) }) },
  media_transform: { public: false, description: "Create an immutable derived image crop, blur or progressive reveal", schema: z.object({
    id: mediaId, crop: z.object({ left: z.number().int().min(0), top: z.number().int().min(0),
      width: z.number().int().positive(), height: z.number().int().positive() }).optional(),
    blur: z.number().min(0.3).max(20).optional(), resizeWidth: z.number().int().min(64).max(2048).optional()
  }).refine(p => !!(p.crop || p.blur || p.resizeWidth), { message: "Choose at least one image transform" }) },
  media_review_get: { public: false, description: "ADMIN ONLY: inspect private media and credits before moderation", schema: z.object({id:mediaId}) },
  media_review: { public: false, description: "ADMIN ONLY: explicitly approve or restrict validated media", schema: z.object({
    id: mediaId, verdict: z.enum(["APPROVED", "RESTRICTED"]), confirm: z.literal(true), reason: z.string().min(5).max(1000)
  }) },
  play_media: { public: true, description: "Renew time-limited playback URL for a revealed clue or prompt media", schema: z.object({
    ...session, mediaId
  }) },
  weekly_current: { public: true, description: "This week's globally fixed five questions and featured creator, separately for General/Kids", schema: z.object({ lane: z.enum(["GENERAL","KIDS"]).default("GENERAL") }) },
  weekly_submit: { public: false, description: "Submit five original published questions as next week's host; staff schedules editions", schema: z.object({
    lane: z.enum(["GENERAL","KIDS"]), weekStart: z.iso.date(), title: z.string().trim().min(3).max(180),
    description: z.string().max(1000).default(""), quizIds: z.array(uuid).length(5).refine(a=>new Set(a).size===5)
  }) },
  weekly_publish: { public: false, description: "ADMIN ONLY: freeze the author's five revisions and publish the weekly edition", schema: z.object({
    challengeId: uuid, verifiedHost: z.boolean().default(false), confirm: z.literal(true)
  }) },
  weekly_proposals: { public: false, description: "ADMIN ONLY: review upcoming five-quiz creator editions", schema: z.object({
    lane: z.enum(["GENERAL","KIDS"]).optional(), weekStart: z.iso.date().optional(), ...paging
  }) },
  weekly_suspend: { public: false, description: "ADMIN ONLY: suspend an edition with audit record", schema: z.object({
    challengeId: uuid, reason: z.string().trim().min(5).max(1000), confirm: z.literal(true)
  }) },
  weekly_standings: { public: true, description: "Verified opt-in adults' first-attempt scores for the selected General weekly challenge", schema: z.object({
    challengeId: uuid, ...paging
  }) },
  run_start: { public: true, description: "Begin/resume weekly, five random, or infinite play in General/Kids lane", schema: z.object({
    mode: z.enum(["WEEKLY","RANDOM_FIVE","INFINITE"]), lane: z.enum(["GENERAL","KIDS"]).default("GENERAL")
  }) },
  run_current: { public: true, description: "Get or resume the current server-side question of a run without revealing later clues", schema: z.object({
    runId: uuid, runToken: z.string().min(32).max(200)
  }) },
  run_finish: { public: true, description: "Stop an infinite or practice run and view its scores", schema: z.object({
    runId: uuid, runToken: z.string().min(32).max(200), confirm: z.literal(true)
  }) },
  run_history: { public: false, description: "My latest scores and completed challenges", schema: z.object(paging) },
  ranking_optin: { public: false, description: "Set my own public ranking consent, independent of staff adult verification", schema: z.object({ enabled: z.boolean(), confirm: z.literal(true) }) },
  adult_verify: { public: false, description: "ADMIN ONLY: independently verify or revoke an adult ranking eligibility status", schema: z.object({
    userId, verified: z.boolean(), reason: z.string().trim().min(8).max(1000), confirm: z.literal(true)
  }) }
} as const;
export type Operation = keyof typeof operations;
export function parseOperation(name: Operation, payload: unknown): Record<string, any> {
  return operations[name].schema.parse(payload) as Record<string, any>;
}
