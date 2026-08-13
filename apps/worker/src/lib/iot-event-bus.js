/**
 * NW-206 — IoT device event → room message → ambient agent trigger.
 */
import { fanoutPersistedMessage } from "./message-realtime-fanout.js";
import { maybeTriggerAmbientAgentsOnMessage } from "./ambient-agents.js";
import { logInfo } from "./worker-log.js";

/**
 * @param {*} env
 * @param {{
 *   projectId: string,
 *   roomId: string,
 *   deviceId: string,
 *   eventType: string,
 *   payload?: Record<string, unknown>,
 *   actorUserId?: string,
 * }} input
 */
export async function ingestIotDeviceEvent(env, input) {
  const projectId = String(input.projectId || "").trim();
  const roomId = String(input.roomId || "").trim();
  const deviceId = String(input.deviceId || "").trim();
  const eventType = String(input.eventType || "telemetry").trim();
  if (!projectId || !roomId || !deviceId) {
    return { ok: false, error: "missing_fields" };
  }

  const actorUserId = input.actorUserId || `iot:${deviceId}`;
  const payload = input.payload && typeof input.payload === "object" ? input.payload : {};
  const summary = formatIotEventSummary(deviceId, eventType, payload);
  const now = new Date().toISOString();

  const insert = await env.DB.prepare(
    `INSERT INTO messages (project_id, room_id, user_id, content, created_at, kind, client_message_id)
     VALUES (?, ?, ?, ?, ?, 'iot', ?)`,
  )
    .bind(
      projectId,
      roomId,
      actorUserId,
      summary,
      now,
      `iot:${deviceId}:${eventType}:${Date.now()}`,
    )
    .run()
    .catch(() => null);

  const messageId = insert?.meta?.last_row_id ?? null;

  if (messageId) {
    await fanoutPersistedMessage(env, {
      projectId,
      roomId,
      messageId: Number(messageId),
      userId: actorUserId,
      content: summary,
      createdAt: now,
      kind: "iot",
      source: "iot-event-bus",
      clientMessageId: `iot:${deviceId}:${eventType}`,
    }).catch(() => {});
  }

  const ambient = await maybeTriggerAmbientAgentsOnMessage(env, {
    projectId,
    roomId,
    messageId: messageId ? Number(messageId) : undefined,
    userId: actorUserId,
    content: summary,
    metadata: { source: "iot", deviceId, eventType },
  }).catch(() => ({ triggered: 0 }));

  logInfo("iot.event.ingested", {
    projectId,
    roomId,
    deviceId,
    eventType,
    messageId,
    ambientTriggered: ambient?.triggered ?? 0,
  });

  return {
    ok: true,
    messageId: messageId ? Number(messageId) : null,
    content: summary,
    ambient,
  };
}

function formatIotEventSummary(deviceId, eventType, payload) {
  const reading =
    payload.value != null
      ? ` value=${payload.value}`
      : payload.reading != null
        ? ` reading=${payload.reading}`
        : "";
  return `[IoT ${deviceId}] ${eventType}${reading}`;
}
