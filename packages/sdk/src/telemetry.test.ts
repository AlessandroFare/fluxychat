import { describe, it, expect, vi } from "vitest";
import {
  createTelemetryManager,
  registerTelemetry,
  OpenTelemetryIntegration,
  DevToolsTelemetryIntegration,
} from "./telemetry";

describe("telemetry", () => {
  describe("createTelemetryManager", () => {
    it("creates manager with no integrations initially", () => {
      const m = createTelemetryManager();
      expect(m.getIntegrations()).toEqual([]);
    });

    it("register adds integration", () => {
      const m = createTelemetryManager();
      const integration = { onStart: vi.fn() };
      m.register(integration);
      expect(m.getIntegrations()).toHaveLength(1);
    });

    it("unregister removes integration", () => {
      const m = createTelemetryManager();
      const integration = { onStart: vi.fn() };
      m.register(integration);
      m.unregister(integration);
      expect(m.getIntegrations()).toHaveLength(0);
    });

    it("createSpan creates span with id and parent", () => {
      const m = createTelemetryManager();
      const parent = m.createSpan("parent");
      const child = m.createSpan("child", parent.id);
      expect(parent.children).toHaveLength(1);
      expect(child.parentId).toBe(parent.id);
    });

    it("endSpan sets endTime and status", () => {
      const m = createTelemetryManager();
      const span = m.createSpan("test");
      m.endSpan(span.id, "error");
      const spans = m.getSpans();
      const found = spans.find((s) => s.id === span.id)!;
      expect(found.status).toBe("error");
      expect(found.endTime).toBeDefined();
    });

    it("record stores event and calls integration", async () => {
      const m = createTelemetryManager();
      const onStart = vi.fn();
      m.register({ onStart });
      m.record({ phase: "onStart", event: { type: "generateText", timestamp: Date.now() } });
      await new Promise((r) => setTimeout(r, 10));
      expect(onStart).toHaveBeenCalled();
      expect(m.getEvents()).toHaveLength(1);
    });

    it("disabled manager does not call integrations", async () => {
      const m = createTelemetryManager({ isEnabled: false });
      const onStart = vi.fn();
      m.register({ onStart });
      m.record({ phase: "onStart", event: { type: "test", timestamp: Date.now() } });
      await new Promise((r) => setTimeout(r, 10));
      expect(onStart).not.toHaveBeenCalled();
    });

    it("integration errors are caught and logged", () => {
      const m = createTelemetryManager();
      const onStart = vi.fn().mockRejectedValue(new Error("integration fail"));
      m.register({ onStart });
      expect(() => {
        m.record({ phase: "onStart", event: { type: "test", timestamp: Date.now() } });
      }).not.toThrow();
    });
  });

  describe("registerTelemetry", () => {
    it("delegates to manager.register", () => {
      const m = createTelemetryManager();
      const integration = { onStart: vi.fn() };
      registerTelemetry(m, integration);
      expect(m.getIntegrations()).toContain(integration);
    });
  });

  describe("OpenTelemetryIntegration", () => {
    it("calls tracer.startSpan on onStart", () => {
      const startSpan = vi.fn().mockReturnValue({ end: vi.fn(), recordError: vi.fn() });
      const otel = new OpenTelemetryIntegration({ startSpan });
      otel.onStart({ type: "generateText", timestamp: Date.now(), functionId: "test" });
      expect(startSpan).toHaveBeenCalled();
    });

    it("does not throw when no tracer provided", async () => {
      const otel = new OpenTelemetryIntegration();
      await expect(otel.onStart({ type: "test", timestamp: Date.now() })).resolves.toBeUndefined();
    });
  });

  describe("DevToolsTelemetryIntegration", () => {
    it("captures runs on onStart/onEnd", () => {
      const dev = new DevToolsTelemetryIntegration();
      dev.onStart({ type: "generateText", timestamp: Date.now() });
      dev.onEnd({ type: "generateText", timestamp: Date.now() });
      expect(dev.getRuns()).toHaveLength(1);
    });

    it("captures steps via onStepStart", () => {
      const dev = new DevToolsTelemetryIntegration();
      dev.onStart({ type: "streamText", timestamp: Date.now() });
      dev.onStepStart({ type: "step", timestamp: Date.now() });
      dev.onStepEnd({ type: "step", timestamp: Date.now() });
      const run = dev.getRuns()[0];
      expect(run.events).toHaveLength(2);
    });
  });
});
