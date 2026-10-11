# Clupio PLAY — weekly spotlight and practice

## Product structure

The primary product is **the featured creator's five-question challenge of the week**. The same five items, immutable revisions and ordering are shared by everyone around the world, with **one edition per UTC week and audience lane**. A featured human creator is the actual owner of the five questions, not a display-name string typed by staff. Creators may propose editions through Studio or MCP; only an authenticated ADMIN can publish a proposed schedule and independently mark a host as verified. A verified badge is never an automatic claim of celebrity status.

The other two modes are clearly **practice**:
- `RANDOM_FIVE`: a server-randomized five-question, no-duplicate set drawn from eligible published quizzes, distinct for each new run
- `INFINITE`: one question after another, selecting new published questions as play progresses; if the catalog is small, questions can repeat after the recent window
- All three modes have `GENERAL` and `KIDS` lanes. Kids uses **only** `publication=PUBLISHED, safetyStatus=APPROVED, kidsEligible=true`. General excludes restricted questions. Separate weekly editions are independently curated. Kids has **no public player standings**.

### Edition timing

- Weeks begin **Monday 00:00 UTC** and end the following Monday 00:00 UTC. These are universal boundaries; local times may differ.
- Creators submit *before* the start. Up to three proposals per creator/week/lane; multiple creators may propose the same week.
- Only one `SCHEDULED` edition may exist per lane/week (Postgres partial unique index).
- An ADMIN schedules one submitted edition, fixing **exactly five original, published, eligible quizzes and their revision IDs**. The question order is preserved from the creator's submission. It is never reordered or personalized per player.
- Revision pinning ensures later author edits cannot change the five answers or clue sequences. Server publication/eligibility checks are re-evaluated before each round. Unsafe/depublished items suspend that round rather than silently replacing a question.
- `weekly_suspend` halts an unsafe or withdrawn edition with audit logging. Recovery/replacement of a suspended live edition requires a separately reviewed editorial policy; the current code does not silently replace it.

### Official play & fairness

- `PlayRun` tracks lane, mode, current round, accumulated score, solved/failed, and end time. `PlayRunQuestion` stores the exact selected `quizId`/`revisionId` per index. The existing `PlaySession` tracks each question's unlocked clues and guesses, with one round session per run/index.
- `play_guess` updates its round and the parent run **in one transaction**. Replayed requests or parallel guesses do not score twice. Client code never validates answers locally.
- A signed-in Clupio user is limited to **one official first attempt per weekly edition** by a partial unique DB index. Reopening the mode resumes that same attempt, never creates a new ranked score. Authentication is optional for play, but guests are not in official standings.
- Weekly public rankings are only for **GENERAL**, and only for separately verified, explicitly opted-in adult users. Kids players are never listed. Ties on the same cumulative score share the same place; elapsed time is not a tiebreaker. Scores are accumulated from server-graded questions and cannot be supplied by the client.
- Weekly-challenge questions are reserved from random practice and standalone `play_start` while the edition is scheduled and not yet expired. This reduces accidental spoilers; it is not a guarantee against sharing answers externally.
- The run credential is a 256-bit secret; signed-in run tokens derive from `PLAY_RUN_SECRET` and the canonical Clupio account ID so a run can resume on another browser after sign-in. Anonymous run tokens are random capabilities, not eligible for official standings. Per-round play capabilities are derived from the run token and indexed question. Never log or include these in public rankings.
- The run `expiresAt` is the edition's deadline for WEEKLY. Practice runs expire in 2 days (five) or 7 days (infinite). Rejected/expired attempts never create extra score. Running out of safe questions returns a clear error.

### Host and celebrity participation

1. Creator logs in with Google or Apple, creates and publishes **five original quizzes** using the shared REST/MCP interface (including multimodal media if approved).
2. Creator opens `/studio/weekly`, chooses lane and an upcoming UTC Monday, clicks five questions **in exact intended order**, writes a featured title and message, and submits. MCP callers can use `clupio_weekly_submit` with the same data.
3. Staff opens `/admin/weekly` or calls `clupio_weekly_proposals` to review proposals, consent and identity, then calls `clupio_weekly_publish` with explicit confirmation and `verifiedHost`. The verification badge must reflect a genuine independent identity check. The author's current Clupio display name is displayed as host; avoid impersonation in event promotion.
4. At the scheduled UTC boundary the **same** edition appears for everyone in that lane. Players take the five rounds and see the overall score; eligible verified adults may see the weekly leaderboard.

## REST / MCP operations

| Function | REST | MCP |
|---|---|---|
| This week's edition + real author | GET /api/v1/weekly/current?lane=GENERAL/KIDS | `clupio_weekly_current` |
| Submit five owned questions to staff | POST /api/v1/weekly/submit | `clupio_weekly_submit` |
| List host proposals (ADMIN) | GET /api/v1/weekly/proposals | `clupio_weekly_proposals` |
| Schedule fixed edition (ADMIN) | POST /api/v1/weekly/:id/publish | `clupio_weekly_publish` |
| Suspend (ADMIN) | POST /api/v1/weekly/:id/suspend | `clupio_weekly_suspend` |
| Weekly ranked adult standings | GET /api/v1/weekly/:id/standings | `clupio_weekly_standings` |
| Begin or resume a multi-round run | POST /api/v1/runs | `clupio_run_start` |
| Get current pinned question & unlocked clues | POST /api/v1/runs/:id/current | `clupio_run_current` |
| Finish infinite practice voluntarily | POST /api/v1/runs/:id/finish | `clupio_run_finish` |
| My recent runs | GET /api/v1/runs | `clupio_run_history` |
| Player-owned opt-in for public ranking | PATCH /api/v1/me/ranking | `clupio_ranking_optin` |
| ADMIN-only adult verification | POST /api/v1/admin/verify-adult | `clupio_adult_verify` |

Existing question actions remain unchanged:
- `clupio_play_clue`: `POST /api/v1/play/:sessionId/clue`
- `clupio_play_guess`: `POST /api/v1/play/:sessionId/guess`
- `clupio_play_media`: `POST /api/v1/play/:sessionId/media` for **already revealed** media only.

The weekly tools and browser UIs use `execute()` and share the same owner, audience, session and moderation protections. No duplicated grading rules exist in the client.

## Configuration and deployment

- Apply the Prisma migrations `20261011120000_weekly_play` and `20261011123000_ranking_optin` **after** the existing user/media migrations.
- Set `PLAY_RUN_SECRET` to an independent randomly generated **32+ character** secret in **each** deployment environment. Do not rotate it mid-run without an explicit token-version migration (existing authenticated run tokens would change).
- Configure actual Better Auth and PostgreSQL, R2 if using media clues, and Google/Apple OAuth as documented in `docs/auth-sso-mcp.md` and `docs/media-r2.md`.
- Run `npm run test`, `npm run typecheck`, `npm run build`. Unit/parity tests do not replace an actual migrated Postgres + logged-in full weekly challenge test.
- Before launch: test simultaneous first weekly attempt across devices, correct/incorrect scores, resume across devices, 5 round completion, safe media playback, zero questions, editorial UTC week rollover, author edits during a live week, admin restriction, Kids denied content, and public rankings. Add distributed play rate limiting, moderation workflows, Verified Adult opt-in management, analytics scalability and account age controls. These release gates are **not** implied complete by CI.

No celebrity is enrolled and no real week is populated automatically by this code. Until an author submits five published quizzes and an admin schedules one, the weekly tile intentionally shows a no-edition state instead of inventing questions or authors.

## Ranking privacy

Official General weekly standings are **opt-in only**, for adults independently verified by trusted administrators. The user sets `leaderboardOptIn` in `/account` or `clupio_ranking_optin`; a trusted administrator sets `leaderboardEligible` using `clupio_adult_verify`. Both start false and both must be true. Staff must have independently substantiated age, not self-attestation. A weekly author cannot enter their own public scoreboard. Kids public rankings do not exist.

## Child-safety moderation

Kids is **not** a creator-selected age label. An independent platform moderator inspects the complete answer, all clues and media and explicitly grants safetyStatus=APPROVED and kidsEligible=true. The moderator UI is /admin/quiz-review, with ADMIN-only quiz_review_get and media_review_get inspection followed by quiz_review and media_review audited decisions. A creator cannot override a restriction. Approval updates are revision-pinned with currentVersion optimistic concurrency, so the moderator cannot inadvertently approve newly edited clues they did not inspect.

This is a trusted human review workflow; AI classifiers, child-account eligibility and production abuse protection remain future release gates.
