import { describe, expect, it } from "vitest";
import {
  ChatError,
  FluxyChatError,
  FluxyLockError,
  FluxyNotImplementedError,
  FluxyRateLimitError,
  LockError,
  NotImplementedError,
  RateLimitError,
  isFluxyChatError,
} from "./structured-errors";

describe("FluxyChat error hierarchy", () => {
  it("FluxyRateLimitError exposes retryAfterMs", () => {
    const err = new FluxyRateLimitError(5000);
    expect(err).toBeInstanceOf(RateLimitError);
    expect(err).toBeInstanceOf(FluxyChatError);
    expect(err.code).toBe("RATE_LIMITED");
    expect(err.retryAfterMs).toBe(5000);
  });

  it("FluxyLockError and FluxyNotImplementedError carry codes", () => {
    const lock = new FluxyLockError();
    expect(lock).toBeInstanceOf(LockError);
    expect(lock.code).toBe("LOCK_ACQUISITION_FAILED");

    const missing = new FluxyNotImplementedError("voice transcription");
    expect(missing).toBeInstanceOf(NotImplementedError);
    expect(missing.code).toBe("NOT_IMPLEMENTED");
    expect(missing.message).toContain("voice transcription");
  });

  it("isFluxyChatError narrows ChatError subclasses", () => {
    expect(isFluxyChatError(new ChatError("TEST", "boom"))).toBe(true);
    expect(isFluxyChatError(new Error("nope"))).toBe(false);
  });
});
