import { describe, expect, it } from "vitest";
import { createFluxyChatAdapter, createFluxyChatSdkAdapter, formatFluxyChatThreadId, parseFluxyChatThreadId } from "./index";

describe("chat-adapter-fluxychat", () => {
  it("parses fluxychat:room ids", () => {
    expect(parseFluxyChatThreadId("fluxychat:deal-1")).toEqual({ roomId: "deal-1" });
    expect(formatFluxyChatThreadId("deal-1")).toBe("fluxychat:deal-1");
  });

  it("rejects empty ids", () => {
    expect(() => parseFluxyChatThreadId("fluxychat:")).toThrow("fluxychat_thread_id_empty");
  });

  it("exports the Chat SDK factory alias", () => {
    expect(createFluxyChatAdapter).toBe(createFluxyChatSdkAdapter);
  });
});
