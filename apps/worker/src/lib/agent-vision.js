import { attachmentUrlToR2Key } from "./attachment-storage.js";

const MAX_VISION_IMAGES = 4;
const MAX_IMAGE_BYTES = 4 * 1024 * 1024;

function isImageAttachment(att) {
  if (!att || typeof att !== "object") return false;
  const kind = String(att.kind || "").toLowerCase();
  const mime = String(att.contentType || att.content_type || "").toLowerCase();
  return kind === "image" || mime.startsWith("image/");
}

function bytesToBase64(bytes) {
  const chunk = 0x8000;
  let binary = "";
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

export async function attachmentToDataUrl(env, attachment, projectId) {
  if (!env?.ATTACHMENTS || !isImageAttachment(attachment)) return null;
  const key = attachmentUrlToR2Key(attachment.url);
  if (!key) return null;
  const prefix = String(key.split("/")[0] || "");
  if (prefix !== projectId && prefix !== "ai-images" && prefix !== "voice") return null;
  if (prefix === "ai-images" && key.split("/")[1] !== projectId) return null;

  try {
    const object = await env.ATTACHMENTS.get(key);
    if (!object) return null;
    const buf = await object.arrayBuffer();
    if (!buf || buf.byteLength === 0 || buf.byteLength > MAX_IMAGE_BYTES) return null;
    const mime =
      attachment.contentType ||
      attachment.content_type ||
      object.httpMetadata?.contentType ||
      "image/png";
    if (!String(mime).startsWith("image/")) return null;
    const b64 = bytesToBase64(new Uint8Array(buf));
    return `data:${mime};base64,${b64}`;
  } catch {
    return null;
  }
}

export async function imagePartsFromAttachments(env, attachments, projectId) {
  const parts = [];
  for (const att of attachments || []) {
    if (parts.length >= MAX_VISION_IMAGES) break;
    if (!isImageAttachment(att)) continue;
    const dataUrl = await attachmentToDataUrl(env, att, projectId);
    if (!dataUrl) continue;
    parts.push({ type: "image_url", image_url: { url: dataUrl } });
  }
  return parts;
}

export function userContentWithImages(text, imageParts) {
  const body = String(text || "").trim() || "Please look at the attached image(s) and respond.";
  if (!imageParts?.length) return body;
  return [{ type: "text", text: body }, ...imageParts];
}

export async function loadAttachmentsByMessageIds(env, projectId, roomId, messageIds) {
  const ids = [...new Set((messageIds || []).map((id) => Number(id)).filter((n) => Number.isFinite(n) && n > 0))];
  const map = new Map();
  if (!ids.length || !env?.DB) return map;
  const placeholders = ids.map(() => "?").join(",");
  const res = await env.DB.prepare(
    `SELECT message_id, kind, url, name, content_type
     FROM attachments
     WHERE project_id = ? AND room_id = ? AND message_id IN (${placeholders})`,
  )
    .bind(projectId, roomId, ...ids)
    .all();
  for (const row of res.results || []) {
    const list = map.get(row.message_id) || [];
    list.push({
      kind: row.kind,
      url: row.url,
      name: row.name,
      contentType: row.content_type,
    });
    map.set(row.message_id, list);
  }
  return map;
}
