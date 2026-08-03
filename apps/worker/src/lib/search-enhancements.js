/**
 * P17-I: Searchable History Improved
 *
 * Advanced search with filters: person, room, date, message type.
 * Saved searches and folders for organizing frequent queries.
 * Unified ranking across keyword (FTS5), semantic (embeddings),
 * and knowledge graph entity search.
 *
 * Compounds:
 * - P15-F (message_embeddings) for semantic reranking
 * - P16-B (knowledge_graph) for entity search
 * - P12-E (messages_fts) for keyword search
 * - P12-C (inbox) for unified views
 */

import { searchMessages, sanitizeFtsQuery } from "./message-search.js";

/**
 * Unified search across keyword, semantic, and entity sources.
 *
 * @param {object} env
 * @param {{
 *   projectId: string,
 *   userId: string,
 *   roles?: string[],
 *   query: string,
 *   roomId?: string,
 *   userIdFilter?: string,
 *   from?: string,
 *   to?: string,
 *   limit?: number,
 *   mode?: 'keyword' | 'semantic' | 'hybrid' | 'entity',
 * }} input
 * @returns {Promise<{ ok: true, results: Array, query: string, mode: string, totalFound: number } | { ok: false, error: string }>}
 */
export async function unifiedSearch(env, input) {
  const { projectId, userId, roles } = input;
  const mode = input.mode || "hybrid";
  const limit = Math.min(Math.max(Number(input.limit) || 20, 1), 50);

  if (!input.query?.trim()) {
    return { ok: false, error: "query_required" };
  }

  let results = [];
  let sourcesUsed = [];

  // Keyword search (FTS5)
  if (mode === "keyword" || mode === "hybrid") {
    try {
      const ftsResult = await searchMessages(env, {
        projectId,
        userId,
        roles,
        query: input.query,
        roomId: input.roomId,
        from: input.from,
        to: input.to,
        limit: mode === "keyword" ? limit : limit * 2,
      });

      if (ftsResult.ok && ftsResult.results?.length) {
        for (const r of ftsResult.results) {
          results.push({
            ...r,
            source: "keyword",
            score: 1.0,
          });
        }
        sourcesUsed.push("keyword");
      }
    } catch {
      // FTS5 unavailable — continue with other sources
    }
  }

  // Semantic search
  if (mode === "semantic" || mode === "hybrid") {
    const { isSemanticSearchActive, getSemanticSearchSettings } = await import("./semantic-search-settings.js");
    const semSettings = await getSemanticSearchSettings(env, projectId);
    if (isSemanticSearchActive(semSettings)) {
      try {
        const { searchSemanticMessages } = await import("./message-embeddings.js");
        const semResult = await searchSemanticMessages(env, {
          query: input.query,
          projectId,
          userId,
          roles,
          roomId: input.roomId,
          from: input.from,
          to: input.to,
          limit: mode === "semantic" ? limit : limit * 2,
          mode: "semantic",
        });

        if (semResult.ok && semResult.results?.length) {
          for (const r of semResult.results) {
            results.push({
              id: r.id,
              roomId: r.roomId,
              userId: r.userId,
              content: r.content,
              createdAt: r.createdAt,
              source: "semantic",
              score: r.score,
            });
          }
          sourcesUsed.push("semantic");
        }
      } catch {
        // Semantic unavailable — continue
      }
    }
  }

  // Entity search (KG)
  if (mode === "entity" || mode === "hybrid") {
    try {
      const { queryKnowledgeGraph } = await import("./knowledge-graph.js");
      const kgResult = await queryKnowledgeGraph(env, {
        projectId,
        roomId: input.roomId,
        limit: mode === "entity" ? limit : 10,
        includeSuperseded: false,
      });

      if (kgResult.ok && kgResult.nodes?.length) {
        const queryLower = input.query.toLowerCase();
        const matchedNodes = kgResult.nodes.filter((n) =>
          n.label.toLowerCase().includes(queryLower)
        );

        for (const node of matchedNodes.slice(0, limit)) {
          results.push({
            id: node.sourceMessageId || node.id,
            roomId: node.roomId,
            content: `[${node.nodeType}] ${node.label}`,
            source: "entity",
            score: 0.8,
            entityType: node.nodeType,
            entityLabel: node.label,
            properties: node.properties,
          });
        }
        if (matchedNodes.length) sourcesUsed.push("entity");
      }
    } catch {
      // KG unavailable — continue
    }
  }

  // Deduplicate by message id, keeping highest score
  const seen = new Map();
  for (const r of results) {
    const key = String(r.id || `${r.roomId}:${r.content}`);
    const existing = seen.get(key);
    if (!existing || (r.score || 0) > (existing.score || 0)) {
      seen.set(key, r);
    }
  }

  const deduped = [...seen.values()]
    .sort((a, b) => (b.score || 0) - (a.score || 0))
    .slice(0, limit);

  // Filter by userId if specified
  const filtered = input.userIdFilter
    ? deduped.filter((r) => r.userId === input.userIdFilter)
    : deduped;

  return {
    ok: true,
    results: filtered,
    query: input.query,
    mode,
    sourcesUsed,
    totalFound: filtered.length,
  };
}

// ── Saved Searches ──

/**
 * Save a search query.
 */
export async function saveSearch(env, input) {
  const { projectId, userId, name, query, filters } = input;
  if (!name?.trim()) return { ok: false, error: "name_required" };
  if (!query?.trim() && !filters) return { ok: false, error: "query_or_filters_required" };

  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  await env.DB.prepare(
    `INSERT INTO saved_searches (id, project_id, user_id, name, query, filters_json, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(id, projectId, userId, name.trim(), query || "", filters ? JSON.stringify(filters) : null, now, now)
    .run();

  return { ok: true, id, name: name.trim() };
}

/**
 * List saved searches for a user (own + shared in project).
 */
export async function listSavedSearches(env, input) {
  const { projectId, userId } = input;

  const rows = await env.DB.prepare(
    `SELECT * FROM saved_searches
     WHERE project_id = ? AND (user_id = ? OR is_shared = 1)
     ORDER BY use_count DESC, name ASC`
  )
    .bind(projectId, userId)
    .all();

  const searches = (rows.results || []).map((r) => ({
    id: r.id,
    name: r.name,
    query: r.query,
    filters: r.filters_json ? JSON.parse(r.filters_json) : null,
    isShared: !!r.is_shared,
    useCount: r.use_count,
    lastUsedAt: r.last_used_at,
    createdAt: r.created_at,
    userId: r.user_id,
  }));

  return { ok: true, searches };
}

/**
 * Delete a saved search.
 */
export async function deleteSavedSearch(env, input) {
  const { projectId, userId, searchId } = input;
  if (!searchId) return { ok: false, error: "search_id_required" };

  const existing = await env.DB.prepare(
    "SELECT id, user_id FROM saved_searches WHERE id = ? AND project_id = ?"
  )
    .bind(searchId, projectId)
    .first();

  if (!existing) return { ok: false, error: "not_found" };
  if (existing.user_id !== userId) return { ok: false, error: "forbidden" };

  await env.DB.prepare("DELETE FROM saved_searches WHERE id = ?").bind(searchId).run();
  return { ok: true };
}

/**
 * Increment use count on a saved search.
 */
export async function recordSearchUse(env, searchId) {
  if (!searchId) return;
  const now = new Date().toISOString();
  await env.DB.prepare(
    "UPDATE saved_searches SET use_count = use_count + 1, last_used_at = ?, updated_at = ? WHERE id = ?"
  )
    .bind(now, now, searchId)
    .run();
}

// ── Search Folders ──

/**
 * Create a search folder.
 */
export async function createFolder(env, input) {
  const { projectId, userId, name, description } = input;
  if (!name?.trim()) return { ok: false, error: "name_required" };

  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  await env.DB.prepare(
    `INSERT INTO search_folders (id, project_id, user_id, name, description, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(id, projectId, userId, name.trim(), description || null, now, now)
    .run();

  return { ok: true, id, name: name.trim() };
}

/**
 * List search folders for a user.
 */
export async function listFolders(env, input) {
  const { projectId, userId } = input;

  const rows = await env.DB.prepare(
    `SELECT sf.*,
       (SELECT COUNT(*) FROM search_folder_items sfi WHERE sfi.folder_id = sf.id) AS item_count
     FROM search_folders sf
     WHERE sf.project_id = ? AND sf.user_id = ?
     ORDER BY sf.name ASC`
  )
    .bind(projectId, userId)
    .all();

  const folders = (rows.results || []).map((r) => ({
    id: r.id,
    name: r.name,
    description: r.description,
    itemCount: r.item_count,
    createdAt: r.created_at,
  }));

  return { ok: true, folders };
}

/**
 * Add a saved search to a folder.
 */
export async function addToFolder(env, input) {
  const { projectId, userId, folderId, searchId } = input;
  if (!folderId || !searchId) return { ok: false, error: "folder_id_and_search_id_required" };

  // Verify folder ownership
  const folder = await env.DB.prepare(
    "SELECT id, user_id FROM search_folders WHERE id = ? AND project_id = ?"
  )
    .bind(folderId, projectId)
    .first();

  if (!folder) return { ok: false, error: "folder_not_found" };
  if (folder.user_id !== userId) return { ok: false, error: "forbidden" };

  // Verify search exists
  const search = await env.DB.prepare(
    "SELECT id FROM saved_searches WHERE id = ? AND project_id = ?"
  )
    .bind(searchId, projectId)
    .first();

  if (!search) return { ok: false, error: "search_not_found" };

  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  await env.DB.prepare(
    `INSERT OR IGNORE INTO search_folder_items (id, folder_id, search_id, sort_order, created_at)
     VALUES (?, ?, ?, (SELECT COALESCE(MAX(sfi2.sort_order), -1) + 1 FROM search_folder_items sfi2 WHERE sfi2.folder_id = ?), ?)`
  )
    .bind(id, folderId, searchId, folderId, now)
    .run();

  return { ok: true };
}

/**
 * Remove a saved search from a folder.
 */
export async function removeFromFolder(env, input) {
  const { projectId, userId, folderId, searchId } = input;
  if (!folderId || !searchId) return { ok: false, error: "folder_id_and_search_id_required" };

  const folder = await env.DB.prepare(
    "SELECT id, user_id FROM search_folders WHERE id = ? AND project_id = ?"
  )
    .bind(folderId, projectId)
    .first();

  if (!folder) return { ok: false, error: "folder_not_found" };
  if (folder.user_id !== userId) return { ok: false, error: "forbidden" };

  await env.DB.prepare(
    "DELETE FROM search_folder_items WHERE folder_id = ? AND search_id = ?"
  )
    .bind(folderId, searchId)
    .run();

  return { ok: true };
}

/**
 * Get items in a folder.
 */
export async function getFolderItems(env, input) {
  const { projectId, userId, folderId } = input;
  if (!folderId) return { ok: false, error: "folder_id_required" };

  const folder = await env.DB.prepare(
    "SELECT id, user_id, name FROM search_folders WHERE id = ? AND project_id = ?"
  )
    .bind(folderId, projectId)
    .first();

  if (!folder) return { ok: false, error: "folder_not_found" };
  if (folder.user_id !== userId) return { ok: false, error: "forbidden" };

  const rows = await env.DB.prepare(
    `SELECT ss.*, sfi.sort_order
     FROM search_folder_items sfi
     JOIN saved_searches ss ON ss.id = sfi.search_id
     WHERE sfi.folder_id = ?
     ORDER BY sfi.sort_order ASC, ss.name ASC`
  )
    .bind(folderId)
    .all();

  const items = (rows.results || []).map((r) => ({
    id: r.id,
    name: r.name,
    query: r.query,
    filters: r.filters_json ? JSON.parse(r.filters_json) : null,
    sortOrder: r.sort_order,
    useCount: r.use_count,
  }));

  return { ok: true, folder: { id: folder.id, name: folder.name }, items };
}

/**
 * Delete a folder and its items.
 */
export async function deleteFolder(env, input) {
  const { projectId, userId, folderId } = input;
  if (!folderId) return { ok: false, error: "folder_id_required" };

  const folder = await env.DB.prepare(
    "SELECT id, user_id FROM search_folders WHERE id = ? AND project_id = ?"
  )
    .bind(folderId, projectId)
    .first();

  if (!folder) return { ok: false, error: "not_found" };
  if (folder.user_id !== userId) return { ok: false, error: "forbidden" };

  // CASCADE delete handles search_folder_items
  await env.DB.prepare("DELETE FROM search_folders WHERE id = ?").bind(folderId).run();
  return { ok: true };
}

