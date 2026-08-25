import { importAdminMessage } from "./message-import.js";
import { deriveScopedClientMessageId } from "./client-message-id.js";
import { appendRoomAuditChainEvent } from "./audit-chain.js";
import { safeOutboundFetch } from "./url-ssrf.js";

function generateId() {
  return Array.from(crypto.getRandomValues(new Uint8Array(16)))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function generateAppserviceToken() {
  return `as_${generateId().slice(0, 24)}`;
}

export function extractBearerTokenFromRequest(request) {
  const auth = String(request.headers.get("Authorization") || "");
  const match = auth.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : "";
}

export function verifyMatrixAppserviceToken(provided, expected) {
  if (!expected || !provided) return false;
  if (provided.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i += 1) {
    diff |= provided.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return diff === 0;
}

export async function getMatrixBridgeAppserviceToken(env, { bridgeId, projectId }) {
  const row = await env.DB.prepare(
    "SELECT appservice_token FROM matrix_bridge_configs WHERE id = ? AND project_id = ?",
  )
    .bind(bridgeId, projectId)
    .first();
  const token = row?.appservice_token;
  return typeof token === "string" && token.trim() ? token.trim() : null;
}

export async function rotateMatrixAppserviceToken(env, { bridgeId, projectId }) {
  const bridge = await getMatrixBridge(env, { bridgeId });
  if (!bridge || bridge.projectId !== projectId) return { error: "not_found" };
  const token = generateAppserviceToken();
  const now = new Date().toISOString();
  await env.DB.prepare(
    "UPDATE matrix_bridge_configs SET appservice_token = ?, updated_at = ? WHERE id = ? AND project_id = ?",
  )
    .bind(token, now, bridgeId, projectId)
    .run();
  return { appserviceToken: token, bridgeId };
}

export async function verifyMatrixAppserviceWebhook(env, request, { bridgeId, projectId }) {
  const expected = await getMatrixBridgeAppserviceToken(env, { bridgeId, projectId });
  if (!expected) return { ok: false, error: "appservice_token_not_configured" };
  const provided = extractBearerTokenFromRequest(request);
  if (!verifyMatrixAppserviceToken(provided, expected)) {
    return { ok: false, error: "invalid_appservice_token" };
  }
  return { ok: true };
}

function matrixTimestampToIso(originServerTs) {
  if (!originServerTs) return new Date().toISOString();
  const ms = Number(originServerTs);
  if (!Number.isFinite(ms)) return new Date().toISOString();
  return new Date(ms).toISOString();
}

function extractMatrixTextContent(content, msgtype) {
  if (!content || typeof content !== "object") return null;
  const type = msgtype || content.msgtype || "m.text";
  if (type !== "m.text" && type !== "m.notice") return null;
  const body = content.body;
  return typeof body === "string" && body.length ? body : null;
}

export async function createMatrixBridge(env, { projectId, homeserverUrl, accessToken, botUserId, botDisplayName, syncMode, settings, appserviceToken }) {
  const id = `mb_${generateId().slice(0, 12)}`;
  const now = new Date().toISOString();
  const token = String(appserviceToken || "").trim() || generateAppserviceToken();
  await env.DB.prepare(
    `INSERT INTO matrix_bridge_configs (id, project_id, homeserver_url, access_token, bot_user_id, bot_display_name, sync_mode, status, settings, appservice_token, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'disconnected', ?, ?, ?, ?)`
  )
    .bind(id, projectId, homeserverUrl, accessToken || null, botUserId || null, botDisplayName || null, syncMode || "bidirectional", settings ? JSON.stringify(settings) : null, token, now, now)
    .run();
  return { id, status: "disconnected", appserviceToken: token, appserviceWebhookPath: `/webhooks/matrix/${id}` };
}

export async function pingMatrixHomeserver({ homeserverUrl, accessToken }) {
  const base = String(homeserverUrl || "").replace(/\/$/, "");
  if (!base) return { ok: false, error: "missing_homeserver" };
  try {
    const headers = accessToken ? { Authorization: `Bearer ${accessToken}` } : {};
    // SECURITY: `homeserverUrl` is tenant-supplied bridge configuration, so this
    // is a user-controlled outbound request. Without the guard a tenant could
    // point a bridge at 169.254.169.254 or an internal address and use the
    // health check as an SSRF probe — and the response body is returned to them.
    const res = await safeOutboundFetch(`${base}/_matrix/client/versions`, {
      headers,
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return { ok: false, error: `http_${res.status}`, status: res.status };
    const body = await res.json().catch(() => ({}));
    return { ok: true, status: res.status, versions: body?.versions ?? [] };
  } catch (err) {
    return { ok: false, error: err?.message || "network_error" };
  }
}

export async function connectMatrixBridge(env, { bridgeId, skipHealthCheck = false }) {
  const bridge = await getMatrixBridge(env, { bridgeId });
  if (!bridge) return { connected: 0, error: "not_found" };

  if (!skipHealthCheck) {
    const creds = await getMatrixBridgeCredentials(env, {
      bridgeId,
      projectId: bridge.projectId,
    });
    const health = await pingMatrixHomeserver({
      homeserverUrl: creds?.homeserverUrl ?? bridge.homeserverUrl,
      accessToken: creds?.accessToken ?? undefined,
    });
    if (!health.ok) {
      const now = new Date().toISOString();
      await env.DB.prepare(
        "UPDATE matrix_bridge_configs SET status = 'error', error_message = ?, updated_at = ? WHERE id = ?",
      )
        .bind(health.error || "health_check_failed", now, bridgeId)
        .run();
      return { connected: 0, error: health.error, health };
    }
  }

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

/** Server-side bridge row with credentials (never return to clients). */
export async function getMatrixBridgeCredentials(env, { bridgeId, projectId }) {
  const row = await env.DB.prepare(
    "SELECT * FROM matrix_bridge_configs WHERE id = ? AND project_id = ?",
  )
    .bind(bridgeId, projectId)
    .first();
  if (!row) return null;
  return {
    id: row.id,
    projectId: row.project_id,
    homeserverUrl: row.homeserver_url,
    accessToken: row.access_token,
    botUserId: row.bot_user_id,
    status: row.status,
  };
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

  if (projectId) {
    void appendRoomAuditChainEvent(env, {
      projectId,
      event: {
        type: "matrix_sync",
        bridgeId,
        eventType,
        direction: direction || null,
        status: status || "success",
      },
    }).catch(() => {});
  }

  return { id };
}

export async function syncMatrixInbound(env, {
  bridgeId,
  projectId,
  matrixEventId,
  matrixRoomId,
  senderId,
  content,
  msgtype,
  originServerTs,
}) {
  const mapping = await getMatrixMappingByMatrixRoom(env, { bridgeId, matrixRoomId });
  if (!mapping) return { error: "no_mapping" };

  const existing = await findFluxyMessageByMatrix(env, { matrixEventId });
  if (existing) return { error: "already_synced", messageId: existing.fluxychatMessageId };

  const imported = await importAdminMessage(env, {
    projectId,
    roomId: mapping.fluxychatRoomId,
    content,
    userId: senderId || "matrix-bridge",
    createdAt: matrixTimestampToIso(originServerTs),
    clientMessageId: deriveScopedClientMessageId("matrix", matrixEventId),
    importedBy: "matrix-bridge",
  });
  if (imported.error) {
    await recordMatrixSyncLog(env, {
      bridgeId,
      projectId,
      eventType: "message",
      direction: "inbound",
      payload: { matrixEventId, matrixRoomId, senderId, content, msgtype, error: imported.error },
      status: "error",
    });
    return imported;
  }
  if (imported.skipped) {
    await mapMatrixMessage(env, {
      bridgeId,
      projectId,
      fluxychatMessageId: String(imported.messageId),
      matrixEventId,
      matrixRoomId,
      direction: "inbound",
    }).catch(() => {});
    return {
      roomId: mapping.fluxychatRoomId,
      content,
      matrixEventId,
      senderId,
      messageId: imported.messageId,
      skipped: true,
    };
  }

  await mapMatrixMessage(env, {
    bridgeId,
    projectId,
    fluxychatMessageId: String(imported.messageId),
    matrixEventId,
    matrixRoomId,
    direction: "inbound",
  });

  await recordMatrixSyncLog(env, {
    bridgeId,
    projectId,
    eventType: "message",
    direction: "inbound",
    payload: { matrixEventId, matrixRoomId, senderId, content, msgtype, messageId: imported.messageId },
  });

  return {
    roomId: mapping.fluxychatRoomId,
    content,
    matrixEventId,
    senderId,
    messageId: imported.messageId,
  };
}

export async function processMatrixAppserviceTransaction(env, { bridgeId, projectId, transaction }) {
  const events = Array.isArray(transaction?.events) ? transaction.events : [];
  const processed = [];
  const ignored = [];

  for (const event of events) {
    if (!event || event.type !== "m.room.message") {
      ignored.push({ eventId: event?.event_id, reason: "not_message" });
      continue;
    }
    const content = extractMatrixTextContent(event.content, event.content?.msgtype);
    if (!content) {
      ignored.push({ eventId: event.event_id, reason: "unsupported_msgtype" });
      continue;
    }

    const result = await syncMatrixInbound(env, {
      bridgeId,
      projectId,
      matrixEventId: event.event_id,
      matrixRoomId: event.room_id,
      senderId: event.sender,
      content,
      msgtype: event.content?.msgtype,
      originServerTs: event.origin_server_ts,
    });

    if (result.error === "already_synced") {
      ignored.push({ eventId: event.event_id, reason: "already_synced" });
      continue;
    }
    if (result.error) {
      return { error: result.error, processed, ignored, failedEventId: event.event_id };
    }
    processed.push({
      eventId: event.event_id,
      messageId: result.messageId,
      roomId: result.roomId,
      skipped: result.skipped === true,
    });
  }

  return { ok: true, processed, ignored, count: processed.length };
}

export async function syncMatrixOutbound(env, { bridgeId, projectId, fluxychatMessageId, matrixRoomId, content, msgtype, maxAttempts = 2 }) {
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

  const bridge = await env.DB.prepare(
    "SELECT homeserver_url, access_token FROM matrix_bridge_configs WHERE id = ? AND project_id = ?",
  ).bind(bridgeId, projectId).first();

  const base = typeof bridge?.homeserver_url === "string" ? bridge.homeserver_url.replace(/\/$/, "") : "";
  const token = typeof bridge?.access_token === "string" ? bridge.access_token.trim() : "";

  if (base && token) {
    const txnId = String(fluxychatMessageId).replace(/[^a-zA-Z0-9._~-]/g, "_").slice(0, 64)
      || `fc_${Date.now()}`;
    const sendUrl = `${base}/_matrix/client/v3/rooms/${encodeURIComponent(matrixRoomId)}/send/m.room.message/${encodeURIComponent(txnId)}`;
    let lastError = null;

    for (let attempt = 1; attempt <= Math.max(1, maxAttempts); attempt++) {
      try {
        // SECURITY: `base` comes from the tenant's stored bridge configuration.
        // Guarded so a bridge cannot be pointed at internal infrastructure to
        // relay message content out of the private network.
        const res = await safeOutboundFetch(sendUrl, {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            msgtype: msgtype || "m.text",
            body: content,
          }),
          signal: AbortSignal.timeout(12000),
        });
        if (!res.ok) {
          const detail = await res.text().catch(() => "");
          lastError = {
            error: "homeserver_send_failed",
            status: res.status,
            detail: detail.slice(0, 500),
            attempt,
          };
          if (attempt < maxAttempts) {
            await new Promise((r) => setTimeout(r, 400 * attempt));
            continue;
          }
          return lastError;
        }
        const body = await res.json().catch(() => ({}));
        const matrixEventId = body?.event_id;
        if (matrixEventId) {
          await mapMatrixMessage(env, {
            bridgeId,
            projectId,
            fluxychatMessageId,
            matrixEventId,
            matrixRoomId,
            direction: "outbound",
          });
        }
        return {
          matrixRoomId,
          content,
          fluxychatMessageId,
          msgtype: msgtype || "m.text",
          matrixEventId: matrixEventId || null,
          sent: true,
          attempts: attempt,
        };
      } catch (err) {
        lastError = {
          error: "homeserver_send_failed",
          detail: err instanceof Error ? err.message : String(err),
          attempt,
        };
        if (attempt < maxAttempts) {
          await new Promise((r) => setTimeout(r, 400 * attempt));
          continue;
        }
      }
    }
    return lastError ?? { error: "homeserver_send_failed" };
  }

  return { matrixRoomId, content, fluxychatMessageId, msgtype: msgtype || "m.text", sent: false, queued: true };
}

/**
 * Ping all connected bridges; mark unhealthy bridges as error (production ops cron).
 */
export async function runMatrixBridgeHealthChecks(env, { projectId } = {}) {
  const sql = projectId
    ? "SELECT id, project_id, homeserver_url, access_token, status FROM matrix_bridge_configs WHERE project_id = ? AND status = 'connected'"
    : "SELECT id, project_id, homeserver_url, access_token, status FROM matrix_bridge_configs WHERE status = 'connected'";
  const rows = await env.DB.prepare(sql)
    .bind(...(projectId ? [projectId] : []))
    .all();

  const now = new Date().toISOString();
  let healthy = 0;
  let unhealthy = 0;
  const results = [];

  for (const row of rows.results || []) {
    const health = await pingMatrixHomeserver({
      homeserverUrl: row.homeserver_url,
      accessToken: row.access_token ?? undefined,
    });
    if (health.ok) {
      healthy++;
      results.push({ bridgeId: row.id, ok: true });
      continue;
    }
    unhealthy++;
    await env.DB.prepare(
      "UPDATE matrix_bridge_configs SET status = 'error', error_message = ?, updated_at = ? WHERE id = ?",
    )
      .bind(health.error || "health_check_failed", now, row.id)
      .run();
    await recordMatrixSyncLog(env, {
      bridgeId: row.id,
      projectId: row.project_id,
      eventType: "health_check",
      direction: "inbound",
      payload: { ok: false, error: health.error },
      status: "error",
    }).catch(() => {});
    results.push({ bridgeId: row.id, ok: false, error: health.error });
  }

  return { ok: true, checked: results.length, healthy, unhealthy, results };
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
    appserviceTokenConfigured: Boolean(row.appservice_token),
    appserviceWebhookPath: `/webhooks/matrix/${row.id}`,
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
