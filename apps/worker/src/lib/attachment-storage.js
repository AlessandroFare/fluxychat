/**
 * Map attachment URL / DB value to an R2 object key (upload stores keys, messages may store full URLs).
 */
export function attachmentUrlToR2Key(urlOrKey) {
  if (!urlOrKey || typeof urlOrKey !== "string") return null;
  const trimmed = urlOrKey.trim();
  if (!trimmed) return null;
  if (!trimmed.includes("://") && !trimmed.startsWith("/")) {
    return trimmed.replace(/^\/+/, "");
  }
  try {
    const parsed = new URL(trimmed, "https://placeholder.invalid");
    const path = parsed.pathname || "";
    const prefix = "/attachments/";
    const idx = path.indexOf(prefix);
    if (idx >= 0) {
      const key = path.slice(idx + prefix.length);
      return key ? decodeURIComponent(key) : null;
    }
    const segments = path.split("/").filter(Boolean);
    if (segments.length >= 3) {
      return segments.join("/");
    }
  } catch {
    return null;
  }
  return null;
}

/** Prefix for direct uploads: `{projectId}/{userId}/…` */
export function userUploadR2Prefix(projectId, userId) {
  if (!projectId || !userId) return null;
  return `${projectId}/${userId}/`;
}

export function collectAttachmentR2Keys(urlOrKeyRows) {
  const keys = new Set();
  for (const row of urlOrKeyRows) {
    const raw = typeof row === "string" ? row : row?.url;
    const key = attachmentUrlToR2Key(raw);
    if (key) keys.add(key);
  }
  return [...keys];
}

/**
 * List and delete all R2 objects for a user's upload prefix plus explicit attachment keys (GDPR erasure).
 */
export async function deleteUserAttachmentObjects(env, projectId, userId, urlOrKeyRows, logInfo) {
  if (!env.ATTACHMENTS) {
    return { deleted: 0, warnings: ["ATTACHMENTS not bound"] };
  }

  const keys = new Set(collectAttachmentR2Keys(urlOrKeyRows));
  const prefix = userUploadR2Prefix(projectId, userId);
  if (prefix) {
    let cursor;
    do {
      const listed = await env.ATTACHMENTS.list({ prefix, cursor, limit: 1000 });
      for (const obj of listed.objects || []) {
        if (obj?.key) keys.add(obj.key);
      }
      cursor = listed.truncated ? listed.cursor : undefined;
    } while (cursor);
  }

  let deleted = 0;
  const warnings = [];
  for (const key of keys) {
    try {
      await env.ATTACHMENTS.delete(key);
      deleted += 1;
    } catch (err) {
      warnings.push(
        `${key}:${err instanceof Error ? err.message : String(err)}`
      );
      if (typeof logInfo === "function") {
        logInfo("gdpr.attachment_r2_delete_failed", {
          projectId,
          userId,
          key,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
  }
  return { deleted, warnings };
}
