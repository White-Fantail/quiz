# Architecture — initial baseline

## Components
- `apps/web`: **Next.js App Router**; Play, Discover, Studio and a Kids information page. A local demo quiz runs in the browser.
- `apps/web/app/api`: backend/API entry point. `/api/health` reports service health and `/api/v1/quizzes` exposes **demo metadata only** (no answer leakage).
- `packages/domain`: reusable TypeScript models and pure helpers for questions, multimodal clues, answer checks, scoring and Kids visibility.
- `apps/mcp`: a placeholder for a **future** Remote MCP server which will reuse the same authenticated API and business rules.

## Domain and boundaries
A question holds a canonical answer/aliases, ordered clues, game mode, audience intent, recommended audience and platform-managed safety. Clues can be text, image, audio, video or map. Game rules are configurable by game mode rather than forced globally.

Publication is independent from Kids visibility:
- Ordinary publication is intended to be immediate following required automated safety and abuse checks.
- Platform safety is not editable by creators. A pending, unassessed or restricted quiz is **not eligible for Kids**, even when published.
- Audience suitability, difficulty and platform safety are independent judgments.

The `isEligibleForKids` helper is a **defense-in-depth predicate, not a moderation service**. A future server-side policy boundary must validate all writes, authentication and exposure. No public publishing endpoint exists yet.

## Deferred infrastructure
- Persistence and schema migrations (PostgreSQL/ORM to be decided).
- Auth, creator authorization, OAuth for Remote MCP, rate limiting and abuse protection.
- AI generation/classification and safety pipeline with retriggering on edits.
- Media upload, moderation, CDN and storage.
- Real quiz catalogs, packs, versioning, telemetry, play stats and translations.

## Development principle
Favor a small working vertical slice before growing the architecture. Use a single backend for Studio and MCP. Avoid revealing canonical answers in real playable API responses.
