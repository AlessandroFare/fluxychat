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

describe("replay-timetravel", () => {
  it("creates session", async () => {
    const db = mockDB([]);
    env.DB = { prepare: vi.fn().mockReturnValue(db) };
    const { createSession } = await import("../lib/replay-timetravel.js");
    const result = await createSession(env, { projectId: "p1", roomId: "r1", name: "Debug session" });
    expect(result.id).toMatch(/^rs_/);
    expect(result.status).toBe("recording");
  });

  it("gets session", async () => {
    const db = mockDB([{ status: "recording", event_count: 0 }]);
    env.DB = { prepare: vi.fn().mockReturnValue(db) };
    const { getSession } = await import("../lib/replay-timetravel.js");
    const result = await getSession(env, { sessionId: "rs_1" });
    expect(result.status).toBe("recording");
  });

  it("creates snapshot", async () => {
    const db = mockDB([]);
    env.DB = { prepare: vi.fn().mockReturnValue(db) };
    const { createSnapshot } = await import("../lib/replay-timetravel.js");
    const result = await createSnapshot(env, { sessionId: "rs_1", projectId: "p1", roomId: "r1", snapshotType: "manual" });
    expect(result.id).toMatch(/^rss_/);
    expect(result.sequenceNumber).toBe(1);
  });

  it("gets snapshot at sequence", async () => {
    const db = mockDB([{ sequence_number: 5 }]);
    env.DB = { prepare: vi.fn().mockReturnValue(db) };
    const { getSnapshotAtSequence } = await import("../lib/replay-timetravel.js");
    const result = await getSnapshotAtSequence(env, { sessionId: "rs_1", sequenceNumber: 10 });
    expect(result.sequenceNumber).toBe(5);
  });

  it("records event", async () => {
    const db = mockDB([]);
    env.DB = { prepare: vi.fn().mockReturnValue(db) };
    const { recordEvent } = await import("../lib/replay-timetravel.js");
    const result = await recordEvent(env, { sessionId: "rs_1", projectId: "p1", roomId: "r1", eventType: "message.send", eventData: { text: "hi" } });
    expect(result.id).toMatch(/^re_/);
    expect(result.sequenceNumber).toBe(1);
  });

  it("lists events with filters", async () => {
    const db = mockDB([{ event_type: "message.send", event_data: '{"text":"hi"}' }]);
    env.DB = { prepare: vi.fn().mockReturnValue(db) };
    const { listEvents } = await import("../lib/replay-timetravel.js");
    const result = await listEvents(env, { sessionId: "rs_1", eventType: "message.send" });
    expect(Array.isArray(result)).toBe(true);
  });

  it("creates bookmark", async () => {
    const db = mockDB([]);
    env.DB = { prepare: vi.fn().mockReturnValue(db) };
    const { createBookmark } = await import("../lib/replay-timetravel.js");
    const result = await createBookmark(env, { sessionId: "rs_1", projectId: "p1", roomId: "r1", name: "Important moment", sequenceNumber: 42 });
    expect(result.id).toMatch(/^rb_/);
  });

  it("creates diff", async () => {
    const db = mockDB([]);
    env.DB = { prepare: vi.fn().mockReturnValue(db) };
    const { createDiff } = await import("../lib/replay-timetravel.js");
    const result = await createDiff(env, { sessionId: "rs_1", projectId: "p1", roomId: "r1", fromSnapshotId: "rss_1", toSnapshotId: "rss_2", fromSequence: 1, toSequence: 10, addedMessages: 5, removedMessages: 1 });
    expect(result.id).toMatch(/^rd_/);
  });

  it("gets replay stats", async () => {
    const db = mockDB([{ status: "recording", count: 3 }]);
    env.DB = { prepare: vi.fn().mockReturnValue(db) };
    const { getReplayStats } = await import("../lib/replay-timetravel.js");
    const result = await getReplayStats(env, { projectId: "p1" });
    expect(result).toHaveProperty("sessions");
    expect(result).toHaveProperty("totalEvents");
    expect(result).toHaveProperty("totalSnapshots");
    expect(result).toHaveProperty("topEventTypes");
  });
});
