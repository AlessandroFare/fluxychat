import { describe, it, expect } from "vitest";
import {
  createSegment, getSegment, listSegments, deleteSegment,
  createCampaign, getCampaign, listCampaigns, sendCampaign, completeCampaign,
  createDelivery, markDelivered, markRead, markFailed,
  listDeliveries, getBroadcastStats,
} from "../lib/broadcast-segmentation.js";

function mockDb(rows = []) {
  const run = async () => ({ meta: { changes: 1 } });
  const first = async () => rows[0] || null;
  const all = async () => ({ results: rows });
  return { prepare: () => ({ bind: () => ({ run, first, all }) }) };
}

describe("broadcast-segmentation", () => {
  describe("createSegment", () => {
    it("creates segment", async () => {
      const env = { DB: mockDb() };
      const seg = await createSegment(env, {
        projectId: "p1", name: "Premium Users",
        segmentType: "dynamic", rules: [{ field: "plan", op: "eq", value: "pro" }],
      });
      expect(seg.id).toBeDefined();
      expect(seg.name).toBe("Premium Users");
    });
    it("rejects invalid type", async () => {
      const env = { DB: mockDb() };
      await expect(createSegment(env, { projectId: "p1", name: "x", segmentType: "bad" }))
        .rejects.toThrow("Invalid segment type");
    });
  });

  describe("listSegments", () => {
    it("lists segments", async () => {
      const env = { DB: mockDb([
        { id: "s1", project_id: "p1", name: "A", description: null, segment_type: "dynamic", rules: "[]", user_count: 10, last_computed_at: null, created_at: "2026-01-01" },
      ])};
      const segs = await listSegments(env, { projectId: "p1" });
      expect(segs).toHaveLength(1);
    });
  });

  describe("createCampaign", () => {
    it("creates campaign", async () => {
      const env = { DB: mockDb() };
      const camp = await createCampaign(env, {
        projectId: "p1", name: "Launch Announce", messageTemplate: "Hello {name}!",
        channel: "email",
      });
      expect(camp.id).toBeDefined();
      expect(camp.status).toBe("draft");
      expect(camp.channel).toBe("email");
    });
    it("rejects invalid channel", async () => {
      const env = { DB: mockDb() };
      await expect(createCampaign(env, { projectId: "p1", name: "x", messageTemplate: "hi", channel: "sms" }))
        .rejects.toThrow("Invalid channel");
    });
  });

  describe("sendCampaign", () => {
    it("sends draft campaign", async () => {
      const env = { DB: mockDb([{
        id: "c1", project_id: "p1", segment_id: null, name: "Test",
        message_template: "Hi", channel: "in_app", status: "draft",
        scheduled_at: null, sent_at: null, total_recipients: 0,
        delivered: 0, failed: 0, created_at: "2026-01-01",
      }])};
      const result = await sendCampaign(env, { projectId: "p1", campaignId: "c1" });
      expect(result.status).toBe("sending");
    });
    it("throws for non-draft", async () => {
      const env = { DB: mockDb([{
        id: "c1", project_id: "p1", segment_id: null, name: "Test",
        message_template: "Hi", channel: "in_app", status: "sent",
        scheduled_at: null, sent_at: "2026-01-01", total_recipients: 10,
        delivered: 8, failed: 2, created_at: "2026-01-01",
      }])};
      await expect(sendCampaign(env, { projectId: "p1", campaignId: "c1" }))
        .rejects.toThrow("Campaign not in draft status");
    });
  });

  describe("createDelivery", () => {
    it("creates delivery", async () => {
      const env = { DB: mockDb() };
      const del = await createDelivery(env, { projectId: "p1", campaignId: "c1", userId: "u1" });
      expect(del.id).toBeDefined();
      expect(del.status).toBe("pending");
    });
  });

  describe("markDelivered", () => {
    it("marks delivered", async () => {
      const env = { DB: mockDb() };
      const ok = await markDelivered(env, { projectId: "p1", deliveryId: "d1" });
      expect(ok).toBe(true);
    });
  });

  describe("markRead", () => {
    it("marks read", async () => {
      const env = { DB: mockDb() };
      const ok = await markRead(env, { projectId: "p1", deliveryId: "d1" });
      expect(ok).toBe(true);
    });
  });

  describe("markFailed", () => {
    it("marks failed with error", async () => {
      const env = { DB: mockDb() };
      const ok = await markFailed(env, { projectId: "p1", deliveryId: "d1", error: "bounced" });
      expect(ok).toBe(true);
    });
  });

  describe("getBroadcastStats", () => {
    it("returns stats", async () => {
      const env = { DB: mockDb([
        { total: 100 },
        { status: "delivered", count: 85 },
        { status: "failed", count: 15 },
      ])};
      const stats = await getBroadcastStats(env, { projectId: "p1", campaignId: "c1" });
      expect(stats.total).toBe(100);
    });
  });
});
