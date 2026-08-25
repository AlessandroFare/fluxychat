import { describe, it, expect, vi } from "vitest";

vi.mock("cloudflare:test", () => ({ env: { DB: { prepare: vi.fn() } } }));

function mockDB(rows = []) {
  // Stateful fake: createEvent() reads back its own INSERT, so the mock must
  // persist live_events rows across prepare/bind/run→first.
  const seeded = rows;
  const liveEvents = new Map();
  for (const r of rows) if (r?.id) liveEvents.set(r.id, r);

  function handle(sql) {
    const flat = String(sql).replace(/\s+/g, " ");
    return {
      bind: vi.fn(function (...binds) {
        this._binds = binds;
        return this;
      }),
      run: vi.fn(async function () {
        if (flat.includes("INSERT INTO live_events") && this._binds) {
          const [id, projectId, roomId, title, description] = this._binds;
          liveEvents.set(id, {
            id,
            project_id: projectId,
            room_id: roomId,
            title,
            description,
            status: "scheduled",
            created_at: new Date().toISOString(),
          });
        }
        return { meta: { changes: 1 } };
      }),
      first: vi.fn(async function () {
        if (flat.includes("FROM live_events WHERE id = ? AND project_id = ?")) {
          const [id, projectId] = this._binds || [];
          const row = liveEvents.get(id);
          if (row && row.project_id === projectId) return { ...row };
        }
        // Legacy fallback: statements against other tables read the seeded rows.
        return seeded[0] ?? null;
      }),
      all: vi.fn(async function () {
        if (flat.includes("FROM live_events")) {
          return { results: [...liveEvents.values()] };
        }
        return { results: seeded };
      }),
    };
  }

  return { handle, chainFor(sql) { return handle(sql); } };
}

const env = {};

describe("live-streaming", () => {
  it("creates event", async () => {
    const db = mockDB([]);
    env.DB = { prepare: (sql) => db.chainFor(sql) };
    const { createEvent } = await import("../lib/live-streaming.js");
    const result = await createEvent(env, { projectId: "p1", roomId: "r1", title: "Live Stream" });
    expect(result.id).toMatch(/^le_/);
  });

  it("upserts chat rules", async () => {
    const db = mockDB([]);
    env.DB = { prepare: (sql) => db.chainFor(sql) };
    const { upsertChatRules } = await import("../lib/live-streaming.js");
    const result = await upsertChatRules(env, { eventId: "le_1", projectId: "p1", slowModeSeconds: 10, emoteOnly: true });
    expect(result.id).toMatch(/^lcr_/);
    expect(result.created).toBe(true);
  });

  it("joins event", async () => {
    const db = mockDB([]);
    env.DB = { prepare: (sql) => db.chainFor(sql) };
    const { joinEvent } = await import("../lib/live-streaming.js");
    const result = await joinEvent(env, { eventId: "le_1", projectId: "p1", userId: "u1", username: "viewer1" });
    expect(result.id).toMatch(/^lv_/);
  });

  it("prevents duplicate join", async () => {
    const db = mockDB([{ id: "lv_existing" }]);
    env.DB = { prepare: (sql) => db.chainFor(sql) };
    const { joinEvent } = await import("../lib/live-streaming.js");
    const result = await joinEvent(env, { eventId: "le_1", projectId: "p1", userId: "u1" });
    expect(result.alreadyJoined).toBe(true);
  });

  it("gets viewer count", async () => {
    const db = mockDB([{ count: 500 }]);
    env.DB = { prepare: (sql) => db.chainFor(sql) };
    const { getViewerCount } = await import("../lib/live-streaming.js");
    const result = await getViewerCount(env, { eventId: "le_1" });
    expect(result.count).toBe(500);
  });

  it("pins message", async () => {
    const db = mockDB([]);
    env.DB = { prepare: (sql) => db.chainFor(sql) };
    const { pinMessage } = await import("../lib/live-streaming.js");
    const result = await pinMessage(env, { eventId: "le_1", projectId: "p1", messageId: "msg_1" });
    expect(result.id).toMatch(/^lp_/);
  });

  it("sends live message", async () => {
    const db = mockDB([]);
    env.DB = { prepare: (sql) => db.chainFor(sql) };
    const { sendLiveMessage } = await import("../lib/live-streaming.js");
    const result = await sendLiveMessage(env, { eventId: "le_1", projectId: "p1", userId: "u1", username: "viewer1", content: "Hello!" });
    expect(result.id).toMatch(/^lcm_/);
  });

  it("records analytics bucket", async () => {
    const db = mockDB([]);
    env.DB = { prepare: (sql) => db.chainFor(sql) };
    const { recordAnalyticsBucket } = await import("../lib/live-streaming.js");
    const result = await recordAnalyticsBucket(env, { eventId: "le_1", projectId: "p1", timestampBucket: "2026-06-12T16:00:00Z", messagesCount: 100, viewersCount: 500 });
    expect(result.id).toMatch(/^la_/);
  });

  it("gets live stats", async () => {
    const db = mockDB([{ status: "live", count: 5 }]);
    env.DB = { prepare: (sql) => db.chainFor(sql) };
    const { getLiveStats } = await import("../lib/live-streaming.js");
    const result = await getLiveStats(env, { projectId: "p1" });
    expect(result).toHaveProperty("events");
    expect(result).toHaveProperty("totalMessages");
    expect(result).toHaveProperty("totalViewers");
  });
});
