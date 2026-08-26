import { describe, expect, it } from "vitest";
import { PLATFORM_READINESS } from "./readiness";

describe("PLATFORM_READINESS", () => {
  it("marks chat as production and verticals as labs", () => {
    expect(PLATFORM_READINESS.chat.readiness).toBe("production");
    expect(PLATFORM_READINESS.collab.readiness).toBe("beta");
    expect(PLATFORM_READINESS.iot.readiness).toBe("beta");
    expect(PLATFORM_READINESS.fleet.readiness).toBe("beta");
    expect(PLATFORM_READINESS.game.readiness).toBe("beta");
    expect(PLATFORM_READINESS.stream.readiness).toBe("labs");
    expect(PLATFORM_READINESS.edu.readiness).toBe("labs");
    expect(PLATFORM_READINESS.health.readiness).toBe("labs");
  });
});
