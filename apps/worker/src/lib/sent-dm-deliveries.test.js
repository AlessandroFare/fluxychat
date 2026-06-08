import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  insertSentDmDelivery,
  updateSentDmDeliveryBySentId,
  handleSentDmWebhookEvent,
} from "./sent-dm-deliveries.js";

function mockEnv() {
  const runs = [];
  return {
    runs,
    DB: {
      prepare: (sql) => ({
        bind: (...args) => ({
          run: () => {
            runs.push({ sql, args, type: "run" });
            return Promise.resolve({ meta: { changes: 1 } });
          },
        }),
      }),
    },
  };
}

describe("sent-dm-deliveries", () => {
  it("inserts delivery row", async () => {
    const env = mockEnv();
    const id = await insertSentDmDelivery(env, {
      projectId: "p1",
      userId: "u1",
      toE164: "+14155551234",
      sentMessageId: "sent-1",
      roomId: "room-a",
      fluxyMessageId: 99,
    });
    expect(id).toBeTruthy();
    expect(env.runs[0].sql).toContain("INSERT INTO sent_dm_deliveries");
  });

  it("updates status by sent message id", async () => {
    const env = mockEnv();
    const ok = await updateSentDmDeliveryBySentId(env, "sent-abc", {
      status: "delivered",
    });
    expect(ok).toBe(true);
  });

  it("handles webhook delivery event", async () => {
    const env = mockEnv();
    const result = await handleSentDmWebhookEvent(env, {
      type: "message.delivered",
      data: { id: "sent-abc", status: "delivered" },
    });
    expect(result.ok).toBe(true);
    expect(result.updated).toBe(true);
  });
});
