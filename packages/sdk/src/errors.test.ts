import { describe, expect, it } from "vitest";
import {
  FluxyAuthError,
  FluxyErrorInfo,
  FluxyNotMemberError,
  FluxyTokenExpiredError,
  describeConnectionError,
  FLUXY_WS_CLOSE_POLICY,
  computeReconnectBackoffMs,
  mapWebSocketCloseToError,
  mapWebSocketCloseToDisconnectReason,
  toFluxyErrorInfo,
  unableTo,
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

  it("maps close codes to typed disconnect reasons", () => {
    const cases: Array<[number, string, string]> = [
      [1000, "", "client_initiated"],
      [FLUXY_WS_CLOSE_POLICY, "Unauthorized", "auth_failed"],
      [FLUXY_WS_CLOSE_POLICY, "Forbidden", "not_member"],
      [FLUXY_WS_CLOSE_POLICY, "token_expired", "token_expired"],
      [FLUXY_WS_CLOSE_POLICY, "Sign in to join this room.", "anonymous_not_allowed"],
      [FLUXY_WS_CLOSE_POLICY, "protocol_unsupported", "protocol_unsupported"],
      [4000, "heartbeat_timeout", "heartbeat_timeout"],
      [4001, "terminated_by_moderator", "removed"],
      [1011, "websocket_setup_failed", "server_error"],
      [1006, "gone", "network"],
      [4712, "", "unknown"],
    ];
    for (const [code, reason, expected] of cases) {
      expect(mapWebSocketCloseToDisconnectReason(code, reason), `${code} ${reason}`).toBe(expected);
    }
  });

  it("describes terminal member errors for UI", () => {
    const err = mapWebSocketCloseToError(FLUXY_WS_CLOSE_POLICY, "not_member");
    const info = describeConnectionError(err);
    expect(info?.isTerminal).toBe(true);
    expect(info?.isMemberIssue).toBe(true);
    expect(info?.code).toBe("not_member");
    expect(info?.numericCode).toBe(40300);
    expect(info?.href).toContain("not_member");
  });

  it("wraps subclasses as FluxyErrorInfo with unable-to copy", () => {
    const err = mapWebSocketCloseToError(FLUXY_WS_CLOSE_POLICY, "not_member");
    const info = toFluxyErrorInfo(err as Error, "connect");
    expect(info).toBeInstanceOf(FluxyErrorInfo);
    expect(info.code).toBe(40300);
    expect(info.statusCode).toBe(403);
    expect(info.message).toBe(unableTo("connect", (err as FluxyNotMemberError).message));
    expect(info.terminal).toBe(true);
  });

  it("returns null for normal close 1000", () => {
    expect(mapWebSocketCloseToError(1000)).toBeNull();
  });

  it("computes exponential backoff capped at max", () => {
    expect(computeReconnectBackoffMs(0, 500, 20_000, () => 1)).toBe(500);
    expect(computeReconnectBackoffMs(1, 500, 20_000, () => 1)).toBe(1000);
    expect(computeReconnectBackoffMs(10, 500, 20_000, () => 1)).toBe(20_000);
  });

  it("applies equal jitter below the exponential delay", () => {
    expect(computeReconnectBackoffMs(1, 500, 20_000, () => 0)).toBe(500);
    expect(computeReconnectBackoffMs(1, 500, 20_000, () => 0.5)).toBe(750);
  });
});
