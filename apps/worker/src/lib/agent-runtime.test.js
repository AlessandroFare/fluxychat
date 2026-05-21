import { describe, it, expect } from "vitest";
import { mapBotRowToAgent, normalizeMentionHandle } from "./agent-runtime.js";

describe("normalizeMentionHandle", () => {
  it("strips @ and lowercases", () => {
    expect(normalizeMentionHandle("@Assistant")).toBe("assistant");
    expect(normalizeMentionHandle("onboarding")).toBe("onboarding");
  });
});

describe("mapBotRowToAgent", () => {
  it("maps D1 bot row to API agent shape", () => {
    const agent = mapBotRowToAgent({
      id: "bot-1",
      project_id: "proj-1",
      name: "Helper",
      handle: "helper",
      provider: "openai",
      model: "gpt-4o-mini",
      capabilities: "chat, tools",
      config: '{"llm":{"baseUrl":"https://api.openai.com"}}',
      system_prompt: "Be helpful",
      context_fetch_url: "https://app.example/context",
      tool_execute_url: "https://app.example/tools",
      tools_schema: '[{"type":"function","function":{"name":"ping"}}]',
      rate_limit_rpm: 30,
      created_at: "2026-05-01T00:00:00.000Z",
    });

    expect(agent).toMatchObject({
      id: "bot-1",
      projectId: "proj-1",
      name: "Helper",
      handle: "helper",
      provider: "openai",
      model: "gpt-4o-mini",
      modelRef: "openai/gpt-4o-mini",
      capabilities: ["chat", "tools"],
      systemPrompt: "Be helpful",
      rateLimitRpm: 30,
    });
    expect(agent.config).toEqual({ llm: { baseUrl: "https://api.openai.com" } });
    expect(agent.toolsSchema).toHaveLength(1);
  });
});
