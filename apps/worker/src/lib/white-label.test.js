import { describe, it, expect, vi } from "vitest";
import { getWhiteLabelConfig, upsertWhiteLabelConfig, generateEmbedSnippet, createReseller, listResellers, getReseller, updateReseller, deleteReseller, getResellerStats } from "../lib/white-label.js";

function makeEnv(overrides = {}) {
  const dbState = { configs: {}, resellers: {} };
  const mockBind = (args) => ({
    run: vi.fn().mockResolvedValue({}),
    first: vi.fn().mockImplementation(() => {
      return Promise.resolve(null);
    }),
    all: vi.fn().mockResolvedValue({ results: [] }),
  });
  return {
    DB: {
      prepare: vi.fn().mockReturnValue({
        bind: mockBind,
      }),
    },
    _dbState: dbState,
    ...overrides,
  };
}

describe("white-label", () => {
  describe("getWhiteLabelConfig", () => {
    it("returns default config for new project", async () => {
      const env = makeEnv();
      const config = await getWhiteLabelConfig(env, { projectId: "p1" });
      expect(config.project_id).toBe("p1");
      expect(config.primary_color).toBe("#6366f1");
      expect(config.showBranding).toBe(true);
      expect(config.allowed_origins).toEqual([]);
    });
  });

  describe("upsertWhiteLabelConfig", () => {
    it("creates new config", async () => {
      const env = makeEnv();
      // Mock: first call returns null (no existing), second call returns the inserted row
      let callCount = 0;
      env.DB.prepare = vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnValue({
          run: vi.fn().mockResolvedValue({}),
          first: vi.fn().mockImplementation(() => {
            callCount++;
            if (callCount === 1) return Promise.resolve(null); // SELECT check
            return Promise.resolve({
              project_id: "p1",
              brand_name: "Acme Chat",
              primary_color: "#ff0000",
              show_branding: 1,
              show_powered_by: 1,
              allowed_origins: "[]",
            });
          }),
          all: vi.fn().mockResolvedValue({ results: [] }),
        }),
      });
      const config = await upsertWhiteLabelConfig(env, {
        projectId: "p1",
        brandName: "Acme Chat",
        primaryColor: "#ff0000",
      });
      expect(config.brand_name).toBe("Acme Chat");
      expect(config.primary_color).toBe("#ff0000");
    });
  });

  describe("generateEmbedSnippet", () => {
    it("generates embed snippet with default config", async () => {
      const env = makeEnv();
      const snippet = await generateEmbedSnippet(env, { projectId: "p1" });
      expect(snippet).toContain("data-project=\"p1\"");
      expect(snippet).toContain("embed.js");
      expect(snippet).toContain("data-primary-color");
    });

    it("includes custom CSS in snippet", async () => {
      const env = makeEnv();
      const snippet = await generateEmbedSnippet(env, { projectId: "p1" });
      expect(snippet).toContain("FluxyChat White-label Embed");
    });
  });

  describe("createReseller", () => {
    it("returns error when name/email missing", async () => {
      const env = makeEnv();
      const result = await createReseller(env, { projectId: "p1", resellerName: "", resellerEmail: "" });
      expect(result.ok).toBe(false);
      expect(result.error).toContain("required");
    });

    it("creates reseller successfully", async () => {
      const env = makeEnv();
      const result = await createReseller(env, {
        projectId: "p1",
        resellerName: "Acme Corp",
        resellerEmail: "reseller@acme.com",
        commissionPercent: 20,
      });
      expect(result.ok).toBe(true);
      expect(result.id).toBeDefined();
    });
  });

  describe("listResellers", () => {
    it("returns empty array for project with no resellers", async () => {
      const env = makeEnv();
      const items = await listResellers(env, { projectId: "p1" });
      expect(items).toEqual([]);
    });
  });

  describe("getReseller", () => {
    it("returns null for nonexistent id", async () => {
      const env = makeEnv();
      const result = await getReseller(env, { projectId: "p1", id: "nonexistent" });
      expect(result).toBeNull();
    });
  });

  describe("updateReseller", () => {
    it("returns not_found for nonexistent id", async () => {
      const env = makeEnv();
      const result = await updateReseller(env, { projectId: "p1", id: "nonexistent", resellerName: "New Name" });
      expect(result.ok).toBe(false);
      expect(result.error).toBe("not_found");
    });
  });

  describe("deleteReseller", () => {
    it("returns not_found for nonexistent id", async () => {
      const env = makeEnv();
      const result = await deleteReseller(env, { projectId: "p1", id: "nonexistent" });
      expect(result.ok).toBe(false);
      expect(result.error).toBe("not_found");
    });
  });

  describe("getResellerStats", () => {
    it("returns zero stats for empty project", async () => {
      const env = makeEnv();
      const stats = await getResellerStats(env, { projectId: "p1" });
      expect(stats.total).toBe(0);
      expect(stats.active).toBe(0);
      expect(stats.totalCommissionPercent).toBe(0);
    });
  });
});
