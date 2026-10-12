# Database connections (PostgreSQL / Prisma 7)

QuizDip uses Prisma ORM 7 and Better Auth against the same PostgreSQL database.

## Vercel production configuration

- `DATABASE_URL`: **pooled runtime endpoint** (Prisma Postgres: `pooled.db.prisma.io`). Used by Prisma Client, REST/MCP endpoints and Better Auth.
- `DIRECT_URL`: **direct endpoint** (Prisma Postgres: `db.prisma.io`). Used by `prisma migrate deploy` through `prisma.config.ts`, and by the Better Auth migration step in `scripts/build.mjs`.
- Configure both variables for production in Vercel; never put a direct/migration URL into `DATABASE_URL`. Keep secrets out of git and logs.
- For production, obtain the two matching URLs from Prisma Console > your database > Connect. Both should target the **same production database**.
- Preview/staging must never share production credentials or migrations.

## Pooling

`apps/web/src/lib/postgres.ts` owns a single warm-instance `pg.Pool` (max 2, 5-second connection acquisition timeout), shared between Prisma's `PrismaPg` adapter and Better Auth. Vercel scales function instances horizontally: this per-instance limit is a guardrail, **not** a substitute for the provider's pooled endpoint.

## Diagnosing FATAL 53300 / too many connections

1. Inspect Vercel production `DATABASE_URL` safely: check **hostname only**, never publish credentials. Confirm the hostname is the pooled endpoint.
2. Verify `DIRECT_URL` is configured separately for production migrations and targets the same DB.
3. In Prisma Console, inspect pooled/direct connection usage and limits; if traffic still exceeds pooled capacity, reduce instance concurrency or increase pool capacity in the plan.
4. After correcting an environment variable, redeploy production and confirm that /api/v1/quizzes, /api/v1/packs and /api/mcp no longer log `53300`.
5. If the database username is `prisma_migration` in runtime errors, examine the runtime URL: a migration-specific role/direct hostname must not handle application traffic.

Do not kill database sessions, reset databases, or rotate credentials without confirming the affected production environment.
