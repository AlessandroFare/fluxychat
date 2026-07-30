import { importAdminMessage } from "./message-import.js";
import { deriveScopedClientMessageId } from "./client-message-id.js";

function generateId() {
  return Array.from(crypto.getRandomValues(new Uint8Array(16)))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function createBridgeConfig(env, { projectId, platform, name, token, webhookUrl, botUserId, botDisplayName, settings }) {
  const id = `br_${generateId().slice(0, 12)}`;
  const now = new Date().toISOString();

  await env.DB.prepare(
    `INSERT INTO bridge_configs (id, project_id, platform, name, token, webhook_url, bot_user_id, bot_display_name, status, settings, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'disconnected', ?, ?, ?)`
  )
    .bind(id, projectId, platform, name, token || null, webhookUrl || null, botUserId || null, botDisplayName || null, settings ? JSON.stringify(settings) : null, now, now)
    .run();

  return { id, status: "disconnected" };
}

export async function connectBridge(env, { bridgeId }) {
  const now = new Date().toISOString();
  const result = await env.DB.prepare(
    "UPDATE bridge_configs SET status = 'connected', error_message = NULL, updated_at = ? WHERE id = ?"
  )
    .bind(now, bridgeId)
    .run();
  return { connected: result.meta?.changes || 0 };
}

export async function disconnectBridge(env, { bridgeId }) {
  const now = new Date().toISOString();
  const result = await env.DB.prepare(
    "UPDATE bridge_configs SET status = 'disconnected', updated_at = ? WHERE id = ?"
  )
    .bind(now, bridgeId)
    .run();
  return { disconnected: result.meta?.changes || 0 };
}

export async function setBridgeError(env, { bridgeId, errorMessage }) {
  const now = new Date().toISOString();
  await env.DB.prepare(
    "UPDATE bridge_configs SET status = 'error', error_message = ?, updated_at = ? WHERE id = ?"
  )
    .bind(errorMessage, now, bridgeId)
    .run();
}

export async function getBridgeConfig(env, { bridgeId }) {
  const row = await env.DB.prepare("SELECT * FROM bridge_configs WHERE id = ?").bind(bridgeId).first();
  return row ? mapConfigRow(row) : null;
}

export async function listBridgeConfigs(env, { projectId, platform }) {
  let sql = "SELECT * FROM bridge_configs WHERE project_id = ?";
  const params = [projectId];
  if (platform) { sql += " AND platform = ?"; params.push(platform); }
  sql += " ORDER BY created_at DESC";
  const rows = await env.DB.prepare(sql).bind(...params).all();
  return (rows.results || []).map(mapConfigRow);
}

export async function deleteBridgeConfig(env, { bridgeId }) {
  await env.DB.prepare("DELETE FROM bridge_channel_mappings WHERE bridge_id = ?").bind(bridgeId).run();
  await env.DB.prepare("DELETE FROM bridge_message_map WHERE bridge_id = ?").bind(bridgeId).run();
  const result = await env.DB.prepare("DELETE FROM bridge_configs WHERE id = ?").bind(bridgeId).run();
  return { deleted: result.meta?.changes || 0 };
}

export async function createChannelMapping(env, { bridgeId, projectId, fluxychatRoomId, externalChannelId, externalChannelName, syncDirection, syncReactions, syncAttachments, autoReply }) {
  const id = `bcm_${generateId().slice(0, 12)}`;
  const now = new Date().toISOString();

  await env.DB.prepare(
    `INSERT INTO bridge_channel_mappings (id, bridge_id, project_id, fluxychat_room_id, external_channel_id, external_channel_name, sync_direction, sync_reactions, sync_attachments, auto_reply, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(id, bridgeId, projectId, fluxychatRoomId, externalChannelId, externalChannelName || null,
      syncDirection || "both", syncReactions !== false ? 1 : 0, syncAttachments !== false ? 1 : 0, autoReply ? 1 : 0, now)
    .run();

  return { id };
}

export async function listChannelMappings(env, { bridgeId }) {
  const rows = await env.DB.prepare(
    "SELECT * FROM bridge_channel_mappings WHERE bridge_id = ? ORDER BY created_at ASC"
  )
    .bind(bridgeId)
    .all();
  return (rows.results || []).map(mapChannelRow);
}

export async function getChannelMappingByRoom(env, { roomId }) {
  const rows = await env.DB.prepare(
    "SELECT * FROM bridge_channel_mappings WHERE fluxychat_room_id = ?"
  )
    .bind(roomId)
    .all();
  return (rows.results || []).map(mapChannelRow);
}

export async function getChannelMappingByExternal(env, { bridgeId, externalChannelId }) {
  const row = await env.DB.prepare(
    "SELECT * FROM bridge_channel_mappings WHERE bridge_id = ? AND external_channel_id = ?"
  )
    .bind(bridgeId, externalChannelId)
    .first();
  return row ? mapChannelRow(row) : null;
}

export async function deleteChannelMapping(env, { mappingId }) {
  const result = await env.DB.prepare("DELETE FROM bridge_channel_mappings WHERE id = ?").bind(mappingId).run();
  return { deleted: result.meta?.changes || 0 };
}

export async function mapMessage(env, { bridgeId, projectId, fluxychatMessageId, externalMessageId, externalPlatform, externalChannelId, direction }) {
  const id = `bmm_${generateId().slice(0, 12)}`;
  const now = new Date().toISOString();

  await env.DB.prepare(
    `INSERT INTO bridge_message_map (id, bridge_id, project_id, fluxychat_message_id, external_message_id, external_platform, external_channel_id, direction, synced_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(id, bridgeId, projectId, fluxychatMessageId, externalMessageId, externalPlatform, externalChannelId, direction, now)
    .run();

  return { id };
}

export async function findExternalMessage(env, { fluxychatMessageId }) {
  const row = await env.DB.prepare(
    "SELECT * FROM bridge_message_map WHERE fluxychat_message_id = ?"
  )
    .bind(fluxychatMessageId)
    .first();
  return row ? mapMessageRow(row) : null;
}

export async function findFluxychatMessage(env, { externalMessageId }) {
  const row = await env.DB.prepare(
    "SELECT * FROM bridge_message_map WHERE external_message_id = ?"
  )
    .bind(externalMessageId)
    .first();
  return row ? mapMessageRow(row) : null;
}

export async function recordBridgeEvent(env, { bridgeId, projectId, eventType, direction, payload, status }) {
  const id = `be_${generateId().slice(0, 12)}`;
  const now = new Date().toISOString();
  await env.DB.prepare(
    "INSERT INTO bridge_events (id, bridge_id, project_id, event_type, direction, payload, status, recorded_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
  )
    .bind(id, bridgeId, projectId, eventType, direction || null, payload ? JSON.stringify(payload) : null, status || "success", now)
    .run();
  return { id };
}

export async function getBridgeStats(env, { projectId }) {
  const configs = await env.DB.prepare(
    "SELECT platform, status, COUNT(*) as count FROM bridge_configs WHERE project_id = ? GROUP BY platform, status"
  )
    .bind(projectId)
    .all();

  const messages = await env.DB.prepare(
    "SELECT direction, COUNT(*) as count FROM bridge_message_map WHERE project_id = ? GROUP BY direction"
  )
    .bind(projectId)
    .all();

  const mappings = await env.DB.prepare(
    "SELECT COUNT(*) as cnt FROM bridge_channel_mappings WHERE project_id = ?"
  )
    .bind(projectId)
    .first();

  return {
    bridges: (configs.results || []).map((c) => ({ platform: c.platform, status: c.status, count: c.count })),
    messages: (messages.results || []).map((m) => ({ direction: m.direction, count: m.count })),
    totalMappings: mappings?.cnt || 0,
  };
}

export async function syncInboundMessage(env, {
  bridgeId,
  projectId,
  platform,
  externalMessageId,
  externalChannelId,
  externalUserId,
  externalUsername,
  content,
  timestamp,
}) {
  const mapping = await getChannelMappingByExternal(env, { bridgeId, externalChannelId });
  if (!mapping) return { error: "no_mapping" };
  if (mapping.syncDirection === "outbound") return { error: "inbound_disabled" };

  const existing = await findFluxychatMessage(env, { externalMessageId });
  if (existing) return { error: "already_synced", messageId: existing.fluxychatMessageId };

  const bridge = platform ? null : await getBridgeConfig(env, { bridgeId });
  const platformName = platform || bridge?.platform || "bridge";
  const userId = externalUserId || `${platformName}-bridge`;

  const imported = await importAdminMessage(env, {
    projectId,
    roomId: mapping.fluxychatRoomId,
    content,
    userId,
    createdAt: timestamp,
    clientMessageId: deriveScopedClientMessageId(platformName, externalMessageId),
    importedBy: `${platformName}-bridge`,
  });
  if (imported.error) {
    await recordBridgeEvent(env, {
      bridgeId,
      projectId,
      eventType: "message_sync",
      direction: "inbound",
      payload: { externalMessageId, externalChannelId, externalUserId, externalUsername, content, error: imported.error },
      status: "error",
    });
    return imported;
  }
  if (imported.skipped) {
    await mapMessage(env, {
      bridgeId,
      projectId,
      fluxychatMessageId: String(imported.messageId),
      externalMessageId,
      externalPlatform: platformName,
      externalChannelId,
      direction: "inbound",
    }).catch(() => {});
    return {
      roomId: mapping.fluxychatRoomId,
      content,
      externalMessageId,
      externalUserId,
      externalUsername,
      messageId: imported.messageId,
      skipped: true,
    };
  }

  await mapMessage(env, {
    bridgeId,
    projectId,
    fluxychatMessageId: String(imported.messageId),
    externalMessageId,
    externalPlatform: platformName,
    externalChannelId,
    direction: "inbound",
  });

  await recordBridgeEvent(env, {
    bridgeId,
    projectId,
    eventType: "message_sync",
    direction: "inbound",
    payload: {
      externalMessageId,
      externalChannelId,
      externalUserId,
      externalUsername,
      content,
      messageId: imported.messageId,
    },
  });

  return {
    roomId: mapping.fluxychatRoomId,
    content,
    externalMessageId,
    externalUserId,
    externalUsername,
    messageId: imported.messageId,
  };
}

export async function syncOutboundMessage(env, { bridgeId, projectId, fluxychatMessageId, externalChannelId, content }) {
  const mapping = await getChannelMappingByExternal(env, { bridgeId, externalChannelId });
  if (!mapping) return { error: "no_mapping" };
  if (mapping.projectId !== projectId) return { error: "forbidden" };
  if (mapping.syncDirection === "inbound") return { error: "outbound_disabled" };

  const existing = await findExternalMessage(env, { fluxychatMessageId });
  if (existing) return { error: "already_synced" };

  await recordBridgeEvent(env, {
    bridgeId, projectId, eventType: "message_sync", direction: "outbound",
    payload: { fluxychatMessageId, externalChannelId, content },
  });

  return { externalChannelId, content, fluxychatMessageId };
}

function mapConfigRow(row) {
  return {
    id: row.id, projectId: row.project_id, platform: row.platform,
    name: row.name, token: row.token ? "•••" : null, webhookUrl: row.webhook_url,
    botUserId: row.bot_user_id, botDisplayName: row.bot_display_name,
    status: row.status, settings: row.settings ? JSON.parse(row.settings) : null,
    lastSyncAt: row.last_sync_at, errorMessage: row.error_message,
    createdAt: row.created_at, updatedAt: row.updated_at,
  };
}

function mapChannelRow(row) {
  return {
    id: row.id, bridgeId: row.bridge_id, projectId: row.project_id,
    fluxychatRoomId: row.fluxychat_room_id, externalChannelId: row.external_channel_id,
    externalChannelName: row.external_channel_name, syncDirection: row.sync_direction,
    syncReactions: row.sync_reactions === 1, syncAttachments: row.sync_attachments === 1,
    autoReply: row.auto_reply === 1, createdAt: row.created_at,
  };
}

function mapMessageRow(row) {
  return {
    id: row.id, bridgeId: row.bridge_id, projectId: row.project_id,
    fluxychatMessageId: row.fluxychat_message_id, externalMessageId: row.external_message_id,
    externalPlatform: row.external_platform, externalChannelId: row.external_channel_id,
    direction: row.direction, syncedAt: row.synced_at,
  };
}
