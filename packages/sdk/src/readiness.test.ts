import { describe, expect, it } from "vitest";
import { PLATFORM_READINESS } from "./readiness";

describe("PLATFORM_READINESS", () => {
  it("marks product modules as production", () => {
    expect(PLATFORM_READINESS.chat.readiness).toBe("production");
    expect(PLATFORM_READINESS.iot.readiness).toBe("production");
    expect(PLATFORM_READINESS.health.readiness).toBe("production");
    expect(PLATFORM_READINESS.web3.readiness).toBe("production");
    expect(PLATFORM_READINESS.marketplace.readiness).toBe("production");
  });

  it("keeps HIPAA and SLA out of the copy", () => {
    expect(PLATFORM_READINESS.health.description).toMatch(/No HIPAA/);
    expect(PLATFORM_READINESS.voice.description).toMatch(/No unpublished latency SLA/);
  });
});
