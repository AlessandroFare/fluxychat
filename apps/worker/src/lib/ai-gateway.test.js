import { describe, expect, it } from "vitest";
import {
  buildAiAuthHeaders,
  getAiGatewayConnectionOverrides,
  isAiConfigured,
  isAiGatewayEnabled,
  resolveAiTransport,
} from "./ai-gateway.js";

describe("ai-gateway", () => {
  it("detects gateway from account + id", () => {
    const env = {
      AI_GATEWAY_ACCOUNT_ID: "acc_123",
      AI_GATEWAY_ID: "fluxy-chat",
    };
    expect(isAiGatewayEnabled(env)).toBe(true);
    const transport = resolveAiTransport(env);
    expect(transport.mode).toBe("gateway");
    expect(transport.chatCompletionsUrl).toBe(
      "https://gateway.ai.cloudflare.com/v1/acc_123/fluxy-chat/openai/chat/completions",
    );
    expect(transport.transcriptionsUrl).toContain("/audio/transcriptions");
  });

  it("strips trailing slashes without regex on legacy base URL", () => {
    const slashes = "/".repeat(200);
    const env = { AI_BASE_URL: `https://api.openai.com${slashes}` };
    const transport = resolveAiTransport(env);
    expect(transport.chatCompletionsUrl).toBe("https://api.openai.com/v1/chat/completions");
  });

  it("falls back to AI_BASE_URL when gateway unset", () => {
    const env = { AI_BASE_URL: "https://api.openai.com" };
    expect(isAiGatewayEnabled(env)).toBe(false);
    expect(isAiConfigured(env)).toBe(true);
    const transport = resolveAiTransport(env);
    expect(transport.mode).toBe("direct");
    expect(transport.chatCompletionsUrl).toBe("https://api.openai.com/v1/chat/completions");
  });

  it("buildAiAuthHeaders sets gateway cache and metadata", () => {
    const env = {
      AI_GATEWAY_ACCOUNT_ID: "acc",
      AI_GATEWAY_ID: "gw",
      AI_GATEWAY_TOKEN: "cf-token",
      AI_GATEWAY_PROVIDER_KEY: "sk-openai",
      AI_GATEWAY_CACHE_TTL: "3600",
    };
    const headers = buildAiAuthHeaders(env, {
      metadata: { projectId: "proj_1", feature: "digest" },
    });
    expect(headers.Authorization).toBe("Bearer cf-token");
    expect(headers["cf-aig-authorization"]).toBe("Bearer sk-openai");
    expect(headers["cf-aig-cache-ttl"]).toBe("3600");
    expect(headers["cf-aig-metadata"]).toContain("proj_1");
  });

  it("getAiGatewayConnectionOverrides returns urls for agent path", () => {
    const env = {
      AI_GATEWAY_URL: "https://gateway.ai.cloudflare.com/v1/a/g/openai",
      AI_API_KEY: "sk-test",
    };
    const overrides = getAiGatewayConnectionOverrides(env, {
      useGateway: true,
      projectId: "proj_1",
    });
    expect(overrides.chatCompletionsUrl).toContain("/chat/completions");
    expect(overrides.gatewayHeaders?.Authorization).toBeTruthy();
  });

  it("exposes anthropic messages URL next to openai chat completions", () => {
    const env = {
      AI_GATEWAY_ACCOUNT_ID: "acc_123",
      AI_GATEWAY_ID: "fluxy-chat",
    };
    const transport = resolveAiTransport(env);
    expect(transport.anthropicMessagesUrl).toBe(
      "https://gateway.ai.cloudflare.com/v1/acc_123/fluxy-chat/anthropic/v1/messages",
    );
  });
});
