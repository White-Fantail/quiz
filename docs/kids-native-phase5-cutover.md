# QuizDip Kids — Phase 5 native-only cutover checklist

Status (2026-10-12): code prepared on **dev**; production migration, in-device QA and App Store/Play distribution **not yet verified**. Do not mark a production release complete based on a green web/Expo JavaScript build alone.

## New adult/child routes

- Adult guardian onboarding: `/en/account/kids` and `/ko/account/kids`. Guardian uses Better Auth and existing six-digit PIN to create a child profile and issue a five-minute one-time native pairing code. `GET/POST /api/account/kids` requires an adult same-origin session and verifies ownership. A PIN reset requires a fresh sign-in. Adult account home links into the portal.
- Native Kids setup displays the adult portal URL. Once paired, the app uses only scoped `/api/kids/native/**` bearer endpoints; no Better Auth session cookie is placed on the child's device. It supports parental PIN management inside its native guardian area.
- Old web `/kids/**` and locale variants now 307-redirect to `/account/kids`; the old child home, explore, play, rewards, web tablet activation, header link, navigation, CSS and browser-only `/api/kids/device` endpoint are removed. `/api/kids/parent` has moved to the ordinary adult account API.
- The **temporary** PIN-only `/account/kids/legacy-unlock` page is deliberately *not* a web Kids game. If a locked browser retains an HttpOnly `quizdip-kid-session` cookie, proxy keeps it there until its guardian enters the PIN. `POST /api/account/kids/legacy-unlock` resolves the old WEB token hash, checks guardian PIN, revokes it and clears the cookie. Adult Auth/REST still deny cookie-bearing requests. This prevents inadvertently exposing a coexisting Better Auth guardian session.

## Required DB migration

After a verified staging backup and earlier Kids migrations, apply `20261012230000_retire_web_kids_sessions`. It revokes all `KidDeviceSession.clientKind='WEB'` sessions while **preserving token hashes** for PIN-based legacy exit. It does not alter `clientKind='NATIVE'` sessions, child profiles, PINs, safety approvals, language revisions, media, quiz outcomes or the KIDS weekly lane. Preserve legacy rows through the 30-day cookie lifetime plus customer-support grace period; never bulk-delete hashed rows while a locked browser can still need them to exit. Audit schema changes in staging before production.

## Release gates (not yet signed off)

- [ ] Real iPad and Android app distributed in TestFlight/internal track, correct environment HTTPS API and installed with sandboxed device tokens.
- [ ] Real Better Auth guardian sign-in, PIN setup/fresh-session reset, profile ownership, native one-time code issuance/exchange and remote device revocation.
- [ ] Staging migration dry-run and subsequent independent production migration approval; old WEB tokens rejected from play APIs, NATIVE tokens unaffected, old WEB cookie still unlockable with PIN even if revoked.
- [ ] Browser tests: `/en/kids`, `/ko/kids/explore`, `/kids/exit`, previous QR and bookmarks cannot access old web games. Without a legacy cookie they reach adult account setup/sign-in. With cookie they hit the PIN-only gate; without PIN all general HTML and auth APIs stay inaccessible.
- [ ] Fresh nonchild browser: QuizDip account, sign-in, Studio, Discover, Play, Admin, REST and MCP remain functional. Kids eligibility, KIDS weekly lane, media signing and moderator reports remain unchanged.
- [ ] Native E2E: one quiz, random five, weekly, image/audio/video clues, time-budget lock across devices, saved treasures, profile deletion, offline/foreground, expired/revoked tokens and EN/KO approval enforcement.
- [ ] Verify App Store Kids Category and Google Play Families policies, age rating, parent gate design, privacy disclosures, 90-day retention cron and production monitoring.
- [ ] Rollback plan rehearsed, with legacy web session migration **not rolled back destructively**. On runtime failures, pause native pairing/play at edge, revert website release and notify already paired users, without reverting child data or exposing guardian cookies.

## Automation and verification

Run `npm install --no-audit --no-fund`, `npm run test`, `npm run typecheck`, `npm run build`, `npm run kids:bundle:ios` and `npm run kids:bundle:android` in CI. Native export success is **not** a signed app installation and does not demonstrate runtime/DB/OAuth/R2 behavior. GitHub Action test results must be inspected for the exact dev commit. Production deployment, DB migrations and `main` fast-forward are separate actions requiring explicit authorization.
