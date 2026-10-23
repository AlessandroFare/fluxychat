/**
 * Boot crash-loop guard for heavy Durable Objects (seal + purge).
 *
 * A DO boot that dies before completing (typically OOM while hydrating storage)
 * leaves `_do_boot.completed` false. After `crashLimit` consecutive incomplete
 * boots the object is **sealed**: it stops serving realtime/stream/schedule
 * writes until an operator unseals it, and its storage is **purged** so the
 * next boot starts light instead of dying again on the same state.
 *
 * Cost: one storage get + two small puts per instance creation (wake).
 *
 * Plain-object API over `DurableObjectStorage` so it stays unit-testable.
 */

export const DO_BOOT_STORAGE_KEY = "_do_boot";
export const DO_SEALED_STORAGE_KEY = "_do_sealed";

/**
 * Record a boot attempt. Returns whether the previous boot never completed.
 * @param {DurableObjectStorage} storage
 */
export async function noteDoBootStart(
  storage,
  { key = DO_BOOT_STORAGE_KEY, now = Date.now() } = {},
) {
  const prev = await storage.get(key);
  const crashed = Boolean(prev && typeof prev === "object" && prev.completed !== true);
  const consecutiveCrashes = crashed ? Number(prev.crashes || 0) + 1 : 0;
  await storage.put(key, { startedAt: now, completed: false, crashes: consecutiveCrashes });
  return { crashed, consecutiveCrashes };
}

export async function noteDoBootComplete(
  storage,
  { key = DO_BOOT_STORAGE_KEY, now = Date.now() } = {},
) {
  await storage.put(key, { completedAt: now, completed: true, crashes: 0 });
}

export async function readDoSeal(storage, { key = DO_SEALED_STORAGE_KEY } = {}) {
  const raw = await storage.get(key);
  return raw && typeof raw === "object" ? raw : null;
}

/**
 * Mark the object sealed and delete its storage except `keepKeys`.
 * @param {DurableObjectStorage} storage
 */
export async function sealAndPurgeDoObject(
  storage,
  {
    reason,
    crashes = 0,
    keepKeys = [],
    sealedKey = DO_SEALED_STORAGE_KEY,
    bootKey = DO_BOOT_STORAGE_KEY,
    now = Date.now(),
  } = {},
) {
  const sealed = { sealedAt: new Date(now).toISOString(), reason, crashes };
  const keep = new Set([...keepKeys, sealedKey, bootKey]);
  const doomed = [];
  const listed = await storage.list();
  for (const key of listed.keys()) {
    if (!keep.has(key)) doomed.push(key);
  }
  if (doomed.length) await storage.delete(doomed);
  await storage.put(sealedKey, sealed);
  return { ...sealed, purgedKeys: doomed.length };
}

export async function unsealDoObject(
  storage,
  { sealedKey = DO_SEALED_STORAGE_KEY, bootKey = DO_BOOT_STORAGE_KEY } = {},
) {
  await storage.delete([sealedKey, bootKey]);
}
