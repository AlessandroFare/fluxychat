import { addUsage, type AIProviderMetadata, type AIUsage } from "./ai-core";
import type { AIEmbeddingModel, AIRerankModel } from "./providers";

export interface AIEmbeddingResult {
  embedding: number[];
  usage: AIUsage;
  providerMetadata?: AIProviderMetadata;
}
export interface AIEmbedManyResult {
  embeddings: number[][];
  usage: AIUsage;
  providerMetadata?: AIProviderMetadata;
}

export async function embed(model: AIEmbeddingModel, value: string, options?: { signal?: AbortSignal }): Promise<AIEmbeddingResult> {
  const result = await model.embed([value], options);
  if (result.embeddings.length !== 1) throw new Error("Embedding provider returned an unexpected result count.");
  return { embedding: result.embeddings[0], usage: result.usage ?? {}, providerMetadata: result.providerMetadata };
}

export async function embedMany(model: AIEmbeddingModel, values: readonly string[], options: { signal?: AbortSignal; batchSize?: number } = {}): Promise<AIEmbedManyResult> {
  const batchSize = Math.max(1, Math.floor(options.batchSize ?? 100));
  const embeddings: number[][] = [];
  let usage: AIUsage = {};
  let metadata: AIProviderMetadata | undefined;
  for (let offset = 0; offset < values.length; offset += batchSize) {
    const result = await model.embed(values.slice(offset, offset + batchSize), { signal: options.signal });
    embeddings.push(...result.embeddings);
    usage = addUsage(usage, result.usage);
    metadata = result.providerMetadata ?? metadata;
  }
  if (embeddings.length !== values.length) throw new Error("Embedding provider returned an unexpected result count.");
  return { embeddings, usage, providerMetadata: metadata };
}

export function cosineSimilarity(left: readonly number[], right: readonly number[]): number {
  if (left.length !== right.length || left.length === 0) throw new Error("Vectors must have the same non-zero dimensions.");
  let dot = 0;
  let leftMagnitude = 0;
  let rightMagnitude = 0;
  for (let index = 0; index < left.length; index += 1) {
    dot += left[index] * right[index];
    leftMagnitude += left[index] ** 2;
    rightMagnitude += right[index] ** 2;
  }
  if (leftMagnitude === 0 || rightMagnitude === 0) return 0;
  return dot / (Math.sqrt(leftMagnitude) * Math.sqrt(rightMagnitude));
}

export interface RetrievalDocument<T = unknown> {
  id: string;
  text: string;
  metadata?: T;
  tenantId?: string;
  sourceUrl?: string;
}
export interface RetrievedDocument<T = unknown> extends RetrievalDocument<T> {
  score: number;
  rank: number;
}

export async function retrieve<T>(options: {
  query: string;
  documents: readonly RetrievalDocument<T>[];
  embeddingModel: AIEmbeddingModel;
  rerankModel?: AIRerankModel;
  tenantId?: string;
  topK?: number;
  signal?: AbortSignal;
}): Promise<RetrievedDocument<T>[]> {
  const scoped = options.tenantId === undefined ? [...options.documents] : options.documents.filter((document) => document.tenantId === options.tenantId);
  if (!scoped.length) return [];
  const values = [options.query, ...scoped.map((document) => document.text)];
  const vectors = await embedMany(options.embeddingModel, values, { signal: options.signal });
  const queryVector = vectors.embeddings[0];
  let ranked = scoped
    .map((document, index) => ({ ...document, score: cosineSimilarity(queryVector, vectors.embeddings[index + 1]), rank: index + 1 }))
    .sort((left, right) => right.score - left.score);
  if (options.rerankModel) {
    const reranked = await options.rerankModel.rerank(options.query, ranked.map((document) => document.text), { topN: options.topK, signal: options.signal });
    ranked = reranked.results.map((result, rank) => ({ ...ranked[result.index], score: result.score, rank: rank + 1 }));
  } else ranked = ranked.map((document, rank) => ({ ...document, rank: rank + 1 }));
  return ranked.slice(0, Math.max(1, Math.floor(options.topK ?? 5)));
}
