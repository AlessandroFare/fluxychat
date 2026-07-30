import { describe, it, expect } from "vitest";
import { createPlatformAdapter } from "./platform-adapter";

describe("createPlatformAdapter", () => {
  it("returns supported platforms", () => {
    const pa = createPlatformAdapter();
    const platforms = pa.getSupportedPlatforms();
    expect(platforms).toContain("whatsapp");
    expect(platforms).toContain("telegram");
    expect(platforms).toContain("messenger");
  });

  it("sends message to platform", async () => {
    const pa = createPlatformAdapter();
    const msg = await pa.send({ platform: "whatsapp", enabled: true }, "Hello", "user-123");
    expect(msg.platform).toBe("whatsapp");
    expect(msg.content).toBe("Hello");
  });

  it("register returns webhook URL", () => {
    const pa = createPlatformAdapter();
    const url = pa.register("app-1");
    expect(url).toContain("webhook_app-1");
  });
});
