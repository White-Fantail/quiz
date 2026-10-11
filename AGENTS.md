# Clupio AI development instructions

## Product and branding
Clupio is a friendly quiz playground centered on progressive clues and the joy of discovery. External name: **Clupio (클루피오)**; repository name: `quiz`. Follow [docs/brand.md](docs/brand.md).

## Architecture
- Implement a **single Next.js modular monolith** on Vercel: public Play/Discover, creator Studio, restricted Admin, REST API and future Remote MCP share one deployment.
- Web page, Server Action, REST route and MCP tool adapters must call the **same service/policy layer**. Do not duplicate publishing/safety rules or call internal HTTP endpoints unnecessarily from server code.
- Use `apps/web/app/(platform)` for public UI, `(creator)` for Studio, `admin` for admin pages, `api/v1` for REST and `api/mcp` for remote MCP.
- Business modules live in `apps/web/src/modules`; pure cross-cutting types/helpers in `packages/domain`; future Prisma/PostgreSQL schema in `prisma`.
- Admin pages **and admin APIs** must independently enforce server-side ADMIN authorization. Keep admin inaccessible until real authentication exists.
- Real answers and privileged logic must stay server-side; the existing browser sample is a deliberate non-production demo.
- No live MCP transport, account system, database, AI categorization, Kids review, publication or admin features are implemented yet. The MCP route intentionally responds HTTP 501.

## Product and safety
1. Keep creator target intent, AI recommendations/difficulty and platform-controlled safety **independent**.
2. Creators cannot set or override platform safety.
3. Ordinary publishing should be low friction with automatic anti-abuse/safety checks; Kids eligibility requires affirmative platform approval.
4. Preserve multimodal clues and variable game rules; never force the same clue count/scoring onto every mode.
5. Collect minimal children's data. Be accurate and neutral on politics/history.
6. Never claim planned or untested functionality exists.

## Git and validation
1. Work on `dev` by default; do not merge into `main` unless explicitly asked.
2. Integrate changes **fast-forward-only**; no merge commits, squash merges or force pushes.
3. Implement in small steps with tests, typechecking, builds, authorization checks and regression coverage.
4. Keep separate dev/prod secrets and persistence once introduced.
