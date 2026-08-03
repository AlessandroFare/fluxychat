import { describe, expect, it, vi, afterEach } from "vitest";
import {
  scheduleSessionTokenRefresh,
  sessionTokenFingerprint,
} from "./session-token-refresh";

function fakeJwt(expSeconds: number): string {
  const header = btoa(JSON.stringify({ alg: "none", typ: "JWT" }));
  const payload = btoa(JSON.stringify({ sub: "u1", exp: expSeconds }));
  return `${header}.${payload}.sig`;
}

describe("session-token-refresh", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("sessionTokenFingerprint changes when exp changes", () => {
    const a = sessionTokenFingerprint(fakeJwt(Math.floor(Date.now() / 1000) + 3600));
    const b = sessionTokenFingerprint(fakeJwt(Math.floor(Date.now() / 1000) + 7200));
    expect(a).not.toBe(b);
  });

  it("schedules refresh before expiry", async () => {
    vi.useFakeTimers();
    const exp = Math.floor(Date.now() / 1000) + 120;
    const client = {
      token: fakeJwt(exp),
      resolveToken: vi.fn(async () => undefined),
    };
    const onRefresh = vi.fn();
    const stop = scheduleSessionTokenRefresh(client as never, {
      bufferMs: 60_000,
      onRefresh,
    });

    await vi.advanceTimersByTimeAsync(60_000);
    expect(client.resolveToken).toHaveBeenCalledTimes(1);
    expect(onRefresh).toHaveBeenCalledTimes(1);
    stop();
  });
});
