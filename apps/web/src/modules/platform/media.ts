import { createHash, randomUUID } from "node:crypto";
import sharp from "sharp";
import { db } from "./db";
import { fail, requireActor, type Actor } from "./auth";
import {
  LIMITS, MIME_KIND, CHUNK_SIZE, partKey, readChunks, uploadTicket, previewUrl, putObject,
  deleteObject, readObject, checkSize, sniff, importExternal, objectExists,
} from "./storage";

function safeMetadata(p: Record<string, any>) {
  return {
    ...(p.alt !== undefined ? { alt: p.alt } : {}),
    ...(p.transcript !== undefined ? { transcript: p.transcript } : {}),
    ...(p.attribution !== undefined ? { attribution: p.attribution } : {}),
    ...(p.license !== undefined ? { license: p.license } : {}),
  };
}
async function asset(id: string, actor: Actor | null) {
  const user = requireActor(actor);
  const row = await db().mediaAsset.findFirst({ where: { id, ownerId: user.id, deletedAt: null } });
  if (!row) fail(404, "media_not_found", "Media asset not found");
  return row;
}
export function mediaSummary(item: any) {
  return { id: item.id, kind: item.kind, mimeType: item.mimeType, sizeBytes: item.sizeBytes,
    originalName: item.originalName, status: item.status, moderationStatus: item.moderationStatus,
    alt: item.alt, transcript: item.transcript, attribution: item.attribution, license: item.license,
    sourceUrl: item.sourceUrl, parentId: item.parentId, createdAt: item.createdAt, updatedAt: item.updatedAt, uploadExpiresAt: item.uploadExpiresAt };
}
async function dailyLimit(ownerId: string) {
  const count = await db().mediaAsset.count({
    where: { ownerId, createdAt: { gte: new Date(Date.now() - 86400000) } },
  });
  if (count >= 150) fail(429, "media_quota", "Daily media upload limit reached");
}
export async function mediaUpload(p: Record<string, any>, actor: Actor | null) {
  const user = requireActor(actor);
  if (MIME_KIND[p.mimeType] !== p.kind)
    fail(400, "type_mismatch", "Declared MIME type is not valid for media kind");
  checkSize(p.kind, p.sizeBytes);
  await dailyLimit(user.id);
  const id = randomUUID();
  const uploadKey = `uploads/${user.id}/${id}/${randomUUID()}`;
  const storageKey = `assets/${id}/original`;
  const ticket = await uploadTicket(uploadKey, p.mimeType, p.sha256);
  const item = await db().mediaAsset.create({ data: {
    id, ownerId: user.id, kind: p.kind, mimeType: p.mimeType, sizeBytes: p.sizeBytes,
    sha256: p.sha256, originalName: p.filename, uploadKey, storageKey,
    uploadExpiresAt: new Date(Date.now()+1800000), ...safeMetadata(p),
  } });
  return { ...mediaSummary(item), upload: ticket, next: "PUT the binary with exactly the returned headers, then call media_complete" };
}
export async function mediaChunk(p: Record<string, any>, actor: Actor | null) {
  const item = await asset(p.id, actor);
  if (item.status !== "UPLOADING" || !item.uploadKey ||
    !item.uploadExpiresAt || item.uploadExpiresAt.getTime() < Date.now())
    fail(409, "invalid_upload_state", "Upload reservation is no longer active");
  const bytes = Buffer.from(p.dataBase64, "base64");
  if (!bytes.length || bytes.length > CHUNK_SIZE ||
    bytes.toString("base64") !== p.dataBase64)
    fail(400, "invalid_chunk", "Chunk is not canonical base64 or is too large");
  const actualHash = createHash("sha256").update(bytes).digest("hex");
  if (p.sha256 !== actualHash) fail(422, "checksum_mismatch", "Chunk hash does not match");
  await putObject(partKey(item.uploadKey, p.index), bytes, "application/octet-stream");
  return { id: item.id, index: p.index, uploadedBytes: bytes.length, next: "Send the next chunk, then call media_complete with partCount" };
}
export async function mediaComplete(p: Record<string, any>, actor: Actor | null) {
  const item = await asset(p.id, actor);
  if (item.status === "READY") return mediaSummary(item);
  if (item.status !== "UPLOADING" || !item.uploadKey)
    fail(409, "invalid_upload_state", "Asset is not waiting for upload");
  if (!item.uploadExpiresAt || item.uploadExpiresAt.getTime() < Date.now())
    fail(410, "upload_expired", "Media upload reservation expired");
  const bytes = p.partCount
    ? await readChunks(item.uploadKey, p.partCount, LIMITS[item.kind])
    : await readObject(item.uploadKey, LIMITS[item.kind]);
  if (bytes.length !== item.sizeBytes) fail(422, "size_mismatch", "Uploaded size is different from reservation");
  const hash = createHash("sha256").update(bytes).digest("hex");
  if (hash !== item.sha256) fail(422, "checksum_mismatch", "Uploaded checksum is different from reservation");
  await sniff(bytes, item.kind, item.mimeType);
  // Write exact validated buffer to a new private key. Do not use remote COPY:
  // a presigned staging PUT remains reusable until expiry and could be raced.
  await putObject(item.storageKey, bytes, item.mimeType);
  const updated = await db().mediaAsset.updateMany({
    where: { id: item.id, ownerId: item.ownerId, status: "UPLOADING" },
    data: { status: "READY", uploadKey: null, uploadExpiresAt: null },
  });
  if (!p.partCount) await deleteObject(item.uploadKey).catch(() => undefined);
  // Chunk objects are temporary; configure Cloudflare R2 to expire uploads/ after one day.
  if (updated.count === 0) {
    const latest = await asset(item.id, actor);
    if (latest.status !== "READY") fail(409, "upload_conflict", "Upload completion state changed");
    return mediaSummary(latest);
  }
  return mediaSummary(await asset(item.id, actor));
}
export async function mediaImport(p: Record<string, any>, actor: Actor | null) {
  const user = requireActor(actor);
  await dailyLimit(user.id);
  // Import is disabled unless MEDIA_IMPORT_HOSTS explicitly permits the hostname.
  const fetched = await importExternal(p.url, LIMITS[p.kind], p.kind);
  checkSize(p.kind, fetched.bytes.length);
  const mimeType = await sniff(fetched.bytes, p.kind);
  const id = randomUUID();
  const storageKey = `assets/${id}/original`;
  await putObject(storageKey, fetched.bytes, mimeType);
  try {
    const item = await db().mediaAsset.create({ data: {
      id, ownerId: user.id, kind: p.kind, mimeType,
      originalName: p.filename, sizeBytes: fetched.bytes.length,
      sha256: createHash("sha256").update(fetched.bytes).digest("hex"),
      status: "READY", storageKey, sourceUrl: p.url,
      ...safeMetadata(p),
    } });
    return mediaSummary(item);
  } catch (error) {
    await deleteObject(storageKey).catch(() => undefined);
    throw error;
  }
}
/** Media that can still be requested by a creator or a player.
 * Old immutable revisions remain as historical metadata, but their assets do not
 * need to live forever after all runtime references expire. This same query is
 * shared by the usage filter and deletion guard so "unused" means deletable
 * (subject to parent/child dependencies and a final transactional recheck).
 *
 * A pinned PlaySession can request media until expiresAt, even when SOLVED;
 * an active run may not yet have created its session for the next round.
 * SUBMITTED/SCHEDULED weekly snapshots are protected until weekEnd, even if
 * the quiz was edited after proposal submission.
 */
async function protectedMediaIds(ownerId: string, client: Pick<ReturnType<typeof db>, "$queryRaw"> = db()): Promise<string[]> {
  const rows = await client.$queryRaw<Array<{ id: string }>>`
    SELECT DISTINCT refs.id
    FROM "Quiz" q
    JOIN "QuizRevision" r ON r."quizId" = q."id"
    LEFT JOIN "QuizLocalization" l ON l."id" = r."localizationId"
    CROSS JOIN LATERAL (
      SELECT jsonb_array_elements_text(r."promptMediaIds") AS id
      UNION ALL
      SELECT c.value ->> 'mediaId' AS id FROM jsonb_array_elements(r."clues") c
    ) refs
    WHERE q."authorId" = ${ownerId} AND refs.id IS NOT NULL
      AND (
        (l."id" IS NOT NULL AND r."version" = l."currentVersion")
        OR (l."status" = 'PUBLISHED' AND r."version" = l."publishedVersion")
        OR (l."id" IS NULL AND r."version" = q."currentVersion")
        OR EXISTS (
          SELECT 1 FROM "PlaySession" s
          WHERE s."revisionId" = r."id" AND s."expiresAt" > CURRENT_TIMESTAMP
        )
        OR EXISTS (
          SELECT 1 FROM "PlayRunQuestion" rq
          JOIN "PlayRun" run ON run."id" = rq."runId"
          WHERE rq."revisionId" = r."id"
            AND run."status" = 'ACTIVE' AND run."expiresAt" > CURRENT_TIMESTAMP
        )
        OR EXISTS (
          SELECT 1 FROM "WeeklyQuestion" wq
          JOIN "WeeklyChallenge" wc ON wc."id" = wq."challengeId"
          WHERE wq."revisionId" = r."id"
            AND wc."status" IN ('SUBMITTED','SCHEDULED')
            AND wc."weekEnd" > CURRENT_TIMESTAMP
        )
        OR EXISTS (
          SELECT 1 FROM "WeeklyQuestionLocalization" wql
          JOIN "WeeklyChallenge" wc ON wc."id" = wql."challengeId"
          WHERE wql."revisionId" = r."id"
            AND wc."status" IN ('SUBMITTED','SCHEDULED')
            AND wc."weekEnd" > CURRENT_TIMESTAMP
        )
      )
  `;
  return rows.map(row => row.id);
}

async function mediaUsage(id: string, ownerId: string) {
  const matches = await db().$queryRaw<Array<{
    quizId: string; title: string; version: number; isCurrent: boolean; publication: string;
    inPrompt: boolean; cluePositions: number[];
  }>>`
    SELECT r."quizId" AS "quizId", r."title", r."version",
      (l."status" = 'PUBLISHED' AND l."publishedVersion" = r."version") AS "isCurrent", q."publication",
      (r."promptMediaIds" @> ${JSON.stringify([id])}::jsonb) AS "inPrompt",
      ARRAY(
        SELECT ord::integer
        FROM jsonb_array_elements(r."clues") WITH ORDINALITY AS element(clue,ord)
        WHERE element.clue ->> 'mediaId' = ${id}
      ) AS "cluePositions"
    FROM "QuizRevision" r JOIN "Quiz" q ON q."id" = r."quizId"
    JOIN "QuizLocalization" l ON l."id"=r."localizationId"
    WHERE q."authorId" = ${ownerId}
      AND (r."promptMediaIds" @> ${JSON.stringify([id])}::jsonb
        OR r."clues" @> ${JSON.stringify([{ mediaId: id }])}::jsonb)
    ORDER BY "isCurrent" DESC, r."version" DESC
    LIMIT 51
  `;
  return { items: matches.slice(0,50), hasMore: matches.length > 50 };
}

async function thumbnailFor(item: any): Promise<string | undefined> {
  if (item.status !== "READY" || item.kind !== "image") return undefined;
  const key = `assets/${item.id}/thumbnail.webp`;
  try {
    if (!(await objectExists(key))) {
      // The owner is authorized before we read the private original.
      // Generate at most a 320x240 WebP, store in a private immutable R2 key.
      const original = await readObject(item.storageKey, LIMITS.image);
      const thumb = await sharp(original, { limitInputPixels: 30000000, failOn: "error" })
        .rotate().resize({ width: 320, height: 240, fit: "inside", withoutEnlargement: true })
        .webp({ quality: 70 }).toBuffer();
      await putObject(key, thumb, "image/webp");
    }
    return await previewUrl(key, "image/webp");
  } catch (error) {
    // Legacy or malformed image should not block the owner's detail page.
    console.warn("Owner thumbnail failed; falling back to original", item.id, error);
    return undefined;
  }
}
export async function mediaList(p: Record<string, any>, actor: Actor | null) {
  const user = requireActor(actor);
  const where: Record<string, any> = { ownerId: user.id, deletedAt: null };
  if (p.kind && p.kind !== "all") where.kind = p.kind;
  if (p.moderation && p.moderation !== "all") where.moderationStatus = p.moderation;
  if (p.status && p.status !== "all") where.status = p.status;
  if (p.search?.trim()) where.OR = [
    { originalName: { contains: p.search.trim(), mode: "insensitive" } },
    { alt: { contains: p.search.trim(), mode: "insensitive" } },
    { attribution: { contains: p.search.trim(), mode: "insensitive" } },
  ];
  if (p.usage === "used" || p.usage === "unused") {
    const ids = await protectedMediaIds(user.id);
    // An empty list must not accidentally turn the "used" filter into all results.
    where.id = p.usage === "used" ? { in: ids } : { notIn: ids };
  }
  const orderBy: any[] = p.sort === "oldest" ? [{ createdAt: "asc" },{ id: "asc" }]
    : p.sort === "name" ? [{ originalName: "asc" },{ id: "asc" }]
    : p.sort === "size" ? [{ sizeBytes: "desc" },{ id: "asc" }]
    : [{ createdAt: "desc" },{ id: "desc" }];
  const [rows,total] = await Promise.all([
    db().mediaAsset.findMany({ where, orderBy, skip: p.offset, take: p.limit }),
    db().mediaAsset.count({ where }),
  ]);
  return { items: rows.map(mediaSummary), offset: p.offset, limit: p.limit,
    total, hasMore: p.offset + rows.length < total };
}
export async function mediaGet(p: Record<string, any>, actor: Actor | null) {
  const item = await asset(p.id, actor);
  const user = requireActor(actor);
  if (p.purpose === "thumbnail") {
    if (item.kind !== "image" || item.status !== "READY") return { id: item.id };
    return { id: item.id,
      thumbnailUrl: (await thumbnailFor(item)) || (await previewUrl(item.storageKey, item.mimeType)),
      previewExpiresInSeconds: 60,
    };
  }
  const [usage, thumbnailUrl] = await Promise.all([
    mediaUsage(item.id,user.id), thumbnailFor(item),
  ]);
  return { ...mediaSummary(item), usage,
    ...(item.status === "READY" ? {
      previewUrl: await previewUrl(item.storageKey, item.mimeType), previewExpiresInSeconds: 60,
      ...(thumbnailUrl ? { thumbnailUrl } : {}),
    } : {}),
  };
}
export async function mediaUpdate(p: Record<string, any>, actor: Actor | null) {
  const old = await asset(p.id, actor);
  if (old.status === "DELETED") fail(409, "media_deleted", "Media was deleted");
  const changes = safeMetadata(p);
  if (old.moderationStatus === "APPROVED" && (await publishedCurrentQuizzes(old.id)).length)
    fail(409, "media_in_use", "Published quizzes use this asset; create and review a replacement first");
  if (!Object.keys(changes).length) fail(400, "nothing_to_update", "Specify metadata to change");
  const item = await db().mediaAsset.update({ where: { id: old.id }, data: {
    ...changes, moderationStatus: old.moderationStatus === "RESTRICTED" ? "RESTRICTED" : "PENDING",
  } });
  return mediaSummary(item);
}
async function publishedCurrentQuizzes(id: string): Promise<string[]> {
  const rows = await db().$queryRaw<Array<{ id: string }>>`
    SELECT q."id" FROM "Quiz" q
    JOIN "QuizRevision" r ON r."quizId"=q."id" AND r."version"=q."currentVersion" JOIN "QuizLocalization" l ON l."id"=r."localizationId" AND l."locale"=q."sourceLocale"
    WHERE q."publication"='PUBLISHED'
      AND (r."promptMediaIds" @> ${JSON.stringify([id])}::jsonb
        OR r."clues" @> ${JSON.stringify([{ mediaId: id }])}::jsonb)
  `;
  return rows.map(r => r.id);
}
export async function mediaDelete(p: Record<string, any>, actor: Actor | null) {
  const user = requireActor(actor);
  if (p.confirm !== true) fail(400, "confirmation_required", "Confirm deletion");
  // Serializable transaction rechecks play/weekly/current references immediately
  // before the soft-delete and records who deleted the binary asset and when.
  // Historical quiz revisions are not edited, and the MediaAsset tombstone remains.
  const old = await db().$transaction(async tx => {
    const item = await tx.mediaAsset.findFirst({where:{
      id:p.id,ownerId:user.id,deletedAt:null,
    }});
    if(!item) fail(404,"media_not_found","Media asset not found");
    if((await protectedMediaIds(user.id,tx)).includes(item.id))
      fail(409,"media_in_use","Media is required by a current quiz, unexpired play or scheduled challenge");
    if(await tx.mediaAsset.count({where:{parentId:item.id,deletedAt:null}}))
      fail(409,"media_in_use","Delete derived assets first");
    const deletedAt=new Date();
    const updated=await tx.mediaAsset.updateMany({where:{
      id:item.id,ownerId:user.id,deletedAt:null,
    },data:{status:"DELETED",deletedAt}});
    if(updated.count!==1) fail(409,"media_conflict","Media changed during deletion");
    await tx.auditLog.create({data:{
      actorId:user.id,action:"media.delete",objectId:item.id,
      detail:{deletedAt:deletedAt.toISOString(),kind:item.kind,
        previouslyReferencedRevisionsRetained:true},
    }});
    return item;
  },{isolationLevel:"Serializable"});
  // Retention safety does not depend on R2 cleanup succeeding. Soft deletion
  // invalidates every signed URL request through QuizDip immediately; R2
  // cleanup failures are logged and may be retried separately.
  try {
    await deleteObject(old.storageKey);
    if (old.kind === "image") await deleteObject(`assets/${old.id}/thumbnail.webp`);
    if (old.uploadKey) await deleteObject(old.uploadKey);
  } catch (error) {
    console.error("Media object cleanup failed", error);
  }
  return { id: old.id, deleted: true };
}

export async function mediaTransform(p: Record<string, any>, actor: Actor | null) {
  const user = requireActor(actor);
  const origin = await asset(p.id, actor);
  if (origin.status !== "READY" || origin.kind !== "image" || origin.moderationStatus === "RESTRICTED")
    fail(409, "not_transformable", "Ready unrestricted images only");
  await dailyLimit(user.id);
  const bytes = await readObject(origin.storageKey, LIMITS.image);
  const photo = sharp(bytes, { limitInputPixels: 30000000, failOn: "error" });
  const dimensions = await photo.metadata();
  if (!dimensions.width || !dimensions.height) fail(415, "invalid_image", "Image dimensions are unavailable");
  if (p.crop && (p.crop.left+p.crop.width > dimensions.width || p.crop.top+p.crop.height > dimensions.height))
    fail(400, "invalid_crop", "Crop is outside image bounds");
  let result = sharp(bytes, { limitInputPixels: 30000000, failOn: "error" }).rotate();
  if (p.crop) result = result.extract(p.crop);
  if (p.resizeWidth) result = result.resize({ width: p.resizeWidth, withoutEnlargement: true });
  if (p.blur) result = result.blur(p.blur);
  const transformed = await result.webp({ quality: 82 }).toBuffer();
  checkSize("image", transformed.length);
  const id = randomUUID(); const storageKey = `assets/${id}/original`;
  await putObject(storageKey, transformed, "image/webp");
  try {
    const item = await db().mediaAsset.create({ data: {
      id, ownerId: user.id, kind: "image", mimeType: "image/webp",
      originalName: "clue-image.webp", sizeBytes: transformed.length,
      sha256: createHash("sha256").update(transformed).digest("hex"),
      storageKey, status: "READY", parentId: origin.id,
      alt: origin.alt, attribution: origin.attribution, license: origin.license,
    } });
    return mediaSummary(item);
  } catch (error) {
    await deleteObject(storageKey).catch(() => undefined);
    throw error;
  }
}
export async function mediaReview(p: Record<string, any>, actor: Actor | null) {
  const user = requireActor(actor);
  if (user.role !== "ADMIN") fail(403, "admin_required", "Trusted admin permission required");
  const item = await db().mediaAsset.findUnique({ where: { id: p.id } });
  if (!item || item.deletedAt || item.status !== "READY")
    fail(404, "media_not_found", "Ready media asset not found");
  const affected = p.verdict === "RESTRICTED" ? await publishedCurrentQuizzes(item.id) : [];
  const updated = await db().$transaction(async tx => {
    const changed = await tx.mediaAsset.update({ where: { id: item.id }, data: { moderationStatus: p.verdict } });
    if (affected.length) await tx.quiz.updateMany({
      where: { id: { in: affected } },
      data: { safetyStatus: "RESTRICTED", kidsEligible: false },
    });
    await tx.auditLog.create({ data: {
      actorId: user.id, action: "media.review", objectId: item.id,
      detail: { verdict: p.verdict, reason: p.reason, restrictedQuizIds: affected },
    } });
    return changed;
  });
  return { id: updated.id, moderationStatus: updated.moderationStatus, restrictedQuizCount: affected.length };
}
export async function validateMediaReferences(
  ownerId: string, promptMediaIds: string[], clues: Array<Record<string, any>>,
  requireApproved = false,
) {
  const expected = new Map<string,string>();
  for (const id of promptMediaIds) expected.set(id, "any");
  for (const clue of clues) if (clue.mediaId) {
    const existing = expected.get(clue.mediaId);
    const mediaKind = clue.type === "image-reveal" ? "image" : clue.type;
    if (existing && existing !== "any" && existing !== mediaKind)
      fail(422, "media_type_conflict", "One asset cannot serve clues of incompatible types");
    expected.set(clue.mediaId, mediaKind);
  }
  if (!expected.size) return;
  const media = await db().mediaAsset.findMany({ where: {
    id: { in: [...expected.keys()] }, ownerId, status: "READY", deletedAt: null,
  } });
  if (media.length !== expected.size)
    fail(422, "invalid_media", "A media reference is not ready or not owned by this author");
  for (const item of media) {
    if (expected.get(item.id) !== "any" && item.kind !== expected.get(item.id))
      fail(422, "invalid_media_type", "Referenced asset type does not match clue type");
    if (item.moderationStatus === "RESTRICTED")
      fail(403, "media_restricted", "A media asset is restricted by moderation");
    if (requireApproved && item.moderationStatus !== "APPROVED")
      fail(409, "media_review_pending", "Media must be reviewed before public exposure");
  }
}

export async function signedPlayMedia(p: Record<string, any>, actor: Actor | null) {
  const { getPlaySession } = await import("./play");
  const session = await getPlaySession(p, actor);
  const promptMediaIds = session.revision.promptMediaIds as string[];
  const visibleClues = (session.revision.clues as Array<Record<string, any>>).slice(0, session.usedClues);
  if (!promptMediaIds.includes(p.mediaId) && !visibleClues.some(c => c.mediaId === p.mediaId))
    fail(403, "clue_not_revealed", "This media is not an already revealed clue");
  const media = await db().mediaAsset.findUnique({ where: { id: p.mediaId } });
  if (!media || media.status !== "READY" || media.deletedAt || media.moderationStatus !== "APPROVED")
    fail(404, "media_unavailable", "Media is not approved for playback");
  return { mediaId: media.id, url: await previewUrl(media.storageKey, media.mimeType), expiresInSeconds: 60,
    kind: media.kind, mimeType: media.mimeType };
}

/** Private reviewer access, distinct from owner-only edit/delete. */
export async function mediaReviewGet(p:Record<string,any>,actor:Actor|null) {
  const user=requireActor(actor);
  if(user.role!=="ADMIN") fail(403,"admin_required","Only trusted moderators can view submitted media");
  const item=await db().mediaAsset.findUnique({where:{id:p.id}});
  if(!item || item.deletedAt || item.status!=="READY")
    fail(404,"media_not_found","Media is unavailable");
  return {...mediaSummary(item),previewUrl:await previewUrl(item.storageKey,item.mimeType),
    previewExpiresInSeconds:60};
}
