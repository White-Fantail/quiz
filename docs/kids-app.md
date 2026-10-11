# QuizDip Kids — Native child app and adult guardian setup

Phase 5 source status (2026-10-12): Kids is a **separate Expo iPad/iPhone/Android app** (`apps/kids`). The Next.js child-facing web shell, games, tabs, CSS and web-only device-activation endpoint have been removed on `dev`. **This does not mean TestFlight/Play distribution, real-device QA or production DB migration have been completed.**

## First-time setup and pairing

1. On the adult's browser visit `/en/account/kids` or `/ko/account/kids` (ordinary QuizDip account area).
2. Sign in with Better Auth Google/Apple, create guardian PIN (or use recently authenticated PIN recovery), and create a child profile with age band and language.
3. Generate a random, five-minute, **one-use** pairing code after entering the guardian PIN.
4. On the child's QuizDip Kids **native app** enter the code and device name. The app stores child-only scoped credentials in OS secure storage. No adult cookie is sent to the child device.
5. Play approved quizzes and media in the native app, and adjust limits, profiles and private history in its PIN-gated guardian area. Parent can also revoke devices in adult `/account/kids`.

The adult REST adapter is `GET/POST /api/account/kids`. Native child API continues at `/api/kids/native/**`; parent grants/child token issuance are restricted and not exposed as general MCP capabilities. Publication, translations, safety flags, KIDS weekly lane, run grading, media and moderation continue in shared server modules.

## Legacy browser cutoff

- Old `/kids`, `/en/kids/**` and `/ko/kids/**` URLs redirect to adult `/account/kids` without any web Kids gameplay.
- A browser that still holds the HttpOnly `quizdip-kid-session` cookie is **not** automatically unlocked. The proxy sends it to `/account/kids/legacy-unlock` with a six-digit guardian PIN prompt and hides adult navigation. The browser-auth and general REST handlers continue denying this old capability.
- `POST /api/account/kids/legacy-unlock` verifies the cookie's hashed WEB session, the matching guardian PIN, revokes that old token and expires the cookie. Even after the old session was remotely revoked or expired, its hash is deliberately retained for guardian PIN recovery.
- This is a **temporary security transition**, not a web child interface. Automatically deleting the cookie would let a child inherit an existing Better Auth guardian session. If the stored WEB session row was deleted, use another adult device for reauthentication and manually clear old browser site data.

## Database and production gates

The original `KidProfile`, `KidGuardianPin`, `KidDeviceSession` and all native child-progress/usage/safety data remain. Apply `20261012230000_retire_web_kids_sessions` in staging after backups and previous migrations; it revokes WEB-only sessions without changing NATIVE tokens. The migration source **does not** confirm it has been executed.

Automated validation: `npm run test`, `npm run typecheck`, `npm run build`, `npm run kids:bundle:ios`, `npm run kids:bundle:android`. These are source/build gates. Real onboarding, old-cookie PIN release, EN/KO and R2 media, EAS device builds, app-store privacy and migration rollback must still pass separately before production cutover.

For execution and rollback review, see [Phase 5 runbook](kids-native-phase5-cutover.md).
