/**
 * Voice messages (P12-B) — multipart upload route.
 *
 * @returns {Promise<Response|null>}
 *
 *   POST /messages/voice
 *   body: multipart/form-data
 *     - audio          (file, required)   recorded audio blob (webm/ogg/mp3/m4a/wav)
 *     - roomId         (string, required) target room id
 *     - parentId       (string, optional) reply target message id
 *     - durationMs     (string, optional) client-measured duration in ms
 *     - clientMessageId(string, optional) optimistic-UI id
 *   auth: Bearer JWT (same as POST /messages)
 *
 *   201 → { messageId, kind: "voice", audioUrl, durationMs, transcriptionStatus: "pending" }
 *   400 → missing/invalid input
 *   401 → no/invalid JWT
 *   402 → quota exceeded
 *   403 → user blocked / guest write disabled
 *   404 → room not found
 *   413 → audio too large / too long
 *   415 → unsupported audio format
 *   429 → rate limit
 *   502 → R2 or AI provider failure
 *   503 → R2 or AI not bound
 *
 *   After the response, `ctx.waitUntil` runs the transcription + UPDATE +
 *   broadcast of a `message_updated` event so subscribed clients see the
 *   transcript inline a few seconds later.
 */
import { pickRouteDeps } from "./route-http-deps.js";
import { normalizeClientMessageId } from "../lib/client-message-id.js";
import { isBlockedBetween } from "../lib/user-blocks.js";
import { assertGuestCanWrite } from "../lib/guest-auth.js";
import { canAccessRoom } from "../lib/room-access.js";
import { fanoutRoomInternal } from "../lib/room-shard.js";
import {
  persistTranscriptionResult,
  transcribeAudio,
  uploadVoiceToR2,
  validateVoiceUpload,
} from "../lib/voice-messages.js";
import { FEATURE_FLAG_KEYS, requireFeatureFlag } from "../lib/feature-flags.js";
import { logInfo } from "../lib/worker-log.js";

export async function dispatchVoiceMessagesRoutes(request, url, h) {
  if (url.pathname !== "/messages/voice" || request.method !== "POST") {
    return null;
  }

  const {
    env,
    ctx,
    json,
    corsHeaders,
    requestLogCtx,
    verifyJwtAndGetContext,
    logError,
    checkAndConsumeProjectQuota,
    quotaResetInfo,
    checkAndConsumeRateLimit,
    isValidId,
  } = pickRouteDeps(h, [
    "env",
    "ctx",
    "json",
    "corsHeaders",
    "requestLogCtx",
    "verifyJwtAndGetContext",
    "logError",
    "checkAndConsumeProjectQuota",
    "quotaResetInfo",
    "checkAndConsumeRateLimit",
    "isValidId",
  ]);

  // 1. Auth
  const auth = await verifyJwtAndGetContext(request, env).catch((err) => {
    if (err instanceof Response) throw err;
    logError("auth.jwt_verify_failed", err, requestLogCtx);
    return null;
  });
  if (!auth) {
    return new Response("Unauthorized", { status: 401, headers: corsHeaders });
  }

  const voiceFlag = await requireFeatureFlag(env, FEATURE_FLAG_KEYS.VOICE_MESSAGES, {
    userId: auth.userId,
    projectId: auth.projectId,
  });
  if (!voiceFlag.ok) {
    return json(
      { error: voiceFlag.error, flag: voiceFlag.flag },
      { status: 503, headers: corsHeaders },
    );
  }

  // 2. Guest write policy
  const guestWrite = assertGuestCanWrite(env, auth);
  if (!guestWrite.ok) {
    return json({ error: guestWrite.error }, { status: guestWrite.status });
  }

  // 3. Parse multipart form
  let form;
  try {
    form = await request.formData();
  } catch (err) {
    return json(
      { error: "invalid multipart body" },
      { status: 400, headers: corsHeaders },
    );
  }
  const audioField = form.get("audio");
  const roomId = form.get("roomId");
  const parentIdRaw = form.get("parentId");
  const durationRaw = form.get("durationMs");
  const clientMessageIdRaw = form.get("clientMessageId");

  if (!(audioField instanceof File)) {
    return json({ error: "audio file required" }, { status: 400, headers: corsHeaders });
  }
  if (typeof roomId !== "string" || !isValidId(roomId)) {
    return json({ error: "roomId required" }, { status: 400, headers: corsHeaders });
  }

  const parentId = parentIdRaw ? Number(parentIdRaw) : null;
  if (parentIdRaw != null && (!Number.isFinite(parentId) || parentId <= 0)) {
    return json({ error: "parentId must be a positive integer" }, { status: 400, headers: corsHeaders });
  }
  const durationMs = durationRaw != null && durationRaw !== "" ? Number(durationRaw) : null;
  if (durationMs != null && (!Number.isFinite(durationMs) || durationMs <= 0)) {
    return json({ error: "durationMs must be a positive integer" }, { status: 400, headers: corsHeaders });
  }
  const clientMessageId = normalizeClientMessageId(clientMessageIdRaw);
  const { userId: authUserId, projectId: authProjectId } = auth;

  // 4. Validate audio
  const validation = validateVoiceUpload({
    mimeType: audioField.type,
    sizeBytes: audioField.size,
    durationMs,
  });
  if (!validation.ok) {
    return json({ error: validation.error }, { status: validation.status, headers: corsHeaders });
  }

  const allowed = await canAccessRoom(env, auth, roomId);
  if (!allowed) {
    return json({ error: "forbidden" }, { status: 403, headers: corsHeaders });
  }

  // 5. Verify room exists and DM block policy
  const roomAccessRow = await env.DB
    .prepare("SELECT type FROM rooms WHERE project_id = ? AND id = ? LIMIT 1")
    .bind(authProjectId, roomId)
    .first();
  if (!roomAccessRow) {
    return json({ error: "room not found" }, { status: 404, headers: corsHeaders });
  }
  if (roomAccessRow.type === "dm") {
    const dmMembers = await env.DB
      .prepare("SELECT user_id FROM room_members WHERE room_id = ?")
      .bind(roomId)
      .all();
    for (const row of dmMembers.results || []) {
      if (!row.user_id || row.user_id === authUserId) continue;
      if (await isBlockedBetween(env, authProjectId, authUserId, row.user_id)) {
        return json({ error: "user_blocked" }, { status: 403, headers: corsHeaders });
      }
    }
  }

  // 6. Quota + rate limit
  const quotaResult = await checkAndConsumeProjectQuota(env, {
    projectId: authProjectId,
    metricName: "messages_created",
  });
  if (!quotaResult.allowed) {
    const reset = quotaResetInfo();
    return json(
      {
        error: "quota_exceeded",
        used: quotaResult.used,
        month: quotaResult.monthKey,
        resetsAt: reset.resetsAt,
        retryAfterSeconds: reset.retryAfterSeconds,
      },
      { status: 402, headers: { "Retry-After": String(reset.retryAfterSeconds), ...corsHeaders } },
    );
  }
  const rate = await checkAndConsumeRateLimit(env, {
    key: `msg:voice:${authProjectId}:${authUserId}:${roomId}`,
    limit: Number(env.RATE_LIMIT_VOICE_MESSAGES_PER_MINUTE || 10),
    windowSeconds: 60,
  });
  if (!rate.allowed) {
    return json(
      { error: "rate_limit_exceeded", retryAfterSeconds: rate.retryAfterSeconds },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds), ...corsHeaders } },
    );
  }

  // 7. Upload to R2 (placeholder messageId = 0; we update the row below)
  //    We pre-allocate a messageId by inserting a stub row first, then update
  //    the audio_url + transcription_status columns. This keeps the R2 key
  //    aligned with the message id (and gives us a stable, ordered primary
  //    key from AUTOINCREMENT). The stub row uses content='' with
  //    kind='voice' so consumers can render a placeholder before the URL is
  //    set.
  const createdAt = new Date().toISOString();
  const insertRes = await env.DB
    .prepare(
      `INSERT INTO messages (
        project_id, room_id, user_id, content, created_at, parent_id,
        kind, duration_ms, audio_url, transcription_status,
        client_message_id
      ) VALUES (?, ?, ?, ?, ?, ?, 'voice', ?, NULL, 'pending', ?)`,
    )
    .bind(
      authProjectId,
      roomId,
      authUserId,
      "",
      createdAt,
      parentId,
      durationMs,
      clientMessageId,
    )
    .run();
  const messageId = Number(insertRes?.meta?.last_row_id ?? 0);
  if (!messageId) {
    return json({ error: "insert failed" }, { status: 500, headers: corsHeaders });
  }

  const audioBytes = new Uint8Array(await audioField.arrayBuffer());
  const upload = await uploadVoiceToR2(env, {
    projectId: authProjectId,
    roomId,
    messageId,
    audioBytes,
    mimeType: validation.mimeType,
    ext: validation.ext,
  });
  if (!upload.ok) {
    // Mark the row as failed so it's not silently pending forever.
    await env.DB
      .prepare(
        `UPDATE messages SET transcription_status = 'failed' WHERE id = ?`,
      )
      .bind(messageId)
      .run()
      .catch(() => {});
    return json({ error: upload.error }, { status: upload.status, headers: corsHeaders });
  }

  await env.DB
    .prepare(
      `UPDATE messages SET audio_url = ? WHERE id = ?`,
    )
    .bind(upload.url, messageId)
    .run();

  // 8. Broadcast the pending message (so subscribers see it immediately)
  await fanoutRoomInternal(env, authProjectId, roomId, "/announce", {
    method: "POST",
    body: JSON.stringify({
      roomId,
      id: messageId,
      content: "",
      userId: authUserId,
      senderId: authUserId,
      createdAt,
      parentId,
      kind: "voice",
      audioUrl: upload.url,
      audioMimeType: audioField.type,
      audioSizeBytes: audioField.size,
      durationMs,
      transcription: null,
      transcriptionStatus: "pending",
      clientMessageId: clientMessageId ?? undefined,
    }),
  });

  // 9. Async transcription (don't block the HTTP response)
  ctx.waitUntil(
    runTranscriptionAndBroadcast(env, {
      projectId: authProjectId,
      roomId,
      messageId,
      audioBytes,
      mimeType: audioField.type,
    })
      .catch((err) =>
        logError("voice.transcription_pipeline_failed", err, {
          ...requestLogCtx,
          messageId,
        }),
      ),
  );

  return json(
    {
      messageId,
      kind: "voice",
      audioUrl: upload.url,
      durationMs,
      transcriptionStatus: "pending",
      createdAt,
    },
    { status: 201, headers: corsHeaders },
  );
}

async function runTranscriptionAndBroadcast(env, { projectId, roomId, messageId, audioBytes, mimeType }) {
  const result = await transcribeAudio(env, { audioBytes, mimeType });
  if (!result.ok) {
    logInfo("voice.transcription_failed", { messageId, error: result.error });
    await persistTranscriptionResult(env, { messageId, status: "failed" });
    await fanoutRoomInternal(env, projectId, roomId, "/announce", {
      method: "POST",
      body: JSON.stringify({
        type: "message_updated",
        roomId,
        id: messageId,
        kind: "voice",
        transcription: null,
        transcriptionStatus: "failed",
      }),
    });
    return;
  }
  const persist = await persistTranscriptionResult(env, {
    messageId,
    status: "done",
    text: result.text,
  });
  if (!persist.changed) return; // row already updated or removed
  await fanoutRoomInternal(env, projectId, roomId, "/announce", {
    method: "POST",
    body: JSON.stringify({
      type: "message_updated",
      roomId,
      id: messageId,
      kind: "voice",
      transcription: result.text,
      transcriptionStatus: "done",
      transcriptionModel: result.model,
    }),
  });
}

