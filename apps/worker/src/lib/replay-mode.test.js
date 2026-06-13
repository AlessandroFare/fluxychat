import { describe, it, expect } from "vitest";

function makeEnv() {
  const rows = { replay_snapshots: [], replay_bookmarks: [] };
  return {
    DB: {
      prepare(sql) {
        let boundParams = [];
        return {
          bind(...params) { boundParams = params; return this; },
          async run() {
            if (sql.includes("INSERT INTO replay_snapshots")) {
              rows.replay_snapshots.push({ id: boundParams[0], project_id: boundParams[1], room_id: boundParams[2], timestamp: boundParams[3], snapshot_type: boundParams[4], event_data: boundParams[5] });
              return { meta: { changes: 1 } };
            }
            if (sql.includes("INSERT INTO replay_bookmarks")) {
              rows.replay_bookmarks.push({ id: boundParams[0], project_id: boundParams[1], room_id: boundParams[2], name: boundParams[3], description: boundParams[4], message_id: boundParams[5], timestamp: boundParams[6], created_by: boundParams[7] });
              return { meta: { changes: 1 } };
            }
            return { meta: { changes: 1 } };
          },
          async all() {
            if (sql.includes("GROUP BY snapshot_type")) {
              const map = {};
              for (const r of rows.replay_snapshots.filter(r => r.project_id === boundParams[0] && r.room_id === boundParams[1])) {
                map[r.snapshot_type] = (map[r.snapshot_type] || 0) + 1;
              }
              return { results: Object.entries(map).map(([snapshot_type, cnt]) => ({ snapshot_type, cnt: Number(cnt) })) };
            }
            if (sql.includes("FROM replay_bookmarks")) {
              let results = rows.replay_bookmarks.filter(r => r.project_id === boundParams[0] && r.room_id === boundParams[1]);
              return { results };
            }
            if (sql.includes("FROM replay_snapshots")) {
              let results = rows.replay_snapshots.filter(r => r.project_id === boundParams[0] && r.room_id === boundParams[1]);
              const hasGte = sql.includes("timestamp >= ?");
              const hasLte = sql.includes("timestamp <= ?");
              if (hasGte && hasLte) {
                results = results.filter(r => r.timestamp >= boundParams[2] && r.timestamp <= boundParams[3]);
              } else if (hasGte) {
                results = results.filter(r => r.timestamp >= boundParams[2]);
              } else if (hasLte) {
                results = results.filter(r => r.timestamp <= boundParams[2]);
              }
              if (sql.includes("ORDER BY timestamp DESC")) {
                results = [...results].reverse();
              } else {
                results = [...results].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
              }
              return { results };
            }
            return { results: [] };
          },
          async first() { const { results } = await this.all(); return results[0] || null; },
        };
      },
    },
  };
}

import {
  recordReplayEvent,
  getReplayTimeline,
  getReplaySnapshotAtTime,
  createBookmark,
  listBookmarks,
  deleteBookmark,
  getReplayStats,
} from "./replay-mode.js";

describe("P15-K: Replay Mode", () => {
  const projectId = "proj_replay_1";
  const roomId = "room_replay_1";

  it("records a replay event", async () => {
    const env = makeEnv();
    const ev = await recordReplayEvent(env, { projectId, roomId, eventType: "message", eventData: { type: "create", content: "hello" }, messageId: "msg_1" });
    expect(ev.id).toBeDefined();
    expect(ev.eventType).toBe("message");
  });

  it("retrieves replay timeline", async () => {
    const env = makeEnv();
    await recordReplayEvent(env, { projectId, roomId, eventType: "message", eventData: { type: "create", content: "a" }, messageId: "msg_1", timestamp: "2026-01-01T00:00:00Z" });
    await recordReplayEvent(env, { projectId, roomId, eventType: "reaction", eventData: { type: "react", emoji: "👍" }, messageId: "msg_1", timestamp: "2026-01-01T00:01:00Z" });
    const timeline = await getReplayTimeline(env, { projectId, roomId });
    expect(timeline.length).toBe(2);
    expect(timeline[0].event_data.type).toBe("create");
  });

  it("filters timeline by time range", async () => {
    const env = makeEnv();
    await recordReplayEvent(env, { projectId, roomId, eventType: "message", eventData: { type: "create" }, messageId: "msg_1", timestamp: "2026-01-01T00:00:00Z" });
    await recordReplayEvent(env, { projectId, roomId, eventType: "message", eventData: { type: "create" }, messageId: "msg_2", timestamp: "2026-01-02T00:00:00Z" });
    const filtered = await getReplayTimeline(env, { projectId, roomId, from: "2026-01-01T12:00:00Z" });
    expect(filtered.length).toBe(1);
    expect(filtered[0].event_data.messageId).toBe("msg_2");
  });

  it("creates and lists bookmarks", async () => {
    const env = makeEnv();
    const bm = await createBookmark(env, { projectId, roomId, name: "Decision point", description: "When pricing was decided", createdBy: "user_1" });
    expect(bm.name).toBe("Decision point");
    const list = await listBookmarks(env, { projectId, roomId });
    expect(list.length).toBe(1);
  });

  it("deletes bookmarks", async () => {
    const env = makeEnv();
    const bm = await createBookmark(env, { projectId, roomId, name: "To delete", createdBy: "user_1" });
    const deleted = await deleteBookmark(env, { projectId, bookmarkId: bm.id });
    expect(deleted).toBe(true);
  });

  it("returns snapshot at time", async () => {
    const env = makeEnv();
    await recordReplayEvent(env, { projectId, roomId, eventType: "message", eventData: { type: "create", userId: "u1", content: "msg a" }, messageId: "msg_1", timestamp: "2026-01-01T00:00:00Z" });
    await recordReplayEvent(env, { projectId, roomId, eventType: "message", eventData: { type: "edit", content: "msg a edited", newContent: "msg a edited", userId: "u1" }, messageId: "msg_1", timestamp: "2026-01-01T00:05:00Z" });
    const snapshot = await getReplaySnapshotAtTime(env, { projectId, roomId, asOf: "2026-01-01T00:03:00Z" });
    expect(snapshot.messageCount).toBe(1);
    expect(snapshot.messages["msg_1"].content).toBe("msg a");
    expect(snapshot.messages["msg_1"].edited).toBe(false);
  });

  it("returns replay stats", async () => {
    const env = makeEnv();
    await recordReplayEvent(env, { projectId, roomId, eventType: "message", eventData: { type: "create" }, messageId: "m1" });
    await recordReplayEvent(env, { projectId, roomId, eventType: "message", eventData: { type: "create" }, messageId: "m2" });
    await recordReplayEvent(env, { projectId, roomId, eventType: "reaction", eventData: { emoji: "👍" }, messageId: "m1" });
    const stats = await getReplayStats(env, { projectId, roomId });
    expect(stats.events).toBe(3);
    expect(stats.byType.message).toBe(2);
    expect(stats.byType.reaction).toBe(1);
  });

  it("returns empty timeline for unknown room", async () => {
    const env = makeEnv();
    const timeline = await getReplayTimeline(env, { projectId, roomId: "unknown" });
    expect(timeline.length).toBe(0);
  });
});
