/**
 * Voice AI pipeline — adapter registry, session metrics, quality targets.
 * Adapters: openai-realtime (standard WS surface), gemini-live (compatible mode).
 */

const PROVIDERS = {
  "openai-realtime": {
    id: "openai-realtime",
    label: "OpenAI Realtime API",
    model: "gpt-4o-realtime-preview",
    features: ["vad", "barge_in", "tool_calls", "aec", "noise_suppression"],
    targetLatencyMs: 300,
  },
  "gemini-live": {
    id: "gemini-live",
    label: "Gemini Live",
    model: "gemini-2.0-flash-live",
    features: ["vad", "barge_in", "multimodal"],
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

export async function createVoiceAiSession(env, { projectId, providerId, roomId, userId, settings }) {
  const provider = getVoiceAiProvider(providerId || "openai-realtime");
  if (!provider) return { error: "unknown_provider" };
  const sessionId = `vas_${crypto.randomUUID().slice(0, 12)}`;
  const now = new Date().toISOString();
  return {
    sessionId,
    provider: provider.id,
    status: "ready",
    roomId: roomId ?? null,
    userId: userId ?? null,
    settings: {
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

export async function recordVoiceAiMetrics(env, { projectId, sessionId, stages, totalLatencyMs, providerId }) {
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
