import { describe, expect, it } from "vitest";
import { PLATFORM_READINESS } from "./readiness";

describe("PLATFORM_READINESS", () => {
  it("keeps the kernel as production", () => {
    expect(PLATFORM_READINESS.chat.readiness).toBe("production");
    expect(PLATFORM_READINESS.collab.readiness).toBe("production");
  });

  it("points huddles at Realtime SFU", () => {
    expect(PLATFORM_READINESS.huddles.description).toMatch(/Realtime SFU/);
    expect(PLATFORM_READINESS.huddles.readiness).toBe("labs");
  });

  it("does not stamp verticals as hosted GA", () => {
    expect(PLATFORM_READINESS.iot.readiness).toBe("beta");
    expect(PLATFORM_READINESS.web3.readiness).toBe("beta");
    expect(PLATFORM_READINESS.marketplace.readiness).toBe("beta");
    expect(PLATFORM_READINESS.health.readiness).toBe("labs");
    expect(PLATFORM_READINESS.transport.readiness).toBe("labs");
  });

  it("keeps HIPAA and SLA out of the copy", () => {
    expect(PLATFORM_READINESS.health.description).toMatch(/No HIPAA/);
    expect(PLATFORM_READINESS.voice.description).toMatch(/No unpublished latency SLA/);
  });
});
