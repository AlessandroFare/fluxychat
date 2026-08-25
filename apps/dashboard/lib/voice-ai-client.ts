import { getPublicWorkerUrl } from "@/lib/worker-url-client";
import { fetchWorkerJson } from "@/lib/worker-fetch";

const BASE = getPublicWorkerUrl();

export interface VoiceAiProvider {
  id: string;
  label: string;
  model: string;
  features: string[];
  targetLatencyMs: number;
  engine?: string;
}

export interface VoiceAiSession {
  sessionId: string;
  provider: string;
  status: string;
  wsUrl: string;
  targetLatencyMs: number;
  pipelineMode?: "unified" | "legacy";
  settings: Record<string, boolean | string>;
}

export interface VoiceAiStats {
  sampleCount: number;
  avgLatencyMs: number;
  p95LatencyMs: number;
  under300Ms: number;
}

function authHeaders(token: string): HeadersInit {
  return { Authorization: `Bearer ${token}` };
}

export async function listVoiceAiProviders(token?: string): Promise<{ providers: VoiceAiProvider[] }> {
  const url = token ? `${BASE}/admin/voice-ai/providers` : `${BASE}/voice-ai/providers`;
  const headers = token ? authHeaders(token) : undefined;
  return fetchWorkerJson(url, headers ? { headers } : undefined);
}

export async function createVoiceAiSession(
  token: string,
  body: {
    providerId?: string;
    roomId?: string;
    userId?: string;
    settings?: Record<string, boolean | string> & { pipelineMode?: "unified" | "legacy" };
  },
): Promise<VoiceAiSession> {
  return fetchWorkerJson(`${BASE}/admin/voice-ai/sessions`, {
    method: "POST",
    headers: { ...authHeaders(token), "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export async function recordVoiceAiMetrics(
  token: string,
  body: {
    sessionId: string;
    stages?: unknown[];
    totalLatencyMs?: number;
    providerId?: string;
    pipelineMode?: "unified" | "legacy";
  },
): Promise<{ recorded: boolean }> {
  return fetchWorkerJson(`${BASE}/admin/voice-ai/metrics`, {
    method: "POST",
    headers: { ...authHeaders(token), "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export async function getVoiceAiStats(token: string): Promise<{ stats: VoiceAiStats }> {
  return fetchWorkerJson(`${BASE}/admin/voice-ai/stats`, { headers: authHeaders(token) });
}

export async function transcribeWithWorker(
  token: string,
  body: { audioBase64: string; mimeType?: string; language?: string; roomId?: string; announce?: boolean },
): Promise<{ ok: true; text: string; model: string; engine: string | null }> {
  return fetchWorkerJson(`${BASE}/voice-ai/transcribe`, {
    method: "POST",
    headers: { ...authHeaders(token), "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export async function speakWithWorker(
  token: string,
  body: { text: string; lang?: string; voice?: string; roomId?: string; announce?: boolean },
): Promise<{ ok: true; audioBase64: string; mimeType: string; model: string; engine: string }> {
  return fetchWorkerJson(`${BASE}/voice-ai/speak`, {
    method: "POST",
    headers: { ...authHeaders(token), "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export function blobToAudioBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result || "");
      resolve(dataUrl.includes(",") ? dataUrl.slice(dataUrl.indexOf(",") + 1) : dataUrl);
    };
    reader.onerror = () => reject(reader.error ?? new Error("read failed"));
    reader.readAsDataURL(blob);
  });
}

export async function listVoiceAiMetrics(token: string, limit = 20): Promise<{ entries: unknown[]; count: number }> {
  const url = new URL(`${BASE}/admin/voice-ai/metrics`);
  url.searchParams.set("limit", String(limit));
  return fetchWorkerJson(url.toString(), { headers: authHeaders(token) });
}
