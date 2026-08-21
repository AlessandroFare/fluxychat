import { describe, expect, it } from "vitest";
import { FluxyChatClient } from "./chat";

describe("@fluxy-chat/sdk/chat", () => {
  it("exports the chat client without requiring verticals", () => {
    expect(typeof FluxyChatClient).toBe("function");
  });
});
