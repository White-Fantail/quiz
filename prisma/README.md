# Database connections (PostgreSQL / Prisma 7)

QuizDip uses Prisma ORM 7 and Better Auth against the same PostgreSQL database.

## Vercel Marketplace: Prisma Postgres

The Prisma Postgres integration automatically provisions `DATABASE_URL` in Vercel. For this database that URL uses the **direct** `db.prisma.io` host; preserve the managed value instead of editing it. Obtain a separate URL from Prisma Console with **Connection pooling ON** (`pooled.db.prisma.io`), then add it to Vercel as `DATABASE_URL_POOLED`.

- `DATABASE_URL_POOLED` (preferred application traffic): used by the shared runtime pool for Prisma Client, REST/MCP routes and Better Auth. Local development can omit it to fall back to `DATABASE_URL`.
- `DATABASE_URL` (direct migration fallback): managed by Vercel/Prisma; used by Prisma and Better Auth migrations unless `DIRECT_URL` is configured. Keep it unchanged.
- `DIRECT_URL` (optional): direct connection to the *same* database for migrations. Prisma CLI uses `DIRECT_URL || DATABASE_URL` from `prisma.config.ts`.
- Production builds explicitly clear `DATABASE_URL_POOLED` in the **Better Auth migration subprocess** so the shared pool uses `DIRECT_URL || DATABASE_URL` for schema writes; regular app requests continue to use the pooled URL.
- Preview/staging must never share production credentials or migrations. Do not commit credentials or manually change Marketplace-managed URLs.

## Application pooling

`apps/web/src/lib/postgres.ts` owns a single warm-instance `pg.Pool` (max 2, 15-second connection acquisition timeout), shared between Prisma's `PrismaPg` adapter and Better Auth. Vercel scales function instances horizontally: this per-instance limit is a guardrail, **not** a substitute for the provider's managed pooling.

New client connections can occasionally be slow to establish; the runtime
allows 15 seconds instead of the earlier 5 seconds. The pool also catches
idle-client `error` events so a dropped idle connection does not crash the
Node worker. **This does not fix a saturated provider pooler or unavailable DB**:
requests will still error if a connection cannot be established. Idle-client
errors log pool counts and a sanitized error code, not credentials.

## Diagnosing FATAL 53300 / too many connections

1. Confirm Vercel has `DATABASE_URL_POOLED` targeting `pooled.db.prisma.io` and `DATABASE_URL` targeting the direct `db.prisma.io` host (without revealing credentials).
2. Verify application code is reusing a bounded client/pool across requests. This repository shares the pool between Better Auth and Prisma ORM.
3. In Prisma Console, inspect connection counts, concurrency, and plan limits. If the pooler itself reaches its limit, inspect function concurrency and scale capacity as required.
4. If errors refer to role `prisma_migration`, inspect whether migrations or a migration-role connection are consuming available connections. The role name alone does **not** prove the actual host or variable content.
5. For connection timeouts, distinguish a failed new TCP/TLS connection from a slow SQL query. Confirm Prisma provider health and the deployed DATABASE_URL hostname before raising the pool size.\n6. After deploy, check /api/v1/quizzes, /api/v1/packs and /api/mcp for connection errors; do not infer recovery from a green Vercel build alone.

Do not kill database sessions, reset databases, modify integration-managed credentials, or rotate secrets without confirming the affected production environment.
