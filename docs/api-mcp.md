# QuizDip REST API / Remote MCP v1

The web UI, REST API and MCP tools reuse `execute()` and the same policy layer. MCP is a permanent, full-capability interface. The mandatory future feature parity rule lives in `AGENTS.md`.

## Endpoint mapping

| Action | HTTP REST | MCP tool |
| --- | --- | --- |
| Capabilities and schemas | GET /api/v1/catalog | quizdip_catalog |
| Topic discovery | GET /api/v1/topics?q=... | quizdip_topic_list |
| Featured weekly edition and host | GET /api/v1/weekly/current | quizdip_weekly_current |
| Creator's five-question weekly submission | POST /api/v1/weekly/submit | quizdip_weekly_submit |
| ADMIN proposal queue and approved schedule | GET /api/v1/weekly/proposals, POST /api/v1/weekly/:id/publish | quizdip_weekly_proposals / quizdip_weekly_publish |
| ADMIN suspend an edition | POST /api/v1/weekly/:id/suspend | quizdip_weekly_suspend |
| Weekly official first-attempt leaderboard | GET /api/v1/weekly/:id/standings | quizdip_weekly_standings |
| Begin/resume weekly/five random/infinite | POST /api/v1/runs | quizdip_run_start |
| Current question in fixed run | POST /api/v1/runs/:id/current | quizdip_run_current |
| Completed run questions and ratings (requires run token) | POST /api/v1/runs/:id/feedback | quizdip_run_feedback |
| End infinite practice | POST /api/v1/runs/:id/finish | quizdip_run_finish |
| User's run history | GET /api/v1/runs | quizdip_run_history |
| Public ranking user consent | PATCH /api/v1/me/ranking | quizdip_ranking_optin |
| Adult eligibility verification (ADMIN) | POST /api/v1/admin/verify-adult | quizdip_adult_verify |
| Reserve R2 media upload / upload small base64 chunk / seal asset | POST /api/v1/media/upload, POST /api/v1/media/:id/chunk, POST /api/v1/media/:id/complete | quizdip_media_upload / quizdip_media_chunk / quizdip_media_complete |
| Import media by approved HTTPS hostname | POST /api/v1/media/import | quizdip_media_import |
| My media asset library | GET /api/v1/media, GET /api/v1/media/:id | quizdip_media_list / quizdip_media_get |
| Metadata update / confirmed deletion | PATCH /api/v1/media/:id, DELETE /api/v1/media/:id | quizdip_media_update / quizdip_media_delete |
| Image crop/blur/resize | POST /api/v1/media/:id/transform | quizdip_media_transform |
| ADMIN-only media moderation | POST /api/v1/media/:id/review | quizdip_media_review |
| Session-gated signed media URL | POST /api/v1/play/:id/media | quizdip_play_media |
| List public / own / Kids-eligible quizzes | GET /api/v1/quizzes | quizdip_quiz_list |
| Get question (answer only for owner) | GET /api/v1/quizzes/:id | quizdip_quiz_get |
| Clear own rating | DELETE /api/v1/quizzes/:id/reviews | quizdip_review_remove |
| ADMIN inspect full quiz and answer | GET /api/v1/quizzes/:id/review | quizdip_quiz_review_get |
| ADMIN independently approve Kids or restrict quiz | POST /api/v1/quizzes/:id/review | quizdip_quiz_review |
| ADMIN inspect media | GET /api/v1/media/:id/review | quizdip_media_review_get |
| Create versioned question | POST /api/v1/quizzes | quizdip_quiz_create |
| Edit with expectedVersion | PATCH /api/v1/quizzes/:id | quizdip_quiz_update |
| Replace clue sequence | PUT /api/v1/quizzes/:id/clues | quizdip_clues_replace |
| Confirm public publication | POST /api/v1/quizzes/:id/publish | quizdip_quiz_publish |
| List/create packs | GET/POST /api/v1/packs | quizdip_pack_list / quizdip_pack_create |
| Update pack and publication | PATCH /api/v1/packs/:id | quizdip_pack_update |
| Start game | POST /api/v1/play | quizdip_play_start |
| Reveal next clue | POST /api/v1/play/:id/clue | quizdip_play_clue |
| Submit answer | POST /api/v1/play/:id/guess | quizdip_play_guess |
| List/leave reviews | GET/POST /api/v1/quizzes/:id/reviews | quizdip_reviews_list / quizdip_review_upsert |
| Submit report | POST /api/v1/quizzes/:id/reports | quizdip_report_create |
| My reports | GET /api/v1/reports/mine | quizdip_reports_mine |
| Version-scoped success analytics | GET /api/v1/quizzes/:id/stats | quizdip_quiz_stats |
| My profile / searchable, paginated authored questions / statistics | GET /api/v1/me, /me/quizzes, /me/stats | quizdip_me / quizdip_my_quizzes / quizdip_my_stats |
| Owner-only feedback and result summary (all versions), paginated reviews | GET /api/v1/me/quizzes/:id/insights | quizdip_my_quiz_insights |
| Verified adult rankings | GET /api/v1/leaderboard | quizdip_leaderboard |
| Creator's public profile/reputation | GET /api/v1/users/:id | quizdip_user_get |
| Creator's reviews | GET /api/v1/users/:id/reviews | quizdip_creator_reviews_list |
| Review a creator after playing their question | POST /api/v1/users/:id/reviews | quizdip_creator_review_upsert |

Tool arguments are typed by Zod schemas in `apps/web/src/modules/platform/contracts.ts`, and validation also runs for REST. REST uses JSON response envelopes `{ data: ... }`; mutations accept a JSON object body. MCP uses Streamable HTTP at `/api/mcp` (SDK v2, stateless).

## Content and score semantics

Clues are ordered and stored per immutable `QuizRevision`. Image, audio and video clues use `mediaId`; optional prompt media use `promptMediaIds`. All asset storage is private Cloudflare R2 and documented in [media design and setup](media-r2.md). Each session is pinned to the revision it started on. An authenticated creator can read their answers and complete clue sequence, but public metadata never returns answers; game sessions reveal **one clue at a time** after presenting the random session token.

User review rating is `+1` or `-1` and requires a completed play. A report is a separate workflow, not a dislike.

**Success rate:** solved / (solved + failed). Active or abandoned games are not counted in the denominator. `quiz_stats.version` selects historic versions; omission selects the current version. The distribution `correctByClueStage` counts solved games at their final clue stage.

**Ranking:** users must have separately verified adult eligibility, set by trusted server-side administration. This defaults to false. Aggregate score takes each user's highest solved score **once per quiz**, not every replay. Account-based ranking excludes anonymous sessions and unverified/child accounts. `my_stats.rank` is null until qualified.

Metadata v2: `mode` is the play mechanic (`progressive-clues`); `answerType` is independent. `topics` replaces categories/tags, and GPT can suggest `recommendedAudience` separately from editable `creatorIntent`. Public topic discovery and filtering always hide spoiler-linked topics. Neither GPT nor a creator can set platform safety. No separate server AI classifier is deployed yet.

General publication doesn't mean Kids approval: pending/unverified content is excluded from Kids mode; creators cannot alter the platform safety fields.

## Operational requirements

The repository contains the API and MCP implementation and Prisma migrations for core, media and weekly play. It adds Better Auth Google/Apple sign-in, account linking, MCP OAuth authorization and consent flows in source, but does not provision live OAuth secrets, PostgreSQL, object storage, AI classifiers or a moderation backoffice.

Before remote access:
1. Follow [Google/Apple SSO and MCP OAuth setup](auth-sso-mcp.md). Configure and migrate development PostgreSQL before production.
2. Configure Google and Apple provider credentials, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, and `PUBLIC_ORIGIN`. The old `OIDC_ISSUER`/`OIDC_AUDIENCE`/`OIDC_JWKS_URL` configuration has been replaced.
3. Apply both migrations: Prisma domain (`npm run db:migrate`) and Better Auth auth/OAuth tables (`npx auth@1.7.7 migrate --config ./apps/web/src/lib/auth.ts --yes`).
4. Run tests, typecheck and build, then verify signed-in web identity matches MCP `quizdip_me` identity, linking, refresh, consent, account restrictions, Kids and rankings.
5. Before public traffic, enable distributed OAuth and game rate limiting, moderation/abuse automation, adult eligibility checks and verified media storage.

Never treat an MCP tool listed in metadata or a passing typecheck as proof that it is live with an authenticated DB.

## Authentication interface exception

OAuth provider sign-in, linking and unlinking Google/Apple accounts, and interactive third-party consent are **deliberately web-only** user-presence operations at `/sign-in`, `/account` and `/consent`, rather than MCP tools. This prevents an AI agent from silently rebinding the owner's identity or authorizing a new external client. ChatGPT initiates the standard MCP OAuth protocol, which redirects the human to these screens; afterward it uses the verified `quizdip_me` tool to identify the same account. OAuth refresh/revocation are standard authorization-server endpoints, not business-domain MCP tools.

