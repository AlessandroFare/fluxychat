import { describe, expect, it } from "vitest";
import { FluxyChatClient } from "./core";

describe("@fluxy-chat/sdk/core", () => {
  it("exports FluxyChatClient", () => {
    expect(typeof FluxyChatClient).toBe("function");
    const client = new FluxyChatClient({
      baseUrl: "https://example.test",
      userId: "user_1",
      token: "test-token",
    });
    expect(client).toBeInstanceOf(FluxyChatClient);
  });
});
