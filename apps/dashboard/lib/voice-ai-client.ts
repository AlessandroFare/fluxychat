import { getPublicWorkerUrl } from "@/lib/worker-url-client";
import { fetchWorkerJson } from "@/lib/worker-fetch";

const BASE = getPublicWorkerUrl();

export interface VoiceAiProvider {
  id: string;
  label: string;
  model: string;
  features: string[];
  targetLatencyMs: number;
}

export interface VoiceAiSession {
  sessionId: string;
  provider: string;
  status: string;
  wsUrl: string;
  targetLatencyMs: number;
  settings: Record<string, boolean>;
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
  body: { providerId?: string; roomId?: string; userId?: string; settings?: Record<string, boolean> },
): Promise<VoiceAiSession> {
  return fetchWorkerJson(`${BASE}/admin/voice-ai/sessions`, {
    method: "POST",
    headers: { ...authHeaders(token), "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export async function recordVoiceAiMetrics(
  token: string,
  body: { sessionId: string; stages?: unknown[]; totalLatencyMs?: number; providerId?: string },
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

export async function listVoiceAiMetrics(token: string, limit = 20): Promise<{ entries: unknown[]; count: number }> {
  const url = new URL(`${BASE}/admin/voice-ai/metrics`);
  url.searchParams.set("limit", String(limit));
  return fetchWorkerJson(url.toString(), { headers: authHeaders(token) });
}
