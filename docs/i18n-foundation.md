# QuizDip multilingual foundation — Phase 1

Status: implementation foundation; not a completed multilingual content rollout.

## Current behavior
- Supported user locales: en and ko (BCP-47 tags); default en for unknown browsers.
- Public web pages use /en/... and /ko/... with rewrites to existing App Router pages. The original unprefixed paths redirect to the language chosen by cookie or Accept-Language.
- /api, /_next and /.well-known are never rewritten; auth, REST and MCP endpoints retain their external contracts.
- The root layout sets html lang, localized navigation, metadata, and a locale selector. Home and Studio entry copy uses the shared typed message table.
- A guest stores the locale in a SameSite=Lax cookie. Signed-in accounts may update both uiLocale and contentLocale with authenticated REST/MCP, and changes never trust a client-supplied account ID.
- The UI locale can differ internally from content locale in the data schema, but the Phase 1 UI sets both together.

## Data migration
Apply `npm run db:migrate` in a correctly configured staging database before serving code that calls the new locale preferences API.
- New QuizLocalization, QuizPackLocalization and TopicLocalization tables.
- QuizRevision optionally refers to QuizLocalization; previous quiz/version uniqueness, session revision pointers and game contracts remain unchanged.
- Existing quizzes, packs and topics are backfilled to `und` (undetermined) and no guesses about language are made. This protects Korean legacy content from false English labels.
- Phase 2 must classify and verify legacy locales, migrate uniqueness to per-localization versions, and activate server-side strict locale filtering. Do NOT start filtering on Phase 1 `und` records.
- Phase 3 will introduce locale-specific creation/editing, translation/version updates and publication gates.

## Route/security notes
- Avoid locale prefix in OAuth callback URLs, REST or MCP. Keep authorization in handlers, not Next.js proxy.
- Navigate with localizeHref on locale-aware links; unprefixed links remain backward compatible via redirects.
- Locale is a presentation preference, **not** an access-control decision.
- UI key fallback to English is acceptable, but content fallback will be forbidden once Phase 2 strict catalog filtering is implemented.
- Live production E2E and database migration are not implied by code commits.

## Validation
- Unit tests for locale path, Accept-Language negotiation, strict message key pairs, REST/MCP parity and schema/migration presence.
- Run typecheck, tests, build and verify /en, /ko, /discover redirect, signed-in locale REST and MCP; verify /api/v1/catalog and auth callbacks do not redirect.

## Phase 2: strict language eligibility (implemented in source)
- `GET /api/v1/quizzes?locale=en|ko`, `/topics`, `/packs` filter the PostgreSQL query by matching published language version BEFORE offset/take. No `und` or foreign-language fallback. Public quiz detail and single play start require a published `QuizLocalization` with a current matching `QuizRevision`.
- `POST /api/v1/runs` picks five/infinite questions with a published matching localization, and saves `PlayRun.locale`. New rounds and `PlaySession.locale` pin the same language. `run_current.locale` rejects attempts to change language mid-run.
- Weekly publication freezes a five-question snapshot per *complete* supported language. A weekly edition is unavailable in languages without five snapshots. Only the first entered locale can be used for a given user's official weekly attempt, and standings accept `locale` for language-specific comparison.
- Packs are visible in a language only when the pack has a published localization and **all** contained questions have published versions in that language.
- Topics are only displayed and searched in explicitly localized names; missing translations are not surfaced from another language. Creation and author-confirmation populate the original topic language.
- New `quiz_create` and `pack_create` allow `locale:en|ko`. For older callers omitting locale, an honest `und` is retained; publication does **not** automatically expose unknown-language content in English.
- Legacy migration remains intentionally `und` until the author explicitly verifies the original language using `POST /api/v1/quizzes/:id/language` or `POST /api/v1/packs/:id/language` (both require `confirm:true`, ownership, and audit). Studio quiz detail also offers original-language confirmation for unlabeled quizzes. Neither action translates the text.
- Legacy active session tokens can finish their originally pinned `und` revision, preserving existing games, but newly started public games never select `und`.
- Phase 3 is the multi-version translation editor, mixed-language translation review, full localized Studio creation workflow, and future removal of `@@unique([quizId,version])` to allow independent language version numbering. Phase 4 covers locale-specific ratings and expanded weekly metadata.

### Rollout checklist
1. Apply BOTH phase-1 and phase-2 migrations to the dev database before deploying server code; take a backup, verify `QuizRevision` reference counts.
2. Ensure real en/ko quizzes exist by creating with explicit locale or manually confirming verified original `und` items. Never bulk-tag unknown data by guess.
3. Verify /en/discover and /ko/discover return disjoint language-eligible listings, even with page=2 and filters. Attempt an ID from the wrong language with /play and expect `locale_unavailable`.
4. Verify /runs RANDOM_FIVE and INFINITE freeze `locale`, prevent cross-locale clues after locale switch, respect revision/safety restrictions, and never repeat fallback material.
5. Verify the same weekly set is pinned before play, missing language edition returns unavailable, and standings filter language without exposing unverified user identities.
6. Test pack language partial coverage; only all-published complete packs appear. Verify GET /api/v1/catalog, MCP OAuth and auth callbacks retain their unprefixed URLs.
7. Production E2E is not claimed by source implementation; dedicated DB-backed tests and localized media review are required before production enablement.
