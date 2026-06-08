/**
 * Voice messages helpers (P12-B).
 *
 * Three small building blocks:
 *   1. `validateVoiceUpload` — gate by MIME, size, duration.
 *   2. `uploadVoiceToR2` — store the audio blob in the existing R2 bucket.
 *   3. `transcribeAudio` — call the OpenAI-compatible `/v1/audio/transcriptions`
 *      endpoint exposed by `AI_BASE_URL` and return the transcript.
 *
 * The HTTP route (`POST /messages/voice`) stitches them together: validate →
 * upload → INSERT pending message → respond 201 → `ctx.waitUntil` runs the
 * transcription + UPDATE + broadcast. The client gets the message immediately
 * with `transcription_status: "pending"` and a follow-up `message_updated`
 * event surfaces the transcript a few seconds later.
 *
 * Why an OpenAI-compatible endpoint and not native `env.AI.run`?
 *   The existing AI integration in this worker is `AI_BASE_URL` + `AI_API_KEY`
 *   (see `lib/post-message-automations.js`, `lib/message-translation.js`).
 *   Reusing the same env contract keeps operators on one provider/key and
 *   matches the M6-B billing surface (`QUOTA_AGENT_INVOKES_PER_MONTH`).
 *   The transcription cost is metered the same way as chat completions.
 *
 * Failure modes are surfaced as `{ ok: false, error, status }` so the route
 * can map them to HTTP responses and metrics without throwing.
 */
import { buildAiAuthHeaders, resolveAiTransport } from "./ai-gateway.js";

const MAX_AUDIO_BYTES = 10 * 1024 * 1024; // 10 MB
const MAX_DURATION_MS = 10 * 60 * 1000;   // 10 minutes
const DEFAULT_TRANSCRIBE_MODEL = "whisper-1";

const ALLOWED_MIME = new Set([
  "audio/webm",
  "audio/ogg",
  "audio/mpeg",
  "audio/mp3",
  "audio/mp4",
  "audio/m4a",
  "audio/wav",
  "audio/x-wav",
  "audio/wave",
]);

const MIME_TO_EXT = {
  "audio/webm": "webm",
  "audio/ogg": "ogg",
  "audio/mpeg": "mp3",
  "audio/mp3": "mp3",
  "audio/mp4": "m4a",
  "audio/m4a": "m4a",
  "audio/wav": "wav",
  "audio/x-wav": "wav",
  "audio/wave": "wav",
};

/**
 * @param {{ mimeType: string, sizeBytes: number, durationMs?: number | null }} input
 * @returns {{ ok: true, ext: string } | { ok: false, error: string, status: number }}
 */
export function validateVoiceUpload({ mimeType, sizeBytes, durationMs }) {
  if (!mimeType || typeof mimeType !== "string") {
    return { ok: false, error: "mimeType required", status: 400 };
  }
  const normalized = mimeType.toLowerCase();
  if (!ALLOWED_MIME.has(normalized)) {
    return {
      ok: false,
      error: `unsupported audio format: ${mimeType}`,
      status: 415,
    };
  }
  if (!Number.isFinite(sizeBytes) || sizeBytes <= 0) {
    return { ok: false, error: "sizeBytes must be a positive number", status: 400 };
  }
  if (sizeBytes > MAX_AUDIO_BYTES) {
    return {
      ok: false,
      error: `audio too large (max ${MAX_AUDIO_BYTES} bytes)`,
      status: 413,
    };
  }
  if (durationMs != null) {
    if (!Number.isFinite(durationMs) || durationMs <= 0) {
      return { ok: false, error: "durationMs must be a positive number", status: 400 };
    }
    if (durationMs > MAX_DURATION_MS) {
      return {
        ok: false,
        error: `audio too long (max ${MAX_DURATION_MS} ms)`,
        status: 413,
      };
    }
  }
  return { ok: true, ext: MIME_TO_EXT[normalized] };
}

/**
 * Upload a voice message audio blob to the R2 attachments bucket.
 *
 * @param {object} env
 * @param {{
 *   projectId: string,
 *   roomId: string,
 *   messageId: number,
 *   audioBytes: ArrayBuffer | Uint8Array,
 *   mimeType: string,
 *   ext: string,
 * }} args
 * @returns {Promise<{ ok: true, key: string, url: string } | { ok: false, error: string, status: number }>}
 */
export async function uploadVoiceToR2(env, { projectId, roomId, messageId, audioBytes, mimeType, ext }) {
  if (!env.ATTACHMENTS) {
    return { ok: false, error: "R2 (ATTACHMENTS) not bound", status: 503 };
  }
  if (!projectId || !roomId || !Number.isFinite(messageId)) {
    return { ok: false, error: "projectId, roomId and messageId are required", status: 400 };
  }
  const bytes = audioBytes instanceof Uint8Array ? audioBytes : new Uint8Array(audioBytes);
  const key = `voice/${encodeURIComponent(projectId)}/${encodeURIComponent(roomId)}/${messageId}.${ext}`;
  try {
    await env.ATTACHMENTS.put(key, bytes, {
      httpMetadata: { contentType: mimeType },
      customMetadata: { kind: "voice", projectId, roomId, messageId: String(messageId) },
    });
  } catch (err) {
    return { ok: false, error: `R2 put failed: ${err instanceof Error ? err.message : String(err)}`, status: 502 };
  }
  return { ok: true, key, url: `/attachments/${key}` };
}

/**
 * Transcribe an audio blob via the OpenAI-compatible
 * `/v1/audio/transcriptions` endpoint exposed by `AI_BASE_URL`.
 *
 * Returns the transcript text on success, or a structured error. The
 * response is intentionally narrow: callers can surface the error to
 * metrics and store `transcription_status='failed'` without leaking the
 * raw provider response.
 *
 * @param {object} env
 * @param {{
 *   audioBytes: Uint8Array,
 *   mimeType: string,
 *   filename?: string,
 *   language?: string,
 *   model?: string,
 * }} args
 * @returns {Promise<{ ok: true, text: string, model: string } | { ok: false, error: string, status: number }>}
 */
export async function transcribeAudio(env, { audioBytes, mimeType, filename, language, model }) {
  const transport = resolveAiTransport(env);
  if (!transport.configured || !transport.transcriptionsUrl) {
    return { ok: false, error: "ai_not_configured", status: 503 };
  }
  if (!(audioBytes instanceof Uint8Array) || audioBytes.byteLength === 0) {
    return { ok: false, error: "audioBytes must be a non-empty Uint8Array", status: 400 };
  }
  const useModel = model || env.AI_TRANSCRIBE_MODEL || DEFAULT_TRANSCRIBE_MODEL;

  // Build a multipart/form-data body manually. Workers' `fetch` accepts a
  // FormData, but that triggers platform-specific handling; for portability
  // (and to avoid pulling the FormData shim into a 1.x runtime), we build
  // the body ourselves with a deterministic boundary.
  const boundary = `----fluxy-voice-${Math.random().toString(36).slice(2, 10)}`;
  const fileField = filename || `voice.${(mimeType.split("/")[1] || "bin").split(";")[0]}`;
  const parts = [];
  parts.push(stringPart(boundary, "model", useModel));
  if (language) parts.push(stringPart(boundary, "language", language));
  parts.push(stringPart(boundary, "response_format", "json"));
  parts.push(filePart(boundary, "file", fileField, mimeType, audioBytes));
  const body = concatParts(parts, boundary);

  let res;
  try {
    res = await fetch(transport.transcriptionsUrl, {
      method: "POST",
      headers: buildAiAuthHeaders(env, {
        extra: { "content-type": `multipart/form-data; boundary=${boundary}` },
        metadata: { feature: "voice_transcription" },
      }),
      body,
    });
  } catch (err) {
    return { ok: false, error: `transcription fetch failed: ${err instanceof Error ? err.message : String(err)}`, status: 502 };
  }
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    return {
      ok: false,
      error: `transcription provider returned ${res.status}: ${text.slice(0, 200)}`,
      status: 502,
    };
  }
  let payload;
  try {
    payload = await res.json();
  } catch (err) {
    return { ok: false, error: `transcription response not JSON: ${err instanceof Error ? err.message : String(err)}`, status: 502 };
  }
  const text = typeof payload?.text === "string" ? payload.text.trim() : "";
  if (!text) {
    return { ok: false, error: "transcription returned empty text", status: 502 };
  }
  return { ok: true, text, model: useModel };
}

/**
 * Persist the transcription result on the message row. Idempotent: if the
 * row already has a `done` / `failed` status, the call is a no-op (prevents
 * a stuck async retry from clobbering a later result).
 *
 * @param {object} env
 * @param {{ messageId: number, status: "done" | "failed", text?: string }} args
 * @returns {Promise<{ ok: true, changed: boolean }>}
 */
export async function persistTranscriptionResult(env, { messageId, status, text }) {
  if (!Number.isFinite(messageId)) {
    return { ok: true, changed: false };
  }
  if (status === "done") {
    const result = await env.DB
      .prepare(
        `UPDATE messages
         SET transcription = ?, transcription_status = 'done'
         WHERE id = ? AND (transcription_status IS NULL OR transcription_status = 'pending')`,
      )
      .bind(text ?? "", messageId)
      .run();
    return { ok: true, changed: Number(result?.meta?.changes ?? 0) > 0 };
  }
  if (status === "failed") {
    const result = await env.DB
      .prepare(
        `UPDATE messages
         SET transcription_status = 'failed'
         WHERE id = ? AND (transcription_status IS NULL OR transcription_status = 'pending')`,
      )
      .bind(messageId)
      .run();
    return { ok: true, changed: Number(result?.meta?.changes ?? 0) > 0 };
  }
  return { ok: true, changed: false };
}

function stringPart(boundary, name, value) {
  return (
    `--${boundary}\r\n` +
    `content-disposition: form-data; name="${name}"\r\n` +
    `content-type: text/plain; charset=utf-8\r\n\r\n` +
    `${value}\r\n`
  );
}

function filePart(boundary, name, filename, contentType, bytes) {
  const head =
    `--${boundary}\r\n` +
    `content-disposition: form-data; name="${name}"; filename="${filename}"\r\n` +
    `content-type: ${contentType}\r\n\r\n`;
  const tail = `\r\n`;
  const headBytes = new TextEncoder().encode(head);
  const tailBytes = new TextEncoder().encode(tail);
  const out = new Uint8Array(headBytes.byteLength + bytes.byteLength + tailBytes.byteLength);
  out.set(headBytes, 0);
  out.set(bytes, headBytes.byteLength);
  out.set(tailBytes, headBytes.byteLength + bytes.byteLength);
  return out;
}

function concatParts(parts, boundary) {
  let total = 0;
  for (const p of parts) {
    total += p instanceof Uint8Array ? p.byteLength : new TextEncoder().encode(p).byteLength;
  }
  const closing = new TextEncoder().encode(`--${boundary}--\r\n`);
  total += closing.byteLength;
  const out = new Uint8Array(total);
  let offset = 0;
  for (const p of parts) {
    const bytes = p instanceof Uint8Array ? p : new TextEncoder().encode(p);
    out.set(bytes, offset);
    offset += bytes.byteLength;
  }
  out.set(closing, offset);
  return out;
}
