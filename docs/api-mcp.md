# Clupio REST API / Remote MCP v1

The web UI, REST API and MCP tools reuse `execute()` and the same policy layer. MCP is a permanent, full-capability interface. The mandatory future feature parity rule lives in `AGENTS.md`.

## Endpoint mapping

| Action | HTTP REST | MCP tool |
| --- | --- | --- |
| Capabilities and schemas | GET /api/v1/catalog | clupio_catalog |
| List public / own / Kids-eligible quizzes | GET /api/v1/quizzes | clupio_quiz_list |
| Get question (answer only for owner) | GET /api/v1/quizzes/:id | clupio_quiz_get |
| Create versioned question | POST /api/v1/quizzes | clupio_quiz_create |
| Edit with expectedVersion | PATCH /api/v1/quizzes/:id | clupio_quiz_update |
| Replace clue sequence | PUT /api/v1/quizzes/:id/clues | clupio_clues_replace |
| Confirm public publication | POST /api/v1/quizzes/:id/publish | clupio_quiz_publish |
| List/create packs | GET/POST /api/v1/packs | clupio_pack_list / clupio_pack_create |
| Update pack and publication | PATCH /api/v1/packs/:id | clupio_pack_update |
| Start game | POST /api/v1/play | clupio_play_start |
| Reveal next clue | POST /api/v1/play/:id/clue | clupio_play_clue |
| Submit answer | POST /api/v1/play/:id/guess | clupio_play_guess |
| List/leave reviews | GET/POST /api/v1/quizzes/:id/reviews | clupio_reviews_list / clupio_review_upsert |
| Submit report | POST /api/v1/quizzes/:id/reports | clupio_report_create |
| My reports | GET /api/v1/reports/mine | clupio_reports_mine |
| Version-scoped success analytics | GET /api/v1/quizzes/:id/stats | clupio_quiz_stats |
| My profile / questions / statistics | GET /api/v1/me, /me/quizzes, /me/stats | clupio_me / clupio_my_quizzes / clupio_my_stats |
| Verified adult rankings | GET /api/v1/leaderboard | clupio_leaderboard |
| Creator's public profile/reputation | GET /api/v1/users/:id | clupio_user_get |
| Creator's reviews | GET /api/v1/users/:id/reviews | clupio_creator_reviews_list |
| Review a creator after playing their question | POST /api/v1/users/:id/reviews | clupio_creator_review_upsert |

Tool arguments are typed by Zod schemas in `apps/web/src/modules/platform/contracts.ts`, and validation also runs for REST. REST uses JSON response envelopes `{ data: ... }`; mutations accept a JSON object body. MCP uses Streamable HTTP at `/api/mcp` (SDK v2, stateless).

## Content and score semantics

Clues are ordered and stored per immutable `QuizRevision`. Each session is pinned to the revision it started on. An authenticated creator can read their answers and complete clue sequence, but public metadata never returns answers; game sessions reveal **one clue at a time** after presenting the random session token.

User review rating is `+1` or `-1` and requires a completed play. A report is a separate workflow, not a dislike.

**Success rate:** solved / (solved + failed). Active or abandoned games are not counted in the denominator. `quiz_stats.version` selects historic versions; omission selects the current version. The distribution `correctByClueStage` counts solved games at their final clue stage.

**Ranking:** users must have separately verified adult eligibility, set by trusted server-side administration. This defaults to false. Aggregate score takes each user's highest solved score **once per quiz**, not every replay. Account-based ranking excludes anonymous sessions and unverified/child accounts. `my_stats.rank` is null until qualified.

General publication doesn't mean Kids approval: pending/unverified content is excluded from Kids mode; creators cannot alter the platform safety fields.

## Operational requirements

The repository contains the API and MCP implementation and an initial Prisma migration. It adds Better Auth Google/Apple sign-in, account linking, MCP OAuth authorization and consent flows in source, but does not provision live OAuth secrets, PostgreSQL, object storage, AI classifiers or a moderation backoffice.

Before remote access:
1. Follow [Google/Apple SSO and MCP OAuth setup](auth-sso-mcp.md). Configure and migrate development PostgreSQL before production.
2. Configure Google and Apple provider credentials, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, and `PUBLIC_ORIGIN`. The old `OIDC_ISSUER`/`OIDC_AUDIENCE`/`OIDC_JWKS_URL` configuration has been replaced.
3. Apply both migrations: Prisma domain (`npm run db:migrate`) and Better Auth auth/OAuth tables (`npx auth@1.7.7 migrate --config ./apps/web/src/lib/auth.ts --yes`).
4. Run tests, typecheck and build, then verify signed-in web identity matches MCP `clupio_me` identity, linking, refresh, consent, account restrictions, Kids and rankings.
5. Before public traffic, enable distributed OAuth and game rate limiting, moderation/abuse automation, adult eligibility checks and verified media storage.

Never treat an MCP tool listed in metadata or a passing typecheck as proof that it is live with an authenticated DB.

## Authentication interface exception

OAuth provider sign-in, linking and unlinking Google/Apple accounts, and interactive third-party consent are **deliberately web-only** user-presence operations at `/sign-in`, `/account` and `/consent`, rather than MCP tools. This prevents an AI agent from silently rebinding the owner's identity or authorizing a new external client. ChatGPT initiates the standard MCP OAuth protocol, which redirects the human to these screens; afterward it uses the verified `clupio_me` tool to identify the same account. OAuth refresh/revocation are standard authorization-server endpoints, not business-domain MCP tools.
