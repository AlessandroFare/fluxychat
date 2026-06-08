/** Pusher-style cache channel: last cacheable room event replayed on subscribe. */

export const ROOM_CACHE_STORAGE_KEY = "lastCacheEvent";

/** Event types stored as the channel cache snapshot. */
export const CACHEABLE_BROADCAST_TYPES = new Set(["message", "edit", "delete"]);

/**
 * @param {Record<string, unknown> | null | undefined} message
 * @returns {boolean}
 */
export function isCacheableBroadcast(message) {
  if (!message || typeof message.type !== "string") return false;
  if (message.type === "message" && message.streaming) return false;
  return CACHEABLE_BROADCAST_TYPES.has(message.type);
}

/**
 * @param {Record<string, unknown>} message
 * @returns {{ event: Record<string, unknown>; cachedAt: string }}
 */
export function buildCacheEntry(message) {
  return {
    event: { ...message },
    cachedAt: new Date().toISOString(),
  };
}

/**
 * @param {unknown} raw
 * @returns {{ event: Record<string, unknown>; cachedAt: string } | null}
 */
export function parseStoredCacheEntry(raw) {
  if (!raw || typeof raw !== "object") return null;
  const entry = /** @type {{ event?: unknown; cachedAt?: unknown }} */ (raw);
  if (!entry.event || typeof entry.event !== "object") return null;
  const cachedAt =
    typeof entry.cachedAt === "string" && entry.cachedAt
      ? entry.cachedAt
      : new Date(0).toISOString();
  return {
    event: /** @type {Record<string, unknown>} */ (entry.event),
    cachedAt,
  };
}

/**
 * @param {string | undefined | null} param
 * @returns {boolean}
 */
export function parseCacheConnectParam(param) {
  if (!param) return false;
  const v = param.toLowerCase();
  return v === "1" || v === "true" || v === "on";
}
