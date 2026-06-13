import { describe, it, expect, vi } from "vitest";
import { listTemplates, getTemplate, createTemplate, updateTemplate, deleteTemplate, installTemplate } from "../lib/room-templates.js";

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
    ...overrides,
  };
}

describe("room-templates", () => {
  describe("listTemplates", () => {
    it("returns all 7 system templates", async () => {
      const env = makeEnv();
      const templates = await listTemplates(env, { projectId: "p1" });
      expect(templates.length).toBeGreaterThanOrEqual(7);
      expect(templates.find(t => t.slug === "support")).toBeDefined();
      expect(templates.find(t => t.slug === "events")).toBeDefined();
      expect(templates.find(t => t.slug === "community")).toBeDefined();
      expect(templates.find(t => t.slug === "ops")).toBeDefined();
      expect(templates.find(t => t.slug === "incident")).toBeDefined();
      expect(templates.find(t => t.slug === "onboarding")).toBeDefined();
      expect(templates.find(t => t.slug === "auction")).toBeDefined();
    });

    it("filters by category", async () => {
      const env = makeEnv();
      const templates = await listTemplates(env, { projectId: "p1", category: "support" });
      expect(templates.every(t => t.category === "support")).toBe(true);
    });
  });

  describe("getTemplate", () => {
    it("returns template by slug", async () => {
      const env = makeEnv();
      const template = await getTemplate(env, { projectId: "p1", idOrSlug: "support" });
      expect(template).toBeDefined();
      expect(template.slug).toBe("support");
      expect(template.name).toBe("Customer Support");
    });

    it("returns template by id", async () => {
      const env = makeEnv();
      const template = await getTemplate(env, { projectId: "p1", idOrSlug: "tpl-support" });
      expect(template).toBeDefined();
      expect(template.id).toBe("tpl-support");
    });

    it("returns null for nonexistent template", async () => {
      const env = makeEnv();
      const template = await getTemplate(env, { projectId: "p1", idOrSlug: "nonexistent" });
      expect(template).toBeNull();
    });
  });

  describe("createTemplate", () => {
    it("returns error when name/slug missing", async () => {
      const env = makeEnv();
      const result = await createTemplate(env, { projectId: "p1", name: "", slug: "" });
      expect(result.ok).toBe(false);
      expect(result.error).toContain("required");
    });

    it("creates custom template", async () => {
      const env = makeEnv();
      const result = await createTemplate(env, {
        projectId: "p1",
        name: "Custom Template",
        slug: "custom-tpl",
        description: "A custom template",
        category: "custom",
        config: { features: ["feature1"] },
      });
      expect(result.ok).toBe(true);
      expect(result.id).toBeDefined();
    });
  });

  describe("updateTemplate", () => {
    it("returns not_found for nonexistent id", async () => {
      const env = makeEnv();
      const result = await updateTemplate(env, { projectId: "p1", id: "nonexistent", name: "New Name" });
      expect(result.ok).toBe(false);
      expect(result.error).toBe("not_found");
    });
  });

  describe("deleteTemplate", () => {
    it("returns not_found for nonexistent id", async () => {
      const env = makeEnv();
      const result = await deleteTemplate(env, { projectId: "p1", id: "nonexistent" });
      expect(result.ok).toBe(false);
      expect(result.error).toBe("not_found");
    });
  });

  describe("installTemplate", () => {
    it("returns not_found for nonexistent template", async () => {
      const env = makeEnv();
      const result = await installTemplate(env, { projectId: "p1", templateId: "nonexistent" });
      expect(result.ok).toBe(false);
      expect(result.error).toBe("template_not_found");
    });

    it("installs system template", async () => {
      const env = makeEnv();
      const result = await installTemplate(env, { projectId: "p1", templateId: "support", roomName: "Support Room" });
      expect(result.ok).toBe(true);
      expect(result.template.slug).toBe("support");
      expect(result.roomConfig.name).toBe("Support Room");
      expect(result.roomConfig.agentPreset).toBe("support");
      expect(result.roomConfig.features).toContain("ai_first_response");
    });

    it("installs with default room name", async () => {
      const env = makeEnv();
      const result = await installTemplate(env, { projectId: "p1", templateId: "incident" });
      expect(result.ok).toBe(true);
      expect(result.roomConfig.name).toBe("Incident Response Room");
    });

    it("installs by slug", async () => {
      const env = makeEnv();
      const result = await installTemplate(env, { projectId: "p1", templateId: "events" });
      expect(result.ok).toBe(true);
      expect(result.template.category).toBe("events");
    });
  });
});
