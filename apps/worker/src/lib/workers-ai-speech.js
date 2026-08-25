/**
 * In-worker speech (CF-A-030): Workers AI Whisper STT + MeloTTS/Aura TTS.
 * This is the speech path. Provider registry metrics live in voice-ai-pipeline.js.
 */

export const WORKERS_AI_STT_MODEL = "@cf/openai/whisper-large-v3-turbo";
export const WORKERS_AI_TTS_MODEL = "@cf/myshell-ai/melotts";
export const WORKERS_AI_TTS_FALLBACK = "@cf/deepgram/aura-1";
export const MAX_STT_BYTES = 10 * 1024 * 1024;
export const MAX_TTS_CHARS = 2000;

export function isWorkersAiBound(env) {
  return Boolean(env?.AI && typeof env.AI.run === "function");
}

/**
 * @param {string} input
 * @returns {{ ok: true, audioBytes: Uint8Array } | { ok: false, error: string, status: number }}
 */
export function decodeAudioBase64(input) {
  if (typeof input !== "string" || !input.trim()) {
    return { ok: false, error: "audioBase64 required", status: 400 };
  }
  const trimmed = input.includes(",") ? input.slice(input.indexOf(",") + 1) : input.trim();
  const maxChars = Math.ceil((MAX_STT_BYTES * 4) / 3) + 32;
  if (trimmed.length > maxChars) {
    return { ok: false, error: "audio too large", status: 413 };
  }
  try {
    const binary = atob(trimmed);
    const audioBytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) audioBytes[i] = binary.charCodeAt(i);
    if (audioBytes.byteLength === 0) {
      return { ok: false, error: "audioBytes must be a non-empty Uint8Array", status: 400 };
    }
    if (audioBytes.byteLength > MAX_STT_BYTES) {
      return { ok: false, error: "audio too large", status: 413 };
    }
    return { ok: true, audioBytes };
  } catch {
    return { ok: false, error: "invalid_audio_base64", status: 400 };
  }
}

function bytesToNumberArray(audioBytes) {
  const u8 = audioBytes instanceof Uint8Array ? audioBytes : new Uint8Array(audioBytes);
  return Array.from(u8);
}

export function extractTranscriptText(payload) {
  if (!payload) return "";
  if (typeof payload === "string") return payload.trim();
  if (typeof payload.text === "string") return payload.text.trim();
  if (typeof payload.transcription === "string") return payload.transcription.trim();
  if (typeof payload.result === "string") return payload.result.trim();
  if (payload.result && typeof payload.result.text === "string") return payload.result.text.trim();
  if (Array.isArray(payload.segments)) {
    return payload.segments
      .map((s) => (typeof s?.text === "string" ? s.text : ""))
      .join(" ")
      .trim();
  }
  return "";
}

export function extractTtsAudioBase64(payload) {
  if (!payload) return null;
  if (typeof payload.audio === "string" && payload.audio) return payload.audio;
  if (typeof payload === "string" && payload.length > 32) return payload;
  if (payload.audio && payload.audio instanceof ArrayBuffer) {
    return uint8ToBase64(new Uint8Array(payload.audio));
  }
  return null;
}

function uint8ToBase64(u8) {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < u8.length; i += chunk) {
    binary += String.fromCharCode(...u8.subarray(i, i + chunk));
  }
  return btoa(binary);
}

/**
 * @param {*} env
 * @param {{ audioBytes: Uint8Array, mimeType?: string, language?: string }} input
 */
export async function transcribeWithWorkersAi(env, { audioBytes, mimeType, language }) {
  if (!isWorkersAiBound(env)) return { ok: false, error: "workers_ai_unbound", status: 503 };
  if (!(audioBytes instanceof Uint8Array) || audioBytes.byteLength === 0) {
    return { ok: false, error: "audioBytes must be a non-empty Uint8Array", status: 400 };
  }
  if (audioBytes.byteLength > MAX_STT_BYTES) {
    return { ok: false, error: "audio too large", status: 413 };
  }
  const model = env.WORKERS_AI_STT_MODEL || WORKERS_AI_STT_MODEL;
  try {
    const payload = await env.AI.run(model, {
      audio: bytesToNumberArray(audioBytes),
      ...(language ? { language } : {}),
      ...(mimeType ? { source: { type: mimeType } } : {}),
    });
    const text = extractTranscriptText(payload);
    if (!text) return { ok: false, error: "transcription returned empty text", status: 502, model };
    return { ok: true, text, model, engine: "workers-ai" };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "workers_ai_stt_failed",
      status: 502,
      model,
    };
  }
}

/**
 * @param {*} env
 * @param {{ text: string, lang?: string, voice?: string }} input
 */
export async function synthesizeWithWorkersAi(env, { text, lang, voice }) {
  if (!isWorkersAiBound(env)) return { ok: false, error: "workers_ai_unbound", status: 503 };
  const prompt = String(text || "").trim().slice(0, MAX_TTS_CHARS);
  if (!prompt) return { ok: false, error: "text_required", status: 400 };
  const primary = env.WORKERS_AI_TTS_MODEL || WORKERS_AI_TTS_MODEL;
  const fallback = env.WORKERS_AI_TTS_FALLBACK || WORKERS_AI_TTS_FALLBACK;
  for (const model of [primary, fallback]) {
    if (!model) continue;
    try {
      const payload = await env.AI.run(model, {
        prompt,
        text: prompt,
        lang: lang || "en",
        ...(voice ? { voice } : {}),
      });
      const audioBase64 = extractTtsAudioBase64(payload);
      if (audioBase64) {
        return { ok: true, audioBase64, mimeType: "audio/mpeg", model, engine: "workers-ai" };
      }
    } catch {
      /* try fallback model */
    }
  }
  return { ok: false, error: "workers_ai_tts_failed", status: 502 };
}
