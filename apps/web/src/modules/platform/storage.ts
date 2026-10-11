import { createHash } from "node:crypto";
import { lookup } from "node:dns/promises";
import { request as httpsRequest } from "node:https";
import { isIP } from "node:net";
import {
  S3Client, PutObjectCommand, GetObjectCommand, CopyObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { fileTypeFromBuffer } from "file-type";
import { fail } from "./auth";

export const LIMITS: Record<string, number> = {
  image: 12 * 1024 * 1024,
  audio: 25 * 1024 * 1024,
  video: 64 * 1024 * 1024,
};
export const MIME_KIND: Record<string, "image" | "audio" | "video"> = {
  "image/jpeg": "image", "image/png": "image", "image/webp": "image",
  "audio/mpeg": "audio", "audio/wav": "audio", "audio/ogg": "audio",
  "video/mp4": "video", "video/webm": "video",
};

let cachedClient: S3Client | undefined;
function config() {
  const { R2_ENDPOINT, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET } = process.env;
  if (!R2_ENDPOINT || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET)
    return fail(503, "media_unconfigured", "Private Cloudflare R2 storage is not configured");
  const endpoint = new URL(R2_ENDPOINT);
  if (endpoint.protocol !== "https:" || endpoint.username || endpoint.password)
    return fail(503, "media_unconfigured", "R2 endpoint must use HTTPS");
  return { endpoint: endpoint.href, accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY, bucket: R2_BUCKET };
}
export function bucket() { return config().bucket; }
export function client() {
  const opts = config();
  cachedClient ??= new S3Client({
    region: "auto", endpoint: opts.endpoint,
    credentials: { accessKeyId: opts.accessKeyId, secretAccessKey: opts.secretAccessKey },
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
  });
  return cachedClient;
}
export async function uploadTicket(key: string, mimeType: string, digestHex: string) {
  const digest = Buffer.from(digestHex, "hex").toString("base64");
  const url = await getSignedUrl(client(), new PutObjectCommand({
    Bucket: bucket(), Key: key, ContentType: mimeType, ChecksumSHA256: digest,
  }), { expiresIn: 300 });
  return { url, method: "PUT", headers: { "Content-Type": mimeType, "x-amz-checksum-sha256": digest }, expiresInSeconds: 300 };
}
export async function previewUrl(key: string, mime: string, filename?: string) {
  return getSignedUrl(client(), new GetObjectCommand({
    Bucket: bucket(), Key: key, ResponseContentType: mime,
    ResponseContentDisposition: filename ? `inline; filename="media"` : "inline",
  }), { expiresIn: 60 });
}
export async function putObject(key: string, bytes: Buffer, mimeType: string) {
  await client().send(new PutObjectCommand({
    Bucket: bucket(), Key: key, Body: bytes, ContentType: mimeType,
    ChecksumSHA256: createHash("sha256").update(bytes).digest("base64"),
  }));
}
export async function copyVerified(from: string, to: string, mimeType: string) {
  await client().send(new CopyObjectCommand({
    Bucket: bucket(), Key: to,
    CopySource: encodeURIComponent(bucket()) + "/" + from.split("/").map(encodeURIComponent).join("/"),
    ContentType: mimeType, MetadataDirective: "REPLACE",
  }));
}
export async function deleteObject(key: string) {
  await client().send(new DeleteObjectCommand({ Bucket: bucket(), Key: key }));
}

export async function readObject(key: string, max: number): Promise<Buffer> {
  let output;
  try {
    output = await client().send(new GetObjectCommand({ Bucket: bucket(), Key: key }));
  } catch {
    return fail(409, "upload_missing", "The uploaded object is not available");
  }
  if (output.ContentLength && output.ContentLength > max) fail(413, "media_too_large", "File exceeds the media size limit");
  if (!output.Body) fail(409, "upload_missing", "The uploaded object is empty");
  const chunks: Buffer[] = [];
  let length = 0;
  try {
    for await (const piece of output.Body as AsyncIterable<Uint8Array>) {
      length += piece.byteLength;
      if (length > max) fail(413, "media_too_large", "File exceeds the media size limit");
      chunks.push(Buffer.from(piece));
    }
  } catch (error) {
    if ((error as any)?.code === "media_too_large") throw error;
    return fail(409, "upload_unreadable", "Uploaded object could not be read");
  }
  return Buffer.concat(chunks, length);
}
export const CHUNK_SIZE = 512 * 1024;
export function partKey(uploadKey: string, index: number) {
  return uploadKey + "/parts/" + String(index).padStart(3, "0");
}
export async function readChunks(uploadKey: string, count: number, max: number): Promise<Buffer> {
  const pieces: Buffer[] = [];
  let total = 0;
  for (let i = 0; i < count; i++) {
    const bytes = await readObject(partKey(uploadKey, i), CHUNK_SIZE);
    if (!bytes.length || bytes.length > CHUNK_SIZE)
      fail(422, "invalid_chunk", "Media chunk is empty or too large");
    total += bytes.length;
    if (total > max) fail(413, "media_too_large", "Combined media exceeds allowed size");
    pieces.push(bytes);
  }
  return Buffer.concat(pieces, total);
}
export function checkSize(kind: string, size: number) {
  if (!LIMITS[kind] || !Number.isSafeInteger(size) || size <= 0 || size > LIMITS[kind])
    fail(413, "media_too_large", "File exceeds the per-type size limit");
}
export function sniff(bytes: Buffer, declaredKind: string, declaredMime?: string) {
  return sniffAsync(bytes, declaredKind, declaredMime);
}
async function sniffAsync(bytes: Buffer, declaredKind: string, declaredMime?: string): Promise<string> {
  const detected = await fileTypeFromBuffer(bytes);
  const mime = detected?.mime;
  // Audio OGG is distinguishable from video OGG only with deeper container inspection.
  // Limit support to audio-only ogg and reject uncertain media until transcoded.
  if (!mime || MIME_KIND[mime] !== declaredKind)
    fail(415, "unsupported_media", "Content does not match an allowed media format");
  if (declaredMime && declaredMime !== mime)
    fail(415, "media_mismatch", "Declared and detected MIME types differ");
  return mime;
}

function blockedIp(ip: string): boolean {
  if (isIP(ip) === 4) {
    const [a,b] = ip.split(".").map(Number);
    return a===0 || a===10 || a===127 || a>=224 || (a===100 && b>=64 && b<=127) ||
      (a===169 && b===254) || (a===172 && b>=16 && b<=31) ||
      (a===192 && (b===168 || b===0 || b===2)) || (a===198 && (b===18 || b===19 || b===51)) ||
      (a===203 && b===0) || (a===192 && b===88);
  }
  if (isIP(ip) === 6) {
    const lower = ip.toLowerCase();
    if (lower==="::1" || lower==="::" || lower.startsWith("fc") || lower.startsWith("fd") ||
      lower.startsWith("fe") || lower.startsWith("ff") || lower.startsWith("2001:db8") ||
      lower.startsWith("::ffff:")) return true;
    // Only globally routable addresses; conservatively reject unknown 2001 ranges.
    return !/^[23][0-9a-f]{0,3}:/.test(lower);
  }
  return true;
}

/** Explicit host allowlist, DNS pinned to a checked public IP, TLS verified, no redirects. */
export async function importExternal(input: string, limit: number): Promise<{ bytes: Buffer; mime: string }> {
  const url = new URL(input);
  const allowed = (process.env.MEDIA_IMPORT_HOSTS || "").split(",").map(v => v.trim().toLowerCase()).filter(Boolean);
  if (url.protocol !== "https:" || !allowed.includes(url.hostname.toLowerCase()) ||
    url.username || url.password || (url.port && url.port !== "443") || isIP(url.hostname))
    fail(403, "import_forbidden", "HTTPS source hostname is not on the import allowlist");
  const addresses = await lookup(url.hostname, { all: true });
  if (!addresses.length || addresses.some(a => blockedIp(a.address)))
    fail(403, "import_forbidden", "Import source resolves to a non-public address");
  const chosen = addresses[0];
  return await new Promise((resolve,reject) => {
    const req = httpsRequest(url, {
      method: "GET", timeout: 20000,
      lookup: (_host, _opts, cb) => cb(null, chosen.address, chosen.family),
      headers: { "accept": "image/*, audio/*, video/*", "user-agent": "Clupio-MediaImport/1.0" },
    }, async res => {
      if (res.statusCode !== 200 || (res.headers.location)) {
        res.resume(); reject(new Error("Source returned an unsupported response or redirect")); return;
      }
      const declaredSize = Number(res.headers["content-length"] || 0);
      if (declaredSize > limit) { res.destroy(); reject(new Error("Import is too large")); return; }
      const chunks: Buffer[] = []; let size = 0;
      try {
        for await (const chunk of res) {
          size += chunk.length;
          if (size > limit) throw new Error("Import is too large");
          chunks.push(Buffer.from(chunk));
        }
        resolve({ bytes: Buffer.concat(chunks), mime: String(res.headers["content-type"] || "").split(";")[0].trim() });
      } catch (err) { res.destroy(); reject(err); }
    });
    req.on("timeout", () => req.destroy(new Error("Import timed out")));
    req.on("error", reject); req.end();
  });
}
