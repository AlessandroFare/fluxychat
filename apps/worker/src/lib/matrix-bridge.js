function generateId() {
  return Array.from(crypto.getRandomValues(new Uint8Array(16)))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function createMatrixBridge(env, { projectId, homeserverUrl, accessToken, botUserId, botDisplayName, syncMode, settings }) {
  const id = `mb_${generateId().slice(0, 12)}`;
  const now = new Date().toISOString();
  await env.DB.prepare(
    `INSERT INTO matrix_bridge_configs (id, project_id, homeserver_url, access_token, bot_user_id, bot_display_name, sync_mode, status, settings, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'disconnected', ?, ?, ?)`
  )
    .bind(id, projectId, homeserverUrl, accessToken || null, botUserId || null, botDisplayName || null, syncMode || "bidirectional", settings ? JSON.stringify(settings) : null, now, now)
    .run();
  return { id, status: "disconnected" };
}

export async function connectMatrixBridge(env, { bridgeId }) {
  const now = new Date().toISOString();
  const result = await env.DB.prepare(
    "UPDATE matrix_bridge_configs SET status = 'connected', error_message = NULL, updated_at = ? WHERE id = ?"
  ).bind(now, bridgeId).run();
  return { connected: result.meta?.changes || 0 };
}

export async function disconnectMatrixBridge(env, { bridgeId }) {
  const now = new Date().toISOString();
  const result = await env.DB.prepare(
    "UPDATE matrix_bridge_configs SET status = 'disconnected', updated_at = ? WHERE id = ?"
  ).bind(now, bridgeId).run();
  return { disconnected: result.meta?.changes || 0 };
}

export async function getMatrixBridge(env, { bridgeId }) {
  const row = await env.DB.prepare("SELECT * FROM matrix_bridge_configs WHERE id = ?").bind(bridgeId).first();
  return row ? mapConfigRow(row) : null;
}

export async function listMatrixBridges(env, { projectId }) {
  const rows = await env.DB.prepare(
    "SELECT * FROM matrix_bridge_configs WHERE project_id = ? ORDER BY created_at DESC"
  ).bind(projectId).all();
  return (rows.results || []).map(mapConfigRow);
}

export async function deleteMatrixBridge(env, { bridgeId }) {
  await env.DB.prepare("DELETE FROM matrix_room_mappings WHERE bridge_id = ?").bind(bridgeId).run();
  await env.DB.prepare("DELETE FROM matrix_message_map WHERE bridge_id = ?").bind(bridgeId).run();
  const result = await env.DB.prepare("DELETE FROM matrix_bridge_configs WHERE id = ?").bind(bridgeId).run();
  return { deleted: result.meta?.changes || 0 };
}

export async function createMatrixRoomMapping(env, { bridgeId, projectId, fluxychatRoomId, matrixRoomId, matrixSpaceId, syncReactions, syncAttachments }) {
  const id = `mmr_${generateId().slice(0, 12)}`;
  const now = new Date().toISOString();
  await env.DB.prepare(
    `INSERT INTO matrix_room_mappings (id, bridge_id, project_id, fluxychat_room_id, matrix_room_id, matrix_space_id, sync_reactions, sync_attachments, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(id, bridgeId, projectId, fluxychatRoomId, matrixRoomId, matrixSpaceId || null, syncReactions !== false ? 1 : 0, syncAttachments !== false ? 1 : 0, now)
    .run();
  return { id };
}

export async function listMatrixRoomMappings(env, { bridgeId }) {
  const rows = await env.DB.prepare(
    "SELECT * FROM matrix_room_mappings WHERE bridge_id = ? ORDER BY created_at ASC"
  ).bind(bridgeId).all();
  return (rows.results || []).map(mapMappingRow);
}

export async function getMatrixMappingByFluxyRoom(env, { roomId }) {
  const rows = await env.DB.prepare(
    "SELECT * FROM matrix_room_mappings WHERE fluxychat_room_id = ?"
  ).bind(roomId).all();
  return (rows.results || []).map(mapMappingRow);
}

export async function getMatrixMappingByMatrixRoom(env, { bridgeId, matrixRoomId }) {
  const row = await env.DB.prepare(
    "SELECT * FROM matrix_room_mappings WHERE bridge_id = ? AND matrix_room_id = ?"
  ).bind(bridgeId, matrixRoomId).first();
  return row ? mapMappingRow(row) : null;
}

export async function deleteMatrixRoomMapping(env, { mappingId }) {
  const result = await env.DB.prepare("DELETE FROM matrix_room_mappings WHERE id = ?").bind(mappingId).run();
  return { deleted: result.meta?.changes || 0 };
}

export async function mapMatrixMessage(env, { bridgeId, projectId, fluxychatMessageId, matrixEventId, matrixRoomId, direction }) {
  const id = `mmm_${generateId().slice(0, 12)}`;
  const now = new Date().toISOString();
  await env.DB.prepare(
    `INSERT INTO matrix_message_map (id, bridge_id, project_id, fluxychat_message_id, matrix_event_id, matrix_room_id, direction, synced_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(id, bridgeId, projectId, fluxychatMessageId, matrixEventId, matrixRoomId, direction, now)
    .run();
  return { id };
}

export async function findMatrixEvent(env, { fluxychatMessageId }) {
  const row = await env.DB.prepare(
    "SELECT * FROM matrix_message_map WHERE fluxychat_message_id = ?"
  ).bind(fluxychatMessageId).first();
  return row ? mapMessageRow(row) : null;
}

export async function findFluxyMessageByMatrix(env, { matrixEventId }) {
  const row = await env.DB.prepare(
    "SELECT * FROM matrix_message_map WHERE matrix_event_id = ?"
  ).bind(matrixEventId).first();
  return row ? mapMessageRow(row) : null;
}

export async function recordMatrixSyncLog(env, { bridgeId, projectId, eventType, direction, payload, status }) {
  const id = `msl_${generateId().slice(0, 12)}`;
  const now = new Date().toISOString();
  await env.DB.prepare(
    "INSERT INTO matrix_sync_log (id, bridge_id, project_id, event_type, direction, payload, status, recorded_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
  )
    .bind(id, bridgeId, projectId, eventType, direction || null, payload ? JSON.stringify(payload) : null, status || "success", now)
    .run();
  return { id };
}

export async function syncMatrixInbound(env, { bridgeId, projectId, matrixEventId, matrixRoomId, senderId, content, msgtype }) {
  const mapping = await getMatrixMappingByMatrixRoom(env, { bridgeId, matrixRoomId });
  if (!mapping) return { error: "no_mapping" };

  const existing = await findFluxyMessageByMatrix(env, { matrixEventId });
  if (existing) return { error: "already_synced" };

  await recordMatrixSyncLog(env, {
    bridgeId, projectId, eventType: "message", direction: "inbound",
    payload: { matrixEventId, matrixRoomId, senderId, content, msgtype },
  });

  return { roomId: mapping.fluxychatRoomId, content, matrixEventId, senderId };
}

export async function syncMatrixOutbound(env, { bridgeId, projectId, fluxychatMessageId, matrixRoomId, content, msgtype }) {
  const mapping = await env.DB.prepare(
    "SELECT * FROM matrix_room_mappings WHERE bridge_id = ? AND matrix_room_id = ?"
  ).bind(bridgeId, matrixRoomId).first();

  if (!mapping) return { error: "no_mapping" };

  const existing = await findMatrixEvent(env, { fluxychatMessageId });
  if (existing) return { error: "already_synced" };

  await recordMatrixSyncLog(env, {
    bridgeId, projectId, eventType: "message", direction: "outbound",
    payload: { fluxychatMessageId, matrixRoomId, content, msgtype },
  });

  return { matrixRoomId, content, fluxychatMessageId, msgtype: msgtype || "m.text" };
}

export async function getMatrixBridgeStats(env, { projectId }) {
  const bridges = await env.DB.prepare(
    "SELECT status, COUNT(*) as count FROM matrix_bridge_configs WHERE project_id = ? GROUP BY status"
  ).bind(projectId).all();

  const messages = await env.DB.prepare(
    "SELECT direction, COUNT(*) as count FROM matrix_message_map WHERE project_id = ? GROUP BY direction"
  ).bind(projectId).all();

  const mappings = await env.DB.prepare(
    "SELECT COUNT(*) as cnt FROM matrix_room_mappings WHERE project_id = ?"
  ).bind(projectId).first();

  return {
    totalBridges: (bridges.results || []).reduce((s, b) => s + b.count, 0),
    byStatus: (bridges.results || []).map((b) => ({ status: b.status, count: b.count })),
    messages: (messages.results || []).map((m) => ({ direction: m.direction, count: m.count })),
    totalMappings: mappings?.cnt || 0,
  };
}

function mapConfigRow(row) {
  return {
    id: row.id, projectId: row.project_id, homeserverUrl: row.homeserver_url,
    accessToken: row.access_token ? "•••" : null, botUserId: row.bot_user_id,
    botDisplayName: row.bot_display_name, syncMode: row.sync_mode,
    status: row.status, settings: row.settings ? JSON.parse(row.settings) : null,
    lastSyncAt: row.last_sync_at, errorMessage: row.error_message,
    createdAt: row.created_at, updatedAt: row.updated_at,
  };
}

function mapMappingRow(row) {
  return {
    id: row.id, bridgeId: row.bridge_id, projectId: row.project_id,
    fluxychatRoomId: row.fluxychat_room_id, matrixRoomId: row.matrix_room_id,
    matrixSpaceId: row.matrix_space_id, syncReactions: row.sync_reactions === 1,
    syncAttachments: row.sync_attachments === 1, createdAt: row.created_at,
  };
}

function mapMessageRow(row) {
  return {
    id: row.id, bridgeId: row.bridge_id, projectId: row.project_id,
    fluxychatMessageId: row.fluxychat_message_id, matrixEventId: row.matrix_event_id,
    matrixRoomId: row.matrix_room_id, direction: row.direction, syncedAt: row.synced_at,
  };
}
