# Clupio AI development instructions

## Product and branding
Clupio is a friendly quiz playground centered on progressive clues and the joy of discovery. External name: **Clupio (클루피오)**; repository name: `quiz`. Follow [docs/brand.md](docs/brand.md).

## Architecture
- Implement a **single Next.js modular monolith** on Vercel: public Play/Discover, creator Studio, restricted Admin, REST API and Remote MCP share one deployment.
- Web page, Server Action, REST route and MCP tool adapters must call the **same service/policy layer**. Do not duplicate publishing/safety rules or call internal HTTP endpoints unnecessarily from server code.
- Use `apps/web/app/(platform)` for public UI, `(creator)` for Studio, `admin` for admin pages, `api/v1` for REST and `api/mcp` for remote MCP.
- Business modules live in `apps/web/src/modules`; pure cross-cutting types/helpers in `packages/domain`; Prisma/PostgreSQL schema in `prisma`.
- Admin pages **and admin APIs** must independently enforce server-side ADMIN authorization. Keep admin inaccessible until real authentication exists.
- Real answers and privileged logic must stay server-side; the existing browser sample is a deliberate non-production demo.
- API/MCP and web/MCP SSO are implemented in source. Do not assume deployed or functional until Google/Apple credentials, Better Auth + Prisma migrations, database, build and end-to-end OAuth/E2E are verified. Full AI classification, Kids review automation, and admin console are not yet delivered. Cloudflare R2 upload/media code is not live until credentials and real bucket E2E have been verified.

## Web, social identity, and MCP OAuth (mandatory)
- Use Better Auth's *stable user.id* as the identity for both web browser sessions and MCP OAuth tokens. Do not derive account IDs separately from provider emails or Google/Apple tokens.
- All new auth providers must be wired into `apps/web/src/lib/auth.ts`, sign-in and account-linking UX, and `docs/auth-sso-mcp.md`; they must preserve the same Clupio account, ownership, reviews and scores.
- Never automatically merge accounts by email. Different Google/Apple identities may be linked **explicitly from an already authenticated account**. Never silently transfer content between two existing Better Auth users.
- MCP requires a resource-bound OAuth 2.1 token for `/api/mcp` validated by `requireMcpAuth`. The web uses Better Auth session cookies. No raw Google/Apple tokens, shared master API keys, or mock identities.
- Keep `/consent`, OAuth discovery and the auth provider migrations tested whenever changing MCP scopes or tool permissions. Every new operation must maintain the REST/MCP feature-parity requirement below.
- Deploy auth tables via Better Auth's migration tooling *and* domain tables via Prisma. Do not connect preview OAuth sessions or DB to production.

## REQUIRED: media parity, ownership and moderation
- All media, whether added by Studio, REST, MCP or AI, must be stored in **private Cloudflare R2** as a first-class `MediaAsset` with an immutable ID; clues and prompts reference `mediaId`/`promptMediaIds`, not arbitrary uncontrolled file URLs.
- Provide both presigned binary uploads and a client-compatible MCP **chunked base64** fallback. Uploaded bytes must be verified server-side for size, SHA-256 and MIME signature before becoming READY. Never treat a staged/expired upload as a validated file.
- On any new media feature or format, update together: Prisma + migration, validated contracts, owner/policy services, REST route, MCP tool, `docs/media-r2.md` and parity tests. Media derivatives must create new assets; never overwrite an existing READY object.
- Never expose pending/restricted media to public players. Public playback requires approved asset and revealed-clue/session authorization; Kids requires separate quiz approval. An admin-reviewed asset must not silently become APPROVED after metadata edits or transformations.
- Only allowlisted HTTPS import hosts; defend against SSRF / DNS rebinding / unbounded streaming; preserve attribution/rights metadata. Configure R2 as private, use short-lived signed URLs and expire transient uploads.
- Media upload ticket/URL alone is not proof of success. Test against a real dev Cloudflare bucket, including hash mismatch, unsupported types, expired tickets, unapproved uploads, cross-account access and progressive reveals, before declaring deployed functionality.

## REQUIRED: Weekly flagship & practice modes
- The **main Play experience** is a featured author's **globally identical five-question weekly edition**; fixed order, immutable question/revision IDs, UTC Monday week boundary. Random five and infinite play are practice modes. Keep the editorial weekly spotlight prominent in the homepage, `/play`, Studio and MCP.
- A real signed-in creator proposes five **personally authored** published quizzes. ADMIN alone selects/schedules an edition and verifies celebrity/identity claims. Never invent or automatically declare a creator's celebrity status. Multiple proposals can exist; only one scheduled edition per UTC week/lane.
- GENERAL and KIDS have **independent** editions, pool eligibility, and UI. Kids must pass affirmative platform safety; no public child rankings. Official General weekly scores are once per signed-in user/edition; public rankings require BOTH independently trusted adult verification and the player opting in. Featured authors cannot rank in their own edition.
- Never substitute unapproved questions or change order in the middle of the live weekly challenge. A pin is (quiz ID, revision ID). If a challenge question is restricted, suspend access rather than replace it. Same client-rejected guesses and server-scored clues across every mode.
- Changes to weekly schedule, submissions, host identity, admin moderation, run lifecycle, rankings and UI must update **both REST and MCP, shared services, Prisma/migration and tests** together; see `docs/play-modes.md`.
- Preserve exact first-attempt uniqueness, atomic run scoring, replay safety, session token expiry and protection against guessing unrevealed clues. Do not trust browser-side result calculations. Never claim a week is populated before an editor actually schedules an eligible proposal.

## Product and safety
1. Keep creator target intent, AI recommendations/difficulty and platform-controlled safety **independent**.
2. Creators cannot set or override platform safety.
3. Ordinary publishing should be low friction with automatic anti-abuse/safety checks; Kids eligibility requires affirmative platform approval.
4. Preserve multimodal clues and variable game rules; never force the same clue count/scoring onto every mode.
5. Collect minimal children's data. Be accurate and neutral on politics/history.
6. Never claim planned or untested functionality exists.


## REQUIRED: API + MCP feature parity for every future change
MCP is a full Clupio product interface, **not just an authoring connector**. Every new capability available through REST, Studio, Play, Discover, user profiles, community, analytics, moderation-status or rankings **MUST also have an appropriately authorized MCP tool**.
- When adding or modifying a feature, update **together**: Prisma schema and migration (when needed), shared service operation, input validation in `apps/web/src/modules/platform/contracts.ts`, REST route mapping, MCP tool exposed by `apps/web/app/api/mcp/route.ts`, `docs/api-mcp.md`, plus relevant unit/integration/parity tests.
- Both interfaces MUST call `execute()` in `apps/web/src/modules/platform/operations.ts` with the same server-enforced access control and business rules. Do not write an MCP-only database implementation or bypass safety, publication, creator ownership, version checks, ranking privacy or spam limits.
- **MCP tool coverage is a release requirement**, not optional follow-up work. If a dangerous/privileged action is deliberately omitted, document precisely why and expose its safe read-only alternative where possible.
- Every agent's change report must state affected REST paths, matching MCP tool names, tests run, and any deliberate parity exceptions. Do not mark a feature done when it lacks its MCP counterpart.
- Never return answer keys/unrevealed clues to public clients. Adults-only public ranking requires separately verified eligibility; Kids exposure requires an affirmative platform safety decision, independent from a creator's age intent.
- Treat publication, bulk edits, sensitive changes and deletions as high-impact and require explicit user authorization/confirmation. Do not let client-supplied safety status or user role override platform policy.
- Keep in mind that exposing a tool is not proof it works: verify production-authenticated MCP invocations and REST parity, not only tools/list.

## Git and validation
1. Work on `dev` by default; do not merge into `main` unless explicitly asked.
2. Integrate changes **fast-forward-only**; no merge commits, squash merges or force pushes.
3. Implement in small steps with tests, typechecking, builds, authorization checks and regression coverage.
4. Keep separate dev/prod secrets and persistence once introduced.

## Moderator play safety release requirement
- The Kids manual review console is /admin/quiz-review. Its read operations quiz_review_get and media_review_get deliberately return sensitive answers and signed unapproved media **only** to authenticated ADMIN; all other public tool routes must keep staged answers and media secret.
- A Kids approval requires all media preapproved, currentVersion optimistic concurrency and auditable reason; creators cannot approve themselves or override RESTRICTED.
