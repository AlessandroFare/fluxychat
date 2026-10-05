import { describe, expect, it } from "vitest";
import { mapVoiceBridgeEvent } from "./voice-room-bridge.js";

describe("mapVoiceBridgeEvent", () => {
  it("maps a LiveKit transcript as IA", () => {
    const mapped = mapVoiceBridgeEvent({
      source: "livekit-agents",
      kind: "transcript",
      text: "hold please",
    });
    expect(mapped.ok).toBe(true);
    expect(mapped.event.participantType).toBe("ai");
    expect(mapped.event.source).toBe("livekit-agents");
  });

  it("rejects media-only payloads and unknown SFU sources", () => {
    expect(mapVoiceBridgeEvent({ source: "livekit-sfu", text: "x" }).ok).toBe(false);
    expect(mapVoiceBridgeEvent({ source: "pipecat" }).ok).toBe(false);
  });
});
