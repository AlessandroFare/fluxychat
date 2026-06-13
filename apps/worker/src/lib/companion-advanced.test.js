import { describe, it, expect, vi } from "vitest";

vi.mock("cloudflare:test", () => ({ env: { DB: { prepare: vi.fn() } } }));

function mockDB(rows = []) {
  const chain = {
    bind: vi.fn().mockReturnThis(),
    run: vi.fn().mockResolvedValue({ meta: { changes: 1 } }),
    first: vi.fn().mockResolvedValue(rows[0] || null),
    all: vi.fn().mockResolvedValue({ results: rows }),
  };
  return chain;
}

const env = {};

describe("companion-advanced", () => {
  it("creates conversation", async () => {
    const db = mockDB();
    env.DB = { prepare: vi.fn().mockReturnValue(db) };
    const { createConversation } = await import("../lib/companion-advanced.js");
    const result = await createConversation(env, { projectId: "p1", roomId: "r1", title: "Test" });
    expect(result.id).toMatch(/^cc_/);
    expect(result.status).toBe("active");
  });

  it("ends conversation", async () => {
    const db = mockDB();
    env.DB = { prepare: vi.fn().mockReturnValue(db) };
    const { endConversation } = await import("../lib/companion-advanced.js");
    const result = await endConversation(env, { conversationId: "cc_123" });
    expect(result.ended).toBeGreaterThanOrEqual(0);
  });

  it("lists conversations with filters", async () => {
    const db = mockDB([{ id: "cc_1", status: "active", conversation_type: "group" }]);
    env.DB = { prepare: vi.fn().mockReturnValue(db) };
    const { listConversations } = await import("../lib/companion-advanced.js");
    const result = await listConversations(env, { projectId: "p1", status: "active" });
    expect(Array.isArray(result)).toBe(true);
  });

  it("adds participant", async () => {
    const db = mockDB([]);
    env.DB = { prepare: vi.fn().mockReturnValue(db) };
    const { addParticipant } = await import("../lib/companion-advanced.js");
    const result = await addParticipant(env, { conversationId: "cc_1", participantType: "companion", participantId: "comp_1" });
    expect(result.id).toMatch(/^ccp_/);
  });

  it("prevents duplicate participant", async () => {
    const db = mockDB([{ id: "ccp_existing" }]);
    env.DB = { prepare: vi.fn().mockReturnValue(db) };
    const { addParticipant } = await import("../lib/companion-advanced.js");
    const result = await addParticipant(env, { conversationId: "cc_1", participantType: "companion", participantId: "comp_1" });
    expect(result.error).toBe("already_participant");
  });

  it("lists participants", async () => {
    const db = mockDB([{ participant_type: "companion" }]);
    env.DB = { prepare: vi.fn().mockReturnValue(db) };
    const { listParticipants } = await import("../lib/companion-advanced.js");
    const result = await listParticipants(env, { conversationId: "cc_1" });
    expect(Array.isArray(result)).toBe(true);
  });

  it("sends companion message", async () => {
    const db = mockDB();
    env.DB = { prepare: vi.fn().mockReturnValue(db) };
    const { sendCompanionMessage } = await import("../lib/companion-advanced.js");
    const result = await sendCompanionMessage(env, { conversationId: "cc_1", projectId: "p1", senderType: "companion", senderId: "comp_1", content: "Hello" });
    expect(result.id).toMatch(/^cm_/);
  });

  it("lists conversation messages", async () => {
    const db = mockDB([{ sender_type: "companion", content: "Hi" }]);
    env.DB = { prepare: vi.fn().mockReturnValue(db) };
    const { listConversationMessages } = await import("../lib/companion-advanced.js");
    const result = await listConversationMessages(env, { conversationId: "cc_1" });
    expect(Array.isArray(result)).toBe(true);
  });

  it("logs personality shift", async () => {
    const db = mockDB();
    env.DB = { prepare: vi.fn().mockReturnValue(db) };
    const { logPersonalityShift } = await import("../lib/companion-advanced.js");
    const result = await logPersonalityShift(env, { companionId: "comp_1", projectId: "p1", trait: "humor", oldValue: 0.3, newValue: 0.6, reason: "user laughed" });
    expect(result.id).toMatch(/^cpl_/);
  });

  it("gets personality history", async () => {
    const db = mockDB([{ trait: "humor", old_value: 0.3, new_value: 0.6 }]);
    env.DB = { prepare: vi.fn().mockReturnValue(db) };
    const { getPersonalityHistory } = await import("../lib/companion-advanced.js");
    const result = await getPersonalityHistory(env, { companionId: "comp_1" });
    expect(Array.isArray(result)).toBe(true);
  });

  it("sets emotion state", async () => {
    const db = mockDB();
    env.DB = { prepare: vi.fn().mockReturnValue(db) };
    const { setEmotionState } = await import("../lib/companion-advanced.js");
    const result = await setEmotionState(env, { companionId: "comp_1", projectId: "p1", emotion: "happy", intensity: 0.8 });
    expect(result.id).toMatch(/^ces_/);
  });

  it("gets recent emotions", async () => {
    const db = mockDB([{ emotion: "happy" }]);
    env.DB = { prepare: vi.fn().mockReturnValue(db) };
    const { getRecentEmotions } = await import("../lib/companion-advanced.js");
    const result = await getRecentEmotions(env, { companionId: "comp_1" });
    expect(Array.isArray(result)).toBe(true);
  });

  it("gets current emotion", async () => {
    const db = mockDB([{ emotion: "curious", intensity: 0.7 }]);
    env.DB = { prepare: vi.fn().mockReturnValue(db) };
    const { getCurrentEmotion } = await import("../lib/companion-advanced.js");
    const result = await getCurrentEmotion(env, { companionId: "comp_1" });
    expect(result.emotion).toBe("curious");
  });

  it("creates delegation", async () => {
    const db = mockDB();
    env.DB = { prepare: vi.fn().mockReturnValue(db) };
    const { createDelegation } = await import("../lib/companion-advanced.js");
    const result = await createDelegation(env, { projectId: "p1", roomId: "r1", fromCompanionId: "comp_1", toUserId: "u1", delegationType: "escalate", reason: "complex query" });
    expect(result.id).toMatch(/^cd_/);
    expect(result.status).toBe("pending");
  });

  it("resolves delegation", async () => {
    const db = mockDB();
    env.DB = { prepare: vi.fn().mockReturnValue(db) };
    const { resolveDelegation } = await import("../lib/companion-advanced.js");
    const result = await resolveDelegation(env, { delegationId: "cd_1", status: "accepted" });
    expect(result.resolved).toBeGreaterThanOrEqual(0);
  });

  it("gets advanced stats", async () => {
    const db = mockDB([{ status: "active", count: 5 }]);
    env.DB = { prepare: vi.fn().mockReturnValue(db) };
    const { getAdvancedStats } = await import("../lib/companion-advanced.js");
    const result = await getAdvancedStats(env, { projectId: "p1" });
    expect(result).toHaveProperty("conversations");
    expect(result).toHaveProperty("messages");
    expect(result).toHaveProperty("topEmotions");
    expect(result).toHaveProperty("delegations");
  });
});
