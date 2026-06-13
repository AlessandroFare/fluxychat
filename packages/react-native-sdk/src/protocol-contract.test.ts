import { describe, expect, it } from "vitest";
import { FLUXY_OUTBOUND_EVENT_TYPES, isFluxyInboundEvent } from "@fluxychat/protocol";

describe("@fluxychat/react-native-sdk protocol parity", () => {
  it("shares outbound event registry with worker Room DO", () => {
    expect(FLUXY_OUTBOUND_EVENT_TYPES).toContain("message");
    expect(FLUXY_OUTBOUND_EVENT_TYPES).toContain("edit");
  });

  it("recognizes inbound message events", () => {
    expect(isFluxyInboundEvent({ type: "message", id: 1 })).toBe(true);
  });
});
