import { describe, expect, it } from "vitest";
import { FluxyChatClient, bindFluxyRoom, classifyPresenceAvatars } from "./room";

describe("@fluxy-chat/sdk/room", () => {
  it("exports the room bag without verticals", () => {
    expect(typeof FluxyChatClient).toBe("function");
    expect(typeof bindFluxyRoom).toBe("function");
    expect(typeof classifyPresenceAvatars).toBe("function");
    const client = new FluxyChatClient({
      baseUrl: "https://example.test",
      userId: "u",
      token: "jwt",
    });
    expect(typeof client.room).toBe("function");
    expect(typeof client.rooms.get).toBe("function");
    expect(typeof client.rooms.release).toBe("function");
    expect(typeof client.rooms.dispose).toBe("function");
    expect(client.clientId).toBe("u");
    expect(client.rooms.count).toBe(0);
  });
});
