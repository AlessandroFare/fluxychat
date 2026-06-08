/**
 * Pusher-style presence helpers for Room DO.
 */

/**
 * @param {Map<WebSocket, string>} userIds
 * @param {Map<string, number>} userConnectionCounts
 * @returns {string[]}
 */
export function listActivePresenceUserIds(userIds, userConnectionCounts) {
  const fromCounts = [...userConnectionCounts.keys()];
  if (fromCounts.length) return fromCounts;
  return [...new Set([...userIds.values()].filter((uid) => !String(uid).startsWith("recovered:")))];
}

/**
 * @param {string[]} userIds
 * @param {Map<string, Record<string, unknown>>} userInfoByUserId
 */
export function buildPresenceMembers(userIds, userInfoByUserId) {
  return userIds.map((userId) => ({
    userId,
    userInfo: userInfoByUserId.get(userId) ?? {},
  }));
}

/**
 * @param {unknown} raw
 * @returns {Record<string, unknown>}
 */
export function parsePresenceInfoParam(raw) {
  if (raw == null || raw === "") return {};
  try {
    const parsed = JSON.parse(String(raw));
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return parsed;
  } catch {
    return {};
  }
}

const CLIENT_EVENT_PREFIX = "client-";
const CLIENT_EVENT_MAX_PER_MINUTE = 10;

/**
 * @param {string} eventName
 * @returns {{ ok: true, eventName: string } | { ok: false, error: string }}
 */
export function normalizeClientEventName(eventName) {
  const name = String(eventName ?? "").trim();
  if (!name) return { ok: false, error: "eventName required" };
  if (!name.startsWith(CLIENT_EVENT_PREFIX)) {
    return { ok: false, error: "client events must be prefixed with client-" };
  }
  if (name.length > 128) return { ok: false, error: "eventName too long" };
  if (!/^client-[a-zA-Z0-9_.-]+$/.test(name)) {
    return { ok: false, error: "invalid client event name" };
  }
  return { ok: true, eventName: name };
}

export { CLIENT_EVENT_MAX_PER_MINUTE };
