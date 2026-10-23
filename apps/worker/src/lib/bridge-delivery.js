/**
 * Bridge outbound delivery: room messages → Slack / Discord platform APIs,
 * with the same pending-queue + retry model as webhook-delivery.js.
 */
import { decryptSecret } from "./secrets-crypto.js";
import { safeOutboundFetch } from "./url-ssrf.js";
import { retryDelayMsForAttempt } from "./webhook-delivery.js";
import { incrementOperationalMetric } from "./operational-metrics.js";
import { safeJsonParse, truncateForStorage } from "./storage-utils.js";

const DEFAULT_MAX_ATTEMPTS = 5;

function generateId() {
  return Array.from(crypto.getRandomValues(new Uint8Array(16)))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function enqueueBridgeDelivery(env, { bridgeId, projectId, fluxychatMessageId, externalChannelId, content }) {
  const id = `bd_${generateId().slice(0, 12)}`;
  const now = new Date().toISOString();
  await env.DB.prepare(
    `INSERT INTO bridge_deliveries (id, project_id, bridge_id, fluxychat_message_id, external_channel_id, payload, status, attempt_count, next_attempt_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, 'pending', 0, ?, ?, ?)`
  )
    .bind(
      id,
      projectId,
      bridgeId,
      fluxychatMessageId != null ? String(fluxychatMessageId) : null,
      externalChannelId,
      JSON.stringify({ content }),
      now, now, now
    )
    .run();
  return { id };
}

/**
 * Called from the Room Durable Object after a message is persisted.
 * Queues one delivery per outbound/bidirectional channel mapping of the room.
 */
export async function enqueueRoomBridgeOutbound(env, { projectId, roomId, messageId, content, clientMessageId }) {
  if (!projectId || !roomId || !messageId || !content) return { queued: 0 };
  const mappings = await env.DB.prepare(
    "SELECT bridge_id, external_channel_id, sync_direction FROM bridge_channel_mappings WHERE fluxychat_room_id = ? AND project_id = ?"
  ).bind(roomId, projectId).all();
  const candidates = (mappings.results || []).filter(
    (m) => m.sync_direction === "both" || m.sync_direction === "outbound",
  );
  if (!candidates.length) return { queued: 0 };

  const bridgeIds = [...new Set(candidates.map((m) => m.bridge_id))];
  const bridges = await env.DB.prepare(
    `SELECT id, platform, status FROM bridge_configs WHERE id IN (${bridgeIds.map(() => "?").join(",")})`,
  ).bind(...bridgeIds).all();
  const byId = new Map((bridges.results || []).map((b) => [b.id, b]));

  // Loop guard: messages imported from an external platform carry a
  // platform-scoped client id (client-message-id.js). Never echo them back.
  const scoped = String(clientMessageId || "");
  let queued = 0;
  for (const m of candidates) {
    const bridge = byId.get(m.bridge_id);
    if (!bridge || bridge.status === "disconnected") continue;
    if (scoped && scoped.startsWith(`${bridge.platform}_`)) continue;
    await enqueueBridgeDelivery(env, {
      bridgeId: m.bridge_id,
      projectId,
      fluxychatMessageId: messageId,
      externalChannelId: m.external_channel_id,
      content,
    });
    queued += 1;
  }
  return { queued };
}

export async function processPendingBridgeDeliveries(env, maxBatch = 20) {
  const now = new Date().toISOString();
  const pending = await env.DB.prepare(
    "SELECT * FROM bridge_deliveries WHERE status = 'pending' AND next_attempt_at <= ? ORDER BY next_attempt_at ASC LIMIT ?"
  )
    .bind(now, maxBatch)
    .all();
  const rows = pending.results || [];
  if (!rows.length) return { processed: 0 };

  const bridgeIds = [...new Set(rows.map((r) => r.bridge_id))];
  const cfgRes = await env.DB.prepare(
    `SELECT * FROM bridge_configs WHERE id IN (${bridgeIds.map(() => "?").join(",")})`,
  ).bind(...bridgeIds).all();
  const cfgs = new Map((cfgRes.results || []).map((c) => [c.id, c]));

  const msgIds = [...new Set(rows.map((r) => r.fluxychat_message_id).filter(Boolean))];
  const clientById = new Map();
  if (msgIds.length) {
    const msgRes = await env.DB.prepare(
      `SELECT id, client_message_id FROM messages WHERE id IN (${msgIds.map(() => "?").join(",")})`,
    ).bind(...msgIds).all();
    for (const m of msgRes.results || []) clientById.set(String(m.id), m.client_message_id);
  }

  await Promise.all(
    rows.map((d) =>
      attemptBridgeDelivery(env, d, cfgs.get(d.bridge_id), clientById.get(String(d.fluxychat_message_id)), now),
    ),
  );
  return { processed: rows.length };
}

async function attemptBridgeDelivery(env, d, cfg, clientMessageId, now) {
  if (!cfg) return finishTerminal(env, d, now, null, "bridge_deleted");

  const payload = safeJsonParse(d.payload) || {};
  const content = typeof payload.content === "string" ? payload.content : "";
  if (!content) return finishTerminal(env, d, now, null, "empty_payload");

  const scoped = String(clientMessageId || "");
  if (scoped && scoped.startsWith(`${cfg.platform}_`)) {
    return markSkipped(env, d, now, "external_origin");
  }
  const already = await env.DB.prepare(
    "SELECT id FROM bridge_message_map WHERE fluxychat_message_id = ? LIMIT 1"
  ).bind(String(d.fluxychat_message_id)).first();
  if (already) return markSkipped(env, d, now, "already_synced");

  let token = cfg.token || null;
  if (!token && cfg.token_ciphertext && cfg.token_iv) {
    token = await decryptSecret(env, cfg.token_ciphertext, cfg.token_iv);
  }

  const attemptNumber = Number(d.attempt_count || 0) + 1;
  let result;
  try {
    if (cfg.platform === "slack") {
      result = await deliverToSlack(cfg, token, d.external_channel_id, content);
    } else if (cfg.platform === "discord") {
      result = await deliverToDiscord(cfg, token, d.external_channel_id, content);
    } else {
      result = { ok: false, errorText: `unsupported_platform:${cfg.platform}` };
    }
  } catch (err) {
    result = { ok: false, errorText: err instanceof Error ? err.message : "delivery_failed" };
  }

  if (result.ok) {
    await env.DB.prepare(
      "UPDATE bridge_deliveries SET status = 'delivered', attempt_count = ?, last_http_status = ?, last_error = NULL, delivered_at = ?, updated_at = ? WHERE id = ?"
    ).bind(attemptNumber, result.httpStatus ?? null, now, now, d.id).run();
    if (result.externalMessageId && d.fluxychat_message_id) {
      await env.DB.prepare(
        `INSERT INTO bridge_message_map (id, bridge_id, project_id, fluxychat_message_id, external_message_id, external_platform, external_channel_id, direction, synced_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'outbound', ?)`
      ).bind(
        `bmm_${generateId().slice(0, 12)}`,
        d.bridge_id,
        d.project_id,
        String(d.fluxychat_message_id),
        String(result.externalMessageId),
        cfg.platform,
        d.external_channel_id,
        now
      ).run().catch(() => {});
    }
    await env.DB.prepare(
      "UPDATE bridge_configs SET last_sync_at = ?, error_message = NULL, updated_at = ? WHERE id = ?"
    ).bind(now, now, d.bridge_id).run().catch(() => {});
    return;
  }

  await incrementOperationalMetric(env, {
    metricName: "bridge_delivery_failed",
    projectId: d.project_id || "default",
    value: 1,
  }).catch(() => {});

  const maxAttempts = Number(env.BRIDGE_MAX_ATTEMPTS || DEFAULT_MAX_ATTEMPTS);
  const errorText = truncateForStorage(result.errorText || "delivery_failed");
  if (attemptNumber >= maxAttempts) {
    await finishTerminal(env, d, now, result.httpStatus ?? null, errorText, attemptNumber);
    await env.DB.prepare(
      "UPDATE bridge_configs SET error_message = ?, updated_at = ? WHERE id = ?"
    ).bind(errorText, now, d.bridge_id).run().catch(() => {});
    return;
  }

  const retryAt = new Date(Date.now() + retryDelayMsForAttempt(attemptNumber)).toISOString();
  await env.DB.prepare(
    "UPDATE bridge_deliveries SET attempt_count = ?, next_attempt_at = ?, last_http_status = ?, last_error = ?, updated_at = ? WHERE id = ?"
  ).bind(attemptNumber, retryAt, result.httpStatus ?? null, errorText, now, d.id).run();
}

async function markSkipped(env, d, now, reason) {
  await env.DB.prepare(
    "UPDATE bridge_deliveries SET status = 'skipped', last_error = ?, updated_at = ? WHERE id = ?"
  ).bind(reason, now, d.id).run();
}

async function finishTerminal(env, d, now, httpStatus, errorText, attemptNumber) {
  await env.DB.prepare(
    "UPDATE bridge_deliveries SET status = 'failed', attempt_count = ?, last_http_status = ?, last_error = ?, updated_at = ? WHERE id = ?"
  ).bind(
    attemptNumber ?? Number(d.attempt_count || 0) + 1,
    httpStatus,
    truncateForStorage(errorText),
    now,
    d.id
  ).run();
}

async function deliverToSlack(cfg, token, channelId, content) {
  if (token) {
    const res = await safeOutboundFetch("https://slack.com/api/chat.postMessage", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ channel: channelId, text: content }),
    });
    const body = await res.json().catch(() => null);
    if (res.ok && body?.ok) {
      return { ok: true, httpStatus: res.status, externalMessageId: body.ts || null };
    }
    return {
      ok: false,
      httpStatus: res.status,
      errorText: body?.error ? `slack_${body.error}` : `http_${res.status}`,
    };
  }
  if (cfg.webhook_url) {
    const res = await safeOutboundFetch(cfg.webhook_url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: content }),
    });
    return res.ok
      ? { ok: true, httpStatus: res.status }
      : { ok: false, httpStatus: res.status, errorText: `http_${res.status}` };
  }
  return { ok: false, errorText: "no_delivery_credentials" };
}

async function deliverToDiscord(cfg, token, channelId, content) {
  if (token) {
    const res = await safeOutboundFetch(
      `https://discord.com/api/v10/channels/${encodeURIComponent(channelId)}/messages`,
      {
        method: "POST",
        headers: { Authorization: `Bot ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      },
    );
    const body = await res.json().catch(() => null);
    if (res.ok) return { ok: true, httpStatus: res.status, externalMessageId: body?.id || null };
    return {
      ok: false,
      httpStatus: res.status,
      errorText: body?.message ? truncateForStorage(`discord_${body.message}`) : `http_${res.status}`,
    };
  }
  if (cfg.webhook_url) {
    const url = cfg.webhook_url.includes("?") ? `${cfg.webhook_url}&wait=true` : `${cfg.webhook_url}?wait=true`;
    const res = await safeOutboundFetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
    });
    const body = await res.json().catch(() => null);
    return res.ok
      ? { ok: true, httpStatus: res.status, externalMessageId: body?.id || null }
      : { ok: false, httpStatus: res.status, errorText: `http_${res.status}` };
  }
  return { ok: false, errorText: "no_delivery_credentials" };
}
