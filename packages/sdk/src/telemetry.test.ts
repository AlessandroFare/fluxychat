import { describe, expect, it, vi } from "vitest";
import {
  createConsoleTelemetryIntegration,
  createOtlpTelemetryIntegration,
  createTelemetryManager,
} from "./telemetry.js";

describe("createConsoleTelemetryIntegration", () => {
  it("logs lifecycle phases", () => {
    const info = vi.fn();
    const integration = createConsoleTelemetryIntegration({ log: { info, warn: vi.fn(), debug: vi.fn() } });
    const manager = createTelemetryManager();
    manager.register(integration);
    manager.record({
      phase: "onStart",
      event: { type: "start", timestamp: Date.now(), functionId: "agent-1" },
    });
    expect(info).toHaveBeenCalled();
  });
});

describe("createOtlpTelemetryIntegration", () => {
  it("POSTs OTLP JSON to configured endpoint", async () => {
    const fetchImpl = vi.fn(async () => new Response(null, { status: 200 }));
    const integration = createOtlpTelemetryIntegration({
      endpoint: "http://localhost:4318/v1/traces",
      fetchImpl,
      serviceName: "test-sdk",
    });
    const manager = createTelemetryManager();
    manager.register(integration);
    manager.record({
      phase: "onStart",
      event: { type: "start", timestamp: Date.now(), functionId: "demo" },
    });
    manager.record({
      phase: "onEnd",
      event: { type: "end", timestamp: Date.now(), functionId: "demo" },
    });
    await new Promise((r) => setTimeout(r, 10));
    expect(fetchImpl).toHaveBeenCalled();
    const [, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(init.method).toBe("POST");
    expect(String(init.body)).toContain("test-sdk");
  });
});
