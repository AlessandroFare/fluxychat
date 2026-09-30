import { describe, expect, it, vi } from "vitest";
import { joinRoomFromCloudflareAgent } from "./index.js";

describe("joinRoomFromCloudflareAgent", () => {
  it("connects the SDK client", () => {
    vi.stubGlobal(
      "WebSocket",
      function WebSocket(this: { readyState: number }, _url: string) {
        this.readyState = 1;
      } as unknown as typeof WebSocket,
    );
    const client = joinRoomFromCloudflareAgent({
      workerUrl: "https://example.test",
      token: "jwt",
      userId: "agent-1",
      roomId: "deal",
    });
    expect(client).toBeTruthy();
  });
});
