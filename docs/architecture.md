# QuizDip — technical architecture and engineering standards

## Baseline decision: one Vercel Next.js app

Start from **Next.js 16 + TypeScript** in a single **modular monolith** deployed to **Vercel**. Keep public Play/Discover, Creator Studio, Admin Backoffice, versioned REST API and Remote MCP in the same deployed application and a common policy/data model. Initial setup does **not** include a separate FastAPI/Python server or microservices. Add a specialized worker only after clear requirements (Python media models, GPU, long processing, measured Vercel limits or independently scaling load).

| Concern | Baseline | Current caveat |
| --- | --- | --- |
| Web/API/remote MCP | Next.js Route Handlers on Vercel | OAuth and production deploy need real E2E verification |
| Relational store | PostgreSQL and Prisma migrations | Manage independent preview/production instances |
| Initial managed DB option | Prisma Postgres | Connection is environment-configured; provider choice can change |
| Media objects | **Private Cloudflare R2** | Current code adopted R2, overriding the earlier proposed Vercel Blob; real-bucket validation required |
| AI creation and review | External AI model APIs | Provider, costs and automated classification still to be determined/implemented |
| Long-running work | Durable queues/workflows only when needed | Never fire-and-forget after an HTTP response |
| Authentication | Better Auth + Google/Apple and resource-bound OAuth for MCP | Credentials, consent and migrations must be validated in each environment |

A Vercel app may use an external DB, R2 and AI providers; “one deployment” does not imply all services run inside Vercel.

## Source layout (actual monorepo)

- apps/web/app/(platform): public homepage, /discover, /play, /kids.
- apps/web/app/(creator)/studio: creator/weekly/media experiences.
- apps/web/app/admin: administration, weekly editorial schedule, safety review.
- apps/web/app/api/v1: versioned REST routes.
- apps/web/app/api/mcp: Remote MCP endpoint; OAuth metadata under .well-known.
- apps/web/src/modules/platform: business services, operation registry, validated contracts, DB, identity, media, runs, quality.
- apps/web/src/modules/{quiz,game,user,moderation,media,analytics,ai}: domain extension modules.
- packages/domain: pure shared types and game safety/score helpers.
- prisma: schema, migrations; apps/web/test and packages/domain/test: regression tests.

**Dependency rule:** Page / Action / REST handler / MCP adapter → Shared Service and Policy → Repository/Prisma → PostgreSQL. Boundaries validate identity, inputs and output; do not duplicate registration, moderation, scoring or ownership decisions. A server component need not make an HTTP call back to its own REST endpoint. Do not leak answer keys, unrevealed clues, privileged moderation, API tokens or raw private media into browser bundles.

## Content model and lifecycle

Use Question, Answer/aliases, ordered multimodal Clue, Media, Category, Difficulty, Audience, Safety and Quiz Pack. Each game type can vary answer format, clue release, number of clues and point calculation. Keep relational metadata separate from media object bytes. Validate image/audio/video uploads for type, file signature, size, hash, rights, ownership and HTTPS import rules; keep objects private with expiring signed access and independent moderation. Uploaded or transformed assets are **not approved** by default. Consult [media-R2](media-r2.md) for actual code contracts.

Creator intention, AI difficulty/recommendation and trusted platform safety are independent. General publication does not imply Kids eligibility; uncertain Kids classifications remain withheld. Published revisions should be pinned to gameplay/weekly scores and have version-aware aggregates. Use [content policy](content-policy.md), [quiz metadata](quiz-metadata.md) and [play modes](play-modes.md) for enforcement details.

## REST / MCP / auth / moderation

All REST and MCP actions use the shared operation registry and policy services. This repository **requires REST/MCP capability parity** for new features, except explicit security-driven omissions recorded in the docs. MCP is not only an authoring connector; it should cover supported product operations with appropriate permissions.

- Authenticate per-user OAuth for MCP, session cookies for web; map both to the same durable Better Auth user ID. Do not silently merge accounts by matching Google/Apple email addresses.
- All writes and sensitive reads require server-side ownership, role and safety authorization. Check **Admin pages AND Admin APIs**; hiding navigation is insufficient.
- Confirm high-impact publish, bulk changes, deletions and similar actions. Audit, bound requests and defend against prompt injection from AI-submitted content.
- Keep public Play answers server-validated, scores atomic, weekly question revisions stable and official rankings limited to verified opt-in adults. Kids has distinct weekly editions without child-public rankings.
- Avoid claiming SSO works merely because OAuth routes exist; test real callback, consent, token exchange and authorized tool calls.

## Background work and scaling

Short AI text creation or validation may run in a request. Large media analysis, long generation, re-classification and periodic stats need reliable queues or workflows with persistence, retries, idempotency and duplicate prevention. Do not use unsupported serverless fire-and-forget. Introduce Python/GPU workers only when a measured workload needs them, while continuing to reuse common publishing/safety decisions.

## Deploy, test, operate

- **dev** = active integration and Vercel preview; **main** = stable/production; merge only when user explicitly asks, **fast-forward only**. See [development workflow](development-workflow.md).
- Separate dev/production DBs, OAuth callbacks, storage, secrets, AI keys and accounts. Apply migrations with deployment-order/rollback review.
- Test domain/service rules, TypeScript, build, REST–MCP parity, create→edit→publish→play, Kids approval and withheld cases, inaccessible Admin routes, nonpublic media, pinned revisions, ranking consent and analytic consistency.
- Handle child privacy, copyrighted media, anti-spam and abuse reports. Keep source and usage limits honest.
- **State of development:** REST/MCP operations, DB models, OAuth code, media and moderator interfaces may exist in source without production provisioning. AI auto-classification and full Kids safety automation must not be reported as implemented absent proof.

Unresolved details include authentication provider configuration, AI vendor/budgets, worker orchestration, final game clue/schema refinements, optional cache/analytics scaling, UI accessibility and production authorization/asset E2E. Choose the simplest verified design; avoid speculative architecture.
