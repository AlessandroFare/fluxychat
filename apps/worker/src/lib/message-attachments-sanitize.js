export const MAX_ATTACHMENTS_PER_MESSAGE = 10;

function stripHtmlCommentsIndex(s) {
  let out = s;
  for (let guard = 0; guard < 512; guard += 1) {
    const start = out.indexOf("<!--");
    if (start === -1) return out;
    const end = out.indexOf("-->", start + 4);
    if (end === -1) {
      out = out.slice(0, start) + out.slice(start + 4);
      continue;
    }
    out = out.slice(0, start) + out.slice(end + 3);
  }
  return out;
}

function stripHtmlTagsIndex(s) {
  let out = s;
  for (let guard = 0; guard < 512; guard += 1) {
    const open = out.indexOf("<");
    if (open === -1) return out;
    const close = out.indexOf(">", open + 1);
    if (close === -1) {
      out = out.slice(0, open) + out.slice(open + 1);
      continue;
    }
    out = out.slice(0, open) + out.slice(close + 1);
  }
  return out;
}

export function sanitizeAttachmentString(input, maxLength = 1024) {
  if (typeof input !== "string") return "";
  let sanitized = input.trim();
  if (sanitized.length > maxLength) sanitized = sanitized.slice(0, maxLength);
  sanitized = stripHtmlCommentsIndex(sanitized);
  sanitized = stripHtmlTagsIndex(sanitized);
  sanitized = sanitized
    .replace(/\b(javascript|data|vbscript)\s*:/gi, "blocked:")
    .replace(/\0/g, "");
  return sanitized;
}

/** Normalize outbound message attachments from JSON POST body (parity with websocket path). */
export function sanitizeMessageAttachments(raw) {
  if (!Array.isArray(raw) || raw.length === 0) return [];
  const list = [];
  for (let i = 0; i < raw.length && list.length < MAX_ATTACHMENTS_PER_MESSAGE; i++) {
    const a = raw[i];
    if (!a || typeof a !== "object") continue;
    const url = typeof a.url === "string" ? sanitizeAttachmentString(a.url, 2048).trim() : "";
    if (!url) continue;
    const isWorkerAttachmentPath =
      url.startsWith("/attachments/") &&
      !url.includes("://") &&
      !url.includes("\\") &&
      !url.includes("..");
    if (!isWorkerAttachmentPath) {
      try {
        const u = new URL(url);
        if (u.protocol !== "http:" && u.protocol !== "https:") continue;
      } catch {
        continue;
      }
    }
    const name =
      sanitizeAttachmentString(String(a.name || url.split("/").pop() || "attachment"), 255) ||
      "attachment";
    const kind =
      sanitizeAttachmentString(String(a.kind || "file").replace(/[^\w.-]/gi, "").slice(0, 48), 48) ||
      "file";
    const sz = Number(a.sizeBytes);
    const sizeBytes = Number.isFinite(sz) ? Math.min(Math.max(sz, 0), 10 * 1024 * 1024) : null;
    const contentTypeRaw =
      typeof a.contentType === "string" ? sanitizeAttachmentString(a.contentType, 128) : null;
    const contentType =
      contentTypeRaw &&
      /^[a-zA-Z0-9][a-zA-Z0-9!#$&^_`|~+.=-]*\/[a-zA-Z0-9][a-zA-Z0-9!#$&^_`|~+.=-]*$/.test(
        contentTypeRaw,
      )
        ? contentTypeRaw
        : null;
    list.push({ url, name, kind, sizeBytes, contentType });
  }
  return list;
}
