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

  it("blocks anonymous from hosted rooms overlay", async () => {
    const result = await runFluxyRoomAuthz(
      "lobby-1",
      { userId: "anon_x", roles: ["guest"], projectId: "proj_1" },
      {
        env: {
          DB: {
            prepare: () => ({
              bind: () => ({
                first: async () => ({
                  deny_substrings: "[]",
                  guest_can_publish: 1,
                  rooms_json: JSON.stringify({ "lobby-*": { anonymous: false } }),
                }),
              }),
            }),
          },
        },
      },
    );
    expect(result.action).toBe("block");
  });

  it("blocks deny substrings from D1 publish-config", async () => {
    const result = await runFluxyPublishPipeline(
      "room-general",
      { userId: "user_1", projectId: "proj_1", roles: ["member"] },
      "hello secretcode",
      {
        capabilities: { publish: true },
        env: {
          DB: {
            prepare: () => ({
              bind: () => ({
                first: async () => ({
                  deny_substrings: JSON.stringify(["secretcode"]),
                  guest_can_publish: 1,
                }),
              }),
            }),
          },
        },
      },
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/publish rules/i);
  });
});
