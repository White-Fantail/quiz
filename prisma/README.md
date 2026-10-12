# Database connections (PostgreSQL / Prisma 7)

QuizDip uses Prisma ORM 7 and Better Auth against the same PostgreSQL database.

## Vercel Marketplace: Prisma Postgres

The Prisma Postgres integration automatically sets `DATABASE_URL` in Vercel. **Do not replace or duplicate this managed variable merely because `DIRECT_URL` is absent.** According to Prisma's Vercel integration guide, the managed `DATABASE_URL` uses Prisma Postgres's built-in connection pooling.

- `DATABASE_URL` (required): provided by the Prisma/Vercel integration; used for application traffic by Prisma Client, REST/MCP endpoints and Better Auth.
- `DIRECT_URL` (optional, for migration tooling): when available, point this to the *same* database's direct endpoint (`db.prisma.io`). Prisma CLI selects `DIRECT_URL || DATABASE_URL` in `prisma.config.ts`. The Better Auth build migration likewise uses `DIRECT_URL` if set, otherwise the existing `DATABASE_URL`.
- A separate direct URL is recommended for migration/session-continuity concerns, but **its absence does not mean the Marketplace integration is broken**. If migration commands encounter transaction-pooler errors, configure a direct URL from the same Prisma Postgres database in the Prisma Console; don't guess one or modify managed URLs.
- Preview/staging must never share production credentials or migrations.

## Application pooling

`apps/web/src/lib/postgres.ts` owns a single warm-instance `pg.Pool` (max 2, 15-second connection acquisition timeout), shared between Prisma's `PrismaPg` adapter and Better Auth. Vercel scales function instances horizontally: this per-instance limit is a guardrail, **not** a substitute for the provider's managed pooling.

New client connections can occasionally be slow to establish; the runtime
allows 15 seconds instead of the earlier 5 seconds. The pool also catches
idle-client `error` events so a dropped idle connection does not crash the
Node worker. **This does not fix a saturated provider pooler or unavailable DB**:
requests will still error if a connection cannot be established. Idle-client
errors log pool counts and a sanitized error code, not credentials.

## Diagnosing FATAL 53300 / too many connections

1. Confirm which *hostname* Vercel's managed production `DATABASE_URL` is using (without exposing URL credentials). Prisma Postgres's conventional pooled hostname is `pooled.db.prisma.io` and direct hostname is `db.prisma.io`.
2. Verify application code is reusing a bounded client/pool across requests. This repository shares the pool between Better Auth and Prisma ORM.
3. In Prisma Console, inspect connection counts, concurrency, and plan limits. If the pooler itself reaches its limit, inspect function concurrency and scale capacity as required.
4. If errors refer to role `prisma_migration`, inspect whether migrations or a migration-role connection are consuming available connections. The role name alone does **not** prove the actual host or variable content.
5. For connection timeouts, distinguish a failed new TCP/TLS connection from a slow SQL query. Confirm Prisma provider health and the deployed DATABASE_URL hostname before raising the pool size.\n6. After deploy, check /api/v1/quizzes, /api/v1/packs and /api/mcp for connection errors; do not infer recovery from a green Vercel build alone.

Do not kill database sessions, reset databases, modify integration-managed credentials, or rotate secrets without confirming the affected production environment.
