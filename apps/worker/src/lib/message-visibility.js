const ROLE_VISIBILITY_RE = /^role:([a-z0-9_-]{1,64})$/;

/**
 * @param {string} visibility
 * @returns {string | null}
 */
export function parseRoleFromVisibility(visibility) {
  if (!visibility || typeof visibility !== "string") return null;
  const match = visibility.trim().toLowerCase().match(ROLE_VISIBILITY_RE);
  return match ? match[1] : null;
}

/**
 * @param {unknown} body
 * @returns {{ ok: true, visibility: "room" | "whisper" | `role:${string}`, visibleTo: string[] } | { ok: false, error: string }}
 */
export function resolveMessageVisibility(body) {
  const raw =
    typeof body?.visibility === "string" ? body.visibility.trim() : "room";
  const visibility = raw.toLowerCase();

  if (visibility === "room" || visibility === "all") {
    return { ok: true, visibility: "room", visibleTo: [] };
  }

  if (visibility === "whisper") {
    let visibleTo = [];
    if (body?.visibleTo != null) {
      if (!Array.isArray(body.visibleTo)) {
        return { ok: false, error: "visibleTo must be an array of user ids" };
      }
      visibleTo = body.visibleTo
        .map((id) => String(id).trim())
        .filter((id) => id.length > 0 && id.length <= 128);
    }
    if (!visibleTo.length) {
      return { ok: false, error: "visibleTo required for whisper messages" };
    }
    return { ok: true, visibility: "whisper", visibleTo };
  }

  if (ROLE_VISIBILITY_RE.test(visibility)) {
    return { ok: true, visibility, visibleTo: [] };
  }

  return { ok: false, error: "visibility must be room, whisper, or role:<name>" };
}

/**
 * @param {string | null | undefined} visibility
 * @param {string | null | undefined} visibleToJson
 * @param {string} viewerUserId
 * @param {string} authorUserId
 * @param {string | null | undefined} [viewerRole]
 */
export function canUserSeeMessage(
  visibility,
  visibleToJson,
  viewerUserId,
  authorUserId,
  viewerRole,
) {
  if (!visibility || visibility === "room") return true;
  if (viewerUserId === authorUserId) return true;

  if (visibility === "whisper") {
    if (!visibleToJson) return false;
    try {
      const list = JSON.parse(visibleToJson);
      if (!Array.isArray(list)) return false;
      return list.includes(viewerUserId);
    } catch {
      return false;
    }
  }

  const roleName = parseRoleFromVisibility(visibility);
  if (roleName) {
    if (!viewerRole) return false;
    return viewerRole.toLowerCase() === roleName;
  }

  return false;
}

/**
 * SQL fragment (AND ...) for message visibility for a viewer.
 * Role-scoped messages match via room_members (works across rooms in search).
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
      OR (visibility LIKE 'role:%' AND EXISTS (
        SELECT 1 FROM room_members rm
        WHERE rm.room_id = messages.room_id
        AND rm.user_id = ?
        AND LOWER(rm.role) = LOWER(substr(messages.visibility, 6))
      ))
    )`,
    binds: [viewerUserId, likePattern, viewerUserId],
  };
}

/**
 * @param {*} env
 * @param {string} roomId
 * @param {string} viewerUserId
 * @param {string[]} [jwtRoles]
 * @returns {Promise<{ sql: string, binds: string[], viewerRole: string }>}
 */
export async function getMessageVisibilityFilter(env, roomId, viewerUserId, jwtRoles = []) {
  const { getRoomMemberRole } = await import("./message-decisions.js");
  const viewerRole = await getRoomMemberRole(env, roomId, viewerUserId, jwtRoles);
  const vis = messageVisibilitySql(viewerUserId);
  return { ...vis, viewerRole };
}

/**
 * @param {string} visibility
 * @param {string[]} visibleTo
 * @param {string} senderUserId
 * @returns {Set<string> | null}
 */
export function whisperRecipientSet(visibility, visibleTo, senderUserId) {
  if (visibility !== "whisper") return null;
  const set = new Set([senderUserId, ...visibleTo]);
  return set;
}

/**
 * Resolve WS fan-out recipients for scoped visibility (whisper or role:*).
 * @param {*} env
 * @param {string} roomId
 * @param {string} visibility
 * @param {string[]} visibleTo
 * @param {string} senderUserId
 * @returns {Promise<Set<string> | null>}
 */
export async function resolveVisibilityRecipientUserIds(
  env,
  roomId,
  visibility,
  visibleTo,
  senderUserId,
) {
  if (!visibility || visibility === "room") return null;

  const whisperRecipients = whisperRecipientSet(visibility, visibleTo, senderUserId);
  if (whisperRecipients) return whisperRecipients;

  const roleName = parseRoleFromVisibility(visibility);
  if (!roleName) return new Set([senderUserId]);

  const result = await env.DB.prepare(
    "SELECT user_id FROM room_members WHERE room_id = ? AND LOWER(role) = LOWER(?)",
  )
    .bind(roomId, roleName)
    .all();

  const recipients = new Set([senderUserId]);
  for (const row of result.results || []) {
    if (row?.user_id) recipients.add(String(row.user_id));
  }
  return recipients;
}
