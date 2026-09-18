/**
 * Campaign: README / docs public surface for @fluxy-chat/sdk.
 */
import { describe, expect, it } from "vitest";
import {
  FluxyAnonymousNotAllowedError,
  FluxyAuthError,
  FluxyChatClient,
  FluxyConnectionError,
  FluxyNotMemberError,
  FluxyRateLimitError,
  FluxySendError,
  FluxyTokenExpiredError,
  RateLimitError,
  describeConnectionError,
  getConnectionStatusLabel,
} from "./index";

describe("sdk README public API", () => {
  it("exports FluxyChatClient and connection-status helpers", () => {
    expect(typeof FluxyChatClient).toBe("function");
    expect(typeof describeConnectionError).toBe("function");
    expect(getConnectionStatusLabel("connected")).toBe("Connected");
    expect(getConnectionStatusLabel("reconnecting")).toMatch(/Reconnecting/);
  });

  it("keeps documented error classes (not Error(\"undefined\"))", () => {
    const notMember = new FluxyNotMemberError();
    expect(notMember).toBeInstanceOf(FluxyAuthError);
    expect(notMember.name).toBe("FluxyNotMemberError");
    expect(notMember.refusalCode).toBe("not_member");
    expect(notMember.message).not.toBe("undefined");

    const expired = new FluxyTokenExpiredError();
    expect(expired.refusalCode).toBe("token_expired");

    const anon = new FluxyAnonymousNotAllowedError();
    expect(anon).toBeInstanceOf(FluxyAuthError);

    const rate = new FluxyRateLimitError(1200);
    expect(rate).toBeInstanceOf(RateLimitError);
    expect(rate.retryAfterMs).toBe(1200);
    expect(rate.message).not.toBe("undefined");

    const closed = new FluxyConnectionError(1006, "abnormal");
    expect(closed.code).toBe(1006);
    expect(new FluxySendError().name).toBe("FluxySendError");
  });
});
