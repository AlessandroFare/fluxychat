import { describe, it, expect } from "vitest";
import {
  wrapLanguageModel,
  extractReasoningMiddleware,
  defaultSettingsMiddleware,
  extractJsonMiddleware,
  simulateStreamingFromGenerate,
} from "./middleware";
import { DeterministicLanguageModel } from "./providers";

describe("wrapLanguageModel", () => {
  it("returns a model with the same provider/modelId", () => {
    const inner = new DeterministicLanguageModel("hello");
    const wrapped = wrapLanguageModel({ model: inner, middleware: [] });
    expect(wrapped.provider).toBe("fluxy-test");
    expect(wrapped.modelId).toBe("deterministic");
  });

  it("passthrough generate works", async () => {
    const inner = new DeterministicLanguageModel("hello world");
    const wrapped = wrapLanguageModel({ model: inner, middleware: [] });
    const result = await wrapped.generate({ prompt: [] });
    expect(result.text).toBe("hello world");
  });

  it("defaultSettingsMiddleware applies defaults", async () => {
    const inner = new DeterministicLanguageModel((req) => `temp=${req.temperature}`);
    const wrapped = wrapLanguageModel({
      model: inner,
      middleware: defaultSettingsMiddleware({ settings: { temperature: 0.7 } }),
    });
    const result = await wrapped.generate({ prompt: [] });
    expect(result.text).toBe("temp=0.7");
  });

  it("defaultSettingsMiddleware does not override explicit settings", async () => {
    const inner = new DeterministicLanguageModel((req) => `temp=${req.temperature}`);
    const wrapped = wrapLanguageModel({
      model: inner,
      middleware: defaultSettingsMiddleware({ settings: { temperature: 0.7 } }),
    });
    const result = await wrapped.generate({ prompt: [], temperature: 0.3 });
    expect(result.text).toBe("temp=0.3");
  });

  it("extractReasoningMiddleware removes think tags", async () => {
    const inner = new DeterministicLanguageModel("<think>step 1</think> answer");
    const wrapped = wrapLanguageModel({
      model: inner,
      middleware: extractReasoningMiddleware({ tagName: "think" }),
    });
    const result = await wrapped.generate({ prompt: [] });
    expect(result.text).toBe("answer");
    expect(result.reasoningText).toBe("step 1");
  });

  it("extractJsonMiddleware strips markdown fences", async () => {
    const inner = new DeterministicLanguageModel("```json\n{\"key\": \"value\"}\n```");
    const wrapped = wrapLanguageModel({
      model: inner,
      middleware: extractJsonMiddleware(),
    });
    const result = await wrapped.generate({ prompt: [] });
    expect(result.text).toBe('{"key": "value"}');
  });

  it("multiple middlewares chain correctly", async () => {
    let callOrder: string[] = [];
    const mw1 = {
      transformParams: async ({ params }: any) => {
        callOrder.push("transform1");
        return params;
      },
    };
    const mw2 = {
      transformParams: async ({ params }: any) => {
        callOrder.push("transform2");
        return params;
      },
    };
    const inner = new DeterministicLanguageModel("test");
    const wrapped = wrapLanguageModel({ model: inner, middleware: [mw1, mw2] });
    await wrapped.generate({ prompt: [] });
    expect(callOrder).toEqual(["transform1", "transform2"]);
  });

  it("simulateStreamingFromGenerate creates stream from non-streaming model", async () => {
    const inner = new DeterministicLanguageModel("hello streaming");
    const sim = simulateStreamingFromGenerate(inner);
    const stream = await sim.stream({ prompt: [] });
    const reader = stream.getReader();
    const parts: any[] = [];
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      parts.push(value);
    }
    expect(parts.length).toBeGreaterThan(1);
    const textPart = parts.find((p) => p.type === "text-delta");
    expect(textPart.delta).toBe("h");
    const finishPart = parts.find((p) => p.type === "finish");
    expect(finishPart.finishReason).toBe("stop");
  });
});
