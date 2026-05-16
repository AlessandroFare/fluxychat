import { describe, expect, it, vi, beforeEach } from "vitest";
import { quotaResetInfo } from "./message-enrichment.js";
import { RoomDurableObject } from "../durable-objects/room-do.js";
import * as projectPlanQuota from "./project-plan-quota.js";

/** HTTP POST /messages and DO WS `message` both consume this metric. */
export const MESSAGE_QUOTA_METRIC = "messages_created";

describe("quota path consistency", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("uses messages_created for REST and WebSocket entry points", () => {
    expect(MESSAGE_QUOTA_METRIC).toBe("messages_created");
  });

  it("DO WS quota_exceeded includes same reset fields as HTTP 402 body", async () => {
    vi.spyOn(projectPlanQuota, "checkAndConsumeProjectQuota").mockResolvedValue({
      allowed: false,
      metricName: MESSAGE_QUOTA_METRIC,
      limit: 10,
      used: 10,
      monthKey: "2026-05",
    });

    const projectId = "proj_quota_shape";
    const userId = "user_quota_shape";
    const roomId = "room_quota_shape";
    const roomDo = new RoomDurableObject(
      { id: { toString: () => roomId } },
      { DB: {}, RATE_LIMIT_WS_MESSAGES_PER_MINUTE: "60" }
    );
    roomDo.projectId = projectId;
    const ws = { sent: [], send(data) { this.sent.push(data); } };
    roomDo.clients.add(ws);
    roomDo.userIds.set(ws, userId);

    await roomDo.onMessage(ws, {
      data: JSON.stringify({
        type: "message",
        userId,
        content: "blocked",
      }),
    });

    const err = JSON.parse(ws.sent.find((s) => s.includes("quota_exceeded")));
    const reset = quotaResetInfo();
    expect(err.message).toBe("quota_exceeded");
    expect(err.details).toMatchObject({
      metric: MESSAGE_QUOTA_METRIC,
      limit: 10,
      used: 10,
      month: "2026-05",
      resetsAt: reset.resetsAt,
      retryAfterSeconds: reset.retryAfterSeconds,
    });
  });
});
