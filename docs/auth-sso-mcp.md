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
