import { describe, expect, it } from "vitest";
import { generate, stream } from "./generation";
import { AIProviderRegistry, DeterministicLanguageModel } from "./providers";

describe("AIProviderRegistry", () => {
  it("resolves provider:model references and aliases", () => {
    const model = new DeterministicLanguageModel("hello");
    const registry = new AIProviderRegistry().register(model, { aliases: ["default"] });
    expect(registry.resolve("fluxy-test:deterministic")).toBe(model);
    expect(registry.resolve("default")).toBe(model);
    expect(registry.list()).toEqual(["fluxy-test:deterministic"]);
  });

  it("rejects duplicate registrations by default", () => {
    const registry = new AIProviderRegistry().register(new DeterministicLanguageModel("one"));
    expect(() => registry.register(new DeterministicLanguageModel("two"))).toThrow(/already registered/);
  });
});

describe("generation", () => {
  it("normalizes prompts and generation results", async () => {
    const model = new DeterministicLanguageModel((request) => `${request.prompt[0]?.role}:${request.prompt[1]?.role}`);
    const result = await generate({ model, system: "Be concise", prompt: "Hello" });
    expect(result.text).toBe("system:user");
    expect(result.finishReason).toBe("stop");
    expect(result.usage.totalTokens).toBe(3);
  });

  it("streams canonical parts and exposes a final result", async () => {
    const streamed = stream({ model: new DeterministicLanguageModel("hello"), prompt: "Hello" });
    const parts = [];
    const reader = streamed.stream.getReader();
    for (;;) {
      const next = await reader.read();
      if (next.done) break;
      parts.push(next.value);
    }
    expect(parts.map((part) => part.type)).toEqual(["start", "text-start", "text-delta", "text-end", "finish"]);
    await expect(streamed.text).resolves.toBe("hello");
  });
});
