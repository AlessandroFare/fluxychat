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

describe("live-streaming", () => {
  it("creates event", async () => {
    const db = mockDB([]);
    env.DB = { prepare: vi.fn().mockReturnValue(db) };
    const { createEvent } = await import("../lib/live-streaming.js");
    const result = await createEvent(env, { projectId: "p1", roomId: "r1", title: "Live Stream" });
    expect(result.id).toMatch(/^le_/);
  });

  it("upserts chat rules", async () => {
    const db = mockDB([]);
    env.DB = { prepare: vi.fn().mockReturnValue(db) };
    const { upsertChatRules } = await import("../lib/live-streaming.js");
    const result = await upsertChatRules(env, { eventId: "le_1", projectId: "p1", slowModeSeconds: 10, emoteOnly: true });
    expect(result.id).toMatch(/^lcr_/);
    expect(result.created).toBe(true);
  });

  it("joins event", async () => {
    const db = mockDB([]);
    env.DB = { prepare: vi.fn().mockReturnValue(db) };
    const { joinEvent } = await import("../lib/live-streaming.js");
    const result = await joinEvent(env, { eventId: "le_1", projectId: "p1", userId: "u1", username: "viewer1" });
    expect(result.id).toMatch(/^lv_/);
  });

  it("prevents duplicate join", async () => {
    const db = mockDB([{ id: "lv_existing" }]);
    env.DB = { prepare: vi.fn().mockReturnValue(db) };
    const { joinEvent } = await import("../lib/live-streaming.js");
    const result = await joinEvent(env, { eventId: "le_1", projectId: "p1", userId: "u1" });
    expect(result.alreadyJoined).toBe(true);
  });

  it("gets viewer count", async () => {
    const db = mockDB([{ count: 500 }]);
    env.DB = { prepare: vi.fn().mockReturnValue(db) };
    const { getViewerCount } = await import("../lib/live-streaming.js");
    const result = await getViewerCount(env, { eventId: "le_1" });
    expect(result.count).toBe(500);
  });

  it("pins message", async () => {
    const db = mockDB([]);
    env.DB = { prepare: vi.fn().mockReturnValue(db) };
    const { pinMessage } = await import("../lib/live-streaming.js");
    const result = await pinMessage(env, { eventId: "le_1", projectId: "p1", messageId: "msg_1" });
    expect(result.id).toMatch(/^lp_/);
  });

  it("sends live message", async () => {
    const db = mockDB([]);
    env.DB = { prepare: vi.fn().mockReturnValue(db) };
    const { sendLiveMessage } = await import("../lib/live-streaming.js");
    const result = await sendLiveMessage(env, { eventId: "le_1", projectId: "p1", userId: "u1", username: "viewer1", content: "Hello!" });
    expect(result.id).toMatch(/^lcm_/);
  });

  it("records analytics bucket", async () => {
    const db = mockDB([]);
    env.DB = { prepare: vi.fn().mockReturnValue(db) };
    const { recordAnalyticsBucket } = await import("../lib/live-streaming.js");
    const result = await recordAnalyticsBucket(env, { eventId: "le_1", projectId: "p1", timestampBucket: "2026-06-12T16:00:00Z", messagesCount: 100, viewersCount: 500 });
    expect(result.id).toMatch(/^la_/);
  });

  it("gets live stats", async () => {
    const db = mockDB([{ status: "live", count: 5 }]);
    env.DB = { prepare: vi.fn().mockReturnValue(db) };
    const { getLiveStats } = await import("../lib/live-streaming.js");
    const result = await getLiveStats(env, { projectId: "p1" });
    expect(result).toHaveProperty("events");
    expect(result).toHaveProperty("totalMessages");
    expect(result).toHaveProperty("totalViewers");
  });
});
