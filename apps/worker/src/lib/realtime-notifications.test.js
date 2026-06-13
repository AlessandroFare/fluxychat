import { describe, it, expect } from "vitest";

function makeEnv() {
  const rows = { notification_channels: [], notification_rules: [], notification_deliveries: [] };
  return {
    DB: {
      prepare(sql) {
        let boundParams = [];
        return {
          bind(...params) { boundParams = params; return this; },
          async run() {
            if (sql.includes("INSERT INTO notification_channels")) {
              rows.notification_channels.push({ id: boundParams[0], project_id: boundParams[1], name: boundParams[2], channel_type: boundParams[3], config: boundParams[4], rate_limit_per_minute: boundParams[5], enabled: 1, created_at: "2026-01-10T00:00:00Z" });
              return { meta: { changes: 1 } };
            }
            if (sql.includes("INSERT INTO notification_rules")) {
              rows.notification_rules.push({ id: boundParams[0], project_id: boundParams[1], channel_id: boundParams[2], name: boundParams[3], trigger_event: boundParams[4], conditions: boundParams[5], template: boundParams[6], priority: boundParams[7], enabled: 1, created_at: "2026-01-10T00:00:00Z" });
              return { meta: { changes: 1 } };
            }
            if (sql.includes("INSERT INTO notification_deliveries")) {
              rows.notification_deliveries.push({ id: boundParams[0], project_id: boundParams[1], channel_id: boundParams[2], rule_id: boundParams[3], user_id: boundParams[4], title: boundParams[5], body: boundParams[6], data: boundParams[7], status: "delivered", delivered_at: "2026-01-10T00:00:00Z", read_at: null, created_at: "2026-01-10T00:00:00Z" });
              return { meta: { changes: 1 } };
            }
            if (sql.includes("UPDATE notification_deliveries SET read_at")) {
              if (sql.includes("AND id = ?")) {
                const idx = rows.notification_deliveries.findIndex(r => r.project_id === boundParams[0] && r.id === boundParams[1] && !r.read_at);
                if (idx >= 0) { rows.notification_deliveries[idx].read_at = "2026-01-10T00:01:00Z"; rows.notification_deliveries[idx].status = "read"; }
                return { meta: { changes: idx >= 0 ? 1 : 0 } };
              }
              const before = rows.notification_deliveries.filter(r => r.project_id === boundParams[0] && r.user_id === boundParams[1] && !r.read_at).length;
              rows.notification_deliveries.forEach(r => { if (r.project_id === boundParams[0] && r.user_id === boundParams[1] && !r.read_at) { r.read_at = "2026-01-10T00:01:00Z"; r.status = "read"; } });
              return { meta: { changes: before } };
            }
            if (sql.includes("DELETE FROM notification_rules")) {
              const before = rows.notification_rules.length;
              rows.notification_rules = rows.notification_rules.filter(r => r.channel_id !== boundParams[0]);
              return { meta: { changes: before - rows.notification_rules.length } };
            }
            if (sql.includes("DELETE FROM notification_deliveries WHERE channel_id")) {
              const before = rows.notification_deliveries.length;
              rows.notification_deliveries = rows.notification_deliveries.filter(r => r.channel_id !== boundParams[0]);
              return { meta: { changes: before - rows.notification_deliveries.length } };
            }
            if (sql.includes("DELETE FROM notification_channels")) {
              const pid = boundParams[0]; const cid = boundParams[1];
              const before = rows.notification_channels.length;
              rows.notification_channels = rows.notification_channels.filter(r => !(r.project_id === pid && r.id === cid));
              return { meta: { changes: before - rows.notification_channels.length } };
            }
            if (sql.includes("DELETE FROM notification_rules WHERE project_id")) {
              const pid = boundParams[0]; const rid = boundParams[1];
              const before = rows.notification_rules.length;
              rows.notification_rules = rows.notification_rules.filter(r => !(r.project_id === pid && r.id === rid));
              return { meta: { changes: before - rows.notification_rules.length } };
            }
            return { meta: { changes: 1 } };
          },
          async first() {
            if (sql.includes("FROM notification_channels")) {
              return rows.notification_channels.find(r => r.project_id === boundParams[0] && r.id === boundParams[1]) || null;
            }
            if (sql.includes("COUNT(*) as count FROM notification_deliveries") && sql.includes("read_at IS NULL")) {
              return { count: rows.notification_deliveries.filter(r => r.project_id === boundParams[0] && r.user_id === boundParams[1] && !r.read_at).length };
            }
            if (sql.includes("COUNT(*) as total")) {
              return { total: rows.notification_deliveries.filter(r => r.project_id === boundParams[0]).length };
            }
            if (sql.includes("COUNT(*) as unread")) {
              return { unread: rows.notification_deliveries.filter(r => r.project_id === boundParams[0] && !r.read_at).length };
            }
            return null;
          },
          async all() {
            const pid = boundParams[0];
            if (sql.includes("FROM notification_channels")) {
              return { results: rows.notification_channels.filter(r => r.project_id === pid) };
            }
            if (sql.includes("FROM notification_rules")) {
              let results = rows.notification_rules.filter(r => r.project_id === pid);
              if (sql.includes("channel_id = ?")) results = results.filter(r => r.channel_id === boundParams[1]);
              return { results: results.sort((a, b) => b.priority - a.priority) };
            }
            if (sql.includes("GROUP BY channel_id")) {
              const map = {};
              for (const r of rows.notification_deliveries.filter(r => r.project_id === pid)) {
                map[r.channel_id] = (map[r.channel_id] || 0) + 1;
              }
              return { results: Object.entries(map).map(([channel_id, count]) => ({ channel_id, count })) };
            }
            if (sql.includes("FROM notification_deliveries")) {
              let results = rows.notification_deliveries.filter(r => r.project_id === pid && r.user_id === boundParams[1]);
              if (sql.includes("read_at IS NULL")) results = results.filter(r => !r.read_at);
              return { results: results.sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, boundParams[2] || 20) };
            }
            return { results: [] };
          },
        };
      },
    },
  };
}

import {
  createChannel, getChannel, listChannels, deleteChannel,
  createRule, listRules, deleteRule,
  sendNotification, sendBulkNotifications, broadcastNotification,
  getUserNotifications, markAsRead, markAllAsRead, getUnreadCount, getNotificationStats,
} from "./realtime-notifications.js";

describe("P19-E: Realtime Notifications Engine", () => {
  const projectId = "proj_notif_1";

  it("creates in_app channel", async () => {
    const env = makeEnv();
    const ch = await createChannel(env, { projectId, name: "In-App", channelType: "in_app" });
    expect(ch.id).toBeDefined();
    expect(ch.channelType).toBe("in_app");
    expect(ch.rateLimitPerMinute).toBe(60);
  });

  it("rejects invalid channel type", async () => {
    const env = makeEnv();
    await expect(createChannel(env, { projectId, name: "X", channelType: "sms" })).rejects.toThrow("Invalid channel type");
  });

  it("creates rules", async () => {
    const env = makeEnv();
    const ch = await createChannel(env, { projectId, name: "Ch", channelType: "in_app" });
    const rule = await createRule(env, { projectId, channelId: ch.id, name: "New message", triggerEvent: "message.created", priority: 5 });
    expect(rule.triggerEvent).toBe("message.created");
    expect(rule.priority).toBe(5);
  });

  it("sends notification", async () => {
    const env = makeEnv();
    const ch = await createChannel(env, { projectId, name: "Ch", channelType: "in_app" });
    const n = await sendNotification(env, { projectId, channelId: ch.id, userId: "u1", title: "New message", body: "Hello!" });
    expect(n.status).toBe("delivered");
    expect(n.title).toBe("New message");
  });

  it("sends bulk notifications", async () => {
    const env = makeEnv();
    const ch = await createChannel(env, { projectId, name: "Ch", channelType: "in_app" });
    const result = await sendBulkNotifications(env, {
      projectId, channelId: ch.id, userIds: ["u1", "u2", "u3"], title: "Broadcast", body: "System update",
    });
    expect(result.count).toBe(3);
  });

  it("gets user notifications", async () => {
    const env = makeEnv();
    const ch = await createChannel(env, { projectId, name: "Ch", channelType: "in_app" });
    await sendNotification(env, { projectId, channelId: ch.id, userId: "u1", title: "N1", body: "b1" });
    await sendNotification(env, { projectId, channelId: ch.id, userId: "u1", title: "N2", body: "b2" });
    const notifs = await getUserNotifications(env, { projectId, userId: "u1" });
    expect(notifs.length).toBe(2);
  });

  it("marks as read", async () => {
    const env = makeEnv();
    const ch = await createChannel(env, { projectId, name: "Ch", channelType: "in_app" });
    const n = await sendNotification(env, { projectId, channelId: ch.id, userId: "u1", title: "N", body: "b" });
    const ok = await markAsRead(env, { projectId, notificationId: n.id });
    expect(ok).toBe(true);
  });

  it("gets unread count", async () => {
    const env = makeEnv();
    const ch = await createChannel(env, { projectId, name: "Ch", channelType: "in_app" });
    await sendNotification(env, { projectId, channelId: ch.id, userId: "u1", title: "N1", body: "b" });
    await sendNotification(env, { projectId, channelId: ch.id, userId: "u1", title: "N2", body: "b" });
    const count = await getUnreadCount(env, { projectId, userId: "u1" });
    expect(count).toBe(2);
  });

  it("gets notification stats", async () => {
    const env = makeEnv();
    const ch = await createChannel(env, { projectId, name: "Ch", channelType: "in_app" });
    await sendNotification(env, { projectId, channelId: ch.id, userId: "u1", title: "N", body: "b" });
    const stats = await getNotificationStats(env, { projectId });
    expect(stats.total).toBe(1);
    expect(stats.unread).toBe(1);
  });
});
