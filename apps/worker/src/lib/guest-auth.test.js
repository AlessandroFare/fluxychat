import { describe, it, expect } from "vitest";
import {
  isGuestOnlyAuth,
  isPublicGuestReadOnly,
  assertGuestCanWrite,
  guestMemberRoleForJoin,
} from "./guest-auth.js";
import { parseRoomIdFromChannelName } from "./channel-auth.js";

describe("guest-auth", () => {
  it("detects guest-only tokens", () => {
    expect(isGuestOnlyAuth({ roles: ["guest"] })).toBe(true);
    expect(isGuestOnlyAuth({ roles: ["guest", "member"] })).toBe(false);
    expect(isGuestOnlyAuth({ roles: ["member"] })).toBe(false);
  });

  it("blocks guest writes when read-only", () => {
    const env = { PUBLIC_GUEST_READ_ONLY: "true" };
    expect(assertGuestCanWrite(env, { roles: ["guest"] }).ok).toBe(false);
    expect(assertGuestCanWrite(env, { roles: ["member"] }).ok).toBe(true);
  });

  it("picks guest role for room join", () => {
    expect(guestMemberRoleForJoin({ roles: ["guest"] })).toBe("guest");
    expect(guestMemberRoleForJoin({ roles: ["member"] })).toBe("member");
  });
});

describe("channel-auth", () => {
  it("parses pusher-style channel names", () => {
    expect(parseRoomIdFromChannelName("private-room-lobby")).toBe("lobby");
    expect(parseRoomIdFromChannelName("presence-room-lobby")).toBe("lobby");
    expect(parseRoomIdFromChannelName("my-room-id")).toBe("my-room-id");
  });
});
