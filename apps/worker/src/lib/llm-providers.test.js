import { describe, expect, it } from "vitest";
import {
  resolveLlmConnection,
  resolveLlmConnectionWithFallback,
  parseAgentLlmConfig,
  parseModelRef,
  normalizeAgentLlmFields,
  expandModelShortcut,
  formatModelRef,
  listLlmProvidersForApi,
} from "./llm-providers.js";

describe("parseModelRef", () => {
  it("splits provider/model composite", () => {
    expect(parseModelRef(null, "anthropic/claude-sonnet-4-20250514")).toEqual({
      providerId: "anthropic",
      modelId: "claude-sonnet-4-20250514",
      modelRef: "anthropic/claude-sonnet-4-20250514",
    });
  });

  it("keeps openrouter vendor/model id intact", () => {
    expect(parseModelRef("openrouter", "openai/gpt-4o-mini")).toEqual({
      providerId: "openrouter",
      modelId: "openai/gpt-4o-mini",
      modelRef: "openai/gpt-4o-mini",
    });
  });

  it("expands shortcuts", () => {
    expect(parseModelRef(null, "minimax-free")).toEqual({
      providerId: "zencode",
      modelId: "minimax-m2.5-free",
      modelRef: "zencode/minimax-m2.5-free",
    });
  });
});

describe("resolveLlmConnection", () => {
  it("resolves OpenAI from env", async () => {
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

  it("requires base URL for zencode without env", async () => {
    const conn = await resolveLlmConnection({}, { provider: "zencode", model: "minimax-m2.5-free" });
    expect(conn.ok).toBe(false);
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
  it("returns providers with model capabilities", async () => {
    const catalog = await listLlmProvidersForApi({ AI_API_KEY: "x" }, {});
    expect(catalog.providers.length).toBeGreaterThan(5);
    const openai = catalog.providers.find((p) => p.id === "openai");
    expect(openai?.models[0]?.capabilities?.toolUsage).toBe(true);
    expect(catalog.capabilityLegend).toBeDefined();
  });
});
