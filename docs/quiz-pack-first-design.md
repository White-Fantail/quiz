# QuizDip — First-Class Quiz Packs and Flexible Play (Archived Initial Design)

> **Superseded by [Discovery-first Platform Design](discovery-first-platform-design.md) on 2026-10-12.** Weekly Five and its ongoing competitive format are *not* part of the approved future design. This document is retained for technical history (pack data model, snapshot gameplay and social features); follow the new document for current decisions.

Status: **Archived design reference — not implemented**  
Date: 2026-10-12  
Target branch: `dev`  
Scope: Public web Play/Discover, Studio, REST/MCP, analytics, and native Kids integration.  
Existing invariants: preserve weekly-five fairness, multilingual filtering, server-side grading, published revision pins, moderation and native Kids isolation.

## 1. Decision

A `Quiz` is an independently publishable and shareable question. A `QuizPack` is an independently publishable, discoverable, playable, reviewable and shareable collection of references to quizzes. One quiz can belong to multiple packs without duplication. Per-quiz reactions and stats do not depend on the pack in which the quiz was played; pack-level reactions and stats are independent.

Play experiences:
- **Single quiz** — one chosen question, including shared deep links and Discover.
- **Random play** — short default selection of five unseen questions or an explicitly chosen continuous session. The number five is a quick-play preset, not a global collection size.
- **Pack play** — all eligible questions of a published pack in creator-defined order (optionally shuffled when allowed by creator), with stop/resume and a pack-level completion summary.
- **Weekly featured challenge** — remains *exactly five* admin-scheduled, revision-pinned questions with current fair-play restrictions; not automatically converted into an ordinary pack.

No public ranking or competitive scoring is introduced for ordinary packs in this iteration. Preserve existing weekly official ranking constraints.

## 2. Current-state audit (2026-10-12)

Source: `prisma/schema.prisma`, `apps/web/src/modules/platform/{social,runs,play,ratings,studio,operations,contracts}.ts`, `apps/web/app/(platform)/{play,discover}/page.tsx`, `docs/play-modes.md` and `AGENTS.md`.

- Existing: `QuizPack`/`QuizPackLocalization`/`PackQuestion`, creator-scoped `pack_create`, `pack_update`, `pack_list`, language translation operations. Pack publication currently checks each quiz is published, safe and available in the pack locale; packs are collections only.
- Existing: `PlayRun`/`PlayRunQuestion` with quiz/revision pinning, `PlaySession` with server grading; run modes `RANDOM_FIVE`, `INFINITE`, `WEEKLY`.
- Specific fixed-five assumptions: `playGuess` marks completion at `currentIndex===4`; `runStart` and `runSummary` report total 5; Play client finish condition assumes five. Weekly's exactly-five rules are intentional and must remain.
- Existing: quiz-only `Review` and `Report` and language-scoped rating aggregation; completion/authentication/owner rules. No pack reviews, pack-level reports or owner pack analytics.
- Existing: public quiz listing, owner-only single-quiz test play, Kids native device-scoped runs and server-side moderation. Existing packs lack a public detail/player route in web.
- Repo policy: any new REST capability must have matching `quizdip_*` MCP operations through the shared service registry; code on `dev`, never merge `main` without explicit approval.

## 3. Content and revision design

### 3.1 Canonical ownership

Retain `Quiz` as the content source of truth and `PackQuestion(packId, quizId, position)` as the many-to-many join. Do **not** clone quiz data, published revisions, media or reaction counters into packs. A quiz may be published as an individual without any pack. A pack may reference the creator's own quiz, or another creator's **already public** quiz with attribution. A pack author cannot edit or publish another author's quiz.

Retain pack `publication` and language-specific `QuizPackLocalization.status` as independent from a quiz's publication. Hiding a pack does not hide its members; hiding a quiz does not delete it from any pack, but can make those packs temporarily unplayable.

### 3.2 Proposed minimal relational extensions

- `QuizPack.currentVersion Int @default(1)`, optimistic concurrency on pack edits; bump when ordered membership, default order, public cover or other editorial structure changes.
- `QuizPack.coverMediaId String?` with a validated approved-media reference before public rendering; otherwise a non-spoiler branded text/graphic OG fallback. `QuizPack.allowShuffle Boolean @default(false)`.
- `PlayRun.packId String?` FK to pack; `PlayRun.packVersion Int?`; `PlayRun.targetCount Int?` (null only for continuous runs). Add `QuizPack.runs` relation, index `(packId,status,startedAt)`. `mode="PACK"` uses existing `PlayRunQuestion` immutable ordered `quizId, revisionId` snapshots. No need to duplicate actual questions into a second pack-play table.
- `PackReview(id,packId,authorId,locale,rating,comment,packVersionAtReview,createdAt,updatedAt)`, unique `(packId,authorId,locale)`, indexed by `(packId,locale,rating)`. Must not overload quiz `Review.kind` (quizId is non-null and has different lifecycle).
- `PackReport(id,packId,reporterId,locale,reason,detail,status,createdAt)` with owner-safe aggregated moderation views and rate limits. Distinct from member quiz reporting.
- Future optional `SavedQuiz` and `SavedPack` ownership-checked join tables; postpone if bookmarks delay core scope. Do not rely on a polymorphic target string without real FK integrity.
- Add owner-facing counts and rating aggregates through existing queries first; materialize caches only if measured query cost requires it.

Migration: additive schema + migration, NULL-compatible new run fields, backfill `currentVersion=1`, no recreation of packs, quizzes, sessions or reviews. Old modes retain existing API responses and tokens. Add DB constraints/validation: `PACK` requires non-null `packId, packVersion, targetCount>0`; weekly/random exactly-five run totals preserved; continuous has null `targetCount`. These conditional invariants can be enforced by SQL check constraints and service validation.

### 3.3 Snapshot and edit behavior

At start of pack play, pin its version, membership/order, localized published quiz revision IDs and target count **atomically** in `PlayRunQuestion`. Future creator edits and pack reordering must not silently alter a run in progress. Score, result and historical review eligibility are derived server-side from the pinned run. Record the pack version on analytics and on new pack reviews.

Pack title/description translations already live in `QuizPackLocalization`; public play requires the chosen language published for the pack **and for every member**. Do not silently fall back to mixed-language questions.

## 4. Publishing and moderation

Two creator workflows:
1. Create/edit a single quiz, with optional add-to-existing-pack.
2. Start a pack and add any number of authored questions (currently 1–100 allowed by contracts), import existing published questions, reorder, test, and publish the pack **and owned drafts** as one explicit confirmed bulk action.

Introduce `pack_publish`/bulk-publication service:
- Performs a dry-run validation summary before final confirmation (missing answers/clues, localization coverage, media readiness, duplicated IDs, conflicts, ownership, publication status, unsafe/restricted members).
- In one database transaction, mark eligible **owned** drafts public and mark the pack/its source localization published; do not grant Kids eligibility.
- Enforce the existing non-admin rolling 24-hour **100 newly published quizzes** quota, counting only drafts newly published in this transaction; `ADMIN` trusted exception remains.
- Require explicit confirmation and audit events. Fail atomically if any member is invalid or quota would be exceeded; do not partially publish a 30-question collection. If referenced non-owned content is unpublished, fail rather than publishing it.
- Ordinary public release remains immediate once validation succeeds, but `safetyStatus=PENDING` does not mean Kids approved.
- Existing `pack_update` stays backwards compatible; publishing can also be mediated through new confirmed service, with shared validation to avoid inconsistent policy.

Availability is **derived** per lane and locale, not controlled by the author:
- General: published pack + published localization + all member quizzes publicly playable, with published revision and approved/accessible media according to existing policy.
- Kids: every member independently safety-approved, kidsEligible and correctly approved in the requested language; independently verify pack metadata/cover/media appropriateness for kids rather than trusting creator labels. Existing child device and guardian time constraints apply.
- If a member becomes restricted/unpublished or a necessary asset is revoked, hide/pause pack play and explain which member needs attention to the owner; never substitute a different question or leak protected content. Resume only after safe resolution, or present a clear cancellation state for irrecoverable runs.
- Weekly reservation/fairness: do not expose active reserved weekly questions through public pack play as a workaround. Temporarily block affected pack runs (with a clear availability message) until reservation ends, or allow a future audited editorial policy change. No skipping the reserved member while claiming pack completion.
- Reporting a pack never replaces reporting an inaccurate/unsafe member quiz.

## 5. Pack play and persistence

`run_start({mode:"PACK", packId, lane:"GENERAL"|"KIDS", locale, order:"CREATOR"|"SHUFFLE"})` validates pack locale/lane, optional shuffle permission and all members before beginning. Already seen questions **are allowed** inside a deliberately selected pack, unlike unseen-only random practice. Pin all selected revision IDs and order; report `total=targetCount`.

Modify `run_current`, `play_guess`, `run_finish`, `run_feedback`, UI and analytics to honor a per-run `targetCount`. End pack only when `currentIndex+1===targetCount`; keep the existing weekly exactly-five invariant. Server is the sole authority for scoring, completion and idempotency; no client-computed finish state. Shared `PlaySession` continues to power per-question reviews and statistics.

- Authenticated user: resume the most recent `ACTIVE` run of the same pack/version, across devices. Explicit "Start again" creates a new unranked attempt; one pack reaction per user+locale remains unaffected.
- Guest: can play public packs via scoped run token; same-browser encrypted-safe capability storage with expiry, no cross-device promise; sign-in required to leave public reactions. Never retroactively treat unrelated guest activity as authenticated review proof.
- Permit quit/resume after any completed round; clear visual `12/30` progress. On very long packs, show estimated duration as approximate, not a requirement.
- Default order is creator-defined. Author may allow optional shuffle; first shuffle is pinned for that run. Pack progress means completed rounds/initial total, not arbitrary page views.
- At completion show total score/accuracy, elapsed experience summary, prominent optional pack reaction and a collapsed "Rate individual questions" panel (not a blocking 30-item rating form).
- Preserve quick random five and infinite play as distinct paths; do not group arbitrary random questions into persistent content packs.
- If the quiz answers/clues change after an active run begins, its immutable pinned revisions remain the scoring source subject to safety re-check.

## 6. Social, ratings and sharing

Each public content type has its own permanent canonical URL:
- Quiz: `/{locale}/play/{quizId}` (keep current route; optionally link back to packs that feature it).
- Pack detail: `/{locale}/packs/{packId}`; player: `/{locale}/packs/{packId}/play` (or a route invoking the common run player with pack metadata).
- Internal copies, browser-native share and MCP `pack_get` return the public canonical URL. Never expose draft/unapproved pack details via public OG crawlers.

Metadata: localized non-spoiler title, description, branded/approved cover, number of questions, creator, optional duration range, normalized type. Open Graph and social previews must not disclose answer keys, unrevealed clues or private media. Browser Share API when available, copy URL fallback.

**Quiz reaction** remains separate from **pack reaction**:
- Pack reaction `+1/-1` and optional short comment after server-verified completion of *that pack and locale* by the signed-in, non-author adult. Exactly one active review per actor/pack/locale, update/remove allowed. Guest cannot rate; no public child reviews and no publication of child identity/history.
- Quiz reaction can be given after finishing that quiz within any run, consistent with current quiz session proof. Reviews from one pack do not multiply when quiz is reused in other packs.
- Show positive sentiment only with `>=5` ratings, display vote count, and use a smoothed, sample-aware ranking function rather than raw 100% from one vote. Do not conflate pack review count with question review counts.
- Optional creator public profile displays published packs and quizzes separately, with independent stats.
- Unique visit/complete/share analytics must be privacy-aware. Sharing itself should be available without tracking user-identifying recipients.

## 7. Information architecture and UI

**Play landing**: primary modes "Random" (quick five / continuous), "Quiz Packs", and "Weekly Challenge". The single-quiz flow remains accessible from Discover and links. Do not present "five" as a platform limit.

**Discover**: segmented `All | Quiz Packs | Questions`; default ranking may feature curated packs, while individual questions retain equal search/filter capability. Cards distinguish type; show pack cover, localized title, question count, creator, positive feedback when eligible and relevant audience/safety. Filters by topic, locale, difficulty and approximate duration. Server-side pagination for both entities.

**Pack detail**: cover, title, description, author/credits, number of questions, language, approximate duration, rating and response count, share/copy, play/resume, optional bookmark. Never display answer-bearing question titles/clues prematurely if they could spoil a progressive reveal; opt-in safe preview only. Show verified progress for signed-in players.

**Studio**: "My Quizzes" and "My Packs"; create single/pack; on multi-question AI/MCP generation offer create-as-pack by default, but do not force grouping. Pack editor supports draft members, add existing, remove/reorder, test full pack **without persisting answers or ratings**, validation summary, batch publish, translations, creator order/shuffle toggle, cover, per-pack analytics. Creator may edit any owned member directly. Avoid a second cloned quiz editor.

**Ratings UX**: do not interrupt each stage of a 30-question pack with mandatory reactions. On pack finish show pack-wide feedback prominently; individual reactions optional (expandable list or visit quiz details). Existing five-random batch rating remains as implemented until a deliberate small UX refinement.

**Kids native**: pack catalog only if all members pass child authorization + language + guardian eligibility. Reuse secure native tokens, server-run engine and time accounting. Child progress private; no social share/reviews, no public leaderboard. Do not add an adult-auth shortcut to Kids.

## 8. REST and MCP parity plan

All paths through `contracts.ts` → `operations.ts.execute` → one shared service; add equal MCP tools and tests. Proposed operations (names are illustrative but must be canonical when implemented):

| REST | MCP operation | Purpose |
| --- | --- | --- |
| GET /api/v1/packs | quizdip_pack_list (existing, extended) | Public/mine, filters, paging, ratings |
| GET /api/v1/packs/:id | quizdip_pack_get | Safe localized details; owner can view draft |
| POST /api/v1/packs | quizdip_pack_create (existing) | Authoring |
| PATCH /api/v1/packs/:id | quizdip_pack_update (existing) | Version-checked edits |
| POST /api/v1/packs/:id/publish | quizdip_pack_publish | Atomic confirmed publication of pack and eligible owned drafts |
| POST /api/v1/runs | quizdip_run_start (existing, PACK mode) | Start/resume pinned pack run |
| POST /api/v1/runs/:id/current | quizdip_run_current (existing) | Progress / next round |
| POST /api/v1/runs/:id/feedback | quizdip_run_feedback (existing, extended) | Safe completed-round metadata |
| GET /api/v1/packs/:id/reviews | quizdip_pack_reviews_list | Public language-scoped reactions |
| POST /api/v1/packs/:id/reviews | quizdip_pack_review_upsert | Completion-scoped pack reaction |
| DELETE /api/v1/packs/:id/reviews | quizdip_pack_review_remove | Remove reaction |
| POST /api/v1/packs/:id/reports | quizdip_pack_report_create | Pack moderation report |
| GET /api/v1/me/packs/:id/insights | quizdip_my_pack_insights | Owner-only non-identifying analytics |

Any bookmarks added later also require parity. A share action is a client native action copying an API-provided canonical URL, not an opaque server share operation; do not invent a privileged MCP exception for it.

Return content `type` discriminator `QUIZ|PACK` from unified Discover service, but use distinct DB models/FKs. Respect `locale=en|ko` and source/original-language classification behavior. Keep legacy REST/MCP operations functional until clients migrate.

## 9. Backward-compatibility and release plan

**Phase 1 — Domain + contracts + regression guards**
- Add pack version / run metadata / pack review-report models and additive migration.
- Refactor exactly-five assumptions to mode-aware `targetCount`; keep existing `RANDOM_FIVE`, `INFINITE`, `WEEKLY` behavior/tokens identical.
- Implement shared pack availability and rating policies. Tests: current weekly ranking and random runs unchanged.

**Phase 2 — Studio authoring and batch publication**
- "My Packs", pack editor, creator order, full preview, publish-all transaction with atomic rollback, locale coverage and safety checks. REST/MCP parity.

**Phase 3 — Full pack playback**
- `PACK` runs, snapshot pinning, resume, progress, multilingual/member gating, score + completion with full run length; web pack route + shared run component. Guest and authenticated cases.

**Phase 4 — Social, Discover and analytics**
- Localized pack detail, OG previews, shared links, pack review/report, owner insights and Discover packs/questions filters. Ranking confidence floor; profile surfaces and optional saved content.

**Phase 5 — Kids native + staged rollout**
- Child-only eligible pack catalog/play via device-scoped actions. Time-limit/approval/withdrawal verification; native simulator and physical-device tests, no child public identity. Staged DB migration and telemetry, then production release only with explicit authorization.

For each phase: unit/integration and DB migration verification, auth/owner policy tests, language/media withdrawal tests, REST/MCP parity tests, npm test/typecheck/build and targeted E2E. Use separate dev/prod persistence. Merge `dev` → `main` **fast-forward only and only after explicit user request**.

## 10. Acceptance criteria

1. All existing quizzes and quiz ratings persist unchanged; old pack links still resolve.
2. Existing random five, continuous, single play and official weekly 5-game scoring/revision/fairness tests stay green.
3. A creator can generate a 30-question pack, reorder it, preview it without writing player data, and explicitly publish pack + owned drafts as one atomic action.
4. A 30-question pack plays all 30, accurately reports `12/30`, resumes at round 13, and finishes at 30 (not 5).
5. The same question in several packs has **one** canonical quiz rating pool; each pack has its **own** rating pool and URL.
6. Public Quiz and Pack sharing display localized spoiler-safe metadata; unpublished or restricted content never appears via OG or API.
7. Kids cannot see or play a pack if even one member lacks the required safety/language/media approval; Kids reviews/rankings remain private or unavailable.
8. Edits during a live run do not change pinned question order/revisions/score. Unsafe content stops safely; no silent item substitution.
9. Unauthenticated guests can play but cannot submit public pack ratings; self-reviews and forged completion fail.
10. Every new browser/public management capability has matching approved REST/MCP behavior and parity tests.

## 11. Deferred decisions / intentionally out of scope

- Pack rankings/leaderboards, rewards, badges or monetization.
- Public collaborator editing of packs, paid licensing and collection-level rights workflows.
- Rich pack version history/rollback UI; immutable per-run snapshots + currentVersion are the initial audit basis.
- Unbounded pack size: current API maximum is 100 members. Retain 100 for MVP and make the limit a documented, adjustable policy after performance/load tests; **never conflate it with the quick-five play preset**.
- Arbitrary pack-only content that bypasses individual quiz moderation.
- Automatic Kids approval, translation or publisher reputation override.
- Artificially merging pack sentiment and quiz sentiment into a single shared rating.
