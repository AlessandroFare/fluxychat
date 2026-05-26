import { describe, expect, it } from "vitest";
import { buildFluxyConnectionState } from "./connection-state";

describe("buildFluxyConnectionState", () => {
  it("sets nextRetryAt when reconnecting with delay", () => {
    const state = buildFluxyConnectionState({
      status: "reconnecting",
      retryAttempt: 2,
      reconnectDelayMs: 3000,
      nowMs: 1_000_000,
    });
    expect(state.nextRetryAt).toBe(new Date(1_003_000).toISOString());
    expect(state.transport).toBe("websocket");
  });

  it("clears nextRetryAt when connected", () => {
    const state = buildFluxyConnectionState({
      status: "connected",
      retryAttempt: 0,
    });
    expect(state.nextRetryAt).toBeNull();
  });

  it("maps sse and polling transports", () => {
    expect(buildFluxyConnectionState({ status: "sse" }).transport).toBe("sse");
    expect(buildFluxyConnectionState({ status: "polling" }).transport).toBe("polling");
  });
});
