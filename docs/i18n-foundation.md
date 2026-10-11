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
