import { describe, expect, it, vi } from "vitest";
import {
  analyzeVisualImage,
  analyzeStreamFrame,
  isImageAttachment,
  pickImageAttachments,
  scanMessageVisualContent,
} from "./visual-moderation.js";

function createVisualEnv(overrides = {}) {
  const queue = [];
  const r2Objects = new Map();

  const env = {
    VISUAL_MODERATION_ENABLED: "true",
    AI_GATEWAY_URL: "https://gateway.test/v1/acct/gw/openai",
    AI_GATEWAY_TOKEN: "test-token",
    ATTACHMENTS: {
      async get(key) {
        return r2Objects.get(key) || null;
      },
    },
    DB: {
      prepare(sql) {
        return {
          bind(...args) {
            return {
              async run() {
                if (sql.includes("INSERT INTO ai_moderation_queue")) {
                  queue.push({
                    id: args[0],
                    project_id: args[1],
                    room_id: args[2],
                    content: args[5],
                    severity: args[6],
                    reason: args[8],
                  });
                }
                if (sql.includes("INSERT INTO moderation_events")) {
                  return { success: true };
                }
                if (sql.includes("UPDATE messages SET deleted_at")) {
                  return { success: true };
                }
                return { success: true };
              },
              async first() {
                return null;
              },
            };
          },
        };
      },
    },
    ...overrides,
  };

  return { env, queue, r2Objects };
}

describe("visual-moderation", () => {
  it("detects image attachments", () => {
    expect(isImageAttachment({ url: "/attachments/p/r/x.png", kind: "image" })).toBe(true);
    expect(isImageAttachment({ url: "/attachments/p/r/x.pdf", kind: "file" })).toBe(false);
    expect(pickImageAttachments([
      { url: "/a.png", kind: "image" },
      { url: "/b.pdf", kind: "file" },
      { url: "/c.jpg", contentType: "image/jpeg" },
    ])).toHaveLength(2);
  });

  it("returns none when AI returns clean JSON", async () => {
    const { env } = createVisualEnv();
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{
          message: {
            content: JSON.stringify({
              severity: "none",
              categories: [],
              reason: "safe",
              confidence: 0.95,
              suggested_action: "none",
            }),
          },
        }],
      }),
    });

    const result = await analyzeVisualImage(env, {
      projectId: "p1",
      roomId: "r1",
      userId: "u1",
      imageBase64: btoa("fake-image-bytes"),
    });

    expect(result.ok).toBe(true);
    expect(result.severity).toBe("none");
  });

  it("queues flagged attachment scan", async () => {
    const { env, queue, r2Objects } = createVisualEnv();
    r2Objects.set("proj/room/img.png", {
      httpMetadata: { contentType: "image/png" },
      async arrayBuffer() {
        return new TextEncoder().encode("png-bytes").buffer;
      },
    });

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{
          message: {
            content: JSON.stringify({
              severity: "high",
              categories: ["nsfw"],
              reason: "explicit content",
              confidence: 0.9,
              suggested_action: "warn",
            }),
          },
        }],
      }),
    });

    const result = await scanMessageVisualContent(env, {
      projectId: "p1",
      roomId: "r1",
      authorUserId: "u1",
      messageId: 42,
      attachments: [{ url: "/attachments/proj/room/img.png", kind: "image", name: "img.png" }],
    });

    expect(result.scanned).toBe(1);
    expect(result.flagged).toBe(1);
    expect(queue).toHaveLength(1);
    expect(queue[0].content).toContain("[visual]");
    expect(queue[0].reason).toContain("visual:");
  });

  it("analyzeStreamFrame flags unsafe frames", async () => {
    const { env, queue } = createVisualEnv();
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{
          message: {
            content: JSON.stringify({
              severity: "medium",
              categories: ["violence"],
              reason: "weapon visible",
              confidence: 0.85,
              suggested_action: "flag",
            }),
          },
        }],
      }),
    });

    const result = await analyzeStreamFrame(env, {
      projectId: "p1",
      roomId: "live-room",
      userId: "mod1",
      eventId: "evt-1",
      frameIndex: 3,
      imageBase64: btoa("frame-bytes"),
    });

    expect(result.ok).toBe(true);
    expect(result.safe).toBe(false);
    expect(result.severity).toBe("medium");
    expect(queue).toHaveLength(1);
  });

  it("skips when disabled", async () => {
    const { env } = createVisualEnv({ VISUAL_MODERATION_ENABLED: "false" });
    const result = await scanMessageVisualContent(env, {
      projectId: "p1",
      roomId: "r1",
      authorUserId: "u1",
      attachments: [{ url: "/a.png", kind: "image" }],
    });
    expect(result.scanned).toBe(0);
  });
});
