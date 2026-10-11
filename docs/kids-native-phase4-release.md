# QuizDip Kids — Phase 4 release and privacy runbook

Status (2026-10-12): **source implemented on `dev`; not deployed, built or certified on real devices.** No store submission / Kids-category compliance sign-off has occurred. The live web Kids experience remains in place until a separate Phase 5 cutover.

## Architecture and authorization

- Dedicated Expo app `apps/kids`. Child is paired once using a high-entropy one-time code issued by a guardian who authenticated to QuizDip web with Better Auth and verified their six-digit PIN. First pairing still requires that temporary web guardian-bootstrap page; full web Kids removal must first relocate onboarding into adult account settings **or** implement independently audited system-browser guardian OAuth/PKCE. Never remove `/kids/parent` while it's the only path to pairing first devices.
- `KidParentAccess` grants 10 minutes of **server-scoped guardian settings** to a verified native child device plus parent PIN. Native stores guardian elevation **only in React memory** (not SecureStore). When backgrounded, it is erased, and a new PIN is required. It never becomes an adult Better Auth cookie or grants Studio/Admin/MCP operations.
- Parent screen supports adding/editing/deleting a child profile, PIN changes, native pairing, device revocation, child-only progress deletion, 7-day private plays/accuracy/topics/usage summary, EN/KO language, age band, family time zone, daily minutes, continuous-play cap and soft break reminder. PIN reset after forgetting it still requires fresh authenticated guardian web login. **Changing age or locale revokes child devices; changing limits takes effect server-side without re-pairing.**
- Child bearer can only call the strict Kids catalog, game, usage and private reward APIs. Separate parent elevation is required for profile / device management. Child profile IDs are always derived from verified server sessions, not accepted from child request bodies.

## Authoritative usage semantics

- `KidProfile.dailyMinutes` = 0 (unlimited), 15, 30, 45, 60, 90 or 120 minutes; `playSessionMinutes` = 0, 10, 15, 20, 30, 45 or 60; `breakEveryMinutes` = 0, 15, 20 or 30 (soft in-game reminder, **not** a hard cap).
- `KidProfile.sessionMinutes` remains legacy web-cookie session-expiry metadata. It is **not** a daily-play limit.
- Apps call `POST /api/kids/native/time` with only `{action:"heartbeat"}` when active, immediately and every 45 seconds. The server uses **its own clock**, records a UTC minute once per child profile with unique `(profileId,utcMinute)`, derives `localDay` with the guardian's configured IANA time zone, and counts time across native devices. No client-reported durations, date or timezone is accepted.
- Limit enforcement is backed by serializable Prisma transactions with conflict retries and checked on **catalog, private treasures, all quiz/game actions and media**. The client shows a fail-closed break/offline screen without a confirmed recent server pulse. A continuous-play cap requires ten minutes away; inactive sessions restart after three minutes idle. The app permits entry to the PIN-protected parent zone even when child play is blocked.
- Precision: one server minute slot per child, not second-accurate screen-time metering. Overlapping devices count the same minute once. For OS-wide restrictions, parents should additionally use Apple Guided Access/Screen Time or Android's corresponding parental controls; this app cannot prevent switching to other apps.
- Content and signed media remain subject to Kids-specific approval and pinned locale/revision each request. Revoking media prevents subsequent refreshes; already issued 60-second media links are not automatically revoked, so review incident response must account for short residual validity.

## Retention and privacy

- Data stored: guardian-owned profile nickname, age band, language, settings, opaque device token hashes, PIN salted verifier, private quiz play and clue results, private daily minute slots, time-limited guardian authentication hashes and one-time pairing hashes. No public child leaderboard, chats, exact GPS, camera capture, microphone recording or advertising SDK is intentionally integrated.
- Child API error logging should not serialize request bodies, PINs, child prompts or bearer tokens. Server debug logs and any external observability SDK must be audited before launch.
- The guardian can delete a child profile and its linked runs, sessions, badges and time slots; can also delete just the child's private history while retaining the profile. Removing history deliberately resets that child's daily usage history and requires PIN-elevated parent access. Any database backup retention and delete-request handling must be covered in the published privacy policy.
- `GET /api/internal/kids-retention` requires `Authorization: Bearer ${CRON_SECRET}`, at least 32-character secret. It removes child usage minute slots older than **90 days**, plus expired one-time pairing and guardian access rows older than one day. **A scheduler must be configured** (recommended once daily via the Vercel project or a protected job runner); this source code does not by itself schedule it. Audit its success daily and alert on failures. Do not publish the cron secret.
- Publish and verify a public privacy policy describing guardian consent, use purposes, child data, time-ledger/backup retention, removal requests, subprocessors (Expo, Vercel, Prisma host, R2 as actually deployed), region and contact. Avoid claiming COPPA/GDPR/NZ Privacy Act compliance before legal review.

## Migrations and commands

Required in order:
1. `20261012150000_kids_guardian_sessions` (web baseline).
2. `20261012190000_kids_native_pairing` (native token pairing).
3. `20261012200000_kids_native_play` (child-only run ownership).
4. `20261012210000_kids_native_parent_time` (guardian privilege and time budgets).

Only after a verified staging DB backup, then production backup and separately approved rollout:

```sh
npm install --no-audit --no-fund
npm run db:generate
npm run db:migrate
npm run test
npm run typecheck
npm run build
npm run kids:bundle:ios
npm run kids:bundle:android
```

The existing CI config executes tests, web build and both native JS exports. Expo exports **are not signed iOS/Android installations**. For device builds, connect your own EAS project and Apple/Google developer credentials, set per-environment `EXPO_PUBLIC_QUIZDIP_API_URL` to the HTTPS staging or production origin, then run EAS preview builds for iPad TestFlight and Android internal testing. Do not place any PINs, credentials, DB URLs or parent session tokens in EAS public variables.

## Required acceptance matrix (NOT YET COMPLETED)

- [ ] Postgres migration dry-run/rollback in staging; correct row counts and existing guardian data preserved
- [ ] Parent first-time Google/Apple login and PIN/profiles; original web Kids remains functional until Phase 5
- [ ] Child device pair, app force-quit/restart, foreground resume, single vs five vs weekly, private badges, image/audio/video and signed R2 expiry
- [ ] Wrong parent PIN (five attempts/lockout), correct PIN, ten-minute elevation expiry, device revoke during parent view, age/locale change revocation, PIN reset and duplicate pairing
- [ ] Second child / second family attempts to read/change another child's profile, run, media, settings, device and history must all return denied
- [ ] Offline startup/foreground/play, mobile system clock manipulation, app background, retry after re-connect and no general/web/MCP bearer escalation
- [ ] 15-minute daily cap across two devices, parallel heartbeat concurrency, minute-edge transition, Pacific/Auckland midnight and daylight-saving transitions, 10-minute break after session cap
- [ ] Changed limits while child plays, time-up also protecting catalog and treasure shelf, parent gate still usable, activity stats matching ledger
- [ ] In-app explicit profile/history delete with remote caches/backup retention procedures; scheduled 90-day pruning and failure alert
- [ ] Crash handling/observability with no PIN, answer keys, child identifiers or tokens logged; privacy data flow/SDK audit
- [ ] App Store Connect Kids category age rating/parent gates/consent, no child tracking/ad SDK, privacy nutrition labels and human-reviewed user-generated quiz exposure
- [ ] Google Play Families target audience/data safety/IARC, SDK permissions and AAID disclosure checks, accurate privacy policy URL
- [ ] iPadOS portrait/landscape accessibility, VoiceOver/Dynamic Type/reduce motion, Android TalkBack/font scaling, device sleep/power-loss and low bandwidth
- [ ] Content-moderation revoke propagation, approved translations/media updates, insufficient Kids question pool in EN and KO, server incidents and rollback rehearsal
- [ ] A signed iPad TestFlight build and Android internal-test APK/AAB installed and exercised against staging

## Cutover / Phase 5 prerequisites

- Web Kids frontend and its web-cookie child lock remain untouched until this full matrix passes and all first-time parent pairing works without the deleted web Kids frontend. Do **not** delete child APIs, moderation, language policies, profile tables, media approval or `KIDS` weekly lane.
- Phase 5 must replace bootstrap URL `/kids/parent` in `apps/kids/app/setup.tsx` with an audited adult-account portal or verified native parent OAuth flow, then remove old Kids routes, cookie/proxy guards, old styles and tests without changing app sessions.
- Rollback approach: revert native distribution to previous approved build, temporarily disable native pairing and child play endpoint at edge if necessary, retain DB schema/ledger rows (do not destructively roll back production migrations), and keep ordinary web QuizDip live.

Policy references (verify again at submission):
- https://developer.apple.com/kids/
- https://support.google.com/googleplay/android-developer/answer/9893335?hl=en
- https://support.google.com/googleplay/android-developer/answer/11043825?hl=en
