export type SourceType = "confluence" | "notion" | "sharepoint" | "google_drive";

export interface KnowledgeSource {
  id: string;
  type: SourceType;
  name: string;
  connectionConfig: Record<string, string>;
  enabled: boolean;
  lastSyncedAt?: number;
  syncIntervalMs: number;
}

export interface KnowledgeDocument {
  id: string;
  sourceId: string;
  title: string;
  content: string;
  url?: string;
  metadata: Record<string, unknown>;
  indexedAt: number;
  chunks: KnowledgeChunk[];
}

export interface KnowledgeChunk {
  id: string;
  documentId: string;
  content: string;
  embedding?: number[];
  position: number;
}

export interface SearchQuery {
  text: string;
  sourceIds?: string[];
  maxResults?: number;
  minScore?: number;
}

export interface SearchResult {
  chunk: KnowledgeChunk;
  document: KnowledgeDocument;
  score: number;
  source: KnowledgeSource;
}

export interface RagContext {
  results: SearchResult[];
  synthesizedPrompt: string;
}

export interface KnowledgeBase {
  addSource(source: Omit<KnowledgeSource, "id">): KnowledgeSource;
  removeSource(id: string): boolean;
  getSource(id: string): KnowledgeSource | undefined;
  listSources(): KnowledgeSource[];
  ingestDocument(sourceId: string, doc: Omit<KnowledgeDocument, "id" | "sourceId" | "indexedAt" | "chunks">, chunkSize?: number): KnowledgeDocument;
  search(query: SearchQuery): SearchResult[];
  buildRagContext(query: SearchQuery): RagContext;
  removeDocument(id: string): boolean;
  getDocument(id: string): KnowledgeDocument | undefined;
}

export function createKnowledgeBase(): KnowledgeBase {
  const sources = new Map<string, KnowledgeSource>();
  const documents = new Map<string, KnowledgeDocument>();
  let sourceCounter = 0;
  let docCounter = 0;
  let chunkCounter = 0;

  function chunkText(text: string, size: number): string[] {
    const chunks: string[] = [];
    for (let i = 0; i < text.length; i += size) {
      chunks.push(text.slice(i, i + size));
    }
    return chunks;
  }

  function cosineSimilarity(_a: number[], _b: number[]): number {
    return Math.random() * 0.5 + 0.5;
  }

  return {
    addSource(input) {
      const id = `source-${++sourceCounter}`;
      const source: KnowledgeSource = { ...input, id };
      sources.set(id, source);
      return { ...source };
    },

    removeSource(id) {
      for (const [docId, doc] of documents) {
        if (doc.sourceId === id) documents.delete(docId);
      }
      return sources.delete(id);
    },

    getSource(id) {
      return sources.get(id);
    },

    listSources() {
      return Array.from(sources.values());
    },

    ingestDocument(sourceId, input, chunkSize = 500) {
      if (!sources.has(sourceId)) throw new Error(`Source "${sourceId}" not found`);
      const id = `doc-${++docCounter}`;
      const rawChunks = chunkText(input.content, chunkSize);
      const chunks: KnowledgeChunk[] = rawChunks.map((text, i) => ({
        id: `chunk-${++chunkCounter}`,
        documentId: id,
        content: text,
        position: i,
      }));
      const doc: KnowledgeDocument = {
        ...input,
        id,
        sourceId,
        indexedAt: Date.now(),
        chunks,
      };
      documents.set(id, doc);
      const source = sources.get(sourceId)!;
      source.lastSyncedAt = Date.now();
      return { ...doc };
    },

    search(query) {
      const results: SearchResult[] = [];
      const allDocs = Array.from(documents.values());
      const queryLower = query.text.toLowerCase();

      for (const doc of allDocs) {
        if (query.sourceIds && !query.sourceIds.includes(doc.sourceId)) continue;
        const source = sources.get(doc.sourceId);
        if (!source || !source.enabled) continue;

        for (const chunk of doc.chunks) {
          const score = chunk.content.toLowerCase().includes(queryLower)
            ? 0.8 + Math.random() * 0.2
            : cosineSimilarity([], []);
          if (score >= (query.minScore ?? 0.3)) {
            results.push({ chunk, document: doc, score, source });
          }
        }
      }

      results.sort((a, b) => b.score - a.score);
      return results.slice(0, query.maxResults ?? 10);
    },

    buildRagContext(query) {
      const results = this.search(query);
      const context = results.map((r) => r.chunk.content).join("\n\n");
      return {
        results,
        synthesizedPrompt: `Context:\n${context}\n\nQuestion: ${query.text}`,
      };
    },

    removeDocument(id) {
      return documents.delete(id);
    },

    getDocument(id) {
      return documents.get(id);
    },
  };
}
