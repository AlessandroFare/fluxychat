import { describe, it, expect } from "vitest";

function makeEnv() {
  const rows = { activity_feeds: [], activity_events: [] };
  return {
    DB: {
      prepare(sql) {
        let boundParams = [];
        return {
          bind(...params) { boundParams = params; return this; },
          async run() {
            if (sql.includes("INSERT INTO activity_feeds")) {
              rows.activity_feeds.push({ id: boundParams[0], project_id: boundParams[1], name: boundParams[2], feed_type: boundParams[3], room_id: boundParams[4], description: boundParams[5], is_public: boundParams[6], created_at: "2026-01-10T00:00:00Z" });
              return { meta: { changes: 1 } };
            }
            if (sql.includes("INSERT INTO activity_events")) {
              rows.activity_events.push({ id: boundParams[0], feed_id: boundParams[1], project_id: boundParams[2], event_type: boundParams[3], actor_id: boundParams[4], actor_name: boundParams[5], entity_type: boundParams[6], entity_id: boundParams[7], entity_name: boundParams[8], action: boundParams[9], metadata: boundParams[10], timestamp: boundParams[11], created_at: "2026-01-10T00:00:00Z" });
              return { meta: { changes: 1 } };
            }
            if (sql.includes("DELETE FROM activity_events WHERE feed_id")) {
              const before = rows.activity_events.length;
              rows.activity_events = rows.activity_events.filter(r => r.feed_id !== boundParams[0]);
              return { meta: { changes: before - rows.activity_events.length } };
            }
            if (sql.includes("DELETE FROM activity_feeds")) {
              const pid = boundParams[0]; const fid = boundParams[1];
              const before = rows.activity_feeds.length;
              rows.activity_feeds = rows.activity_feeds.filter(r => !(r.project_id === pid && r.id === fid));
              return { meta: { changes: before - rows.activity_feeds.length } };
            }
            return { meta: { changes: 1 } };
          },
          async first() {
            if (sql.includes("FROM activity_feeds")) {
              return rows.activity_feeds.find(r => r.project_id === boundParams[0] && r.id === boundParams[1]) || null;
            }
            if (sql.includes("COUNT(*) as total")) {
              return { total: rows.activity_events.filter(r => r.project_id === boundParams[0] && r.feed_id === boundParams[1]).length };
            }
            return null;
          },
          async all() {
            const pid = boundParams[0];
            if (sql.includes("FROM activity_feeds")) {
              return { results: rows.activity_feeds.filter(r => r.project_id === pid) };
            }
            if (sql.includes("GROUP BY event_type")) {
              const fid = boundParams[1];
              const map = {};
              for (const r of rows.activity_events.filter(r => r.project_id === pid && r.feed_id === fid)) {
                map[r.event_type] = (map[r.event_type] || 0) + 1;
              }
              return { results: Object.entries(map).map(([event_type, count]) => ({ event_type, count })) };
            }
            if (sql.includes("FROM activity_events")) {
              let results = rows.activity_events.filter(r => r.project_id === pid);
              if (sql.includes("feed_id = ?")) results = results.filter(r => r.feed_id === boundParams[1]);
              if (sql.includes("event_type = ?")) {
                const idx = sql.indexOf("event_type = ?");
                const paramIdx = [...sql.substring(0, idx).matchAll(/\?/g)].length;
                results = results.filter(r => r.event_type === boundParams[paramIdx]);
              }
              if (sql.includes("timestamp >= ?")) {
                const idx = sql.indexOf("timestamp >= ?");
                const paramIdx = [...sql.substring(0, idx).matchAll(/\?/g)].length;
                results = results.filter(r => r.timestamp >= boundParams[paramIdx]);
              }
              if (sql.includes("timestamp <= ?")) {
                const idx = sql.indexOf("timestamp <= ?");
                const paramIdx = [...sql.substring(0, idx).matchAll(/\?/g)].length;
                results = results.filter(r => r.timestamp <= boundParams[paramIdx]);
              }
              if (sql.includes("IN (")) {
                const inIdx = sql.indexOf("IN (");
                const startParams = [...sql.substring(0, inIdx).matchAll(/\?/g)].length;
                const placeholders = sql.substring(inIdx).split("(")[1].split(")")[0].split(",").length;
                const feedIds = boundParams.slice(startParams, startParams + placeholders);
                results = results.filter(r => feedIds.includes(r.feed_id));
              }
              if (sql.includes("ORDER BY timestamp DESC")) results.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
              const limitIdx = sql.indexOf("LIMIT ?");
              if (limitIdx > 0) {
                const lParams = [...sql.substring(0, limitIdx).matchAll(/\?/g)].length;
                results = results.slice(0, boundParams[lParams]);
              }
              return { results };
            }
            return { results: [] };
          },
        };
      },
    },
  };
}

import {
  createFeed, getFeed, listFeeds, deleteFeed,
  recordEvent, queryEvents, getFeedStats, getAggregatedFeed,
} from "./activity-feed.js";

describe("P19-D: Activity Feed", () => {
  const projectId = "proj_feed_1";

  it("creates a feed", async () => {
    const env = makeEnv();
    const feed = await createFeed(env, { projectId, name: "Project Activity" });
    expect(feed.id).toBeDefined();
    expect(feed.name).toBe("Project Activity");
  });

  it("records events", async () => {
    const env = makeEnv();
    const feed = await createFeed(env, { projectId, name: "Feed" });
    const ev = await recordEvent(env, {
      projectId, feedId: feed.id, eventType: "join", actorId: "u1",
      action: "user joined room", entityType: "room", entityId: "r1", entityName: "General",
    });
    expect(ev.eventType).toBe("join");
    expect(ev.action).toBe("user joined room");
  });

  it("rejects invalid event type", async () => {
    const env = makeEnv();
    const feed = await createFeed(env, { projectId, name: "F" });
    await expect(recordEvent(env, {
      projectId, feedId: feed.id, eventType: "invalid", actorId: "u1", action: "did something",
    })).rejects.toThrow("Invalid event type");
  });

  it("queries events with filters", async () => {
    const env = makeEnv();
    const feed = await createFeed(env, { projectId, name: "F" });
    await recordEvent(env, { projectId, feedId: feed.id, eventType: "join", actorId: "u1", action: "joined" });
    await recordEvent(env, { projectId, feedId: feed.id, eventType: "leave", actorId: "u1", action: "left" });
    await recordEvent(env, { projectId, feedId: feed.id, eventType: "join", actorId: "u2", action: "joined" });
    const result = await queryEvents(env, { projectId, feedId: feed.id, eventType: "join" });
    expect(result.events.length).toBe(2);
  });

  it("returns feed stats", async () => {
    const env = makeEnv();
    const feed = await createFeed(env, { projectId, name: "F" });
    await recordEvent(env, { projectId, feedId: feed.id, eventType: "join", actorId: "u1", action: "j" });
    await recordEvent(env, { projectId, feedId: feed.id, eventType: "leave", actorId: "u1", action: "l" });
    const stats = await getFeedStats(env, { projectId, feedId: feed.id });
    expect(stats.total).toBe(2);
  });

  it("aggregates across feeds", async () => {
    const env = makeEnv();
    const f1 = await createFeed(env, { projectId, name: "F1" });
    const f2 = await createFeed(env, { projectId, name: "F2" });
    await recordEvent(env, { projectId, feedId: f1.id, eventType: "join", actorId: "u1", action: "j1" });
    await recordEvent(env, { projectId, feedId: f2.id, eventType: "leave", actorId: "u2", action: "l2" });
    const events = await getAggregatedFeed(env, { projectId, feedIds: [f1.id, f2.id] });
    expect(events.length).toBe(2);
  });

  it("deletes feed and events", async () => {
    const env = makeEnv();
    const feed = await createFeed(env, { projectId, name: "To Delete" });
    await recordEvent(env, { projectId, feedId: feed.id, eventType: "join", actorId: "u1", action: "j" });
    const deleted = await deleteFeed(env, { projectId, feedId: feed.id });
    expect(deleted).toBe(true);
  });

  it("returns null for unknown feed", async () => {
    const env = makeEnv();
    const feed = await getFeed(env, { projectId, feedId: "unknown" });
    expect(feed).toBeNull();
  });
});
