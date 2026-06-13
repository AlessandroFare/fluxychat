import { describe, expect, it } from "vitest";
import { isValidClientWsPayload } from "./ws-protocol.js";

describe("ws-protocol", () => {
  it("accepts Room DO client events", () => {
    expect(isValidClientWsPayload({ type: "message", content: "hi" })).toBe(true);
    expect(isValidClientWsPayload({ type: "typing", isTyping: true })).toBe(true);
  });

  it("rejects unknown client events", () => {
    expect(isValidClientWsPayload({ type: "subscribe" })).toBe(false);
    expect(isValidClientWsPayload("not-json")).toBe(false);
  });
});
