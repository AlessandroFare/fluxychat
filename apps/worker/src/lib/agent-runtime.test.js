import { describe, it, expect } from "vitest";
import {
  mapBotRowToAgent,
  normalizeMentionHandle,
  sanitizeAgentReply,
  buildHistoryMessage,
  stripSpeakerPrefix,
} from "./agent-runtime.js";

describe("normalizeMentionHandle", () => {
  it("strips @ and lowercases", () => {
    expect(normalizeMentionHandle("@Assistant")).toBe("assistant");
    expect(normalizeMentionHandle("onboarding")).toBe("onboarding");
  });
});

describe("agent reply formatting", () => {
  const agentId = "builtin-assistant-6d431418-969c-405d-b4be-f8ad15eb04d5";

  it("strips echoed speaker prefix from agent replies", () => {
    expect(
      sanitizeAgentReply(
        `[${agentId}]: I'm still here and ready to help.`,
        agentId,
      ),
    ).toBe("I'm still here and ready to help.");
  });

  it("builds history without user_id prefixes for agent and invoking user", () => {
    expect(
      buildHistoryMessage(
        { user_id: agentId, content: "Hello there" },
        { userId: "user_1", agentId },
      ),
    ).toEqual({ role: "assistant", content: "Hello there" });
    expect(
      buildHistoryMessage(
        { user_id: "user_1", content: "@assistant hi" },
        { userId: "user_1", agentId },
      ),
    ).toEqual({ role: "user", content: "@assistant hi" });
    expect(
      buildHistoryMessage(
        { user_id: "user_2", content: "ping" },
        { userId: "user_1", agentId },
      ),
    ).toEqual({ role: "user", content: "[user_2]: ping" });
  });

  it("stripSpeakerPrefix is case-insensitive", () => {
    expect(stripSpeakerPrefix(`[${agentId.toUpperCase()}]: Hi`, agentId)).toBe("Hi");
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
