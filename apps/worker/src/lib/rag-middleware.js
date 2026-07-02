/**
 * P24-8: RAG Middleware
 * Adapted from Vercel Chat SDK's community RAG middleware pattern.
 *
 * Pluggable retrieval-augmented generation: inject relevant context from
 * knowledge base into LLM calls.
 *
 * Usage:
 *   const rag = createRagMiddleware({
 *     retriever: createVectorRetriever(env),
 *     maxContextTokens: 4000,
 *   });
 *
 *   const enhancedPrompt = await rag.enhancePrompt("What is FluxyChat?");
 */

// =============================================================================
// Types
// =============================================================================

/**
 * @typedef {Object} RetrievedDocument
 * @property {string} id - Document ID
 * @property {string} content - Document content
 * @property {number} score - Relevance score (0-1)
 * @property {Object} [metadata] - Additional metadata
 * @property {string} [source] - Document source
 */

/**
 * @typedef {Object} Retriever
 * @property {(query: string, options?: { limit?: number, threshold?: number }) => Promise<RetrievedDocument[]>} search
 * @property {(document: Object) => Promise<void>} [index] - Index a document
 * @property {(id: string) => Promise<boolean>} [delete] - Delete a document
 */

/**
 * @typedef {Object} RagConfig
 * @property {Retriever} retriever - Document retriever
 * @property {number} [maxContextTokens] - Max tokens for context (default: 4000)
 * @property {number} [maxDocuments] - Max documents to retrieve (default: 5)
 * @property {number} [minScore] - Minimum relevance score (default: 0.5)
 * @property {boolean} [includeSources] - Include source citations (default: true)
 * @property {(documents: RetrievedDocument[]) => string} [formatContext] - Custom context formatter
 */

// =============================================================================
// RAG Middleware
// =============================================================================

/**
 * Create RAG middleware for enhancing prompts with retrieved context.
 * @param {RagConfig} config
 */
export function createRagMiddleware(config) {
  const {
    retriever,
    maxContextTokens = 4000,
    maxDocuments = 5,
    minScore = 0.5,
    includeSources = true,
    formatContext: customFormatter,
  } = config;

  /**
   * Estimate token count (rough approximation).
   * @param {string} text
   * @returns {number}
   */
  function estimateTokens(text) {
    return Math.ceil(text.length / 4);
  }

  /**
   * Format retrieved documents into context string.
   * @param {RetrievedDocument[]} documents
   * @returns {string}
   */
  function formatDocuments(documents) {
    if (customFormatter) {
      return customFormatter(documents);
    }

    if (documents.length === 0) {
      return "";
    }

    const lines = ["## Relevant Context:\n"];
    for (const doc of documents) {
      lines.push(`### ${doc.source || doc.id}`);
      lines.push(doc.content);
      if (includeSources && doc.source) {
        lines.push(`*Source: ${doc.source}*`);
      }
      lines.push("");
    }

    return lines.join("\n");
  }

  return {
    /**
     * Enhance a prompt with retrieved context.
     * @param {string} query - User query
     * @param {Object} [options] - Additional options
     * @returns {Promise<{ enhancedPrompt: string, documents: RetrievedDocument[] }>}
     */
    async enhancePrompt(query, options = {}) {
      const { limit = maxDocuments, threshold = minScore } = options;

      // Retrieve relevant documents
      const documents = await retriever.search(query, { limit, threshold });

      // Estimate context size
      let context = formatDocuments(documents);
      let contextTokens = estimateTokens(context);

      // Trim context if too large
      while (contextTokens > maxContextTokens && documents.length > 1) {
        documents.pop();
        context = formatDocuments(documents);
        contextTokens = estimateTokens(context);
      }

      // Build enhanced prompt
      const enhancedPrompt = context
        ? `${context}\n\n## User Query:\n${query}`
        : query;

      return { enhancedPrompt, documents };
    },

    /**
     * Create a middleware function for LLM calls.
     * @returns {(prompt: string) => Promise<string>}
     */
    createMiddleware() {
      return async (prompt) => {
        const { enhancedPrompt } = await this.enhancePrompt(prompt);
        return enhancedPrompt;
      };
    },

    /**
     * Index a document into the knowledge base.
     * @param {Object} document
     */
    async indexDocument(document) {
      if (retriever.index) {
        await retriever.index(document);
      }
    },

    /**
     * Delete a document from the knowledge base.
     * @param {string} id
     * @returns {boolean}
     */
    async deleteDocument(id) {
      if (retriever.delete) {
        return retriever.delete(id);
      }
      return false;
    },

    /**
     * Get retriever instance.
     * @returns {Retriever}
     */
    getRetriever() {
      return retriever;
    },
  };
}

// =============================================================================
// Built-in Retrievers
// =============================================================================

/**
 * Create a vector-based retriever using embeddings.
 * @param {Object} env - Environment with vector index
 * @returns {Retriever}
 */
export function createVectorRetriever(env) {
  return {
    async search(query, options = {}) {
      const { limit = 5, threshold = 0.5 } = options;

      // In production, use vector search (e.g., Cloudflare Vectorize)
      // For now, return empty array
      return [];
    },

    async index(document) {
      // In production, compute embeddings and store in vector index
    },

    async delete(id) {
      // In production, delete from vector index
      return true;
    },
  };
}

/**
 * Create a D1-based retriever using full-text search.
 * @param {D1Database} db - Cloudflare D1 database
 * @param {string} table - Table name
 * @returns {Retriever}
 */
export function createD1Retriever(db, table = "documents") {
  return {
    async search(query, options = {}) {
      const { limit = 5, threshold = 0.5 } = options;

      try {
        const result = await db
          .prepare(
            `SELECT *, rank FROM ${table} WHERE content MATCH ? ORDER BY rank LIMIT ?`
          )
          .bind(query, limit)
          .all();

        return result.results.map((row) => ({
          id: row.id,
          content: row.content,
          score: 1 - (row.rank || 0), // Convert rank to score
          metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
          source: row.source,
        }));
      } catch {
        return [];
      }
    },

    async index(document) {
      await db
        .prepare(
          `INSERT OR REPLACE INTO ${table} (id, content, metadata, source, created_at)
           VALUES (?, ?, ?, ?, ?)`
        )
        .bind(
          document.id || crypto.randomUUID(),
          document.content,
          document.metadata ? JSON.stringify(document.metadata) : null,
          document.source || null,
          Date.now()
        )
        .run();
    },

    async delete(id) {
      const result = await db
        .prepare(`DELETE FROM ${table} WHERE id = ?`)
        .bind(id)
        .run();
      return (result.meta?.changes || 0) > 0;
    },
  };
}

/**
 * Create a hybrid retriever combining vector and keyword search.
 * @param {Retriever} vectorRetriever - Vector-based retriever
 * @param {Retriever} keywordRetriever - Keyword-based retriever
 * @param {{ vectorWeight?: number, keywordWeight?: number }} [weights]
 * @returns {Retriever}
 */
export function createHybridRetriever(vectorRetriever, keywordRetriever, weights = {}) {
  const { vectorWeight = 0.7, keywordWeight = 0.3 } = weights;

  return {
    async search(query, options = {}) {
      const { limit = 5, threshold = 0.5 } = options;

      // Search both retrievers in parallel
      const [vectorResults, keywordResults] = await Promise.all([
        vectorRetriever.search(query, { limit: limit * 2, threshold }),
        keywordRetriever.search(query, { limit: limit * 2, threshold }),
      ]);

      // Merge and score results
      const scores = new Map();

      for (const doc of vectorResults) {
        scores.set(doc.id, {
          doc,
          score: (scores.get(doc.id)?.score || 0) + doc.score * vectorWeight,
        });
      }

      for (const doc of keywordResults) {
        scores.set(doc.id, {
          doc,
          score: (scores.get(doc.id)?.score || 0) + doc.score * keywordWeight,
        });
      }

      // Sort by score and return top results
      return Array.from(scores.values())
        .sort((a, b) => b.score - a.score)
        .slice(0, limit)
        .map(({ doc, score }) => ({ ...doc, score }));
    },

    async index(document) {
      await Promise.all([
        vectorRetriever.index?.(document),
        keywordRetriever.index?.(document),
      ]);
    },

    async delete(id) {
      const [vResult, kResult] = await Promise.all([
        vectorRetriever.delete?.(id),
        keywordRetriever.delete?.(id),
      ]);
      return vResult || kResult;
    },
  };
}
