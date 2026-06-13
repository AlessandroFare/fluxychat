import { describe, expect, it, vi } from "vitest";
import {
  cosineSimilarity,
  contentHash,
  generateEmbeddings,
  storeMessageEmbedding,
  searchSemanticMessages,
  backfillEmbeddings,
} from "./message-embeddings.js";

function createMockEnv(overrides = {}) {
  const embeddings = [];
  const messages = [];
  let nextEmbId = 1;

  const db = {
    prepare(sql) {
      return {
        bind(...args) {
          return {
            async first() {
              if (sql.includes("SELECT id, content_hash FROM message_embeddings")) {
                const [, , messageId] = args;
                return embeddings.find((e) => e.message_id === messageId) || null;
              }
              if (sql.includes("SELECT COUNT(*) AS cnt FROM messages")) {
                return { cnt: messages.length };
              }
              return null;
            },
            async all() {
              if (sql.includes("FROM message_embeddings me")) {
                const projectId = args[0];
                const roomId = args[1];
                let filtered = embeddings.filter(
                  (e) => e.project_id === projectId && e.room_id === roomId,
                );
                const results = filtered.map((e) => ({
                  message_id: e.message_id,
                  embedding: e.embedding,
                  content: `mock content for ${e.message_id}`,
                  user_id: "user_1",
                  room_id: e.room_id,
                  created_at: "2026-06-11T10:00:00.000Z",
                }));
                return { results };
              }
              if (sql.includes("FROM messages m") && sql.includes("LEFT JOIN message_embeddings")) {
                const projectId = args[0];
                let unembedded = messages.filter(
                  (m) => m.project_id === projectId && !embeddings.some((e) => e.message_id === m.id),
                );
                return {
                  results: unembedded.slice(0, args[1] || 500).map((m) => ({
                    id: m.id,
                    room_id: m.room_id,
                    content: m.content,
                    project_id: m.project_id,
                  })),
                };
              }
              return { results: [] };
            },
            async run() {
              if (sql.includes("INSERT OR REPLACE INTO message_embeddings") || sql.includes("INSERT INTO message_embeddings")) {
                const emb = {
                  id: nextEmbId++,
                  project_id: args[0],
                  room_id: args[1],
                  message_id: args[2],
                  content_hash: args[3],
                  embedding: args[4],
                  model: args[5],
                  dimensions: args[6],
                  created_at: args[7],
                };
                const idx = embeddings.findIndex(
                  (e) => e.project_id === emb.project_id && e.message_id === emb.message_id,
                );
                if (idx >= 0) {
                  embeddings[idx] = emb;
                } else {
                  embeddings.push(emb);
                }
              }
              if (sql.includes("UPDATE message_embeddings")) {
                const contentHash = args[0];
                const embedding = args[1];
                const model = args[2];
                const dimensions = args[3];
                const entryId = args[6];
                const entry = embeddings.find((e) => e.id === entryId);
                if (entry) {
                  entry.content_hash = contentHash;
                  entry.embedding = embedding;
                  entry.model = model;
                  entry.dimensions = dimensions;
                }
              }
              return { success: true, meta: { last_row_id: nextEmbId - 1 } };
            },
          };
        },
      };
    },
  };

  return {
    DB: db,
    SEMANTIC_SEARCH_ENABLED: "true",
    AI_BASE_URL: "https://api.openai.com",
    AI_API_KEY: "test-key",
    ...overrides,
  };
}

function mockFetch(response) {
  return vi.fn().mockResolvedValue({
    ok: true,
    json: async () => response,
  });
}

function mockFetchError(status = 500) {
  return vi.fn().mockResolvedValue({
    ok: false,
    status,
    text: async () => "error",
  });
}

describe("cosineSimilarity", () => {
  it("returns 1 for identical vectors", () => {
    expect(cosineSimilarity([1, 0, 0], [1, 0, 0])).toBe(1);
  });

  it("returns 0 for orthogonal vectors", () => {
    expect(cosineSimilarity([1, 0], [0, 1])).toBe(0);
  });

  it("returns -1 for opposite vectors", () => {
    expect(cosineSimilarity([1, 0], [-1, 0])).toBe(-1);
  });

  it("returns 0 for empty arrays", () => {
    expect(cosineSimilarity([], [])).toBe(0);
  });

  it("returns 0 for mismatched lengths", () => {
    expect(cosineSimilarity([1, 0], [1, 0, 0])).toBe(0);
  });

  it("returns 0 for null inputs", () => {
    expect(cosineSimilarity(null, [1])).toBe(0);
    expect(cosineSimilarity([1], null)).toBe(0);
  });

  it("computes correct similarity for similar vectors", () => {
    const sim = cosineSimilarity([1, 2, 3], [1, 2, 3.1]);
    expect(sim).toBeGreaterThan(0.99);
  });
});

describe("contentHash", () => {
  it("produces consistent hashes", () => {
    const h1 = contentHash("hello world");
    const h2 = contentHash("hello world");
    expect(h1).toBe(h2);
  });

  it("produces different hashes for different input", () => {
    const h1 = contentHash("hello");
    const h2 = contentHash("world");
    expect(h1).not.toBe(h2);
  });

  it("returns 8-char hex string", () => {
    const h = contentHash("test");
    expect(h).toMatch(/^[0-9a-f]{8}$/);
  });
});

describe("generateEmbeddings", () => {
  it("returns embeddings on success", async () => {
    const env = createMockEnv({
      AI_BASE_URL: "https://api.openai.com",
      AI_API_KEY: "test-key",
    });
    globalThis.fetch = mockFetch({
      data: [{ embedding: [0.1, 0.2, 0.3], index: 0 }],
    });

    const result = await generateEmbeddings(env, { input: "hello world" });
    expect(result.ok).toBe(true);
    expect(result.embeddings).toHaveLength(1);
    expect(result.embeddings[0]).toEqual([0.1, 0.2, 0.3]);

    delete globalThis.fetch;
  });

  it("returns error when AI not configured", async () => {
    const env = createMockEnv({ AI_BASE_URL: undefined });
    const result = await generateEmbeddings(env, { input: "hello" });
    expect(result.ok).toBe(false);
    expect(result.error).toBe("ai_not_configured");
  });

  it("returns error on API failure", async () => {
    const env = createMockEnv();
    globalThis.fetch = mockFetchError(429);

    const result = await generateEmbeddings(env, { input: "hello" });
    expect(result.ok).toBe(false);
    expect(result.error).toBe("ai_provider_failed");

    delete globalThis.fetch;
  });

  it("handles batch inputs", async () => {
    const env = createMockEnv();
    globalThis.fetch = mockFetch({
      data: [
        { embedding: [0.1, 0.2], index: 0 },
        { embedding: [0.3, 0.4], index: 1 },
      ],
    });

    const result = await generateEmbeddings(env, {
      input: ["hello", "world"],
    });
    expect(result.ok).toBe(true);
    expect(result.embeddings).toHaveLength(2);

    delete globalThis.fetch;
  });

  it("returns empty embeddings for empty input", async () => {
    const env = createMockEnv();
    const result = await generateEmbeddings(env, { input: "" });
    expect(result.ok).toBe(true);
    expect(result.embeddings).toHaveLength(0);
  });
});

describe("storeMessageEmbedding", () => {
  it("stores embedding for new message", async () => {
    const env = createMockEnv();
    globalThis.fetch = mockFetch({
      data: [{ embedding: [0.1, 0.2, 0.3], index: 0 }],
    });

    const result = await storeMessageEmbedding(env, {
      projectId: "proj_1",
      roomId: "room_1",
      messageId: 1,
      content: "hello world",
    });
    expect(result.ok).toBe(true);
    expect(result.stored).toBe(true);

    delete globalThis.fetch;
  });

  it("skips when content hash unchanged", async () => {
    const env = createMockEnv();
    const hash = contentHash("hello world");

    // Pre-populate existing embedding with same hash
    await env.DB.prepare("INSERT INTO message_embeddings (project_id, room_id, message_id, content_hash, embedding, model, dimensions, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
      .bind("proj_1", "room_1", 1, hash, "[0.1,0.2]", "model", 2, "2026-01-01T00:00:00Z")
      .run();

    const result = await storeMessageEmbedding(env, {
      projectId: "proj_1",
      roomId: "room_1",
      messageId: 1,
      content: "hello world",
    });
    expect(result.ok).toBe(true);
    expect(result.stored).toBe(false);
  });

  it("returns error when embedding API fails", async () => {
    const env = createMockEnv();
    globalThis.fetch = mockFetchError(500);

    const result = await storeMessageEmbedding(env, {
      projectId: "proj_1",
      roomId: "room_1",
      messageId: 1,
      content: "hello world",
    });
    expect(result.ok).toBe(false);

    delete globalThis.fetch;
  });
});

describe("searchSemanticMessages", () => {
  it("returns ranked results by similarity", async () => {
    const env = createMockEnv();
    globalThis.fetch = mockFetch({
      data: [{ embedding: [1, 0, 0], index: 0 }],
    });

    const result = await searchSemanticMessages(env, {
      query: "test query",
      projectId: "proj_1",
      roomId: "room_1",
      mode: "semantic",
    });
    expect(result.ok).toBe(true);
    expect(result.mode).toBe("semantic");

    delete globalThis.fetch;
  });

  it("returns error when AI not configured", async () => {
    const env = createMockEnv({ AI_BASE_URL: undefined });
    const result = await searchSemanticMessages(env, {
      query: "test",
      projectId: "proj_1",
    });
    expect(result.ok).toBe(false);
    expect(result.error).toBe("ai_not_configured");
  });

  it("returns error for empty query", async () => {
    const env = createMockEnv();
    const result = await searchSemanticMessages(env, {
      query: "",
      projectId: "proj_1",
    });
    expect(result.ok).toBe(false);
    expect(result.error).toBe("query_required");
  });
});

describe("backfillEmbeddings", () => {
  it("reports zero when no unembedded messages", async () => {
    const env = createMockEnv();
    const result = await backfillEmbeddings(env, {
      projectId: "proj_1",
    });
    expect(result.ok).toBe(true);
    expect(result.processed).toBe(0);
  });
});
