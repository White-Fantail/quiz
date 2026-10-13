# Report-driven moderation and creator publishing restrictions

Status: implementation on `dev`; not a live production feature until migration, tests and authenticated REST/MCP QA succeed.

## Principles
- General creator submissions remain **drafts until explicitly published**, and ordinary general publication needs **no moderator approval**. Kids approval stays separate.
- No AI classifier or political-opinion classification. Reports are signals, not proof of a violation.
- The platform may temporarily hold publicly published content for human review. The original `publication=PUBLISHED` remains unchanged; `safetyStatus=UNDER_REVIEW` is a server-enforced visibility gate in General and Kids. Only admins may restore/restrict it; owner may see moderation status and appeal.
- `RESTRICTED` is a staff decision, not the automatic hold outcome. Creator edits must never clear a hold/restriction.
- Every significant decision is audited. A restriction of an author's ability to publish never automatically deletes or hides their existing content.

## Adjustable configuration
Persist one `ModerationPolicy` row with key `default`, mutable **only by ADMIN** via REST/MCP and the moderator UI.
- `enabled=true`: automatic holds enabled.
- `quizReportThreshold=3`, `packReportThreshold=3`: number of distinct reporters in a rolling window.
- `windowHours=24`.
- `minimumEstablishedReporters=2`, `establishedAccountDays=7`: safeguard against newly registered report brigades. Count only distinct reporters whose `User.createdAt` precedes the cutoff toward established threshold.
- Enforce validation bounds; no action should depend on hard-coded threshold constants outside the initial policy defaults. Disabling auto-holds does **not** stop reports, queue or staff review.

Once a report is written, calculate distinct open reporters within the rolling window against the current threshold. Never count the creator reporting their own content toward automatic action; ignore a repeated open report by the same user for the same target. If eligible and currently `ACTIVE`, transition to `UNDER_REVIEW` atomically and audit. If already held or staff-restricted, do not change the status. Rejected/cleared reports must not immediately re-trigger a hold.

## Manual review
`ADMIN` can review both QUIZ and PACK: `CLEARED` (return to ACTIVE), `RESTRICTED` (human confirmation with reason), `RESTORED` (return a previously restricted record to ACTIVE). Resolve the reports available at review time and record version, reason and time; new reports are separate incidents. To prevent a flood of duplicates, index target/report status and prefer one OPEN report per reporter and target.

Staff can restrict creator publication with `publishingStatus=RESTRICTED` and optional `publishingRestrictedUntil` (null = indefinite). The guard is server-side and applies to REST, MCP, Studio and bulk pack publish. It blocks publishing or mutating publicly published quizzes/packs/translations, including publishing drafts via pack bulk operations, while still allowing drafts and ordinary play. ADMIN may lift a restriction at any time. Check in shared service methods and in transactions for race resistance. Do not infer publisher permissions from client-supplied identity.

## Visibility and appeals
- `ACTIVE` only: public lists, individual GET, ratings/report entry, discoveries, editorial, pack members, random/play sessions, Kids catalogs, and new sessions.
- Existing in-progress play session access must also verify current safety status before revealing another clue or grade.
- Authors see their own held content and can request review through support; restriction and review audit are retained. Never show report identities to creators.
- Staff dashboard prioritizes held content, then open reports, with links to existing full quiz/pack review and author-specific publishing controls.

## QA/release checklist
1. Apply Prisma migration in an isolated dev database, then regenerate the client.
2. Confirm general publish remains immediate for ordinary accounts, but held/restricted content is invisible across REST, MCP, Studio discovery, Kids, runs and editorial.
3. Confirm thresholds can change without deployment; no hold on one report; dedup reporters, self-report refusal, recent accounts and concurrency safeguards.
4. Confirm published-content edit / bulk pack publish / translated publish cannot bypass publishing restriction.
5. Test ADMIN-only policy changes/review/restriction for REST **and** MCP with audited decisions; non-admin request 403.
6. Confirm cleared content remains live, reports resolved, and new eligible reports can produce a subsequent hold.
7. Do not deploy production migrations or merge to main without explicit approval.

This policy is separate from the existing Kids and media affirmative review requirements.
