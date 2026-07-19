import { describe, it, expect } from "vitest";
import { uploadSkill, type SkillProvider, type ProviderReference } from "./skill-uploads";

describe("uploadSkill", () => {
  it("uploads files and returns ProviderReference", async () => {
    const mockProvider: SkillProvider = {
      async upload(files) {
        return {
          providerReference: { mock: "sk_abc123" },
          displayTitle: "Test Skill",
        };
      },
    };
    const result = await uploadSkill({
      api: mockProvider,
      files: [{ path: "myskill/SKILL.md", content: "# Test" }],
      displayTitle: "Test Skill",
    });
    expect(result.providerReference).toEqual({ mock: "sk_abc123" });
    expect(result.displayTitle).toBe("Test Skill");
  });

  it("throws if no files provided", async () => {
    const mockProvider: SkillProvider = { async upload() { return { providerReference: {} }; } };
    await expect(uploadSkill({ api: mockProvider, files: [] })).rejects.toThrow("At least one skill file is required");
  });

  it("throws if no api provided", async () => {
    await expect(uploadSkill({ api: undefined as any, files: [{ path: "x", content: "y" }] })).rejects.toThrow("Skill provider API is required");
  });

  it("returns provider metadata when available", async () => {
    const mockProvider: SkillProvider = {
      async upload(files, options) {
        return {
          providerReference: { test: "sk_xyz" },
          displayTitle: options?.displayTitle,
          name: "my-skill",
          description: "A test skill",
          latestVersion: "v1",
          providerMetadata: { uploadedAt: "2026-01-01" },
        };
      },
    };
    const result = await uploadSkill({
      api: mockProvider,
      files: [{ path: "skill.md", content: "content" }],
    });
    expect(result.name).toBe("my-skill");
    expect(result.latestVersion).toBe("v1");
    expect(result.providerMetadata).toEqual({ uploadedAt: "2026-01-01" });
  });

  it("merges ProviderReference from multiple providers", () => {
    const ref1: ProviderReference = { openai: "sk_openai_1" };
    const ref2: ProviderReference = { anthropic: "sk_anthropic_1" };
    const merged = { ...ref1, ...ref2 };
    expect(merged).toEqual({ openai: "sk_openai_1", anthropic: "sk_anthropic_1" });
  });
});
