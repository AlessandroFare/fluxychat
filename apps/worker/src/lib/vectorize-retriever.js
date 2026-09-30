/**
 * Optional Cloudflare Vectorize + Workers AI embeddings for room memory.
 * Unbound VECTORIZE or AI → no-op. D1 remains the source of truth.
 */

export function vectorizeMemoryId(projectId, roomId, entryId) {
  return `rm:${projectId}:${roomId}:${entryId}`.slice(0, 64);
}

export function parseVectorizeMemoryId(id) {
  const raw = String(id || "");
  const parts = raw.split(":");
  if (parts[0] !== "rm" || parts.length < 4) return null;
  return { projectId: parts[1], roomId: parts[2], entryId: parts.slice(3).join(":") };
}

export async function embedTextForVectorize(env, text) {
  if (!env?.AI?.run) return null;
  const model = String(env.VECTORIZE_EMBED_MODEL || "@cf/baai/bge-small-en-v1.5");
  const clipped = String(text || "").slice(0, 8000);
  if (!clipped.trim()) return null;
  const out = await env.AI.run(model, { text: [clipped] }).catch(() => null);
  if (!out) return null;
  if (Array.isArray(out.data?.[0]) && typeof out.data[0][0] === "number") return out.data[0];
  if (Array.isArray(out.data) && typeof out.data[0] === "number") return out.data;
  return null;
}

export async function upsertRoomMemoryVector(env, { projectId, roomId, entryId, content }) {
  if (!env?.VECTORIZE?.upsert) return { ok: false, reason: "unbound" };
  const values = await embedTextForVectorize(env, content);
  if (!values) return { ok: false, reason: "no_embedding" };
  await env.VECTORIZE.upsert([
    {
      id: vectorizeMemoryId(projectId, roomId, entryId),
      values,
      metadata: { projectId, roomId, entryId },
    },
  ]);
  return { ok: true };
}

export async function queryVectorizeRoomMemory(env, { projectId, roomId, query, topK = 8 }) {
  if (!env?.VECTORIZE?.query) return [];
  const values = await embedTextForVectorize(env, query);
  if (!values) return [];
  const prefix = `rm:${projectId}:${roomId}:`;
  const res = await env.VECTORIZE.query(values, { topK: Math.min(Math.max(Number(topK) || 8, 1), 20) });
  const matches = Array.isArray(res?.matches) ? res.matches : [];
  return matches
    .filter((m) => String(m.id || "").startsWith(prefix))
    .map((m) => ({
      entryId: parseVectorizeMemoryId(m.id)?.entryId || "",
      score: Number(m.score) || 0,
    }))
    .filter((m) => m.entryId);
}

/**
 * Vector retriever for RAG middleware. Empty results when bindings are missing.
 */
export function createVectorizeRetriever(env) {
  return {
    async search(query, options = {}) {
      const limit = options.limit || 5;
      const threshold = options.threshold ?? 0;
      const hits = await queryVectorizeRoomMemory(env, {
        projectId: options.projectId || "_",
        roomId: options.roomId || "_",
        query,
        topK: limit,
      });
      return hits
        .filter((h) => h.score >= threshold)
        .map((h) => ({
          id: h.entryId,
          content: "",
          score: h.score,
          source: "vectorize",
        }));
    },
    async index(document) {
      if (!document?.id || !document?.content) return;
      await upsertRoomMemoryVector(env, {
        projectId: document.projectId || "_",
        roomId: document.roomId || "_",
        entryId: document.id,
        content: document.content,
      });
    },
    async delete() {
      return true;
    },
  };
}
