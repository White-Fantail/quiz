# Clupio (클루피오)

**Follow the clues. Find the fun.**  
단서를 따라, 재미를 발견해.

Clupio is a playful, open quiz platform where people follow clues, discover answers, and create and share their own quizzes.

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
      admin/             Admin entry point (404 until authorization exists)
      api/
        v1/              REST API route handlers
        mcp/             Authenticated stateless MCP endpoint and tool registry
    src/
      modules/           Shared business services for quiz, game, user,
                         moderation, media, analytics and AI
      components/        Future reusable UI
      lib/               Future server infrastructure
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
| `/`, `/discover`, `/play` | Public landing/discovery and a browser-only demo quiz |
| `/studio`, `/kids` | Planning placeholders (not functional editors/review tools) |
| `/admin` | Deliberately returns 404 until authentication and admin authorization exist |
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

See [AGENTS.md](AGENTS.md), [architecture](docs/architecture.md), [brand](docs/brand.md) and [roadmap](docs/roadmap.md).

## API and MCP setup

Read [API–MCP documentation](docs/api-mcp.md) for the parity matrix, security model, configuration and launch gates. All future functional additions require corresponding MCP support; see [AGENTS.md](AGENTS.md). The demo browser UI remains separate from the new persistent platform backend.

## Single sign-on across web and MCP

Google and Apple sign-in are at `/sign-in`. Link additional providers from `/account`, and approve external MCP clients at `/consent`. All browser and ChatGPT identities use one Better Auth user ID. See [SSO and MCP OAuth setup](docs/auth-sso-mcp.md) for provider callback URLs, environment variables, database migrations, security and test requirements. No accounts are silently joined based on matching email addresses.

## Cloudflare R2 media library

The authenticated Studio media library at `/studio/media` uploads image, audio and video directly to a private R2 bucket. Web REST and 36 MCP operations use the same asset IDs and authorization rules. The full API table, required environment variables, R2 CORS and lifecycle configuration, upload fallback for MCP clients, checksums, moderation gates, and end-to-end checklist are in [the Cloudflare R2 media guide](docs/media-r2.md). This code does not provision an R2 bucket or activate public uploads automatically.

## Weekly spotlight and practice play

The main `/play` experience is the **featured creator's same five questions for everyone** in a Monday-to-Monday UTC edition, with separate GENERAL and KIDS audiences. Creators submit five owned quizzes through `/studio/weekly` or REST/MCP; an authorized moderator schedules one per week/lane through `/admin/weekly`. Players choose the weekly, random-five or infinite mode, use server-side progressive clues, and receive question and run scores. The weekly public ranking requires both verified adult status and explicit player opt-in, and is GENERAL only. See [weekly play design, tools and deployment](docs/play-modes.md). Configure `PLAY_RUN_SECRET` and apply the weekly Prisma migration before using these endpoints.
