/**
 * Room Durable Object SQLite point-in-time recovery (CF-A-025).
 *
 * Cloudflare keeps 30 days of SQLite+KV history on `new_sqlite_classes` objects.
 * This module is the product surface: named snapshots, list, restore-on-next-wake.
 * Restore uses `storage.onNextSessionRestoreBookmark` — the object reloads that
 * bookmark the next time it is constructed (after hibernation / eviction).
 */

export const PITR_SNAPSHOTS_KEY = "room-pitr:snapshots:v1";
export const PITR_META_KEY = "room-pitr:meta:v1";
export const MAX_PITR_SNAPSHOTS = 24;
export const PITR_RETENTION_DAYS = 30;
export const AUTO_SNAPSHOT_MIN_INTERVAL_MS = 60 * 60 * 1000;

export function storageHasPitr(storage) {
  return Boolean(
    storage &&
      typeof storage.getCurrentBookmark === "function" &&
      typeof storage.onNextSessionRestoreBookmark === "function",
  );
}

function snapshotId(now) {
  return `pitr_${now}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * @param {DurableObjectStorage} storage
 * @param {{ label?: string, actorUserId?: string | null, now?: number, force?: boolean }} opts
 */
export async function captureRoomPitrSnapshot(storage, opts = {}) {
  if (!storageHasPitr(storage)) {
    return { ok: false, reason: "pitr_unavailable" };
  }
  const now = Number.isFinite(opts.now) ? opts.now : Date.now();
  const meta = (await storage.get(PITR_META_KEY)) || {};
  if (!opts.force && meta.lastSnapshotAt && now - meta.lastSnapshotAt < AUTO_SNAPSHOT_MIN_INTERVAL_MS) {
    return { ok: true, skipped: true, reason: "interval", lastSnapshotAt: meta.lastSnapshotAt };
  }

  const bookmark = await storage.getCurrentBookmark();
  if (!bookmark) return { ok: false, reason: "bookmark_empty" };

  const stored = await storage.get(PITR_SNAPSHOTS_KEY);
  const snapshots = Array.isArray(stored) ? stored : [];
  const snapshot = {
    id: snapshotId(now),
    bookmark,
    label: String(opts.label || "manual").slice(0, 80),
    createdAt: now,
    actorUserId: opts.actorUserId || null,
  };
  snapshots.unshift(snapshot);
  await storage.put(PITR_SNAPSHOTS_KEY, snapshots.slice(0, MAX_PITR_SNAPSHOTS));
  await storage.put(PITR_META_KEY, { lastSnapshotAt: now });
  return { ok: true, snapshot, currentBookmark: bookmark };
}

export async function listRoomPitr(storage) {
  const snapshots = Array.isArray(await storage.get(PITR_SNAPSHOTS_KEY))
    ? await storage.get(PITR_SNAPSHOTS_KEY)
    : [];
  let currentBookmark = null;
  if (storageHasPitr(storage)) {
    currentBookmark = await storage.getCurrentBookmark();
  }
  return {
    ok: true,
    pitrAvailable: storageHasPitr(storage),
    retentionDays: PITR_RETENTION_DAYS,
    currentBookmark,
    snapshots,
  };
}

export async function restoreRoomPitr(storage, bookmark) {
  const token = typeof bookmark === "string" ? bookmark.trim() : "";
  if (!token) return { ok: false, reason: "bookmark_required" };
  if (!storageHasPitr(storage)) {
    return { ok: false, reason: "pitr_unavailable" };
  }
  await storage.onNextSessionRestoreBookmark(token);
  return { ok: true, restoresOnNextWake: true, bookmark: token };
}
