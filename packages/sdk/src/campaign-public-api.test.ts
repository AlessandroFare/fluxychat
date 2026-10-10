/**
 * Campaign: README / docs public surface for @fluxy-chat/sdk.
 */
import { describe, expect, it } from "vitest";
import {
  FluxyAnonymousNotAllowedError,
  FluxyAuthError,
  FluxyChatClient,
  FluxyConnectionError,
  FluxyErrorInfo,
  FluxyNotMemberError,
  FluxyRateLimitError,
  FluxyRoomChatTransport,
  FluxySendError,
  FluxyTokenExpiredError,
  RateLimitError,
  createFluxyTokenRoute,
  describeConnectionError,
  toFluxyErrorInfo,
  errorInfoIs,
  getConnectionStatusLabel,
  FLUXY_SDK_VERSION,
} from "./index";

describe("sdk README public API", () => {
  it("exports FluxyChatClient and connection-status helpers", () => {
    expect(typeof FluxyChatClient).toBe("function");
    expect(typeof describeConnectionError).toBe("function");
    expect(getConnectionStatusLabel("connected")).toBe("Connected");
    expect(getConnectionStatusLabel("reconnecting")).toMatch(/Reconnecting/);
    expect(typeof FluxyRoomChatTransport).toBe("function");
    expect(typeof createFluxyTokenRoute).toBe("function");
    const client = new FluxyChatClient({
      baseUrl: "https://example.test",
      userId: "user_1",
      token: "test-token",
    });
    expect(typeof client.getActiveStreams).toBe("function");
    expect(typeof client.resumeStream).toBe("function");
    expect(typeof client.getMcpAppSharedState).toBe("function");
    expect(typeof client.room).toBe("function");
    expect(typeof client.close).toBe("function");
    expect(typeof client.dispose).toBe("function");
    expect(typeof client.realtime.ping).toBe("function");
    expect(typeof client.connection.whenState).toBe("function");
    expect(client.clientOptions.logLevel).toBe("error");
    expect(client.version).toBe(FLUXY_SDK_VERSION);
    expect(client.logger.logLevel).toBe("error");
    const bag = client.room("lobby");
    expect(typeof bag.typing.keystroke).toBe("function");
    expect(typeof bag.reactions.send).toBe("function");
    expect(typeof bag.messages.send).toBe("function");
    expect(typeof bag.messages.history).toBe("function");
    expect(typeof bag.messages.subscribe).toBe("function");
    expect(typeof bag.messages.with).toBe("function");
    expect(typeof bag.messages.copy).toBe("function");
    expect(typeof bag.cursors.subscribe).toBe("function");
    expect(typeof bag.members.updateProfile).toBe("function");
    expect(typeof bag.presence.enter).toBe("function");
    expect(typeof bag.presence.update).toBe("function");
    expect(typeof bag.presence.get).toBe("function");
    expect(typeof bag.presence.leave).toBe("function");
    expect(typeof bag.messages.delete).toBe("function");
    expect(typeof bag.occupancy.get).toBe("function");
    expect(typeof bag.presence.isUserPresent).toBe("function");
    expect(typeof bag.presence.onPresenceStateChange).toBe("function");
    expect(typeof bag.locks.getSelf).toBe("function");
    expect(typeof bag.locks.getOthers).toBe("function");
    expect(typeof bag.members.getAll).toBe("function");
    expect(typeof bag.members.subscribe).toBe("function");
    expect(typeof bag.locations.set).toBe("function");
    expect(typeof bag.onDiscontinuity).toBe("function");
    expect(typeof bag.status.current).toBe("function");
    expect(typeof bag.status.subscribe).toBe("function");
    expect(typeof bag.status).toBe("function");
    expect(typeof bag.cursors.getSelf).toBe("function");
    expect(typeof bag.cursors.getOthers).toBe("function");
    expect(bag.options.occupancy.enableEvents).toBe(true);
    expect(bag.options.messages.defaultMessageReactionType).toBe("distinct");
    expect(bag.options.messages.rawMessageReactions).toBe(false);
    const disposed = client.dispose();
    expect(typeof disposed.then).toBe("function");
  });

  it("keeps documented error classes (not Error(\"undefined\"))", () => {
    const notMember = new FluxyNotMemberError();
    expect(notMember).toBeInstanceOf(FluxyAuthError);
    expect(notMember.name).toBe("FluxyNotMemberError");
    expect(typeof FluxyErrorInfo).toBe("function");
    expect(typeof toFluxyErrorInfo).toBe("function");
    expect(typeof errorInfoIs).toBe("function");
    const info = toFluxyErrorInfo(notMember);
    expect(errorInfoIs(info, "not_member")).toBe(true);
    expect(errorInfoIs(info, info.code)).toBe(true);
    expect(errorInfoIs(info, "discontinuity")).toBe(false);
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
