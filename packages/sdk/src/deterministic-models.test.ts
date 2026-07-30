import { describe, it, expect } from "vitest";
import { createDeterministicLanguageModel } from "./deterministic-models";

describe("deterministic-models", () => {
  describe("createDeterministicLanguageModel", () => {
    it("generates default output", async () => {
      const model = createDeterministicLanguageModel();
      const result = await model.generate("test prompt");
      expect(result.text).toBe("Hello from deterministic model");
      expect(result.finishReason).toBe("stop");
      expect(result.usage?.completionTokens).toBe(5);
    });

    it("generates scripted output per prompt", async () => {
      const model = createDeterministicLanguageModel("my-model", "test", {
        outputs: {
          "hello": { text: "Hi there!", finishReason: "stop" },
        },
      });
      expect((await model.generate("hello")).text).toBe("Hi there!");
      expect((await model.generate("unknown")).text).toBe("Hello from deterministic model");
    });

    it("records call history", async () => {
      const model = createDeterministicLanguageModel();
      await model.generate("first");
      await model.generate("second");
      const history = model.getCallHistory();
      expect(history).toHaveLength(2);
      expect(history[0].prompt).toBe("first");
      expect(history[1].prompt).toBe("second");
    });

    it("stream yields configured chunks", async () => {
      const model = createDeterministicLanguageModel("stream-model", "test", {
        chunks: [
          { type: "text", textDelta: "A" },
          { type: "text", textDelta: "B" },
          { type: "finish", finishReason: "stop" },
        ],
      });
      const chunks: string[] = [];
      for await (const chunk of model.stream("test")) {
        if (chunk.type === "text") chunks.push(chunk.textDelta!);
      }
      expect(chunks).toEqual(["A", "B"]);
    });

    it("configure updates behavior at runtime", async () => {
      const model = createDeterministicLanguageModel();
      model.configure({ shouldThrow: true, throwMessage: "Custom error" });
      await expect(model.generate("fail")).rejects.toThrow("Custom error");
      model.configure({ shouldThrow: false });
      await expect(model.generate("ok")).resolves.toBeDefined();
    });

    it("reset clears call history", async () => {
      const model = createDeterministicLanguageModel();
      await model.generate("test");
      expect(model.getCallHistory()).toHaveLength(1);
      model.reset();
      expect(model.getCallHistory()).toHaveLength(0);
    });

    it("config supports custom modelId and provider", () => {
      const model = createDeterministicLanguageModel("custom-model", "custom-provider");
      expect(model.modelId).toBe("custom-model");
      expect(model.provider).toBe("custom-provider");
    });

    it("applies maxTokens option", async () => {
      const model = createDeterministicLanguageModel("", "", {
        defaultOutput: { text: "long text", finishReason: "stop", usage: { promptTokens: 5, completionTokens: 100 } },
      });
      const result = await model.generate("test", { maxTokens: 10 });
      expect(result.usage!.completionTokens).toBe(10);
    });

    it("applies latencyMs", async () => {
      const model = createDeterministicLanguageModel("", "", { latencyMs: 10 });
      const start = Date.now();
      await model.generate("test");
      expect(Date.now() - start).toBeGreaterThanOrEqual(8);
    });
  });
});
