# QuizDip (퀴즈딥)

**A little quiz. A lot of fun.**  
단서를 따라, 재미를 발견해.

QuizDip is an open quiz playground where people dip into clue-led games, tackle a weekly five-question challenge, and create and share their own quizzes.

> **Status:** REST API, authenticated Remote MCP adapters, PostgreSQL/Prisma models, migration and shared quiz/play/community services are implemented on `dev`. **Not production-ready:** Google/Apple SSO and MCP OAuth code have been added, but live credentials, Better Auth migrations and end-to-end sign-in have not yet been verified; AI categorization, Kids safety automation, upload storage, and an operational admin console remain future work.

## Get started

Node.js 22+ and npm:

```bash
npm install
npm run dev
```

Open http://localhost:3000. To exercise API/MCP, first configure `.env` from `.env.example`, provision PostgreSQL and Google/Apple credentials, run `npm run db:migrate` plus the Better Auth migration described in `docs/auth-sso-mcp.md`. Validation: `npm run test`, `npm run typecheck`, `npm run build`.

## Architecture: one Next.js app, separate responsibilities

```text
apps/
  web/
    app/
      (platform)/        Home, Play, Discover and Kids (public URL paths unchanged)
      (creator)/studio/  Creator Studio UI
      admin/             Protected admin routes and moderation consoles
      api/
        v1/              REST API route handlers
        mcp/             Authenticated stateless MCP endpoint and tool registry
    src/
      modules/           Shared business services for quiz, game, user,
                         moderation, media, analytics and AI
      components/        Reusable UI
      lib/               Shared server infrastructure
packages/
  domain/                Shared pure types and rules for multimodal quizzes
prisma/                  PostgreSQL schema and migrations
docs/                    Architecture, brand, product principles and roadmap
.github/workflows/       CI for dev and main
```

REST and MCP adapters use the same **application service/policy layer** and persistence layer. They are separated in code, not deployed as separate API, admin or MCP servers.

## Current routes

| Path | Behavior |
| --- | --- |
| `/`, `/discover`, `/play` | Public discovery and game experience; live play requires configured backend services |
| `/studio` | Creator entry, media library and weekly proposal UI; full general-purpose editor remains a separate feature |\n| `/kids` | Child-facing mode; content must independently pass the trusted Kids safety gate |
| `/admin/*` | Restricted admin, weekly scheduling and safety review; requires server-side ADMIN checks |
| `/api/health` | Health check |
| `/api/v1/*` | Versioned REST: quizzes, packs, play sessions, reviews, reports, personal metrics and leaderboard |
| `/api/mcp` | Authenticated stateless Streamable HTTP MCP, mirroring API operations |

## Product rules

**문제 제작은 자유롭게. 공개는 즉시. 분류는 자동으로. 노출은 사용자에 맞게. 안전 관리는 지속적으로.**

Creator intent, AI recommended audience/difficulty and platform-managed safety are independent. Only platform-approved, published content may be visible in Kids. The current demo is not a published/approved Kids question.

## Git workflow

- **`dev`** is the active development branch.
- **`main`** is the stable baseline, advanced only on explicit request.
- Use **fast-forward-only** merges (`git merge --ff-only`); no merge commits, squash merges or force pushes.

See [AGENTS.md](AGENTS.md), [product vision](docs/product-principles.md), [clue design](docs/clue-design.md), [content/safety policy](docs/content-policy.md), [creator workflows](docs/creator-workflows.md), [brand](docs/brand.md), [architecture](docs/architecture.md), [development workflow](docs/development-workflow.md) and [roadmap](docs/roadmap.md). The official brand and GitHub repository are **QuizDip** / `White-Fantail/quizdip`; npm workspaces and imports are now consistently `@quizdip/*`; the legacy signed token v1 namespace remains stable for existing-session compatibility.

## API and MCP setup

Read [API–MCP documentation](docs/api-mcp.md) for the parity matrix, security model, configuration and launch gates. All future functional additions require corresponding MCP support; see [AGENTS.md](AGENTS.md). The demo browser UI remains separate from the new persistent platform backend.

## Single sign-on across web and MCP

Google and Apple sign-in are at `/sign-in`. Link additional providers from `/account`, and approve external MCP clients at `/consent`. All browser and ChatGPT identities use one Better Auth user ID. See [SSO and MCP OAuth setup](docs/auth-sso-mcp.md) for provider callback URLs, environment variables, database migrations, security and test requirements. No accounts are silently joined based on matching email addresses.

## Cloudflare R2 media library

The authenticated Studio media library at `/studio/media` uploads image, audio and video directly to a private R2 bucket. Web REST and 36 MCP operations use the same asset IDs and authorization rules. The full API table, required environment variables, R2 CORS and lifecycle configuration, upload fallback for MCP clients, checksums, moderation gates, and end-to-end checklist are in [the Cloudflare R2 media guide](docs/media-r2.md). This code does not provision an R2 bucket or activate public uploads automatically.

## Weekly spotlight and practice play

The main `/play` experience is the **featured creator's same five questions for everyone** in a Monday-to-Monday UTC edition, with separate GENERAL and KIDS audiences. Creators submit five owned quizzes through `/studio/weekly` or REST/MCP; an authorized moderator schedules one per week/lane through `/admin/weekly`. Players choose the weekly, random-five or infinite mode, use server-side progressive clues, and receive question and run scores. The weekly public ranking requires both verified adult status and explicit player opt-in, and is GENERAL only. See [weekly play design, tools and deployment](docs/play-modes.md). Configure `PLAY_RUN_SECRET` and apply the weekly Prisma migration before using these endpoints.

## Trusted safety moderation

Staff can inspect full quiz answers, clues and media via /admin/quiz-review before approving Kids eligibility. REST and MCP share the four ADMIN-only quiz_review_get, quiz_review, media_review_get and media_review operations. This is human moderation, not a live automatic AI classifier.

## QuizDip rebrand rollout

The code and docs use the new brand; connecting `quizdip.com`, configuring production origins/SSO callbacks and replacing any third-party app name or DNS entries are separate deployment steps. MCP operations use the `quizdip_*` prefix. Existing signed session token formats remain unchanged for backward compatibility; local sample names do not rename deployed DB/bucket resources.

## Multilingual foundation (Phase 1)

The web now supports locale-prefixed pages (/en and /ko), UI language selection, a shared typed message catalog, and signed-in locale preferences through REST/MCP. Additive Prisma migration `20261012070000_multilingual_foundation` introduces version-ready localization records with honest `und` legacy classification. Content language filtering, translation workflows and full deep-page copy coverage remain Phase 2/3; do not mistake an English interface for an English-only quiz catalog until then. See [multilingual plan](docs/i18n-foundation.md).

## Strict language filtering (Phase 2)
Public quiz catalog, topic lookup, packs, single-play, random-five, infinite runs and weekly snapshots are now language-scoped on the server for `en` and `ko`. Existing `und` quizzes are intentionally hidden from public language catalogs until their author verifies their true original language via Studio or API/MCP. Supplying a wrong locale does not translate or fallback the content. Apply migration `20261012080000_language_eligible_play` in dev before using this release. See [implementation details](docs/i18n-foundation.md). Remaining UI copy and translation creation are follow-up work.

## Phase 3 translation Studio

Open Studio → My Quiz → Language Versions to draft, AI-suggest (optional), review and publish English/Korean translations without overwriting the original language. Production requires migration `20261012100000_translation_versions`.
