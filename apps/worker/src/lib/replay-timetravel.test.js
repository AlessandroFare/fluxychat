import { describe, it, expect, vi } from "vitest";

vi.mock("cloudflare:test", () => ({ env: { DB: { prepare: vi.fn() } } }));

// A2-8: create* now probes session ownership with `SELECT id FROM
// replay_sessions` before writing; the mock resolves that probe as a
// same-project session and keeps the previous rows[0] behavior otherwise.
function mockDB(rows = []) {
  return {
    prepare: vi.fn((sql) => ({
      bind: vi.fn().mockReturnThis(),
      run: vi.fn().mockResolvedValue({ meta: { changes: 1 } }),
      first: vi.fn().mockImplementation(async () =>
        sql.includes("SELECT id FROM replay_sessions") ? { id: "rs_1" } : (rows[0] || null)
      ),
      all: vi.fn().mockResolvedValue({ results: rows }),
    })),
  };
}

const env = {};

describe("replay-timetravel", () => {
  it("creates session", async () => {
    env.DB = mockDB([]);
    const { createSession } = await import("../lib/replay-timetravel.js");
    const result = await createSession(env, { projectId: "p1", roomId: "r1", name: "Debug session" });
    expect(result.id).toMatch(/^rs_/);
    expect(result.status).toBe("recording");
  });

  it("gets session", async () => {
    env.DB = mockDB([{ status: "recording", event_count: 0 }]);
    const { getSession } = await import("../lib/replay-timetravel.js");
    const result = await getSession(env, { sessionId: "rs_1" });
    expect(result.status).toBe("recording");
  });

  it("creates snapshot", async () => {
    env.DB = mockDB([]);
    const { createSnapshot } = await import("../lib/replay-timetravel.js");
    const result = await createSnapshot(env, { sessionId: "rs_1", projectId: "p1", roomId: "r1", snapshotType: "manual" });
    expect(result.id).toMatch(/^rss_/);
    expect(result.sequenceNumber).toBe(1);
  });

  it("gets snapshot at sequence", async () => {
    env.DB = mockDB([{ sequence_number: 5 }]);
    const { getSnapshotAtSequence } = await import("../lib/replay-timetravel.js");
    const result = await getSnapshotAtSequence(env, { sessionId: "rs_1", sequenceNumber: 10 });
    expect(result.sequenceNumber).toBe(5);
  });

  it("records event", async () => {
    env.DB = mockDB([]);
    const { recordEvent } = await import("../lib/replay-timetravel.js");
    const result = await recordEvent(env, { sessionId: "rs_1", projectId: "p1", roomId: "r1", eventType: "message.send", eventData: { text: "hi" } });
    expect(result.id).toMatch(/^re_/);
    expect(result.sequenceNumber).toBe(1);
  });

  it("lists events with filters", async () => {
    env.DB = mockDB([{ event_type: "message.send", event_data: '{"text":"hi"}' }]);
    const { listEvents } = await import("../lib/replay-timetravel.js");
    const result = await listEvents(env, { sessionId: "rs_1", eventType: "message.send" });
    expect(Array.isArray(result)).toBe(true);
  });

  it("creates bookmark", async () => {
    env.DB = mockDB([]);
    const { createBookmark } = await import("../lib/replay-timetravel.js");
    const result = await createBookmark(env, { sessionId: "rs_1", projectId: "p1", roomId: "r1", name: "Important moment", sequenceNumber: 42 });
    expect(result.id).toMatch(/^rb_/);
  });

  it("creates diff", async () => {
    env.DB = mockDB([]);
    const { createDiff } = await import("../lib/replay-timetravel.js");
    const result = await createDiff(env, { sessionId: "rs_1", projectId: "p1", roomId: "r1", fromSnapshotId: "rss_1", toSnapshotId: "rss_2", fromSequence: 1, toSequence: 10, addedMessages: 5, removedMessages: 1 });
    expect(result.id).toMatch(/^rd_/);
  });

  it("gets replay stats", async () => {
    env.DB = mockDB([{ status: "recording", count: 3 }]);
    const { getReplayStats } = await import("../lib/replay-timetravel.js");
    const result = await getReplayStats(env, { projectId: "p1" });
    expect(result).toHaveProperty("sessions");
    expect(result).toHaveProperty("totalEvents");
    expect(result).toHaveProperty("totalSnapshots");
    expect(result).toHaveProperty("topEventTypes");
  });

  it("A2-17: concurrent snapshots get distinct sequence numbers", async () => {
    const snapshots = [];
    env.DB = {
      prepare: vi.fn((sql) => ({
        _args: [],
        bind(...args) {
          this._args = args;
          return this;
        },
        async first() {
          if (sql.includes("SELECT id FROM replay_sessions")) return { id: "rs_1" };
          if (sql.includes("FROM replay_snapshots WHERE id = ?")) {
            const row = snapshots.find((r) => r.id === this._args[0]);
            return row ? { sequence_number: row.sequence_number } : null;
          }
          if (sql.includes("ORDER BY sequence_number DESC")) {
            const scoped = snapshots.filter((r) => r.session_id === this._args[0]);
            return scoped.length ? { sequence_number: scoped[scoped.length - 1].sequence_number } : null;
          }
          return null;
        },
        async run() {
          if (sql.includes("INSERT INTO replay_snapshots")) {
            const sessionId = this._args[1];
            if (sql.includes("MAX(sequence_number)")) {
              // Single-statement MAX: the store is read at execution time.
              const scoped = snapshots.filter((r) => r.session_id === this._args[this._args.length - 1]);
              const seq = scoped.reduce((m, r) => Math.max(m, r.sequence_number), 0) + 1;
              snapshots.push({ id: this._args[0], session_id: sessionId, sequence_number: seq });
            } else {
              snapshots.push({ id: this._args[0], session_id: sessionId, sequence_number: this._args[9] });
            }
          }
          return { meta: { changes: 1 } };
        },
        async all() {
          return { results: [] };
        },
      })),
    };
    const { createSnapshot } = await import("../lib/replay-timetravel.js");
    const [a, b] = await Promise.all([
      createSnapshot(env, { sessionId: "rs_1", projectId: "p1", roomId: "r1", snapshotType: "manual" }),
      createSnapshot(env, { sessionId: "rs_1", projectId: "p1", roomId: "r1", snapshotType: "auto" }),
    ]);
    expect([a.sequenceNumber, b.sequenceNumber].sort()).toEqual([1, 2]);
  });
});
