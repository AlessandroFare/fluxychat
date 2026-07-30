import { describe, expect, it } from "vitest";
import {
  getFluxyClientDefaults,
  runFluxyRoomAuthz,
  runFluxyPublishPipeline,
} from "./fluxy-config-runtime.js";

describe("fluxy-config-runtime", () => {
  it("exposes client defaults from fluxy.config.js", () => {
    const defaults = getFluxyClientDefaults();
    expect(defaults.readOn).toBe("visible");
    expect(defaults.wsCache).toBe("on");
  });

  it("blocks anonymous on support-* rooms", async () => {
    const result = await runFluxyRoomAuthz("support-1", {
      userId: "anon_abc",
      roles: ["guest"],
    });
    expect(result.action).toBe("block");
  });

  it("runs publish middleware from config", async () => {
    const result = await runFluxyPublishPipeline(
      "room-general",
      { userId: "user_1" },
      "hello badword",
      { capabilities: { publish: true } },
    );
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.content).toContain("****");
  });
});
