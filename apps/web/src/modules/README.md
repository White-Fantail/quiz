# Business modules

This is a **modular monolith**, not independent services. Every entry point (page, Server Action, REST route and MCP tool) should call shared application services; services will call Prisma-backed repositories once persistence is implemented.

- `quiz/`: question, answer, clue, packs, publishing and versioning. Currently contains only demo content and a read-only list service.
- `game/`: sessions, progressive clues, server-side answer validation and scoring (planned).
- `user/`: sessions, creator identity, access policy (planned).
- `moderation/`: safety classifications, reports, appeal handling and Kids gating (planned).
- `media/`: validated storage and metadata (planned).
- `analytics/`: play events, aggregates and content insights (planned).
- `ai/`: generation, classification and evaluations (planned).

Shared pure types and helpers live in `packages/domain`. Never mix privileged server credentials, real answers or safety decisions into browser-imported client modules.
