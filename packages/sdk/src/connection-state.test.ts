import { describe, expect, it } from "vitest";
import {
  buildFluxyConnectionState,
  getConnectionStatusLabel,
  isDegradedConnectionStatus,
  normalizeConnectionStateStatus,
} from "./connection-state";

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

  it("maps sse and polling transports (legacy → degraded-http)", () => {
    expect(buildFluxyConnectionState({ status: "sse" }).status).toBe("degraded-http");
    expect(buildFluxyConnectionState({ status: "sse" }).transport).toBe("sse");
    expect(buildFluxyConnectionState({ status: "polling" }).status).toBe("degraded-http");
    expect(buildFluxyConnectionState({ status: "polling" }).transport).toBe("polling");
  });

  it("degraded-http with explicit transport", () => {
    const state = buildFluxyConnectionState({
      status: "degraded-http",
      transport: "sse",
    });
    expect(state.status).toBe("degraded-http");
    expect(state.transport).toBe("sse");
  });

  it("normalize and isDegraded helpers", () => {
    expect(normalizeConnectionStateStatus("polling")).toBe("degraded-http");
    expect(isDegradedConnectionStatus("degraded-http")).toBe(true);
    expect(isDegradedConnectionStatus("degraded")).toBe(true);
    expect(isDegradedConnectionStatus("connected")).toBe(false);
  });

  it("exposes canPublishViaHttp for degraded-http REST fallback", () => {
    expect(
      buildFluxyConnectionState({ status: "connected" }).canPublishViaHttp,
    ).toBe(false);
    expect(
      buildFluxyConnectionState({
        status: "degraded-http",
        transport: "polling",
        canPublishViaHttp: true,
      }).canPublishViaHttp,
    ).toBe(true);
  });
});

describe("getConnectionStatusLabel", () => {
  it("maps Portal-style statuses to UI copy", () => {
    expect(getConnectionStatusLabel("connected")).toBe("Connected");
    expect(getConnectionStatusLabel("blocked")).toBe("Connection blocked");
    expect(getConnectionStatusLabel("degraded")).toBe("Degraded — realtime limited");
    expect(getConnectionStatusLabel("degraded-http", { includeTransport: true })).toBe(
      "Degraded — HTTP fallback active",
    );
    expect(getConnectionStatusLabel("sse", { includeTransport: true })).toBe("Degraded — live via SSE");
    expect(getConnectionStatusLabel("polling", { includeTransport: true })).toBe("Degraded — live via polling");
  });

  it("shows reconnect countdown when nextRetryAt is set", () => {
    const label = getConnectionStatusLabel("reconnecting", {
      nextRetryAt: new Date(10_000).toISOString(),
      nowMs: 5_000,
    });
    expect(label).toBe("Reconnecting in 5s…");
  });
});
