import { describe, expect, it } from "vitest";
import { withRuntimeConfig } from "./with-runtime-config.js";

describe("withRuntimeConfig", () => {
  it("fills missing keys from FLUXY_RUNTIME_JSON", () => {
    const env = withRuntimeConfig({
      FLUXY_RUNTIME_JSON: JSON.stringify({ AGENT_QUEUE_SLA_MINUTES: "15", LIVEKIT_URL: "wss://x" }),
      AI_API_KEY: "keep-me",
    });
    expect(env.AGENT_QUEUE_SLA_MINUTES).toBe("15");
    expect(env.AI_API_KEY).toBe("keep-me");
  });

  it("does not override a real Worker secret", () => {
    const env = withRuntimeConfig({
      FLUXY_RUNTIME_JSON: JSON.stringify({ AI_API_KEY: "from-json" }),
      AI_API_KEY: "from-secret",
    });
    expect(env.AI_API_KEY).toBe("from-secret");
  });

  it("passes through when JSON is absent", () => {
    const env = withRuntimeConfig({ REALTIME_SFU_APP_ID: "app" });
    expect(env.REALTIME_SFU_APP_ID).toBe("app");
  });
});
