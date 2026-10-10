export const LOCK_ID_MAX = 64;
export const LOCK_TTL_MS_DEFAULT = 30_000;
export const LOCK_TTL_MS_MAX = 120_000;

export function normalizeLockId(id) {
  const s = String(id || "").trim().slice(0, LOCK_ID_MAX);
  if (!s || !/^[a-zA-Z0-9._:-]+$/.test(s)) return "";
  return s;
}

export function clampLockTtlMs(ttlMs) {
  const n = Number(ttlMs);
  if (!Number.isFinite(n) || n <= 0) return LOCK_TTL_MS_DEFAULT;
  return Math.min(LOCK_TTL_MS_MAX, Math.max(1_000, Math.floor(n)));
}

const LOCK_ATTR_MAX_KEYS = 16;
const LOCK_ATTR_KEY_MAX = 64;

export function sanitizeLockAttributes(value) {
  if (value == null || typeof value !== "object" || Array.isArray(value)) return undefined;
  /** @type {Record<string, string | number | boolean>} */
  const out = {};
  for (const [rawKey, raw] of Object.entries(value)) {
    if (Object.keys(out).length >= LOCK_ATTR_MAX_KEYS) break;
    const key = String(rawKey || "").trim().slice(0, LOCK_ATTR_KEY_MAX);
    if (!key) continue;
    if (typeof raw !== "string" && typeof raw !== "number" && typeof raw !== "boolean") continue;
    out[key] = raw;
  }
  return Object.keys(out).length ? out : undefined;
}

/**
 * Exclusive lock: one holder per id. Same owner may refresh TTL.
 * @param {Map<string, { owner: string, expiresAt: number, attributes?: Record<string, string | number | boolean> }>} map
 */
export function applyLockAcquire(map, { lockId, owner, now, ttlMs, attributes }) {
  const existing = map.get(lockId);
  if (existing && existing.expiresAt > now && existing.owner !== owner) {
    return { ok: false, lock: existing };
  }
  const nextAttributes =
    sanitizeLockAttributes(attributes) ??
    (existing && existing.owner === owner ? existing.attributes : undefined);
  const lock = {
    owner,
    expiresAt: now + clampLockTtlMs(ttlMs),
    ...(nextAttributes ? { attributes: nextAttributes } : {}),
  };
  map.set(lockId, lock);
  return { ok: true, lock };
}

export function applyLockRelease(map, { lockId, owner, now }) {
  const existing = map.get(lockId);
  if (!existing || existing.expiresAt <= now) {
    map.delete(lockId);
    return { ok: true, released: true };
  }
  if (existing.owner !== owner) return { ok: false, lock: existing };
  map.delete(lockId);
  return { ok: true, released: true };
}

export function releaseLocksOwnedBy(map, owner) {
  const released = [];
  for (const [id, lock] of map) {
    if (lock.owner === owner) {
      map.delete(id);
      released.push(id);
    }
  }
  return released;
}

export function serializeLiveLocks(map, now) {
  const out = [];
  for (const [lockId, lock] of map) {
    if (lock.expiresAt <= now) {
      map.delete(lockId);
      continue;
    }
    out.push({
      lockId,
      owner: lock.owner,
      expiresAt: lock.expiresAt,
      held: true,
      ...(lock.attributes ? { attributes: lock.attributes } : {}),
    });
  }
  return out;
}
