/**
 * Room capability platform — server-side event envelope, idempotency, policy gates.
 * ROADMAP §5.3+ vertical workflows persist through this layer.
 */

import { canAccessRoom } from "./room-access.js";
import { logInfo } from "./worker-log.js";
import { fanoutRoomInternal } from "./room-shard.js";

const MAX_PAYLOAD_BYTES = 32_768;
const MAX_EVENT_TYPE_LEN = 128;
const MAX_IDEMPOTENCY_LEN = 256;

/** @type {Record<string, { roles?: string[], selfActor?: boolean }>} */
const EVENT_POLICY = {
  "edu.session.started": { selfActor: true },
  "attendance.heartbeat": { selfActor: true },
  "edu.breakout.assigned": { roles: ["teacher", "admin", "owner"] },
  "edu.poll.created": { roles: ["teacher", "admin", "owner"] },
  "poll.voted": { selfActor: true },
  "edu.grade.suggested": { roles: ["teacher", "admin", "owner", "agent"] },
  "edu.grade.approved": { roles: ["teacher", "admin", "owner"] },
  "health.consent.verified": { roles: ["patient", "coordinator", "admin", "owner"] },
  "health.fhir.context.attached": { roles: ["clinician", "admin", "owner", "system"] },
  "health.audit.sealed": { roles: ["admin", "owner", "system"] },
  "event.ticket.verified": { roles: ["organizer", "admin", "owner", "system"] },
  "event.stage.live": { roles: ["organizer", "speaker", "admin", "owner", "system"] },
  "event.qa.upvoted": { selfActor: true },
  "event.recap.published": { roles: ["organizer", "admin", "owner"] },
  "finance.alert.created": { roles: ["analyst", "admin", "owner", "system"] },
  "finance.risk.flagged": { roles: ["analyst", "admin", "owner", "agent", "system"] },
  "finance.invoice.draft": { roles: ["analyst", "admin", "owner", "agent"] },
  "finance.invoice.approved": { roles: ["approver", "admin", "owner"] },
  "finance.audit.exported": { roles: ["analyst", "admin", "owner"] },
  "continuity.device.registered": { selfActor: true },
  "continuity.checkpoint.created": { selfActor: true },
  "continuity.checkpoint.resumed": { selfActor: true },
  "continuity.cursor.confirmed": { roles: ["admin", "owner", "system"] },
};

function hasRole(auth, allowed) {
  const roles = Array.isArray(auth?.roles) ? auth.roles : [];
  return allowed.some((r) => roles.includes(r));
}

/**
 * @param {object} auth
 * @param {object} actor
 * @param {string} eventType
 */
export function evaluateCapabilityPolicy(auth, actor, eventType) {
  const rule = EVENT_POLICY[eventType];
  if (!rule) return { ok: true };
  if (rule.selfActor && actor?.id === auth?.userId) return { ok: true };
  if (rule.roles && hasRole(auth, rule.roles)) return { ok: true };
  if (actor?.type === "system" && rule.roles?.includes("system")) return { ok: true };
  if (actor?.type === "agent" && rule.roles?.includes("agent")) return { ok: true };
  return { ok: false, error: "policy_denied", eventType };
}

/**
 * @param {import("@cloudflare/workers-types").D1Database} db
 * @param {string} projectId
 * @param {string} idempotencyKey
 */
async function findByIdempotency(db, projectId, idempotencyKey) {
  return db.prepare(
    `SELECT event_id, project_id, room_id, vertical, event_type AS type,
            actor_id, actor_type, actor_role, idempotency_key, schema_version,
            payload_json, occurred_at
     FROM room_capability_events
     WHERE project_id = ? AND idempotency_key = ?
     LIMIT 1`,
  ).bind(projectId, idempotencyKey).first();
}

function rowToEvent(row) {
  let payload = {};
  try { payload = JSON.parse(row.payload_json || "{}"); } catch { /* ignore */ }
  return {
    eventId: row.event_id,
    workspaceId: row.project_id,
    roomId: row.room_id,
    vertical: row.vertical || undefined,
    type: row.type || row.event_type,
    actor: {
      id: row.actor_id,
      type: row.actor_type,
      role: row.actor_role || undefined,
    },
    occurredAt: row.occurred_at,
    schemaVersion: row.schema_version,
    idempotencyKey: row.idempotency_key,
    payload,
  };
}

/**
 * @param {*} env
 * @param {object} input
 * @param {object} auth
 */
export async function publishCapabilityEvent(env, input, auth) {
  const {
    roomId, vertical, type, actor, idempotencyKey, payload = {}, occurredAt,
  } = input;

  if (!roomId?.trim()) return { ok: false, error: "room_id_required" };
  if (!type?.trim() || type.length > MAX_EVENT_TYPE_LEN) return { ok: false, error: "invalid_event_type" };
  if (!idempotencyKey?.trim() || idempotencyKey.length > MAX_IDEMPOTENCY_LEN) {
    return { ok: false, error: "idempotency_key_required" };
  }
  if (!actor?.id || !actor?.type) return { ok: false, error: "actor_required" };

  const payloadJson = JSON.stringify(payload ?? {});
  if (payloadJson.length > MAX_PAYLOAD_BYTES) return { ok: false, error: "payload_too_large" };

  const canAccess = await canAccessRoom(env, auth, roomId);
  if (!canAccess) return { ok: false, error: "forbidden" };

  const policy = evaluateCapabilityPolicy(auth, actor, type);
  if (!policy.ok) return { ok: false, error: policy.error };

  const existing = await findByIdempotency(env.DB, auth.projectId, idempotencyKey.trim());
  if (existing) {
    if (existing.room_id !== roomId) return { ok: false, error: "idempotency_room_mismatch" };
    return { ok: true, event: rowToEvent(existing), deduplicated: true };
  }

  const eventId = `evt_${crypto.randomUUID()}`;
  const ts = occurredAt || new Date().toISOString();

  await env.DB.prepare(
    `INSERT INTO room_capability_events
     (event_id, project_id, room_id, vertical, event_type, actor_id, actor_type, actor_role,
      idempotency_key, schema_version, payload_json, occurred_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
  ).bind(
    eventId,
    auth.projectId,
    roomId,
    vertical || null,
    type.trim(),
    actor.id,
    actor.type,
    actor.role || null,
    idempotencyKey.trim(),
    payloadJson,
    ts,
  ).run();

  logInfo("capability.event_published", {
    projectId: auth.projectId,
    roomId,
    eventId,
    type,
    actorId: actor.id,
  });

  const event = {
    eventId,
    workspaceId: auth.projectId,
    roomId,
    vertical,
    type: type.trim(),
    actor,
    occurredAt: ts,
    schemaVersion: 1,
    idempotencyKey: idempotencyKey.trim(),
    payload,
  };

  try {
    await fanoutRoomInternal(env, auth.projectId, roomId, "/announce", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "capability_event",
        roomId,
        event,
      }),
    });
  } catch (err) {
    logInfo("capability.fanout_failed", {
      projectId: auth.projectId,
      roomId,
      eventId,
      error: err instanceof Error ? err.message : String(err),
    });
  }

  return {
    ok: true,
    event,
    deduplicated: false,
  };
}

/**
 * @param {*} env
 * @param {{ projectId: string, roomId: string, afterCursor?: number, limit?: number }} input
 * @param {object} auth
 */
export async function listCapabilityEvents(env, input, auth) {
  const { roomId, afterCursor = 0, limit = 100 } = input;
  if (!roomId?.trim()) return { ok: false, error: "room_id_required" };

  const canAccess = await canAccessRoom(env, auth, roomId);
  if (!canAccess) return { ok: false, error: "forbidden" };

  const safeLimit = Math.min(Math.max(1, limit), 200);
  const safeCursor = Math.max(0, afterCursor);

  const { results } = await env.DB.prepare(
    `SELECT event_id, project_id, room_id, vertical, event_type, actor_id, actor_type, actor_role,
            idempotency_key, schema_version, payload_json, occurred_at
     FROM room_capability_events
     WHERE project_id = ? AND room_id = ?
     ORDER BY occurred_at ASC, event_id ASC
     LIMIT ? OFFSET ?`,
  ).bind(auth.projectId, roomId, safeLimit, safeCursor).all();

  const events = (results || []).map(rowToEvent);
  return {
    ok: true,
    events,
    cursor: safeCursor + events.length,
    hasMore: events.length === safeLimit,
  };
}
