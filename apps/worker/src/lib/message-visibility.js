/**
 * @param {unknown} body
 * @returns {{ ok: true, visibility: "room" | "whisper", visibleTo: string[] } | { ok: false, error: string }}
 */
export function resolveMessageVisibility(body) {
  const visibility =
    typeof body?.visibility === "string" ? body.visibility.trim().toLowerCase() : "room";
  if (visibility !== "room" && visibility !== "whisper") {
    return { ok: false, error: "visibility must be room or whisper" };
  }
  let visibleTo = [];
  if (body?.visibleTo != null) {
    if (!Array.isArray(body.visibleTo)) {
      return { ok: false, error: "visibleTo must be an array of user ids" };
    }
    visibleTo = body.visibleTo
      .map((id) => String(id).trim())
      .filter((id) => id.length > 0 && id.length <= 128);
    if (!visibleTo.length) {
      return { ok: false, error: "visibleTo required for whisper" };
    }
  }
  if (visibility === "whisper" && !visibleTo.length) {
    return { ok: false, error: "visibleTo required for whisper messages" };
  }
  return { ok: true, visibility, visibleTo };
}

/**
 * @param {string | null | undefined} visibility
 * @param {string | null | undefined} visibleToJson
 * @param {string} viewerUserId
 * @param {string} authorUserId
 */
export function canUserSeeMessage(visibility, visibleToJson, viewerUserId, authorUserId) {
  if (!visibility || visibility === "room") return true;
  if (viewerUserId === authorUserId) return true;
  if (visibility !== "whisper" || !visibleToJson) return false;
  try {
    const list = JSON.parse(visibleToJson);
    if (!Array.isArray(list)) return false;
    return list.includes(viewerUserId);
  } catch {
    return false;
  }
}

/**
 * SQL fragment (AND ...) for message visibility for a viewer.
 * @param {string} viewerUserId
 * @returns {{ sql: string, binds: string[] }}
 */
export function messageVisibilitySql(viewerUserId) {
  const likePattern = `%"${viewerUserId.replace(/"/g, "")}"%`;
  return {
    sql: ` AND (
      visibility IS NULL OR visibility = 'room'
      OR user_id = ?
      OR (visibility = 'whisper' AND visible_to_json LIKE ? ESCAPE '\\')
    )`,
    binds: [viewerUserId, likePattern],
  };
}

/**
 * @param {string} visibility
 * @param {string[]} visibleTo
 * @param {string} senderUserId
 * @returns {Set<string>}
 */
export function whisperRecipientSet(visibility, visibleTo, senderUserId) {
  if (visibility !== "whisper") return null;
  const set = new Set([senderUserId, ...visibleTo]);
  return set;
}
