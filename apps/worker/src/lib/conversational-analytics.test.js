import { describe, it, expect } from "vitest";

function makeEnv() {
  const rows = {
    analytics_queries: [],
    analytics_query_cache: [],
    rooms: [{ project_id: "proj_analytics", id: "r1" }, { project_id: "proj_analytics", id: "r2" }],
    messages: [
      { project_id: "proj_analytics", room_id: "r1", user_id: "u1", created_at: "2026-01-10T10:00:00Z" },
      { project_id: "proj_analytics", room_id: "r1", user_id: "u2", created_at: "2026-01-10T11:00:00Z" },
      { project_id: "proj_analytics", room_id: "r2", user_id: "u1", created_at: "2026-01-09T10:00:00Z" },
    ],
    agent_tasks: [
      { project_id: "proj_analytics", status: "resolved", assignee_user_id: "a1", sla_due_at: "2026-01-11T00:00:00Z", resolved_at: "2026-01-10T23:00:00Z", created_at: "2026-01-10T10:00:00Z" },
      { project_id: "proj_analytics", status: "open", assignee_user_id: "a1", sla_due_at: "2026-01-12T00:00:00Z", resolved_at: null, created_at: "2026-01-10T12:00:00Z" },
    ],
    moderation_events: [
      { project_id: "proj_analytics", action: "flag", created_at: "2026-01-10T10:00:00Z" },
    ],
  };

  return {
    DB: {
      prepare(sql) {
        let boundParams = [];
        return {
          bind(...params) { boundParams = params; return this; },
          async run() {
            if (sql.includes("INSERT INTO analytics_queries")) {
              rows.analytics_queries.push({ id: boundParams[0] });
              return { meta: { changes: 1 } };
            }
            if (sql.includes("INSERT OR REPLACE INTO analytics_query_cache")) {
              rows.analytics_query_cache.push({ id: boundParams[0], project_id: boundParams[1], query_hash: boundParams[2], result: boundParams[3], expires_at: "2099-01-01" });
              return { meta: { changes: 1 } };
            }
            if (sql.includes("DELETE FROM analytics_query_cache")) {
              const before = rows.analytics_query_cache.length;
              rows.analytics_query_cache = rows.analytics_query_cache.filter(r => r.project_id !== boundParams[0]);
              return { meta: { changes: before - rows.analytics_query_cache.length } };
            }
            return { meta: { changes: 1 } };
          },
          async first() {
            const projectId = boundParams[0];
            if (sql.includes("COUNT(*) as total FROM rooms")) {
              return { total: rows.rooms.filter(r => r.project_id === projectId).length };
            }
            if (sql.includes("COUNT(DISTINCT room_id) as active")) {
              const active = new Set(rows.messages.filter(m => m.project_id === projectId && m.created_at > "2026-01-03").map(m => m.room_id));
              return { active: active.size };
            }
            if (sql.includes("COUNT(*) as total FROM agent_tasks")) {
              return { total: rows.agent_tasks.filter(t => t.project_id === projectId).length };
            }
            if (sql.includes("COUNT(*) as met FROM agent_tasks")) {
              const met = rows.agent_tasks.filter(t => t.project_id === projectId && t.resolved_at && t.resolved_at <= t.sla_due_at).length;
              return { met };
            }
            if (sql.includes("COUNT(DISTINCT user_id) as total FROM messages")) {
              const users = new Set(rows.messages.filter(m => m.project_id === projectId).map(m => m.user_id));
              return { total: users.size };
            }
            if (sql.includes("COUNT(DISTINCT user_id) as active FROM messages")) {
              const active = new Set(rows.messages.filter(m => m.project_id === projectId && m.created_at > "2026-01-03").map(m => m.user_id));
              return { active: active.size };
            }
            if (sql.includes("COUNT(*) as count FROM messages") && sql.includes("-7 days") && !sql.includes("-14 days")) {
              return { count: rows.messages.filter(m => m.project_id === projectId && m.created_at > "2026-01-03").length };
            }
            if (sql.includes("COUNT(*) as count FROM messages") && sql.includes("-14 days")) {
              return { count: rows.messages.filter(m => m.project_id === projectId && m.created_at <= "2026-01-03" && m.created_at > "2026-01-01").length };
            }
            if (sql.includes("COUNT(*) as total FROM moderation_events")) {
              return { total: rows.moderation_events.filter(e => e.project_id === projectId).length };
            }
            if (sql.includes("result FROM analytics_query_cache")) {
              const r = rows.analytics_query_cache.find(c => c.project_id === projectId && c.query_hash === boundParams[1] && c.expires_at > new Date().toISOString());
              return r ? { result: r.result } : null;
            }
            return null;
          },
          async all() {
            const projectId = boundParams[0];
            if (sql.includes("FROM messages") && sql.includes("GROUP BY room_id")) {
              const map = {};
              for (const m of rows.messages.filter(m => m.project_id === projectId && m.created_at > "2026-01-03")) {
                map[m.room_id] = (map[m.room_id] || 0) + 1;
              }
              return { results: Object.entries(map).map(([room_id, msg_count]) => ({ room_id, msg_count })).sort((a, b) => b.msg_count - a.msg_count).slice(0, 10) };
            }
            if (sql.includes("assignee_user_id") && sql.includes("GROUP BY")) {
              const map = {};
              for (const t of rows.agent_tasks.filter(t => t.project_id === projectId)) {
                const a = t.assignee_user_id;
                if (!map[a]) map[a] = { agent_id: a, total_tasks: 0, resolved: 0, avg_resolution_seconds: null };
                map[a].total_tasks++;
                if (t.status === "resolved") map[a].resolved++;
              }
              return { results: Object.values(map) };
            }
            if (sql.includes("date(created_at) as day")) {
              const map = {};
              for (const m of rows.messages.filter(m => m.project_id === projectId && m.created_at > "2026-01-01")) {
                const day = m.created_at.slice(0, 10);
                map[day] = (map[day] || 0) + 1;
              }
              return { results: Object.entries(map).map(([day, count]) => ({ day, count })).sort((a, b) => a.day.localeCompare(b.day)) };
            }
            if (sql.includes("user_id, MAX")) {
              const map = {};
              for (const m of rows.messages.filter(m => m.project_id === projectId)) {
                if (!map[m.user_id] || m.created_at > map[m.user_id]) map[m.user_id] = m.created_at;
              }
              return { results: Object.entries(map).map(([user_id, last_active]) => ({ user_id, last_active })) };
            }
            if (sql.includes("CAST(strftime('%H'")) {
              const map = {};
              for (const m of rows.messages.filter(m => m.project_id === projectId && m.created_at > "2026-01-03")) {
                const hour = parseInt(m.created_at.slice(11, 13));
                map[hour] = (map[hour] || 0) + 1;
              }
              return { results: Object.entries(map).map(([hour, count]) => ({ hour: Number(hour), count })).sort((a, b) => b.count - a.count).slice(0, 5) };
            }
            if (sql.includes("action FROM moderation_events")) {
              const map = {};
              for (const e of rows.moderation_events.filter(e => e.project_id === projectId && e.created_at > "2026-01-03")) {
                map[e.action] = (map[e.action] || 0) + 1;
              }
              return { results: Object.entries(map).map(([action, count]) => ({ action, count })) };
            }
            if (sql.includes("status, COUNT")) {
              const map = {};
              for (const t of rows.agent_tasks.filter(t => t.project_id === projectId)) {
                map[t.status] = (map[t.status] || 0) + 1;
              }
              return { results: Object.entries(map).map(([status, count]) => ({ status, count })) };
            }
            if (sql.includes("FROM analytics_queries")) {
              return { results: rows.analytics_queries.slice(0, boundParams[1] || 20) };
            }
            return { results: [] };
          },
        };
      },
    },
  };
}

import { queryAnalytics, getQueryHistory, clearQueryCache } from "./conversational-analytics.js";

describe("P15-L: Conversational Analytics", () => {
  const projectId = "proj_analytics";

  it("parses room stats intent", async () => {
    const env = makeEnv();
    const result = await queryAnalytics(env, { projectId, queryText: "show me room stats" });
    expect(result.intents).toContain("room_stats");
    expect(result.result.roomStats).toBeDefined();
    expect(result.result.roomStats.totalRooms).toBe(2);
  });

  it("parses agent performance intent", async () => {
    const env = makeEnv();
    const result = await queryAnalytics(env, { projectId, queryText: "agent performance stats and resolution" });
    expect(result.intents).toContain("agent_performance");
    expect(result.result.agentPerformance).toBeDefined();
  });

  it("parses message volume intent", async () => {
    const env = makeEnv();
    const result = await queryAnalytics(env, { projectId, queryText: "message volume trends" });
    expect(result.intents).toContain("message_volume");
    expect(result.result.messageVolume).toBeDefined();
  });

  it("parses user engagement intent", async () => {
    const env = makeEnv();
    const result = await queryAnalytics(env, { projectId, queryText: "user engagement metrics" });
    expect(result.intents).toContain("user_engagement");
    expect(result.result.userEngagement).toBeDefined();
    expect(result.result.userEngagement.totalUsers).toBe(2);
  });

  it("returns summary for unknown queries", async () => {
    const env = makeEnv();
    const result = await queryAnalytics(env, { projectId, queryText: "give me a quick overview" });
    expect(result.intents).toContain("summary");
    expect(result.result.summary).toBeDefined();
  });

  it("caches query results", async () => {
    const env = makeEnv();
    const r1 = await queryAnalytics(env, { projectId, queryText: "room stats" });
    expect(r1.fromCache).toBeFalsy();
    const r2 = await queryAnalytics(env, { projectId, queryText: "room stats" });
    expect(r2.fromCache).toBe(true);
  });

  it("respects forceRefresh", async () => {
    const env = makeEnv();
    await queryAnalytics(env, { projectId, queryText: "room stats" });
    const r2 = await queryAnalytics(env, { projectId, queryText: "room stats", forceRefresh: true });
    expect(r2.fromCache).toBeFalsy();
  });

  it("clears query cache", async () => {
    const env = makeEnv();
    await queryAnalytics(env, { projectId, queryText: "room stats" });
    const cleared = await clearQueryCache(env, { projectId });
    expect(cleared).toBeGreaterThanOrEqual(0);
  });
});
