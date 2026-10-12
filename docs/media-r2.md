# QuizDip media platform — Cloudflare R2

Media is a **first-class asset** referenced by ID from both the quiz prompt and individual ordered clues. Files do not live in Prisma JSON, the browser's memory, or arbitrary third-party URLs. Assets, uploads, revisions, preview links and moderation are shared across web REST and OAuth-protected MCP through the common `execute()` registry.

## Architecture

- Cloudflare **R2** private bucket (S3-compatible `@aws-sdk/client-s3`), no public read permissions.
- Prisma `MediaAsset`: stable ID, owner, media kind/MIME, original size and SHA-256, immutable R2 key, optional parent (derived variant), source, attribution/license/alt/transcript, READY/UPLOADING/DELETED state and independent moderation PENDING/APPROVED/RESTRICTED.
- Quiz revisions store `promptMediaIds: string[]` and ordered typed clues with `mediaId`. Text/map clues work without storage. Quiz revisions remain immutable. Assets cannot be overwritten; historical-only references no longer block media deletion while current and playable references do.
- `play_start` returns the first clue plus prompt media IDs. `play_clue` reveals further clues. `play_media` checks the actual session's revealed-clue count and returns a **60-second signed R2 GET** URL only for APPROVED media that was actually revealed (or is in the prompt).
- Creator `media_get` returns a short-lived owner preview URL, including for assets pending safety moderation. Never return raw R2 credentials or object keys to callers.

## API / MCP parity

| Action | REST | MCP |
| --- | --- | --- |
| Reserve binary upload and get 5-min presigned R2 PUT URL | POST /api/v1/media/upload | `quizdip_media_upload` |
| Upload a base64 chunk (when client cannot PUT binary) | POST /api/v1/media/:id/chunk | `quizdip_media_chunk` |
| Verify original SHA-256, MIME and size; seal immutable object | POST /api/v1/media/:id/complete | `quizdip_media_complete` |
| Import from a curated image CDN or configured exact HTTPS host | POST /api/v1/media/import | `quizdip_media_import` |
| List own assets | GET /api/v1/media | `quizdip_media_list` |
| Read own asset + signed preview | GET /api/v1/media/:id | `quizdip_media_get` |
| Change accessible text / attribution (resets approval) | PATCH /api/v1/media/:id | `quizdip_media_update` |
| Delete playback-unneeded asset, explicitly confirmed | DELETE /api/v1/media/:id | `quizdip_media_delete` |
| Create private crop / blur / resized image variant | POST /api/v1/media/:id/transform | `quizdip_media_transform` |
| ADMIN ONLY: approve or restrict asset (human moderation) | POST /api/v1/media/:id/review | `quizdip_media_review` |
| Retrieve authorized playback URL for revealed media | POST /api/v1/play/:sessionId/media | `quizdip_play_media` |

`quizdip_quiz_create`, `quizdip_quiz_update`, `quizdip_clues_replace` and the corresponding REST calls use `promptMediaIds` or typed media clues (`{ "type": "image" | "audio" | "video", "mediaId": "UUID" }`); bare remote media URLs are **no longer accepted** by new quiz contracts. Existing historical revisions that stored remote URLs will need a separate migration before those games can serve safely through `play_media`.

## Creator-facing Studio media library

The authenticated Studio web media library is available at `/studio/media`. A creator can choose a supported image/audio/video file, calculate SHA-256 in the browser, reserve a signed R2 upload through REST, send the file directly to the private bucket, finalize it through REST, list and preview their own assets, create blurred image variants, and delete unreferenced assets. The web interface and MCP operate on **the same `MediaAsset.id` values**. Quiz authoring itself is still primarily REST/MCP; the Studio quiz editor is not yet fully wired to the domain API.

## How ChatGPT can create a multimedia quiz

1. Use `quizdip_media_upload` with `kind`, `mimeType`, `filename`, `sizeBytes` and a **hex SHA-256 of original file bytes**. Returns asset ID and 5-minute signed R2 PUT URL (the reservation remains active for 30 minutes for slower MCP chunk transfers), required Content-Type header.
2. If the MCP client can send binary HTTP PUT, upload bytes **directly** to the returned URL, preserving all returned headers. The bucket requires configured CORS for direct browser uploads.
3. If the MCP client cannot PUT binary, send consecutive **0-based** 512 KiB-or-smaller chunks via `quizdip_media_chunk`: base64-encode the bytes, compute each chunk's SHA-256, call with ID, index, base64 and digest. Each call must use valid, canonical standard base64 (not base64url). At most 128 parts for 64 MiB total. The MCP host must actually grant its agent access to the bytes; a chat attachment or AI-generated image is not automatically exposed to any MCP tool.
4. Call `quizdip_media_complete` with `id` and `partCount` only for chunked uploads (no partCount for presigned PUT). Server reads R2, verifies original exact size, SHA-256 and actual MIME signature, then finalizes at a **different non-uploadable key**. Changing a staging object later cannot modify the finalized asset.
5. Add the ID to a quiz's `promptMediaIds` and/or media clues, and save as draft. Use `quizdip_media_get` for the author-only preview.
6. Public media exposure requires **APPROVED** moderation. A restricted asset cannot be used. A quiz with PENDING media cannot be published publicly until reviewed; the administrator can review through `media_review` with a recorded reason. New derived images begin in PENDING. Kids mode still requires separate **quiz-level** eligibility approval.
7. To import an image from an approved third-party source, use `quizdip_media_import` or Studio → Media → **Import an image from a URL**. Curated exact image-only CDN hosts are `upload.wikimedia.org`, `images.unsplash.com`, `images.pexels.com` and `cdn.pixabay.com`. Extra trusted hosts can be added with `MEDIA_IMPORT_HOSTS` (comma-separated exact hostnames). The server resolves DNS, checks every returned address, pins a verified public IP for TLS fetch, and rejects redirects, credentials, unsupported file types and over-size content. Audio/video imports are NOT automatically allowed from the curated image hosts. Each creator must verify and supply copyright/licence metadata; importing an image does not grant rights to reuse it.
8. For other image providers, users can download a licensed file and use direct upload. Studio provides outbound search links to public photo sources, not a built-in provider search API yet. Browser UI requires the importing user to acknowledge permission and provide attribution and licence; server-side media safety approval is still independent of that acknowledgement.

Size limits: **images 12 MiB**, **audio 25 MiB**, **video 64 MiB**. Accepted formats: JPEG, PNG, WebP, MP3, WAV, OGG audio, MP4, WebM. All require detectable matching binary signatures. Limits, upload expiration and daily per-user request quota are server-enforced.

Image transformations support crops, Gaussian blur and resize (result WebP), with a 30-megapixel decode limit. These are **non-destructive new asset IDs** with a `parentId`. A progressive reveal can be implemented as multiple derived variants in order. Audio/video transcoding or waveform analysis is **not yet implemented**.

## Cloudflare setup

1. In Cloudflare R2, create **separate private buckets** for dev and production. Keep public development URL and R2.dev access **disabled** for sensitive or unreviewed content. Create a restricted API token with Object Read & Write for the target bucket only.
2. Configure these secrets in Vercel (per environment):
   ```dotenv
   R2_ENDPOINT=https://YOUR_ACCOUNT_ID.r2.cloudflarestorage.com
   R2_ACCESS_KEY_ID=...
   R2_SECRET_ACCESS_KEY=...
   R2_BUCKET=quizdip-media-dev
   # Built-in image-only CDN hosts are curated in src/modules/platform/import-hosts.ts.
   # Use this variable only to grant additional exact hostnames (no wildcards).
   MEDIA_IMPORT_HOSTS=
   ```
   Curated image hosts work with an empty `MEDIA_IMPORT_HOSTS` once this code is deployed. Optional additional sources use literal `MEDIA_IMPORT_HOSTS=additional-approved-cdn.example` only after reviewing host security and licensing terms. Never allow wildcard, private hosts or subdomain-suffix matching. Changes to environment variables require a new deployment to reach running functions. The Vercel account must have the appropriate project/team permissions.
3. Configure R2 **bucket CORS** for your exact web origin(s), methods PUT and GET as needed; allow request header `content-type`. The R2 presign does not require S3 SHA-256 checksum headers; QuizDip independently verifies the complete SHA-256 before final storage. Restrict allowed origin to dev and prod site URLs (separately). CORS applies to browser PUT, not server-to-server MCP uploads.
4. Add an R2 lifecycle expiration rule for keys starting with `uploads/` after **1 day**, cleaning expired staging uploads and chunk objects. Finalized assets use `assets/` and must not be expired by this rule. Set separate storage retention and deletion retry monitoring.
5. Apply the new Prisma migration `20261011110000_media_assets` after review, then regenerate the Prisma client. Run the root CI checks, direct R2 signed PUT, chunk upload, corrupt file / wrong MIME, presigned URL reuse, rejected content, owner isolation and signed playback E2E against the dev bucket **before** exposing real uploads.


## Retention rules for historical quiz media

Immutable QuizRevision rows and play statistics remain in the database. Old versions cannot normally be selected for new standalone games. Media is protected from cleanup while it is referenced by:
- a current editable revision (including drafts) or a published language version;
- any unexpired PlaySession, including completed sessions;
- a pinned PlayRunQuestion in an active, unexpired PlayRun;
- a submitted or scheduled WeeklyQuestion or WeeklyQuestionLocalization whose weekEnd is in the future.

Older historical-only references may be cleaned up when none of these conditions apply. Current media and historical provenance must not be confused: the MediaAsset record is soft-deleted, retaining status and deletedAt, and a media.delete audit event records actor and timestamp. QuizRevision JSON is left intact, but files belonging exclusively to an old version may no longer be replayable. The final delete validates current protection inside a serializable transaction, and derived children must be deleted before their source. R2 cleanup happens after the database commit. Existing signed URLs expire separately.

The Studio and MCP used/unused filters use this protection policy. They do not mean never-used versus ever-used. Deployment does not automatically delete files; a later explicitly confirmed cleanup is a separate operation.

## Safety and release limitations

- **Moderation status starts at PENDING** for every uploaded/imported/transformed asset. The current system records an ADMIN review decision, but **does not yet automatically detect** unsafe images, copyrighted material, malware, inappropriate audio/video or policy violations. Human review (or a future real moderation pipeline) is needed for APPROVED. Do not mark content safety as automated.
- File signature/size/checksum verification is not an antivirus or child-safety scan.
- Do not interpret an external URL from an AI as proof that the content can be legally reused. Attribution and explicit creator ownership/rights still matter.
- Per-account daily asset count is not distributed anonymous/IP-level abuse protection. Configure network rate limits and resource quotas before public launch.
- R2 lifecycle handles temporary object clean-up, but robust orphaned FINAL object clean-up on DB failure and deletion retries still needs a background maintenance job.
- The code has source-level CI; **live R2, live OAuth MCP, game-screen media playback, automated moderation, and end-to-end upload validation remain unverified** until connected credentials/deployment and integration testing are performed.

A media approval reset is blocked while the asset is used in a currently published quiz; create a new variant instead. Restricting an approved asset propagates RESTRICTED to all published quizzes whose **current revision** references that asset. An authorized admin must explicitly review subsequent replacements; publisher edits cannot bypass moderation holds.

### QuizDip naming transition

For new installations, use a QuizDip-named R2 bucket. Changing this R2_BUCKET example does not rename existing remote storage. Audit configured buckets before any deliberate infrastructure migration; never delete a live bucket to satisfy a source-code rename. The MCP tool names shown above use the `quizdip_*` prefix.

## Studio media library: P0/P1 browse experience

Studio now displays **two independent statuses** per file:
- **Upload**: `READY` (업로드 완료) vs `UPLOADING` (업로드 중, or 업로드 만료 when the reservation deadline has passed). The UI does not falsely claim a file is ready because a reservation exists.
- **Moderation**: `PENDING` (안전 검토 대기), `APPROVED` (안전 검토 승인), `RESTRICTED` (사용 제한). READY is **not** an approval and does not enable public playback.

File sizes auto-format in bytes, KB, MB or GB; small files are no longer presented as `0.00MB`.

- Ready images render **automatically**, without an initial Preview button. An IntersectionObserver requests an owner-authorized thumbnail only when the card approaches the viewport. The server generates a **private** 320x240 WebP thumbnail on first request at `assets/<id>/thumbnail.webp`; subsequent requests reuse it. Only short-lived, 60-second signed R2 GET links are returned. If thumbnail generation fails, the owner can fall back to the original preview; there is no public bucket access. Thumbnail deletion is attempted when the original asset is deleted.
- Audio and video cards display placeholders. Playback requires a deliberate click on **상세 · 미리보기**, followed by using the native player controls. Media never autoplays.
- `GET /api/v1/media?limit=24&offset=0&search=...&kind=image&moderation=PENDING&status=READY&usage=used&sort=newest` supports validated **server-side** name/alt/attribution search, type, moderation, upload status, usage and sorting filters; it returns `{items,offset,limit,total,hasMore}`. `media_list` over OAuth MCP accepts the same filters. Use 24 records per Studio page and server-side paging, not a single fixed `limit=60` fetch.
- The owner-only `GET /api/v1/media/:id` includes `usage.items` describing current/historical revisions, prompt usage and exact clue positions (capped to 50 plus `hasMore`). The view includes Copy Media ID / Copy Quiz ID actions for reuse in Studio or via the MCP. Only current or potentially playable revision references prevent deletion; older history remains in the database.
- `GET /api/v1/media/:id?purpose=thumbnail` is a deliberately lightweight owner-authenticated lookup. It does not query quiz usage or disclose the original upload.
- Media usage filters distinguish active playback requirements from historical-only references and match deletion's revision-retention policy. At substantially larger scale, consider a normalized media-to-revision relation/index rather than extracting the historical reference ID set on each usage-filtered request.

Upload expiration is currently **a derived display state**, not a persisted lifecycle transition. Background cleaning of stale records, explicit retry UX, and fully integrated quiz-editor media picking remain future improvements; this change provides asset IDs and usage information in the existing API/MCP workflows.

Regression coverage: `apps/web/test/media-library.test.mjs`, `apps/web/test/media-list-contract.test.mjs`. Run `npm test`, `npm run typecheck` and web build before merging to main.
