import { describe, it, expect } from "vitest";
import { createDevToolsStore, createDevToolsInspector } from "./devtools";

describe("devtools", () => {
  describe("createDevToolsStore", () => {
    it("starts empty", () => {
      const store = createDevToolsStore();
      expect(store.getRuns()).toEqual([]);
      expect(store.getSteps("any")).toEqual([]);
    });

    it("addRun and getRun", () => {
      const store = createDevToolsStore();
      store.addRun({ id: "run-1", startedAt: 100, steps: [] });
      expect(store.getRun("run-1")?.id).toBe("run-1");
    });

    it("addStep associates with run", () => {
      const store = createDevToolsStore();
      store.addRun({ id: "run-1", startedAt: 100, steps: [] });
      store.addStep({ id: "step-1", runId: "run-1", stepNumber: 1, type: "generateText", startedAt: 150 });
      const steps = store.getSteps("run-1");
      expect(steps).toHaveLength(1);
      expect(steps[0].id).toBe("step-1");
    });

    it("updateRun patches run fields", () => {
      const store = createDevToolsStore();
      store.addRun({ id: "run-1", startedAt: 100, steps: [] });
      store.updateRun("run-1", { finishedAt: 200 });
      expect(store.getRun("run-1")?.finishedAt).toBe(200);
    });

    it("clear removes all data", () => {
      const store = createDevToolsStore();
      store.addRun({ id: "run-1", startedAt: 100, steps: [] });
      store.clear();
      expect(store.getRuns()).toEqual([]);
    });
  });

  describe("createDevToolsInspector", () => {
    it("captureGenerateText creates step", () => {
      const inspector = createDevToolsInspector();
      inspector.getStore().addRun({ id: "run-1", startedAt: 100, steps: [] });
      const step = inspector.captureGenerateText("run-1", 1, { model: "gpt-4", provider: "openai" });
      expect(step.type).toBe("generateText");
      expect(step.modelId).toBe("gpt-4");
    });

    it("captureStreamText creates step", () => {
      const inspector = createDevToolsInspector();
      inspector.getStore().addRun({ id: "run-1", startedAt: 100, steps: [] });
      const step = inspector.captureStreamText("run-1", 1, { model: "claude-3" });
      expect(step.type).toBe("streamText");
    });

    it("captureToolCall adds to step's toolCalls", () => {
      const inspector = createDevToolsInspector();
      inspector.getStore().addRun({ id: "run-1", startedAt: 100, steps: [] });
      const step = inspector.captureGenerateText("run-1", 1, {});
      inspector.captureToolCall(step.id, "weather", { location: "NYC" }, { temp: 72 }, 100);
      const steps = inspector.getStore().getSteps("run-1");
      expect(steps[0].toolCalls).toHaveLength(1);
      expect(steps[0].toolCalls![0].toolName).toBe("weather");
    });

    it("works with custom store", () => {
      const store = createDevToolsStore();
      const inspector = createDevToolsInspector(store);
      expect(inspector.getStore()).toBe(store);
    });
  });
});
