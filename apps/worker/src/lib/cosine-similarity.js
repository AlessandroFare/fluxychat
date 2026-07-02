/**
 * P25-7: Cosine Similarity Utility
 * Adapted from Vercel Chat SDK's cosineSimilarity.
 *
 * Built-in similarity function for embeddings.
 *
 * Usage:
 *   const similarity = cosineSimilarity(embedding1, embedding2);
 *   console.log(similarity); // 0.85 (0-1, higher = more similar)
 */

// =============================================================================
// Cosine Similarity
// =============================================================================

/**
 * Calculate cosine similarity between two vectors.
 * @param {number[]} a - First vector
 * @param {number[]} b - Second vector
 * @returns {number} Similarity score between -1 and 1 (typically 0-1 for embeddings)
 */
export function cosineSimilarity(a, b) {
  if (a.length !== b.length) {
    throw new Error("Vectors must have the same length");
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  normA = Math.sqrt(normA);
  normB = Math.sqrt(normB);

  if (normA === 0 || normB === 0) {
    return 0;
  }

  return dotProduct / (normA * normB);
}

/**
 * Find the most similar vectors from a list.
 * @param {number[]} query - Query vector
 * @param {Array<{ id: string, vector: number[], metadata?: any }>} vectors - List of vectors with metadata
 * @param {number} [topK=5] - Number of top results to return
 * @returns {Array<{ id: string, score: number, metadata?: any }>}
 */
export function findMostSimilar(query, vectors, topK = 5) {
  const scored = vectors.map((v) => ({
    id: v.id,
    score: cosineSimilarity(query, v.vector),
    metadata: v.metadata,
  }));

  return scored.sort((a, b) => b.score - a.score).slice(0, topK);
}

/**
 * Calculate similarity matrix for a set of vectors.
 * @param {Array<{ id: string, vector: number[] }>} vectors
 * @returns {Array<{ id1: string, id2: string, score: number }>}
 */
export function similarityMatrix(vectors) {
  const matrix = [];

  for (let i = 0; i < vectors.length; i++) {
    for (let j = i + 1; j < vectors.length; j++) {
      matrix.push({
        id1: vectors[i].id,
        id2: vectors[j].id,
        score: cosineSimilarity(vectors[i].vector, vectors[j].vector),
      });
    }
  }

  return matrix;
}

/**
 * Cluster vectors by similarity threshold.
 * @param {Array<{ id: string, vector: number[] }>} vectors
 * @param {number} threshold - Similarity threshold (0-1)
 * @returns {Array<Array<string>>} Clusters of IDs
 */
export function clusterBySimilarity(vectors, threshold = 0.8) {
  const clusters = [];
  const assigned = new Set();

  for (const v of vectors) {
    if (assigned.has(v.id)) continue;

    const cluster = [v.id];
    assigned.add(v.id);

    for (const other of vectors) {
      if (assigned.has(other.id)) continue;

      const similarity = cosineSimilarity(v.vector, other.vector);
      if (similarity >= threshold) {
        cluster.push(other.id);
        assigned.add(other.id);
      }
    }

    clusters.push(cluster);
  }

  return clusters;
}
