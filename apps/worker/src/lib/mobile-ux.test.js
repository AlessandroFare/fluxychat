import { describe, it, expect } from "vitest";
import {
  logPushDelivery,
  getPushDeliveryStats,
  enqueueOfflineMessage,
  getPendingOfflineMessages,
  markOfflineMessagesSent,
  sweepExpiredOfflineQueue,
  registerDevice,
  listDevices,
  deactivateDevice,
  generatePWAManifest,
} from "./mobile-ux.js";

function createMockDb({ deliveries = [], offlineQueue = [], devices = [] } = {}) {
  return {
    deliveries: [...deliveries],
    offlineQueue: [...offlineQueue],
    devices: [...devices],
    prepare(sql) {
      const self = this;
      return {
        bind(...args) {
          return {
            async all() {
              if (sql.includes("push_delivery_log") && sql.includes("GROUP BY status")) {
                const counts = {};
                for (const d of self.deliveries.filter((d) => d.project_id === args[0])) {
                  counts[d.status] = (counts[d.status] || 0) + 1;
                }
                return { results: Object.entries(counts).map(([status, cnt]) => ({ status, cnt })) };
              }
              if (sql.includes("offline_message_queue") && sql.includes("LIMIT")) {
                const filtered = self.offlineQueue.filter(
                  (q) => q.project_id === args[0] && q.user_id === args[1] && q.status === "pending"
                );
                return { results: filtered.slice(0, Number(args[2]) || 50) };
              }
              if (sql.includes("device_registrations") && sql.includes("is_active") && sql.includes("ORDER BY")) {
                return {
                  results: self.devices
                    .filter((d) => d.project_id === args[0] && d.user_id === args[1] && d.is_active)
                    .sort((a, b) => (b.last_seen_at > a.last_seen_at ? 1 : -1)),
                };
              }
              return { results: [] };
            },
            async first() {
              if (sql.includes("COUNT(*)") && sql.includes("offline_message_queue")) {
                const cnt = self.offlineQueue.filter((q) => q.user_id === args[0] && q.status === "pending").length;
                return { cnt };
              }
              if (sql.includes("SELECT id FROM device_registrations") && sql.includes("platform = ?")) {
                return self.devices.find(
                  (d) => d.project_id === args[0] && d.user_id === args[1] && d.platform === args[2]
                ) || null;
              }
              if (sql.includes("SELECT id FROM device_registrations") && sql.includes("id = ?") && !sql.includes("platform")) {
                return self.devices.find(
                  (d) => d.id === args[0] && d.project_id === args[1] && d.user_id === args[2]
                ) || null;
              }
              return null;
            },
            async run() {
              if (sql.includes("INSERT INTO push_delivery_log")) {
                const entry = {
                  id: args[0], project_id: args[1], user_id: args[2], room_id: args[3],
                  message_id: args[4], platform: args[5], status: args[6],
                  created_at: args[10],
                };
                self.deliveries.push(entry);
                return { meta: { changes: 1 } };
              }
              if (sql.includes("INSERT INTO offline_message_queue")) {
                self.offlineQueue.push({
                  id: args[0], project_id: args[1], user_id: args[2], room_id: args[3],
                  content: args[5], temp_id: args[6], status: "pending",
                  created_at: args[8], expires_at: args[9],
                });
                return { meta: { changes: 1 } };
              }
              if (sql.includes("UPDATE offline_message_queue") && sql.includes("sent")) {
                let count = 0;
                for (const q of self.offlineQueue) {
                  if (q.id === args[1] && q.status === "pending") {
                    q.status = "sent";
                    count++;
                  }
                }
                return { meta: { changes: count } };
              }
              if (sql.includes("UPDATE offline_message_queue") && sql.includes("expired")) {
                let count = 0;
                const now = new Date().toISOString();
                for (const q of self.offlineQueue) {
                  if (q.status === "pending" && q.expires_at && q.expires_at < now) {
                    q.status = "expired";
                    count++;
                  }
                }
                return { meta: { changes: count } };
              }
              if (sql.includes("INSERT INTO device_registrations")) {
                self.devices.push({
                  id: args[0], project_id: args[1], user_id: args[2], platform: args[3],
                  endpoint: args[4], push_token: args[5], is_active: 1,
                  last_seen_at: args[10], created_at: args[11],
                });
                return { meta: { changes: 1 } };
              }
              if (sql.includes("UPDATE device_registrations") && sql.includes("is_active = 0")) {
                for (const d of self.devices) {
                  if (d.id === args[0]) d.is_active = 0;
                }
                return { meta: { changes: 1 } };
              }
              return { meta: { changes: 0 } };
            },
          };
        },
        async run() {
          if (sql.includes("UPDATE offline_message_queue") && sql.includes("expired")) {
            let count = 0;
            const now = new Date().toISOString();
            for (const q of self.offlineQueue) {
              if (q.status === "pending" && q.expires_at && q.expires_at < now) {
                q.status = "expired";
                count++;
              }
            }
            return { meta: { changes: count } };
          }
          return { meta: { changes: 0 } };
        },
      };
    },
  };
}

describe("mobile-ux", () => {
  describe("logPushDelivery", () => {
    it("logs delivery", async () => {
      const db = createMockDb();
      const result = await logPushDelivery({ DB: db }, {
        projectId: "p1", userId: "u1", roomId: "r1", messageId: 1, platform: "fcm", status: "sent",
      });
      expect(result.ok).toBe(true);
      expect(db.deliveries.length).toBe(1);
    });
    it("handles missing fields gracefully", async () => {
      const db = createMockDb();
      const result = await logPushDelivery({ DB: db }, { projectId: "p1", roomId: "r1" });
      expect(result.ok).toBe(false);
      expect(result.error).toBe("missing_required_fields");
    });
  });

  describe("getPushDeliveryStats", () => {
    it("returns stats by status", async () => {
      const db = createMockDb({
        deliveries: [
          { project_id: "p1", status: "sent" },
          { project_id: "p1", status: "sent" },
          { project_id: "p1", status: "failed" },
        ],
      });
      const result = await getPushDeliveryStats({ DB: db }, { projectId: "p1" });
      expect(result.ok).toBe(true);
      expect(result.byStatus.sent).toBe(2);
      expect(result.byStatus.failed).toBe(1);
      expect(result.total).toBe(3);
    });
  });

  describe("enqueueOfflineMessage", () => {
    it("enqueues a message", async () => {
      const db = createMockDb();
      const result = await enqueueOfflineMessage({ DB: db }, {
        projectId: "p1", userId: "u1", roomId: "r1", content: "hello", tempId: "t1",
      });
      expect(result.ok).toBe(true);
      expect(result.tempId).toBe("t1");
    });
    it("rejects empty content", async () => {
      const db = createMockDb();
      const result = await enqueueOfflineMessage({ DB: db }, {
        projectId: "p1", userId: "u1", roomId: "r1", content: "  ",
      });
      expect(result.ok).toBe(false);
      expect(result.error).toBe("content_required");
    });
    it("rejects when queue full", async () => {
      const queue = Array.from({ length: 50 }, (_, i) => ({
        id: `q${i}`, project_id: "p1", user_id: "u1", room_id: "r1",
        content: "x", status: "pending",
      }));
      const db = createMockDb({ offlineQueue: queue });
      const result = await enqueueOfflineMessage({ DB: db }, {
        projectId: "p1", userId: "u1", roomId: "r1", content: "hi",
      });
      expect(result.ok).toBe(false);
      expect(result.error).toBe("queue_full");
    });
  });

  describe("getPendingOfflineMessages", () => {
    it("returns pending messages", async () => {
      const db = createMockDb({
        offlineQueue: [
          { id: "q1", project_id: "p1", user_id: "u1", room_id: "r1", content: "a", status: "pending", temp_id: "t1", created_at: "2026-01-01" },
          { id: "q2", project_id: "p1", user_id: "u1", room_id: "r1", content: "b", status: "sent", temp_id: "t2", created_at: "2026-01-01" },
        ],
      });
      const result = await getPendingOfflineMessages({ DB: db }, { projectId: "p1", userId: "u1" });
      expect(result.ok).toBe(true);
      expect(result.count).toBe(1);
    });
  });

  describe("markOfflineMessagesSent", () => {
    it("marks messages sent", async () => {
      const db = createMockDb({
        offlineQueue: [{ id: "q1", status: "pending" }, { id: "q2", status: "pending" }],
      });
      const result = await markOfflineMessagesSent({ DB: db }, { ids: ["q1", "q2"] });
      expect(result.ok).toBe(true);
      expect(result.sent).toBe(2);
    });
    it("handles empty ids", async () => {
      const db = createMockDb();
      const result = await markOfflineMessagesSent({ DB: db }, { ids: [] });
      expect(result.ok).toBe(true);
      expect(result.sent).toBe(0);
    });
  });

  describe("sweepExpiredOfflineQueue", () => {
    it("sweeps expired entries", async () => {
      const db = createMockDb({
        offlineQueue: [
          { id: "q1", status: "pending", expires_at: "2020-01-01T00:00:00.000Z" },
          { id: "q2", status: "pending", expires_at: "2099-01-01T00:00:00.000Z" },
        ],
      });
      const result = await sweepExpiredOfflineQueue({ DB: db });
      expect(result.ok).toBe(true);
      expect(result.expired).toBe(1);
    });
  });

  describe("registerDevice", () => {
    it("registers a new device", async () => {
      const db = createMockDb();
      const result = await registerDevice({ DB: db }, {
        projectId: "p1", userId: "u1", platform: "fcm", pushToken: "tok123",
      });
      expect(result.ok).toBe(true);
      expect(result.updated).toBe(false);
      expect(db.devices.length).toBe(1);
    });
    it("updates existing device", async () => {
      const db = createMockDb({
        devices: [{ id: "d1", project_id: "p1", user_id: "u1", platform: "fcm", endpoint: null, push_token: "old", is_active: 1 }],
      });
      const result = await registerDevice({ DB: db }, {
        projectId: "p1", userId: "u1", platform: "fcm", pushToken: "new",
      });
      expect(result.ok).toBe(true);
      expect(result.updated).toBe(true);
    });
    it("rejects invalid platform", async () => {
      const db = createMockDb();
      const result = await registerDevice({ DB: db }, {
        projectId: "p1", userId: "u1", platform: "invalid",
      });
      expect(result.ok).toBe(false);
      expect(result.error).toBe("invalid_platform");
    });
  });

  describe("listDevices", () => {
    it("lists active devices", async () => {
      const db = createMockDb({
        devices: [
          { id: "d1", project_id: "p1", user_id: "u1", platform: "fcm", is_active: 1, last_seen_at: "2026-01-01", created_at: "2026-01-01" },
          { id: "d2", project_id: "p1", user_id: "u1", platform: "web", is_active: 0, last_seen_at: "2026-01-01", created_at: "2026-01-01" },
        ],
      });
      const result = await listDevices({ DB: db }, { projectId: "p1", userId: "u1" });
      expect(result.ok).toBe(true);
      expect(result.count).toBe(1);
    });
  });

  describe("deactivateDevice", () => {
    it("deactivates a device", async () => {
      const db = createMockDb({
        devices: [{ id: "d1", project_id: "p1", user_id: "u1" }],
      });
      const result = await deactivateDevice({ DB: db }, {
        projectId: "p1", userId: "u1", deviceId: "d1",
      });
      expect(result.ok).toBe(true);
    });
    it("rejects missing device id", async () => {
      const db = createMockDb();
      const result = await deactivateDevice({ DB: db }, {
        projectId: "p1", userId: "u1", deviceId: null,
      });
      expect(result.ok).toBe(false);
    });
  });

  describe("generatePWAManifest", () => {
    it("returns valid manifest", () => {
      const manifest = generatePWAManifest();
      expect(manifest.name).toBe("FluxyChat");
      expect(manifest.display).toBe("standalone");
      expect(manifest.icons.length).toBe(3);
    });
    it("accepts custom options", () => {
      const manifest = generatePWAManifest({ name: "MyApp", shortName: "MA" });
      expect(manifest.name).toBe("MyApp");
      expect(manifest.short_name).toBe("MA");
    });
  });
});
