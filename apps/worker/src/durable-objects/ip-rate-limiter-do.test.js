import { describe, it, expect, beforeEach, vi } from "vitest";
import { IpRateLimiterDurableObject } from "./ip-rate-limiter-do.js";

function createLimiter() {
  let alarmAt = null;
  const storage = new Map();
  const state = {
    storage: {
      get: async (key) => storage.get(key) ?? null,
      put: async (key, value) => {
        storage.set(key, value);
      },
      delete: async (key) => {
        storage.delete(key);
      },
      getAlarm: async () => alarmAt,
      setAlarm: async (when) => {
        alarmAt = when;
      },
      deleteAlarm: async () => {
        alarmAt = null;
      },
    },
  };
  return { limiter: new IpRateLimiterDurableObject(state, {}), storage, getAlarm: () => alarmAt };
}

describe("IpRateLimiterDurableObject", () => {
  beforeEach(() => {
    vi.useRealTimers();
  });

  it("allows under limit then blocks", async () => {
    const { limiter } = createLimiter();
    const url = new Request("https://do/check?limit=2&windowMs=60000", { method: "POST" });

    const first = await limiter.fetch(url);
    const second = await limiter.fetch(url);
    const third = await limiter.fetch(url);

    expect((await first.json()).allowed).toBe(true);
    expect((await second.json()).allowed).toBe(true);
    const blocked = await third.json();
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("alarm clears expired bucket", async () => {
    const { limiter, storage } = createLimiter();
    await limiter.consume(5, 60_000);
    expect(storage.has("bucket")).toBe(true);
    const bucket = storage.get("bucket");
    storage.set("bucket", { ...bucket, expiresAt: Date.now() - 1 });
    await limiter.alarm();
    expect(storage.has("bucket")).toBe(false);
  });
});
