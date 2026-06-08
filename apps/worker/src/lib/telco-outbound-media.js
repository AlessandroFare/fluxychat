/**
 * Resolve FluxyChat message attachments for Sent.dm template media variables (P13-T3).
 * Sent.dm maps `media_url` (and related params) to MMS / WhatsApp media template slots.
 */

const IMAGE_KINDS = new Set(["image", "photo", "picture"]);
const VIDEO_KINDS = new Set(["video"]);
const DOCUMENT_KINDS = new Set(["file", "document", "pdf", "voice"]);

/**
 * @param {*} env
 */
export function isTelcoOutboundMediaEnabled(env) {
  if (env.OFFLINE_SMS_MEDIA_ENABLED === "false" || env.OFFLINE_SMS_MEDIA_ENABLED === "0") {
    return false;
  }
  return true;
}

/**
 * @param {*} env
 * @param {string} rawUrl
 * @returns {string | null}
 */
export function resolvePublicAttachmentUrl(env, rawUrl) {
  const url = String(rawUrl || "").trim();
  if (!url) return null;
  if (url.startsWith("https://") || url.startsWith("http://")) return url;
  if (url.startsWith("/attachments/")) {
    const base = env.PUBLIC_APP_URL?.trim() || env.WORKER_PUBLIC_URL?.trim();
    if (!base) return null;
    return `${String(base).replace(/\/$/, "")}${url}`;
  }
  return null;
}

/**
 * @param {{ kind?: string, contentType?: string, content_type?: string }} attachment
 * @returns {"image" | "video" | "document"}
 */
export function inferTelcoMediaType(attachment) {
  const kind = String(attachment.kind || "").toLowerCase();
  const ct = String(attachment.contentType || attachment.content_type || "").toLowerCase();
  if (IMAGE_KINDS.has(kind) || ct.startsWith("image/")) return "image";
  if (VIDEO_KINDS.has(kind) || ct.startsWith("video/")) return "video";
  if (DOCUMENT_KINDS.has(kind) || ct.startsWith("application/pdf")) return "document";
  if (ct.startsWith("audio/")) return "document";
  return "document";
}

/**
 * Prefer image, then video, then any attachment with a public URL.
 * @param {Array<{ kind?: string, url?: string, name?: string, contentType?: string, content_type?: string }>} attachments
 * @param {*} env
 */
export function pickTelcoMediaAttachment(env, attachments) {
  if (!Array.isArray(attachments) || !attachments.length) return null;

  const withUrl = attachments.filter((a) => a?.url && resolvePublicAttachmentUrl(env, a.url));
  if (!withUrl.length) return null;

  const image = withUrl.find((a) => inferTelcoMediaType(a) === "image");
  if (image) return image;
  const video = withUrl.find((a) => inferTelcoMediaType(a) === "video");
  if (video) return video;
  return withUrl[0];
}

/**
 * @param {*} env
 * @param {{ kind?: string, url?: string, name?: string, contentType?: string, content_type?: string }} attachment
 * @returns {Record<string, string>}
 */
export function buildTelcoMediaTemplateParams(env, attachment) {
  const publicUrl = resolvePublicAttachmentUrl(env, attachment.url);
  if (!publicUrl) return {};

  const mediaType = inferTelcoMediaType(attachment);
  const name =
    String(attachment.name || attachment.url?.split("/").pop() || "attachment").slice(0, 120) ||
    "attachment";

  return {
    media_url: publicUrl,
    media_name: name,
    media_type: mediaType,
    has_media: "true",
  };
}

/**
 * @param {*} env
 * @param {{ projectId: string, roomId: string, messageId: number }} opts
 */
export async function loadMessageAttachmentsForTelco(env, opts) {
  const { projectId, roomId, messageId } = opts;
  const res = await env.DB.prepare(
    `SELECT kind, url, name, size_bytes, content_type
     FROM attachments
     WHERE project_id = ? AND room_id = ? AND message_id = ?
     ORDER BY created_at ASC`,
  )
    .bind(projectId, roomId, messageId)
    .all();

  return (res.results || []).map((row) => ({
    kind: row.kind,
    url: row.url,
    name: row.name,
    sizeBytes: row.size_bytes,
    contentType: row.content_type,
  }));
}

/**
 * @param {*} env
 * @param {{
 *   projectId: string,
 *   roomId: string,
 *   messageId: number,
 *   content?: string,
 *   attachments?: Array<{ kind?: string, url?: string, name?: string, contentType?: string }>,
 * }} detail
 * @returns {Promise<Record<string, string>>}
 */
export async function resolveTelcoMediaTemplateParams(env, detail) {
  if (!isTelcoOutboundMediaEnabled(env)) return {};

  let attachments = detail.attachments;
  if (!Array.isArray(attachments) || !attachments.length) {
    attachments = await loadMessageAttachmentsForTelco(env, {
      projectId: detail.projectId,
      roomId: detail.roomId,
      messageId: detail.messageId,
    });
  }

  const picked = pickTelcoMediaAttachment(env, attachments);
  if (!picked) return {};

  return buildTelcoMediaTemplateParams(env, picked);
}

/**
 * @param {string} content
 * @param {Record<string, string>} mediaParams
 */
export function formatTelcoMessagePreview(content, mediaParams) {
  const text = String(content).replace(/\s+/g, " ").trim();
  if (text) return text.slice(0, 80);
  if (mediaParams.has_media === "true") {
    const type = mediaParams.media_type || "attachment";
    if (type === "image") return "Photo";
    if (type === "video") return "Video";
    return "Attachment";
  }
  return "New message";
}
