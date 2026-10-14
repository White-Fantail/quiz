# QuizDip Kids (Expo, Phases 1–5)

Dedicated iPad/iPhone/Android experience for QuizDip Kids. **Native guardian-linked device scope is implemented in source but not yet production-verified.** The old web Kids game UI has been removed in Phase 5 source on dev; real-device and production validation remain outstanding.

## Start — single production API

QuizDip currently has **one backend**: `https://quizdip.vercel.app`. The Kids native source sets this public HTTPS origin directly for every build profile (Expo Go, simulator, EAS preview and production). No `.env` file, EAS secret or user-entered server address is needed.

Use Node.js 22.13+ and npm from the repository root:

```sh
npm install
npm run kids:dev
```

Open an iOS simulator with **i** or a browser-only sample preview with **w**. For the real native experience, use the guardian account at [QuizDip Kids settings](https://quizdip.vercel.app/en/account/kids) to create a child profile and issue a one-time pairing code. API credentials are **not** stored in the Expo config; the child-scoped token remains in OS SecureStore.

**Production data caution:** All real native development, simulator pairing, game activity and parent settings now target the **live production database**. Use an explicit test child profile and avoid destructive or automated E2E operations on real user records. If a separate staging backend is introduced, update the centralized `KIDS_API_ORIGIN` in `src/services/api.ts` and add environment separation deliberately.

## Launch native app or local browser UI preview

The `apps/kids` Expo app supports **iOS, Android and a development-only browser preview**. Web renders responsive Kids UI using shared Expo/React Native components and English/Korean strings. It is intentionally **sample-data-only**: no child login or pairing, guardian PIN, device bearer, server quiz, private media or actual activity is accessed, and no browser storage is used. This is not a restored public web Kids product; main QuizDip web continues to expose only adult Kids account settings.

From repository root run `npm install` and `npm run kids:dev`. Press **w** for the interactive browser preview at `http://localhost:8081` (local machine only). Preview home, explore, challenge, sample clues/answers, treasures and language switching. To test the real Kids app, scan the QR code **with Expo Go on your iPad/phone** on the same Wi-Fi. The real app still requires guardian pairing and OS SecureStore.

When updating local dependencies: `git pull --ff-only origin dev`, `npm install` in the root, then `cd apps/kids && npx expo start --clear`. The cache-empty warning after a clean start is normal.

### Fix `Unable to resolve "react-native-web/dist/index"` on an existing Mac checkout

This means the local dependency tree is missing the browser adapter, even if Expo prints a Web URL. The `apps/kids/package.json` workspace now declares Expo's supported `react-native-web@^0.21.2`. From the **repository root**, stop Metro and run:

```sh
git switch dev
git pull --ff-only origin dev
npm install
npm ls react-native-web react-dom @expo/metro-runtime --workspace @quizdip/kids
```

All three modules should appear without a `missing`/ `UNMET DEPENDENCY` error. If `react-native-web` is still missing, explicitly repair this workspace with `npm install --workspace @quizdip/kids 'react-native-web@^0.21.2'` and check `npm ls` again. Then run `cd apps/kids && npx expo start --clear` and press **w**. Avoid mixing pnpm/yarn and npm installs in this npm-workspace repo. CI tests a fresh installation, but cannot repair stale local `node_modules` on the Mac.
 To validate web bundling run `npm run kids:bundle:web`; exported preview assets **must not be deployed** to the public website. iOS/Android and physical-device tests are independent, and Expo export is not a signed device build.

Start an iOS Simulator, Android emulator, or Expo Go on a device from the Expo CLI. A parent signs in using the **external system browser** to QuizDip's existing Better Auth Google/Apple web login. The Kids native app now displays a QR and a separate six-digit numeric fallback code, both valid for five minutes. The parent scans the QR on their own phone, signs into `/account/kids/connect` if necessary, chooses the child, and confirms their guardian PIN. If scanning is inconvenient, they instead enter the **six digits shown on the device** at `/account/kids`. No long code is typed into the child's device. The iPad polls with a different private device-only secret, receives a **child-only credential** after approval, stores it in OS SecureStore, and validates it on startup and foreground. Neither QR nor numeric code contains an adult session or device bearer token. Old app versions can still redeem existing legacy codes until their separate flow is retired. The parent may revoke the device in the same web parent panel. The app's Parent Gate needs the same guardian PIN to revoke the local device session and return to setup.

This **browser-assisted onboarding is intentional**: the child never receives an adult Better Auth cookie, Google/Apple OAuth token, or MCP privilege. Full native guardian profile management is planned for Phase 4, at which point the legacy web Kids interface will be removed in Phase 5. Phase 3 native game/clues/treasures and Phase 4 daily play limits, private activity insights and the PIN-protected in-app parent zone are implemented in source. Actual database migrations, real-device QA, an approved privacy policy and store distribution remain pending.

**Until the Prisma migration is applied** (`20261012190000_kids_native_pairing`) native pairing will fail. Confirm migrations have been safely applied to production before attempting native pairing; a source commit does not apply migrations.

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

The fixed HTTPS backend URL is public and not a secret. No API secrets, private media credentials, child access token or admin abilities belong in Expo configuration. Kids catalog uses server filtering, checks `kidsEligible === true` again defensively, and never includes the answer. An unreachable backend shows a locked/unavailable state; configuration is automatic. The guardian's profile locale is authoritative after pairing; the app cannot override it. A guardian PIN change/recovery revokes active native sessions; an existing browser-only token is not valid natively. Do not infer Kids safety from the creator's intended age.

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

## QR and six-digit fallback enrollment

New Expo/iPad installs show a *device-generated* QR plus six digits. The QR contains a short-lived 144-bit **approval token**, not the 256-bit device claim capability; the manual code can only be approved from a signed-in parent session with PIN and has an account-level five-attempt lockout. Parent confirmation requires a child profile. A separate device-held claimant polls `/api/kids/native/pair` until approval, then receives the child-only bearer exactly once and stores it in SecureStore. The old 24-hex-character flow stays available in API for older clients but is no longer the primary user interface.

**Apply `20261012233000_kids_device_initiated_pairing` after the existing Kids migrations before testing this flow.** Run the source, test and bundle suite, then check iPad camera scan to parent login, Google/Apple return URL, numeric fallback, PIN lockout, expired/replayed requests, multi-device race, and a real QR scan on physical devices. Anonymous start endpoints need deployment-level abuse monitoring or throttling before public scale. Pairing and guardian PIN actions intentionally have no MCP equivalent because adult Kids enrollment is restricted to interactive browser authorization.


## Adventure-first Home and Explore

Kids Home now greets the current child, highlights a playable approved quiz pack (or safe editorial pick), shows bright illustrated worlds only when the loaded catalogue has games in them, and offers a horizontal rail of ready-to-play packs. Explore uses the same worlds including Dinosaur World and surfaces Kids-approved **packs before single questions**; cards open the existing secure native game flow. The redundant Quiz packs tab is hidden while the existing route is kept for backward compatibility. No extra backend endpoint or child-scoped capability is introduced. The visible content still depends on the guardian's language and age, current Kids safety approval, active device token and server play-time rules.

These are original self-contained native SVG illustrations; they do not rely on iOS/Android emoji font glyphs. Category assignment uses approved titles/descriptions and answer types as lightweight UI metadata, with Mystery Box for unknown themes, not an authoritative DB tag or claim that every page has been scanned. No quizzes or packs are shown merely to fill a category.

## Local-first game playback (October 2026)

Current native gameplay downloads a complete, child-approved run bundle at game start. The shared `@quizdip/domain` reducer reveals clues, judges guesses and computes scores synchronously; results are sent asynchronously via `run_sync`/`single_sync`. Approved media still needs temporary signed URLs from the backend. The device stores the active capability and compact progress in SecureStore, refetching its pinned bundle after a cold restart. Device-local foreground timers enforce advisory guardian time limits without mandatory heartbeat polling. Older server-play endpoints remain for backwards compatibility. This phase does not promise full offline cold-start restoration or removal of existing server usage tables.
