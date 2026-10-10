import { describe, expect, it } from "vitest";
import {
  applyLockAcquire,
  applyLockRelease,
  normalizeLockId,
  releaseLocksOwnedBy,
  serializeLiveLocks,
} from "./room-lock.js";

describe("room-lock", () => {
  it("grants exclusive locks and denies other holders", () => {
    const map = new Map();
    const now = 1_000;
    expect(applyLockAcquire(map, { lockId: "slide", owner: "ada", now, ttlMs: 10_000 }).ok).toBe(
      true,
    );
    const denied = applyLockAcquire(map, { lockId: "slide", owner: "bob", now: 1_100, ttlMs: 10_000 });
    expect(denied.ok).toBe(false);
    expect(denied.lock.owner).toBe("ada");
    expect(applyLockAcquire(map, { lockId: "slide", owner: "ada", now: 1_200, ttlMs: 10_000 }).ok).toBe(
      true,
    );
  });

  it("FX-LOCK-2 stores lock attributes on acquire and keeps them on TTL refresh", () => {
    const map = new Map();
    const granted = applyLockAcquire(map, {
      lockId: "cell-d3",
      owner: "ada",
      now: 0,
      ttlMs: 10_000,
      attributes: { component: "cell-d3" },
    });
    expect(granted.lock.attributes).toEqual({ component: "cell-d3" });
    const refresh = applyLockAcquire(map, {
      lockId: "cell-d3",
      owner: "ada",
      now: 100,
      ttlMs: 10_000,
    });
    expect(refresh.lock.attributes).toEqual({ component: "cell-d3" });
    expect(serializeLiveLocks(map, 1)[0]).toMatchObject({
      lockId: "cell-d3",
      attributes: { component: "cell-d3" },
    });
  });

  it("releases only the owner and drops on leave", () => {
    const map = new Map();
    applyLockAcquire(map, { lockId: "a", owner: "ada", now: 0, ttlMs: 30_000 });
    expect(applyLockRelease(map, { lockId: "a", owner: "bob", now: 1 }).ok).toBe(false);
    expect(applyLockRelease(map, { lockId: "a", owner: "ada", now: 1 }).ok).toBe(true);
    applyLockAcquire(map, { lockId: "b", owner: "ada", now: 0, ttlMs: 30_000 });
    expect(releaseLocksOwnedBy(map, "ada")).toEqual(["b"]);
    expect(serializeLiveLocks(map, 1)).toEqual([]);
  });

  it("rejects empty lock ids", () => {
    expect(normalizeLockId("")).toBe("");
    expect(normalizeLockId("ok-id")).toBe("ok-id");
  });
});
