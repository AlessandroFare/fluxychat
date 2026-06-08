import { describe, expect, it, vi, afterEach } from "vitest";
import {
  enqueueBatchedNotification,
  flushUserNotificationBatch,
} from "./notification-batch.js";

vi.mock("./push-notifications.js", () => ({
  getFcmTokensForUser: vi.fn(async () => []),
  sendFcmNotification: vi.fn(async () => ({ sent: 0 })),
  sendWebPushToUser: vi.fn(async () => ({ sent: 1 })),
}));


describe("notification-batch", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("enqueueBatchedNotification stores rows", async () => {
    const env = createBatchEnv();
    const result = await enqueueBatchedNotification(env, {
      projectId: "proj_1",
      userId: "user_1",
      channel: "push",
      kind: "mention",
      title: "Mention",
      body: "Hello",
      roomId: "room_1",
      messageId: 5,
    });
    expect(result.ok).toBe(true);
    expect(env._queue).toHaveLength(1);
  });

  it("flushUserNotificationBatch consolidates and clears queue", async () => {
    const env = createBatchEnv();
    await enqueueBatchedNotification(env, {
      projectId: "proj_1",
      userId: "user_1",
      channel: "push",
      kind: "message",
      title: "New message",
      body: "Hi",
      roomId: "room_1",
      messageId: 1,
    });
    await enqueueBatchedNotification(env, {
      projectId: "proj_1",
      userId: "user_1",
      channel: "in_app",
      kind: "mention",
      title: "Mention",
      body: "Ping",
      roomId: "room_1",
      messageId: 2,
    });

    const { sendWebPushToUser } = await import("./push-notifications.js");

    const flushed = await flushUserNotificationBatch(env, "proj_1", "user_1");
    expect(flushed.flushed).toBe(2);
    expect(env._queue).toHaveLength(0);
    expect(sendWebPushToUser).toHaveBeenCalled();
    expect(env._inApp).toHaveLength(1);
  });
});

function createBatchEnv() {
  const queue = [];
  const inApp = [];
  const env = {
    _queue: queue,
    _inApp: inApp,
    DB: {
      prepare(sql) {
        return {
          bind(...binds) {
            return {
              first: async () => {
                if (sql.includes("COUNT(*)")) {
                  return { cnt: queue.filter((q) => q.project_id === binds[0] && q.user_id === binds[1]).length };
                }
                return null;
              },
              all: async () => {
                if (sql.includes("FROM notification_batch_queue")) {
                  return {
                    results: queue
                      .filter((q) => q.project_id === binds[0] && q.user_id === binds[1])
                      .sort((a, b) => a.created_at.localeCompare(b.created_at))
                      .slice(0, binds[2] ?? 100),
                  };
                }
                return { results: [] };
              },
              run: async () => {
                if (sql.includes("INSERT INTO notification_batch_queue")) {
                  queue.push({
                    id: binds[0],
                    project_id: binds[1],
                    user_id: binds[2],
                    channel: binds[3],
                    kind: binds[4],
                    title: binds[5],
                    body: binds[6],
                    room_id: binds[7],
                    message_id: binds[8],
                    payload_json: binds[9],
                    created_at: binds[10],
                  });
                  return { meta: { changes: 1 } };
                }
                if (sql.includes("DELETE FROM notification_batch_queue")) {
                  const ids = new Set(binds);
                  const before = queue.length;
                  for (let i = queue.length - 1; i >= 0; i--) {
                    if (ids.has(queue[i].id)) queue.splice(i, 1);
                  }
                  return { meta: { changes: before - queue.length } };
                }
                if (sql.includes("INSERT INTO in_app_notifications")) {
                  inApp.push({
                    project_id: binds[0],
                    user_id: binds[1],
                    kind: binds[2],
                    title: binds[3],
                    body: binds[4],
                  });
                  return { meta: { changes: 1 } };
                }
                return { meta: { changes: 0 } };
              },
            };
          },
        };
      },
    },
  };
  return env;
}
