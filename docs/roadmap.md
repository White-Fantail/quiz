# Implementation roadmap

- **Phase 0 — Foundation (done):** single Next.js modular-monolith scaffold, grouped public/creator routes, locked Admin entry, reserved/disabled MCP route, shared domain, demo quiz, sanitized demo API, CI tests.
- **Phase 1 — Platform core:** Prisma/PostgreSQL schema and migrations, dev/prod databases, authentication and roles, shared services and repository pattern, real quiz/answer/clue/pack content API.
- **Phase 2 — Play:** controlled server-side answer validation, progressive text/image clues, per-game score rules, packs, session records.
- **Phase 3 — Open creation:** creator Studio, draft/review/publication, AI audience/category/difficulty suggestions, safety gates, moderation/reporting, backoffice with admin-role authorization.
- **Phase 4 — ChatGPT:** real Remote MCP via `/api/mcp`, OAuth and creator permissions, shared services, preview/publish confirmation and audit trail.
- **Phase 5 — Kids + multimodal:** automated safety classifiers, Kids eligibility, image reveal, audio/video/map clues and adaptive discovery.
- **Phase 6 — Community:** quality metrics, creator profiles, recommendation improvements and new quiz modes.

**Next vertical slice:** implement PostgreSQL/Prisma, authentication and one draft → preview → publish → play workflow using common services. Keep `/admin` blocked and `/api/mcp` disabled until their respective authorization work is complete.
