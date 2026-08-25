import { describe, expect, it } from "vitest";
import {
  captureRoomPitrSnapshot,
  listRoomPitr,
  restoreRoomPitr,
  storageHasPitr,
  AUTO_SNAPSHOT_MIN_INTERVAL_MS,
} from "./room-pitr.js";

function makeStorage({ pitr = true } = {}) {
  const kv = new Map();
  let bookmarkSeq = 0;
  const storage = {
    async get(k) {
      return kv.get(k);
    },
    async put(k, v) {
      kv.set(k, v);
    },
  };
  if (pitr) {
    storage.getCurrentBookmark = async () => `bm-${++bookmarkSeq}`;
    storage.onNextSessionRestoreBookmark = async (bm) => {
      storage._pendingRestore = bm;
    };
  }
  return storage;
}

describe("room PITR", () => {
  it("reports unavailable when the runtime has no bookmark API", () => {
    expect(storageHasPitr({})).toBe(false);
    expect(storageHasPitr(makeStorage({ pitr: false }))).toBe(false);
  });

  it("captures named snapshots and lists them newest first", async () => {
    const storage = makeStorage();
    const a = await captureRoomPitrSnapshot(storage, {
      label: "before-cutover",
      actorUserId: "u1",
      now: 1_000,
      force: true,
    });
    expect(a.ok).toBe(true);
    expect(a.snapshot.bookmark).toBe("bm-1");

    const b = await captureRoomPitrSnapshot(storage, {
      label: "after-cutover",
      now: 1_000 + AUTO_SNAPSHOT_MIN_INTERVAL_MS + 1,
      force: true,
    });
    expect(b.snapshot.bookmark).toBe("bm-2");

    const listed = await listRoomPitr(storage);
    expect(listed.pitrAvailable).toBe(true);
    expect(listed.retentionDays).toBe(30);
    expect(listed.snapshots.map((s) => s.label)).toEqual(["after-cutover", "before-cutover"]);
  });

  it("skips auto snapshots inside the interval unless force", async () => {
    const storage = makeStorage();
    await captureRoomPitrSnapshot(storage, { now: 5_000, force: true });
    const skipped = await captureRoomPitrSnapshot(storage, { now: 5_001, label: "auto" });
    expect(skipped.skipped).toBe(true);
    const listed = await listRoomPitr(storage);
    expect(listed.snapshots).toHaveLength(1);
  });

  it("queues restore for the next DO wake", async () => {
    const storage = makeStorage();
    const cap = await captureRoomPitrSnapshot(storage, { force: true, now: 9 });
    const restored = await restoreRoomPitr(storage, cap.snapshot.bookmark);
    expect(restored).toEqual({
      ok: true,
      restoresOnNextWake: true,
      bookmark: cap.snapshot.bookmark,
    });
    expect(storage._pendingRestore).toBe(cap.snapshot.bookmark);
  });

  it("rejects restore without a bookmark", async () => {
    const storage = makeStorage();
    expect((await restoreRoomPitr(storage, "  ")).reason).toBe("bookmark_required");
  });
});
