import { describe, expect, it } from "vitest";
import { mapVoiceBridgeEvent } from "./voice-room-bridge";

describe("mapVoiceBridgeEvent", () => {
  it("defaults participantType to ai", () => {
    const event = mapVoiceBridgeEvent({ source: "pipecat", text: "hello" });
    expect(event.participantType).toBe("ai");
    expect(event.kind).toBe("transcript");
  });
});
