import { describe, expect, it } from "vitest";
import { mintLiveKitAccessToken } from "./livekit-token.js";

describe("livekit-token", () => {
  it("returns error when secrets missing", async () => {
    const result = await mintLiveKitAccessToken({}, {
      roomName: "room-1",
      identity: "user-1",
    });
    expect(result.error).toBe("livekit_not_configured");
  });

  it("mints a JWT when configured", async () => {
    const result = await mintLiveKitAccessToken(
      {
        LIVEKIT_API_KEY: "testkey",
        LIVEKIT_API_SECRET: "testsecret",
        LIVEKIT_URL: "wss://livekit.example.com",
      },
      { roomName: "room-1", identity: "user-1", displayName: "Alice", ttlSeconds: 600 },
    );
    expect(result.token).toMatch(/^[\w-]+\.[\w-]+\.[\w-]+$/);
    expect(result.provider).toBe("livekit");
    expect(result.url).toBe("wss://livekit.example.com");
    expect(result.roomName).toBe("room-1");
  });
});
