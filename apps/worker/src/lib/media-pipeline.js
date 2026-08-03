/**
 * Media pipeline (#56) — tenant upload limits, async AV scan, thumbnail metadata.
 */

import { attachmentUrlToR2Key } from "./attachment-storage.js";
import { logError, logInfo } from "./worker-log.js";

export const DEFAULT_MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
export const DEFAULT_MAX_ATTACHMENTS = 10;
export const DEFAULT_ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "application/pdf",
  "text/plain",
  "text/markdown",
  "application/json",
  "application/zip",
  "audio/webm",
  "audio/mpeg",
  "audio/mp3",
  "audio/wav",
  "video/mp4",
  "video/webm",
];

export const EICAR_TEST_STRING =
  "X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*";

function generateId(prefix) {
  return `${prefix}_${Array.from(crypto.getRandomValues(new Uint8Array(8)))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")}`;
}

function parseMimeList(raw) {
  if (!raw) return [...DEFAULT_ALLOWED_MIME_TYPES];
  try {
    const parsed = JSON.parse(String(raw));
    return Array.isArray(parsed) ? parsed.filter((v) => typeof v === "string") : [...DEFAULT_ALLOWED_MIME_TYPES];
  } catch {
    return [...DEFAULT_ALLOWED_MIME_TYPES];
  }
}

export function mapMediaSettingsRow(row) {
  if (!row) {
    return {
      projectId: null,
      maxFileSizeBytes: DEFAULT_MAX_FILE_SIZE_BYTES,
      maxAttachmentsPerMessage: DEFAULT_MAX_ATTACHMENTS,
      allowedMimeTypes: [...DEFAULT_ALLOWED_MIME_TYPES],
      avScanEnabled: true,
      thumbnailEnabled: true,
      updatedAt: null,
    };
  }
  return {
    projectId: row.project_id,
    maxFileSizeBytes: Number(row.max_file_size_bytes) || DEFAULT_MAX_FILE_SIZE_BYTES,
    maxAttachmentsPerMessage: Number(row.max_attachments_per_message) || DEFAULT_MAX_ATTACHMENTS,
    allowedMimeTypes: parseMimeList(row.allowed_mime_types_json),
    avScanEnabled: row.av_scan_enabled === 1,
    thumbnailEnabled: row.thumbnail_enabled === 1,
    updatedAt: row.updated_at,
  };
}

export async function getProjectMediaSettings(env, projectId) {
  const row = await env.DB.prepare("SELECT * FROM project_media_settings WHERE project_id = ?")
    .bind(projectId)
    .first();
  const settings = mapMediaSettingsRow(row);
  settings.projectId = projectId;
  return settings;
}

export async function upsertProjectMediaSettings(env, projectId, input) {
  const current = await getProjectMediaSettings(env, projectId);
  const maxFileSizeBytes = Math.min(
    Math.max(Number(input.maxFileSizeBytes ?? current.maxFileSizeBytes) || DEFAULT_MAX_FILE_SIZE_BYTES, 1024),
    100 * 1024 * 1024,
  );
  const maxAttachmentsPerMessage = Math.min(
    Math.max(Number(input.maxAttachmentsPerMessage ?? current.maxAttachmentsPerMessage) || DEFAULT_MAX_ATTACHMENTS, 1),
    20,
  );
  const allowedMimeTypes = Array.isArray(input.allowedMimeTypes)
    ? input.allowedMimeTypes.filter((v) => typeof v === "string" && v.includes("/"))
    : current.allowedMimeTypes;
  const avScanEnabled = input.avScanEnabled !== undefined ? (input.avScanEnabled ? 1 : 0) : (current.avScanEnabled ? 1 : 0);
  const thumbnailEnabled =
    input.thumbnailEnabled !== undefined ? (input.thumbnailEnabled ? 1 : 0) : (current.thumbnailEnabled ? 1 : 0);
  const now = new Date().toISOString();

  await env.DB.prepare(
    `INSERT INTO project_media_settings
     (project_id, max_file_size_bytes, max_attachments_per_message, allowed_mime_types_json,
      av_scan_enabled, thumbnail_enabled, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(project_id) DO UPDATE SET
       max_file_size_bytes = excluded.max_file_size_bytes,
       max_attachments_per_message = excluded.max_attachments_per_message,
       allowed_mime_types_json = excluded.allowed_mime_types_json,
       av_scan_enabled = excluded.av_scan_enabled,
       thumbnail_enabled = excluded.thumbnail_enabled,
       updated_at = excluded.updated_at`,
  )
    .bind(
      projectId,
      maxFileSizeBytes,
      maxAttachmentsPerMessage,
      JSON.stringify(allowedMimeTypes),
      avScanEnabled,
      thumbnailEnabled,
      now,
    )
    .run();

  return { ok: true, settings: await getProjectMediaSettings(env, projectId) };
}

export function validateMediaUpload(settings, { contentType, sizeBytes, fileBytes }) {
  if (!contentType || typeof contentType !== "string") {
    return { valid: false, error: "content_type_required" };
  }
  const size = Number(sizeBytes) || 0;
  if (size <= 0) return { valid: false, error: "empty_file" };
  if (size > settings.maxFileSizeBytes) {
    return {
      valid: false,
      error: "file_too_large",
      limitBytes: settings.maxFileSizeBytes,
    };
  }
  if (!settings.allowedMimeTypes.includes(contentType)) {
    return { valid: false, error: "mime_type_not_allowed", contentType };
  }
  if (fileBytes && settings.avScanEnabled && containsEicarSignature(fileBytes)) {
    return { valid: false, error: "malware_detected", detail: "eicar_test_signature" };
  }
  return { valid: true, sizeBytes: size };
}

export function containsEicarSignature(fileBytes) {
  try {
    const text = new TextDecoder().decode(fileBytes.slice(0, 512));
    return text.includes(EICAR_TEST_STRING);
  } catch {
    return false;
  }
}

export async function scanBytesWithClamAv(env, fileBytes) {
  if (containsEicarSignature(fileBytes)) {
    return { ok: true, status: "infected", detail: "eicar_test_signature" };
  }

  const clamUrl = env.CLAMAV_HTTP_URL?.trim();
  if (!clamUrl) {
    return { ok: true, status: "clean", detail: "scan_skipped_no_clamav" };
  }

  try {
    const res = await fetch(clamUrl.replace(/\/$/, "") + "/scan", {
      method: "POST",
      headers: {
        "Content-Type": "application/octet-stream",
        ...(env.CLAMAV_HTTP_TOKEN ? { Authorization: `Bearer ${env.CLAMAV_HTTP_TOKEN}` } : {}),
      },
      body: fileBytes,
    });
    if (!res.ok) {
      return { ok: false, status: "failed", detail: `clamav_http_${res.status}` };
    }
    const json = await res.json().catch(() => ({}));
    if (json.infected || json.status === "infected") {
      return { ok: true, status: "infected", detail: json.signature || json.threat || "detected" };
    }
    return { ok: true, status: "clean", detail: "clamav_clean" };
  } catch (err) {
    logError("media_pipeline.clamav_failed", err, {});
    return { ok: false, status: "failed", detail: err.message || "clamav_failed" };
  }
}

export function buildThumbnailKey(fileKey) {
  return `thumbnails/${fileKey}`;
}

export function buildPublicAttachmentUrl(origin, key) {
  return `${origin.replace(/\/$/, "")}/attachments/${key}`;
}

export async function generateThumbnail(env, { origin, fileKey, fileBytes, contentType }) {
  if (!contentType?.startsWith("image/")) {
    return { ok: true, status: "skipped", thumbnailUrl: null, detail: "not_an_image" };
  }
  if (!env.ATTACHMENTS) {
    return { ok: false, status: "failed", thumbnailUrl: null, detail: "attachments_not_bound" };
  }

  const thumbKey = buildThumbnailKey(fileKey);
  try {
    await env.ATTACHMENTS.put(thumbKey, fileBytes, {
      httpMetadata: { contentType },
      customMetadata: { sourceKey: fileKey, kind: "thumbnail_passthrough_mvp" },
    });
    return {
      ok: true,
      status: "ready",
      thumbnailUrl: buildPublicAttachmentUrl(origin, thumbKey),
      detail: "thumbnail_stored",
    };
  } catch (err) {
    logError("media_pipeline.thumbnail_failed", err, { fileKey });
    return { ok: false, status: "failed", thumbnailUrl: null, detail: err.message || "thumbnail_failed" };
  }
}

export async function createAttachmentMediaJob(env, { projectId, fileKey, contentType, sizeBytes }) {
  const id = generateId("media");
  const now = new Date().toISOString();
  await env.DB.prepare(
    `INSERT INTO attachment_media_jobs
     (id, project_id, file_key, scan_status, thumbnail_status, content_type, size_bytes, created_at)
     VALUES (?, ?, ?, 'pending', 'pending', ?, ?, ?)
     ON CONFLICT(project_id, file_key) DO UPDATE SET
       scan_status = 'pending',
       thumbnail_status = 'pending',
       content_type = excluded.content_type,
       size_bytes = excluded.size_bytes,
       created_at = excluded.created_at`,
  )
    .bind(id, projectId, fileKey, contentType, sizeBytes, now)
    .run();

  const row = await env.DB.prepare(
    "SELECT * FROM attachment_media_jobs WHERE project_id = ? AND file_key = ?",
  )
    .bind(projectId, fileKey)
    .first();
  return row;
}

export async function getAttachmentMediaJob(env, projectId, fileKey) {
  return env.DB.prepare("SELECT * FROM attachment_media_jobs WHERE project_id = ? AND file_key = ?")
    .bind(projectId, fileKey)
    .first();
}

export function mapMediaJobRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    projectId: row.project_id,
    fileKey: row.file_key,
    scanStatus: row.scan_status,
    scanDetail: row.scan_detail,
    thumbnailUrl: row.thumbnail_url,
    thumbnailStatus: row.thumbnail_status,
    contentType: row.content_type,
    sizeBytes: row.size_bytes,
    scannedAt: row.scanned_at,
    createdAt: row.created_at,
  };
}

export async function processAttachmentMediaJob(env, { projectId, fileKey, fileBytes, origin }) {
  const settings = await getProjectMediaSettings(env, projectId);
  const job = await getAttachmentMediaJob(env, projectId, fileKey);
  if (!job) return { ok: false, error: "job_not_found" };

  let scanStatus = "skipped";
  let scanDetail = "av_disabled";
  if (settings.avScanEnabled) {
    const scan = await scanBytesWithClamAv(env, fileBytes);
    scanStatus = scan.status;
    scanDetail = scan.detail;
  }

  let thumbnailStatus = "skipped";
  let thumbnailUrl = null;
  if (settings.thumbnailEnabled && scanStatus !== "infected") {
    const contentType = job.content_type || "application/octet-stream";
    const thumb = await generateThumbnail(env, { origin, fileKey, fileBytes, contentType });
    thumbnailStatus = thumb.status;
    thumbnailUrl = thumb.thumbnailUrl;
    if (thumb.detail) scanDetail = scanDetail || thumb.detail;
  }

  const now = new Date().toISOString();
  await env.DB.prepare(
    `UPDATE attachment_media_jobs
     SET scan_status = ?, scan_detail = ?, thumbnail_status = ?, thumbnail_url = ?, scanned_at = ?
     WHERE project_id = ? AND file_key = ?`,
  )
    .bind(scanStatus, scanDetail, thumbnailStatus, thumbnailUrl, now, projectId, fileKey)
    .run();

  if (scanStatus === "infected" && env.ATTACHMENTS) {
    await env.ATTACHMENTS.delete(fileKey).catch(() => {});
    const thumbKey = buildThumbnailKey(fileKey);
    await env.ATTACHMENTS.delete(thumbKey).catch(() => {});
  }

  logInfo("media_pipeline.processed", { projectId, fileKey, scanStatus, thumbnailStatus });

  return {
    ok: true,
    job: mapMediaJobRow(await getAttachmentMediaJob(env, projectId, fileKey)),
  };
}

export async function enqueueAttachmentMediaPipeline(env, { projectId, fileKey, contentType, sizeBytes, fileBytes, origin }) {
  await createAttachmentMediaJob(env, { projectId, fileKey, contentType, sizeBytes });
  return processAttachmentMediaJob(env, { projectId, fileKey, fileBytes, origin });
}

export async function assertAttachmentsMediaClean(env, projectId, attachments) {
  if (!Array.isArray(attachments) || !attachments.length) return { ok: true };
  for (const attachment of attachments) {
    const key = attachmentUrlToR2Key(attachment.url);
    if (!key) continue;
    const job = await getAttachmentMediaJob(env, projectId, key);
    if (!job) continue;
    if (job.scan_status === "infected") {
      return { ok: false, error: "attachment_quarantined", fileKey: key };
    }
    if (job.scan_status === "pending") {
      return { ok: false, error: "attachment_scan_pending", fileKey: key };
    }
  }
  return { ok: true };
}

export async function listRecentMediaJobs(env, projectId, limit = 50) {
  const rows = await env.DB.prepare(
    `SELECT * FROM attachment_media_jobs
     WHERE project_id = ?
     ORDER BY created_at DESC LIMIT ?`,
  )
    .bind(projectId, Math.min(Math.max(Number(limit) || 50, 1), 200))
    .all();
  return (rows.results || []).map(mapMediaJobRow);
}
