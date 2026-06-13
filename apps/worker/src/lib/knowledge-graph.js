/**
 * P16-B: AI Conversation Knowledge Graph
 *
 * Extracts entities and relations from room conversations incrementally.
 * Graph is a semantic INDEX, not source of truth — always linked to source
 * messages for auditability. Supports temporal versioning (valid_from/valid_to)
 * to track when facts become stale or superseded.
 *
 * Architecture (per analysis):
 * - Raw messages in D1 (source of truth)
 * - Embeddings for retrieval (P15-F)
 * - Knowledge Graph for relations and ownership
 * - Memory Layer for persistent context (P15-E)
 *
 * Extraction is incremental, not batch — processes recent messages per trigger.
 */

import { logError } from "./worker-log.js";
import { isAiConfigured } from "./ai-gateway.js";
import { chatCompletion } from "./ai-chat-completion.js";

const NODE_TYPES = [
  "user", "room", "message", "thread", "task", "decision",
  "file", "action", "external_entity", "concept",
];

const EDGE_TYPES = [
  "mentioned_in", "decided_by", "assigned_to", "part_of",
  "replies_to", "references", "created_by", "depends_on",
  "affects", "authored", "linked_to",
];

const EXTRACTION_SYSTEM_PROMPT = `You are a knowledge graph extraction engine for a chat application called FluxyChat.
Analyze the conversation transcript and extract entities (nodes) and relationships (edges).

## Node Types
- user: a person mentioned or participating (use their userId or name)
- task: action items, TODOs, work to be done
- decision: decisions made in the conversation
- concept: technical concepts, technologies, topics discussed
- external_entity: tickets, CRM records, URLs, external references
- file: files, documents, attachments mentioned

## Edge Types
- decided_by: user decided something
- assigned_to: task assigned to user
- mentioned_in: entity mentioned in a message
- references: one entity references another
- depends_on: task depends on another task
- affects: one entity affects another
- linked_to: generic relationship between entities

## Rules
1. Only extract genuinely important entities, not every name drop
2. Each node MUST have a source_message_id linking to the message that introduced it
3. Distinguish durable facts (decisions, tasks) from temporary mentions
4. For temporal facts, note if this supersedes a previous fact
5. Keep labels concise (1-5 words)
6. Properties should be structured JSON with relevant metadata

Return ONLY a valid JSON object with:
- nodes: array of { type, label, properties, source_message_index }
- edges: array of { source_index, target_index, type, properties, source_message_index }
  (source_index/target_index reference the nodes array by 0-based position)

Return empty arrays if nothing notable. No markdown, no explanation.`;

/**
 * Extract knowledge graph entities and relations from recent messages.
 *
 * @param {object} env
 * @param {{ projectId: string, roomId: string, since?: string }} input
 * @returns {Promise<{ ok: true, nodes: Array, edges: Array } | { ok: false, error: string }>}
 */
export async function extractKnowledgeGraph(env, input) {
  const { projectId, roomId } = input;

  let sql = `
    SELECT id, user_id, content, created_at
    FROM messages
    WHERE project_id = ? AND room_id = ? AND deleted_at IS NULL
  `;
  const params = [projectId, roomId];

  if (input.since) {
    sql += " AND created_at >= ?";
    params.push(input.since);
  }

  sql += " ORDER BY created_at DESC LIMIT 30";

  const rows = await env.DB.prepare(sql).bind(...params).all();
  const messages = (rows.results || []).reverse();

  if (!messages.length) {
    return { ok: true, nodes: [], edges: [] };
  }

  if (!isAiConfigured(env)) {
    return { ok: false, error: "ai_not_configured" };
  }

  const transcript = messages
    .map((m, i) => `[${i}] [${m.id}] [${m.created_at}] ${m.user_id}: ${m.content}`)
    .join("\n");

  const ai = await chatCompletion(env, {
    model: env.AI_KNOWLEDGE_GRAPH_MODEL || env.AI_DIGEST_MODEL || env.AI_SUGGEST_MODEL || env.AI_MODEL || "openai/gpt-4o-mini",
    maxTokens: 2048,
    temperature: 0.2,
    logContext: { projectId, roomId, feature: "knowledge_graph_extraction" },
    messages: [
      { role: "system", content: EXTRACTION_SYSTEM_PROMPT },
      {
        role: "user",
        content: `Extract knowledge graph from this conversation in room "${roomId}":\n\n${transcript}`,
      },
    ],
  });

  if (!ai.ok) {
    return { ok: false, error: ai.error };
  }

  let parsed;
  try {
    const text = ai.content.trim();
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    parsed = JSON.parse(jsonMatch ? jsonMatch[0] : '{"nodes":[],"edges":[]}');
  } catch {
    return { ok: false, error: "ai_parse_error" };
  }

  const rawNodes = Array.isArray(parsed.nodes) ? parsed.nodes : [];
  const rawEdges = Array.isArray(parsed.edges) ? parsed.edges : [];

  const now = new Date().toISOString();
  const nodes = rawNodes
    .filter((n) => n.type && n.label && NODE_TYPES.includes(n.type))
    .map((n) => ({
      id: crypto.randomUUID(),
      project_id: projectId,
      room_id: roomId,
      node_type: n.type,
      label: String(n.label).slice(0, 200),
      properties: n.properties ? JSON.stringify(n.properties) : null,
      source_message_id: typeof n.source_message_index === "number"
        ? messages[n.source_message_index]?.id ?? null
        : null,
      confidence: Math.min(Math.max(Number(n.confidence) || 0.8, 0), 1),
      valid_from: now,
      valid_to: null,
      created_at: now,
      updated_at: now,
    }));

  const nodeIndexMap = new Map();
  rawNodes.forEach((n, i) => {
    if (n.type && n.label && NODE_TYPES.includes(n.type)) {
      const idx = nodes.findIndex((nn) => nn.label === String(n.label).slice(0, 200) && nn.node_type === n.type);
      if (idx >= 0) nodeIndexMap.set(i, idx);
    }
  });

  const edges = rawEdges
    .filter((e) => {
      if (!e.type || !EDGE_TYPES.includes(e.type)) return false;
      if (typeof e.source_index !== "number" || typeof e.target_index !== "number") return false;
      if (!nodeIndexMap.has(e.source_index) || !nodeIndexMap.has(e.target_index)) return false;
      return true;
    })
    .map((e) => ({
      id: crypto.randomUUID(),
      project_id: projectId,
      room_id: roomId,
      source_node_id: nodes[nodeIndexMap.get(e.source_index)]?.id,
      target_node_id: nodes[nodeIndexMap.get(e.target_index)]?.id,
      edge_type: e.type,
      properties: e.properties ? JSON.stringify(e.properties) : null,
      source_message_id: typeof e.source_message_index === "number"
        ? messages[e.source_message_index]?.id ?? null
        : null,
      confidence: Math.min(Math.max(Number(e.confidence) || 0.8, 0), 1),
      valid_from: now,
      valid_to: null,
      created_at: now,
    }));

  return { ok: true, nodes, edges };
}

/**
 * Persist knowledge graph nodes and edges into D1.
 * Deduplicates by (project_id, room_id, node_type, label) for nodes
 * and (project_id, source_node_id, target_node_id, edge_type) for edges.
 * Supports temporal versioning: superseded facts get valid_to set.
 *
 * @param {object} env
 * @param {{ projectId: string, roomId: string, nodes: Array, edges: Array }} input
 * @returns {Promise<{ ok: true, nodesInserted: number, edgesInserted: number }>}
 */
export async function persistKnowledgeGraph(env, input) {
  const { projectId, roomId, nodes, edges } = input;
  if (!nodes.length && !edges.length) {
    return { ok: true, nodesInserted: 0, edgesInserted: 0 };
  }

  let nodesInserted = 0;
  let edgesInserted = 0;
  const now = new Date().toISOString();

  for (const node of nodes) {
    const existing = await env.DB.prepare(
      `SELECT id, valid_to FROM kg_nodes
       WHERE project_id = ? AND room_id = ? AND node_type = ? AND label = ?
       AND valid_to IS NULL`
    )
      .bind(projectId, roomId, node.node_type, node.label)
      .first();

    if (existing) {
      if (node.confidence > 0.9 && node.properties !== existing.properties) {
        await env.DB.prepare(
          `UPDATE kg_nodes SET valid_to = ?, updated_at = ? WHERE id = ?`
        )
          .bind(now, now, existing.id)
          .run();

        const newNode = { ...node, id: crypto.randomUUID() };
        await env.DB.prepare(
          `INSERT INTO kg_nodes (id, project_id, room_id, node_type, label, properties, source_message_id, confidence, valid_from, valid_to, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
          .bind(
            newNode.id, newNode.project_id, newNode.room_id, newNode.node_type,
            newNode.label, newNode.properties, newNode.source_message_id,
            newNode.confidence, now, null, now, now,
          )
          .run();
        nodesInserted++;
      }
    } else {
      await env.DB.prepare(
        `INSERT INTO kg_nodes (id, project_id, room_id, node_type, label, properties, source_message_id, confidence, valid_from, valid_to, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
        .bind(
          node.id, node.project_id, node.room_id, node.node_type,
          node.label, node.properties, node.source_message_id,
          node.confidence, node.valid_from, node.valid_to, node.created_at, node.updated_at,
        )
        .run();
      nodesInserted++;
    }
  }

  for (const edge of edges) {
    if (!edge.source_node_id || !edge.target_node_id) continue;

    const existing = await env.DB.prepare(
      `SELECT id FROM kg_edges
       WHERE project_id = ? AND room_id = ? AND source_node_id = ? AND target_node_id = ? AND edge_type = ?
       AND valid_to IS NULL`
    )
      .bind(projectId, roomId, edge.source_node_id, edge.target_node_id, edge.edge_type)
      .first();

    if (existing) continue;

    await env.DB.prepare(
      `INSERT INTO kg_edges (id, project_id, room_id, source_node_id, target_node_id, edge_type, properties, source_message_id, confidence, valid_from, valid_to, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(
        edge.id, edge.project_id, edge.room_id, edge.source_node_id,
        edge.target_node_id, edge.edge_type, edge.properties,
        edge.source_message_id, edge.confidence, edge.valid_from,
        edge.valid_to, edge.created_at,
      )
      .run();
    edgesInserted++;
  }

  return { ok: true, nodesInserted, edgesInserted };
}

/**
 * Query knowledge graph: get nodes and edges for a room, with optional filters.
 *
 * @param {object} env
 * @param {{
 *   projectId: string,
 *   roomId?: string,
 *   nodeType?: string,
 *   edgeType?: string,
 *   nodeId?: string,
 *   limit?: number,
 *   includeSuperseded?: boolean,
 * }} input
 * @returns {Promise<{ ok: true, nodes: Array, edges: Array }>}
 */
export async function queryKnowledgeGraph(env, input) {
  const { projectId, roomId, nodeType, edgeType, nodeId } = input;
  const limit = Math.min(Math.max(Number(input.limit) || 50, 1), 200);
  const includeSuperseded = input.includeSuperseded === true;

  let nodeSql = `SELECT * FROM kg_nodes WHERE project_id = ?`;
  const nodeParams = [projectId];

  if (roomId) {
    nodeSql += " AND room_id = ?";
    nodeParams.push(roomId);
  }
  if (nodeType && NODE_TYPES.includes(nodeType)) {
    nodeSql += " AND node_type = ?";
    nodeParams.push(nodeType);
  }
  if (!includeSuperseded) {
    nodeSql += " AND valid_to IS NULL";
  }
  if (nodeId) {
    nodeSql += " AND id = ?";
    nodeParams.push(nodeId);
  }
  nodeSql += " ORDER BY created_at DESC LIMIT ?";
  nodeParams.push(limit);

  const nodeRows = await env.DB.prepare(nodeSql).bind(...nodeParams).all();
  const nodes = (nodeRows.results || []).map((r) => ({
    id: r.id,
    projectId: r.project_id,
    roomId: r.room_id,
    nodeType: r.node_type,
    label: r.label,
    properties: r.properties ? JSON.parse(r.properties) : null,
    sourceMessageId: r.source_message_id,
    confidence: r.confidence,
    validFrom: r.valid_from,
    validTo: r.valid_to,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }));

  const nodeIds = new Set(nodes.map((n) => n.id));

  let edgeSql = `SELECT * FROM kg_edges WHERE project_id = ?`;
  const edgeParams = [projectId];

  if (roomId) {
    edgeSql += " AND room_id = ?";
    edgeParams.push(roomId);
  }
  if (edgeType && EDGE_TYPES.includes(edgeType)) {
    edgeSql += " AND edge_type = ?";
    edgeParams.push(edgeType);
  }
  if (!includeSuperseded) {
    edgeSql += " AND valid_to IS NULL";
  }
  if (nodeId) {
    edgeSql += " AND (source_node_id = ? OR target_node_id = ?)";
    edgeParams.push(nodeId, nodeId);
  }
  edgeSql += " ORDER BY created_at DESC LIMIT ?";
  edgeParams.push(limit);

  const edgeRows = await env.DB.prepare(edgeSql).bind(...edgeParams).all();
  const edges = (edgeRows.results || []).map((r) => ({
    id: r.id,
    projectId: r.project_id,
    roomId: r.room_id,
    sourceNodeId: r.source_node_id,
    targetNodeId: r.target_node_id,
    edgeType: r.edge_type,
    properties: r.properties ? JSON.parse(r.properties) : null,
    sourceMessageId: r.source_message_id,
    confidence: r.confidence,
    validFrom: r.valid_from,
    validTo: r.valid_to,
    createdAt: r.created_at,
  }));

  return { ok: true, nodes, edges };
}

/**
 * Get entity timeline: all versions of a node over time.
 *
 * @param {object} env
 * @param {{ projectId: string, nodeId: string }} input
 * @returns {Promise<{ ok: true, timeline: Array } | { ok: false, error: string }>}
 */
export async function getEntityTimeline(env, input) {
  const { projectId, nodeId } = input;

  const node = await env.DB.prepare(
    "SELECT * FROM kg_nodes WHERE id = ? AND project_id = ?"
  )
    .bind(nodeId, projectId)
    .first();

  if (!node) {
    return { ok: false, error: "node_not_found" };
  }

  const rows = await env.DB.prepare(
    `SELECT * FROM kg_nodes
     WHERE project_id = ? AND room_id = ? AND node_type = ? AND label = ?
     ORDER BY valid_from ASC`
  )
    .bind(projectId, node.room_id, node.node_type, node.label)
    .all();

  const timeline = (rows.results || []).map((r) => ({
    id: r.id,
    properties: r.properties ? JSON.parse(r.properties) : null,
    confidence: r.confidence,
    validFrom: r.valid_from,
    validTo: r.valid_to,
    sourceMessageId: r.source_message_id,
    createdAt: r.created_at,
  }));

  return { ok: true, timeline };
}

/**
 * Get full graph for a room: all nodes and edges.
 *
 * @param {object} env
 * @param {{ projectId: string, roomId: string, limit?: number }} input
 * @returns {Promise<{ ok: true, nodes: Array, edges: Array, stats: object }>}
 */
export async function getRoomGraph(env, input) {
  const result = await queryKnowledgeGraph(env, {
    ...input,
    includeSuperseded: false,
  });

  const nodeTypeCounts = {};
  const edgeTypeCounts = {};
  for (const n of result.nodes) {
    nodeTypeCounts[n.nodeType] = (nodeTypeCounts[n.nodeType] || 0) + 1;
  }
  for (const e of result.edges) {
    edgeTypeCounts[e.edgeType] = (edgeTypeCounts[e.edgeType] || 0) + 1;
  }

  return {
    ...result,
    stats: {
      totalNodes: result.nodes.length,
      totalEdges: result.edges.length,
      nodeTypeCounts,
      edgeTypeCounts,
    },
  };
}
