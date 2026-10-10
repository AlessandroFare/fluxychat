import { describe, expect, it, vi } from "vitest";
import { bindRoomLocks } from "./room-locks";
import type { FluxyChatRoomConnection } from "./room-connection";

describe("bindRoomLocks", () => {
  it("sends acquire/release and tracks inbound lock frames", async () => {
    const sent: Record<string, unknown>[] = [];
    let lockHandler: ((event: { type: "lock"; lockId?: string; held?: boolean; owner?: string | null; expiresAt?: number }) => void) | null =
      null;
    const connection = {
      userId: "ada",
      sendJson(payload: Record<string, unknown>) {
        sent.push(payload);
      },
      onLock(handler: typeof lockHandler) {
        lockHandler = handler;
        return () => {
          lockHandler = null;
        };
      },
    } as unknown as FluxyChatRoomConnection;

    const locks = bindRoomLocks(connection);
    locks.acquire("slide-1", { ttlMs: 10_000 });
    expect(sent[0]).toEqual({ type: "lock_acquire", lockId: "slide-1", ttlMs: 10_000 });
    expect(locks.get("slide-1")).toMatchObject({ status: "pending", owner: "ada" });
    lockHandler?.({ type: "lock", lockId: "slide-1", held: true, owner: "ada", expiresAt: 9, acquired: true });
    expect(locks.get("slide-1")).toMatchObject({ owner: "ada", held: true, status: "locked" });
    await expect(locks.getAll()).resolves.toEqual([
      expect.objectContaining({ lockId: "slide-1", owner: "ada", held: true }),
    ]);
    await expect(locks.getSelf()).resolves.toEqual([
      expect.objectContaining({ lockId: "slide-1", owner: "ada" }),
    ]);
    await expect(locks.getOthers()).resolves.toEqual([]);
    lockHandler?.({ type: "lock", lockId: "slide-2", held: true, owner: "lin", expiresAt: 9, acquired: true });
    await expect(locks.getOthers()).resolves.toEqual([
      expect.objectContaining({ lockId: "slide-2", owner: "lin" }),
    ]);
    locks.release("slide-1");
    expect(sent[1]).toEqual({ type: "lock_release", lockId: "slide-1" });
    lockHandler?.({ type: "lock", lockId: "slide-1", held: false, owner: null, expiresAt: 0 });
    expect(locks.get("slide-1")).toBeUndefined();
    const sub = vi.fn();
    const off = locks.subscribe(sub);
    expect(typeof off).toBe("function");
  });

  it("FX-LOCK-2 pending acquire carries attributes and duplicate pending throws", () => {
    const sent: Record<string, unknown>[] = [];
    const connection = {
      userId: "ada",
      sendJson(payload: Record<string, unknown>) {
        sent.push(payload);
      },
      onLock() {
        return () => {};
      },
    } as unknown as FluxyChatRoomConnection;
    const locks = bindRoomLocks(connection);
    locks.acquire("cell-d3", { attributes: { component: "cell-d3" } });
    expect(sent[0]).toMatchObject({
      type: "lock_acquire",
      lockId: "cell-d3",
      attributes: { component: "cell-d3" },
    });
    expect(locks.get("cell-d3")).toMatchObject({
      status: "pending",
      attributes: { component: "cell-d3" },
    });
    expect(() => locks.acquire("cell-d3")).toThrow(/request exists/);
  });
});
