import { describe, expect, it } from "vitest";
import {
  resolveLlmConnection,
  resolveLlmConnectionWithFallback,
  parseAgentLlmConfig,
  parseModelRef,
  normalizeAgentLlmFields,
  formatModelRef,
  listLlmProvidersForApi,
} from "./llm-providers.js";

describe("parseModelRef", () => {
  it("splits provider/model composite", () => {
    expect(parseModelRef(null, "openai/gpt-4o-mini")).toEqual({
      providerId: "openai",
      modelId: "gpt-4o-mini",
      modelRef: "openai/gpt-4o-mini",
    });
  });

  it("keeps vendor/model when provider is set", () => {
    expect(parseModelRef("openrouter", "openai/gpt-4o-mini")).toEqual({
      providerId: "openrouter",
      modelId: "openai/gpt-4o-mini",
      modelRef: "openrouter/openai/gpt-4o-mini",
    });
  });

  it("falls back to custom when no provider detected", () => {
    expect(parseModelRef(null, "some-model")).toEqual({
      providerId: "custom",
      modelId: "some-model",
      modelRef: "custom/some-model",
    });
  });
});

describe("resolveLlmConnection", () => {
  it("resolves custom provider with base URL and key", async () => {
    const conn = await resolveLlmConnection(
      { AI_API_KEY: "sk-test", AI_BASE_URL: "https://api.openai.com" },
      { provider: "openai", model: "gpt-4o-mini" }
    );
    expect(conn.ok).toBe(true);
    expect(conn.model).toBe("gpt-4o-mini");
  });

  it("does not use worker AI keys for hosted tenants without project credentials", async () => {
    const env = {
      HOSTED_MULTI_TENANT: "true",
      FLUXY_PLATFORM_PROJECT_ID: "platform-1",
      AI_API_KEY: "worker-key",
      AI_BASE_URL: "https://api.openai.com",
      DB: {
        prepare: () => ({
          bind: () => ({
            first: async () => ({
              api_key_ciphertext: null,
              api_key_iv: null,
              base_url: null,
            }),
          }),
        }),
      },
    };
    const conn = await resolveLlmConnection(env, {
      provider: "openai",
      model: "gpt-4o-mini",
      projectId: "tenant-1",
    });
    expect(conn.ok).toBe(true);
    expect(conn.apiKeyConfigured).toBe(false);
    expect(conn.apiKeySource).toBe("none");
  });

  it("prefers project credential over worker env", async () => {
    const env = {
      AI_API_KEY: "worker-key",
      DB: {
        prepare: () => ({
          bind: () => ({
            first: async () => ({
              api_key_ciphertext: null,
              api_key_iv: null,
              base_url: null,
            }),
          }),
        }),
      },
    };
    const conn = await resolveLlmConnection(env, {
      provider: "openai",
      model: "gpt-4o-mini",
      projectId: "proj-1",
    });
    expect(conn.ok).toBe(true);
  });
});

describe("resolveLlmConnectionWithFallback", () => {
  it("uses agent config fallback provider when set", async () => {
    const env = {
      AI_API_KEY: "sk-openai",
      AI_BASE_URL: "https://api.openai.com",
      ANTHROPIC_API_KEY: "sk-ant",
    };
    const { primary, fallback } = await resolveLlmConnectionWithFallback(env, {
      provider: "openai",
      model: "gpt-4o-mini",
      config: { llm: { fallbackProvider: "anthropic", fallbackModel: "claude-sonnet-4-20250514" } },
    });
    expect(primary.ok).toBe(true);
    expect(fallback?.ok).toBe(true);
    expect(fallback?.providerId).toBe("anthropic");
  });
});

describe("listLlmProvidersForApi", () => {
  it("returns custom provider", async () => {
    const catalog = await listLlmProvidersForApi({ AI_API_KEY: "x" }, {});
    expect(catalog.providers.length).toBeGreaterThan(0);
    const custom = catalog.providers.find((p) => p.id === "custom");
    expect(custom).toBeDefined();
    expect(custom?.label).toBe("Custom (OpenAI-compatible)");
  });
});
