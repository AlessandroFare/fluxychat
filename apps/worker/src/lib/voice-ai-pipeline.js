/**
 * Voice AI: in-worker STT/TTS (Workers AI) plus optional realtime session metrics.
 *
 * Speech hops: `workers-ai-speech.js` via `env.AI.run`.
 * Realtime WS adapters (OpenAI / Gemini) remain client-side; this file stores
 * provider metadata, session records, and SLO rollups.
 */

const PROVIDERS = {
  "workers-ai": {
    id: "workers-ai",
    label: "Workers AI (in-worker Whisper + TTS)",
    model: "@cf/openai/whisper-large-v3-turbo",
    features: ["stt", "tts", "in_worker"],
    targetLatencyMs: 800,
    engine: "workers-ai",
  },
  "openai-realtime": {
    id: "openai-realtime",
    label: "OpenAI Realtime API",
    model: "gpt-4o-realtime-preview",
    features: ["vad", "barge_in", "tool_calls", "aec", "noise_suppression", "unified_multimodal"],
    targetLatencyMs: 300,
  },
  "gemini-live": {
    id: "gemini-live",
    label: "Gemini Live",
    model: "gemini-2.0-flash-live",
    features: ["vad", "barge_in", "multimodal", "unified_multimodal"],
    targetLatencyMs: 350,
    wsSurface: "openai-compatible",
  },
};

function metricsKey(projectId) {
  return `voice-ai:metrics:${projectId}`;
}

function getKv(env) {
  return env.RATE_LIMIT_KV ?? env.STREAM_RESUME_KV ?? null;
}

export function listVoiceAiProviders() {
  return Object.values(PROVIDERS);
}

export function getVoiceAiProvider(providerId) {
  return PROVIDERS[providerId] ?? null;
}

export function resolveVoicePipelineMode(settings) {
  const mode = settings?.pipelineMode ?? settings?.mode;
  return mode === "legacy" ? "legacy" : "unified";
}

export async function createVoiceAiSession(env, { projectId, providerId, roomId, userId, settings }) {
  const provider = getVoiceAiProvider(providerId || (env?.AI ? "workers-ai" : "openai-realtime"));
  if (!provider) return { error: "unknown_provider" };
  const pipelineMode = resolveVoicePipelineMode(settings);
  const sessionId = `vas_${crypto.randomUUID().slice(0, 12)}`;
  const now = new Date().toISOString();
  return {
    sessionId,
    provider: provider.id,
    status: "ready",
    roomId: roomId ?? null,
    userId: userId ?? null,
    pipelineMode,
    settings: {
      pipelineMode,
      vad: settings?.vad ?? true,
      semanticTurnDetection: settings?.semanticTurnDetection ?? true,
      bargeIn: settings?.bargeIn ?? true,
      noiseSuppression: settings?.noiseSuppression ?? true,
      echoCancellation: settings?.echoCancellation ?? true,
    },
    wsUrl: `/voice-ai/sessions/${sessionId}/stream`,
    targetLatencyMs: provider.targetLatencyMs,
    createdAt: now,
  };
}

export async function recordVoiceAiMetrics(env, { projectId, sessionId, stages, totalLatencyMs, providerId, pipelineMode }) {
  const kv = getKv(env);
  if (!kv) return { recorded: false };
  const raw = await kv.get(metricsKey(projectId));
  let log = [];
  if (raw) {
    try {
      log = JSON.parse(raw);
      if (!Array.isArray(log)) log = [];
    } catch {
      log = [];
    }
  }
  log.unshift({
    sessionId,
    providerId: providerId || "openai-realtime",
    pipelineMode: pipelineMode ?? null,
    stages: stages || [],
    totalLatencyMs: totalLatencyMs ?? 0,
    recordedAt: new Date().toISOString(),
  });
  if (log.length > 200) log.length = 200;
  await kv.put(metricsKey(projectId), JSON.stringify(log));
  return { recorded: true };
}

export async function getVoiceAiMetrics(env, { projectId, limit = 50 }) {
  const kv = getKv(env);
  if (!kv) return [];
  const raw = await kv.get(metricsKey(projectId));
  if (!raw) return [];
  try {
    const log = JSON.parse(raw);
    return Array.isArray(log) ? log.slice(0, limit) : [];
  } catch {
    return [];
  }
}

export async function getVoiceAiStats(env, { projectId }) {
  const entries = await getVoiceAiMetrics(env, { projectId, limit: 100 });
  if (entries.length === 0) {
    return { sampleCount: 0, avgLatencyMs: 0, p95LatencyMs: 0, under300Ms: 0 };
  }
  const latencies = entries.map((e) => e.totalLatencyMs || 0).sort((a, b) => a - b);
  const sum = latencies.reduce((a, b) => a + b, 0);
  const p95Idx = Math.min(latencies.length - 1, Math.floor(latencies.length * 0.95));
  return {
    sampleCount: entries.length,
    avgLatencyMs: Math.round(sum / latencies.length),
    p95LatencyMs: latencies[p95Idx],
    under300Ms: latencies.filter((l) => l <= 300).length,
  };
}

/**
 * NW-200 — Build an on-hold narration event for duplex voice while a tool runs.
 * Barge-in cancels the filler (client responsibility when bargeInCancels is true).
 *
 * @param {{
 *   phrase: string,
 *   toolName?: string,
 *   toolCallId?: string,
 *   runId?: string,
 *   bargeInCancels?: boolean,
 * }} input
 */
export function buildOnHoldNarration(input) {
  const phrase = String(input?.phrase || "").trim() || "One moment — I'm looking that up.";
  return {
    type: "agent_on_hold",
    phrase,
    toolName: input?.toolName ?? null,
    toolCallId: input?.toolCallId ?? null,
    runId: input?.runId ?? null,
    bargeInCancels: input?.bargeInCancels !== false,
    targetBargeInMs: 500,
  };
}

/**
 * @param {{ bargeIn?: boolean, userSpeaking?: boolean, onHoldActive?: boolean }} state
 * @returns {{ cancelOnHold: boolean, resumeListening: boolean }}
 */
export function applyDuplexBargeIn(state = {}) {
  const bargeIn = state.bargeIn !== false;
  const userSpeaking = Boolean(state.userSpeaking);
  const onHoldActive = Boolean(state.onHoldActive);
  if (bargeIn && userSpeaking && onHoldActive) {
    return { cancelOnHold: true, resumeListening: true };
  }
  return { cancelOnHold: false, resumeListening: !userSpeaking };
}
