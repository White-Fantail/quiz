# Risk-driven quiz moderation

## General play

QuizDip publishes a creator's quiz immediately after explicit publication, subject to the existing approved-media checks. The only quiz-level general safety states are `ACTIVE` and `RESTRICTED`. The former `PENDING` and general `APPROVED` statuses are migrated to `ACTIVE`; **general approval is not a precondition to play or discovery**. A trusted moderator can restrict or restore general visibility. Restriction requires a reason and is audit logged.

The default administrator queue shows **only actionable signals**, rather than all published quizzes:

- **Reports:** new, OPEN quiz reports since the last moderator review, deduplicated by reporting account. UNSAFE, PRIVACY and COPYRIGHT are prioritized. Reports alone do not unpublish a quiz.
- **Ratings:** 20 or more unique signed-in voters, at least 14 negative, at least 70% negative, and at least five negative voters who submitted or updated a negative review since the last moderator review. Reactions are deduplicated by person across locales. Ratings alone do not unpublish a quiz.
- **Kids:** published quizzes for which the creator explicitly requested Kids review.
- **Restricted:** restricted quizzes for possible restoration.
- **All:** an administrator-only full catalog lookup for investigations.

`CLEARED` records a moderation timestamp. Reports and ratings that predate that timestamp stop triggering the queue, but any *new* report or meaningful fresh negative feedback triggers re-review. Existing reports are preserved for accountability; clearing is not erasure. A moderator may also directly restrict a quiz. An AI risk detection source may be added to the same queue in a later phase, but **no AI moderation decision is active in this implementation**.

## Kids requests

The creator can set `kidsRequested: true` on `quiz_create` / `quiz_update`, or call `quiz_kids_request` with `{id, requested:true}` at any time; the Studio details page offers the same action. The owner may withdraw using `requested:false`. These are *requests*, not grants of access.

`kidsReviewStatus` is `NOT_REQUESTED`, `REQUESTED`, `APPROVED`, or `REJECTED`. Only a published, unrestricted, explicitly `REQUESTED` quiz can be granted `KIDS_APPROVED` by an ADMIN. Such approval checks the current revision and all referenced media. Kids exposure requires `kidsEligible`, `kidsReviewStatus=APPROVED`, a published original-language localization, and a non-restricted quiz. A creator cannot set `kidsEligible` or `kidsReviewStatus` directly.

Moderators can reject a Kids application with a reason without restricting adult play. A rejected creator may revise or re-request; edit and translation publication invalidate old Kids approval. Restricting a Kids quiz revokes its Kids eligibility. General restriction restoration never silently restores Kids eligibility. Whole-pack Kids approval remains an independent additional gate.

## Review API

- `GET /api/v1/admin/quizzes/review?queue=ATTENTION|REPORTS|RATINGS|KIDS|RESTRICTED|ALL` (with `search`, `limit`, `offset`)
- `GET /api/v1/quizzes/:id/review` (ADMIN only, reports and ratings included)
- `POST /api/v1/quizzes/:id/review` `{verdict:"CLEARED"|"KIDS_APPROVED"|"KIDS_REJECTED"|"RESTRICTED"|"RESTORED",reason?,confirm:true}` (ADMIN only)
- `POST /api/v1/quizzes/:id/kids-request` `{requested:true|false}` (owner only)

All operations use shared REST/MCP validation, authorization and audit logging. Existing media moderation `PENDING` and pack-level safety review `PENDING` are separate workflows and remain unchanged.
