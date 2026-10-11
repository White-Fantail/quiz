# Clupio (클루피오)

**Follow the clues. Find the fun.**  
단서를 따라, 재미를 발견해.

Clupio is a playful, open quiz platform where people follow clues, discover answers, and create and share their own quizzes.

> **Status:** Foundation scaffold. The browser-based demo quiz works, but authentication, persistence, public publishing, AI categorization, Kids review, the administrator backoffice and Remote MCP **are not yet implemented**.

## Get started

Node.js 22+ and npm:

```bash
npm install
npm run dev
```

Open http://localhost:3000. Validation commands: `npm run test`, `npm run typecheck`, `npm run build`.

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
        mcp/             Reserved endpoint; returns HTTP 501, no tools enabled
    src/
      modules/           Shared business services for quiz, game, user,
                         moderation, media, analytics and AI
      components/        Future reusable UI
      lib/               Future server infrastructure
packages/
  domain/                Shared pure types and rules for multimodal quizzes
prisma/                  Future PostgreSQL schema and migrations
docs/                    Architecture, brand, product principles and roadmap
.github/workflows/       CI for dev and main
```

All UI, REST endpoints and future MCP tools will share one **application service/policy layer** and one persistence layer. They are separated in code, not deployed as separate API, admin or MCP servers.

## Current routes

| Path | Behavior |
| --- | --- |
| `/`, `/discover`, `/play` | Public landing/discovery and a browser-only demo quiz |
| `/studio`, `/kids` | Planning placeholders (not functional editors/review tools) |
| `/admin` | Deliberately returns 404 until authentication and admin authorization exist |
| `/api/health` | Health check |
| `/api/v1/quizzes` | Demo quiz **metadata only**; no answers or clue contents |
| `/api/mcp` | HTTP 501 Not Implemented; no MCP functionality |

## Product rules

**문제 제작은 자유롭게. 공개는 즉시. 분류는 자동으로. 노출은 사용자에 맞게. 안전 관리는 지속적으로.**

Creator intent, AI recommended audience/difficulty and platform-managed safety are independent. Only platform-approved, published content may be visible in Kids. The current demo is not a published/approved Kids question.

## Git workflow

- **`dev`** is the active development branch.
- **`main`** is the stable baseline, advanced only on explicit request.
- Use **fast-forward-only** merges (`git merge --ff-only`); no merge commits, squash merges or force pushes.

See [AGENTS.md](AGENTS.md), [architecture](docs/architecture.md), [brand](docs/brand.md) and [roadmap](docs/roadmap.md).
