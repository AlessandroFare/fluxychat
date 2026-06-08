/**
 * Persist and update Sent.dm outbound delivery records (P10-S1/S2).
 */

/**
 * @param {*} env
 * @param {{
 *   id?: string,
 *   projectId: string,
 *   roomId?: string,
 *   fluxyMessageId?: number,
 *   userId: string,
 *   toE164: string,
 *   sentMessageId?: string,
 *   status?: string,
 *   channel?: string,
 *   error?: string,
 * }} row
 */
export async function insertSentDmDelivery(env, row) {
  if (!env?.DB) return null;
  const id = row.id || crypto.randomUUID();
  const now = new Date().toISOString();
  await env.DB.prepare(
    `INSERT INTO sent_dm_deliveries
     (id, project_id, room_id, fluxy_message_id, user_id, to_e164, sent_message_id, status, channel, error, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      id,
      row.projectId,
      row.roomId ?? null,
      row.fluxyMessageId ?? null,
      row.userId,
      row.toE164,
      row.sentMessageId ?? null,
      row.status || "sent",
      row.channel || "sms",
      row.error ?? null,
      now,
      now,
    )
    .run();
  return id;
}

/**
 * @param {*} env
 * @param {string} sentMessageId
 * @param {{ status: string, error?: string }} update
 */
export async function updateSentDmDeliveryBySentId(env, sentMessageId, update) {
  if (!env?.DB || !sentMessageId) return false;
  const now = new Date().toISOString();
  const result = await env.DB.prepare(
    `UPDATE sent_dm_deliveries
     SET status = ?, error = COALESCE(?, error), updated_at = ?
     WHERE sent_message_id = ?`,
  )
    .bind(update.status, update.error ?? null, now, sentMessageId)
    .run();
  return (result.meta?.changes ?? 0) > 0;
}

/**
 * Verify Sent.dm webhook HMAC (sha256=hex over raw body).
 * @param {string} secret
 * @param {string} rawBody
 * @param {string | null | undefined} signatureHeader
 */
export async function verifySentDmWebhookSignature(secret, rawBody, signatureHeader) {
  if (!secret || !rawBody || !signatureHeader) return false;
  const { signWebhookPayload } = await import("./webhook-signing.js");
  const { timingSafeEqual } = await import("./crypto-timing.js");
  const expected = await signWebhookPayload(secret, rawBody);
  const expectedHex = expected.replace(/^sha256=/, "");
  const received = signatureHeader.trim().replace(/^sha256=/, "");
  return timingSafeEqual(expectedHex, received);
}

/**
 * @param {*} env
 * @param {unknown} body parsed JSON
 */
export async function handleSentDmWebhookEvent(env, body) {
  if (!body || typeof body !== "object") return { ok: false, reason: "invalid_body" };

  const data = body.data && typeof body.data === "object" ? body.data : body;
  const sentMessageId =
    (typeof data.id === "string" && data.id) ||
    (typeof data.messageId === "string" && data.messageId) ||
    (typeof body.id === "string" && body.id) ||
    null;
  const statusRaw =
    (typeof data.status === "string" && data.status) ||
    (typeof body.type === "string" && body.type.includes("delivered") ? "delivered" : null) ||
    (typeof body.type === "string" && body.type.includes("failed") ? "failed" : null);

  if (!sentMessageId || !statusRaw) {
    return { ok: true, ignored: true };
  }

  const status = statusRaw.toLowerCase();
  const error =
    typeof data.error === "string"
      ? data.error
      : typeof data.error?.message === "string"
        ? data.error.message
        : null;

  const updated = await updateSentDmDeliveryBySentId(env, sentMessageId, {
    status,
    error,
  });
  return { ok: true, updated, sentMessageId, status };
}
