# Clupio (클루피오)

**Follow the clues. Find the fun.**  
단서를 따라, 재미를 발견해.

Clupio is a playful, open quiz platform where people follow clues, discover answers, and create and share their own quizzes.

> **Status:** REST API, authenticated Remote MCP adapters, PostgreSQL/Prisma models, migration and shared quiz/play/community services are implemented on `dev`. **Not production-ready:** no live database or OIDC provider has been provisioned or authenticated end-to-end; AI categorization, Kids safety automation, upload storage, and an operational admin console remain future work.

## Get started

Node.js 22+ and npm:

```bash
npm install
npm run dev
```

Open http://localhost:3000. To exercise API/MCP, first configure `.env` from `.env.example`, provision PostgreSQL and an OIDC provider, run `npm run db:migrate`. Validation: `npm run test`, `npm run typecheck`, `npm run build`.

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
