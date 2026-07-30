import { describe, it, expect } from "vitest";
import { AIProviderRegistry, DeterministicLanguageModel } from "./providers";
import { createCustomProvider, createProviderRegistry, ProviderRegistry } from "./provider-registry";

describe("AIProviderRegistry (existing)", () => {
  it("registers and resolves models", () => {
    const registry = new AIProviderRegistry();
    registry.register(new DeterministicLanguageModel("hello", undefined, "my-model"));
    const model = registry.resolve<DeterministicLanguageModel>("fluxy-test:my-model");
    expect(model.modelId).toBe("my-model");
  });
});

describe("createCustomProvider", () => {
  it("creates a registry with language models", () => {
    const registry = createCustomProvider({
      languageModels: {
        "fast": new DeterministicLanguageModel("fast", undefined, "fast-model"),
        "reasoning": new DeterministicLanguageModel("deep", undefined, "deep-model"),
      },
    });
    expect(registry.list()).toContain("fluxy-test:fast-model");
    expect(registry.list()).toContain("fluxy-test:deep-model");
  });

  it("includes fallback provider models", () => {
    const fallback = new AIProviderRegistry();
    fallback.register(new DeterministicLanguageModel("fb", undefined, "fb-model"));
    const registry = createCustomProvider({
      languageModels: { "main": new DeterministicLanguageModel("main", undefined, "main-model") },
      fallbackProvider: fallback,
    });
    expect(registry.list()).toContain("fluxy-test:main-model");
    expect(registry.list()).toContain("fluxy-test:fb-model");
  });
});

describe("ProviderRegistry", () => {
  it("resolves models with provider:model notation", () => {
    const reg = new ProviderRegistry({
      "fluxy-test": new AIProviderRegistry().register(
        new DeterministicLanguageModel("gpt response", undefined, "gpt-4"),
      ),
    });
    const model = reg.languageModel("fluxy-test:gpt-4");
    expect(model.modelId).toBe("gpt-4");
  });

  it("supports custom separator", () => {
    const reg = new ProviderRegistry(
      {
        "fluxy-test": new AIProviderRegistry().register(
          new DeterministicLanguageModel("claude response", undefined, "claude-3"),
        ),
      },
      { separator: " > " },
    );
    const model = reg.languageModel("fluxy-test > claude-3");
    expect(model.modelId).toBe("claude-3");
  });

  it("throws for unknown provider", () => {
    const reg = new ProviderRegistry({});
    expect(() => reg.languageModel("unknown:model")).toThrow("Unknown provider: unknown");
  });

  it("throws for invalid reference format", () => {
    const reg = new ProviderRegistry({});
    expect(() => reg.languageModel("no-separator")).toThrow('Invalid model reference "no-separator"');
  });
});

describe("createProviderRegistry", () => {
  it("creates ProviderRegistry with config", () => {
    const registry = createProviderRegistry({
      test: new AIProviderRegistry().register(
        new DeterministicLanguageModel("resp", undefined, "test-model"),
      ),
    });
    expect(registry.hasProvider("test")).toBe(true);
    expect(registry.listProviders()).toEqual(["test"]);
  });
});
