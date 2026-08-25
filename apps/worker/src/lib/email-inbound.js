/**
 * Inbound email → room and/or Agent DO (CF-A-031).
 *
 * Cloudflare Email Workers call `export default { email }`. HTTP
 * `/integrations/email/inbound` is the same pipeline for tests and providers
 * that POST raw MIME.
 */

import { fanoutPersistedMessage } from "./message-realtime-fanout.js";
import { deriveScopedClientMessageId } from "./client-message-id.js";
import { maybeEnqueueAgentTaskForInbound } from "./agent-queue.js";
import { callAgentDo } from "./agent-do-session.js";
import { logInfo, logError } from "./worker-log.js";

const MAX_BODY = 4000;
const MODES = new Set(["room", "agent", "both"]);

export function normalizeEmailAddress(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const angle = raw.match(/<([^>]+)>/);
  return (angle ? angle[1] : raw).trim().toLowerCase();
}

export function emailLocalPart(address) {
  const addr = normalizeEmailAddress(address);
  const at = addr.indexOf("@");
  return at > 0 ? addr.slice(0, at) : addr;
}

/**
 * @param {string} raw
 */
export function parseRawEmail(raw) {
  const text = String(raw || "").replace(/\r\n/g, "\n");
  const split = text.indexOf("\n\n");
  const headerBlock = split >= 0 ? text.slice(0, split) : text;
  let body = split >= 0 ? text.slice(split + 2) : "";
  /** @type {Record<string, string>} */
  const headers = {};
  let current = "";
  for (const line of headerBlock.split("\n")) {
    if (/^[ \t]/.test(line) && current) {
      headers[current] += " " + line.trim();
      continue;
    }
    const idx = line.indexOf(":");
    if (idx < 1) continue;
    current = line.slice(0, idx).trim().toLowerCase();
    headers[current] = line.slice(idx + 1).trim();
  }
  if (/multipart\//i.test(headers["content-type"] || "")) {
    const plain = body.match(/Content-Type:\s*text\/plain[\s\S]*?\n\n([\s\S]*?)(?:\n--|$)/i);
    if (plain) body = plain[1];
  }
  body = body.replace(/=\n/g, "").trim();
  return {
    from: normalizeEmailAddress(headers.from || ""),
    to: normalizeEmailAddress(headers.to || ""),
    subject: headers.subject || "",
    messageId: String(headers["message-id"] || "").replace(/[<>]/g, "").trim(),
    body: body.slice(0, MAX_BODY),
  };
}

export function parseLocalPartRoute(localPart) {
  const local = String(localPart || "").trim().toLowerCase();
  const room = local.match(/^room[-._]([a-z0-9_-]{1,128})$/);
  if (room) return { roomId: room[1], agentId: null, mode: "room" };
  const agent = local.match(/^agent[-._]([a-z0-9_-]{1,128})$/);
  if (agent) return { roomId: null, agentId: agent[1], mode: "agent" };
  return null;
}

export function composeInboundText({ subject, body, from }) {
  const subj = String(subject || "").trim();
  const text = String(body || "").trim();
  const lines = [];
  if (from) lines.push(`From: ${from}`);
  if (subj) lines.push(`Subject: ${subj}`);
  if (text) lines.push(text);
  return lines.join("\n").slice(0, MAX_BODY);
}

async function lookupRoute(env, projectId, toAddr) {
  const rows = await env.DB.prepare(
    `SELECT * FROM email_inbound_routes
     WHERE project_id = ? AND enabled = 1 AND (address = ? OR address = ?)
     LIMIT 1`,
  )
    .bind(projectId, toAddr, emailLocalPart(toAddr))
    .first();
  if (rows) {
    return {
      roomId: rows.room_id ? String(rows.room_id) : null,
      agentId: rows.agent_id ? String(rows.agent_id) : null,
      mode: MODES.has(rows.mode) ? rows.mode : "room",
    };
  }
  return parseLocalPartRoute(emailLocalPart(toAddr));
}

async function resolveProjectId(env, hinted) {
  if (hinted) return String(hinted);
  return (
    env.DEFAULT_PROJECT_ID?.trim() ||
    env.FLUXY_PLATFORM_PROJECT_ID?.trim() ||
    "default"
  );
}

export async function createEmailInboundRoute(env, input) {
  const projectId = String(input.projectId || "").trim();
  const address = normalizeEmailAddress(input.address);
  const mode = String(input.mode || "room");
  if (!projectId || !address) return { ok: false, reason: "address_required" };
  if (!MODES.has(mode)) return { ok: false, reason: "invalid_mode" };
  const roomId = input.roomId ? String(input.roomId).trim() : null;
  const agentId = input.agentId ? String(input.agentId).trim() : null;
  if ((mode === "room" || mode === "both") && !roomId) return { ok: false, reason: "room_id_required" };
  if ((mode === "agent" || mode === "both") && !agentId) return { ok: false, reason: "agent_id_required" };
  const id = `emr_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`;
  const now = new Date().toISOString();
  await env.DB.prepare(
    `INSERT INTO email_inbound_routes (id, project_id, address, room_id, agent_id, mode, enabled, created_at)
     VALUES (?, ?, ?, ?, ?, ?, 1, ?)`,
  )
    .bind(id, projectId, address, roomId, agentId, mode, now)
    .run();
  return { ok: true, route: { id, projectId, address, roomId, agentId, mode, enabled: true, createdAt: now } };
}

export async function listEmailInboundRoutes(env, projectId) {
  const rows = await env.DB.prepare(
    `SELECT * FROM email_inbound_routes WHERE project_id = ? ORDER BY created_at DESC LIMIT 100`,
  )
    .bind(projectId)
    .all();
  return (rows.results || []).map((row) => ({
    id: row.id,
    projectId: row.project_id,
    address: row.address,
    roomId: row.room_id,
    agentId: row.agent_id,
    mode: row.mode,
    enabled: Number(row.enabled) !== 0,
    createdAt: row.created_at,
  }));
}

export async function deleteEmailInboundRoute(env, { projectId, routeId }) {
  const result = await env.DB.prepare(
    `DELETE FROM email_inbound_routes WHERE id = ? AND project_id = ?`,
  )
    .bind(routeId, projectId)
    .run();
  return { ok: Number(result?.meta?.changes || 0) > 0 };
}

/**
 * @param {*} env
 * @param {{ from?: string, to?: string, subject?: string, text?: string, raw?: string, messageId?: string, projectId?: string }} input
 */
export async function handleEmailInbound(env, input) {
  if (!env?.DB) return { ok: false, error: "no_db", reject: "temporary failure" };
  const parsed = input.raw ? parseRawEmail(input.raw) : {
    from: normalizeEmailAddress(input.from),
    to: normalizeEmailAddress(input.to),
    subject: String(input.subject || ""),
    messageId: String(input.messageId || "").replace(/[<>]/g, "").trim(),
    body: String(input.text || input.body || "").slice(0, MAX_BODY),
  };
  if (input.from) parsed.from = parsed.from || normalizeEmailAddress(input.from);
  if (input.to) parsed.to = parsed.to || normalizeEmailAddress(input.to);
  if (input.subject && !parsed.subject) parsed.subject = String(input.subject);
  if (input.messageId && !parsed.messageId) parsed.messageId = String(input.messageId).replace(/[<>]/g, "").trim();

  if (!parsed.to) return { ok: false, error: "to_required", reject: "no mailbox" };
  const projectId = await resolveProjectId(env, input.projectId);
  const externalId = parsed.messageId || `hash:${parsed.from}:${parsed.to}:${parsed.subject}:${parsed.body.slice(0, 48)}`;

  const existing = await env.DB.prepare(
    `SELECT fluxy_message_id FROM email_inbound_events WHERE project_id = ? AND message_id_hdr = ? LIMIT 1`,
  )
    .bind(projectId, externalId)
    .first();
  if (existing) {
    return { ok: true, duplicate: true, messageId: existing.fluxy_message_id };
  }

  const route = await lookupRoute(env, projectId, parsed.to);
  const defaultRoom = env.EMAIL_INBOUND_DEFAULT_ROOM_ID?.trim() || null;
  const roomId = route?.roomId || defaultRoom || null;
  const agentId = route?.agentId || null;
  const mode = route?.mode || (agentId && !roomId ? "agent" : roomId ? "room" : null);
  if (!mode) {
    logInfo("email.inbound.no_route", { projectId, to: parsed.to });
    return { ok: false, error: "no_route", reject: "no mailbox" };
  }
  if ((mode === "room" || mode === "both") && !roomId) {
    return { ok: false, error: "no_room_mapping", reject: "no mailbox" };
  }
  if ((mode === "agent" || mode === "both") && !agentId) {
    return { ok: false, error: "no_agent_mapping", reject: "no mailbox" };
  }

  const userId = parsed.from ? `email:${parsed.from}` : "email:unknown";
  const content = composeInboundText(parsed);
  let messageId = null;
  const shouldRoom = mode === "room" || mode === "both";
  const shouldAgent = mode === "agent" || mode === "both";

  try {
    if (shouldRoom && roomId) {
      const now = new Date().toISOString();
      const clientMessageId = deriveScopedClientMessageId("email", externalId);
      const insert = await env.DB.prepare(
        `INSERT INTO messages (
          project_id, room_id, user_id, content, created_at, parent_id, kind, client_message_id
        ) VALUES (?, ?, ?, ?, ?, NULL, 'email', ?)`,
      )
        .bind(projectId, roomId, userId, content, now, clientMessageId)
        .run();
      messageId = insert.meta?.last_row_id;
      if (!messageId) throw new Error("insert_failed");
      await fanoutPersistedMessage(env, {
        projectId,
        roomId,
        messageId,
        userId,
        content,
        createdAt: now,
        clientMessageId,
        kind: "email",
        source: "email-inbound",
      });
    }

    await env.DB.prepare(
      `INSERT INTO email_inbound_events
        (id, project_id, message_id_hdr, from_addr, to_addr, room_id, user_id, fluxy_message_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
      .bind(
        crypto.randomUUID(),
        projectId,
        externalId,
        parsed.from,
        parsed.to,
        roomId,
        userId,
        messageId,
        new Date().toISOString(),
      )
      .run();

    let agent = null;
    if (shouldAgent) {
      const nudgeUser = String(input.userId || userId.replace(/^email:/, "u_")).slice(0, 128);
      await callAgentDo(env, { projectId, agentId, userId: nudgeUser }, "room_event", {
        summary: content,
        roomId,
        projectId,
        agentId,
        userId: nudgeUser,
      });
      agent = await callAgentDo(env, { projectId, agentId, userId: nudgeUser }, "turn", {
        content,
        projectId,
        agentId,
        userId: nudgeUser,
        roomId,
      });
    }

    if (roomId) {
      await maybeEnqueueAgentTaskForInbound(env, {
        projectId,
        roomId,
        channel: "email",
      });
    }

    logInfo("email.inbound.delivered", { projectId, roomId, agentId, messageId, to: parsed.to });
    return { ok: true, messageId, roomId, agentId, agent };
  } catch (err) {
    logError("email.inbound.failed", err, { projectId, to: parsed.to });
    return { ok: false, error: "processing_failed", reject: "temporary failure" };
  }
}

export async function handleCloudflareEmailMessage(message, env) {
  let raw = "";
  try {
    if (message?.raw) raw = await new Response(message.raw).text();
  } catch {
    raw = "";
  }
  const headerId = typeof message?.headers?.get === "function"
    ? message.headers.get("Message-ID")
    : "";
  return handleEmailInbound(env, {
    from: message?.from,
    to: message?.to,
    raw,
    messageId: headerId,
  });
}
