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
  if (typeof raw !== "string") return {};
  if (raw.length > 2048) return {};
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    // Audit S-22: only accept a small, well-typed allowlist of presence
    // fields. This prevents an attacker from broadcasting arbitrary
    // attacker-controlled strings (e.g. with HTML) to every room member.
    const out = {};
    if (typeof parsed.name === "string" && parsed.name.length <= 64) {
      out.name = parsed.name;
    }
    if (typeof parsed.avatar_url === "string" && /^https?:\/\//.test(parsed.avatar_url)) {
      out.avatar_url = parsed.avatar_url;
    }
    if (typeof parsed.role === "string" && parsed.role.length <= 32) {
      out.role = parsed.role;
    }
    return out;
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
