import { fanoutPersistedMessage } from "./message-realtime-fanout.js";
import { deriveScopedClientMessageId } from "./client-message-id.js";
import { maybeEnqueueAgentTaskForInbound } from "./agent-queue.js";
import { logInfo, logError } from "./worker-log.js";

const E164_RE = /^\+[1-9]\d{6,14}$/;

function isTelcoInboundEnabled(env) {
  return env.TELCO_INBOUND_ENABLED === "true" || env.TELCO_INBOUND_ENABLED === "1";
}

function normalizeE164(value) {
  const raw = String(value || "").trim();
  if (!raw) return null;
  const withPlus = raw.startsWith("+") ? raw : `+${raw.replace(/\D/g, "")}`;
  return E164_RE.test(withPlus) ? withPlus : null;
}

function parseInboundPayload(body) {
  if (!body || typeof body !== "object") return null;
  const data = body.data && typeof body.data === "object" ? body.data : body;
  const type = String(body.type || data.type || data.event || "").toLowerCase();
  const direction = String(data.direction || body.direction || "").toLowerCase();

  const isInbound =
    direction === "inbound" ||
    type.includes("message.received") ||
    type.includes("message_received") ||
    type.includes("inbound") ||
    (type.includes("message") && data.inbound === true);

  if (!isInbound && !data.body && !data.text && !data.content) {
    return null;
  }

  const fromE164 = normalizeE164(
    data.from_e164 || data.from || data.phone || data.sender || data.fromPhone,
  );
  const text = String(data.body || data.text || data.content || data.message || "").trim();
  const externalId =
    (typeof data.id === "string" && data.id) ||
    (typeof data.messageId === "string" && data.messageId) ||
    (typeof body.id === "string" && body.id) ||
    null;
  const channelRaw = String(data.channel || data.type || body.channel || "sms").toLowerCase();
  const channel = channelRaw.includes("whatsapp") || channelRaw.includes("wa") ? "whatsapp" : "sms";
  const projectId =
    (typeof data.project_id === "string" && data.project_id) ||
    (typeof body.project_id === "string" && body.project_id) ||
    null;

  if (!fromE164 || !text) return null;

  return {
    fromE164,
    text: text.slice(0, 4000),
    externalId: externalId || `hash:${fromE164}:${text.slice(0, 64)}:${data.received_at || ""}`,
    channel,
    projectId,
  };
}

async function resolveProjectId(env, hintedProjectId) {
  if (hintedProjectId) return hintedProjectId;
  return (
    env.DEFAULT_PROJECT_ID?.trim() ||
    env.FLUXY_PLATFORM_PROJECT_ID?.trim() ||
    "default"
  );
}

async function resolveUserForE164(env, projectId, e164) {
  const contact = await env.DB.prepare(
    `SELECT user_id FROM sent_dm_contacts WHERE project_id = ? AND e164 = ? LIMIT 1`,
  )
    .bind(projectId, e164)
    .first();
  if (contact?.user_id) return contact.user_id;

  const member = await env.DB.prepare(
    `SELECT rm.user_id FROM room_members rm
     INNER JOIN rooms r ON r.id = rm.room_id
     WHERE r.project_id = ?
       AND rm.preferences_json LIKE ?
     LIMIT 1`,
  )
    .bind(projectId, `%${e164}%`)
    .first();
  if (member?.user_id) return member.user_id;

  return `telco:${e164}`;
}

async function resolveRoomForInbound(env, projectId, userId, fromE164) {
  const recent = await env.DB.prepare(
    `SELECT room_id FROM sent_dm_deliveries
     WHERE project_id = ? AND user_id = ? AND room_id IS NOT NULL
     ORDER BY created_at DESC LIMIT 1`,
  )
    .bind(projectId, userId)
    .first();
  if (recent?.room_id) return recent.room_id;

  const dm = await env.DB.prepare(
    `SELECT r.id FROM rooms r
     INNER JOIN room_members rm ON rm.room_id = r.id
     WHERE r.project_id = ? AND r.type = 'dm' AND rm.user_id = ?
     ORDER BY r.created_at DESC LIMIT 1`,
  )
    .bind(projectId, userId)
    .first();
  if (dm?.id) return dm.id;

  const defaultRoom = env.TELCO_INBOUND_DEFAULT_ROOM_ID?.trim();
  if (defaultRoom) {
    const exists = await env.DB.prepare(
      "SELECT id FROM rooms WHERE project_id = ? AND id = ? LIMIT 1",
    )
      .bind(projectId, defaultRoom)
      .first();
    if (exists?.id) return defaultRoom;
  }

  return null;
}

async function insertInboundMessage(env, { projectId, roomId, userId, content, channel, externalId }) {
  const now = new Date().toISOString();
  const clientMessageId = deriveScopedClientMessageId("telco", externalId);
  const insert = await env.DB.prepare(
    `INSERT INTO messages (
      project_id, room_id, user_id, content, created_at, parent_id, kind, client_message_id
    ) VALUES (?, ?, ?, ?, ?, NULL, ?, ?)`,
  )
    .bind(
      projectId,
      roomId,
      userId,
      content,
      now,
      channel === "whatsapp" ? "whatsapp" : "sms",
      clientMessageId,
    )
    .run();

  const messageId = insert.meta?.last_row_id;
  if (!messageId) throw new Error("insert_failed");

  await fanoutPersistedMessage(env, {
    projectId,
    roomId,
    messageId,
    userId,
    content,
    createdAt: now,
    clientMessageId,
    kind: channel === "whatsapp" ? "whatsapp" : "sms",
    source: "telco-inbound",
  });

  return messageId;
}

/**
 * Handle inbound SMS/WhatsApp from Sent.dm (or Twilio-shaped) webhook payload.
 * @param {*} env
 * @param {unknown} body
 */
export async function handleTelcoInboundMessage(env, body) {
  if (!isTelcoInboundEnabled(env)) {
    return { ok: true, skipped: true, reason: "disabled" };
  }
  if (!env?.DB) return { ok: false, error: "no_db" };

  const parsed = parseInboundPayload(body);
  if (!parsed) return { ok: true, ignored: true, reason: "not_inbound" };

  const projectId = await resolveProjectId(env, parsed.projectId);
  const existing = await env.DB.prepare(
    `SELECT id, message_id FROM telco_inbound_events
     WHERE project_id = ? AND external_id = ? LIMIT 1`,
  )
    .bind(projectId, parsed.externalId)
    .first();
  if (existing?.message_id) {
    return { ok: true, duplicate: true, messageId: existing.message_id };
  }

  const userId = await resolveUserForE164(env, projectId, parsed.fromE164);
  const roomId = await resolveRoomForInbound(env, projectId, userId, parsed.fromE164);
  if (!roomId) {
    logInfo("telco.inbound.no_room", { projectId, fromE164: parsed.fromE164, userId });
    return { ok: false, error: "no_room_mapping" };
  }

  try {
    const messageId = await insertInboundMessage(env, {
      projectId,
      roomId,
      userId,
      content: parsed.text,
      channel: parsed.channel,
      externalId: parsed.externalId,
    });

    await env.DB.prepare(
      `INSERT INTO telco_inbound_events
         (id, project_id, external_id, channel, from_e164, room_id, user_id, message_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
      .bind(
        crypto.randomUUID(),
        projectId,
        parsed.externalId,
        parsed.channel,
        parsed.fromE164,
        roomId,
        userId,
        messageId,
        new Date().toISOString(),
      )
      .run();

    const queue = await maybeEnqueueAgentTaskForInbound(env, {
      projectId,
      roomId,
      channel: parsed.channel,
    });

    logInfo("telco.inbound.delivered", {
      projectId,
      roomId,
      messageId,
      channel: parsed.channel,
      fromE164: parsed.fromE164,
      agentQueue: queue.skipped ? "skipped" : queue.ok ? "enqueued" : queue.error,
    });

    return { ok: true, messageId, roomId, channel: parsed.channel, agentQueue: queue };
  } catch (err) {
    logError("telco.inbound.failed", err, { projectId, fromE164: parsed.fromE164 });
    return { ok: false, error: "processing_failed" };
  }
}

export { parseInboundPayload, normalizeE164 };
