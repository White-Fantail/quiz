import { z } from "zod";

export const uuid = z.string().uuid();
export const userId = z.string().regex(/^[a-f0-9]{64}$/);
export const answerSchema = z.object({ canonical: z.string().trim().min(1).max(200), aliases: z.array(z.string().trim().min(1).max(200)).max(20).default([]) });
const media = z.object({ url: z.url().max(2000), alt: z.string().max(500).optional(), transcript: z.string().max(2000).optional(), attribution: z.string().max(500).optional() });
export const clueSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("text"), text: z.string().trim().min(1).max(3000) }),
  z.object({ type: z.enum(["image", "audio", "video"]), media, text: z.string().max(1000).optional() }),
  z.object({ type: z.literal("map"), map: z.object({ latitude: z.number().min(-90).max(90), longitude: z.number().min(-180).max(180), zoom: z.number().min(1).max(20).optional() }), text: z.string().max(1000).optional() })
]);
export const quizFields = z.object({
  title: z.string().trim().min(1).max(180), prompt: z.string().trim().min(1).max(2000),
  mode: z.enum(["guess-animal", "guess-person", "guess-place", "guess-thing"]),
  answer: answerSchema, clues: z.array(clueSchema).min(1).max(15),
  categories: z.array(z.string().min(1).max(50)).max(8).optional(),
  creatorIntent: z.object({ ageRange: z.object({ minimum: z.number().int().min(0).max(120).optional(), maximum: z.number().int().min(0).max(120).optional() }).optional(), note: z.string().max(400).optional() }).optional()
});
const paging = { limit: z.number().int().min(1).max(100).default(20), offset: z.number().int().min(0).default(0) };
const session = { sessionId: uuid, sessionToken: z.string().min(32).max(200) };
export const operations = {
  catalog: { public: true, description: "Supported game modes, clue formats and rules", schema: z.object({}) },
  quiz_list: { public: true, description: "Search public quizzes or my own drafts", schema: z.object({ ...paging, mine: z.boolean().default(false), kids: z.boolean().default(false), mode: quizFields.shape.mode.optional() }) },
  quiz_get: { public: true, description: "Get published quiz metadata or my full editable quiz", schema: z.object({ id: uuid }) },
  quiz_create: { public: false, description: "Create a quiz draft with ordered clues", schema: quizFields },
  quiz_update: { public: false, description: "Edit my quiz as a new immutable revision", schema: quizFields.partial().extend({ id: uuid, expectedVersion: z.number().int().positive() }) },
  clues_replace: { public: false, description: "Replace my ordered clues as a new revision", schema: z.object({ id: uuid, expectedVersion: z.number().int().positive(), clues: quizFields.shape.clues }) },
  quiz_publish: { public: false, description: "Publish my quiz; explicit user confirmation needed", schema: z.object({ id: uuid, confirm: z.literal(true) }) },
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
  creator_review_upsert: { public: false, description: "Rate a creator after finishing one of their questions", schema: z.object({ userId, rating: z.union([z.literal(-1), z.literal(1)]), comment: z.string().max(2000).default("") }) }
} as const;
export type Operation = keyof typeof operations;
export function parseOperation(name: Operation, payload: unknown): Record<string, any> {
  return operations[name].schema.parse(payload) as Record<string, any>;
}
