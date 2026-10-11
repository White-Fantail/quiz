# Architecture — Clupio single-deployment modular monolith

## Decision

The initial Clupio deployment is **one Next.js 16 + TypeScript application on Vercel**. Public Quiz/Play/Discover, creator Studio, restricted Admin, REST API and Remote MCP are logically separated but **not** independent applications or API servers. Introducing a separate FastAPI service or Python worker is not part of the initial setup.

When real load or long-running GPU/media processing justifies it, add a separately deployed worker/service without splitting shared policy logic prematurely.

The persistence selection is **PostgreSQL + Prisma ORM** (Prisma Postgres is the initial managed DB candidate). Media object storage starts as a separate concern (Vercel Blob is an initial option). Neither persistence nor storage is connected in this scaffold.

## Directory map

```text
apps/web/
  app/
    (platform)/         /, /play, /discover, /kids
    (creator)/studio/   /studio
    admin/              /admin; fail-closed until auth/roles exist
    api/
      v1/               REST routes
      mcp/              reserved Remote MCP route, HTTP 501
  src/
    modules/
      quiz/             quiz content service, versioning & publication (later)
      game/             play rules, score, server answer validation (later)
      user/             auth and role checks (later)
      moderation/       safety, Kids exposure, reports (later)
      media/            file access/storage (later)
      analytics/        metrics & aggregates (later)
      ai/               generation/classification (later)
    components/         shared UI (later)
    lib/                database/auth/storage infrastructure (later)
packages/domain/        shared types and pure rules
prisma/                 future Prisma schema and migrations
```

Route groups in parentheses do **not** appear in URLs: `app/(platform)/play/page.tsx` serves `/play`, and `app/(creator)/studio/page.tsx` serves `/studio`.

## Mandatory dependency direction

```text
Page / Server Action / REST Route / MCP Tool
                      ↓
             Shared Service Layer
                      ↓
             Repository / Prisma
                      ↓
                  PostgreSQL
```

Entry points receive/authenticate requests, validate inputs, call a common service and shape output. Server components and internal server code should call the service directly rather than making unnecessary HTTP requests to the local REST API. Shared domain types and pure rules live in `packages/domain`. Auth checks, platform safety and database access are server-side only.

**Current scope:** `quiz/service.ts` only supplies sanitized, read-only metadata for a local demo question. No actual DB, auth, creator publication, safety assessment or Remote MCP implementation exists yet.

## API, MCP and Admin

- `/api/v1/*`: HTTP boundary for versioned content, game, user and other APIs. Currently `/api/v1/quizzes` returns *demo metadata only*; answers and clue text are deliberately omitted.
- `/api/mcp`: **reserved, nonfunctional route** which responds HTTP 501 to GET/POST; no unauthenticated tools are exposed.
- `/admin`: intentionally **404** until login and server-side admin authorization are added. Future admin APIs need their own independent role checks. An obscured navigation link is not authorization.
- `/studio`: informational placeholder, not a functional creator editor.

Future Remote MCP will be an authenticated Next.js Route Handler adapter to the same service and policy layer used by Studio/REST. Its user permissions, confirmation on publish, idempotency and rate limits need to be enforced centrally.

## Content and safety

Multimodal clues may contain text, image, audio, video or map data. Question difficulty and recommended audience are independent from creator target intention and platform-assessed content safety.

Publication and Kids eligibility are **separate states**. The `isEligibleForKids` pure helper only evaluates existing trusted state and is not a moderation engine. New or uncertain content must not appear in Kids before affirmative platform approval. Ordinary public publishing is intended to be fast **after mandatory automated checks**; no publishing API is implemented yet.

Real game answers must be validated server-side, not shipped to browsers. The current demo does embed an answer on purpose, so it must not be mistaken for a secure game implementation.

## Future operations

- Postgres migrations and separate development/production DBs.
- Authentication, author ownership, admin authorization and MCP OAuth.
- Server-only authoring/publishing/moderation policies, audit logs and API abuse limits.
- Media validation, object storage and safety review.
- Durable queued AI/media tasks when synchronous processing is insufficient.
- Unit/integration/E2E coverage for create → preview → publish → play and role/child-safety enforcement.
