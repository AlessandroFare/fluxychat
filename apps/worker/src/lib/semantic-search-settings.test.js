import { describe, expect, it } from "vitest";
import {
  getSemanticSearchSettings,
  isSemanticSearchActive,
  isSemanticSearchGloballyEnabled,
  shouldAutoEmbedMessage,
  upsertSemanticSearchSettings,
} from "./semantic-search-settings.js";

function createEnv(overrides = {}) {
  const rows = new Map();
  let embeddingCount = 0;

  return {
    SEMANTIC_SEARCH_ENABLED: "true",
    ...overrides,
    DB: {
      prepare(sql) {
        return {
          bind(...args) {
            return {
              async first() {
                if (sql.includes("FROM project_semantic_search")) {
                  const projectId = args[0];
                  return rows.get(projectId) ?? null;
                }
                if (sql.includes("FROM message_embeddings")) {
                  return { cnt: embeddingCount };
                }
                return null;
              },
              async run() {
                if (sql.includes("INSERT INTO project_semantic_search")) {
                  const [projectId, enabled, autoEmbed, defaultMode, updatedAt] = args;
                  rows.set(projectId, {
                    enabled,
                    auto_embed: autoEmbed,
                    default_mode: defaultMode,
                    updated_at: updatedAt,
                  });
                }
                return { success: true };
              },
            };
          },
        };
      },
    },
    _setEmbeddingCount(n) {
      embeddingCount = n;
    },
  };
}

describe("semantic-search-settings", () => {
  it("detects global flag", () => {
    expect(isSemanticSearchGloballyEnabled({ SEMANTIC_SEARCH_ENABLED: "true" })).toBe(true);
    expect(isSemanticSearchGloballyEnabled({ SEMANTIC_SEARCH_ENABLED: "1" })).toBe(true);
    expect(isSemanticSearchGloballyEnabled({})).toBe(false);
  });

  it("defaults project settings when row missing", async () => {
    const env = createEnv();
    env._setEmbeddingCount(42);
    const settings = await getSemanticSearchSettings(env, "proj_1");
    expect(settings.enabled).toBe(true);
    expect(settings.autoEmbed).toBe(true);
    expect(settings.defaultMode).toBe("hybrid");
    expect(settings.embeddingCount).toBe(42);
    expect(settings.available).toBe(true);
  });

  it("respects project disabled", async () => {
    const env = createEnv();
    await upsertSemanticSearchSettings(env, "proj_1", { enabled: false });
    const settings = await getSemanticSearchSettings(env, "proj_1");
    expect(settings.available).toBe(false);
    expect(isSemanticSearchActive(settings)).toBe(false);
  });

  it("shouldAutoEmbedMessage honors auto_embed", async () => {
    const env = createEnv();
    await upsertSemanticSearchSettings(env, "proj_1", { autoEmbed: false });
    expect(await shouldAutoEmbedMessage(env, "proj_1")).toBe(false);
  });

  it("rejects invalid default mode", async () => {
    const env = createEnv();
    const result = await upsertSemanticSearchSettings(env, "proj_1", { defaultMode: "invalid" });
    expect(result.ok).toBe(false);
  });
});
