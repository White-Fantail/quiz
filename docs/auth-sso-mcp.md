# QuizDip Google / Apple SSO + MCP OAuth

## What is implemented

- Web OAuth login: Better Auth with Google and Apple identity providers under `/api/auth/*`.
- Stable QuizDip identity: Better Auth `user.id` is the canonical user ID for signed-in web requests, REST, MCP, quiz ownership, reviews and scores. `actorByIdentity` ensures the existing domain `User` row is provisioned with that ID. Google/Apple credentials are **not** used as domain IDs.
- Explicit account linking: `/account` provides provider connections using `linkSocial` and `listAccounts`. Different addresses (e.g. Apple's private relay) may be linked after authenticating with the existing account. **Never merge users based on email alone.** Never reassign two already separate accounts automatically.
- MCP authorization: Better Auth `mcp()` OAuth 2.1 Authorization Server + `cimd()` Client ID Metadata Documents + `jwt()`. Resource identifier: `{BETTER_AUTH_URL}/api/mcp`. Tokens are scoped and audience-bound; the MCP resource route uses `requireMcpAuth` (signature, issuer, audience, expiry, DPoP when bound, and required `mcp:tools` scope).
- MCP transport: stateless POST with the 2026-07-28 MCP profile. The original 25 authorized tools still call the same shared `execute()` services as REST.
- REST cookie authorization: secure Better Auth session lookup, same-origin check for mutations. REST does not accept unscoped Google tokens or pretend a browser cookie is an MCP token.
- OAuth consent UI: `/consent`; clients need users' consent. Token refresh, client metadata and authorization are Better Auth-managed.

This does not deploy provider secrets, automatically enroll Apple Developer credentials, migrate a live DB, or prove end-to-end ChatGPT connectivity.

## Required environment variables

Configure development and production independently, with stable origins and secrets:

```dotenv
DATABASE_URL=postgresql://...
BETTER_AUTH_URL=https://YOUR_DOMAIN
BETTER_AUTH_SECRET=GENERATE_UNIQUE_RANDOM_48_BYTE_OR_LONGER_SECRET
PUBLIC_ORIGIN=https://YOUR_DOMAIN

GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...

APPLE_CLIENT_ID=...
APPLE_TEAM_ID=...
APPLE_KEY_ID=...
APPLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"
# Instead of TEAM/KEY/PRIVATE_KEY you may set a JWT in APPLE_CLIENT_SECRET,
# but static Apple JWTs expire; the dynamically signed key-based option is recommended.

MCP_ENABLE_DCR=false
```

For Google OAuth, create a **Web application** OAuth client in Google Cloud Console and register **exactly** `https://YOUR_DOMAIN/api/auth/callback/google` as an authorized redirect URI. Configure authorized origins. If the Google consent screen is in Testing, add permitted testing users; publish/verify the configuration where required.

For Apple, use an Apple Developer **Services ID** (client ID), Team ID, Key ID, and private `.p8` key. Register domain and return URL `https://YOUR_DOMAIN/api/auth/callback/apple` in Sign in with Apple settings. Apple requires a valid HTTPS domain for deployed social OAuth. The app can generate a 180-day signed Apple secret from the private key; don't expose it to the browser. Apple may share an anonymized private relay email.

Better Auth sends sign-in sessions with secure HTTP-only cookies when using HTTPS; each environment needs its own cookie domain, OAuth credentials, secret and DB. Never commit secrets.

## Apply the schemas

The domain schema is managed by Prisma. Better Auth's **own** tables (`user`, `session`, `account`, `verification`, `jwks`, OAuth client/consent/token tables) are managed by its supported Postgres/Kysely migration tooling.

With actual database credentials loaded into the environment, execute:

```bash
npm install
npm run db:migrate
npx auth@1.7.7 migrate --config ./apps/web/src/lib/auth.ts --yes
npm run typecheck
npm run test
npm run build
```

Run against **dev** DB first. Review migrations, take backup before prod, and use deployment-stage migration gating. The Better Auth migration is separate from Prisma and should be re-run after changes to auth plugins or provider versions. No external accounts, Google/Apple credentials, or live DB are configured by source changes alone.

## Important flows to verify in deployed dev

1. Google first sign-in creates a Better Auth user. `GET /api/v1/me` returns stable domain user ID and owner-only content.
2. In `/account`, click **이 계정에 연결** for Apple, complete Apple authentication, and return to the same Better Auth user ID. Verify `/api/v1/me` and existing created quizzes are unchanged after either sign-in.
3. With a separate browser session, use ChatGPT's MCP connection flow for `https://YOUR_DOMAIN/api/mcp`. OAuth discovers authorization metadata and CIMD client identity; sign in with Google or Apple, consent, call `quizdip_me`, `quizdip_my_quizzes`, then create a test quiz. It must return the **same QuizDip ID** as web.
4. Invalid access token, wrong `aud`, expired token, missing `mcp:tools`, cross-origin web mutation, other user's draft, and an unrelated Google/Apple account must be rejected.
5. Deny consent and confirm the client has no authorized MCP access. Test refresh and revocation. Verify all 25 MCP tools remain registered, and source-level REST/MCP parity.
6. If an older MCP client cannot use CIMD, consider setting `MCP_ENABLE_DCR=true` **only with front-door rate limiting, monitoring and anti-abuse rules**. CIMD is the recommended default for modern MCP.

## Routing

- Web login: `/sign-in`; connected accounts: `/account`; OAuth consent: `/consent`
- Social callbacks: `/api/auth/callback/google` and `/api/auth/callback/apple`
- Auth server: `/api/auth/oauth2/authorize`, `/api/auth/oauth2/token`, `/api/auth/oauth2/userinfo`
- Server metadata: `/.well-known/oauth-authorization-server`
- MCP protected resource metadata: `/.well-known/oauth-protected-resource` and `/.well-known/oauth-protected-resource/api/mcp`
- MCP: `POST /api/mcp` (Bearer resource-scoped OAuth token only)
- REST: `/api/v1/*` (verified browser session, same-origin writes)

## Known limits and launch gates

- No existing live OAuth provider credentials or production DB has been configured/tested.
- Existing unlinked Google and Apple Better Auth user records remain separate; there is **no automatic data merge** or account recovery tool yet.
- OAuth refresh/revocation, discovery and redirect correctness must be verified against actual ChatGPT once deployed.
- Configure production throttles and abuse protection for public authorization and play endpoints. Register OAuth client origin/redirect policies. Do not expose child profiles on ranking screens or bypass Kids content review.

## Provider availability and /account recovery

- The Google button is enabled only when both `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are present in the **deployed environment**. Google sign-in is supported; disabling an unconfigured button is not a substitute for setting up OAuth.
- The Apple button is **visible but disabled (준비 중)** until an `APPLE_CLIENT_ID` and either a non-expired `APPLE_CLIENT_SECRET` JWT or **all** of `APPLE_TEAM_ID`, `APPLE_KEY_ID`, and `APPLE_PRIVATE_KEY` are configured. It activates automatically after a redeployment with complete credentials; it cannot be enabled from client-side state.
- `/account` now distinguishes **auth service errors** from an actual anonymous session. Service errors render a retry message rather than crashing the page or inaccurately offering a fresh login. Anonymous visitors get the Google/Apple sign-in options directly on the account page.
- `/sign-in` does **not** initialize the Better Auth database merely to discover provider availability. This lets visitors see correct sign-in status even if Better Auth initialization is temporarily unavailable.
- To resolve a production `/account` error, check Vercel function logs (including database errors), verify `DATABASE_URL`, `BETTER_AUTH_SECRET`, the exact `BETTER_AUTH_URL` public origin and Google callback, and ensure **both** Prisma and Better Auth tables/migrations exist in the **correct production DB**. A UI fallback does **not** repair missing migrations or DB connectivity.
- Verify real Google OAuth: anonymous `/account` → Google button → consent → `/api/auth/callback/google` → authenticated `/account` → `GET /api/v1/me`; test Apple disabled with missing or incomplete configuration. Live verification remains required after secrets/migrations are confirmed.

## Automatic migrations during Vercel builds

The root `npm run build` delegates to `scripts/build.mjs`. It runs migrations **only** when Vercel provides both `VERCEL=1` and `VERCEL_ENV=production`:

1. Check `DATABASE_URL`, `BETTER_AUTH_URL` and `BETTER_AUTH_SECRET` are configured. Refuse an explicitly non-`main` production build.
2. Run `npm run db:migrate` (Prisma domain migrations).
3. Run `npx --yes auth@1.7.7 migrate --config ./apps/web/src/lib/auth.ts --yes` (Better Auth user/session/OAuth tables).
4. Generate Prisma Client and build the Next.js app. A failed migration fails the build, so a broken new deployment is not promoted.

Local builds, GitHub CI, and Vercel Preview **skip database migration**; they still generate Prisma Client and run the Next.js build. Preview schemas must be deployed to a separately configured development database using an explicit migration job before testing authenticated features. Never reuse production `DATABASE_URL` for Preview.

**Production caution:** Vercel may run/retry builds, and a migration commits schema changes even when a later build step fails. Avoid concurrent production deployments, take a database backup before substantive changes, and use backward-compatible, additive schema migrations. For high-impact migrations, use an independently approved pre-deployment migration job rather than automatic build-time execution. The guarded build integration does not itself provision a database, verify Google OAuth credentials, or guarantee ChatGPT connectivity.

Build-plan regression tests are in `apps/web/test/build-migration-plan.test.mjs`. Before merging to `main`, verify that the Vercel production build uses the repository-root `npm run build`, has a reachable production `DATABASE_URL`, and can run the Better Auth CLI. After deploy, check the OAuth metadata endpoint and sign-in/MCP flows.
