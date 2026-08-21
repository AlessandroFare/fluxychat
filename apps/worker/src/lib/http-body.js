/**
 * Shared JSON body checks for hot public/mutation routes (Zod).
 */
import { z } from "zod";

const recordSchema = z.record(z.string(), z.unknown());

export function asRecord(body) {
  const parsed = recordSchema.safeParse(body);
  return parsed.success ? parsed.data : null;
}

function fail(error) {
  return { ok: false, error };
}

function zodFail(err) {
  const first = err.issues?.[0];
  return fail(first?.message || "invalid_body");
}

const authTokenSchema = z.object({
  userId: z.string({ error: "userId required" }),
  roles: z.array(z.string()).optional(),
  ttlSeconds: z.coerce.number().finite().optional(),
});

export function parseAuthTokenBody(body) {
  const parsed = authTokenSchema.safeParse(body);
  if (!parsed.success) return zodFail(parsed.error);
  return { ok: true, ...parsed.data };
}

const createRoomSchema = z.object({
  name: z.unknown().optional(),
  type: z.unknown().optional(),
  id: z.unknown().optional(),
  members: z.unknown().optional(),
});

export function parseCreateRoomBody(body) {
  const rec = asRecord(body);
  if (!rec) return fail("invalid_body");
  const parsed = createRoomSchema.safeParse(rec);
  if (!parsed.success) return zodFail(parsed.error);
  return { ok: true, ...parsed.data };
}

/**
 * POST /messages — roomId required; remaining fields passed through.
 */
export function parsePostMessageBody(body) {
  const rec = asRecord(body);
  if (!rec) return fail("invalid_body");
  if (typeof rec.roomId !== "string" || !rec.roomId.trim()) {
    return fail("roomId required: must be 1-128 chars, alphanumeric with _ -");
  }
  return { ok: true, body: rec };
}

const agentInvokeSchema = z.object({
  roomId: z.string().min(1, "agentId, roomId and content required"),
  content: z.string({ error: "agentId, roomId and content required" }),
  depth: z.coerce.number().finite().optional(),
  stream: z.unknown().optional(),
  replyTo: z.unknown().optional(),
});

/**
 * POST /agents/:id/invoke
 */
export function parseAgentInvokeBody(body) {
  const rec = asRecord(body);
  if (!rec) return fail("invalid_body");
  const parsed = agentInvokeSchema.safeParse(rec);
  if (!parsed.success) {
    const msg = parsed.error.issues?.[0]?.message;
    if (msg?.includes("Required") || msg?.includes("expected")) {
      return fail("agentId, roomId and content required");
    }
    return zodFail(parsed.error);
  }
  return {
    ok: true,
    roomId: parsed.data.roomId,
    content: parsed.data.content,
    depth: parsed.data.depth ?? 0,
    stream: parsed.data.stream,
    replyTo: parsed.data.replyTo,
    body: rec,
  };
}

const webhookRegisterSchema = z.object({
  url: z.string().min(1, "url and eventTypes[] required"),
  eventTypes: z.array(z.unknown(), { error: "url and eventTypes[] required" }),
  secret: z.string().optional(),
});

/**
 * POST /webhooks/register
 */
export function parseWebhookRegisterBody(body) {
  const rec = asRecord(body);
  if (!rec) return fail("invalid_body");
  const parsed = webhookRegisterSchema.safeParse(rec);
  if (!parsed.success) {
    const msg = parsed.error.issues?.[0]?.message || "";
    if (msg.includes("array") || msg.includes("url") || msg.includes("eventTypes")) {
      return fail("url and eventTypes[] required");
    }
    if (rec.secret != null && typeof rec.secret !== "string") {
      return fail("secret must be a string");
    }
    return zodFail(parsed.error);
  }
  if (rec.secret != null && typeof rec.secret !== "string") {
    return fail("secret must be a string");
  }
  return {
    ok: true,
    url: parsed.data.url.trim(),
    eventTypes: parsed.data.eventTypes,
    secret: parsed.data.secret,
  };
}

const botUpsertSchema = z.object({
  name: z.string().min(1, "name required"),
}).passthrough();

/**
 * POST /bots
 */
export function parseBotUpsertBody(body) {
  const rec = asRecord(body);
  if (!rec) return fail("invalid_body");
  const parsed = botUpsertSchema.safeParse(rec);
  if (!parsed.success) return fail("name required");
  return { ok: true, body: parsed.data };
}

const reportCreateSchema = z.object({
  messageId: z.union([z.string(), z.number()], { error: "messageId and roomId required" }),
  roomId: z.string().min(1, "messageId and roomId required"),
}).passthrough();

/**
 * POST /reports
 */
export function parseReportCreateBody(body) {
  const rec = asRecord(body);
  if (!rec) return fail("invalid_body");
  const parsed = reportCreateSchema.safeParse(rec);
  if (!parsed.success) return fail("messageId and roomId required");
  return { ok: true, body: parsed.data };
}

const presenceUpdateSchema = z.object({
  type: z.string().min(1, "type required"),
  payload: z.record(z.string(), z.unknown()).optional(),
});

/**
 * POST /rooms/:id/presence
 */
export function parsePresenceUpdateBody(body) {
  const rec = asRecord(body);
  if (!rec) return fail("invalid_body");
  const parsed = presenceUpdateSchema.safeParse(rec);
  if (!parsed.success) return fail("type required");
  return { ok: true, type: parsed.data.type, payload: parsed.data.payload || {} };
}

const eventsTriggerSchema = z
  .object({
    roomIds: z.array(z.string()).optional(),
    rooms: z.array(z.string()).optional(),
    channels: z.array(z.string()).optional(),
    name: z.string().optional(),
    type: z.string().optional(),
    event: z.record(z.string(), z.unknown()).optional(),
    data: z.unknown().optional(),
    excludeSocketId: z.string().optional(),
    socket_id: z.string().optional(),
  })
  .passthrough();

/** POST /events */
export function parseEventsTriggerBody(body) {
  const rec = asRecord(body);
  if (!rec) return fail("invalid_body");
  const parsed = eventsTriggerSchema.safeParse(rec);
  if (!parsed.success) return fail("invalid_body");
  const roomIdsRaw = parsed.data.roomIds ?? parsed.data.rooms ?? parsed.data.channels;
  if (!Array.isArray(roomIdsRaw) || roomIdsRaw.length === 0) {
    return fail("roomIds_required");
  }
  return { ok: true, body: rec };
}

const pushDeviceSchema = z.object({
  platform: z.string().min(1, "platform and token required"),
  token: z.string().min(1, "platform and token required"),
}).passthrough();

/** POST /push/devices */
export function parsePushDeviceBody(body) {
  const rec = asRecord(body);
  if (!rec) return fail("invalid_body");
  const parsed = pushDeviceSchema.safeParse(rec);
  if (!parsed.success) return fail("platform and token required");
  return { ok: true, platform: parsed.data.platform, token: parsed.data.token, body: rec };
}
