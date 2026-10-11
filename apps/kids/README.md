# QuizDip Kids (Expo, Phases 1–5)

Dedicated iPad/iPhone/Android experience for QuizDip Kids. **Native guardian-linked device scope is implemented in source but not yet production-verified.** The old web Kids game UI has been removed in Phase 5 source on dev; real-device and production validation remain outstanding.

## Start

Use Node.js 22.13+ and npm from the repository root:

```sh
npm install
cp apps/kids/.env.example apps/kids/.env
# Edit EXPO_PUBLIC_QUIZDIP_API_URL to the existing QuizDip dev/staging HTTPS origin
npm run kids:dev
```

Start an iOS Simulator, Android emulator, or Expo Go on a device from the Expo CLI. A parent signs in using the **external system browser** to QuizDip's existing Better Auth Google/Apple web login. In `/en/account/kids` or `/ko/account/kids`, the parent creates a profile and a six-digit PIN, chooses the profile, enters the PIN, and generates a high-entropy one-time pairing code. The code expires in five minutes. The Kids native app accepts that code and a device name, obtains a **child-only credential**, stores it in OS SecureStore, and validates it on startup and foreground before opening Kids screens. The parent may revoke the device in the same web parent panel. The app's Parent Gate needs the same guardian PIN to revoke the local device session and return to setup.

This **browser-assisted onboarding is intentional**: the child never receives an adult Better Auth cookie, Google/Apple OAuth token, or MCP privilege. Full native guardian profile management is planned for Phase 4, at which point the legacy web Kids interface will be removed in Phase 5. Phase 3 native game/clues/treasures and Phase 4 daily play limits, private activity insights and the PIN-protected in-app parent zone are implemented in source. Actual database migrations, real-device QA, an approved privacy policy and store distribution remain pending.

**Until the Prisma migration is applied** (`20261012190000_kids_native_pairing`) native pairing will fail. Use separate dev/prod DBs; do not assume migrations ran just because code is committed.

## Validation

```sh
npm run kids:typecheck
npm run kids:bundle:ios
npm run kids:bundle:android
npm run test
npm run typecheck
npm run build
```

Run both native bundles from a machine with network-installed dependencies. For EAS internal distribution see `eas.json`; link your own Expo/EAS project before submitting. Real device and OAuth tests cannot be satisfied by TypeScript or JavaScript bundle export alone.

## Security scope

`EXPO_PUBLIC_*` values are public; put only the backend origin there. No API secrets, private media credentials, child access token or admin abilities belong in Expo configuration. Kids catalog uses server filtering, checks `kidsEligible === true` again defensively, and never includes the answer. An unconfigured or unreachable API shows a locked setup/unavailable state. The guardian's profile locale is authoritative after pairing; the app cannot override it. A guardian PIN change/recovery revokes active native sessions; an existing browser-only token is not valid natively. Do not infer Kids safety from the creator's intended age.

Plan: [native migration](../../docs/kids-native-development-plan.md).

## Native trust boundaries and tests

- `/api/account/kids` action `native_pair_issue`: only a signed-in web guardian with same-origin request and correct 6-digit PIN may issue a code for their own profile. This action deliberately has no MCP equivalent (unsafe capability distribution); the normal safety and profile data model remains shared.
- `/api/kids/native` POST `pair`: exchanges a one-time code and creates a `clientKind=NATIVE` token (hash in DB; plaintext returned once).
- `/api/kids/native?view=session` and `?view=catalog`: require only the child bearer token. Catalog uses the server `quiz_list` operation with **forced** Kids flag and profile locale. Bearer never authenticates an adult or author.
- `/api/kids/native` POST `unlock`: requires child bearer **and** 6-digit guardian PIN, then revokes it. Five failed PIN attempts invoke the existing DB-based lockout.
- Never expose the bearer in navigation/URLs/logs. Device tokens expire after 30 days independently of the legacy `sessionMinutes` value; daily device usage accounting is Phase 4.
- Reinstall behavior of OS secure storage differs by OS; always allow the guardian to remotely revoke a device. Production rollout requires reinstall/backup/restore tests, E2E with real Better Auth + Postgres and a real iPad/Android.

## Phase 3 gameplay

Open **Explore** and tap an approved question to play one question, or open **Challenge** to start five random questions or a separate weekly Kids challenge. The child never sees a public leaderboard. Answer checking and clue reveal happen on the server, not in the native bundle. Young age bands receive 2–4 large answer choices when the approved bank has enough good decoys; older children use a text answer. Photos, audio and videos are signed and may need refreshing after one minute. Map clues currently show coordinates, **not yet a rich geographic map**. If there are fewer than five unseen approved questions, use a single Discover question instead; do not substitute adult/general content.

Reopening the app can resume an active game token from SecureStore. The backend binds it to the same child's profile and device, and ordinary general endpoints reject child-owned play sessions even if a play token is copied. Rewards are private and derived only from child sessions. Deleting a child profile through the authenticated parent UI deletes its saved gameplay in the same transaction.

Apply `20261012200000_kids_native_play` **after** `20261012190000_kids_native_pairing`. Release tests must include public API token leakage attempts, cross-device/session IDs, profile deletion, safer translation revision changes during play, revoked media between clues, signed URL expiry, too few questions, concurrent answers, restart, offline mode and iPad/Android playback on real R2 media. A source commit or Expo export does not prove production readiness.

## Phase 4 guardian settings and child time protection

Open **Parents** on the native home or the time-up screen. The verified PIN grants a ten-minute management capability stored **only in app memory**, removed on background. Parents can add/edit/delete up to 8 child profiles, update age/EN–KO language, timezone/daily budget/continuous-play cap/break reminder; issue new device pairing codes by re-entering the PIN; revoke connected devices; inspect the last seven days' private activity; explicitly delete history; and change their PIN. Changing language or age invalidates that child's previous device credentials; PIN changes revoke all native devices. Forgotten PIN recovery still requires a fresh web guardian login.

The app makes a server-authoritative heartbeat immediately and every 45 seconds while foregrounded. On no connectivity, expired credential, reached daily budget, or a required rest break, Kids discovery, game and treasure pages lock. Parent PIN access remains possible. Each UTC minute slot is counted **once per child profile across devices**, under the guardian-chosen IANA timezone's local date. `sessionMinutes` from old web mode remains independent of native `dailyMinutes`.

DB migration: `20261012210000_kids_native_parent_time` (after the other three Kids migrations). For privacy a protected `/api/internal/kids-retention` route removes minute entries after 90 days; deploy a separate daily scheduler and `CRON_SECRET`. Full release QA and Phase 5 handover: [Phase 4 runbook](../../docs/kids-native-phase4-release.md).

**Phase 5 source cutover:** parental bootstrap and pairing now use authenticated adult `/account/kids` while all child gameplay occurs in the native app. Former `/kids/**` routes no longer serve child-facing web games. Old cookie-locked browsers must use the PIN-only `/account/kids/legacy-unlock` endpoint to avoid exposing coexisting guardian login cookies.

### Child-safe quiz reporting

During a playable question, tap **Tell us about a problem** and select unsafe content, incorrect answer or broken media. Reports have no free-text form and the server accepts a report only from a profile that actually played that quiz. Moderators see only reason counts from existing ADMIN-only shared REST/MCP review operations. Apply `20261012220000_kids_safety_reports` after the Phase 4 time migration. Do not assume a report automatically withdraws a question: trusted moderation remains responsible for approvals/restrictions and emergency media takedown.

## Phase 5 deployment caution

Apply `20261012230000_retire_web_kids_sessions` after prior Kids migrations; this revokes WEB-only sessions without changing NATIVE tokens. Native setup shows `/en/account/kids` or `/ko/account/kids`, never the deleted `/kids/parent`. Adult web device pairing is a **guardian account setting**, not a browser Kids mode. Read `docs/kids-native-phase5-cutover.md` for unverified production migration, real-device E2E and rollback gates. Do not claim App Store approval, installed iOS/Android builds or a live DB migration based solely on Expo exports.
