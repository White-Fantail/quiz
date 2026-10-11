# QuizDip Kids — Stage 2 protected child profiles and devices

## Stages
- Stage 1: independent en/ko Kids shell and approved-content preview (implemented).
- **Stage 2:** guardian-owned profiles, salted 6-digit PIN, device activation/exit, server-side restricted child browsing, language and per-session limits (this change).
- Stage 3: a dedicated age-aware game and private treasures.
- Stage 4: expanded guardian reporting, fine-grained topic controls and E2E launch hardening.

## Guardian flow
1. Open `/en/kids/parent` or `/ko/kids/parent` and log in with Better Auth Google/Apple.
2. Set a six-digit guardian PIN (salted scrypt hash only; never returned by API).
3. Create up to eight child profiles with nickname, age-band, language and session allowance.
4. On the child's device visit the parent page, select the profile, name the device and confirm PIN.
5. The browser receives an **HttpOnly, SameSite=Lax** 256-bit opaque cookie; DB stores only its SHA-256 hash. The cookie is not a parent account identity.
6. Kids pages, GET /api/v1/quizzes and GET /api/v1/topics only allow Kids-approved content in the exact profile language. No general gameplay or owner APIs via the child session.
7. Select the lock in the Kids header to exit. Enter guardian PIN to revoke the token and clear the cookie; only then can the parent navigate back into normal QuizDip.
8. Parents can revoke child devices or remove profiles from their own guardian dashboard. Editing a profile revokes its existing child devices to enforce changes immediately.

## Security boundaries
- The Next.js proxy redirects active child devices from general pages to /kids, but **server-side** checks enforce the real permissions: protected Better Auth REST, general /api/v1 actions and /api/auth routes reject an active child cookie.
- The Kids browser capability does **not** authenticate as the guardian even if a Better Auth parent cookie coexists on the device.
- PIN failures are recorded in Postgres, locking access for five minutes after five errors. Success resets the attempt count.
- A child session expires at the configured session-time limit (15/30/60/120 minutes), or at 30 days if no time limit is chosen. This is **not** a daily activity budget.
- When expired, entering the PIN still permits exit. If the token was remotely revoked and the cookie persists, the browser fails closed; guardian should remove stale browser data or re-establish a verified session.
- PIN recovery requires a new Better Auth login less than five minutes old, and is only available on an unlocked browser. It is not a security-question or simple math challenge.
- Device cookies cannot lock the physical iPad or other apps. For system-wide kiosk behavior, pair with iPadOS Guided Access. Server-side gates do not prevent a child from clearing site data and browsing anonymous general QuizDip in a new browser; device OS restrictions are required for that boundary.
- Parent routes are *web-session only*. Parent identity, device activation and secret PIN operations are intentionally not exposed through Remote MCP, as a documented security/privacy exception to REST–MCP parity.
- Child activity recording, daily limits, user-level age verification and production moderation automation are **not** stage-2 deliverables.

## Database and rollout
Apply migration `20261012150000_kids_guardian_sessions` in each environment **before** release.
The existing User rows remain untouched; new KidProfile, KidGuardianPin and KidDeviceSession are additive.
Test signed-in guardian → PIN setup → profile → activation → forbidden /studio + /api/v1/me + /api/auth/get-session → allowed kids=true locale-matched catalog → PIN exit; also wrong PIN lockout, expired session, remote revoke, profile edits, missing provider auth and locale mismatch.
CI typecheck/tests/build are code checks, not proof of live Postgres OAuth integration. Do not enable in production before migrating and testing these real flows.
