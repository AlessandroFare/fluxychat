import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  FLUXY_ROOM_SESSION_GRACE_MS,
  acquireFluxyRoomSession,
  resetFluxyRoomSessionHandlesForTests,
} from "./room-session-handle";

describe("acquireFluxyRoomSession", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    resetFluxyRoomSessionHandlesForTests();
  });

  afterEach(() => {
    resetFluxyRoomSessionHandlesForTests();
    vi.useRealTimers();
  });

  it("starts session on first acquire and stops after grace on last release", () => {
    const start = vi.fn(() => vi.fn());
    const release = acquireFluxyRoomSession("room:a", start);
    expect(start).toHaveBeenCalledTimes(1);

    release();
    vi.advanceTimersByTime(FLUXY_ROOM_SESSION_GRACE_MS - 1);
    expect(start.mock.results[0]?.value).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(start.mock.results[0]?.value).toHaveBeenCalledTimes(1);
  });

  it("absorbs StrictMode remount within grace window", () => {
    const start = vi.fn(() => vi.fn());
    const release1 = acquireFluxyRoomSession("room:b", start);
    release1();
    vi.advanceTimersByTime(FLUXY_ROOM_SESSION_GRACE_MS - 1);
    acquireFluxyRoomSession("room:b", start);
    vi.advanceTimersByTime(FLUXY_ROOM_SESSION_GRACE_MS * 2);
    expect(start).toHaveBeenCalledTimes(1);
    expect(start.mock.results[0]?.value).not.toHaveBeenCalled();
  });

  it("shares one session across concurrent acquires", () => {
    const start = vi.fn(() => vi.fn());
    const releaseA = acquireFluxyRoomSession("room:c", start);
    acquireFluxyRoomSession("room:c", start);
    expect(start).toHaveBeenCalledTimes(1);
    releaseA();
    vi.advanceTimersByTime(FLUXY_ROOM_SESSION_GRACE_MS);
    expect(start.mock.results[0]?.value).not.toHaveBeenCalled();
  });

  it("warns in dev when release token is GC'd without release()", async () => {
    vi.resetModules();
    let onFinalize: ((held: { sessionKey: string; label: string }) => void) | null = null;
    class MockFinalizationRegistry {
      constructor(callback: (held: { sessionKey: string; label: string }) => void) {
        onFinalize = callback;
      }
      register() {}
      unregister() {}
    }
    vi.stubGlobal("FinalizationRegistry", MockFinalizationRegistry);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    const mod = await import("./room-session-handle");
    mod.resetFluxyRoomSessionHandlesForTests();
    mod.acquireFluxyRoomSession("room:leak", vi.fn(() => vi.fn()), "useChat");
    expect(onFinalize).not.toBeNull();
    onFinalize!({ sessionKey: "room:leak", label: "useChat" });
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('Room session "room:leak" (useChat) was garbage-collected without release'),
    );

    mod.resetFluxyRoomSessionHandlesForTests();
    warn.mockRestore();
    vi.unstubAllGlobals();
    vi.resetModules();
  });
});
