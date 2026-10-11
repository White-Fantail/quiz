# Clupio media platform — Cloudflare R2

Media is a **first-class asset** referenced by ID from both the quiz prompt and individual ordered clues. Files do not live in Prisma JSON, the browser's memory, or arbitrary third-party URLs. Assets, uploads, revisions, preview links and moderation are shared across web REST and OAuth-protected MCP through the common `execute()` registry.

## Architecture

- Cloudflare **R2** private bucket (S3-compatible `@aws-sdk/client-s3`), no public read permissions.
- Prisma `MediaAsset`: stable ID, owner, media kind/MIME, original size and SHA-256, immutable R2 key, optional parent (derived variant), source, attribution/license/alt/transcript, READY/UPLOADING/DELETED state and independent moderation PENDING/APPROVED/RESTRICTED.
- Quiz revisions store `promptMediaIds: string[]` and ordered typed clues with `mediaId`. Text/map clues work without storage. Quiz revisions remain immutable; uploaded assets cannot be overwritten or deleted once referenced by **any** revision.
- `play_start` returns the first clue plus prompt media IDs. `play_clue` reveals further clues. `play_media` checks the actual session's revealed-clue count and returns a **60-second signed R2 GET** URL only for APPROVED media that was actually revealed (or is in the prompt).
- Creator `media_get` returns a short-lived owner preview URL, including for assets pending safety moderation. Never return raw R2 credentials or object keys to callers.

## API / MCP parity

| Action | REST | MCP |
| --- | --- | --- |
| Reserve binary upload and get 5-min presigned R2 PUT URL | POST /api/v1/media/upload | `clupio_media_upload` |
| Upload a base64 chunk (when client cannot PUT binary) | POST /api/v1/media/:id/chunk | `clupio_media_chunk` |
| Verify original SHA-256, MIME and size; seal immutable object | POST /api/v1/media/:id/complete | `clupio_media_complete` |
| Import from an explicitly allowed HTTPS host | POST /api/v1/media/import | `clupio_media_import` |
| List own assets | GET /api/v1/media | `clupio_media_list` |
| Read own asset + signed preview | GET /api/v1/media/:id | `clupio_media_get` |
| Change accessible text / attribution (resets approval) | PATCH /api/v1/media/:id | `clupio_media_update` |
| Delete unreferenced asset, explicitly confirmed | DELETE /api/v1/media/:id | `clupio_media_delete` |
| Create private crop / blur / resized image variant | POST /api/v1/media/:id/transform | `clupio_media_transform` |
| ADMIN ONLY: approve or restrict asset (human moderation) | POST /api/v1/media/:id/review | `clupio_media_review` |
| Retrieve authorized playback URL for revealed media | POST /api/v1/play/:sessionId/media | `clupio_play_media` |

`clupio_quiz_create`, `clupio_quiz_update`, `clupio_clues_replace` and the corresponding REST calls use `promptMediaIds` or typed media clues (`{ "type": "image" | "audio" | "video", "mediaId": "UUID" }`); bare remote media URLs are **no longer accepted** by new quiz contracts. Existing historical revisions that stored remote URLs will need a separate migration before those games can serve safely through `play_media`.

## How ChatGPT can create a multimedia quiz

1. Use `clupio_media_upload` with `kind`, `mimeType`, `filename`, `sizeBytes` and a **hex SHA-256 of original file bytes**. Returns asset ID and time-limited signed R2 PUT URL, required Content-Type / checksum headers.
2. If the MCP client can send binary HTTP PUT, upload bytes **directly** to the returned URL, preserving all returned headers. The bucket requires configured CORS for direct browser uploads.
3. If the MCP client cannot PUT binary, send consecutive **0-based** 512 KiB-or-smaller chunks via `clupio_media_chunk`: base64-encode the bytes, compute each chunk's SHA-256, call with ID, index, base64 and digest. Each call must use valid, canonical standard base64 (not base64url). At most 128 parts for 64 MiB total. The MCP host must actually grant its agent access to the bytes; a chat attachment or AI-generated image is not automatically exposed to any MCP tool.
4. Call `clupio_media_complete` with `id` and `partCount` only for chunked uploads (no partCount for presigned PUT). Server reads R2, verifies original exact size, SHA-256 and actual MIME signature, then finalizes at a **different non-uploadable key**. Changing a staging object later cannot modify the finalized asset.
5. Add the ID to a quiz's `promptMediaIds` and/or media clues, and save as draft. Use `clupio_media_get` for the author-only preview.
6. Public media exposure requires **APPROVED** moderation. A restricted asset cannot be used. A quiz with PENDING media cannot be published publicly until reviewed; the administrator can review through `media_review` with a recorded reason. New derived images begin in PENDING. Kids mode still requires separate **quiz-level** eligibility approval.
7. To import an asset from an approved third-party source, use `clupio_media_import`. It is **disabled unless** `MEDIA_IMPORT_HOSTS` names that exact HTTPS host. The server resolves DNS once and pins a public IP for TLS fetch, rejects redirects, credentials, unsupported file types and over-size content. Copyright/license metadata must be provided as appropriate; permissions are the creator's responsibility.

Size limits: **images 12 MiB**, **audio 25 MiB**, **video 64 MiB**. Accepted formats: JPEG, PNG, WebP, MP3, WAV, OGG audio, MP4, WebM. All require detectable matching binary signatures. Limits, upload expiration and daily per-user request quota are server-enforced.

Image transformations support crops, Gaussian blur and resize (result WebP), with a 30-megapixel decode limit. These are **non-destructive new asset IDs** with a `parentId`. A progressive reveal can be implemented as multiple derived variants in order. Audio/video transcoding or waveform analysis is **not yet implemented**.

## Cloudflare setup

1. In Cloudflare R2, create **separate private buckets** for dev and production. Keep public development URL and R2.dev access **disabled** for sensitive or unreviewed content. Create a restricted API token with Object Read & Write for the target bucket only.
2. Configure these secrets in Vercel (per environment):
   ```dotenv
   R2_ENDPOINT=https://YOUR_ACCOUNT_ID.r2.cloudflarestorage.com
   R2_ACCESS_KEY_ID=...
   R2_SECRET_ACCESS_KEY=...
   R2_BUCKET=clupio-media-dev
   MEDIA_IMPORT_HOSTS=
   ```
   Use literal `MEDIA_IMPORT_HOSTS=example-media-cdn.com,another-approved-cdn.com` only for carefully trusted HTTPS hosts; leave empty initially. No wildcard.
3. Configure R2 **bucket CORS** for your exact web origin(s), methods PUT and GET as needed; allow request headers `content-type` and `x-amz-checksum-sha256`. Restrict allowed origin to dev and prod site URLs (separately). CORS applies to browser PUT, not server-to-server MCP uploads.
4. Add an R2 lifecycle expiration rule for keys starting with `uploads/` after **1 day**, cleaning expired staging uploads and chunk objects. Finalized assets use `assets/` and must not be expired by this rule. Set separate storage retention and deletion retry monitoring.
5. Apply the new Prisma migration `20261011110000_media_assets` after review, then regenerate the Prisma client. Run the root CI checks, direct R2 signed PUT, chunk upload, corrupt file / wrong MIME, presigned URL reuse, rejected content, owner isolation and signed playback E2E against the dev bucket **before** exposing real uploads.

## Safety and release limitations

- **Moderation status starts at PENDING** for every uploaded/imported/transformed asset. The current system records an ADMIN review decision, but **does not yet automatically detect** unsafe images, copyrighted material, malware, inappropriate audio/video or policy violations. Human review (or a future real moderation pipeline) is needed for APPROVED. Do not mark content safety as automated.
- File signature/size/checksum verification is not an antivirus or child-safety scan.
- Do not interpret an external URL from an AI as proof that the content can be legally reused. Attribution and explicit creator ownership/rights still matter.
- Per-account daily asset count is not distributed anonymous/IP-level abuse protection. Configure network rate limits and resource quotas before public launch.
- R2 lifecycle handles temporary object clean-up, but robust orphaned FINAL object clean-up on DB failure and deletion retries still needs a background maintenance job.
- The code has source-level CI; **live R2, live OAuth MCP, frontend media playback, automated moderation, and end-to-end upload validation remain unverified** until connected credentials/deployment and integration testing are performed.
