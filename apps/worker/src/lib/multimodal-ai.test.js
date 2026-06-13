import { describe, it, expect } from "vitest";

function makeEnv() {
  const rows = [];
  return {
    AI_BASE_URL: null,
    DB: {
      prepare(sql) {
        let boundParams = [];
        return {
          bind(...params) { boundParams = params; return this; },
          async run() {
            if (sql.includes("INSERT INTO multimodal_analyses")) {
              rows.push({
                id: boundParams[0], project_id: boundParams[1], message_id: boundParams[2],
                room_id: boundParams[3], media_type: boundParams[4], media_url: boundParams[5],
                analysis_result: boundParams[6], ai_model: boundParams[7], tokens_used: boundParams[8],
                processing_time_ms: boundParams[9], created_at: new Date().toISOString(),
              });
              return { meta: { changes: 1 } };
            }
            return { meta: { changes: 1 } };
          },
           async first() {
            const pid = boundParams[0];
            if (sql.includes("COUNT(*) as total")) {
              return { total: rows.filter(r => r.project_id === pid).length };
            }
            const mid = boundParams[1];
            return rows.find(r => r.project_id === pid && r.message_id === mid) || null;
          },
          async all() {
            const pid = boundParams[0];
            if (sql.includes("GROUP BY media_type")) {
              const map = {};
              for (const r of rows.filter(r => r.project_id === pid)) {
                map[r.media_type] = (map[r.media_type] || 0) + 1;
              }
              return { results: Object.entries(map).map(([media_type, count]) => ({ media_type, count })) };
            }
            if (sql.includes("COUNT(*) as total")) {
              return { results: [{ total: rows.filter(r => r.project_id === pid).length }] };
            }
            const rid = boundParams[1];
            return { results: rows.filter(r => r.project_id === pid && r.room_id === rid).slice(0, boundParams[2] || 20) };
          },
        };
      },
    },
  };
}

import {
  analyzeMedia,
  getMediaAnalysis,
  getRoomMediaAnalyses,
  moderateMediaContent,
  getMediaStats,
} from "./multimodal-ai.js";

describe("P15-I: Multimodal AI", () => {
  const projectId = "proj_mm_1";

  it("analyzes image (mock mode)", async () => {
    const env = makeEnv();
    const result = await analyzeMedia(env, {
      projectId, messageId: "msg_1", roomId: "r1",
      mediaType: "image", mediaUrl: "https://example.com/photo.jpg",
    });
    expect(result.id).toBeDefined();
    expect(result.mediaType).toBe("image");
    expect(result.analysis.description).toBeDefined();
    expect(result.analysis.mock).toBe(true);
  });

  it("rejects invalid media type", async () => {
    const env = makeEnv();
    await expect(analyzeMedia(env, {
      projectId, messageId: "msg_1", roomId: "r1",
      mediaType: "invalid", mediaUrl: "https://example.com/file",
    })).rejects.toThrow("Invalid media type");
  });

  it("analyzes audio (mock mode)", async () => {
    const env = makeEnv();
    const result = await analyzeMedia(env, {
      projectId, messageId: "msg_2", roomId: "r1",
      mediaType: "audio", mediaUrl: "https://example.com/audio.mp3",
    });
    expect(result.mediaType).toBe("audio");
    expect(result.analysis.description).toContain("Mock analysis");
  });

  it("gets media analysis by message", async () => {
    const env = makeEnv();
    await analyzeMedia(env, {
      projectId, messageId: "msg_3", roomId: "r1",
      mediaType: "image", mediaUrl: "https://example.com/photo.jpg",
    });
    const analysis = await getMediaAnalysis(env, { projectId, messageId: "msg_3" });
    expect(analysis).not.toBeNull();
    expect(analysis.mediaType).toBe("image");
  });

  it("gets room media analyses", async () => {
    const env = makeEnv();
    await analyzeMedia(env, { projectId, messageId: "m1", roomId: "r2", mediaType: "image", mediaUrl: "a.jpg" });
    await analyzeMedia(env, { projectId, messageId: "m2", roomId: "r2", mediaType: "video", mediaUrl: "b.mp4" });
    const list = await getRoomMediaAnalyses(env, { projectId, roomId: "r2" });
    expect(list.length).toBe(2);
  });

  it("moderates media content", async () => {
    const env = makeEnv();
    await analyzeMedia(env, {
      projectId, messageId: "msg_mod", roomId: "r1",
      mediaType: "image", mediaUrl: "https://example.com/safe.jpg",
    });
    const mod = await moderateMediaContent(env, { projectId, messageId: "msg_mod" });
    expect(mod.status).toBeDefined();
    expect(typeof mod.safe).toBe("boolean");
  });

  it("returns no_analysis for unknown message", async () => {
    const env = makeEnv();
    const mod = await moderateMediaContent(env, { projectId, messageId: "unknown" });
    expect(mod.status).toBe("no_analysis");
    expect(mod.safe).toBe(true);
  });

  it("gets media stats", async () => {
    const env = makeEnv();
    await analyzeMedia(env, { projectId, messageId: "m1", roomId: "r1", mediaType: "image", mediaUrl: "a.jpg" });
    await analyzeMedia(env, { projectId, messageId: "m2", roomId: "r1", mediaType: "audio", mediaUrl: "b.mp3" });
    const stats = await getMediaStats(env, { projectId });
    expect(stats.total).toBe(2);
    expect(stats.byType.length).toBe(2);
  });
});
