# Quiz pack moderation

General packs publish without preapproval. A restricted, unpublished, untranslated
or media-withdrawn member is omitted from General play. The saved pack and membership
are never modified by this filter; a pack with no playable members is hidden.
A new General run pins the remaining safe member revisions and chosen order.
When a member is withdrawn mid-run, the server skips it without exposing unsafe
content or recording a wrong answer.

A whole-pack General restriction is independent of individual quiz restrictions.
Admins see reported or currently restricted packs and may restrict for abusive
pack metadata or composition; restriction requires an explanation. Restoring General
access does not create Kids approval.

Kids packs are all-or-nothing. A pack creator must explicitly request manual Kids
review after publication and after every original-language question and media asset
has affirmative Kids approval. The Admin Kids queue contains only pending creator
requests, not every public pack. ADMIN can approve (note optional) or reject
(explanation required). Creator edits reset the Kids review to NOT_REQUESTED;
the creator cannot undo an ADMIN RESTRICTED general state.

General safety is ACTIVE or RESTRICTED. Kids review is independently
NOT_REQUESTED, PENDING, APPROVED or REJECTED. Kids application approval
sets kidsEligible, but creator-supplied values cannot. If any constituent quiz
loses Kids approval, its entire pack disappears from Kids. If all members regain
approval without changing the pack, the existing pack approval can take effect again.
Child language, age, media and device checks are always performed at play time.

REST/MCP changes:
- POST /api/v1/packs/:id/kids-request = quizdip_pack_kids_request
- GET /api/v1/admin/packs/safety = quizdip_admin_pack_safety_list
- GET /api/v1/admin/packs/reports = quizdip_admin_pack_reports_list
- POST /api/v1/admin/packs/:id/safety-review = quizdip_admin_pack_safety_review

Migration: prisma/migrations/20261013050000_simplify_pack_moderation.
It preserves existing Kids approvals while converting old General pending/approved
pack states to ACTIVE. It does not fabricate creator requests for old packs.
Validation requires CI, live DB migration, signed-in Admin/Studio and paired
Kids app smoke tests. See apps/web/test/pack-safety-policy.test.mjs.
