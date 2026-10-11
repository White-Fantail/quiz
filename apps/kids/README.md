# QuizDip Kids (Expo, Phases 1–3)

Dedicated iPad/iPhone/Android experience for QuizDip Kids. **Native guardian-linked device scope is implemented in source but not yet production-verified.** The existing web Kids mode stays in service until the native app meets Phase 2–4 release gates.

## Start

Use Node.js 22.13+ and npm from the repository root:

```sh
npm install
cp apps/kids/.env.example apps/kids/.env
# Edit EXPO_PUBLIC_QUIZDIP_API_URL to the existing QuizDip dev/staging HTTPS origin
npm run kids:dev
```

Start an iOS Simulator, Android emulator, or Expo Go on a device from the Expo CLI. A parent signs in using the **external system browser** to QuizDip's existing Better Auth Google/Apple web login. In `/en/kids/parent` or `/ko/kids/parent`, the parent creates a profile and a six-digit PIN, chooses the profile, enters the PIN, and generates a high-entropy one-time pairing code. The code expires in five minutes. The Kids native app accepts that code and a device name, obtains a **child-only credential**, stores it in OS SecureStore, and validates it on startup and foreground before opening Kids screens. The parent may revoke the device in the same web parent panel. The app's Parent Gate needs the same guardian PIN to revoke the local device session and return to setup.

This **browser-assisted onboarding is intentional**: the child never receives an adult Better Auth cookie, Google/Apple OAuth token, or MCP privilege. Full native guardian profile management is planned for Phase 4, at which point the legacy web Kids interface will be removed in Phase 5. Kids gameplay, server-graded clues and private treasures are implemented in Phase 3 source; authoritative daily time limits and the full native parent zone remain Phase 4.

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

- `/api/kids/parent` action `native_pair_issue`: only a signed-in web guardian with same-origin request and correct 6-digit PIN may issue a code for their own profile. This action deliberately has no MCP equivalent (unsafe capability distribution); the normal safety and profile data model remains shared.
- `/api/kids/native` POST `pair`: exchanges a one-time code and creates a `clientKind=NATIVE` token (hash in DB; plaintext returned once).
- `/api/kids/native?view=session` and `?view=catalog`: require only the child bearer token. Catalog uses the server `quiz_list` operation with **forced** Kids flag and profile locale. Bearer never authenticates an adult or author.
- `/api/kids/native` POST `unlock`: requires child bearer **and** 6-digit guardian PIN, then revokes it. Five failed PIN attempts invoke the existing DB-based lockout.
- Never expose the bearer in navigation/URLs/logs. Device tokens expire after 30 days independently of the legacy `sessionMinutes` value; daily device usage accounting is Phase 4.
- Reinstall behavior of OS secure storage differs by OS; always allow the guardian to remotely revoke a device. Production rollout requires reinstall/backup/restore tests, E2E with real Better Auth + Postgres and a real iPad/Android.

## Phase 3 gameplay

Open **Explore** and tap an approved question to play one question, or open **Challenge** to start five random questions or a separate weekly Kids challenge. The child never sees a public leaderboard. Answer checking and clue reveal happen on the server, not in the native bundle. Young age bands receive 2–4 large answer choices when the approved bank has enough good decoys; older children use a text answer. Photos, audio and videos are signed and may need refreshing after one minute. Map clues currently show coordinates, **not yet a rich geographic map**. If there are fewer than five unseen approved questions, use a single Discover question instead; do not substitute adult/general content.

Reopening the app can resume an active game token from SecureStore. The backend binds it to the same child's profile and device, and ordinary general endpoints reject child-owned play sessions even if a play token is copied. Rewards are private and derived only from child sessions. Deleting a child profile through the authenticated parent UI deletes its saved gameplay in the same transaction.

Apply `20261012200000_kids_native_play` **after** `20261012190000_kids_native_pairing`. Release tests must include public API token leakage attempts, cross-device/session IDs, profile deletion, safer translation revision changes during play, revoked media between clues, signed URL expiry, too few questions, concurrent answers, restart, offline mode and iPad/Android playback on real R2 media. A source commit or Expo export does not prove production readiness.
