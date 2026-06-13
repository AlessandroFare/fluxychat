import { describe, it, expect, vi } from "vitest";

vi.mock("cloudflare:test", () => ({ env: { DB: { prepare: vi.fn() } } }));

function mockDB(rows = []) {
  const chain = {
    bind: vi.fn().mockReturnThis(),
    run: vi.fn().mockResolvedValue({ meta: { changes: 1 } }),
    first: vi.fn().mockResolvedValue(rows[0] || null),
    all: vi.fn().mockResolvedValue({ results: rows }),
  };
  return chain;
}

const env = {};

describe("voice-translation", () => {
  it("creates profile", async () => {
    const db = mockDB([]);
    env.DB = { prepare: vi.fn().mockReturnValue(db) };
    const { upsertProfile } = await import("../lib/voice-translation.js");
    const result = await upsertProfile(env, { projectId: "p1", userId: "u1", preferredTargetLang: "es" });
    expect(result.id).toMatch(/^vtp_/);
    expect(result.created).toBe(true);
  });

  it("updates existing profile", async () => {
    const db = mockDB([{ id: "vtp_existing" }]);
    env.DB = { prepare: vi.fn().mockReturnValue(db) };
    const { upsertProfile } = await import("../lib/voice-translation.js");
    const result = await upsertProfile(env, { projectId: "p1", userId: "u1", preferredTargetLang: "fr" });
    expect(result.id).toBe("vtp_existing");
    expect(result.updated).toBe(true);
  });

  it("gets profile", async () => {
    const db = mockDB([{ preferred_source_lang: "auto", preferred_target_lang: "es", auto_translate: 1 }]);
    env.DB = { prepare: vi.fn().mockReturnValue(db) };
    const { getProfile } = await import("../lib/voice-translation.js");
    const result = await getProfile(env, { projectId: "p1", userId: "u1" });
    expect(result.preferredTargetLang).toBe("es");
  });

  it("creates room config", async () => {
    const db = mockDB([]);
    env.DB = { prepare: vi.fn().mockReturnValue(db) };
    const { upsertRoomConfig } = await import("../lib/voice-translation.js");
    const result = await upsertRoomConfig(env, { projectId: "p1", roomId: "r1" });
    expect(result.id).toMatch(/^vtr_/);
  });

  it("creates translation job", async () => {
    const db = mockDB([]);
    env.DB = { prepare: vi.fn().mockReturnValue(db) };
    const { createJob } = await import("../lib/voice-translation.js");
    const result = await createJob(env, { projectId: "p1", roomId: "r1", targetLang: "es", sourceText: "Hello" });
    expect(result.id).toMatch(/^vtj_/);
    expect(result.status).toBe("pending");
  });

  it("completes job", async () => {
    const db = mockDB();
    env.DB = { prepare: vi.fn().mockReturnValue(db) };
    const { completeJob } = await import("../lib/voice-translation.js");
    const result = await completeJob(env, { jobId: "vtj_1", sourceLang: "en", translatedText: "Hola", confidence: 0.95 });
    expect(result.completed).toBeGreaterThanOrEqual(0);
  });

  it("fails job", async () => {
    const db = mockDB();
    env.DB = { prepare: vi.fn().mockReturnValue(db) };
    const { failJob } = await import("../lib/voice-translation.js");
    const result = await failJob(env, { jobId: "vtj_1", error: "timeout" });
    expect(result.failed).toBeGreaterThanOrEqual(0);
  });

  it("lists jobs with filter", async () => {
    const db = mockDB([{ status: "completed" }]);
    env.DB = { prepare: vi.fn().mockReturnValue(db) };
    const { listJobs } = await import("../lib/voice-translation.js");
    const result = await listJobs(env, { projectId: "p1", status: "completed" });
    expect(Array.isArray(result)).toBe(true);
  });

  it("submits feedback", async () => {
    const db = mockDB();
    env.DB = { prepare: vi.fn().mockReturnValue(db) };
    const { submitFeedback } = await import("../lib/voice-translation.js");
    const result = await submitFeedback(env, { projectId: "p1", jobId: "vtj_1", userId: "u1", rating: 5 });
    expect(result.id).toMatch(/^vtf_/);
  });

  it("gets translation quality", async () => {
    const db = mockDB([{ avg_rating: 4.2, total_feedback: 100, positive: 80, negative: 10 }]);
    env.DB = { prepare: vi.fn().mockReturnValue(db) };
    const { getTranslationQuality } = await import("../lib/voice-translation.js");
    const result = await getTranslationQuality(env, { projectId: "p1" });
    expect(result.avgRating).toBe(4.2);
    expect(result.totalFeedback).toBe(100);
  });

  it("gets cached translation", async () => {
    const db = mockDB([{ translated_text: "Hola", hit_count: 5 }]);
    env.DB = { prepare: vi.fn().mockReturnValue(db) };
    const { getCachedTranslation } = await import("../lib/voice-translation.js");
    const result = await getCachedTranslation(env, { projectId: "p1", sourceLang: "en", targetLang: "es", sourceHash: "abc" });
    expect(result.translatedText).toBe("Hola");
    expect(result.hitCount).toBe(6);
  });

  it("sets cached translation", async () => {
    const db = mockDB();
    env.DB = { prepare: vi.fn().mockReturnValue(db) };
    const { setCachedTranslation } = await import("../lib/voice-translation.js");
    const result = await setCachedTranslation(env, { projectId: "p1", sourceLang: "en", targetLang: "es", sourceHash: "abc", translatedText: "Hola" });
    expect(result.id).toMatch(/^vtc_/);
  });

  it("gets stats", async () => {
    const db = mockDB([{ count: 50 }]);
    env.DB = { prepare: vi.fn().mockReturnValue(db) };
    const { getStats } = await import("../lib/voice-translation.js");
    const result = await getStats(env, { projectId: "p1" });
    expect(result).toHaveProperty("total");
    expect(result).toHaveProperty("byLanguage");
    expect(result).toHaveProperty("avgConfidence");
    expect(result).toHaveProperty("avgDurationMs");
  });
});
