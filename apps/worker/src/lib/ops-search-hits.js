/**
 * One retrieval record for Processes and room RAG.
 * Accepts legacy AutoRAG `{ data }` and current AI Search `{ chunks }`.
 */
export function toCitation(chunk) {
  if (!chunk) return null;
  const sourceId = String(chunk.id || chunk.sourceId || chunk.item_id || "").trim();
  const title = String(chunk.source || chunk.title || chunk.filename || chunk.key || sourceId || "source").trim();
  if (!sourceId && !title) return null;
  return {
    sourceId: sourceId || title,
    title,
    score: Number(chunk.score) || 0,
  };
}

export function normalizeSearchChunk(raw, index = 0) {
  if (raw == null) return null;
  if (typeof raw === "string") {
    return {
      id: `hit_${index}`,
      content: raw,
      score: 0,
      source: "search",
      metadata: {},
    };
  }
  const content = String(raw.content ?? raw.text ?? raw.chunk ?? raw.body ?? "").slice(0, 8000);
  const id = String(raw.id ?? raw.item_id ?? raw.fileId ?? raw.key ?? `hit_${index}`);
  const source = String(raw.source ?? raw.filename ?? raw.title ?? raw.key ?? id);
  const score = Number(raw.score ?? raw.similarity ?? 0) || 0;
  return {
    id,
    content,
    score,
    source,
    metadata: raw.metadata && typeof raw.metadata === "object" ? raw.metadata : {},
  };
}

export function normalizeSearchHits(payload, { backend = "unknown" } = {}) {
  const list = Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.chunks)
      ? payload.chunks
      : Array.isArray(payload?.data)
        ? payload.data
        : Array.isArray(payload?.results)
          ? payload.results
          : [];
  const chunks = list.map((row, index) => normalizeSearchChunk(row, index)).filter(Boolean);
  const citations = chunks.map(toCitation).filter(Boolean);
  return { backend, chunks, citations, results: chunks };
}

export function citationsFromDocuments(documents) {
  return (documents || []).map((doc) =>
    toCitation({
      id: doc.id,
      source: doc.source,
      score: doc.score,
      title: doc.source || doc.id,
    }),
  ).filter(Boolean);
}
