/**
 * P15-F: AI Semantic Search via Embeddings
 *
 * Generates vector embeddings for chat messages using the OpenAI-compatible
 * /embeddings endpoint and stores them in D1. Search uses cosine similarity
 * with hybrid FTS5 reranking for optimal relevance.
 *
 * Architecture:
 * - Embeddings stored as JSON arrays in D1 TEXT column (portable, no new binding)
 * - Cosine similarity computed in JS over fetched vectors (room-scoped, performant)
 * - Hybrid mode: FTS5 candidate set + semantic reranking
 * - Async generation: non-blocking, runs in post-message automations
 */

import { logError } from "./worker-log.js";
import { isAiConfigured, resolveAiTransport, buildAiAuthHeaders } from "./ai-gateway.js";

const DEFAULT_EMBEDDING_MODEL = "openai/text-embedding-3-small";
const DEFAULT_DIMENSIONS = 1536;

/**
 * Generate embeddings for one or more text inputs via the OpenAI-compatible API.
 *
 * @param {object} env
 * @param {{
 *   input: string | string[],
 *   model?: string,
 *   dimensions?: number,
 *   logContext?: Record<string, unknown>,
 * }} opts
 * @returns {Promise<{ ok: true, embeddings: number[][], model: string, dimensions: number } | { ok: false, error: string }>}
 */
export async function generateEmbeddings(env, opts) {
  const transport = resolveAiTransport(env);
  if (!transport.configured || !transport.embeddingsUrl) {
    return { ok: false, error: "ai_not_configured" };
  }

  const model = opts.model || env.AI_EMBEDDING_MODEL || DEFAULT_EMBEDDING_MODEL;
  const inputs = Array.isArray(opts.input) ? opts.input : [opts.input];
  const dimensions = opts.dimensions || DEFAULT_DIMENSIONS;

  if (!inputs.length || inputs.every((s) => !String(s).trim())) {
    return { ok: true, embeddings: [], model, dimensions };
  }

  const body = { model, input: inputs };
  if (opts.dimensions) {
    body.dimensions = opts.dimensions;
  }

  const res = await fetch(transport.embeddingsUrl, {
    method: "POST",
    headers: buildAiAuthHeaders(env, {
      contentType: "application/json",
      metadata: {
        ...(opts.logContext || {}),
        feature: opts.logContext?.feature || "embeddings",
      },
    }),
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    logError("ai.embeddings_failed", new Error(`AI status ${res.status}`), {
      ...(opts.logContext || {}),
      aiStatus: res.status,
      aiBody: text.slice(0, 200),
      aiMode: transport.mode,
      model,
    });
    return { ok: false, error: "ai_provider_failed" };
  }

  const json = await res.json();
  const data = json.data || [];
  const embeddings = data
    .sort((a, b) => (a.index ?? 0) - (b.index ?? 0))
    .map((d) => d.embedding);

  const actualDimensions = embeddings[0]?.length || dimensions;

  return { ok: true, embeddings, model, dimensions: actualDimensions };
}

/**
 * Compute cosine similarity between two vectors.
 * @param {number[]} a
 * @param {number[]} b
 * @returns {number} similarity in [-1, 1]
 */
export function cosineSimilarity(a, b) {
  if (!a?.length || !b?.length || a.length !== b.length) return 0;
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

/**
 * Simple content hash for dedup (djb2).
 * @param {string} text
 * @returns {string} hex hash
 */
export function contentHash(text) {
  let hash = 5381;
  for (let i = 0; i < text.length; i++) {
    hash = ((hash << 5) + hash + text.charCodeAt(i)) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}

/**
 * Store an embedding for a single message. Skips if content hash matches (no change).
 *
 * @param {object} env
 * @param {{ projectId: string, roomId: string, messageId: number, content: string }} input
 * @returns {Promise<{ ok: true, stored: boolean } | { ok: false, error: string }>}
 */
export async function storeMessageEmbedding(env, input) {
  const { projectId, roomId, messageId, content } = input;
  const hash = contentHash(content);

  const existing = await env.DB.prepare(
    "SELECT id, content_hash FROM message_embeddings WHERE project_id = ? AND room_id = ? AND message_id = ?"
  )
    .bind(projectId, roomId, messageId)
    .first();

  if (existing && existing.content_hash === hash) {
    return { ok: true, stored: false };
  }

  const emb = await generateEmbeddings(env, {
    input: content,
    logContext: { projectId, roomId, feature: "embed_store", messageId },
  });

  if (!emb.ok) {
    return { ok: false, error: emb.error };
  }

  const embedding = emb.embeddings[0];
  if (!embedding?.length) {
    return { ok: false, error: "empty_embedding" };
  }

  const now = new Date().toISOString();
  const embeddingJson = JSON.stringify(embedding);

  if (existing) {
    await env.DB.prepare(
      `UPDATE message_embeddings
       SET content_hash = ?, embedding = ?, model = ?, dimensions = ?, created_at = ?
       WHERE id = ?`
    )
      .bind(hash, embeddingJson, emb.model, emb.dimensions, now, existing.id)
      .run();
  } else {
    await env.DB.prepare(
      `INSERT INTO message_embeddings (project_id, room_id, message_id, content_hash, embedding, model, dimensions, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(projectId, roomId, messageId, hash, embeddingJson, emb.model, emb.dimensions, now)
      .run();
  }

  return { ok: true, stored: true };
}

/**
 * Search messages semantically using cosine similarity.
 *
 * Modes:
 * - "semantic": pure vector similarity search
 * - "hybrid": FTS5 candidate set + semantic reranking (default)
 *
 * @param {object} env
 * @param {{
 *   query: string,
 *   projectId: string,
 *   userId?: string,
 *   roles?: string[],
 *   roomId?: string,
 *   from?: string,
 *   to?: string,
 *   limit?: number,
 *   mode?: "semantic" | "hybrid",
 * }} input
 * @returns {Promise<{ ok: true, results: Array, query: string, mode: string } | { ok: false, error: string }>}
 */
export async function searchSemanticMessages(env, input) {
  const { projectId, roomId } = input;
  const mode = input.mode || "hybrid";
  const limit = Math.min(Math.max(Number(input.limit) || 20, 1), 50);

  if (!input.query?.trim()) {
    return { ok: false, error: "query_required" };
  }

  const emb = await generateEmbeddings(env, {
    input: input.query,
    logContext: { projectId, feature: "semantic_search" },
  });

  if (!emb.ok) {
    return { ok: false, error: emb.error };
  }

  const queryVector = emb.embeddings[0];
  if (!queryVector?.length) {
    return { ok: false, error: "empty_query_embedding" };
  }

  let candidateSql = "";
  const params = [];

  if (mode === "hybrid" || roomId) {
    const { sanitizeFtsQuery } = await import("./message-search.js");
    const ftsQuery = sanitizeFtsQuery(input.query);

    if (roomId) {
      candidateSql = `
        SELECT me.message_id, me.embedding, m.content, m.user_id, m.room_id, m.created_at
        FROM message_embeddings me
        JOIN messages m ON m.id = me.message_id AND m.room_id = me.room_id
        WHERE me.project_id = ? AND me.room_id = ?
          AND m.deleted_at IS NULL
      `;
      params.push(projectId, roomId);
    } else {
      candidateSql = `
        SELECT me.message_id, me.embedding, m.content, m.user_id, m.room_id, m.created_at
        FROM message_embeddings me
        JOIN messages m ON m.id = me.message_id AND m.room_id = me.room_id
        WHERE me.project_id = ?
          AND m.deleted_at IS NULL
      `;
      params.push(projectId);
    }

    if (ftsQuery) {
      candidateSql += `
        AND m.content LIKE ?
      `;
      params.push(`%${ftsQuery}%`);
    }
  } else {
    candidateSql = `
      SELECT me.message_id, me.embedding, m.content, m.user_id, m.room_id, m.created_at
      FROM message_embeddings me
      JOIN messages m ON m.id = me.message_id AND m.room_id = me.room_id
      WHERE me.project_id = ?
        AND m.deleted_at IS NULL
    `;
    params.push(projectId);
  }

  if (input.from) {
    candidateSql += " AND m.created_at >= ?";
    params.push(input.from);
  }
  if (input.to) {
    candidateSql += " AND m.created_at < ?";
    params.push(input.to);
  }

  candidateSql += " ORDER BY m.created_at DESC LIMIT ?";
  params.push(Math.min(limit * 3, 150));

  const rows = await env.DB.prepare(candidateSql).bind(...params).all();
  const candidates = rows.results || [];

  const scored = candidates
    .map((row) => {
      let vector;
      try {
        vector = typeof row.embedding === "string" ? JSON.parse(row.embedding) : row.embedding;
      } catch {
        return null;
      }
      const score = cosineSimilarity(queryVector, vector);
      return {
        id: row.message_id,
        roomId: row.room_id,
        userId: row.user_id,
        content: row.content,
        createdAt: row.created_at,
        score,
      };
    })
    .filter(Boolean)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  return {
    ok: true,
    results: scored,
    query: input.query,
    mode,
  };
}

/**
 * Backfill embeddings for existing messages in bulk.
 * Processes in batches of 10 with delays to avoid rate limits.
 *
 * @param {object} env
 * @param {{ projectId: string, roomId?: string, limit?: number, onProgress?: Function }} input
 * @returns {Promise<{ ok: true, processed: number, stored: number, skipped: number } | { ok: false, error: string }>}
 */
export async function backfillEmbeddings(env, input) {
  const { projectId, roomId } = input;
  const maxLimit = Math.min(Math.max(Number(input.limit) || 500, 1), 5000);

  let sql = `
    SELECT m.id, m.room_id, m.content
    FROM messages m
    LEFT JOIN message_embeddings me ON me.message_id = m.id AND me.room_id = m.room_id AND me.project_id = m.project_id
    WHERE m.project_id = ? AND m.deleted_at IS NULL AND me.id IS NULL
  `;
  const params = [projectId];

  if (roomId) {
    sql += " AND m.room_id = ?";
    params.push(roomId);
  }

  sql += " ORDER BY m.created_at DESC LIMIT ?";
  params.push(maxLimit);

  const rows = await env.DB.prepare(sql).bind(...params).all();
  const messages = rows.results || [];

  if (!messages.length) {
    return { ok: true, processed: 0, stored: 0, skipped: 0 };
  }

  const BATCH_SIZE = 10;
  let processed = 0;
  let stored = 0;
  let skipped = 0;

  for (let i = 0; i < messages.length; i += BATCH_SIZE) {
    const batch = messages.slice(i, i + BATCH_SIZE);
    const texts = batch.map((m) => String(m.content || "").slice(0, 8000));

    const emb = await generateEmbeddings(env, {
      input: texts,
      logContext: { projectId, feature: "backfill_embeddings" },
    });

    if (!emb.ok) {
      logError("backfill_embeddings.batch_failed", new Error(emb.error), {
        projectId,
        batchStart: i,
      });
      skipped += batch.length;
      continue;
    }

    const now = new Date().toISOString();
    for (let j = 0; j < batch.length; j++) {
      const msg = batch[j];
      const hash = contentHash(msg.content);
      const embeddingJson = JSON.stringify(emb.embeddings[j]);

      await env.DB.prepare(
        `INSERT OR REPLACE INTO message_embeddings
         (project_id, room_id, message_id, content_hash, embedding, model, dimensions, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
        .bind(
          msg.project_id || projectId,
          msg.room_id,
          msg.id,
          hash,
          embeddingJson,
          emb.model,
          emb.dimensions,
          now,
        )
        .run();
      stored++;
    }

    processed += batch.length;
    input.onProgress?.({ processed, stored, skipped, total: messages.length });

    if (i + BATCH_SIZE < messages.length) {
      await new Promise((r) => setTimeout(r, 200));
    }
  }

  return { ok: true, processed, stored, skipped };
}
