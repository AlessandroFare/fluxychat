import { describe, expect, it } from "vitest";
import {
  FluxyAuthError,
  FluxyNotMemberError,
  FluxyTokenExpiredError,
  describeConnectionError,
  FLUXY_WS_CLOSE_POLICY,
  computeReconnectBackoffMs,
  mapWebSocketCloseToError,
} from "./errors";

describe("fluxy sdk errors", () => {
  it("maps 1008 to FluxyAuthError", () => {
    const err = mapWebSocketCloseToError(FLUXY_WS_CLOSE_POLICY, "Unauthorized");
    expect(err).toBeInstanceOf(FluxyAuthError);
  });

  it("maps 1008 Forbidden to FluxyNotMemberError", () => {
    const err = mapWebSocketCloseToError(FLUXY_WS_CLOSE_POLICY, "Forbidden");
    expect(err).toBeInstanceOf(FluxyNotMemberError);
    expect(err?.message).toContain("member");
  });

  it("maps not_member refusal codes", () => {
    const err = mapWebSocketCloseToError(FLUXY_WS_CLOSE_POLICY, "not_member");
    expect(err).toBeInstanceOf(FluxyNotMemberError);
  });

  it("maps token_expired refusal codes", () => {
    const err = mapWebSocketCloseToError(FLUXY_WS_CLOSE_POLICY, "token_expired");
    expect(err).toBeInstanceOf(FluxyTokenExpiredError);
  });

  it("describes terminal member errors for UI", () => {
    const err = mapWebSocketCloseToError(FLUXY_WS_CLOSE_POLICY, "not_member");
    const info = describeConnectionError(err);
    expect(info?.isTerminal).toBe(true);
    expect(info?.isMemberIssue).toBe(true);
    expect(info?.code).toBe("not_member");
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
