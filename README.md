# Clupio (클루피오)

**Follow the clues. Find the fun.**  
단서를 따라, 재미를 발견해.

Clupio is an open, clue-based quiz platform. Play, discover and create games for different ages and interests within one shared platform.

> **Status:** Foundation scaffold. The web app includes a sample playable quiz, but accounts, persistence, public publishing, AI classification, kids review, and Remote MCP are **not implemented**.

## Getting started

Requires Node.js 22+ and npm.

```bash
npm install
npm run dev
```

Open http://localhost:3000.

```bash
npm run test
npm run typecheck
npm run build
```

## Repository layout

```text
apps/
  web/             Next.js web app, demo play, pages and API route handlers
  mcp/             Future Remote MCP integration boundary (design only)
packages/
  domain/          Shared quiz, clue, audience and safety types and helpers
docs/              Architecture, product/brand principles, roadmap
.github/workflows/ Automated checks on dev/main
```

## Product rules

**문제 제작은 자유롭게. 공개는 즉시. 분류는 자동으로. 노출은 사용자에 맞게. 안전 관리는 지속적으로.**

- The creator's intended audience, recommendation/difficulty, and platform safety assessment must remain **independent**.
- A published quiz must not appear in Kids unless platform safety has been approved.
- New quiz modes share the same question/clue domain model.
- Both web Studio and Remote MCP will use one backend/policy implementation.
- Friendly, playful UX without compromising correctness or safety.

## Git workflow

- `dev` is the active development branch.
- `main` is the stable baseline, updated **only on explicit request**.
- Merge using `git merge --ff-only` only (no merge commits, squash, or force pushes).
- Work from `dev` and commit/verify changes before requesting promotion to `main`.

Read [AGENTS.md](AGENTS.md), [architecture](docs/architecture.md), [brand](docs/brand.md), and [roadmap](docs/roadmap.md).
