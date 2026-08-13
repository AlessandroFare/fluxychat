/**
 * Chat Cartography (#53) — batch embedding clustering + 2D layout cache.
 */

import { cosineSimilarity } from "./message-embeddings.js";
import { logInfo } from "./worker-log.js";

export const MAX_CARTography_MESSAGES = 500;
export const MIN_CARTography_MESSAGES = 5;
export const CARTography_TTL_MS = 6 * 60 * 60 * 1000;

function generateId(prefix) {
  return `${prefix}_${Array.from(crypto.getRandomValues(new Uint8Array(8)))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")}`;
}

function parseEmbedding(raw) {
  try {
    const vector = typeof raw === "string" ? JSON.parse(raw) : raw;
    return Array.isArray(vector) ? vector.map(Number) : null;
  } catch {
    return null;
  }
}

function previewText(content, max = 80) {
  return String(content || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

export function pickClusterCount(messageCount) {
  return Math.max(2, Math.min(12, Math.floor(Math.sqrt(messageCount / 3))));
}

/** Simple k-means on unit-ish vectors using cosine distance (= 1 - similarity). */
export function kMeansCosine(vectors, k, maxIterations = 20) {
  if (!vectors.length) return { assignments: [], centroids: [] };
  const kk = Math.min(k, vectors.length);
  const centroids = vectors.slice(0, kk).map((v) => [...v]);
  let assignments = new Array(vectors.length).fill(0);

  for (let iter = 0; iter < maxIterations; iter++) {
    let changed = false;
    for (let i = 0; i < vectors.length; i++) {
      let best = 0;
      let bestScore = -Infinity;
      for (let c = 0; c < kk; c++) {
        const score = cosineSimilarity(vectors[i], centroids[c]);
        if (score > bestScore) {
          bestScore = score;
          best = c;
        }
      }
      if (assignments[i] !== best) {
        assignments[i] = best;
        changed = true;
      }
    }
    if (!changed) break;

    const sums = Array.from({ length: kk }, () => []);
    const counts = new Array(kk).fill(0);
    for (let i = 0; i < vectors.length; i++) {
      const cluster = assignments[i];
      sums[cluster].push(vectors[i]);
      counts[cluster]++;
    }
    for (let c = 0; c < kk; c++) {
      if (!counts[c]) {
        centroids[c] = [...vectors[c % vectors.length]];
        continue;
      }
      const dim = vectors[0].length;
      const next = new Array(dim).fill(0);
      for (const vec of sums[c]) {
        for (let d = 0; d < dim; d++) next[d] += vec[d];
      }
      for (let d = 0; d < dim; d++) next[d] /= counts[c];
      centroids[c] = next;
    }
  }

  return { assignments, centroids };
}

export function layoutCartographyPoints(items, assignments, clusterCount) {
  const clusters = Array.from({ length: clusterCount }, () => ({
    xs: [],
    ys: [],
    members: [],
  }));

  for (let i = 0; i < items.length; i++) {
    const clusterId = assignments[i] ?? 0;
    clusters[clusterId].members.push(items[i]);
  }

  const clusterMeta = [];
  const points = [];
  const radiusBase = 42;

  for (let c = 0; c < clusterCount; c++) {
    const angle = (c / clusterCount) * Math.PI * 2;
    const cx = Math.cos(angle) * 180;
    const cy = Math.sin(angle) * 180;
    const members = clusters[c].members;
    const labelSource = members[0];
    clusterMeta.push({
      id: c,
      label: previewText(labelSource?.content, 48) || `Cluster ${c + 1}`,
      x: cx,
      y: cy,
      radius: radiusBase + Math.min(36, Math.sqrt(members.length) * 8),
      messageCount: members.length,
      sampleSnippet: previewText(labelSource?.content, 120),
    });

    members.forEach((member, idx) => {
      const jitterAngle = (idx / Math.max(members.length, 1)) * Math.PI * 2;
      const jitterR = Math.min(28, 6 + idx * 1.5);
      points.push({
        messageId: member.messageId,
        clusterId: c,
        x: cx + Math.cos(jitterAngle) * jitterR,
        y: cy + Math.sin(jitterAngle) * jitterR,
        createdAt: member.createdAt,
        preview: previewText(member.content, 100),
        userId: member.userId,
      });
    });
  }

  return { clusters: clusterMeta, points };
}

export async function fetchRoomEmbeddingMessages(env, projectId, roomId, limit = MAX_CARTography_MESSAGES) {
  const rows = await env.DB.prepare(
    `SELECT me.message_id, me.embedding, m.content, m.user_id, m.created_at
     FROM message_embeddings me
     JOIN messages m ON m.id = me.message_id AND m.room_id = me.room_id
     WHERE me.project_id = ? AND me.room_id = ? AND m.deleted_at IS NULL
     ORDER BY m.created_at DESC
     LIMIT ?`,
  )
    .bind(projectId, roomId, limit)
    .all();

  const parsed = [];
  for (const row of rows.results || []) {
    const vector = parseEmbedding(row.embedding);
    if (!vector?.length) continue;
    parsed.push({
      messageId: row.message_id,
      vector,
      content: row.content,
      userId: row.user_id,
      createdAt: row.created_at,
    });
  }
  return parsed.reverse();
}

export async function buildRoomCartography(env, { projectId, roomId }) {
  const items = await fetchRoomEmbeddingMessages(env, projectId, roomId);
  if (items.length < MIN_CARTography_MESSAGES) {
    return { ok: false, error: "insufficient_embeddings", count: items.length };
  }

  const clusterCount = pickClusterCount(items.length);
  const { assignments } = kMeansCosine(
    items.map((item) => item.vector),
    clusterCount,
  );
  const layout = layoutCartographyPoints(items, assignments, clusterCount);

  const now = new Date();
  const builtAt = now.toISOString();
  const expiresAt = new Date(now.getTime() + CARTography_TTL_MS).toISOString();
  const id = generateId("carto");

  await env.DB.prepare("DELETE FROM room_cartography_maps WHERE project_id = ? AND room_id = ?")
    .bind(projectId, roomId)
    .run();

  await env.DB.prepare(
    `INSERT INTO room_cartography_maps
     (id, project_id, room_id, version, message_count, cluster_count, clusters_json, points_json, built_at, expires_at)
     VALUES (?, ?, ?, 1, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      id,
      projectId,
      roomId,
      items.length,
      clusterCount,
      JSON.stringify(layout.clusters),
      JSON.stringify(layout.points),
      builtAt,
      expiresAt,
    )
    .run();

  logInfo("cartography.built", { projectId, roomId, messageCount: items.length, clusterCount });

  return {
    ok: true,
    map: {
      id,
      projectId,
      roomId,
      messageCount: items.length,
      clusterCount,
      clusters: layout.clusters,
      points: layout.points,
      builtAt,
      expiresAt,
    },
  };
}

function mapCartographyRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    projectId: row.project_id,
    roomId: row.room_id,
    messageCount: Number(row.message_count) || 0,
    clusterCount: Number(row.cluster_count) || 0,
    clusters: JSON.parse(row.clusters_json || "[]"),
    points: JSON.parse(row.points_json || "[]"),
    builtAt: row.built_at,
    expiresAt: row.expires_at,
  };
}

export async function getRoomCartography(env, { projectId, roomId }) {
  const row = await env.DB.prepare(
    `SELECT * FROM room_cartography_maps
     WHERE project_id = ? AND room_id = ?
     ORDER BY built_at DESC LIMIT 1`,
  )
    .bind(projectId, roomId)
    .first();

  const map = mapCartographyRow(row);
  if (!map) return { ok: false, error: "not_built" };
  if (map.expiresAt && Date.parse(map.expiresAt) < Date.now()) {
    return { ok: false, error: "expired", map };
  }
  return { ok: true, map };
}

/**
 * NW-205 — Detect hot thematic clusters and suggest support handoff / digest actions.
 *
 * A cluster is "hot" when its share of messages exceeds `hotShare` (default 0.35)
 * or its absolute count exceeds `hotMinCount` (default 8).
 *
 * @param {{
 *   clusters?: Array<{ id: number, label?: string, messageCount?: number, sampleSnippet?: string }>,
 *   points?: Array<{ clusterId: number, userId?: string }>,
 *   messageCount?: number,
 * }} map
 * @param {{
 *   hotShare?: number,
 *   hotMinCount?: number,
 *   routingCandidates?: Array<{ userId: string, online?: boolean, skills?: string[] }>,
 * }} [opts]
 */
export function suggestCartographyRouting(map, opts = {}) {
  const clusters = Array.isArray(map?.clusters) ? map.clusters : [];
  const points = Array.isArray(map?.points) ? map.points : [];
  const total = Number(map?.messageCount) || points.length || 0;
  const hotShare = opts.hotShare ?? 0.35;
  const hotMinCount = opts.hotMinCount ?? 8;
  const candidates = Array.isArray(opts.routingCandidates) ? opts.routingCandidates : [];

  const hotClusters = [];
  for (const cluster of clusters) {
    const count = Number(cluster.messageCount) || 0;
    const share = total > 0 ? count / total : 0;
    const isHot = count >= hotMinCount || (total >= 5 && share >= hotShare);
    if (!isHot) continue;

    const clusterPoints = points.filter((p) => p.clusterId === cluster.id);
    const userIds = [...new Set(clusterPoints.map((p) => p.userId).filter(Boolean))];
    const label = String(cluster.label || `Cluster ${cluster.id + 1}`);
    const skillsGuess = guessSkillsFromLabel(label);

    let suggestedAgent = null;
    if (candidates.length) {
      let best = null;
      let bestScore = -1;
      for (const agent of candidates) {
        if (agent.online === false) continue;
        let score = agent.online ? 2 : 0;
        for (const skill of skillsGuess) {
          if ((agent.skills || []).some((s) => String(s).toLowerCase().includes(skill))) {
            score += 5;
          }
        }
        if (score > bestScore) {
          bestScore = score;
          best = agent;
        }
      }
      if (best && bestScore > 0) suggestedAgent = best.userId;
    }

    hotClusters.push({
      clusterId: cluster.id,
      label,
      messageCount: count,
      share: Math.round(share * 1000) / 1000,
      sampleSnippet: cluster.sampleSnippet || null,
      participantUserIds: userIds.slice(0, 20),
      suggestedAction: suggestedAgent ? "handoff_agent" : "digest",
      suggestedAgentUserId: suggestedAgent,
      suggestedSkills: skillsGuess,
      reason:
        count >= hotMinCount
          ? `Cluster has ${count} messages (hot volume)`
          : `Cluster is ${Math.round(share * 100)}% of room traffic`,
    });
  }

  hotClusters.sort((a, b) => b.messageCount - a.messageCount);

  return {
    hot: hotClusters.length > 0,
    hotClusterCount: hotClusters.length,
    suggestions: hotClusters,
  };
}

function guessSkillsFromLabel(label) {
  const lower = label.toLowerCase();
  const skills = [];
  if (/bill|invoice|payment|refund|charg/.test(lower)) skills.push("billing");
  if (/deploy|infra|outage|latency|api|bug|error/.test(lower)) skills.push("engineering");
  if (/login|auth|password|access|sso/.test(lower)) skills.push("identity");
  if (/ship|order|deliver|fulfill/.test(lower)) skills.push("fulfillment");
  if (/legal|gdpr|privacy|compliance/.test(lower)) skills.push("compliance");
  return skills;
}

export async function getCartographyRoutingSuggestions(env, { projectId, roomId }) {
  const carto = await getOrBuildRoomCartography(env, { projectId, roomId, rebuild: false });
  if (!carto.ok || !carto.map) {
    return { ok: false, error: carto.error || "not_built", suggestions: [] };
  }

  let routingCandidates = [];
  try {
    const { loadRoomRoutingCandidates } = await import("./support-routing.js");
    routingCandidates = await loadRoomRoutingCandidates(env, { projectId, roomId });
  } catch {
    routingCandidates = [];
  }

  const routing = suggestCartographyRouting(carto.map, { routingCandidates });
  return {
    ok: true,
    mapId: carto.map.id,
    roomId,
    ...routing,
  };
}

export async function getOrBuildRoomCartography(env, { projectId, roomId, rebuild = false }) {
  if (!rebuild) {
    const existing = await getRoomCartography(env, { projectId, roomId });
    if (existing.ok) return existing;
  }
  return buildRoomCartography(env, { projectId, roomId });
}
