import { describe, expect, it } from "vitest";
import {
  FluxyAuthError,
  FLUXY_WS_CLOSE_POLICY,
  computeReconnectBackoffMs,
  mapWebSocketCloseToError,
} from "./errors";

describe("fluxy sdk errors", () => {
  it("maps 1008 to FluxyAuthError", () => {
    const err = mapWebSocketCloseToError(FLUXY_WS_CLOSE_POLICY, "Unauthorized");
    expect(err).toBeInstanceOf(FluxyAuthError);
  });

  it("maps 1008 Forbidden with distinct message", () => {
    const err = mapWebSocketCloseToError(FLUXY_WS_CLOSE_POLICY, "Forbidden");
    expect(err).toBeInstanceOf(FluxyAuthError);
    expect(err?.message).toContain("member");
  });

  it("returns null for normal close 1000", () => {
    expect(mapWebSocketCloseToError(1000)).toBeNull();
  });

  it("computes exponential backoff capped at max", () => {
    expect(computeReconnectBackoffMs(0)).toBe(500);
    expect(computeReconnectBackoffMs(1)).toBe(1000);
    expect(computeReconnectBackoffMs(10)).toBe(20_000);
  });
});
