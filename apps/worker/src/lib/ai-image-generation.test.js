import { describe, it, expect, vi } from "vitest";
import { generateImage, getImageGeneration, listRoomImageGenerations, getImageGenerationStats, deleteImageGeneration } from "../lib/ai-image-generation.js";

function makeEnv(overrides = {}) {
  return {
    DB: {
      prepare: vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnValue({
          run: vi.fn().mockResolvedValue({}),
          first: vi.fn().mockResolvedValue(null),
          all: vi.fn().mockResolvedValue({ results: [] }),
        }),
      }),
    },
    ATTACHMENTS: null,
    AI_BASE_URL: "https://api.openai.com",
    AI_API_KEY: "test-key",
    AI_IMAGE_GENERATION_ENABLED: "true",
    AI_IMAGE_MODEL: "dall-e-3",
    ...overrides,
  };
}

describe("ai-image-generation", () => {
  describe("generateImage", () => {
    it("returns error when feature disabled", async () => {
      const env = makeEnv({ AI_IMAGE_GENERATION_ENABLED: "false" });
      const result = await generateImage(env, { projectId: "p1", roomId: "r1", userId: "u1", prompt: "a cat" });
      expect(result.ok).toBe(false);
      expect(result.error).toBe("image_generation_disabled");
    });

    it("returns error when prompt too short", async () => {
      const env = makeEnv();
      const result = await generateImage(env, { projectId: "p1", roomId: "r1", userId: "u1", prompt: "ab" });
      expect(result.ok).toBe(false);
      expect(result.error).toBe("prompt_too_short");
    });

    it("returns error when prompt too long", async () => {
      const env = makeEnv();
      const result = await generateImage(env, { projectId: "p1", roomId: "r1", userId: "u1", prompt: "x".repeat(4001) });
      expect(result.ok).toBe(false);
      expect(result.error).toBe("prompt_too_long");
    });

    it("returns error for content policy violation", async () => {
      const env = makeEnv();
      const result = await generateImage(env, { projectId: "p1", roomId: "r1", userId: "u1", prompt: "generate gore image" });
      expect(result.ok).toBe(false);
      expect(result.error).toContain("content_policy_violation");
    });

    it("returns error when AI API fails", async () => {
      const env = makeEnv();
      global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 400, text: () => Promise.resolve("bad request") });
      const result = await generateImage(env, { projectId: "p1", roomId: "r1", userId: "u1", prompt: "a beautiful sunset over mountains" });
      expect(result.ok).toBe(false);
      expect(result.error).toBe("ai_api_error");
      global.fetch = undefined;
    });

    it("generates image successfully", async () => {
      const b64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ data: [{ b64_json: b64, revised_prompt: "a scenic sunset" }] }),
      });
      const env = makeEnv();
      const result = await generateImage(env, { projectId: "p1", roomId: "r1", userId: "u1", prompt: "a sunset" });
      expect(result.ok).toBe(true);
      expect(result.id).toBeDefined();
      expect(result.revisedPrompt).toBe("a scenic sunset");
      expect(result.processingTimeMs).toBeGreaterThanOrEqual(0);
      global.fetch = undefined;
    });

    it("uses default values for size/quality/style", async () => {
      const b64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ data: [{ b64_json: b64 }] }),
      });
      const env = makeEnv();
      const result = await generateImage(env, { projectId: "p1", roomId: "r1", userId: "u1", prompt: "a sunset" });
      expect(result.ok).toBe(true);
      expect(result.size).toBe("1024x1024");
      expect(result.quality).toBe("standard");
      expect(result.style).toBe("vivid");
      global.fetch = undefined;
    });

    it("validates size/quality/style values", async () => {
      const b64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ data: [{ b64_json: b64 }] }),
      });
      const env = makeEnv();
      const result = await generateImage(env, { projectId: "p1", roomId: "r1", userId: "u1", prompt: "a sunset", size: "invalid", quality: "bad", style: "nope" });
      expect(result.ok).toBe(true);
      expect(result.size).toBe("1024x1024");
      expect(result.quality).toBe("standard");
      expect(result.style).toBe("vivid");
      global.fetch = undefined;
    });
  });

  describe("getImageGeneration", () => {
    it("returns null for nonexistent id", async () => {
      const env = makeEnv();
      const result = await getImageGeneration(env, { projectId: "p1", id: "nonexistent" });
      expect(result).toBeNull();
    });
  });

  describe("listRoomImageGenerations", () => {
    it("returns empty array for room with no generations", async () => {
      const env = makeEnv();
      const result = await listRoomImageGenerations(env, { projectId: "p1", roomId: "r1" });
      expect(result).toEqual([]);
    });
  });

  describe("getImageGenerationStats", () => {
    it("returns zero stats for empty project", async () => {
      const env = makeEnv();
      const stats = await getImageGenerationStats(env, { projectId: "p1" });
      expect(stats.total).toBe(0);
      expect(stats.byStatus).toEqual({});
      expect(stats.avgProcessingTimeMs).toBe(0);
    });
  });

  describe("deleteImageGeneration", () => {
    it("returns not_found for nonexistent id", async () => {
      const env = makeEnv();
      const result = await deleteImageGeneration(env, { projectId: "p1", id: "nonexistent" });
      expect(result.ok).toBe(false);
      expect(result.error).toBe("not_found");
    });
  });
});
