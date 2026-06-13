import { describe, it, expect } from "vitest";
import { buildHandoffContext } from "./handoff-context.js";

function createMockDb({ messages = [], entities = [], actions = [], questions = [], facts = [] } = {}) {
  return {
    prepare(sql) {
      return {
        bind() {
          return {
            async all() {
              if (sql.includes("FROM messages")) return { results: messages };
              if (sql.includes("FROM kg_nodes")) return { results: entities };
              if (sql.includes("FROM ai_action_executions")) return { results: actions };
              if (sql.includes("FROM conversation_questions")) return { results: questions };
              if (sql.includes("FROM room_memory")) return { results: facts };
              return { results: [] };
            },
          };
        },
      };
    },
  };
}

describe("handoff-context", () => {
  it("builds context from all sources", async () => {
    const db = createMockDb({
      messages: [
        { user_id: "bot", content: "Hello! How can I help?", created_at: "2026-06-11T10:00:01Z" },
        { user_id: "u1", content: "Hi there", created_at: "2026-06-11T10:00:00Z" },
      ],
      entities: [
        { node_type: "person", label: "Alice", properties: '{"role":"admin"}', confidence: 0.9 },
      ],
      actions: [
        { action_type: "webhook", status: "success", result_summary: "200 OK", created_at: "2026-06-11T10:00:02Z" },
      ],
      questions: [
        { content: "What is the pricing?", detected_intent: "billing_inquiry", created_at: "2026-06-11T10:00:03Z" },
      ],
      facts: [
        { fact_text: "User prefers email", category: "preference", confidence: 0.85 },
      ],
    });

    const ctx = await buildHandoffContext(db, { projectId: "p1", roomId: "r1" });

    expect(ctx.summary).toContain("User prefers email");
    expect(ctx.summary).toContain("Hello! How can I help?");
    expect(ctx.intent).toBe("billing_inquiry");
    expect(ctx.entities).toHaveLength(1);
    expect(ctx.entities[0].type).toBe("person");
    expect(ctx.entities[0].properties).toEqual({ role: "admin" });
    expect(ctx.actions).toHaveLength(1);
    expect(ctx.actions[0].type).toBe("webhook");
    expect(ctx.openQuestions).toHaveLength(1);
    expect(ctx.openQuestions[0].intent).toBe("billing_inquiry");
    expect(ctx.facts).toHaveLength(1);
    expect(ctx.facts[0].text).toBe("User prefers email");
    expect(ctx.recentMessages).toHaveLength(2);
    expect(ctx.builtAt).toBeTruthy();
  });

  it("returns minimal context when no data", async () => {
    const db = createMockDb();
    const ctx = await buildHandoffContext(db, { projectId: "p1", roomId: "r1" });

    expect(ctx.summary).toBe("No context available.");
    expect(ctx.intent).toBeNull();
    expect(ctx.entities).toHaveLength(0);
    expect(ctx.actions).toHaveLength(0);
    expect(ctx.openQuestions).toHaveLength(0);
    expect(ctx.facts).toHaveLength(0);
    expect(ctx.recentMessages).toHaveLength(0);
  });

  it("infers intent from entities when no questions", async () => {
    const db = createMockDb({
      entities: [
        { node_type: "feature", label: "Login", properties: "{}", confidence: 0.7 },
        { node_type: "bug", label: "Auth error", properties: "{}", confidence: 0.8 },
      ],
    });
    const ctx = await buildHandoffContext(db, { projectId: "p1", roomId: "r1" });

    expect(ctx.intent).toBe("discussion_about_feature_bug");
  });

  it("handles malformed JSON in entity properties", async () => {
    const db = createMockDb({
      entities: [
        { node_type: "person", label: "Bob", properties: "not-json", confidence: 0.5 },
      ],
    });
    const ctx = await buildHandoffContext(db, { projectId: "p1", roomId: "r1" });

    expect(ctx.entities[0].properties).toEqual({});
  });

  it("truncates long message content", async () => {
    const longContent = "x".repeat(1000);
    const db = createMockDb({
      messages: [{ user_id: "u1", content: longContent, created_at: "2026-06-11T10:00:00Z" }],
    });
    const ctx = await buildHandoffContext(db, { projectId: "p1", roomId: "r1" });

    expect(ctx.recentMessages[0].content).toHaveLength(500);
  });

  it("handles DB errors gracefully for optional sources", async () => {
    const db = {
      prepare(sql) {
        return {
          bind() {
            return {
              async all() {
                if (sql.includes("FROM messages")) return { results: [] };
                throw new Error("table not found");
              },
            };
          },
        };
      },
    };
    const ctx = await buildHandoffContext(db, { projectId: "p1", roomId: "r1" });

    expect(ctx.entities).toEqual([]);
    expect(ctx.actions).toEqual([]);
    expect(ctx.openQuestions).toEqual([]);
    expect(ctx.facts).toEqual([]);
  });
});
