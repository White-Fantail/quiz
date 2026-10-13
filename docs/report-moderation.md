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

## Follow-up implementation (October 14, 2026)

- Threshold changes recheck **existing OPEN reports** in the new rolling period in the same database transaction. Lowering thresholds can immediately hold qualifying ACTIVE content and send creators an in-app notice. Disabling holds does not automatically republish content already awaiting staff review.
- Account publishing guards are rechecked using a `User ... FOR SHARE` row lock within each publication transaction; restriction updates acquire the conflicting row lock. This closes the administrator-restricts-during-publication race.
- A reporter cannot re-file an OPEN report or re-file a recently submitted report for the same item during a 24-hour cooldown, even after staff clearance. Report counts remain deduplicated per distinct author.
- Owners receive private moderation notices and can appeal held/restricted content or an active publishing restriction at `/account/moderation`. Appeals require a reason, use a one-OPEN-appeal-per-owner/target constraint, and must be accepted/rejected by ADMIN with a rationale. Appeals do not automatically change status when filed.
- Staff can view report details and audit history, confirmed moderation restrictions (distinct from unverified reports), and the appeals queue at `/admin/moderation`.
- REST and MCP expose identical actions through the shared operation router (see `docs/api-mcp.md`).

## End-to-end test matrix for a dev environment

1. Run migrations `20261014080000_report_moderation` and `20261014100000_moderation_appeals_and_notifications` on a dedicated dev database (not the production database); regenerate Prisma client. Validate no existing content is deleted.
2. Verify TypeScript, full tests and Next.js build; use ADMIN and 4 separate ordinary established identities plus 3 recent identities.
3. General quiz and pack publish without staff approval; Kids content still requires separate explicit approval. Restrict one account; verify draft creation allowed but direct quiz publish, edited already-public quiz, bulk pack publish (including draft members), pack edit, translated quiz publish, pack localized publish and legacy-language update fail from **both REST and MCP**.
4. Normal report: the first two established unique reporters do not hide a quiz; the third triggers `UNDER_REVIEW`, preserves `publication=PUBLISHED`, appears in staff queue and the owner's inbox. Confirm public direct GET, Discover, editorial, Kids native, all new play and already-started clue/media/guess requests do not expose it. Check pack-level reports behave independently and unrelated packs can skip unavailable members.
5. Repeated report by the same account within 24 hours, self-report, new account brigading and over-quota reports cannot trigger holds. In a concurrency test, use simultaneous reports from independent accounts; verify a single audit event and notice on each transition.
6. Staff CLEAR removes the hold and closes reports without deleting quiz history, REST/MCP access recovers; reporter cannot immediately re-file the same content. Staff RESTRICTED permanently gates public access until RESTORED or accepted appeal.
7. Change quiz threshold from 5 to 3 with 4 valid existing OPEN reports: the content transitions to UNDER_REVIEW without a new report. Disable auto holds: future reports stay public but appear in the moderation queue. Re-enable: qualifying OPEN reports are re-evaluated. Confirm policy changes are ADMIN-only and audited.
8. Verify owner receives private notices and cannot read another account's notices; only owner may submit appeal. Confirm duplicate OPEN appeal, child-scoped submissions and empty appeal reason fail; accepted appeal restores exactly the target; rejected appeal does not. Moderator reasons and audit decisions persist. Reporter identities must not appear in owner view.
9. Concurrent publication and administrator restriction: either publication commits before restriction or is rejected; publication **must never commit after the restriction becomes effective**. Exercise through both REST/MCP.
10. Review logs, migration status, DB indices and all role checks. Do not merge to `main` or deploy to production until the full matrix passes.

Known gap: this is source implementation; a Vercel preview build was previously blocked by an integration-scope 403. New DB migrations and end-to-end authentication/playback have not been executed here.
