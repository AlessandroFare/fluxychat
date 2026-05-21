import { describe, expect, it, vi } from "vitest";
import { invokeMentionedAgents } from "./agent-runtime.js";

describe("invokeMentionedAgents parentId", () => {
  it("passes parent_id into stream start when provided", async () => {
    const streamBodies = [];
    const env = {
      DB: {
        prepare: (sql) => ({
          bind: (...args) => ({
            all: async () => {
              if (sql.includes("FROM bots")) {
                return {
                  results: [
                    {
                      id: "agent-1",
                      name: "Assistant",
                      handle: "@assistant",
                      provider: "openai",
                      model: "gpt-4o-mini",
                      config: null,
                      system_prompt: "hi",
                      context_fetch_url: null,
                      tool_execute_url: null,
                      tools_schema: null,
                      rate_limit_rpm: null,
                    },
                  ],
                };
              }
              return { results: [] };
            },
            run: async () => ({ meta: { last_row_id: 99 } }),
            first: async () => null,
          }),
        }),
      },
      ROOM: {
        idFromName: () => "id",
        get: () => ({
          fetch: async (_url, init) => {
            if (init?.body) {
              try {
                streamBodies.push(JSON.parse(init.body));
              } catch {
                /* ignore */
              }
            }
            return new Response(JSON.stringify({ ok: true, id: 42 }));
          },
        }),
      },
    };

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: "ok" }, finish_reason: "stop" }],
          usage: { prompt_tokens: 1, completion_tokens: 1 },
        }),
      })),
    );

    await invokeMentionedAgents(
      { AI_API_KEY: "sk-test", AI_BASE_URL: "https://api.openai.com", ...env },
      "proj-1",
      "room-1",
      "user-1",
      "@assistant hello",
      ["assistant"],
      "trace-1",
      55,
    );

    const streamStart = streamBodies.find((b) => b.op === "start");
    expect(streamStart?.parentId).toBe(55);

    vi.unstubAllGlobals();
  });
});
