import { importAdminMessage } from "./message-import.js";
import { deriveScopedClientMessageId } from "./client-message-id.js";
import { encryptSecret, decryptSecret } from "./secrets-crypto.js";
import { enqueueBridgeDelivery, processPendingBridgeDeliveries } from "./bridge-delivery.js";

function generateId() {
  return Array.from(crypto.getRandomValues(new Uint8Array(16)))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function parseSettingsSafely(raw) {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function createBridgeConfig(env, { projectId, platform, name, token, webhookUrl, botUserId, botDisplayName, settings, signingSecret }) {
  const id = `br_${generateId().slice(0, 12)}`;
  const now = new Date().toISOString();

  // Secrets encrypted at rest (AES-GCM, same key as webhook secrets) when
  // WEBHOOK_SECRET_ENCRYPTION_KEY is set; plaintext fallback for local dev only.
  let tokenPlain = token || null;
  let tokenCiphertext = null;
  let tokenIv = null;
  if (token) {
    const enc = await encryptSecret(env, token);
    if (enc) {
      tokenPlain = null;
      tokenCiphertext = enc.ciphertext;
      tokenIv = enc.iv;
    }
  }

  const settingsObj = settings && typeof settings === "object" ? { ...settings } : null;
  if (settingsObj) {
    delete settingsObj.signingSecret;
    delete settingsObj.publicKey;
  }
  let signingCiphertext = null;
  let signingIv = null;
  if (signingSecret) {
    const enc = await encryptSecret(env, signingSecret);
    if (enc) {
      signingCiphertext = enc.ciphertext;
      signingIv = enc.iv;
    } else if (settingsObj) {
      // shortcut: plaintext fallback when no encryption key is configured (local dev); upgrade when REQUIRE env ships for bridges
      settingsObj.signingSecret = signingSecret;
    }
  }

  await env.DB.prepare(
    `INSERT INTO bridge_configs (id, project_id, platform, name, token, token_ciphertext, token_iv, webhook_url, bot_user_id, bot_display_name, status, settings, signing_secret_ciphertext, signing_secret_iv, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'disconnected', ?, ?, ?, ?, ?)`
  )
    .bind(id, projectId, platform, name, tokenPlain, tokenCiphertext, tokenIv, webhookUrl || null, botUserId || null, botDisplayName || null, settingsObj ? JSON.stringify(settingsObj) : null, signingCiphertext, signingIv, now, now)
    .run();

  return { id, status: "disconnected" };
}

/**
 * Decrypted signing secret (Slack) or application public key (Discord) for inbound verification.
 */
export async function getBridgeSigningSecret(env, { bridgeId }) {
  const row = await env.DB.prepare(
    "SELECT settings, signing_secret_ciphertext, signing_secret_iv FROM bridge_configs WHERE id = ?"
  ).bind(bridgeId).first();
  if (!row) return null;
  if (row.signing_secret_ciphertext && row.signing_secret_iv) {
    const decrypted = await decryptSecret(env, row.signing_secret_ciphertext, row.signing_secret_iv);
    if (decrypted) return decrypted;
  }
  const settings = parseSettingsSafely(row.settings);
  return settings?.signingSecret || settings?.publicKey || null;
}

/**
 * Update identity/secrets of an existing bridge (set-only; secrets are replaced, not merged).
 */
export async function updateBridgeConfig(env, { bridgeId, name, token, signingSecret, webhookUrl, botUserId, botDisplayName }) {
  const updates = [];
  const binds = [];

  if (typeof name === "string" && name.trim()) {
    updates.push("name = ?");
    binds.push(name.trim());
  }
  if (typeof token === "string" && token) {
    const enc = await encryptSecret(env, token);
    if (enc) {
      updates.push("token = NULL", "token_ciphertext = ?", "token_iv = ?");
      binds.push(enc.ciphertext, enc.iv);
    } else {
      updates.push("token = ?", "token_ciphertext = NULL", "token_iv = NULL");
      binds.push(token);
    }
  }
  if (typeof signingSecret === "string" && signingSecret) {
    const enc = await encryptSecret(env, signingSecret);
    if (enc) {
      updates.push("signing_secret_ciphertext = ?", "signing_secret_iv = ?");
      binds.push(enc.ciphertext, enc.iv);
    } else {
      const row = await env.DB.prepare("SELECT settings FROM bridge_configs WHERE id = ?").bind(bridgeId).first();
      const settings = parseSettingsSafely(row?.settings) || {};
      settings.signingSecret = signingSecret;
      updates.push("settings = ?");
      binds.push(JSON.stringify(settings));
    }
  }
  if (typeof webhookUrl === "string") {
    updates.push("webhook_url = ?");
    binds.push(webhookUrl || null);
  }
  if (typeof botUserId === "string") {
    updates.push("bot_user_id = ?");
    binds.push(botUserId || null);
  }
  if (typeof botDisplayName === "string") {
    updates.push("bot_display_name = ?");
    binds.push(botDisplayName || null);
  }
  if (!updates.length) return { updated: 0 };

  updates.push("updated_at = ?");
  binds.push(new Date().toISOString(), bridgeId);
  const result = await env.DB.prepare(`UPDATE bridge_configs SET ${updates.join(", ")} WHERE id = ?`)
    .bind(...binds)
    .run();
  return { updated: result.meta?.changes || 0 };
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
  await env.DB.prepare("DELETE FROM bridge_deliveries WHERE bridge_id = ?").bind(bridgeId).run();
  const result = await env.DB.prepare("DELETE FROM bridge_configs WHERE id = ?").bind(bridgeId).run();
  return { deleted: result.meta?.changes || 0 };
}

export async function createChannelMapping(env, { bridgeId, projectId, fluxychatRoomId, externalChannelId, externalChannelName, syncDirection, syncReactions, syncAttachments, autoReply }) {
  const id = `bcm_${generateId().slice(0, 12)}`;
  const now = new Date().toISOString();
  // The dashboard historically sent "bidirectional"; the schema CHECK allows "both".
  const direction = syncDirection === "inbound" || syncDirection === "outbound" ? syncDirection : "both";

  await env.DB.prepare(
    `INSERT INTO bridge_channel_mappings (id, bridge_id, project_id, fluxychat_room_id, external_channel_id, external_channel_name, sync_direction, sync_reactions, sync_attachments, auto_reply, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(id, bridgeId, projectId, fluxychatRoomId, externalChannelId, externalChannelName || null,
      direction, syncReactions !== false ? 1 : 0, syncAttachments !== false ? 1 : 0, autoReply ? 1 : 0, now)
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
  if (!content || typeof content !== "string") return { error: "content_required" };

  const queued = await enqueueBridgeDelivery(env, {
    bridgeId,
    projectId,
    fluxychatMessageId,
    externalChannelId,
    content,
  });
  await processPendingBridgeDeliveries(env);
  const delivery = await env.DB.prepare(
    "SELECT status, attempt_count, last_http_status, last_error FROM bridge_deliveries WHERE id = ?"
  ).bind(queued.id).first();

  return { externalChannelId, content, fluxychatMessageId, delivery: delivery || null };
}

function mapConfigRow(row) {
  const settings = parseSettingsSafely(row.settings);
  let hasSigningSecret = Boolean(row.signing_secret_ciphertext);
  if (settings && (settings.signingSecret || settings.publicKey)) {
    hasSigningSecret = true;
    delete settings.signingSecret;
    delete settings.publicKey;
  }
  return {
    id: row.id, projectId: row.project_id, platform: row.platform,
    name: row.name, token: row.token || row.token_ciphertext ? "•••" : null, webhookUrl: row.webhook_url,
    botUserId: row.bot_user_id, botDisplayName: row.bot_display_name,
    status: row.status, settings, hasSigningSecret,
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
