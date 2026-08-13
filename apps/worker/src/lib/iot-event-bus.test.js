import { describe, it, expect, vi } from "vitest";
import { ingestIotDeviceEvent } from "./iot-event-bus.js";

vi.mock("./message-realtime-fanout.js", () => ({
  fanoutPersistedMessage: vi.fn(async () => ({})),
}));

vi.mock("./ambient-agents.js", () => ({
  maybeTriggerAmbientAgentsOnMessage: vi.fn(async () => ({ triggered: 1 })),
}));

function makeEnv() {
  return {
    DB: {
      prepare: vi.fn(() => ({
        bind: vi.fn(() => ({
          run: vi.fn(async () => ({ meta: { last_row_id: 42 } })),
        })),
      })),
    },
  };
}

describe("NW-206 iot-event-bus", () => {
  it("ingests device event as room message", async () => {
    const result = await ingestIotDeviceEvent(makeEnv(), {
      projectId: "p1",
      roomId: "r1",
      deviceId: "sensor-01",
      eventType: "temperature",
      payload: { value: 22.5 },
    });
    expect(result.ok).toBe(true);
    expect(result.messageId).toBe(42);
    expect(result.content).toContain("sensor-01");
    expect(result.ambient.triggered).toBe(1);
  });
});
