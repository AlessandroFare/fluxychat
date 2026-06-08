import { describe, it, expect } from "vitest";
import {
  isCacheableBroadcast,
  buildCacheEntry,
  parseStoredCacheEntry,
  parseCacheConnectParam,
} from "./room-cache.js";

describe("room-cache", () => {
  it("isCacheableBroadcast accepts message/edit/delete but not streaming", () => {
    expect(isCacheableBroadcast({ type: "message", content: "hi" })).toBe(true);
    expect(isCacheableBroadcast({ type: "message", streaming: true })).toBe(false);
    expect(isCacheableBroadcast({ type: "edit", id: 1 })).toBe(true);
    expect(isCacheableBroadcast({ type: "typing" })).toBe(false);
  });

  it("buildCacheEntry clones event with cachedAt", () => {
    const entry = buildCacheEntry({ type: "message", id: 1 });
    expect(entry.event).toEqual({ type: "message", id: 1 });
    expect(typeof entry.cachedAt).toBe("string");
  });

  it("parseStoredCacheEntry validates shape", () => {
    expect(parseStoredCacheEntry(null)).toBeNull();
    expect(
      parseStoredCacheEntry({
        event: { type: "message" },
        cachedAt: "2026-05-28T00:00:00.000Z",
      }),
    ).toMatchObject({ event: { type: "message" } });
  });

  it("parseCacheConnectParam", () => {
    expect(parseCacheConnectParam("1")).toBe(true);
    expect(parseCacheConnectParam("off")).toBe(false);
  });
});
